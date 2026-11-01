import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { users, authSessions } from '@/db/schema';
import { verifyPassword, generateSessionToken } from '@/lib/auth';
import { eq, or, lt, sql } from 'drizzle-orm';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    await initDatabase();
    const body = await req.json();
    const { username, email, password } = body;

    let targetUser = null;

    // 1. TAM GİRİŞ: E-Posta / Kullanıcı Adı + Master Parola
    if (password && (email || username || body.identifier)) {
      const rawIdentifier = email || username || body.identifier || '';
      const identifier = rawIdentifier.toString().toLowerCase().trim();

      // Hem email, hem username hem de UUID/id ile ara
      targetUser = await db.select().from(users)
        .where(or(
          sql`lower(${users.email}) = ${identifier}`,
          sql`lower(${users.username}) = ${identifier}`,
          eq(users.id, rawIdentifier.toString().trim()),
          sql`lower(${users.id}) = ${identifier}`
        ))
        .limit(1).then((r: any) => r[0]);

      const isValidPass = targetUser
        ? await verifyPassword(password, targetUser.password_hash, targetUser.password_salt)
        : false;

      if (!targetUser || !isValidPass) {
        return NextResponse.json({
          success: false,
          error: 'E-posta, kullanıcı adı veya parola hatalı.'
        }, { status: 401 });
      }
    }
    // Geçersiz giriş isteği
    else {
      return NextResponse.json({
        success: false,
        error: 'Lütfen E-posta adresinizi (veya Kullanıcı Adınızı) ve Master Parolanızı girin.'
      }, { status: 400 });
    }

    // ── Eski Oturumları Temizle (Session Birikmesini Önle) ─────────────────────
    // Süresi dolmuş tüm oturumları sil (expires_at < now)
    const nowISO = new Date().toISOString();
    await db.delete(authSessions).where(lt(authSessions.expires_at, nowISO));

    // Başarılı Giriş: Oturum Oluştur
    const token = generateSessionToken();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString(); // 30 gün

    await db.insert(authSessions).values({
      token,
      user_id: targetUser.id,
      expires_at: expiresAt,
      device_name: 'web-local',
      created_at: now
    });

    const cookieStore = await cookies();
    cookieStore.set('singularity_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // OAuth (Strava vb.) harici yönlendirmeleriyle uyumluluk için 'lax' standardı
      path: '/',
      maxAge: 30 * 86400
    });

    // Token'ı response body'de DÖNDÜRME — sadece cookie kullan
    return NextResponse.json({
      success: true,
      message: 'Giriş başarılı!',
      data: {
        user: {
          id: targetUser.id,
          username: targetUser.username,
          full_name: targetUser.full_name,
          email: targetUser.email,
          role: targetUser.role,
          avatar_emoji: targetUser.avatar_emoji,
          is_master_account: targetUser.is_master_account === 1
        }
      }
    });
  } catch (error: any) {
    console.error('Login API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
