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

// Module-level in-memory store (tek sunucu instance'ı için uygundur)
const rateLimitStore = new Map<string, RateLimitEntry>();

function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, retryAfterMs: 0 };
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

// ─── Oturum Token Format Doğrulama ─────────────────────────────────────────
/** 64 hex karakter — crypto.randomBytes(32).toString('hex') çıktısı */
const SESSION_TOKEN_REGEX = /^[a-f0-9]{64}$/i;

function isValidTokenFormat(token: string): boolean {
  return SESSION_TOKEN_REGEX.test(token);
}

// ─── Public Rotalar ─────────────────────────────────────────────────────────
const PUBLIC_API_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/session',
  '/api/telegram', // Webhook kendi secret token & chat_id doğrulamasını yapar
];

// ─── Middleware ─────────────────────────────────────────────────────────────
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const ip = getClientIp(request);

  // ── Rate Limiting: /api/auth/login ────────────────────────────────────────
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

  // ── Rate Limiting: /api/auth/register ────────────────────────────────────
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

  // ── Public Rota Geçişi ────────────────────────────────────────────────────
  const isPublic = PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route));
  if (isPublic) {
    return NextResponse.next();
  }

  // ── Protected Rota: Cookie Varlık + Format Kontrolü ──────────────────────
  const sessionToken = request.cookies.get('singularity_session')?.value;

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

  // Token format doğrulaması (Edge Runtime'da DB sorgusu yapılamaz;
  // gerçek geçerlilik kontrolü her route'da getAuthUser() ile yapılır)
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
  matcher: ['/api/:path*'],
};
