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
  const computed = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(storedHash));
}

/**
 * PIN doğrulama
 */
export function verifyPin(pin: string, storedPinHash: string, salt: string): boolean {
  const computed = crypto.pbkdf2Sync(pin, `pin_salt_${salt}`, 50000, 32, 'sha256').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(storedPinHash));
}

/**
 * Rastgele oturum tokeni üretme (32 byte hex)
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Sunucu tarafı API rotalarında aktif oturum açan kullanıcıyı döndürür
 */
export async function getAuthUser() {
  try {
    const { cookies } = await import('next/headers');
    const { db } = await import('@/db');
    const { authSessions, users } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('singularity_session')?.value;
    if (!sessionToken) return null;

    const now = new Date().toISOString();
    const session = await db.select().from(authSessions)
      .where(eq(authSessions.token, sessionToken))
      .limit(1)
      .get();

    if (!session || session.expires_at < now) return null;

    const user = await db.select().from(users).where(eq(users.id, session.user_id)).limit(1).get();
    return user || null;
  } catch (err) {
    return null;
  }
}
