import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import {
  supplementRoutines,
  supplementIntakeLogs,
  sleepLogs,
  moodLogs,
  biometrics,
  waterIntakeLogs,
  smartScaleLogs,
  userHealthProfile
} from '@/db/schema';
import { desc, eq, and, sql, or, ne, isNull } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { getTodayTurkeyDate, getDaysAgoTurkeyDate, diffTurkeyCalendarDays } from '@/lib/date-utils';
import { resolveOptionalHealthMemberScope } from '@/lib/nutrition-memory';
import {
  buildHealthMemberFilter,
  buildWaterLogWhere,
  findScopedHealthProfile,
  resolveProfileEffectiveMemberId
} from '@/lib/health-water';

const VALID_FREQUENCIES = new Set(['daily', 'interval', 'as_needed']);
const VALID_TIMINGS = new Set(['morning', 'with_meal', 'evening', 'lunch', 'night']);
const TIME_HHMM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function normalizeValidTurkeyDate(rawDate: unknown, today: string): string {
  if (typeof rawDate !== 'string') return today;
  const trimmed = rawDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return today;
  if (diffTurkeyCalendarDays(trimmed, today) === null) return today;
  return trimmed > today ? today : trimmed;
}

function parseOptionalNonNegativeInt(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num = typeof val === 'number' ? val : parseInt(String(val), 10);
  if (!Number.isFinite(num) || Number.isNaN(num)) return null;
  return Math.max(0, Math.round(num));
}

