import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { readingSessions, books, userReadingProfile } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { clampWpm } from '@/lib/module4-utils';
import { getTodayTurkeyDate } from '@/lib/date-utils';

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

    if (!book_id || typeof book_id !== 'string') {
      return NextResponse.json({ success: false, error: 'Kitap seçimi zorunludur.' }, { status: 400 });
    }

    const familyId = user.family_id || `fam-${user.id}`;
    const book = (await db.select().from(books).where(eq(books.id, book_id)))[0];
    if (!book) {
      return NextResponse.json({ success: false, error: 'Kitap bulunamadı.' }, { status: 404 });
    }

    // OWASP BOLA: Kitabın kullanıcıya veya ailesinin ortak kütüphanesine ait olduğunu doğrula
    const isOwner = book.user_id === user.id || (book.family_id && book.family_id === familyId && book.is_family_shared === 1);
    if (!isOwner) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim: Bu kitap hesabınıza ait değil.' }, { status: 403 });
    }

    const currentBookPage = book.current_page || 0;
    const rawStart = start_page !== undefined && start_page !== null && start_page !== ''
      ? parseInt(start_page, 10)
      : currentBookPage;
    if (!Number.isFinite(rawStart) || rawStart < 0) {
      return NextResponse.json({ success: false, error: 'Başlangıç sayfası geçersiz.' }, { status: 400 });
    }
    const start = rawStart;

    const hasExplicitEnd = end_page !== undefined && end_page !== null && end_page !== '';
    const hasPagesCount = body.pages_read !== undefined || body.pagesRead !== undefined;
    let end = hasExplicitEnd ? parseInt(end_page, 10) : NaN;
    let pagesRead = 0;

    if (hasExplicitEnd && !hasPagesCount) {
      if (!Number.isFinite(end) || end <= start) {
        return NextResponse.json({ success: false, error: 'Bitiş sayfası başlangıç sayfasından büyük olmalıdır.' }, { status: 400 });
      }
      pagesRead = end - start;
    } else if (!isNaN(end) && end > start) {
      pagesRead = end - start;
    } else {
      const rawPages = parseInt(body.pages_read ?? body.pagesRead, 10);
      if (!Number.isFinite(rawPages) || rawPages < 1) {
        return NextResponse.json({ success: false, error: 'Okunan sayfa sayısı en az 1 olmalıdır.' }, { status: 400 });
      }
      pagesRead = rawPages;
      end = book.total_pages > 0 ? Math.min(book.total_pages, start + pagesRead) : start + pagesRead;
    }

    let duration: number;
    if (duration_minutes !== undefined && duration_minutes !== null && duration_minutes !== '') {
      const parsedDuration = Number(duration_minutes);
      if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
        return NextResponse.json({ success: false, error: 'Okuma süresi 0 dakikadan büyük olmalıdır.' }, { status: 400 });
      }
      duration = parsedDuration;
    } else {
      duration = Math.max(1, Math.round(pagesRead * 1.5));
    }

    const now = new Date().toISOString();
    const todayTr = getTodayTurkeyDate();
    const clampedEnd = book.total_pages > 0 ? Math.min(book.total_pages, end) : end;
    const sessionId = `session-${Date.now()}`;

    // 1. Seans Kaydet
    await db.insert(readingSessions).values({
      id: sessionId,
      book_id,
      start_page: start,
      end_page: clampedEnd,
      pages_read: pagesRead,
      duration_minutes: duration,
      session_date: todayTr,
      user_id: user.id,
      family_id: familyId,
      created_at: now,
      updated_at: now
    });

    // 2. Kitabın güncel sayfasını ilerlet (total_pages tavanını aşmadan)
    if (clampedEnd > currentBookPage) {
      const isFinished = book.total_pages > 0 ? clampedEnd >= book.total_pages : false;
      const nextStatus = isFinished ? 'completed' : book.status === 'wishlist' ? 'reading' : book.status;
      await db.update(books)
        .set({
          current_page: clampedEnd,
          status: nextStatus,
          start_date: book.start_date || todayTr,
          finish_date: isFinished ? (book.finish_date || todayTr) : book.finish_date,
          updated_at: now
        })
        .where(eq(books.id, book_id));
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

    const rawAvgWpm = totalMinutes > 0 ? Math.round(totalWords / totalMinutes) : 220;
    const calculatedAvgWpm = clampWpm(rawAvgWpm);
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
