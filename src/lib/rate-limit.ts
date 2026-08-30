/**
 * In-memory rate limiter (sunucu-tarafı, tek instance için uygundur)
 * Brute-force saldırılara karşı login ve register endpoint'lerini korur.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Bellek sızıntısını önlemek için süresi dolmuş girdileri periyodik temizle
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now > entry.resetAt) {
        store.delete(key);
      }
    }
  }, 60_000); // Her 1 dakikada bir temizle
}

/**
 * Rate limit kontrolü yapar.
 * @param key - Gruplama anahtarı (örn. IP adresi veya "ip:endpoint")
 * @param maxRequests - Pencere içindeki maksimum istek sayısı
 * @param windowMs - Pencere süresi (millisaniye)
 * @returns { allowed: boolean; remaining: number; retryAfterMs: number }
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    // İlk istek veya pencere sıfırlandı
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
 * İstek nesnesinden IP adresini güvenli şekilde çıkarır.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || 'unknown';
}
