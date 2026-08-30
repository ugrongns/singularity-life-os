import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { familyMembers, familyInvites, users, transactions } from '@/db/schema';
import { getAuthUser } from '@/lib/auth';
import { eq, desc, and, gt } from 'drizzle-orm';
import crypto from 'crypto';

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  let randomStr = '';
  for (let i = 0; i < 6; i++) {
    randomStr += chars[bytes[i] % chars.length];
  }
  return `FAM-${randomStr}`;
}

export async function GET() {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Oturum bulunamadı.' }, { status: 401 });
    }

    const familyId = user.family_id || `fam-${user.id}`;
    const nowISO = new Date().toISOString();
    
    // Yalnızca bu kullanıcının ailesine ait aktif üyeleri getir
    let members = await db.select().from(familyMembers).where(
      and(
        eq(familyMembers.is_active, 1),
        eq(familyMembers.family_id, familyId)
      )
    );

    // Aktif ve süresi dolmamış davet kodlarını çek
    const activeInvites = await db.select()
      .from(familyInvites)
      .where(
        and(
          eq(familyInvites.family_id, familyId),
          eq(familyInvites.is_used, 0),
          gt(familyInvites.expires_at, nowISO)
        )
      );

    // Eğer bu ailede henüz üye kaydı yoksa kullanıcının kendisini otomatik Aile Lideri olarak ekle
    if (members.length === 0) {
      const now = new Date().toISOString();
      const defaultMemberName = user.full_name || 'Aile Lideri';
      const defaultId = `fm-${user.id}`;

      await db.insert(familyMembers).values({
        id: defaultId,
        family_id: familyId,
        user_id: user.id,
        name: defaultMemberName,
        role: user.role || 'admin',
        relationship_type: user.relationship_type || 'leader',
        avatar: user.avatar_emoji || (user.role === 'admin' ? '👑' : '👤'),
        is_active: 1,
        created_at: now,
        updated_at: now
      });

      members = await db.select().from(familyMembers).where(
        and(
          eq(familyMembers.is_active, 1),
          eq(familyMembers.family_id, familyId)
        )
      );
    }

    // Her üyenin toplam harcama adedini ve bağlı davet kodunu hesapla
    const membersWithStats = await Promise.all((members).map(async (m: any) => {
      const memberTxs = await db.select().from(transactions).where(eq(transactions.member_id, m.id));
      
      // Bu üyeye ait bekleyen davet kodunu bul (Kayıt olmamışsa)
      let matchingInvite = null;
      if (!m.user_id) {
        matchingInvite = activeInvites.find((inv: any) => 
          inv.target_name && inv.target_name.toLowerCase().trim() === m.name.toLowerCase().trim()
        ) || activeInvites.find((inv: any) => inv.relationship_type === (m.relationship_type || m.role));
      }

      return {
        ...m,
        invite_code: matchingInvite ? matchingInvite.invite_code : null,
        invite_expires_at: matchingInvite ? matchingInvite.expires_at : null,
        has_registered: Boolean(m.user_id),
        is_current_user: m.user_id === user.id,
        transaction_count: memberTxs.length,
        total_spent: (memberTxs).reduce((sum: number, t: any) => sum + (t.amount || 0), 0)
      };
    }));

    return NextResponse.json({
      success: true,
      data: membersWithStats
    });
  } catch (error: any) {
    console.error('Family Members GET API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Oturum bulunamadı.' }, { status: 401 });
    }

    const body = await req.json();
    const { name, role = 'spouse', avatar = '👩' } = body;
    const cleanName = (name || '').trim();

    if (!cleanName) {
      return NextResponse.json({ success: false, error: 'Lütfen aile üyesinin adını ve soyadını girin.' }, { status: 400 });
    }

    const now = new Date();
    const nowISO = now.toISOString();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 gün geçerli
    const code = generateInviteCode();
    const newId = `fm-${Date.now()}`;
    const familyId = user.family_id || `fam-${user.id}`;
    const inviteId = `inv-${Date.now()}`;

    // 1. Aile Üyesi Profil Kaydını Oluştur
    await db.insert(familyMembers).values({
      id: newId,
      family_id: familyId,
      name: cleanName,
      role: role || 'member',
      relationship_type: role || 'spouse',
      avatar: avatar || '👤',
      is_active: 1,
      created_at: nowISO,
      updated_at: nowISO
    });

    // 2. Bu Üyeye Özel Aile Davet Kodunu Oluştur ve Bağla
    await db.insert(familyInvites).values({
      id: inviteId,
      family_id: familyId,
      invite_code: code,
      created_by_user_id: user.id,
      family_role: role || 'member',
      relationship_type: role || 'spouse',
      target_name: cleanName,
      expires_at: expiresAt,
      is_used: 0,
      created_at: nowISO
    });

    return NextResponse.json({
      success: true,
      message: `🎉 ${cleanName} aileye eklendi ve özel davet kodu (${code}) üretildi!`,
      data: {
        id: newId,
        name: cleanName,
        role: role,
        avatar: avatar,
        invite_code: code,
        expires_at: expiresAt
      }
    });
  } catch (error: any) {
    console.error('Family Members POST API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user || !user.id) {
      return NextResponse.json({ success: false, error: 'Oturum bulunamadı.' }, { status: 401 });
    }

    const familyId = user.family_id || `fam-${user.id}`;
    const body = await req.json();
    const { id, name, role, relationship_type, avatar, is_active } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Üye ID zorunludur.' }, { status: 400 });
    }

    const now = new Date().toISOString();

    await db.update(familyMembers)
      .set({
        name: name ? name.trim() : undefined,
        role: role || undefined,
        relationship_type: relationship_type || undefined,
        avatar: avatar || undefined,
        is_active: typeof is_active === 'number' ? is_active : 1,
        updated_at: now
      })
      .where(and(eq(familyMembers.id, id), eq(familyMembers.family_id, familyId)));

    return NextResponse.json({
      success: true,
      message: 'Üye bilgileri güncellendi.'
    });
  } catch (error: any) {
    console.error('Family Members PUT API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user || !user.id) {
      return NextResponse.json({ success: false, error: 'Oturum bulunamadı.' }, { status: 401 });
    }

    const familyId = user.family_id || `fam-${user.id}`;
    const { searchParams } = new URL(req.url, 'http://localhost');
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Üye ID zorunludur.' }, { status: 400 });
    }

    // Soft delete (is_active = 0) with family isolation
    await db.update(familyMembers)
      .set({ is_active: 0, updated_at: new Date().toISOString() })
      .where(and(eq(familyMembers.id, id), eq(familyMembers.family_id, familyId)));

    return NextResponse.json({
      success: true,
      message: 'Aile üyesi deaktif edildi.'
    });
  } catch (error: any) {
    console.error('Family Members DELETE API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
