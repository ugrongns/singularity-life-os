import crypto from 'crypto';

export interface HashResult {
  hash: string;
  salt: string;
}

/**
 * PBKDF2-SHA256 ile parola hashleme (100.000 iterasyon)
 */
export function hashPassword(password: string, salt?: string): HashResult {
  const finalSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, finalSalt, 100000, 32, 'sha256').toString('hex');
  return { hash, salt: finalSalt };
}

/**
 * 6 haneli PIN hashleme (PBKDF2-SHA256)
 */
export function hashPin(pin: string, salt: string): string {
  return crypto.pbkdf2Sync(pin, `pin_salt_${salt}`, 50000, 32, 'sha256').toString('hex');
}

/**
 * Parola doğrulama
 */
export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  if (!password || !storedHash || !salt) return false;
  const computed = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
  const bufA = Buffer.from(computed);
  const bufB = Buffer.from(storedHash);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * PIN doğrulama
 */
export function verifyPin(pin: string, storedPinHash: string, salt: string): boolean {
  if (!pin || !storedPinHash || !salt) return false;
  const computed = crypto.pbkdf2Sync(pin, `pin_salt_${salt}`, 50000, 32, 'sha256').toString('hex');
  const bufA = Buffer.from(computed);
  const bufB = Buffer.from(storedPinHash);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Rastgele oturum tokeni üretme (32 byte hex)
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hassas sütunları (parola hash/salt, PIN hash, bot token) nesneden ayıklar (OWASP BOPLA koruması)
 */
export function sanitizeUser(user: any) {
  if (!user) return null;
  const {
    password_hash,
    password_salt,
    quick_pin_hash,
    telegram_bot_token,
    telegram_secret_token,
    ...safeUser
  } = user;
  return safeUser;
}

// Paralel composite çağrılarında aynı token için mükerrer DB sorgularını birleştiren kısa ömürlü (2sn) önbellek
const _authCache = new Map<string, { user: any; expiresAt: number }>();
const _inFlightAuth = new Map<string, Promise<any>>();

export function clearAuthSessionCache(token?: string) {
  if (token) {
    _authCache.delete(token);
    _inFlightAuth.delete(token);
  } else {
    _authCache.clear();
    _inFlightAuth.clear();
  }
}

/**
 * Sunucu tarafı API rotalarında aktif oturum açan kullanıcıyı döndürür.
 * Varsayılan olarak parola hash/salt/PIN/token gibi gizli alanları ayıklar.
 */
export async function getAuthUser(options?: { includeSecrets?: boolean }) {
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('singularity_session')?.value;
    if (!sessionToken) return null;

    const nowMs = Date.now();
    const cached = _authCache.get(sessionToken);
    if (cached && cached.expiresAt > nowMs) {
      return options?.includeSecrets ? cached.user : sanitizeUser(cached.user);
    }

    let pending = _inFlightAuth.get(sessionToken);
    if (!pending) {
      pending = (async () => {
        const { db } = await import('@/db');
        const { authSessions, users } = await import('@/db/schema');
        const { eq } = await import('drizzle-orm');

        const nowISO = new Date().toISOString();
        const session = (await db.select().from(authSessions)
          .where(eq(authSessions.token, sessionToken))
          .limit(1))[0];

        if (!session || session.expires_at < nowISO) return null;

        const user = (await db.select().from(users).where(eq(users.id, session.user_id)).limit(1))[0];
        if (user) {
          _authCache.set(sessionToken, { user, expiresAt: Date.now() + 2000 });
        }
        return user || null;
      })().finally(() => {
        _inFlightAuth.delete(sessionToken);
      });
      _inFlightAuth.set(sessionToken, pending);
    }

    const rawUser = await pending;
    if (!rawUser) return null;
    return options?.includeSecrets ? rawUser : sanitizeUser(rawUser);
  } catch (err) {
    return null;
  }
}
