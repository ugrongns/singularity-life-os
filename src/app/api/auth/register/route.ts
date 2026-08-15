import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { users, authSessions, appSettings, userHealthProfile, userReadingProfile, walletsAccounts, familyInvites, familyMembers } from '@/db/schema';
import { hashPassword, hashPin, generateSessionToken } from '@/lib/auth';
import { eq, and, gt } from 'drizzle-orm';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    initDatabase();
    const body = await req.json();
    const {
      full_name,
      username,
      email,
      password,
      quick_pin,
      invite_code,
      avatar_emoji = '👤',
      daily_water_target_ml = 2500,
      currency = 'TRY',
      telegram_bot_token,
      telegram_chat_id
    } = body;

    if (!full_name || !username || !password || !quick_pin) {
      return NextResponse.json({
        success: false,
        error: 'Lütfen tüm zorunlu alanları doldurun (Ad Soyad, Kullanıcı Adı, Parola, 6 Haneli PIN).'
      }, { status: 400 });
    }

    if (String(quick_pin).length !== 6 || !/^\d{6}$/.test(String(quick_pin))) {
      return NextResponse.json({
        success: false,
        error: 'Hızlı PIN tam olarak 6 haneli rakamlardan oluşmalıdır.'
      }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({
        success: false,
        error: 'Master Parola en az 6 karakter olmalıdır.'
      }, { status: 400 });
    }

    // 1. PIN VE MASTER PAROLA AYNI OLAMAZ KONTROLÜ
    if (password.trim() === String(quick_pin).trim()) {
      return NextResponse.json({
        success: false,
        error: 'Master Parola ve 6 Haneli Hızlı PIN aynı olamaz! Güvenliğiniz için lütfen farklı bir parola ve PIN belirleyin.'
      }, { status: 400 });
    }

    // 2. KULLANICI ADI KONTROLÜ
    const existingUser = await db.select().from(users).where(eq(users.username, username.toLowerCase().trim())).limit(1).get();
    if (existingUser) {
      return NextResponse.json({
        success: false,
        error: 'Bu kullanıcı adı zaten kullanılmaktadır.'
      }, { status: 400 });
    }

    // 3. KAYITLI E-POSTA ADRESİ KONTROLÜ
    if (email && email.trim()) {
      const existingEmail = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1).get();
      if (existingEmail) {
        return NextResponse.json({
          success: false,
          error: 'Bu e-posta adresi zaten kayıtlıdır. Lütfen farklı bir e-posta adresi kullanın veya giriş yapın.'
        }, { status: 400 });
      }
    }

    const now = new Date().toISOString();

    // 4. DAVET KODU KONTROLÜ (Eğer girildiyse)
    let validInvite: any = null;
    if (invite_code && String(invite_code).trim()) {
      const cleanCode = String(invite_code).trim().toUpperCase();
      validInvite = await db.select()
        .from(familyInvites)
        .where(
          and(
            eq(familyInvites.invite_code, cleanCode),
            eq(familyInvites.is_used, 0),
            gt(familyInvites.expires_at, now)
          )
        )
        .limit(1)
        .get();

      if (!validInvite) {
        return NextResponse.json({
          success: false,
          error: 'Geçersiz veya süresi dolmuş Aile Davet Kodu. Lütfen doğru kodu girdiğinizden emin olun.'
        }, { status: 400 });
      }
    }

    const allUsers = await db.select().from(users).all();
    const isFirstUser = allUsers.length === 0;

    // Hash password & PIN
    const { hash: passwordHash, salt } = hashPassword(password);
    const quickPinHash = hashPin(String(quick_pin), salt);

    const userId = `user-${Date.now()}`;

    // Insert user
    await db.insert(users).values({
      id: userId,
      username: username.toLowerCase().trim(),
      full_name: full_name.trim(),
      email: email ? email.trim() : null,
      password_hash: passwordHash,
      password_salt: salt,
      quick_pin_hash: quickPinHash,
      role: validInvite ? (validInvite.family_role || 'member') : 'admin',
      avatar_emoji: avatar_emoji || '👤',
      is_master_account: isFirstUser ? 1 : 0,
      created_at: now,
      updated_at: now
    }).run();

    // Davet Kodu Kullanıldıysa İşaretle ve Aile Üyesi Profilini Oluştur
    if (validInvite) {
      await db.update(familyInvites)
        .set({ is_used: 1, used_by_user_id: userId })
        .where(eq(familyInvites.id, validInvite.id))
        .run();

      await db.insert(familyMembers).values({
        id: `fm-${userId}`,
        name: full_name.trim(),
        role: validInvite.family_role || 'member',
        avatar: avatar_emoji || '👤',
        is_active: 1,
        created_at: now,
        updated_at: now
      }).run();
    } else {
      // İlk kullanıcı ise kendisini Aile Lideri olarak ekle
      const existingMembers = await db.select().from(familyMembers).all();
      if (existingMembers.length === 0 || isFirstUser) {
        await db.insert(familyMembers).values({
          id: `fm-${userId}`,
          name: full_name.trim(),
          role: 'admin',
          avatar: avatar_emoji || '👑',
          is_active: 1,
          created_at: now,
          updated_at: now
        }).run();
      }
    }

    // Health Profile başlangıç kaydı
    try {
      await db.insert(userHealthProfile).values({
        id: `hp-${userId}`,
        user_id: userId,
        daily_water_target_ml: Number(daily_water_target_ml) || 2500,
        target_weight_kg: 75,
        created_at: now,
        updated_at: now
      }).run();
    } catch (e) {}

    // Reading Profile başlangıç kaydı
    try {
      await db.insert(userReadingProfile).values({
        id: `rp-${userId}`,
        user_id: userId,
        yearly_target_books: 24,
        calibrated_avg_wpm: 220,
        avg_seconds_per_page: 84,
        created_at: now,
        updated_at: now
      }).run();
    } catch (e) {}

    // Başlangıç Cüzdanı (Vadesiz Maaş Hesabı)
    try {
      await db.insert(walletsAccounts).values({
        id: `w-${userId}-main`,
        name: 'Vadesiz Maaş Hesabı',
        type: 'bank',
        currency: currency || 'TRY',
        balance: 0,
        color: '#3B82F6',
        is_active: 1,
        is_family_shared: 1,
        user_id: userId,
        created_at: now,
        updated_at: now
      }).run();
    } catch (e) {}

    // Save Telegram settings if provided
    if (telegram_bot_token && telegram_chat_id) {
      const setSetting = async (k: string, v: string) => {
        await db.insert(appSettings)
          .values({ key: k, value: v, updated_at: now })
          .onConflictDoUpdate({ target: appSettings.key, set: { value: v, updated_at: now } })
          .run();
      };
      await setSetting('telegram_bot_token', telegram_bot_token);
      await setSetting('telegram_chat_id', telegram_chat_id);
      await setSetting('telegram_enabled', 'true');
    }

    // Create session token
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString(); // 30 gün

    await db.insert(authSessions).values({
      token,
      user_id: userId,
      expires_at: expiresAt,
      device_name: 'web-local',
      created_at: now
    }).run();

    // Set cookie
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
      message: 'Master kullanıcı başarıyla oluşturuldu!',
      data: {
        token,
        user: {
          id: userId,
          username: username.toLowerCase().trim(),
          full_name: full_name.trim(),
          email: email || null,
          role: 'admin',
          avatar_emoji: avatar_emoji || '👤',
          is_master_account: true
        }
      }
    });
  } catch (error: any) {
    console.error('Register API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
