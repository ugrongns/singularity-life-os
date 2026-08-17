import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { userHealthProfile } from '@/db/schema';
import { eq , or } from 'drizzle-orm';

export async function GET() {
  try {
    initDatabase();
    const profile = (await db.select().from(userHealthProfile).limit(1))[0] || {
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
    initDatabase();
    const body = await req.json();
    const { amount_ml = 250, reset = false } = body;

    const profile = (await db.select().from(userHealthProfile).limit(1))[0];
    const current = reset ? 0 : (profile?.consumed_water_ml || 0) + (parseFloat(amount_ml) || 250);

    await db.update(userHealthProfile)
      .set({ consumed_water_ml: current, updated_at: new Date().toISOString() })
      ;

    return NextResponse.json({
      success: true,
      message: reset ? '💧 Günlük su sayacı sıfırlandı.' : `💧 +${amount_ml} ml su kaydedildi! Toplam: ${current} ml`,
      consumed_ml: current
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
