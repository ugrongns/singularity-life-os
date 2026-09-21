import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { supplementRoutines, supplementIntakeLogs, sleepLogs, moodLogs, biometrics, waterIntakeLogs, smartScaleLogs, userHealthProfile } from '@/db/schema';
import { desc, eq, and, sql, or, ne, isNull } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

function getTodayTurkeyDate(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
}

function getDaysAgoTurkeyDate(days: number): string {
  const d = new Date(Date.now() - days * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(d);
}

export async function GET() {
  try {
    await initDatabase();
    const user = await getAuthUser();
    const userId = user?.id;

    const today = getTodayTurkeyDate();

    // 1. Lazy Self-Healing: DB'de dünden veya önceki günlerden kalma is_taken_today = 1 satırlarını sıfırla
    if (userId) {
      await db.update(supplementRoutines)
        .set({ is_taken_today: 0, updated_at: new Date().toISOString() })
        .where(
          and(
            eq(supplementRoutines.user_id, userId),
            eq(supplementRoutines.is_taken_today, 1),
            or(
              ne(supplementRoutines.last_taken_date, today),
              isNull(supplementRoutines.last_taken_date)
            )
          )
        );
    }

    // 2. Takviyeleri ve bugünkü alım loglarını çek
    const rawSupplements = userId
      ? await db.select().from(supplementRoutines).where(and(eq(supplementRoutines.is_active, 1), eq(supplementRoutines.user_id, userId)))
      : [];

    const todayIntakeLogs = userId
      ? await db.select().from(supplementIntakeLogs).where(and(eq(supplementIntakeLogs.user_id, userId), eq(supplementIntakeLogs.date, today)))
      : [];

    const intakeMap = new Map(todayIntakeLogs.map(l => [l.supplement_id, l]));

    // 3. Dinamik kesin doğrulama: last_taken_date bugünse veya bugünkü log varsa taken = 1
    const supplements = rawSupplements.map((s: any) => {
      const isTaken = (s.last_taken_date === today || intakeMap.has(s.id)) ? 1 : 0;
      const log = intakeMap.get(s.id);
      return {
        ...s,
        is_taken_today: isTaken,
        taken_at: log?.taken_at || null
      };
    });

    const todayMood = userId
      ? await db.select().from(moodLogs).where(and(eq(moodLogs.date, today), eq(moodLogs.user_id, userId)))
      : [];

    const todaySleep = userId
      ? await db.select().from(sleepLogs).where(and(eq(sleepLogs.date, today), eq(sleepLogs.user_id, userId)))
      : [];

    const userProfile = userId
      ? (await db.select().from(userHealthProfile).where(eq(userHealthProfile.user_id, userId)).limit(1))[0]
      : null;

    const defaultGoal = userProfile?.daily_water_target_ml || 2500;

    const todayWaterList = userId
      ? await db.select().from(waterIntakeLogs).where(and(eq(waterIntakeLogs.date, today), eq(waterIntakeLogs.user_id, userId)))
      : [];

    const todayWater = todayWaterList[0] || { amount_ml: userProfile?.consumed_water_ml || 0, goal_ml: defaultGoal };

    // Son 7 gün trendler (Türkiye saati)
    const last7Days = getDaysAgoTurkeyDate(7);
    const moodHistory = userId
      ? await db.select().from(moodLogs)
          .where(and(sql`${moodLogs.date} >= ${last7Days}`, eq(moodLogs.user_id, userId)))
          .orderBy(desc(moodLogs.date))
      : [];

    const sleepHistory = userId
      ? await db.select().from(sleepLogs)
          .where(and(sql`${sleepLogs.date} >= ${last7Days}`, eq(sleepLogs.user_id, userId)))
          .orderBy(desc(sleepLogs.date))
      : [];

    const waterHistory = userId
      ? await db.select().from(waterIntakeLogs)
          .where(and(sql`${waterIntakeLogs.date} >= ${last7Days}`, eq(waterIntakeLogs.user_id, userId)))
          .orderBy(desc(waterIntakeLogs.date))
      : [];

    const recentIntakeLogs = userId
      ? await db.select().from(supplementIntakeLogs)
          .where(and(sql`${supplementIntakeLogs.date} >= ${last7Days}`, eq(supplementIntakeLogs.user_id, userId)))
          .orderBy(desc(supplementIntakeLogs.taken_at))
      : [];

    // Son biyometri
    const latestBiometric = userId
      ? (await db.select().from(biometrics).where(eq(biometrics.user_id, userId)).orderBy(desc(biometrics.date)).limit(1))[0]
      : null;

    const scaleLogs = userId
      ? await db.select().from(smartScaleLogs).where(eq(smartScaleLogs.user_id, userId)).orderBy(desc(smartScaleLogs.measurement_date))
      : [];

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
        supplements: { morning: morningSupps, evening: eveningSupps, with_meal: mealSupps, total: totalSupps, taken: takenSupps, all: supplements, todayLogs: todayIntakeLogs, recentLogs: recentIntakeLogs },
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
    await initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    const body = await request.json();
    const { action, ...data } = body;
    const now = new Date().toISOString();
    const today = getTodayTurkeyDate();
    const familyId = user.family_id || `fam-${user.id}`;

    if (action === 'take_supplement') {
      const suppList = await db.select().from(supplementRoutines).where(and(eq(supplementRoutines.id, data.id), eq(supplementRoutines.user_id, user.id)));
      const supp = suppList[0];
      if (supp) {
        const lastDate = supp.last_taken_date;
        const yesterday = getDaysAgoTurkeyDate(1);
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
        }).where(and(eq(supplementRoutines.id, data.id), eq(supplementRoutines.user_id, user.id)));

        // Log tablosuna ekle
        const logId = `supp-log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        await db.insert(supplementIntakeLogs).values({
          id: logId,
          supplement_id: supp.id,
          user_id: user.id,
          family_id: familyId,
          member_id: supp.member_id || null,
          supplement_name: supp.name,
          dose: supp.dose,
          timing: supp.timing,
          date: today,
          taken_at: now,
          created_at: now,
          updated_at: now
        });
      }
      return NextResponse.json({ success: true, message: 'Takviye alındı!' });
    }

    if (action === 'undo_supplement') {
      const suppList = await db.select().from(supplementRoutines).where(and(eq(supplementRoutines.id, data.id), eq(supplementRoutines.user_id, user.id)));
      const supp = suppList[0];
      if (supp) {
        // 1. Bugünkü log kaydını sil
        await db.delete(supplementIntakeLogs).where(
          and(
            eq(supplementIntakeLogs.supplement_id, supp.id),
            eq(supplementIntakeLogs.user_id, user.id),
            eq(supplementIntakeLogs.date, today)
          )
        );

        // 2. Bir önceki alım tarihini loglardan bul (varsa)
        const prevLogs = await db.select().from(supplementIntakeLogs)
          .where(and(eq(supplementIntakeLogs.supplement_id, supp.id), eq(supplementIntakeLogs.user_id, user.id)))
          .orderBy(desc(supplementIntakeLogs.date))
          .limit(1);
        const prevDate = prevLogs[0]?.date || null;

        const restoredRemaining = supp.remaining_pills !== null && supp.remaining_pills !== undefined
          ? (supp.total_pills !== null && supp.total_pills !== undefined ? Math.min(supp.total_pills, supp.remaining_pills + 1) : supp.remaining_pills + 1)
          : null;
        const restoredStreak = Math.max(0, (supp.streak_days || 1) - 1);

        await db.update(supplementRoutines).set({
          is_taken_today: 0,
          streak_days: restoredStreak,
          remaining_pills: restoredRemaining,
          last_taken_date: prevDate,
          updated_at: now
        }).where(and(eq(supplementRoutines.id, data.id), eq(supplementRoutines.user_id, user.id)));
      }
      return NextResponse.json({ success: true, message: 'Takviye alımı geri alındı!' });
    }

    if (action === 'take_all') {
      const activeSupps = await db.select().from(supplementRoutines).where(
        and(eq(supplementRoutines.is_active, 1), eq(supplementRoutines.user_id, user.id))
      );

      const yesterday = getDaysAgoTurkeyDate(1);
      let updatedCount = 0;

      for (const supp of activeSupps) {
        // Bugün henüz alınmamışsa
        if (supp.last_taken_date !== today) {
          const newStreak = (supp.last_taken_date === yesterday) ? (supp.streak_days || 0) + 1 : 1;
          const newRemaining = supp.remaining_pills !== null && supp.remaining_pills !== undefined
            ? Math.max(0, supp.remaining_pills - 1)
            : null;

          await db.update(supplementRoutines).set({
            is_taken_today: 1,
            streak_days: newStreak,
            remaining_pills: newRemaining,
            last_taken_date: today,
            updated_at: now
          }).where(eq(supplementRoutines.id, supp.id));

          const logId = `supp-log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          await db.insert(supplementIntakeLogs).values({
            id: logId,
            supplement_id: supp.id,
            user_id: user.id,
            family_id: familyId,
            member_id: supp.member_id || null,
            supplement_name: supp.name,
            dose: supp.dose,
            timing: supp.timing,
            date: today,
            taken_at: now,
            created_at: now,
            updated_at: now
          });
          updatedCount++;
        }
      }
      return NextResponse.json({ success: true, message: `${updatedCount} takviye alındı!` });
    }

    if (action === 'log_water') {
      const existingList = await db.select().from(waterIntakeLogs).where(and(eq(waterIntakeLogs.date, today), eq(waterIntakeLogs.user_id, user.id)));
      const existing = existingList[0];
      const newAmount = Math.max(0, Number(data.amount_ml) || 0);
      const goal = Number(data.goal_ml) || 2500;

      if (existing) {
        await db.update(waterIntakeLogs).set({
          amount_ml: newAmount,
          goal_ml: goal,
          updated_at: now
        }).where(and(eq(waterIntakeLogs.id, existing.id), eq(waterIntakeLogs.user_id, user.id)));
      } else {
        const id = `water-${Date.now()}`;
        await db.insert(waterIntakeLogs).values({
          id,
          date: today,
          amount_ml: newAmount,
          goal_ml: goal,
          user_id: user.id,
          family_id: familyId,
          created_at: now,
          updated_at: now
        });
      }

      // userHealthProfile ile senkronize et
      const profile = (await db.select().from(userHealthProfile).where(eq(userHealthProfile.user_id, user.id)).limit(1))[0];
      if (profile) {
        await db.update(userHealthProfile).set({
          consumed_water_ml: newAmount,
          daily_water_target_ml: goal,
          updated_at: now
        }).where(eq(userHealthProfile.id, profile.id));
      }

      return NextResponse.json({ success: true, amount_ml: newAmount, goal_ml: goal });
    }

    if (action === 'set_water_goal') {
      const newGoal = Math.max(500, Math.min(10000, Number(data.goal_ml) || 2500));
      const existingList = await db.select().from(waterIntakeLogs).where(and(eq(waterIntakeLogs.date, today), eq(waterIntakeLogs.user_id, user.id)));
      const existing = existingList[0];

      if (existing) {
        await db.update(waterIntakeLogs).set({
          goal_ml: newGoal,
          updated_at: now
        }).where(and(eq(waterIntakeLogs.id, existing.id), eq(waterIntakeLogs.user_id, user.id)));
      } else {
        const id = `water-${Date.now()}`;
        await db.insert(waterIntakeLogs).values({
          id,
          date: today,
          amount_ml: 0,
          goal_ml: newGoal,
          user_id: user.id,
          family_id: familyId,
          created_at: now,
          updated_at: now
        });
      }

      const profile = (await db.select().from(userHealthProfile).where(eq(userHealthProfile.user_id, user.id)).limit(1))[0];
      if (profile) {
        await db.update(userHealthProfile).set({
          daily_water_target_ml: newGoal,
          updated_at: now
        }).where(eq(userHealthProfile.id, profile.id));
      } else {
        await db.insert(userHealthProfile).values({
          id: `hp-${user.id}`,
          daily_calorie_target: 2200,
          target_protein_g: 140,
          target_carbs_g: 180,
          target_fat_g: 65,
          daily_water_target_ml: newGoal,
          consumed_water_ml: 0,
          active_fasting_protocol: '16:8',
          user_id: user.id,
          family_id: familyId,
          created_at: now,
          updated_at: now
        });
      }

      return NextResponse.json({
        success: true,
        message: `🎯 Günlük su içme hedefiniz ${newGoal} ml olarak güncellendi!`,
        goal_ml: newGoal
      });
    }

    if (action === 'add_supplement') {
      const id = `supp-${Date.now()}`;
      await db.insert(supplementRoutines).values({
        id,
        name: data.name,
        dose: data.dose,
        timing: data.timing || 'morning',
        frequency_type: data.frequency_type || 'daily',
        interval_days: parseInt(data.interval_days) || 1,
        total_pills: parseInt(data.total_pills) || 60,
        remaining_pills: parseInt(data.remaining_pills) || parseInt(data.total_pills) || 60,
        notes: data.notes || null,
        is_taken_today: 0,
        streak_days: 0,
        is_active: 1,
        form_type: data.form_type || 'capsule',
        unit: data.unit || 'kapsül',
        user_id: user.id,
        family_id: familyId,
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
        frequency_type: data.frequency_type || 'daily',
        interval_days: parseInt(data.interval_days) || 1,
        total_pills: parseInt(data.total_pills) || 60,
        remaining_pills: parseInt(data.remaining_pills) || 0,
        notes: data.notes || null,
        form_type: data.form_type || 'capsule',
        unit: data.unit || 'kapsül',
        updated_at: now
      }).where(and(eq(supplementRoutines.id, data.id), eq(supplementRoutines.user_id, user.id)));
      return NextResponse.json({ success: true, message: 'Takviye güncellendi!' });
    }

    if (action === 'delete_supplement') {
      await db.update(supplementRoutines).set({ is_active: 0, updated_at: now }).where(and(eq(supplementRoutines.id, data.id), eq(supplementRoutines.user_id, user.id)));
      return NextResponse.json({ success: true, message: 'Takviye silindi!' });
    }

    if (action === 'reset_supplements') {
      await db.update(supplementRoutines).set({ is_taken_today: 0, updated_at: now }).where(eq(supplementRoutines.user_id, user.id));
      await db.delete(supplementIntakeLogs).where(and(eq(supplementIntakeLogs.user_id, user.id), eq(supplementIntakeLogs.date, today)));
      return NextResponse.json({ success: true, message: 'Bugünkü takviyeler sıfırlandı!' });
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
        user_id: user.id,
        family_id: familyId,
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
        user_id: user.id,
        family_id: familyId,
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