function clampInt(val: unknown, min: number, max: number, fallback: number): number {
  const num = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(num) || Number.isNaN(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

function buildNullableMemberCondition(column: any, effectiveMemberId: string | null) {
  return effectiveMemberId ? eq(column, effectiveMemberId) : isNull(column);
}

export async function GET(): Promise<NextResponse>;
export async function GET(req: Request): Promise<NextResponse>;
export async function GET(req?: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user || !user.id) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }
    const userId = user.id;
    const familyId = user.family_id || `fam-${userId}`;

    const today = getTodayTurkeyDate();

    // 1. URL Parametreleri (Tarih ve Aile Üyesi Filtreleri)
    let selectedDate = today;
    let rawMemberId: string | null = null;
    if (req?.url) {
      try {
        const url = new URL(req.url);
        selectedDate = normalizeValidTurkeyDate(url.searchParams.get('date'), today);
        rawMemberId = url.searchParams.get('member_id');
      } catch {
        // URL parsing fallback
      }
    }

    const scope = await resolveOptionalHealthMemberScope(userId, familyId, rawMemberId);
    if (!scope.authorized) {
      return NextResponse.json({ success: false, error: 'Seçilen aile üyesine erişim yetkiniz yok.' }, { status: 403 });
    }

    const isToday = selectedDate === today;

    // 2. Lazy Self-Healing: DB'de dünden veya önceki günlerden kalma is_taken_today = 1 satırlarını sıfırla
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

    // 3. Takviyeleri ve seçilen tarihteki alım loglarını üye kapsamıyla çek
    const suppMemberFilter = buildHealthMemberFilter(supplementRoutines.member_id, scope);
    const rawSupplements = await db.select().from(supplementRoutines).where(
      and(
        eq(supplementRoutines.is_active, 1),
        eq(supplementRoutines.user_id, userId),
        suppMemberFilter
      )
    );

    const intakeMemberFilter = buildHealthMemberFilter(supplementIntakeLogs.member_id, scope);
    const selectedDateIntakeLogs = await db.select().from(supplementIntakeLogs).where(
      and(
        eq(supplementIntakeLogs.user_id, userId),
        eq(supplementIntakeLogs.date, selectedDate),
        intakeMemberFilter
      )
    );

    const intakeMap = new Map(selectedDateIntakeLogs.map(l => [l.supplement_id, l]));

    // 4. Dinamik kesin doğrulama:
    // Eğer bugün seçiliyse: last_taken_date bugünse veya bugünkü log varsa taken = 1
    // Eğer geçmiş bir gün seçiliyse: Yalnızca o güne ait intake logu varsa taken = 1
    const supplements = rawSupplements.map((s) => {
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

    const moodMemberFilter = buildHealthMemberFilter(moodLogs.member_id, scope);
    const selectedMood = await db.select().from(moodLogs).where(
      and(eq(moodLogs.date, selectedDate), eq(moodLogs.user_id, userId), moodMemberFilter)
    );

    const sleepMemberFilter = buildHealthMemberFilter(sleepLogs.member_id, scope);
    const selectedSleep = await db.select().from(sleepLogs).where(
      and(eq(sleepLogs.date, selectedDate), eq(sleepLogs.user_id, userId), sleepMemberFilter)
    );

    const userProfile = await findScopedHealthProfile(userId, scope);
    const defaultGoal = userProfile?.daily_water_target_ml || 2500;

    // 5. Su Tüketimi (Seçilen güne ve üyeye ait log)
    // 🛡️ KRİTİK GÜNLÜK SIFIRLAMA GÜVENCESİ:
    // Yeni gün başlangıcında veya seçilen günde henüz su içilmemişse, dünün tüketimi devretmemeli, 0 ml kabul edilmeli!
    const selectedWaterList = await db.select().from(waterIntakeLogs).where(
      buildWaterLogWhere(userId, selectedDate, scope)
    );

    const todayWater = selectedWaterList[0] || { amount_ml: 0, goal_ml: defaultGoal };

    // Son 7 gün trendler (Türkiye saati & üye kapsamı)
    const last7Days = getDaysAgoTurkeyDate(7);
    const moodHistory = await db.select().from(moodLogs)
      .where(and(sql`${moodLogs.date} >= ${last7Days}`, eq(moodLogs.user_id, userId), moodMemberFilter))
      .orderBy(desc(moodLogs.date));

    const sleepHistory = await db.select().from(sleepLogs)
      .where(and(sql`${sleepLogs.date} >= ${last7Days}`, eq(sleepLogs.user_id, userId), sleepMemberFilter))
      .orderBy(desc(sleepLogs.date));

    const waterMemberFilter = buildHealthMemberFilter(waterIntakeLogs.member_id, scope);
    const waterHistory = await db.select().from(waterIntakeLogs)
      .where(and(sql`${waterIntakeLogs.date} >= ${last7Days}`, eq(waterIntakeLogs.user_id, userId), waterMemberFilter))
      .orderBy(desc(waterIntakeLogs.date));

    const recentIntakeLogs = await db.select().from(supplementIntakeLogs)
      .where(and(sql`${supplementIntakeLogs.date} >= ${last7Days}`, eq(supplementIntakeLogs.user_id, userId), intakeMemberFilter))
      .orderBy(desc(supplementIntakeLogs.taken_at));

    // Son biyometri & akıllı tartı (üye kapsamlı)
    const bioMemberFilter = buildHealthMemberFilter(biometrics.member_id, scope);
    const latestBiometric = (await db.select().from(biometrics)
      .where(and(eq(biometrics.user_id, userId), bioMemberFilter))
      .orderBy(desc(biometrics.date))
      .limit(1))[0] || null;

    const scaleMemberFilter = buildHealthMemberFilter(smartScaleLogs.member_id, scope);
    const scaleLogs = await db.select().from(smartScaleLogs)
      .where(and(eq(smartScaleLogs.user_id, userId), scaleMemberFilter))
      .orderBy(desc(smartScaleLogs.measurement_date));

    // 6. Son 14 Günlük Takvim Geçmişi (Calendar History Aggregation)
    const historyStartDate = getDaysAgoTurkeyDate(13);
    const recentWaterList = await db.select().from(waterIntakeLogs).where(
      and(sql`${waterIntakeLogs.date} >= ${historyStartDate}`, eq(waterIntakeLogs.user_id, userId), waterMemberFilter)
    );
    const recentIntakeList = await db.select().from(supplementIntakeLogs).where(
      and(sql`${supplementIntakeLogs.date} >= ${historyStartDate}`, eq(supplementIntakeLogs.user_id, userId), intakeMemberFilter)
    );
    const recentMoodList = await db.select().from(moodLogs).where(
      and(sql`${moodLogs.date} >= ${historyStartDate}`, eq(moodLogs.user_id, userId), moodMemberFilter)
    );
    const recentSleepList = await db.select().from(sleepLogs).where(
      and(sql`${sleepLogs.date} >= ${historyStartDate}`, eq(sleepLogs.user_id, userId), sleepMemberFilter)
    );

    const visibleSuppIds = new Set(rawSupplements.map((s) => s.id));
    const calendarHistory = [];
    for (let i = 13; i >= 0; i--) {
      const dStr = getDaysAgoTurkeyDate(i);
      const isDayToday = dStr === today;
      const dayWater = recentWaterList.find((w) => w.date === dStr);
      const dayWaterAmount = dayWater ? dayWater.amount_ml : 0;
      const dayWaterGoal = dayWater ? dayWater.goal_ml : defaultGoal;

      const dayIntakes = recentIntakeList.filter(
        (l) => l.date === dStr && (visibleSuppIds.size === 0 || visibleSuppIds.has(l.supplement_id))
      );
      const uniqueTakenSuppIds = new Set(dayIntakes.map((l) => l.supplement_id));

      if (isDayToday) {
        rawSupplements.forEach((s) => {
          if (s.is_taken_today === 1 || s.last_taken_date === today) {
            uniqueTakenSuppIds.add(s.id);
          }
        });
      }

      const dayMood = recentMoodList.find((m) => m.date === dStr);
      const daySleep = recentSleepList.find((s) => s.date === dStr);

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
        hasMood: Boolean(dayMood),
        moodScore: dayMood?.mood_score ?? null,
        hasSleep: Boolean(daySleep),
        sleepHours: daySleep?.duration_hours ?? null,
        allCompleted: isWaterMet && isSuppsMet && (dayWaterAmount > 0 || suppsTaken > 0)
      });
    }

    const morningSupps = supplements.filter((s) => s.timing === 'morning');
    const eveningSupps = supplements.filter((s) => s.timing === 'evening' || s.timing === 'night');
    const mealSupps = supplements.filter((s) => s.timing === 'with_meal' || s.timing === 'lunch');

    const totalSupps = supplements.length;
    const takenSupps = supplements.filter((s) => s.is_taken_today === 1).length;

    // AI Sağlık Çıkarım Hesaplaması
    let aiInsight = 'Günlük su ve uyku takibinizi düzenli yaparak haftalık canlı AI sağlık analinizi oluşturabilirsiniz!';
    if (sleepHistory.length > 0) {
      const avgSleep = sleepHistory.reduce((acc, s) => acc + s.duration_hours, 0) / sleepHistory.length;
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
        supplements: {
          morning: morningSupps,
          evening: eveningSupps,
          with_meal: mealSupps,
          total: totalSupps,
          taken: takenSupps,
          all: supplements,
          todayLogs: selectedDateIntakeLogs,
          recentLogs: recentIntakeLogs
        },
        todayMood: selectedMood[0] || null,
        todaySleep: selectedSleep[0] || null,
        todayWater,
        moodHistory,
        sleepHistory,
        waterHistory,
        latestBiometric,
        scaleLogs,
        aiInsight,
        calendarHistory
      }
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Wellness verileri yüklenemedi.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user || !user.id) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }
    const body = await request.json();
    const { action, ...data } = body;
    const now = new Date().toISOString();
    const today = getTodayTurkeyDate();
    const targetDate = normalizeValidTurkeyDate(data.date, today);
    const isTargetToday = targetDate === today;
    const familyId = user.family_id || `fam-${user.id}`;
    const urlMemberId = request.url ? new URL(request.url).searchParams.get('member_id') : null;

    const scope = await resolveOptionalHealthMemberScope(user.id, familyId, data.member_id ?? urlMemberId);
    if (!scope.authorized) {
      return NextResponse.json({ success: false, error: 'Seçilen aile üyesine erişim yetkiniz yok.' }, { status: 403 });
    }
    const effectiveMemberId = resolveProfileEffectiveMemberId(scope);

    // 🔄 GÜNLÜK TÜM RUTİNLERİ SIFIRLAMA (RESET DAY)
    if (action === 'reset_day') {
      const intakeFilter = buildHealthMemberFilter(supplementIntakeLogs.member_id, scope);
      await db.delete(supplementIntakeLogs).where(
        and(eq(supplementIntakeLogs.user_id, user.id), eq(supplementIntakeLogs.date, targetDate), intakeFilter)
      );

      if (isTargetToday) {
        const routineFilter = buildHealthMemberFilter(supplementRoutines.member_id, scope);
        await db.update(supplementRoutines).set({
          is_taken_today: 0,
          updated_at: now
        }).where(and(eq(supplementRoutines.user_id, user.id), routineFilter));
      }

      await db.delete(waterIntakeLogs).where(buildWaterLogWhere(user.id, targetDate, scope));

      if (isTargetToday) {
        const profile = await findScopedHealthProfile(user.id, scope);
        if (profile) {
          await db.update(userHealthProfile).set({
            consumed_water_ml: 0,
            updated_at: now
          }).where(eq(userHealthProfile.id, profile.id));
        }
      }

      const moodFilter = buildHealthMemberFilter(moodLogs.member_id, scope);
      await db.delete(moodLogs).where(
        and(eq(moodLogs.user_id, user.id), eq(moodLogs.date, targetDate), moodFilter)
      );

      const sleepFilter = buildHealthMemberFilter(sleepLogs.member_id, scope);
      await db.delete(sleepLogs).where(
        and(eq(sleepLogs.user_id, user.id), eq(sleepLogs.date, targetDate), sleepFilter)
      );

      return NextResponse.json({
        success: true,
        message: `${isTargetToday ? 'Bugünkü' : targetDate + ' tarihindeki'} takviye, su, uyku ve ruh hali takip verileri sıfırlandı!`
      });
    }

    if (action === 'take_supplement') {
      if (!data.id || typeof data.id !== 'string') {
        return NextResponse.json({ success: false, error: 'Geçersiz takviye ID.' }, { status: 400 });
      }
      const suppList = await db.select().from(supplementRoutines)
        .where(and(eq(supplementRoutines.id, data.id), eq(supplementRoutines.user_id, user.id)))
        .limit(1);
      const supp = suppList[0];
      if (!supp) {
        return NextResponse.json({ success: false, error: 'Takviye bulunamadı veya bu işlem için yetkiniz yok.' }, { status: 403 });
      }

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
      } else {
        const shouldAdvanceLastTaken = !supp.last_taken_date || targetDate > supp.last_taken_date;
        if (newRemaining !== null || shouldAdvanceLastTaken) {
          await db.update(supplementRoutines).set({
            ...(newRemaining !== null ? { remaining_pills: newRemaining } : {}),
            ...(shouldAdvanceLastTaken ? { last_taken_date: targetDate } : {}),
            updated_at: now
          }).where(and(eq(supplementRoutines.id, data.id), eq(supplementRoutines.user_id, user.id)));
        }
      }

      const logId = `supp-log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      await db.insert(supplementIntakeLogs).values({
        id: logId,
        supplement_id: supp.id,
        user_id: user.id,
        family_id: familyId,
        member_id: supp.member_id ?? scope.memberId ?? null,
        supplement_name: supp.name,
        dose: supp.dose,
        timing: supp.timing,
        date: targetDate,
        taken_at: now,
        created_at: now,
        updated_at: now
      });

      return NextResponse.json({ success: true, message: 'Takviye alındı!' });
    }

    if (action === 'undo_supplement') {
      if (!data.id || typeof data.id !== 'string') {
        return NextResponse.json({ success: false, error: 'Geçersiz takviye ID.' }, { status: 400 });
      }
      const suppList = await db.select().from(supplementRoutines)
        .where(and(eq(supplementRoutines.id, data.id), eq(supplementRoutines.user_id, user.id)))
        .limit(1);
      const supp = suppList[0];
      if (!supp) {
        return NextResponse.json({ success: false, error: 'Takviye bulunamadı veya bu işlem için yetkiniz yok.' }, { status: 403 });
      }

      const existingLogs = await db.select().from(supplementIntakeLogs).where(
        and(
          eq(supplementIntakeLogs.supplement_id, supp.id),
          eq(supplementIntakeLogs.user_id, user.id),
          eq(supplementIntakeLogs.date, targetDate)
        )
      ).limit(1);

      if (existingLogs.length === 0) {
        // Eski kalıntı bayrak varsa stok şişirmeden sıfırla
        if (isTargetToday && supp.is_taken_today === 1) {
          await db.update(supplementRoutines).set({
            is_taken_today: 0,
            updated_at: now
          }).where(and(eq(supplementRoutines.id, data.id), eq(supplementRoutines.user_id, user.id)));
          return NextResponse.json({ success: true, message: 'Takviye alımı geri alındı!' });
        }
        return NextResponse.json({ success: true, message: 'Bu tarih için geri alınacak bir alım kaydı bulunamadı.' });
      }

      // 1. O güne ait log kaydını sil
      await db.delete(supplementIntakeLogs).where(
        and(
          eq(supplementIntakeLogs.supplement_id, supp.id),
          eq(supplementIntakeLogs.user_id, user.id),
          eq(supplementIntakeLogs.date, targetDate)
        )
      );

      const restoredRemaining = supp.remaining_pills !== null && supp.remaining_pills !== undefined
        ? (supp.total_pills !== null && supp.total_pills !== undefined
          ? Math.min(supp.total_pills, supp.remaining_pills + 1)
          : supp.remaining_pills + 1)
        : null;

      if (isTargetToday || supp.last_taken_date === targetDate) {
        const prevLogs = await db.select().from(supplementIntakeLogs)
          .where(and(eq(supplementIntakeLogs.supplement_id, supp.id), eq(supplementIntakeLogs.user_id, user.id)))
          .orderBy(desc(supplementIntakeLogs.date))
          .limit(1);
        const prevDate = prevLogs[0]?.date || null;
        const restoredStreak = Math.max(0, (supp.streak_days || 1) - 1);

        await db.update(supplementRoutines).set({
          ...(isTargetToday ? { is_taken_today: 0 } : {}),
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

      return NextResponse.json({ success: true, message: 'Takviye alımı geri alındı!' });
    }

    if (action === 'take_all') {
      const routineMemberFilter = buildHealthMemberFilter(supplementRoutines.member_id, scope);
      const activeSupps = await db.select().from(supplementRoutines).where(
        and(eq(supplementRoutines.is_active, 1), eq(supplementRoutines.user_id, user.id), routineMemberFilter)
      );

      // Yalnızca günlük rutinleri toplu al (periyodik ve S.O.S. takviyeler manuel işaretlenir)
      const dailySupps = activeSupps.filter(s => !s.frequency_type || s.frequency_type === 'daily');
      const yesterday = getDaysAgoTurkeyDate(1);
      let updatedCount = 0;

      for (const supp of dailySupps) {
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
            }).where(and(eq(supplementRoutines.id, supp.id), eq(supplementRoutines.user_id, user.id)));
          } else {
            const shouldAdvanceLastTaken = !supp.last_taken_date || targetDate > supp.last_taken_date;
            if (newRemaining !== null || shouldAdvanceLastTaken) {
              await db.update(supplementRoutines).set({
                ...(newRemaining !== null ? { remaining_pills: newRemaining } : {}),
                ...(shouldAdvanceLastTaken ? { last_taken_date: targetDate } : {}),
                updated_at: now
              }).where(and(eq(supplementRoutines.id, supp.id), eq(supplementRoutines.user_id, user.id)));
            }
          }

          const logId = `supp-log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          await db.insert(supplementIntakeLogs).values({
            id: logId,
            supplement_id: supp.id,
            user_id: user.id,
            family_id: familyId,
            member_id: supp.member_id ?? scope.memberId ?? null,
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
      return NextResponse.json({ success: true, message: `${updatedCount} günlük takviye alındı!` });
    }

    if (action === 'log_water') {
      const existingList = await db.select().from(waterIntakeLogs).where(buildWaterLogWhere(user.id, targetDate, scope));
      const existing = existingList[0];
      const rawAmount = Number(data.amount_ml);
      const newAmount = Number.isFinite(rawAmount) ? Math.max(0, Math.min(20000, Math.round(rawAmount))) : 0;
      const profile = await findScopedHealthProfile(user.id, scope);
      const rawGoal = Number(data.goal_ml);
      const goal = Number.isFinite(rawGoal) && rawGoal > 0
        ? Math.max(500, Math.min(10000, Math.round(rawGoal)))
        : (existing?.goal_ml || profile?.daily_water_target_ml || 2500);

      if (existing) {
        await db.update(waterIntakeLogs).set({
          amount_ml: newAmount,
          goal_ml: goal,
          updated_at: now
        }).where(and(eq(waterIntakeLogs.id, existing.id), eq(waterIntakeLogs.user_id, user.id)));
      } else {
        const id = `water-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        await db.insert(waterIntakeLogs).values({
          id,
          date: targetDate,
          amount_ml: newAmount,
          goal_ml: goal,
          member_id: effectiveMemberId,
          user_id: user.id,
          family_id: familyId,
          created_at: now,
          updated_at: now
        });
      }

      // userHealthProfile ile senkronize et (yalnızca bugün için)
      if (isTargetToday) {
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
      const newGoal = clampInt(data.goal_ml, 500, 10000, 2500);
      const existingList = await db.select().from(waterIntakeLogs).where(buildWaterLogWhere(user.id, targetDate, scope));
      const existing = existingList[0];

      if (existing) {
        await db.update(waterIntakeLogs).set({
          goal_ml: newGoal,
          updated_at: now
        }).where(and(eq(waterIntakeLogs.id, existing.id), eq(waterIntakeLogs.user_id, user.id)));
      } else {
        const id = `water-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        await db.insert(waterIntakeLogs).values({
          id,
          date: targetDate,
          amount_ml: 0,
          goal_ml: newGoal,
          member_id: effectiveMemberId,
          user_id: user.id,
          family_id: familyId,
          created_at: now,
          updated_at: now
        });
      }

      const profile = await findScopedHealthProfile(user.id, scope);
      if (profile) {
        await db.update(userHealthProfile).set({
          daily_water_target_ml: newGoal,
          updated_at: now
        }).where(eq(userHealthProfile.id, profile.id));
      } else {
        await db.insert(userHealthProfile).values({
          id: effectiveMemberId ? `hp-${user.id}-${effectiveMemberId}` : `hp-${user.id}`,
          member_id: effectiveMemberId,
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
      const cleanName = typeof data.name === 'string' ? data.name.trim() : '';
      const cleanDose = typeof data.dose === 'string' ? data.dose.trim() : '';
      if (!cleanName || !cleanDose) {
        return NextResponse.json({ success: false, error: 'Takviye adı ve dozaj zorunludur.' }, { status: 400 });
      }
      const freqType = VALID_FREQUENCIES.has(data.frequency_type) ? data.frequency_type : 'daily';
      const timing = freqType === 'as_needed'
        ? 'as_needed'
        : (VALID_TIMINGS.has(data.timing) ? data.timing : 'morning');
      const totalPills = parseOptionalNonNegativeInt(data.total_pills);
      const remainingPills = parseOptionalNonNegativeInt(data.remaining_pills);

      const id = `supp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await db.insert(supplementRoutines).values({
        id,
        member_id: scope.memberId,
        name: cleanName,
        dose: cleanDose,
        timing,
        frequency_type: freqType,
        interval_days: freqType === 'interval' ? clampInt(data.interval_days, 2, 365, 2) : 1,
        total_pills: totalPills,
        remaining_pills: remainingPills ?? totalPills,
        notes: typeof data.notes === 'string' && data.notes.trim() ? data.notes.trim() : null,
        is_taken_today: 0,
        streak_days: 0,
        is_active: 1,
        form_type: data.form_type || 'capsule',
        unit: typeof data.unit === 'string' && data.unit.trim() ? data.unit.trim() : 'kapsül',
        user_id: user.id,
        family_id: familyId,
        created_at: now,
        updated_at: now
      });
      return NextResponse.json({ success: true, id, message: 'Takviye eklendi!' });
    }

    if (action === 'update_supplement') {
      if (!data.id || typeof data.id !== 'string') {
        return NextResponse.json({ success: false, error: 'Geçersiz takviye ID.' }, { status: 400 });
      }
      const cleanName = typeof data.name === 'string' ? data.name.trim() : '';
      const cleanDose = typeof data.dose === 'string' ? data.dose.trim() : '';
      if (!cleanName || !cleanDose) {
        return NextResponse.json({ success: false, error: 'Takviye adı ve dozaj zorunludur.' }, { status: 400 });
      }
      const existingSupp = await db.select().from(supplementRoutines)
        .where(and(eq(supplementRoutines.id, data.id), eq(supplementRoutines.user_id, user.id)))
        .limit(1);
      if (!existingSupp[0]) {
        return NextResponse.json({ success: false, error: 'Takviye bulunamadı veya bu işlem için yetkiniz yok.' }, { status: 403 });
      }

      const freqType = VALID_FREQUENCIES.has(data.frequency_type) ? data.frequency_type : 'daily';
      const timing = freqType === 'as_needed'
        ? 'as_needed'
        : (VALID_TIMINGS.has(data.timing) ? data.timing : 'morning');
      const totalPills = parseOptionalNonNegativeInt(data.total_pills);
      const remainingPills = parseOptionalNonNegativeInt(data.remaining_pills);

      await db.update(supplementRoutines).set({
        name: cleanName,
        dose: cleanDose,
        timing,
        frequency_type: freqType,
        interval_days: freqType === 'interval' ? clampInt(data.interval_days, 2, 365, 2) : 1,
        total_pills: totalPills,
        remaining_pills: remainingPills,
        notes: typeof data.notes === 'string' && data.notes.trim() ? data.notes.trim() : null,
        form_type: data.form_type || 'capsule',
        unit: typeof data.unit === 'string' && data.unit.trim() ? data.unit.trim() : 'kapsül',
        updated_at: now
      }).where(and(eq(supplementRoutines.id, data.id), eq(supplementRoutines.user_id, user.id)));
      return NextResponse.json({ success: true, message: 'Takviye güncellendi!' });
    }

    if (action === 'delete_supplement') {
      if (!data.id || typeof data.id !== 'string') {
        return NextResponse.json({ success: false, error: 'Geçersiz takviye ID.' }, { status: 400 });
      }
      const existingSupp = await db.select().from(supplementRoutines)
        .where(and(eq(supplementRoutines.id, data.id), eq(supplementRoutines.user_id, user.id)))
        .limit(1);
      if (!existingSupp[0]) {
        return NextResponse.json({ success: false, error: 'Takviye bulunamadı veya bu işlem için yetkiniz yok.' }, { status: 403 });
      }

      await db.update(supplementRoutines)
        .set({ is_active: 0, updated_at: now })
        .where(and(eq(supplementRoutines.id, data.id), eq(supplementRoutines.user_id, user.id)));
      return NextResponse.json({ success: true, message: 'Takviye silindi!' });
    }

    if (action === 'reset_supplements') {
      if (isTargetToday) {
        const routineFilter = buildHealthMemberFilter(supplementRoutines.member_id, scope);
        await db.update(supplementRoutines).set({ is_taken_today: 0, updated_at: now })
          .where(and(eq(supplementRoutines.user_id, user.id), routineFilter));
      }
      const intakeFilter = buildHealthMemberFilter(supplementIntakeLogs.member_id, scope);
      await db.delete(supplementIntakeLogs).where(
        and(eq(supplementIntakeLogs.user_id, user.id), eq(supplementIntakeLogs.date, targetDate), intakeFilter)
      );
      return NextResponse.json({ success: true, message: `${isTargetToday ? 'Bugünkü' : targetDate + ' tarihindeki'} takviyeler sıfırlandı!` });
    }

    if (action === 'reset_water') {
      await db.delete(waterIntakeLogs).where(buildWaterLogWhere(user.id, targetDate, scope));
      if (isTargetToday) {
        const profile = await findScopedHealthProfile(user.id, scope);
        if (profile) {
          await db.update(userHealthProfile).set({ consumed_water_ml: 0, updated_at: now }).where(eq(userHealthProfile.id, profile.id));
        }
      }
      return NextResponse.json({ success: true, message: '💧 Su sayacı sıfırlandı!' });
    }

    if (action === 'add_mood') {
      const rawMoodScore = Number(data.mood_score);
      if (!Number.isFinite(rawMoodScore) || rawMoodScore < 1 || rawMoodScore > 5) {
        return NextResponse.json({ success: false, error: 'Ruh hali puanı 1 ile 5 arasında olmalıdır.' }, { status: 400 });
      }
      const moodScore = Math.round(rawMoodScore);
      const energyLevel = clampInt(data.energy_level, 1, 5, 3);
      const stressLevel = clampInt(data.stress_level, 1, 5, 2);
      const moodEmoji = typeof data.mood_emoji === 'string' && data.mood_emoji.trim() ? data.mood_emoji.trim() : '😊';
      const note = typeof data.note === 'string' && data.note.trim() ? data.note.trim() : null;

      const existingMoodList = await db.select().from(moodLogs).where(
        and(eq(moodLogs.date, targetDate), eq(moodLogs.user_id, user.id), buildNullableMemberCondition(moodLogs.member_id, effectiveMemberId))
      );
      const existingMood = existingMoodList[0];

      if (existingMood) {
        await db.update(moodLogs).set({
          mood_emoji: moodEmoji,
          mood_score: moodScore,
          energy_level: energyLevel,
          stress_level: stressLevel,
          note,
          updated_at: now
        }).where(and(eq(moodLogs.id, existingMood.id), eq(moodLogs.user_id, user.id)));
        return NextResponse.json({ success: true, id: existingMood.id });
      } else {
        const id = `mood-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        await db.insert(moodLogs).values({
          id,
          mood_emoji: moodEmoji,
          mood_score: moodScore,
          energy_level: energyLevel,
          stress_level: stressLevel,
          note,
          date: targetDate,
          member_id: effectiveMemberId,
          user_id: user.id,
          family_id: familyId,
          created_at: now,
          updated_at: now
        });
        return NextResponse.json({ success: true, id });
      }
    }

    if (action === 'add_sleep') {
      const bedtime = typeof data.bedtime === 'string' ? data.bedtime.trim() : '';
      const wakeTime = typeof data.wake_time === 'string' ? data.wake_time.trim() : '';
      if (!TIME_HHMM_REGEX.test(bedtime) || !TIME_HHMM_REGEX.test(wakeTime)) {
        return NextResponse.json({ success: false, error: 'Geçerli bir yatış ve uyanma saati (SS:DD) girin.' }, { status: 400 });
      }
      const [bh, bm] = bedtime.split(':').map(Number);
      const [wh, wm] = wakeTime.split(':').map(Number);
      let duration = (wh * 60 + wm) - (bh * 60 + bm);
      if (duration < 0) duration += 24 * 60;
      const duration_hours = parseFloat((duration / 60).toFixed(1));
      const qualityRating = clampInt(data.quality_rating, 1, 5, 3);
      const notes = typeof data.notes === 'string' && data.notes.trim() ? data.notes.trim() : null;

      const existingSleepList = await db.select().from(sleepLogs).where(
        and(eq(sleepLogs.date, targetDate), eq(sleepLogs.user_id, user.id), buildNullableMemberCondition(sleepLogs.member_id, effectiveMemberId))
      );
      const existingSleep = existingSleepList[0];

      if (existingSleep) {
        await db.update(sleepLogs).set({
          bedtime,
          wake_time: wakeTime,
          quality_rating: qualityRating,
          notes,
          duration_hours,
          updated_at: now
        }).where(and(eq(sleepLogs.id, existingSleep.id), eq(sleepLogs.user_id, user.id)));
        return NextResponse.json({ success: true, id: existingSleep.id, duration_hours });
      } else {
        const id = `sleep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        await db.insert(sleepLogs).values({
          id,
          bedtime,
          wake_time: wakeTime,
          quality_rating: qualityRating,
          notes,
          duration_hours,
          date: targetDate,
          member_id: effectiveMemberId,
          user_id: user.id,
          family_id: familyId,
          created_at: now,
          updated_at: now
        });
        return NextResponse.json({ success: true, id, duration_hours });
      }
    }

    return NextResponse.json({ success: false, error: 'Bilinmeyen işlem' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'İşlem sırasında hata oluştu.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
