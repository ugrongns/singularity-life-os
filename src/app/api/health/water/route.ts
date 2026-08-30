import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { userHealthProfile } from '@/db/schema';
import { getAuthUser } from '@/lib/auth';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });

    const profile = (await db.select().from(userHealthProfile).where(eq(userHealthProfile.user_id, user.id)).limit(1))[0] || {
      daily_water_target_ml: 2500,
      consumed_water_ml: 1250
    };

    const target = profile.daily_water_target_ml || 2500;
    const consumed = profile.consumed_water_ml || 0;
    const percentage = Math.min(100, Math.round((consumed / target) * 100));

    return NextResponse.json({
      success: true,
      data: {
        target_ml: target,
        consumed_ml: consumed,
        remaining_ml: Math.max(0, target - consumed),
        percentage
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });

    const body = await req.json();
    const { amount_ml = 250, reset = false } = body;
    const now = new Date().toISOString();
    const familyId = user.family_id || `fam-${user.id}`;

    const profile = (await db.select().from(userHealthProfile).where(eq(userHealthProfile.user_id, user.id)).limit(1))[0];
    const current = reset ? 0 : (profile?.consumed_water_ml || 0) + (parseFloat(amount_ml) || 250);

    if (profile) {
      await db.update(userHealthProfile)
        .set({ consumed_water_ml: current, updated_at: now })
        .where(eq(userHealthProfile.id, profile.id));
    } else {
      await db.insert(userHealthProfile).values({
        id: `hp-${user.id}`,
        daily_calorie_target: 2200,
        target_protein_g: 140,
        target_carbs_g: 180,
        target_fat_g: 65,
        daily_water_target_ml: 2500,
        consumed_water_ml: current,
        active_fasting_protocol: '16:8',
        user_id: user.id,
        family_id: familyId,
        created_at: now,
        updated_at: now
      });
    }

    return NextResponse.json({
      success: true,
      message: reset ? '💧 Günlük su sayacı sıfırlandı.' : `💧 +${amount_ml} ml su kaydedildi! Toplam: ${current} ml`,
      consumed_ml: current
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
