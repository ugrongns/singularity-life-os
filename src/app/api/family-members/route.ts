import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { familyMembers, users, transactions } from '@/db/schema';
import { getAuthUser } from '@/lib/auth';
import { eq, desc, and } from 'drizzle-orm';

export async function GET() {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Oturum bulunamadı.' }, { status: 401 });
    }

    const familyId = user.family_id || `fam-${user.id}`;
    
    // Yalnızca bu kullanıcının ailesine ait aktif üyeleri getir
    let members = await db.select().from(familyMembers).where(
      and(
        eq(familyMembers.is_active, 1),
        eq(familyMembers.family_id, familyId)
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

    // Her üyenin toplam harcama adedini ve son harcama tarihini hesapla
    const membersWithStats = await Promise.all((members).map(async (m: any) => {
      const memberTxs = await db.select().from(transactions).where(eq(transactions.member_id, m.id));
      return {
        ...m,
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
    const { name, role = 'member', relationship_type = 'spouse', avatar = '👤' } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Üye adı zorunludur.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const newId = `fm-${Date.now()}`;
    const familyId = user.family_id || `fam-${user.id}`;

    await db.insert(familyMembers).values({
      id: newId,
      family_id: familyId,
      name: name.trim(),
      role: role || 'member',
      relationship_type: relationship_type || 'spouse',
      avatar: avatar || '👤',
      is_active: 1,
      created_at: now,
      updated_at: now
    });

    return NextResponse.json({
      success: true,
      message: `🎉 ${name.trim()} aile üyelerine eklendi!`,
      data: { id: newId, name, role, relationship_type, avatar }
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
