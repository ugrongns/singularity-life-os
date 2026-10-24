import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { readingSessions, books, userReadingProfile } from '@/db/schema';
import { eq, desc , or } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 });
    }

    const body = await req.json();

    const {
      book_id,
      start_page,
      end_page,
      duration_minutes
    } = body;

    const familyId = user.family_id || `fam-${user.id}`;
    const book = (await db.select().from(books).where(eq(books.id, book_id)))[0];
    if (!book) {
      return NextResponse.json({ success: false, error: 'Kitap bulunamadı.' }, { status: 404 });
    }

    // OWASP BOLA: Kitabın kullanıcıya veya ailesine ait olduğunu doğrula
    const isOwner = book.user_id === user.id || (book.family_id && book.family_id === familyId);
    if (!isOwner) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim: Bu kitap hesabınıza ait değil.' }, { status: 403 });
    }

    const currentBookPage = book.current_page || 0;
    const start = !isNaN(parseInt(start_page, 10)) ? parseInt(start_page, 10) : currentBookPage;
    let end = parseInt(end_page, 10);
    let pagesRead = 0;

    if (!isNaN(end) && end >= start) {
      pagesRead = Math.max(1, end - start);
    } else {
      pagesRead = Math.max(1, parseInt(body.pages_read || body.pagesRead, 10) || 1);
      end = Math.min(book.total_pages || 9999, start + pagesRead);
    }

    const duration = parseFloat(duration_minutes) || Math.max(1, Math.round(pagesRead * 1.5));
    const now = new Date().toISOString();
    const sessionId = `session-${Date.now()}`;

    // 1. Seans Kaydet
    await db.insert(readingSessions).values({
      id: sessionId,
      book_id,
      start_page: start,
      end_page: end,
      pages_read: pagesRead,
      duration_minutes: duration,
      session_date: now.split('T')[0],
      user_id: user.id,
      family_id: familyId,
      created_at: now,
      updated_at: now
    });

    // 2. Kitabın güncel sayfasını ilerlet
    if (end > currentBookPage) {
      const isFinished = book.total_pages ? end >= book.total_pages : false;
      await db.update(books)
        .set({
          current_page: end,
          status: isFinished ? 'completed' : book.status,
          finish_date: isFinished ? now.split('T')[0] : book.finish_date,
          updated_at: now
        })
        .where(eq(books.id, book_id))
        ;
    }

    // 3. WPM ve Sayfa Başı Saniye Kalibrasyonu (Kullanıcının Son 100 Seansı)
    const recentSessionsWithBook = await db.select({
      pages_read: readingSessions.pages_read,
      duration_minutes: readingSessions.duration_minutes,
      words_per_page: books.words_per_page
    })
      .from(readingSessions)
      .leftJoin(books, eq(readingSessions.book_id, books.id))
      .where(eq(readingSessions.user_id, user.id))
      .orderBy(desc(readingSessions.created_at))
      .limit(100);

    let totalWords = 0;
    let totalMinutes = 0;
    let totalPages = 0;

    for (const s of recentSessionsWithBook) {
      const pRead = s.pages_read || 0;
      const dMin = s.duration_minutes || 0;
      const wpp = s.words_per_page || 250;
      totalWords += pRead * wpp;
      totalMinutes += dMin;
      totalPages += pRead;
    }

    const calculatedAvgWpm = totalMinutes > 0 ? Math.round(totalWords / totalMinutes) : 220;
    const calculatedSecPerPage = totalPages > 0 ? Math.round((totalMinutes * 60) / totalPages) : 120;

    const profile = (await db.select().from(userReadingProfile).where(eq(userReadingProfile.user_id, user.id)).limit(1))[0];
    if (profile) {
      await db.update(userReadingProfile)
        .set({
          calibrated_avg_wpm: calculatedAvgWpm,
          avg_seconds_per_page: calculatedSecPerPage,
          updated_at: now
        })
        .where(eq(userReadingProfile.id, profile.id))
        ;
    } else {
      await db.insert(userReadingProfile).values({
        id: `urp-${user.id}`,
        yearly_target_books: 24,
        calibrated_avg_wpm: calculatedAvgWpm,
        avg_seconds_per_page: calculatedSecPerPage,
        user_id: user.id,
        family_id: familyId,
        created_at: now,
        updated_at: now
      });
    }

    return NextResponse.json({
      success: true,
      message: `${pagesRead} sayfa (${duration} dk) okundu. Hızınız: ${calculatedAvgWpm} WPM (${(calculatedSecPerPage / 60).toFixed(1)} dk/sayfa) olarak kalibre edildi! 🎯`
    });
  } catch (error: any) {
    console.error('Session API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
