import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { readingSessions, books } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { calculateReadingAnalytics, RawReadingSessionWithBook } from '@/lib/reading-analytics';

export async function GET(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const bookId = searchParams.get('book_id');

    // OWASP BOLA: Sadece oturum açmış kullanıcının (user.id) seanslarını filtrele
    const conditions = [
      eq(readingSessions.user_id, user.id)
    ];

    if (bookId) {
      conditions.push(eq(readingSessions.book_id, bookId));
    }

    const rows = await db.select({
      session_id: readingSessions.id,
      book_id: readingSessions.book_id,
      pages_read: readingSessions.pages_read,
      duration_minutes: readingSessions.duration_minutes,
      session_date: readingSessions.session_date,
      created_at: readingSessions.created_at,
      user_id: readingSessions.user_id,
      book_title: books.title,
      book_author: books.author,
      book_category: books.category,
      words_per_page: books.words_per_page
    })
      .from(readingSessions)
      .innerJoin(books, eq(readingSessions.book_id, books.id))
      .where(and(...conditions))
      .orderBy(desc(readingSessions.session_date), desc(readingSessions.created_at))
      .limit(200);

    const summary = calculateReadingAnalytics(rows as RawReadingSessionWithBook[]);

    return NextResponse.json({
      success: true,
      data: summary
    });
  } catch (error: any) {
    console.error('Reading Analytics API Error:', error);
    return NextResponse.json({ success: false, error: error.message ?? 'Okuma analitiği alınamadı.' }, { status: 500 });
  }
}
