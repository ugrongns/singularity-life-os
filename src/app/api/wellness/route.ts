import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { supplementRoutines, sleepLogs, moodLogs, biometrics, waterIntakeLogs, smartScaleLogs } from '@/db/schema';
import { desc, eq, and, sql , or } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  try {
    initDatabase();
    const user = await getAuthUser();
    const userId = user?.id;

    const today = new Date().toISOString().split('T')[0];

    const supplements = userId
      ? await db.select().from(supplementRoutines).where(and(eq(supplementRoutines.is_active, 1), eq(supplementRoutines.user_id, userId)))
      : [];

    const todayMood = await db.select().from(moodLogs)
      .where(eq(moodLogs.date, today));

    const todaySleep = await db.select().from(sleepLogs)
      .where(eq(sleepLogs.date, today));

    const todayWaterList = await db.select().from(waterIntakeLogs)
      .where(eq(waterIntakeLogs.date, today));

    const todayWater = todayWaterList[0] || { amount_ml: 0, goal_ml: 2500 };

    // Son 7 gün trendler
    const last7Days = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const moodHistory = await db.select().from(moodLogs)
      .where(sql`${moodLogs.date} >= ${last7Days}`)
      .orderBy(desc(moodLogs.date));

    const sleepHistory = await db.select().from(sleepLogs)
      .where(sql`${sleepLogs.date} >= ${last7Days}`)
      .orderBy(desc(sleepLogs.date));

    const waterHistory = await db.select().from(waterIntakeLogs)
      .where(sql`${waterIntakeLogs.date} >= ${last7Days}`)
      .orderBy(desc(waterIntakeLogs.date));

    // Son biyometri
    const latestBiometric = (await db.select().from(biometrics)
      .orderBy(desc(biometrics.date)).limit(1))[0];

    const scaleLogs = await db.select().from(smartScaleLogs)
      .orderBy(desc(smartScaleLogs.measurement_date));

    const morningSupps = (supplements).filter((s: any) => s.timing === 'morning');
    const eveningSupps = (supplements).filter((s: any) => s.timing === 'evening');
    const mealSupps    = (supplements).filter((s: any) => s.timing === 'with_meal');

    const totalSupps   = supplements.length;
    const takenSupps   = (supplements).filter((s: any) => s.is_taken_today === 1).length;

    // AI Sağlık Çıkarım Hesaplaması
    let aiInsight = 'Günlük su ve uyku takibinizi düzenli yaparak haftalık canlı AI sağlık analinizi oluşturabilirsiniz!';
    if (sleepHistory.length > 0) {
      const avgSleep = (sleepHistory).reduce((acc: number, s: any) => acc + s.duration_hours, 0) / sleepHistory.length;
      if (avgSleep >= 7.5) {
        aiInsight = `✨ Mükemmel! Son 7 gündür ortalama ${avgSleep.toFixed(1)} saat uyuyorsunuz. Bu düzen zihinsel odaklanma ve bağışıklık sisteminizi %30 daha güçlü tutuyor.`;
      } else {
        aiInsight = `💡 Tavsiye: Son 7 günde ortalama ${avgSleep.toFixed(1)} saat uyudunuz. Uykuyu 7.5 saate çıkarmak modunuzu ve enerjinizi belirgin şekilde artıracaktır.`;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        supplements: { morning: morningSupps, evening: eveningSupps, with_meal: mealSupps, total: totalSupps, taken: takenSupps, all: supplements },
        todayMood:   todayMood[0] || null,
        todaySleep:  todaySleep[0] || null,
        todayWater,
        moodHistory,
        sleepHistory,
        waterHistory,
        latestBiometric: latestBiometric || null,
        scaleLogs,
        aiInsight
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    initDatabase();
    const body = await request.json();
    const { action, ...data } = body;
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    if (action === 'take_supplement') {
      const suppList = await db.select().from(supplementRoutines).where(eq(supplementRoutines.id, data.id));
      const supp = suppList[0];
      if (supp) {
        const lastDate = supp.last_taken_date;
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        const newStreak = (lastDate === yesterday || lastDate === today) ? (supp.streak_days || 0) + 1 : 1;
        const newRemaining = supp.remaining_pills !== null && supp.remaining_pills !== undefined 
          ? Math.max(0, supp.remaining_pills - 1) 
          : null;

        await db.update(supplementRoutines).set({
          is_taken_today: 1,
          streak_days: newStreak,
          remaining_pills: newRemaining,
          last_taken_date: today,
          updated_at: now
        }).where(eq(supplementRoutines.id, data.id));
      }
      return NextResponse.json({ success: true, message: 'Takviye alındı!' });
    }

    if (action === 'log_water') {
      const existingList = await db.select().from(waterIntakeLogs).where(eq(waterIntakeLogs.date, today));
      const existing = existingList[0];
      const newAmount = Math.max(0, Number(data.amount_ml) || 0);
      const goal = Number(data.goal_ml) || 2500;

      if (existing) {
        await db.update(waterIntakeLogs).set({
          amount_ml: newAmount,
          goal_ml: goal,
          updated_at: now
        }).where(eq(waterIntakeLogs.id, existing.id));
      } else {
        const id = `water-${Date.now()}`;
        await db.insert(waterIntakeLogs).values({
          id,
          date: today,
          amount_ml: newAmount,
          goal_ml: goal,
          created_at: now,
          updated_at: now
        });
      }
      return NextResponse.json({ success: true, amount_ml: newAmount });
    }

    if (action === 'add_supplement') {
      const id = `supp-${Date.now()}`;
      await db.insert(supplementRoutines).values({
        id,
        name: data.name,
        dose: data.dose,
        timing: data.timing || 'morning',
        total_pills: parseInt(data.total_pills) || 60,
        remaining_pills: parseInt(data.remaining_pills) || parseInt(data.total_pills) || 60,
        notes: data.notes || null,
        is_taken_today: 0,
        streak_days: 0,
        is_active: 1,
        created_at: now,
        updated_at: now
      });
      return NextResponse.json({ success: true, id, message: 'Takviye eklendi!' });
    }

    if (action === 'update_supplement') {
      await db.update(supplementRoutines).set({
        name: data.name,
        dose: data.dose,
        timing: data.timing,
        total_pills: parseInt(data.total_pills) || 60,
        remaining_pills: parseInt(data.remaining_pills) || 0,
        notes: data.notes || null,
        updated_at: now
      }).where(eq(supplementRoutines.id, data.id));
      return NextResponse.json({ success: true, message: 'Takviye güncellendi!' });
    }

    if (action === 'delete_supplement') {
      await db.update(supplementRoutines).set({ is_active: 0, updated_at: now }).where(eq(supplementRoutines.id, data.id));
      return NextResponse.json({ success: true, message: 'Takviye silindi!' });
    }

    if (action === 'reset_supplements') {
      await db.update(supplementRoutines).set({ is_taken_today: 0, updated_at: now });
      return NextResponse.json({ success: true });
    }

    if (action === 'add_mood') {
      const id = `mood-${Date.now()}`;
      await db.insert(moodLogs).values({
        id,
        mood_emoji: data.mood_emoji,
        mood_score: Number(data.mood_score),
        energy_level: Number(data.energy_level) || 3,
        stress_level: Number(data.stress_level) || 2,
        note: data.note || null,
        date: today,
        created_at: now,
        updated_at: now
      });
      return NextResponse.json({ success: true, id });
    }

    if (action === 'add_sleep') {
      const id = `sleep-${Date.now()}`;
      const [bh, bm] = (data.bedtime || '23:00').split(':').map(Number);
      const [wh, wm] = (data.wake_time || '07:00').split(':').map(Number);
      let duration = (wh * 60 + wm) - (bh * 60 + bm);
      if (duration < 0) duration += 24 * 60;
      const duration_hours = parseFloat((duration / 60).toFixed(1));
      await db.insert(sleepLogs).values({
        id,
        bedtime: data.bedtime,
        wake_time: data.wake_time,
        quality_rating: Number(data.quality_rating) || 3,
        notes: data.notes || null,
        duration_hours,
        date: today,
        created_at: now,
        updated_at: now
      });
      return NextResponse.json({ success: true, id, duration_hours });
    }

    return NextResponse.json({ success: false, error: 'Bilinmeyen işlem' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
