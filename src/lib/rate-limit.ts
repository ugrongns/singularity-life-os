/**
 * In-memory Bounded Rate Limiter (Sunucu-tarafı / Edge & Serverless uyumlu)
 * Brute-force saldırılarına karşı login, register ve hassas rotaları korur.
 * LRU / bounded cache mekanizmasıyla bellek sızıntısını (DoS / Memory Exhaustion) engeller.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const MAX_RATE_LIMIT_ENTRIES = 5000;
const store = new Map<string, RateLimitEntry>();

function evictExpiredOrOldest(now: number) {
  // 1. Süresi dolmuş girdileri temizle
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }

  // 2. Eğer hala kapasite sınırındaysa, en eski eklenen girdiyi sil (FIFO/LRU)
  while (store.size >= MAX_RATE_LIMIT_ENTRIES) {
    const oldestKey = store.keys().next().value;
    if (oldestKey) {
      store.delete(oldestKey);
    } else {
      break;
    }
  }
}

/**
 * Rate limit kontrolü yapar.
 * @param key - Gruplama anahtarı (örn. IP adresi veya "login:ip")
 * @param maxRequests - Pencere içindeki maksimum istek sayısı
 * @param windowMs - Pencere süresi (milisaniye)
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    if (store.size >= MAX_RATE_LIMIT_ENTRIES) {
      evictExpiredOrOldest(now);
    }
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, retryAfterMs: 0 };
  }

  if (entry.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: entry.resetAt - now,
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    retryAfterMs: 0,
  };
}

/**
 * İstek nesnesinden gerçek istemci IP adresini güvenli şekilde çıkarır.
 * Spoofing (X-Forwarded-For manipülasyonu) riskine karşı güvenilir proxy başlıklarını önceler.
 */
export function getClientIp(request: Request): string {
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
