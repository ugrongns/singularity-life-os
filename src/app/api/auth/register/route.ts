import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db, initDatabase } from '@/db';
import { users, families, authSessions, appSettings, userHealthProfile, userReadingProfile, walletsAccounts, familyInvites, familyMembers } from '@/db/schema';
import { hashPassword, hashPin, generateSessionToken } from '@/lib/auth';
import { eq, and, gt } from 'drizzle-orm';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    await initDatabase();
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

    if (password.length < 8) {
      return NextResponse.json({
        success: false,
        error: 'Master Parola en az 8 karakter olmalıdır.'
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
    const existingUser = (await db.select().from(users).where(eq(users.username, username.toLowerCase().trim())).limit(1))[0];
    if (existingUser) {
      return NextResponse.json({
        success: false,
        error: 'Bu kullanıcı adı zaten kullanılmaktadır.'
      }, { status: 400 });
    }

    // 3. KAYITLI E-POSTA ADRESİ KONTROLÜ
    if (email && email.trim()) {
      const existingEmail = (await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1))[0];
      if (existingEmail) {
        return NextResponse.json({
          success: false,
          error: 'Bu e-posta adresi zaten kayıtlıdır. Lütfen farklı bir e-posta adresi kullanın veya giriş yapın.'
        }, { status: 400 });
      }
    }

    const now = new Date().toISOString();
    const userId = `usr_${crypto.randomUUID()}`;
    let familyId = '';
    let userRole = 'admin';
    let userRelationship = 'leader';
    let isMaster = 1;

    // 4. DAVET KODU KONTROLÜ VE ATOMİK TÜKETİM (Eğer girildiyse)
    let validInvite: any = null;
    if (invite_code && String(invite_code).trim()) {
      const cleanCode = String(invite_code).trim().toUpperCase();

      // Atomik Check-and-Set: Tek adımda rezerve et ve tüket (Race Condition / TOCTOU önleme)
      const consumedInvite = await db.update(familyInvites)
        .set({ is_used: 1, used_by_user_id: userId })
        .where(
          and(
            eq(familyInvites.invite_code, cleanCode),
            eq(familyInvites.is_used, 0),
            gt(familyInvites.expires_at, now)
          )
        )
        .returning();

      if (!consumedInvite || consumedInvite.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Geçersiz, süresi dolmuş veya az önce kullanılmış Aile Davet Kodu. Lütfen doğru kodu girdiğinizden emin olun.'
        }, { status: 400 });
      }

      validInvite = consumedInvite[0];
      familyId = validInvite.family_id || `fam-${validInvite.created_by_user_id}`;
      userRole = validInvite.family_role || 'member';
      userRelationship = validInvite.relationship_type || 'spouse';
      isMaster = 0;
    } else {
      // 👑 Bağımsız Kayıt: Yeni Bir Aile / Hane Oluştur
      const nameParts = full_name.trim().split(' ');
      const surname = nameParts.length > 1 ? nameParts[nameParts.length - 1] : full_name.trim();
      const familyName = `${surname} Ailesi`;
      familyId = `fam_${crypto.randomUUID()}`;

      await db.insert(families).values({
        id: familyId,
        name: familyName,
        created_by_user_id: userId,
        created_at: now,
        updated_at: now
      });
    }

    // Hash password & PIN (asenkron, bağımsız salt)
    const { hash: passwordHash, salt } = await hashPassword(password);
    const { hash: quickPinHash, pinSalt } = await hashPin(String(quick_pin));

    // Insert user
    await db.insert(users).values({
      id: userId,
      username: username.toLowerCase().trim(),
      full_name: full_name.trim(),
      email: email ? email.trim() : null,
      password_hash: passwordHash,
      password_salt: salt,
      pin_salt: pinSalt,
      quick_pin_hash: quickPinHash,
      role: userRole,
      relationship_type: userRelationship,
      avatar_emoji: avatar_emoji || (isMaster ? '👑' : '👤'),
      is_master_account: isMaster,
      family_id: familyId,
      created_at: now,
      updated_at: now
    });

    // Aile Üyesi Profilini Bağla veya Oluştur
    let existingMember: any = null;
    if (validInvite) {
      const familyMemberList = await db.select().from(familyMembers).where(eq(familyMembers.family_id, familyId));
      if (validInvite.target_name) {
        existingMember = familyMemberList.find((m: any) => !m.user_id && m.name.toLowerCase().trim() === validInvite.target_name.toLowerCase().trim());
      }
      if (!existingMember) {
        existingMember = familyMemberList.find((m: any) => !m.user_id && (m.relationship_type === userRelationship || m.role === userRole));
      }
    }

    if (existingMember) {
      await db.update(familyMembers).set({
        user_id: userId,
        name: full_name.trim(),
        avatar: avatar_emoji || existingMember.avatar || '👤',
        updated_at: now
      }).where(eq(familyMembers.id, existingMember.id));
    } else {
      await db.insert(familyMembers).values({
        id: `fm-${userId}`,
        family_id: familyId,
        user_id: userId,
        name: full_name.trim(),
        role: userRole,
        relationship_type: userRelationship,
        avatar: avatar_emoji || (isMaster ? '👑' : '👤'),
        is_active: 1,
        created_at: now,
        updated_at: now
      });
    }

    // Health Profile başlangıç kaydı (Kişiye Özel)
    try {
      await db.insert(userHealthProfile).values({
        id: `hp-${userId}`,
        user_id: userId,
        daily_water_target_ml: Number(daily_water_target_ml) || 2500,
        created_at: now,
        updated_at: now
      });
    } catch (e) {}

    // Reading Profile başlangıç kaydı (Kişiye Özel)
    try {
      await db.insert(userReadingProfile).values({
        id: `rp-${userId}`,
        user_id: userId,
        yearly_target_books: 24,
        calibrated_avg_wpm: 220,
        avg_seconds_per_page: 84,
        created_at: now,
        updated_at: now
      });
    } catch (e) {}

    // Başlangıç Cüzdanı
    try {
      await db.insert(walletsAccounts).values({
        id: `w-${userId}-main`,
        name: isMaster ? 'Vadesiz Maaş Hesabı' : `${full_name.trim().split(' ')[0]} Vadesiz Hesabı`,
        type: 'bank',
        currency: currency || 'TRY',
        balance: 0,
        color: '#3B82F6',
        is_active: 1,
        is_family_shared: isMaster ? 1 : 0,
        user_id: userId,
        family_id: familyId,
        created_at: now,
        updated_at: now
      });
    } catch (e) {}

    // Save Telegram settings if provided
    if (telegram_bot_token && telegram_chat_id) {
      await db.update(users).set({
        telegram_bot_token,
        telegram_chat_id,
        telegram_enabled: 1,
        updated_at: now
      }).where(eq(users.id, userId));
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
    });

    // Set cookie (token response body'de döndürülmez — sadece httpOnly cookie kullanılır)
    const cookieStore = await cookies();
    cookieStore.set('singularity_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // Standardized to 'lax'
      path: '/',
      maxAge: 30 * 86400
    });

    return NextResponse.json({
      success: true,
      message: isMaster ? 'Master kullanıcı başarıyla oluşturuldu!' : 'Aile üyesi kaydı başarıyla tamamlandı!',
      data: {
        user: {
          id: userId,
          username: username.toLowerCase().trim(),
          full_name: full_name.trim(),
          email: email || null,
          role: userRole,
          avatar_emoji: avatar_emoji || (isMaster ? '👑' : '👤'),
          is_master_account: isMaster === 1
        }
      }
    });
  } catch (error: any) {
    console.error('Register API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
