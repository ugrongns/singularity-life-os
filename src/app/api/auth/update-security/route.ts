import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { users, authSessions } from '@/db/schema';
import { eq , or } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { hashPassword, hashPin, verifyPassword, verifyPin } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    initDatabase();
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('singularity_session')?.value;

    if (!sessionToken) {
      return NextResponse.json({ success: false, error: 'Oturum bulunamadı. Lütfen giriş yapın.' }, { status: 401 });
    }

    const session = await db.select().from(authSessions)
      .where(eq(authSessions.token, sessionToken))
      .limit(1).then((r: any) => r[0]);

    if (!session) {
      return NextResponse.json({ success: false, error: 'Geçersiz oturum.' }, { status: 401 });
    }

    const user = (await db.select().from(users).where(eq(users.id, session.user_id)).limit(1))[0];
    if (!user) {
      return NextResponse.json({ success: false, error: 'Kullanıcı bulunamadı.' }, { status: 404 });
    }

    const body = await req.json();
    const { action } = body;
    const now = new Date().toISOString();

    // 1. MASTER PAROLA DEĞİŞTİRME
    if (action === 'change_password') {
      const { current_password, new_password } = body;

      if (!current_password || !new_password) {
        return NextResponse.json({ success: false, error: 'Mevcut ve yeni parola zorunludur.' }, { status: 400 });
      }

      if (new_password.length < 6) {
        return NextResponse.json({ success: false, error: 'Yeni parola en az 6 karakter olmalıdır.' }, { status: 400 });
      }

      const isCurrentValid = verifyPassword(current_password, user.password_hash, user.password_salt);
      if (!isCurrentValid) {
        return NextResponse.json({ success: false, error: 'Mevcut master parola hatalı.' }, { status: 400 });
      }

      // PIN ile aynı olamaz kontrolü
      if (user.quick_pin_hash && verifyPin(new_password, user.quick_pin_hash, user.password_salt)) {
        return NextResponse.json({
          success: false,
          error: 'Yeni Master Parola, mevcut 6 haneli PIN kodunuzla aynı olamaz! Güvenliğiniz için farklı bir parola belirleyin.'
        }, { status: 400 });
      }

      // Mevcut salt ile yeni parola hash'i üret (böylece mevcut PIN bozulmaz)
      const newHashRes = hashPassword(new_password, user.password_salt);

      db.update(users)
        .set({
          password_hash: newHashRes.hash,
          updated_at: now
        })
        .where(eq(users.id, user.id))
        ;

      return NextResponse.json({
        success: true,
        message: 'Master parola başarıyla güncellendi!'
      });
    }

    // 2. 6 HANELİ HIZLI PIN DEĞİŞTİRME
    if (action === 'change_pin') {
      const { current_pin, new_pin, master_password } = body;

      if (!new_pin || new_pin.length !== 6 || !/^\d{6}$/.test(new_pin)) {
        return NextResponse.json({ success: false, error: 'Yeni PIN tam olarak 6 haneli rakamlardan oluşmalıdır.' }, { status: 400 });
      }

      // Master Parola ile aynı olamaz kontrolü
      if (verifyPassword(new_pin, user.password_hash, user.password_salt)) {
        return NextResponse.json({
          success: false,
          error: 'Yeni 6 Haneli PIN, Master Parolanızla aynı olamaz! Güvenliğiniz için farklı bir PIN belirleyin.'
        }, { status: 400 });
      }

      // Doğrulama: Ya mevcut PIN doğru olmalı ya da master parola doğru olmalı
      let isAuthorized = false;
      if (current_pin && user.quick_pin_hash) {
        isAuthorized = verifyPin(current_pin, user.quick_pin_hash, user.password_salt);
      }
      if (!isAuthorized && master_password) {
        isAuthorized = verifyPassword(master_password, user.password_hash, user.password_salt);
      }

      if (!isAuthorized) {
        return NextResponse.json({ success: false, error: 'Mevcut PIN veya Master Parola doğrulanamadı.' }, { status: 400 });
      }

      const newPinHash = hashPin(new_pin, user.password_salt);

      db.update(users)
        .set({
          quick_pin_hash: newPinHash,
          updated_at: now
        })
        .where(eq(users.id, user.id))
        ;

      return NextResponse.json({
        success: true,
        message: '6 Haneli Hızlı PIN başarıyla güncellendi!'
      });
    }

    // 3. PROFİL BİLGİLERİ GÜNCELLEME (İsim, E-posta, Avatar)
    if (action === 'update_profile') {
      const { full_name, email, avatar_emoji } = body;

      if (!full_name || !full_name.trim()) {
        return NextResponse.json({ success: false, error: 'Ad Soyad alanı boş bırakılamaz.' }, { status: 400 });
      }

      // E-posta benzersizlik kontrolü
      if (email && email.trim()) {
        const existingEmailUser = (await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1))[0];
        if (existingEmailUser && existingEmailUser.id !== user.id) {
          return NextResponse.json({
            success: false,
            error: 'Bu e-posta adresi başka bir kullanıcı tarafından kullanılmaktadır.'
          }, { status: 400 });
        }
      }

      db.update(users)
        .set({
          full_name: full_name.trim(),
          email: email ? email.toLowerCase().trim() : user.email,
          avatar_emoji: avatarEmojiValid(avatar_emoji) ? avatar_emoji : user.avatar_emoji,
          updated_at: now
        })
        .where(eq(users.id, user.id))
        ;

      return NextResponse.json({
        success: true,
        message: 'Profil bilgileri başarıyla güncellendi!'
      });
    }

    return NextResponse.json({ success: false, error: 'Geçersiz işlem.' }, { status: 400 });
  } catch (error: any) {
    console.error('Update Security API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

function avatarEmojiValid(emoji?: string): boolean {
  return typeof emoji === 'string' && emoji.length > 0;
}
