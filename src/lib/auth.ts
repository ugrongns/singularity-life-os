import crypto from 'crypto';
import util from 'util';

const pbkdf2Async = util.promisify(crypto.pbkdf2);

export interface HashResult {
  hash: string;
  salt: string;
}

export interface PinHashResult {
  hash: string;
  pinSalt: string;
}

/**
 * PBKDF2-SHA256 ile asenkron parola hashleme (100.000 iterasyon)
 * Event-loop bloklanmasını önler.
 */
export async function hashPassword(password: string, salt?: string): Promise<HashResult> {
  const finalSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = await pbkdf2Async(password, finalSalt, 100000, 32, 'sha256');
  return { hash: derived.toString('hex'), salt: finalSalt };
}

/**
 * 6 haneli PIN hashleme (PBKDF2-SHA256, 50.000 iterasyon)
 * Bağımsız pin_salt kullanır (salt reuse zafiyetini önler).
 */
export async function hashPin(pin: string, pinSalt?: string): Promise<PinHashResult> {
  const finalPinSalt = pinSalt || crypto.randomBytes(16).toString('hex');
  const derived = await pbkdf2Async(pin, finalPinSalt, 50000, 32, 'sha256');
  return { hash: derived.toString('hex'), pinSalt: finalPinSalt };
}

/**
 * Asenkron parola doğrulama (timing-attack korumalı)
 */
export async function verifyPassword(password: string, storedHash: string, salt: string): Promise<boolean> {
  if (!password || !storedHash || !salt) return false;
  const derived = await pbkdf2Async(password, salt, 100000, 32, 'sha256');
  const bufA = Buffer.from(derived.toString('hex'));
  const bufB = Buffer.from(storedHash);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Asenkron PIN doğrulama
 * Öncelikle bağımsız pin_salt dener; eski hesaplar için 'pin_salt_' + passwordSalt geriye dönük uyumluluk sağlar.
 */
export async function verifyPin(
  pin: string,
  storedPinHash: string,
  passwordSalt: string,
  pinSalt?: string | null
): Promise<boolean> {
  if (!pin || !storedPinHash) return false;

  // 1. Yeni ve bağımsız pin_salt ile doğrulama
  if (pinSalt) {
    const derived = await pbkdf2Async(pin, pinSalt, 50000, 32, 'sha256');
    const bufA = Buffer.from(derived.toString('hex'));
    const bufB = Buffer.from(storedPinHash);
    if (bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)) {
      return true;
    }
  }

  // 2. Geriye dönük uyumluluk: Eski hesaplar için legacy salt doğrulama
  if (passwordSalt) {
    const legacyDerived = await pbkdf2Async(pin, `pin_salt_${passwordSalt}`, 50000, 32, 'sha256');
    const bufA = Buffer.from(legacyDerived.toString('hex'));
    const bufB = Buffer.from(storedPinHash);
    if (bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)) {
      return true;
    }
  }

  return false;
}

/**
 * Rastgele oturum tokeni üretme (32 byte hex)
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hassas sütunları (parola hash/salt, PIN hash/salt, bot token) nesneden ayıklar (OWASP BOPLA koruması)
 */
export function sanitizeUser(user: any) {
  if (!user) return null;
  const {
    password_hash,
    password_salt,
    pin_salt,
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
