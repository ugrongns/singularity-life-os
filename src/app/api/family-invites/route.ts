import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { familyInvites } from '@/db/schema';
import { getAuthUser } from '@/lib/auth';
import { eq, and, gt } from 'drizzle-orm';

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let randomStr = '';
  for (let i = 0; i < 6; i++) {
    randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `FAM-${randomStr}`;
}

export async function GET() {
  try {
    initDatabase();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Oturum bulunamadı.' }, { status: 401 });
    }

    const nowISO = new Date().toISOString();

    // Aktif ve süresi dolmamış davet kodlarını çek
    const activeInvites = db.select()
      .from(familyInvites)
      .where(
        and(
          eq(familyInvites.created_by_user_id, user.id),
          eq(familyInvites.is_used, 0),
          gt(familyInvites.expires_at, nowISO)
        )
      )
      .all();

    return NextResponse.json({
      success: true,
      data: activeInvites
    });
  } catch (error: any) {
    console.error('Family Invites GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    initDatabase();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Oturum bulunamadı.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { family_role = 'spouse', target_name = '' } = body;

    const now = new Date();
    const nowISO = now.toISOString();

    // 7 gün geçerli davet kodu
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const code = generateInviteCode();
    const inviteId = `inv-${Date.now()}`;

    db.insert(familyInvites).values({
      id: inviteId,
      invite_code: code,
      created_by_user_id: user.id,
      family_role,
      target_name: target_name?.trim() || null,
      expires_at: expiresAt,
      is_used: 0,
      created_at: nowISO
    }).run();

    return NextResponse.json({
      success: true,
      message: '🎉 Aile davet kodu üretildi! 7 gün boyunca geçerlidir.',
      data: {
        invite_code: code,
        expires_at: expiresAt,
        family_role,
        target_name: target_name?.trim() || null
      }
    });
  } catch (error: any) {
    console.error('Family Invites POST Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
