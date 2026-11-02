import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { supplementRoutines, supplementIntakeLogs, sleepLogs, moodLogs, biometrics, waterIntakeLogs, smartScaleLogs, userHealthProfile } from '@/db/schema';
import { desc, eq, and, sql, or, ne, isNull } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

import { getTodayTurkeyDate, getDaysAgoTurkeyDate } from '@/lib/date-utils';

export async function GET(req?: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    const userId = user?.id;

    const today = getTodayTurkeyDate();

    // 1. URL Parametreleri (Tarih ve Aile Üyesi Filtreleri)
    let selectedDate = today;
    let memberId: string | null = null;
    if (req?.url) {
      try {
        const url = new URL(req.url);
        const queryDate = url.searchParams.get('date');
        memberId = url.searchParams.get('member_id');
        if (queryDate && /^\d{4}-\d{2}-\d{2}$/.test(queryDate)) {
          selectedDate = queryDate > today ? today : queryDate;
        }
      } catch {
        // URL parsing fallback
      }
    }

    const isToday = selectedDate === today;

    // 2. Lazy Self-Healing: DB'de dünden veya önceki günlerden kalma is_taken_today = 1 satırlarını sıfırla
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

    // 3. Takviyeleri ve seçilen tarihteki alım loglarını çek
    const rawSupplements = userId
      ? await db.select().from(supplementRoutines).where(
          and(
            eq(supplementRoutines.is_active, 1),
            eq(supplementRoutines.user_id, userId),
            memberId ? eq(supplementRoutines.member_id, memberId) : undefined
          )
        )
      : [];

    const selectedDateIntakeLogs = userId
      ? await db.select().from(supplementIntakeLogs).where(
          and(
            eq(supplementIntakeLogs.user_id, userId),
            eq(supplementIntakeLogs.date, selectedDate)
          )
        )
      : [];

    const intakeMap = new Map(selectedDateIntakeLogs.map(l => [l.supplement_id, l]));

    // 4. Dinamik kesin doğrulama:
    // Eğer bugün seçiliyse: last_taken_date bugünse veya bugünkü log varsa taken = 1
    // Eğer geçmiş bir gün seçiliyse: Yalnızca o güne ait intake logu varsa taken = 1
    const supplements = rawSupplements.map((s: any) => {
      const isTaken = isToday
        ? ((s.last_taken_date === today || intakeMap.has(s.id)) ? 1 : 0)
        : (intakeMap.has(s.id) ? 1 : 0);
      const log = intakeMap.get(s.id);
      return {
        ...s,
        is_taken_today: isTaken,
        taken_at: log?.taken_at || (isTaken && isToday ? s.updated_at : null)
      };
    });

    const selectedMood = userId
      ? await db.select().from(moodLogs).where(
          and(eq(moodLogs.date, selectedDate), eq(moodLogs.user_id, userId))
        )
      : [];

    const selectedSleep = userId
      ? await db.select().from(sleepLogs).where(
          and(eq(sleepLogs.date, selectedDate), eq(sleepLogs.user_id, userId))
        )
      : [];

    const userProfile = userId
      ? (await db.select().from(userHealthProfile).where(eq(userHealthProfile.user_id, userId)).limit(1))[0]
      : null;

    const defaultGoal = userProfile?.daily_water_target_ml || 2500;

    // 5. Su Tüketimi (Seçilen güne ait log)
    // 🛡️ KRİTİK GÜNLÜK SIFIRLAMA GÜVENCESİ:
    // Yeni gün başlangıcında veya seçilen günde henüz su içilmemişse, dünün tüketimi devretmemeli, 0 ml kabul edilmeli!
    const selectedWaterList = userId
      ? await db.select().from(waterIntakeLogs).where(
          and(eq(waterIntakeLogs.date, selectedDate), eq(waterIntakeLogs.user_id, userId))
        )
      : [];

    const todayWater = selectedWaterList[0] || { amount_ml: 0, goal_ml: defaultGoal };

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

    // 6. Son 14 Günlük Takvim Geçmişi (Calendar History Aggregation)
    const historyStartDate = getDaysAgoTurkeyDate(13);
    const recentWaterList = userId
      ? await db.select().from(waterIntakeLogs).where(
          and(sql`${waterIntakeLogs.date} >= ${historyStartDate}`, eq(waterIntakeLogs.user_id, userId))
        )
      : [];
    const recentIntakeList = userId
      ? await db.select().from(supplementIntakeLogs).where(
          and(sql`${supplementIntakeLogs.date} >= ${historyStartDate}`, eq(supplementIntakeLogs.user_id, userId))
        )
      : [];
    const recentMoodList = userId
      ? await db.select().from(moodLogs).where(
          and(sql`${moodLogs.date} >= ${historyStartDate}`, eq(moodLogs.user_id, userId))
        )
      : [];
    const recentSleepList = userId
      ? await db.select().from(sleepLogs).where(
          and(sql`${sleepLogs.date} >= ${historyStartDate}`, eq(sleepLogs.user_id, userId))
        )
      : [];

    const calendarHistory: any[] = [];
    for (let i = 13; i >= 0; i--) {
      const dStr = getDaysAgoTurkeyDate(i);
      const isDayToday = dStr === today;
      const dayWater = recentWaterList.find((w: any) => w.date === dStr);
      const dayWaterAmount = dayWater ? dayWater.amount_ml : 0;
      const dayWaterGoal = dayWater ? dayWater.goal_ml : defaultGoal;

      const dayIntakes = recentIntakeList.filter((l: any) => l.date === dStr);
      const uniqueTakenSuppIds = new Set(dayIntakes.map((l: any) => l.supplement_id));

      if (isDayToday) {
        rawSupplements.forEach((s: any) => {
          if (s.is_taken_today === 1 || s.last_taken_date === today) {
            uniqueTakenSuppIds.add(s.id);
          }
        });
      }

      const dayMood = recentMoodList.find((m: any) => m.date === dStr);
      const daySleep = recentSleepList.find((s: any) => s.date === dStr);

      const suppsTotal = rawSupplements.length;
      const suppsTaken = uniqueTakenSuppIds.size;
      const isWaterMet = dayWaterGoal > 0 ? dayWaterAmount >= dayWaterGoal : dayWaterAmount > 0;
      const isSuppsMet = suppsTotal > 0 ? suppsTaken >= suppsTotal : true;

      calendarHistory.push({
        date: dStr,
        isToday: isDayToday,
        waterAmount: dayWaterAmount,
        waterGoal: dayWaterGoal,
        isWaterMet,
        supplementsTaken: suppsTaken,
        supplementsTotal: suppsTotal,
        isSupplementsMet: isSuppsMet,
        hasMood: !!dayMood,
        moodScore: dayMood?.mood_score || null,
        hasSleep: !!daySleep,
        sleepHours: daySleep?.duration_hours || null,
        allCompleted: isWaterMet && isSuppsMet && (dayWaterAmount > 0 || suppsTaken > 0)
      });
    }

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
        selectedDate,
        isToday,
        supplements: { morning: morningSupps, evening: eveningSupps, with_meal: mealSupps, total: totalSupps, taken: takenSupps, all: supplements, todayLogs: selectedDateIntakeLogs, recentLogs: recentIntakeLogs },
        todayMood:   selectedMood[0] || null,
        todaySleep:  selectedSleep[0] || null,
        todayWater,
        moodHistory,
        sleepHistory,
        waterHistory,
        latestBiometric: latestBiometric || null,
        scaleLogs,
        aiInsight,
        calendarHistory
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
    const rawTargetDate = data.date && /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? data.date : today;
    const targetDate = rawTargetDate > today ? today : rawTargetDate;
    const isTargetToday = targetDate === today;
    const familyId = user.family_id || `fam-${user.id}`;

    // 🔄 GÜNLÜK TÜM RUTİNLERİ SIFIRLAMA (RESET DAY)
    if (action === 'reset_day') {
      // 1. O güne ait takviye alım loglarını sil
      await db.delete(supplementIntakeLogs).where(
        and(eq(supplementIntakeLogs.user_id, user.id), eq(supplementIntakeLogs.date, targetDate))
      );

      // 2. Eğer hedef bugünse, aktif takviyelerin is_taken_today bayrağını sıfırla
      if (isTargetToday) {
        await db.update(supplementRoutines).set({
          is_taken_today: 0,
          updated_at: now
        }).where(eq(supplementRoutines.user_id, user.id));
      }

      // 3. O güne ait su tüketim kaydını sil
      await db.delete(waterIntakeLogs).where(
        and(eq(waterIntakeLogs.user_id, user.id), eq(waterIntakeLogs.date, targetDate))
      );

      // 4. Eğer hedef bugünse userHealthProfile.consumed_water_ml'i de 0 yap
      if (isTargetToday) {
        const profile = (await db.select().from(userHealthProfile).where(eq(userHealthProfile.user_id, user.id)).limit(1))[0];
        if (profile) {
          await db.update(userHealthProfile).set({
            consumed_water_ml: 0,
            updated_at: now
          }).where(eq(userHealthProfile.id, profile.id));
        }
      }

      // 5. O güne ait ruh hali ve uyku kayıtlarını da sıfırla
      await db.delete(moodLogs).where(
        and(eq(moodLogs.user_id, user.id), eq(moodLogs.date, targetDate))
      );
      await db.delete(sleepLogs).where(
        and(eq(sleepLogs.user_id, user.id), eq(sleepLogs.date, targetDate))
      );

      return NextResponse.json({
        success: true,
        message: `${isTargetToday ? 'Bugünkü' : targetDate + ' tarihindeki'} takviye, su, uyku ve ruh hali takip verileri sıfırlandı!`
      });
    }

    if (action === 'take_supplement') {
      const suppList = await db.select().from(supplementRoutines).where(and(eq(supplementRoutines.id, data.id), eq(supplementRoutines.user_id, user.id)));
      const supp = suppList[0];
      if (supp) {
        // Zaten bu tarih için alınmış mı kontrol et (idempotency & çifte düşüm engeli)
        const existingLogs = await db.select().from(supplementIntakeLogs).where(
          and(
            eq(supplementIntakeLogs.supplement_id, supp.id),
            eq(supplementIntakeLogs.user_id, user.id),
            eq(supplementIntakeLogs.date, targetDate)
          )
        ).limit(1);

        if (existingLogs.length > 0) {
          return NextResponse.json({ success: true, message: 'Bu takviye bu tarih için zaten alınmış.' });
        }

        const lastDate = supp.last_taken_date;
        const yesterday = getDaysAgoTurkeyDate(1);
        const newStreak = (lastDate === yesterday) ? (supp.streak_days || 0) + 1 : 1;
        const newRemaining = supp.remaining_pills !== null && supp.remaining_pills !== undefined 
          ? Math.max(0, supp.remaining_pills - 1) 
          : null;

        if (isTargetToday) {
          await db.update(supplementRoutines).set({
            is_taken_today: 1,
            streak_days: newStreak,
            remaining_pills: newRemaining,
            last_taken_date: today,
            updated_at: now
          }).where(and(eq(supplementRoutines.id, data.id), eq(supplementRoutines.user_id, user.id)));
        } else if (newRemaining !== null) {
          await db.update(supplementRoutines).set({
            remaining_pills: newRemaining,
            updated_at: now
          }).where(and(eq(supplementRoutines.id, data.id), eq(supplementRoutines.user_id, user.id)));
        }

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
          date: targetDate,
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
        // 1. O güne ait log kaydını sil
        await db.delete(supplementIntakeLogs).where(
          and(
            eq(supplementIntakeLogs.supplement_id, supp.id),
            eq(supplementIntakeLogs.user_id, user.id),
            eq(supplementIntakeLogs.date, targetDate)
          )
        );

        const restoredRemaining = supp.remaining_pills !== null && supp.remaining_pills !== undefined
          ? (supp.total_pills !== null && supp.total_pills !== undefined ? Math.min(supp.total_pills, supp.remaining_pills + 1) : supp.remaining_pills + 1)
          : null;

        if (isTargetToday) {
          // 2. Bir önceki alım tarihini loglardan bul (varsa)
          const prevLogs = await db.select().from(supplementIntakeLogs)
            .where(and(eq(supplementIntakeLogs.supplement_id, supp.id), eq(supplementIntakeLogs.user_id, user.id)))
            .orderBy(desc(supplementIntakeLogs.date))
            .limit(1);
          const prevDate = prevLogs[0]?.date || null;

          const restoredStreak = Math.max(0, (supp.streak_days || 1) - 1);

          await db.update(supplementRoutines).set({
            is_taken_today: 0,
            streak_days: restoredStreak,
            remaining_pills: restoredRemaining,
            last_taken_date: prevDate,
            updated_at: now
          }).where(and(eq(supplementRoutines.id, data.id), eq(supplementRoutines.user_id, user.id)));
        } else if (restoredRemaining !== null) {
          await db.update(supplementRoutines).set({
            remaining_pills: restoredRemaining,
            updated_at: now
          }).where(and(eq(supplementRoutines.id, data.id), eq(supplementRoutines.user_id, user.id)));
        }
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
        // Eğer hedef tarih için henüz alınmamışsa
        const existingLogs = await db.select().from(supplementIntakeLogs).where(
          and(
            eq(supplementIntakeLogs.supplement_id, supp.id),
            eq(supplementIntakeLogs.user_id, user.id),
            eq(supplementIntakeLogs.date, targetDate)
          )
        ).limit(1);

        if (existingLogs.length === 0) {
          const newRemaining = supp.remaining_pills !== null && supp.remaining_pills !== undefined
            ? Math.max(0, supp.remaining_pills - 1)
            : null;

          if (isTargetToday) {
            const newStreak = (supp.last_taken_date === yesterday) ? (supp.streak_days || 0) + 1 : 1;

            await db.update(supplementRoutines).set({
              is_taken_today: 1,
              streak_days: newStreak,
              remaining_pills: newRemaining,
              last_taken_date: today,
              updated_at: now
            }).where(eq(supplementRoutines.id, supp.id));
          } else if (newRemaining !== null) {
            await db.update(supplementRoutines).set({
              remaining_pills: newRemaining,
              updated_at: now
            }).where(eq(supplementRoutines.id, supp.id));
          }

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
            date: targetDate,
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
      const existingList = await db.select().from(waterIntakeLogs).where(and(eq(waterIntakeLogs.date, targetDate), eq(waterIntakeLogs.user_id, user.id)));
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
          date: targetDate,
          amount_ml: newAmount,
          goal_ml: goal,
          user_id: user.id,
          family_id: familyId,
          created_at: now,
          updated_at: now
        });
      }

      // userHealthProfile ile senkronize et (yalnızca bugün için)
      if (isTargetToday) {
        const profile = (await db.select().from(userHealthProfile).where(eq(userHealthProfile.user_id, user.id)).limit(1))[0];
        if (profile) {
          await db.update(userHealthProfile).set({
            consumed_water_ml: newAmount,
            daily_water_target_ml: goal,
            updated_at: now
          }).where(eq(userHealthProfile.id, profile.id));
        }
      }

      return NextResponse.json({ success: true, amount_ml: newAmount, goal_ml: goal });
    }

    if (action === 'set_water_goal') {
      const newGoal = Math.max(500, Math.min(10000, Number(data.goal_ml) || 2500));
      const existingList = await db.select().from(waterIntakeLogs).where(and(eq(waterIntakeLogs.date, targetDate), eq(waterIntakeLogs.user_id, user.id)));
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
          date: targetDate,
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
      if (isTargetToday) {
        await db.update(supplementRoutines).set({ is_taken_today: 0, updated_at: now }).where(eq(supplementRoutines.user_id, user.id));
      }
      await db.delete(supplementIntakeLogs).where(and(eq(supplementIntakeLogs.user_id, user.id), eq(supplementIntakeLogs.date, targetDate)));
      return NextResponse.json({ success: true, message: `${isTargetToday ? 'Bugünkü' : targetDate + ' tarihindeki'} takviyeler sıfırlandı!` });
    }

    if (action === 'reset_water') {
      await db.delete(waterIntakeLogs).where(and(eq(waterIntakeLogs.user_id, user.id), eq(waterIntakeLogs.date, targetDate)));
      if (isTargetToday) {
        const profile = (await db.select().from(userHealthProfile).where(eq(userHealthProfile.user_id, user.id)).limit(1))[0];
        if (profile) {
          await db.update(userHealthProfile).set({ consumed_water_ml: 0, updated_at: now }).where(eq(userHealthProfile.id, profile.id));
        }
      }
      return NextResponse.json({ success: true, message: '💧 Su sayacı sıfırlandı!' });
    }

    if (action === 'add_mood') {
      const moodScore = Number(data.mood_score);
      const energyLevel = Number(data.energy_level) || 3;
      const stressLevel = Number(data.stress_level) || 2;
      const moodEmoji = data.mood_emoji || '😊';
      const note = data.note || null;

      const existingMoodList = await db.select().from(moodLogs).where(
        and(eq(moodLogs.date, targetDate), eq(moodLogs.user_id, user.id))
      );
      const existingMood = existingMoodList[0];

      if (existingMood) {
        await db.update(moodLogs).set({
          mood_emoji: moodEmoji,
          mood_score: moodScore,
          energy_level: energyLevel,
          stress_level: stressLevel,
          note: note,
          updated_at: now
        }).where(and(eq(moodLogs.id, existingMood.id), eq(moodLogs.user_id, user.id)));
        return NextResponse.json({ success: true, id: existingMood.id });
      } else {
        const id = `mood-${Date.now()}`;
        await db.insert(moodLogs).values({
          id,
          mood_emoji: moodEmoji,
          mood_score: moodScore,
          energy_level: energyLevel,
          stress_level: stressLevel,
          note: note,
          date: targetDate,
          user_id: user.id,
          family_id: familyId,
          created_at: now,
          updated_at: now
        });
        return NextResponse.json({ success: true, id });
      }
    }

    if (action === 'add_sleep') {
      const [bh, bm] = (data.bedtime || '23:00').split(':').map(Number);
      const [wh, wm] = (data.wake_time || '07:00').split(':').map(Number);
      let duration = (wh * 60 + wm) - (bh * 60 + bm);
      if (duration < 0) duration += 24 * 60;
      const duration_hours = parseFloat((duration / 60).toFixed(1));
      const qualityRating = Number(data.quality_rating) || 3;
      const notes = data.notes || null;

      const existingSleepList = await db.select().from(sleepLogs).where(
        and(eq(sleepLogs.date, targetDate), eq(sleepLogs.user_id, user.id))
      );
      const existingSleep = existingSleepList[0];

      if (existingSleep) {
        await db.update(sleepLogs).set({
          bedtime: data.bedtime,
          wake_time: data.wake_time,
          quality_rating: qualityRating,
          notes: notes,
          duration_hours,
          updated_at: now
        }).where(and(eq(sleepLogs.id, existingSleep.id), eq(sleepLogs.user_id, user.id)));
        return NextResponse.json({ success: true, id: existingSleep.id, duration_hours });
      } else {
        const id = `sleep-${Date.now()}`;
        await db.insert(sleepLogs).values({
          id,
          bedtime: data.bedtime,
          wake_time: data.wake_time,
          quality_rating: qualityRating,
          notes: notes,
          duration_hours,
          date: targetDate,
          user_id: user.id,
          family_id: familyId,
          created_at: now,
          updated_at: now
        });
        return NextResponse.json({ success: true, id, duration_hours });
      }
    }

    return NextResponse.json({ success: false, error: 'Bilinmeyen işlem' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
