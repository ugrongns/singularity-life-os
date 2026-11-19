import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import {
  fastingSessions,
  readingSessions,
  books,
  transactions,
  categories,
  waterIntakeLogs,
  tasks,
  habits,
  habitLogs
} from '@/db/schema';
import { eq, and, gte, or } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { fetchLiveExchangeRates } from '@/lib/market-data';
import { calculateHeatmapMatrix, RawHeatmapData } from '@/lib/calendar-heatmap';
import { getTodayTurkeyDate, shiftTurkeyDate } from '@/lib/date-utils';

export async function GET(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const requestedDays = parseInt(searchParams.get('days') ?? '365', 10);
    const daysCount = Math.min(365, Math.max(30, isNaN(requestedDays) ? 365 : requestedDays));

    const today = new Date();
    const todayTr = getTodayTurkeyDate(today);
    const startDateStr = shiftTurkeyDate(todayTr, -daysCount);
    const timestampStartStr = shiftTurkeyDate(startDateStr, -1); // 00:00-02:59 TR/UTC sınır tamponu

    const familyId = user.family_id || `fam-${user.id}`;

    // 1. Oruç Seansları (OWASP BOLA)
    const rawFasting = await db.select({
      start_time: fastingSessions.start_time,
      actual_end_time: fastingSessions.actual_end_time,
      is_active: fastingSessions.is_active,
      notes: fastingSessions.notes
    })
      .from(fastingSessions)
      .where(
        and(
          eq(fastingSessions.user_id, user.id),
          eq(fastingSessions.is_active, 0),
          gte(fastingSessions.actual_end_time, timestampStartStr)
        )
      )
      .limit(500);

    // 2. Okuma Seansları (OWASP BOLA)
    const rawReading = await db.select({
      pages_read: readingSessions.pages_read,
      duration_minutes: readingSessions.duration_minutes,
      session_date: readingSessions.session_date,
      words_per_page: books.words_per_page
    })
      .from(readingSessions)
      .leftJoin(books, eq(readingSessions.book_id, books.id))
      .where(
        and(
          eq(readingSessions.user_id, user.id),
          gte(readingSessions.session_date, startDateStr)
        )
      )
      .limit(1000);

    // 3. Harcamalar (OWASP BOLA + Döviz/Altın TRY Dönüşümü)
    const rawTransactions = await db.select({
      amount: transactions.amount,
      currency: transactions.currency,
      transaction_date: transactions.transaction_date,
      merchant: transactions.merchant,
      notes: transactions.notes,
      category_type: categories.type
    })
      .from(transactions)
      .leftJoin(categories, eq(transactions.category_id, categories.id))
      .where(
        and(
          or(
            eq(transactions.user_id, user.id),
            and(eq(transactions.family_id, familyId), eq(transactions.is_family_shared, 1))
          ),
          gte(transactions.transaction_date, startDateStr)
        )
      )
      .limit(1500);

    const hasForeignCurrencyTx = rawTransactions.some((t: any) => {
      const c = (t.currency || 'TRY').toUpperCase();
      return c !== 'TRY' && c !== 'TL';
    });
    const liveRates = hasForeignCurrencyTx ? await fetchLiveExchangeRates() : null;
    const toTryAmount = (amount: number, currency?: string | null) => {
      const num = Number(amount) || 0;
      const c = (currency || 'TRY').toUpperCase();
      if (!liveRates || c === 'TRY' || c === 'TL') return num;
      if (c === 'USD') return num * (liveRates.USD_TRY || 0);
      if (c === 'EUR') return num * (liveRates.EUR_TRY || 0);
      if (c === 'GBP') return num * (liveRates.GBP_TRY || 0);
      if (c === 'GOLD') return num * (liveRates.GOLD_GRAM_TRY || 0);
      if (c === 'BTC') return num * (liveRates.BTC_TRY || 0);
      return num;
    };
    const normalizedTransactions = rawTransactions.map((t: any) => ({
      ...t,
      amount: Math.round(toTryAmount(t.amount, t.currency) * 100) / 100
    }));

    // 4. Su Kayıtları (OWASP BOLA — kişisel sağlık verisi yalnızca oturum sahibine aittir)
    const rawWater = await db.select({
      date: waterIntakeLogs.date,
      amount_ml: waterIntakeLogs.amount_ml
    })
      .from(waterIntakeLogs)
      .where(
        and(
          eq(waterIntakeLogs.user_id, user.id),
          gte(waterIntakeLogs.date, startDateStr)
        )
      )
      .limit(500);

    // 5. Tamamlanan Görevler (OWASP BOLA)
    const rawTasks = await db.select({
      completed_at: tasks.completed_at,
      is_mit: tasks.is_mit
    })
      .from(tasks)
      .where(
        and(
          eq(tasks.status, 'completed'),
          or(
            eq(tasks.user_id, user.id),
            and(eq(tasks.family_id, familyId), eq(tasks.is_family_shared, 1))
          ),
          gte(tasks.completed_at, timestampStartStr)
        )
      )
      .limit(1000);

    // 6. Alışkanlık Logları (OWASP BOLA — kişisel)
    let rawHabits: Array<{ id: string }> = [];
    let rawHabitLogs: Array<{ date: string; is_completed: number }> = [];
    try {
      const [hRows, lRows] = await Promise.all([
        db.select({ id: habits.id }).from(habits).where(and(eq(habits.user_id, user.id), eq(habits.is_archived, 0))),
        db.select({ date: habitLogs.date, is_completed: habitLogs.is_completed })
          .from(habitLogs)
          .where(and(eq(habitLogs.user_id, user.id), eq(habitLogs.is_completed, 1), gte(habitLogs.date, startDateStr)))
          .limit(2000)
      ]);
      if (Array.isArray(hRows)) rawHabits = hRows;
      if (Array.isArray(lRows)) rawHabitLogs = lRows;
    } catch {
      rawHabits = [];
      rawHabitLogs = [];
    }

    const rawData: RawHeatmapData = {
      fastingSessions: rawFasting,
      readingSessions: rawReading,
      transactions: normalizedTransactions,
      waterLogs: rawWater,
      completedTasks: rawTasks,
      habitLogs: rawHabitLogs,
      activeHabitsCount: rawHabits.length
    };

    const summary = calculateHeatmapMatrix(rawData, daysCount, today);

    return NextResponse.json({
      success: true,
      data: summary
    });
  } catch (error: any) {
    console.error('Life Calendar Heatmap API Error:', error);
    return NextResponse.json({ success: false, error: error.message ?? 'Yaşam takvimi verisi alınamadı.' }, { status: 500 });
  }
}
