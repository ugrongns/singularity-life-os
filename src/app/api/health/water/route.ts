import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { userHealthProfile, waterIntakeLogs } from '@/db/schema';
import { getAuthUser } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

export async function GET() {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });

    const today = new Date().toISOString().split('T')[0];

    const profile = (await db.select().from(userHealthProfile).where(eq(userHealthProfile.user_id, user.id)).limit(1))[0];
    const todayLog = (await db.select().from(waterIntakeLogs).where(and(eq(waterIntakeLogs.date, today), eq(waterIntakeLogs.user_id, user.id))).limit(1))[0];

    const target = todayLog?.goal_ml || profile?.daily_water_target_ml || 2500;
    const consumed = todayLog ? todayLog.amount_ml : (profile?.consumed_water_ml || 0);
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
    const { action, target_ml, amount_ml = 250, reset = false } = body;
    const now = new Date().toISOString();
    const today = now.split('T')[0];
    const familyId = user.family_id || `fam-${user.id}`;

    const profile = (await db.select().from(userHealthProfile).where(eq(userHealthProfile.user_id, user.id)).limit(1))[0];
    const todayLog = (await db.select().from(waterIntakeLogs).where(and(eq(waterIntakeLogs.date, today), eq(waterIntakeLogs.user_id, user.id))).limit(1))[0];

    // 🎯 HEDEF BELİRLEME (SET WATER GOAL)
    if (action === 'set_target' || (target_ml !== undefined && action !== 'log_water')) {
      const newTarget = Math.max(500, Math.min(10000, Number(target_ml) || 2500));

      if (profile) {
        await db.update(userHealthProfile)
          .set({ daily_water_target_ml: newTarget, updated_at: now })
          .where(eq(userHealthProfile.id, profile.id));
      } else {
        await db.insert(userHealthProfile).values({
          id: `hp-${user.id}`,
          daily_calorie_target: 2200,
          target_protein_g: 140,
          target_carbs_g: 180,
          target_fat_g: 65,
          daily_water_target_ml: newTarget,
          consumed_water_ml: 0,
          active_fasting_protocol: '16:8',
          user_id: user.id,
          family_id: familyId,
          created_at: now,
          updated_at: now
        });
      }

      if (todayLog) {
        await db.update(waterIntakeLogs)
          .set({ goal_ml: newTarget, updated_at: now })
          .where(eq(waterIntakeLogs.id, todayLog.id));
      } else {
        await db.insert(waterIntakeLogs).values({
          id: `water-${Date.now()}`,
          date: today,
          amount_ml: profile?.consumed_water_ml || 0,
          goal_ml: newTarget,
          user_id: user.id,
          family_id: familyId,
          created_at: now,
          updated_at: now
        });
      }

      return NextResponse.json({
        success: true,
        message: `🎯 Günlük su içme hedefiniz ${newTarget} ml olarak güncellendi!`,
        target_ml: newTarget
      });
    }

    // 💧 SU İÇME KAYDI
    const currentConsumed = todayLog ? todayLog.amount_ml : (profile?.consumed_water_ml || 0);
    const current = reset ? 0 : currentConsumed + (parseFloat(amount_ml) || 250);
    const target = profile?.daily_water_target_ml || todayLog?.goal_ml || 2500;

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
        daily_water_target_ml: target,
        consumed_water_ml: current,
        active_fasting_protocol: '16:8',
        user_id: user.id,
        family_id: familyId,
        created_at: now,
        updated_at: now
      });
    }

    if (todayLog) {
      await db.update(waterIntakeLogs)
        .set({ amount_ml: current, goal_ml: target, updated_at: now })
        .where(eq(waterIntakeLogs.id, todayLog.id));
    } else {
      await db.insert(waterIntakeLogs).values({
        id: `water-${Date.now()}`,
        date: today,
        amount_ml: current,
        goal_ml: target,
        user_id: user.id,
        family_id: familyId,
        created_at: now,
        updated_at: now
      });
    }

    return NextResponse.json({
      success: true,
      message: reset ? '💧 Günlük su sayacı sıfırlandı.' : `💧 +${amount_ml} ml su kaydedildi! Toplam: ${current} ml`,
      consumed_ml: current,
      target_ml: target
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
