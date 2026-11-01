import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ─── Rate Limit Konfigürasyonu ─────────────────────────────────────────────
/** Login: 15 dakikada 10 başarısız deneme (IP bazlı) */
const LOGIN_MAX = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 dakika

/** Register: 1 saatte 5 deneme (IP bazlı) */
const REGISTER_MAX = 5;
const REGISTER_WINDOW_MS = 60 * 60 * 1000; // 1 saat

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// Bounded in-memory store (DoS ve bellek sızıntısına karşı korumalı)
const MAX_RATE_LIMIT_ENTRIES = 5000;
const rateLimitStore = new Map<string, RateLimitEntry>();

function evictExpiredOrOldest(now: number) {
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
  while (rateLimitStore.size >= MAX_RATE_LIMIT_ENTRIES) {
    const oldestKey = rateLimitStore.keys().next().value;
    if (oldestKey) {
      rateLimitStore.delete(oldestKey);
    } else {
      break;
    }
  }
}

function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    if (rateLimitStore.size >= MAX_RATE_LIMIT_ENTRIES) {
      evictExpiredOrOldest(now);
    }
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, retryAfterMs: 0 };
}

/**
 * Spoofing korumalı güvenli IP tespiti
 */
function getClientIp(request: NextRequest): string {
  const vercelIp = request.headers.get('x-vercel-proxied-for');
  if (vercelIp) return vercelIp.split(',')[0].trim();

  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();

  return '127.0.0.1';
}

// ─── Oturum Token Format Doğrulama ─────────────────────────────────────────
/** 64 hex karakter — crypto.randomBytes(32).toString('hex') çıktısı */
const SESSION_TOKEN_REGEX = /^[a-f0-9]{64}$/i;

function isValidTokenFormat(token: string): boolean {
  return SESSION_TOKEN_REGEX.test(token);
}

// ─── Public API Rotaları ────────────────────────────────────────────────────
const PUBLIC_API_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/session',
  '/api/dashboard/composite', // Landing sayfasının oturum durumunu öğrenmesi için
  '/api/market-rates',        // Canlı kur/fiyat verisi
  '/api/telegram',            // Webhook kendi secret token & chat_id doğrulamasını yapar
  '/api/health/workouts/strava/callback', // OAuth dönüşü (kendi içinde getAuthUser ve state kontrolü yapar)
];

// ─── Korumalı UI Rotaları ───────────────────────────────────────────────────
const PROTECTED_UI_ROUTES = [
  '/analytics',
  '/budget',
  '/health',
  '/library',
  '/settings',
  '/shopping',
  '/vault',
  '/vehicles',
  '/wellness',
];

// ─── Middleware ─────────────────────────────────────────────────────────────
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get('singularity_session')?.value;
  const hasValidSession = sessionToken ? isValidTokenFormat(sessionToken) : false;

  // 1. Korumalı Kullanıcı Arayüzü (UI) Sayfaları Kontrolü
  if (!pathname.startsWith('/api/')) {
    const isProtectedUI = PROTECTED_UI_ROUTES.some((route) => pathname.startsWith(route));
    if (isProtectedUI && !hasValidSession) {
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // 2. API Rotaları Yönetimi
  const ip = getClientIp(request);

  // Rate Limiting: /api/auth/login
  if (pathname.startsWith('/api/auth/login') && request.method === 'POST') {
    const { allowed, retryAfterMs } = checkRateLimit(
      `login:${ip}`,
      LOGIN_MAX,
      LOGIN_WINDOW_MS
    );
    if (!allowed) {
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);
      return NextResponse.json(
        {
          success: false,
          error: `Çok fazla başarısız giriş denemesi. Lütfen ${Math.ceil(retryAfterSec / 60)} dakika sonra tekrar deneyin.`,
          code: 'RATE_LIMITED',
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfterSec),
            'X-RateLimit-Limit': String(LOGIN_MAX),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }
  }

  // Rate Limiting: /api/auth/register
  if (pathname.startsWith('/api/auth/register') && request.method === 'POST') {
    const { allowed, retryAfterMs } = checkRateLimit(
      `register:${ip}`,
      REGISTER_MAX,
      REGISTER_WINDOW_MS
    );
    if (!allowed) {
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);
      return NextResponse.json(
        {
          success: false,
          error: `Çok fazla kayıt denemesi. Lütfen ${Math.ceil(retryAfterSec / 60)} dakika sonra tekrar deneyin.`,
          code: 'RATE_LIMITED',
        },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfterSec) },
        }
      );
    }
  }

  // Public API Rota Geçişi
  const isPublic = PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route));
  if (isPublic) {
    return NextResponse.next();
  }

  // Korumalı API Rotası: Oturum Token Varlık + Format Kontrolü
  if (!sessionToken) {
    return NextResponse.json(
      {
        success: false,
        error: 'Yetkisiz erişim. Oturum bulunamadı. Lütfen giriş yapın.',
        code: 'UNAUTHORIZED',
      },
      { status: 401 }
    );
  }

  if (!isValidTokenFormat(sessionToken)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Geçersiz oturum token formatı. Lütfen tekrar giriş yapın.',
        code: 'INVALID_TOKEN',
      },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/:path*',
    '/analytics/:path*',
    '/budget/:path*',
    '/health/:path*',
    '/library/:path*',
    '/settings/:path*',
    '/shopping/:path*',
    '/vault/:path*',
    '/vehicles/:path*',
    '/wellness/:path*',
  ],
};
