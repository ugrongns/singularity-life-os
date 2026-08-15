import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { readingSessions, books, userReadingProfile } from '@/db/schema';
import { eq, desc , or } from 'drizzle-orm';

export async function POST(req: Request) {
  try {
    initDatabase();
    const body = await req.json();

    const {
      book_id,
      start_page,
      end_page,
      duration_minutes
    } = body;

    const start = parseInt(start_page, 10);
    const end = parseInt(end_page, 10);
    const duration = parseFloat(duration_minutes);
    const pagesRead = Math.max(1, end - start);

    const now = new Date().toISOString();
    const sessionId = `session-${Date.now()}`;

    // 1. Seans Kaydet
    db.insert(readingSessions).values({
      id: sessionId,
      book_id,
      start_page: start,
      end_page: end,
      pages_read: pagesRead,
      duration_minutes: duration,
      session_date: now.split('T')[0],
      created_at: now,
      updated_at: now
    }).run();

    // 2. Kitabın güncel sayfasını ilerlet
    const book = await db.select().from(books).where(eq(books.id, book_id)).get();
    if (book && end > book.current_page) {
      const isFinished = end >= book.total_pages;
      db.update(books)
        .set({
          current_page: end,
          status: isFinished ? 'completed' : book.status,
          finish_date: isFinished ? now.split('T')[0] : book.finish_date,
          updated_at: now
        })
        .where(eq(books.id, book_id))
        .run();
    }

    // 3. WPM ve Sayfa Başı Saniye Kalibrasyonu (Son 100 Seans Toplamı)
    const recentSessions = await db.select()
      .from(readingSessions)
      .orderBy(desc(readingSessions.created_at))
      .limit(100)
      .all();

    let totalWords = 0;
    let totalMinutes = 0;
    let totalPages = 0;

    for (const s of recentSessions) {
      const pRead = s.pages_read || 0;
      const dMin = s.duration_minutes || 0;
      totalWords += pRead * 250;
      totalMinutes += dMin;
      totalPages += pRead;
    }

    const calculatedAvgWpm = totalMinutes > 0 ? Math.round(totalWords / totalMinutes) : 220;
    const calculatedSecPerPage = totalPages > 0 ? Math.round((totalMinutes * 60) / totalPages) : 120;

    const profile = await db.select().from(userReadingProfile).limit(1).get();
    if (profile) {
      db.update(userReadingProfile)
        .set({
          calibrated_avg_wpm: calculatedAvgWpm,
          avg_seconds_per_page: calculatedSecPerPage,
          updated_at: now
        })
        .where(eq(userReadingProfile.id, profile.id))
        .run();
    }

    return NextResponse.json({
      success: true,
      message: `${pagesRead} sayfa (${duration} dk) okundu. Hızınız (Son ${recentSessions.length} seans ortalaması): ${calculatedAvgWpm} WPM (${(calculatedSecPerPage / 60).toFixed(1)} dk/sayfa) olarak güncellendi! 🎯`
    });
  } catch (error: any) {
    console.error('Session API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
