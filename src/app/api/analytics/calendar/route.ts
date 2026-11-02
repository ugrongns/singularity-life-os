import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import {
  fastingSessions,
  readingSessions,
  books,
  transactions,
  categories,
  waterIntakeLogs
} from '@/db/schema';
import { eq, and, gte, desc, or } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { calculateHeatmapMatrix, RawHeatmapData } from '@/lib/calendar-heatmap';

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
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - daysCount);
    const startDateStr = startDate.toISOString().slice(0, 10);

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
          gte(fastingSessions.created_at, startDateStr)
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

    // 3. Harcamalar (OWASP BOLA)
    const rawTransactions = await db.select({
      amount: transactions.amount,
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

    // 4. Su Kayıtları (OWASP BOLA)
    const rawWater = await db.select({
      date: waterIntakeLogs.date,
      amount_ml: waterIntakeLogs.amount_ml
    })
      .from(waterIntakeLogs)
      .where(
        and(
          or(
            eq(waterIntakeLogs.user_id, user.id),
            eq(waterIntakeLogs.family_id, familyId)
          ),
          gte(waterIntakeLogs.date, startDateStr)
        )
      )
      .limit(500);

    const rawData: RawHeatmapData = {
      fastingSessions: rawFasting,
      readingSessions: rawReading,
      transactions: rawTransactions,
      waterLogs: rawWater
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
