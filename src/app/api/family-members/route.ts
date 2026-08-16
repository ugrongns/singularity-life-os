import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { familyMembers, users, transactions } from '@/db/schema';
import { getAuthUser } from '@/lib/auth';
import { eq, desc, and } from 'drizzle-orm';

export async function GET() {
  try {
    initDatabase();
    const user = await getAuthUser();
    
    // Aktif üyeleri getir
    let members = await db.select().from(familyMembers).where(eq(familyMembers.is_active, 1));

    // Veritabanında henüz aile üyesi yoksa ana kullanıcıyı otomatik 1. üye olarak ekle (Auto-Seed)
    if (members.length === 0) {
      const now = new Date().toISOString();
      const defaultMemberName = user?.full_name || 'Uğur (Aile Lideri)';
      const defaultId = user?.id ? `fm-${user.id}` : `fm-master-${Date.now()}`;

      db.insert(familyMembers).values({
        id: defaultId,
        name: defaultMemberName,
        role: 'admin',
        avatar: '👑',
        is_active: 1,
        created_at: now,
        updated_at: now
      });

      members = await db.select().from(familyMembers).where(eq(familyMembers.is_active, 1));
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
    initDatabase();
    const user = await getAuthUser();
    const body = await req.json();
    const { name, role = 'member', avatar = '👤' } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Üye adı zorunludur.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const newId = `fm-${Date.now()}`;

    db.insert(familyMembers).values({
      id: newId,
      name: name.trim(),
      role: role || 'member',
      avatar: avatar || '👤',
      is_active: 1,
      created_at: now,
      updated_at: now
    });

    return NextResponse.json({
      success: true,
      message: `🎉 ${name.trim()} aile üyelerine eklendi!`,
      data: { id: newId, name, role, avatar }
    });
  } catch (error: any) {
    console.error('Family Members POST API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    initDatabase();
    const body = await req.json();
    const { id, name, role, avatar, is_active } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Üye ID zorunludur.' }, { status: 400 });
    }

    const now = new Date().toISOString();

    db.update(familyMembers)
      .set({
        name: name ? name.trim() : undefined,
        role: role || undefined,
        avatar: avatar || undefined,
        is_active: typeof is_active === 'number' ? is_active : 1,
        updated_at: now
      })
      .where(eq(familyMembers.id, id))
      ;

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
    initDatabase();
    const { searchParams } = new URL(req.url, 'http://localhost');
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Üye ID zorunludur.' }, { status: 400 });
    }

    // Soft delete (is_active = 0)
    db.update(familyMembers)
      .set({ is_active: 0, updated_at: new Date().toISOString() })
      .where(eq(familyMembers.id, id))
      ;

    return NextResponse.json({
      success: true,
      message: 'Aile üyesi deaktif edildi.'
    });
  } catch (error: any) {
    console.error('Family Members DELETE API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
