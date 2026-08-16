import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { users, authSessions } from '@/db/schema';
import { verifyPassword, verifyPin, generateSessionToken } from '@/lib/auth';
import { eq, or } from 'drizzle-orm';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    initDatabase();
    const body = await req.json();
    const { pin, username, email, password, action } = body;

    let targetUser = null;

    // 1. TAM GİRİŞ: E-Posta / Kullanıcı Adı + Master Parola
    if (password && (email || username || body.identifier)) {
      const identifier = (email || username || body.identifier || '').toLowerCase().trim();

      // Hem email hem username ile ara
      targetUser = await db.select().from(users)
        .where(or(eq(users.email, identifier), eq(users.username, identifier)))
        .limit(1).then((r: any) => r[0]);

      if (!targetUser) {
        return NextResponse.json({
          success: false,
          error: 'Bu e-posta adresi veya kullanıcı adı ile kayıtlı hesap bulunamadı.'
        }, { status: 404 });
      }

      const isValidPass = verifyPassword(password, targetUser.password_hash, targetUser.password_salt);
      if (!isValidPass) {
        return NextResponse.json({
          success: false,
          error: 'Hatalı Master Parola. Lütfen tekrar deneyin.'
        }, { status: 401 });
      }
    }
    // 2. KİLİT AÇMA (Sadece geçici kilit ekranı için PIN doğrulaması)
    else if (pin && action === 'unlock') {
      const targetUserId = body.user_id;
      if (targetUserId) {
        targetUser = (await db.select().from(users).where(eq(users.id, targetUserId)).limit(1))[0];
      } else {
        targetUser = (await db.select().from(users).where(eq(users.is_master_account, 1)).limit(1))[0] || (await db.select().from(users).limit(1))[0];
      }

      if (!targetUser) {
        return NextResponse.json({ success: false, error: 'Kullanıcı bulunamadı.' }, { status: 404 });
      }

      const isValidPin = verifyPin(String(pin), targetUser.quick_pin_hash, targetUser.password_salt);
      if (!isValidPin) {
        return NextResponse.json({ success: false, error: 'Hatalı 6 haneli PIN kodu.' }, { status: 401 });
      }
    }
    // Geçersiz giriş isteği
    else {
      return NextResponse.json({
        success: false,
        error: 'Lütfen E-posta adresinizi (veya Kullanıcı Adınızı) ve Master Parolanızı girin.'
      }, { status: 400 });
    }

    // Başarılı Giriş / Kilit Açma: Oturum Oluştur
    const token = generateSessionToken();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString(); // 30 gün

    db.insert(authSessions).values({
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
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 86400
    });

    return NextResponse.json({
      success: true,
      message: 'Giriş başarılı!',
      data: {
        token,
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
