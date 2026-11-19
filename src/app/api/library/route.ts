import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { books, userReadingProfile, readingSessions, bookQuotes } from '@/db/schema';
import { eq, desc, or, and, sql } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { getTodayTurkeyDate } from '@/lib/date-utils';

function getVisibleBooksCondition(userId: string, familyId: string | null) {
  if (!familyId) return eq(books.user_id, userId);
  return or(
    eq(books.user_id, userId),
    and(eq(books.family_id, familyId), eq(books.is_family_shared, 1))
  );
}

function isSafeCoverUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://') || trimmed.startsWith('/')) {
    return !trimmed.startsWith('//');
  }
  return /^data:image\/(jpeg|jpg|png|webp|gif);base64,/i.test(trimmed);
}

export async function GET() {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user || !user.id) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }
    const userId = user.id;
    const familyId = user.family_id || `fam-${userId}`;

    const allBooks = await db.select().from(books)
      .where(getVisibleBooksCondition(userId, familyId))
      .orderBy(desc(books.created_at));
    const allSessions = await db.select().from(readingSessions).where(eq(readingSessions.user_id, userId));
    const profile = (await db.select().from(userReadingProfile).where(eq(userReadingProfile.user_id, userId)).limit(1))[0] || {
      yearly_target_books: 24,
      calibrated_avg_wpm: 220,
      avg_seconds_per_page: 84
    };

    const completedBooks = (allBooks).filter((b: any) => b.status === 'completed');

    // Her kitap için özel okuma seansları, hız (WPM) ve süre hesabı
    const booksWithStats = (allBooks).map((b: any) => {
      const bookSessions = (allSessions).filter((s: any) => s.book_id === b.id);
      const sessionCount = bookSessions.length;
      const totalPagesRead = (bookSessions).reduce((acc: number, s: any) => acc + (s.pages_read || 0), 0);
      const totalDurationMinutes = (bookSessions).reduce((acc: number, s: any) => acc + (s.duration_minutes || 0), 0);
      
      const wordsPerPage = b.words_per_page && b.words_per_page > 0 ? b.words_per_page : 250;
      const totalWordsRead = totalPagesRead * wordsPerPage;

      let bookWpm: number | null = null;
      let avgMinutesPerPage: string | null = null;

      if (totalDurationMinutes > 0 && totalWordsRead > 0) {
        bookWpm = Math.round(totalWordsRead / totalDurationMinutes);
      }
      if (totalDurationMinutes > 0 && totalPagesRead > 0) {
        avgMinutesPerPage = (totalDurationMinutes / totalPagesRead).toFixed(1);
      }

      const effectiveWpm = Math.max(1, bookWpm || profile.calibrated_avg_wpm || 220);
      const effectiveAvgMinutesPerPage = avgMinutesPerPage || (wordsPerPage / effectiveWpm).toFixed(1);

      const hours = Math.floor(totalDurationMinutes / 60);
      const mins = Math.round(totalDurationMinutes % 60);
      const totalDurationText = totalDurationMinutes > 0
        ? (hours > 0 ? `${hours} sa ${mins} dk` : `${mins} dk`)
        : '0 dk';

      return {
        ...b,
        stats: {
          sessionCount,
          totalDurationMinutes,
          totalDurationText,
          wpm: effectiveWpm,
          hasSessionData: bookWpm !== null,
          avgMinutesPerPage: effectiveAvgMinutesPerPage
        }
      };
    });

    const activeReadingBook =
      booksWithStats.find((b: any) => b.status === 'reading' && !b.is_lent_out) ||
      booksWithStats.find((b: any) => b.status === 'reading') ||
      null;

    // Aktif okunan kitap için Kalan Süre (ETA) Hesabı (O kitabın özel hızı veya genel profil WPM'i ile)
    let activeBookETA = null;
    if (activeReadingBook && activeReadingBook.status === 'reading') {
      const remainingPages = Math.max(0, (activeReadingBook.total_pages || 0) - (activeReadingBook.current_page || 0));
      const wordsPerPage = activeReadingBook.words_per_page && activeReadingBook.words_per_page > 0 ? activeReadingBook.words_per_page : 250;
      const wpm = Math.max(1, activeReadingBook.stats?.wpm || profile.calibrated_avg_wpm || 220);
      
      const totalWordsLeft = remainingPages * wordsPerPage;
      const totalMinutesLeft = Math.ceil(totalWordsLeft / wpm);
      const hoursLeft = Math.floor(totalMinutesLeft / 60);
      const minutesLeft = totalMinutesLeft % 60;

      activeBookETA = {
        remainingPages,
        hoursLeft,
        minutesLeft,
        text: hoursLeft > 0 ? `${hoursLeft} sa ${minutesLeft} dk` : `${minutesLeft} dk`,
        progressPercent: activeReadingBook.total_pages > 0 
          ? Math.min(100, Math.round((activeReadingBook.current_page / activeReadingBook.total_pages) * 100))
          : 0
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        profile: {
          ...profile,
          completedBooksCount: completedBooks.length,
          targetProgressPercent: (profile.yearly_target_books && profile.yearly_target_books > 0)
            ? Math.min(100, Math.round((completedBooks.length / profile.yearly_target_books) * 100))
            : 0,
          avgMinutesPerPage: ((profile.avg_seconds_per_page || 84) / 60).toFixed(1)
        },
        activeReadingBook: activeReadingBook ? {
          ...activeReadingBook,
          eta: activeBookETA
        } : null,
        books: booksWithStats
      }
    });
  } catch (error: any) {
    console.error('Library API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Kitap Sayfası İlerletme, Emanet Güncelleme veya Yeni Kitap Ekleme
export async function POST(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    const body = await req.json();
    const { 
      action, 
      book_id, 
      current_page, 
      title, 
      author, 
      publisher, 
      total_pages, 
      category, 
      status, 
      format = 'physical',
      shelf_location = 'Salon Kitaplığı',
      words_per_page = 250,
      isbn,
      summary,
      rating = 5,
      is_lent_out = 0,
      lent_to_name,
      lent_date
    } = body;

    const now = new Date().toISOString();
    const todayTr = getTodayTurkeyDate();
    const currentYear = todayTr.slice(0, 4);
    const familyId = user.family_id || `fam-${user.id}`;

    // 0. Yıllık Okuma Hedefi Güncelleme
    if (action === 'update_target') {
      const parsedTarget = parseInt(body.yearly_target_books, 10);
      if (!Number.isFinite(parsedTarget) || parsedTarget < 1 || parsedTarget > 500) {
        return NextResponse.json({ success: false, error: 'Yıllık okuma hedefi 1 ile 500 arasında olmalıdır.' }, { status: 400 });
      }
      const existing = (await db.select().from(userReadingProfile).where(eq(userReadingProfile.user_id, user.id)).limit(1))[0];
      if (existing) {
        await db.update(userReadingProfile)
          .set({ yearly_target_books: parsedTarget, updated_at: now })
          .where(eq(userReadingProfile.id, existing.id));
      } else {
        await db.insert(userReadingProfile).values({
          id: `urp-${user.id}`,
          yearly_target_books: parsedTarget,
          calibrated_avg_wpm: 220,
          avg_seconds_per_page: 84,
          user_id: user.id,
          family_id: familyId,
          created_at: now,
          updated_at: now
        });
      }
      return NextResponse.json({ success: true, message: `🎯 ${currentYear} yılı okuma hedefiniz ${parsedTarget} kitap olarak güncellendi!` });
    }

    // 1. Yeni Kitap Ekleme (Manuel veya Kamera / ISBN)
    if (action === 'create_book' || (!action && title && !book_id)) {
      const cleanTitle = typeof title === 'string' ? title.trim() : '';
      if (!cleanTitle) {
        return NextResponse.json({ success: false, error: 'Kitap adı zorunludur.' }, { status: 400 });
      }
      const cleanAuthor = typeof author === 'string' && author.trim() ? author.trim() : 'Bilinmeyen Yazar';

      if (body.cover_url && typeof body.cover_url === 'string' && !isSafeCoverUrl(body.cover_url)) {
        return NextResponse.json({ success: false, error: 'Geçersiz kapak görseli bağlantısı.' }, { status: 400 });
      }

      let parsedPurchasePrice: number | null = null;
      if (body.purchase_price !== undefined && body.purchase_price !== null && body.purchase_price !== '') {
        const numPrice = Number(body.purchase_price);
        if (!Number.isFinite(numPrice) || numPrice < 0) {
          return NextResponse.json({ success: false, error: 'Alım fiyatı geçersiz.' }, { status: 400 });
        }
        parsedPurchasePrice = numPrice;
      }

      const { allow_duplicate } = body;

      // 🛡️ Mükerrer Kitap Güvenlik Kalkanı (allow_duplicate: true olmadığı sürece engelle)
      if (!allow_duplicate) {
        const rawIsbn = (isbn || '').trim();
        const cleanIsbn = rawIsbn.replace(/[^0-9X]/gi, '').trim();
        let existingBook = null;

        if (cleanIsbn.length >= 9) {
          const byIsbn = await db.select().from(books).where(
            and(
              getVisibleBooksCondition(user.id, familyId),
              or(
                eq(books.isbn, rawIsbn),
                eq(books.isbn, cleanIsbn),
                sql`REPLACE(REPLACE(COALESCE(${books.isbn}, ''), '-', ''), ' ', '') = ${cleanIsbn}`
              )
            )
          ).limit(1);
          if (byIsbn && byIsbn.length > 0) existingBook = byIsbn[0];
        }

        if (!existingBook && cleanTitle.length > 2) {
          const byTitle = await db.select().from(books).where(
            and(
              getVisibleBooksCondition(user.id, familyId),
              sql`LOWER(TRIM(${books.title})) = LOWER(TRIM(${cleanTitle}))`
            )
          ).limit(1);

          if (byTitle && byTitle.length > 0) {
            const existingAuthor = (byTitle[0].author || '').toLowerCase();
            const incomingAuthor = (author || '').toLowerCase();
            if (!incomingAuthor || existingAuthor.includes(incomingAuthor.slice(0, 4)) || incomingAuthor.includes(existingAuthor.slice(0, 4))) {
              existingBook = byTitle[0];
            }
          }
        }

        if (existingBook) {
          const statusText = existingBook.status === 'completed'
            ? 'Okundu'
            : existingBook.status === 'reading'
            ? `Okunuyor (Sayfa ${existingBook.current_page} / ${existingBook.total_pages})`
            : 'İstek Listesi';

          return NextResponse.json({
            success: false,
            is_duplicate: true,
            existing_book: existingBook,
            error: `"${existingBook.title}" adlı kitap zaten kütüphanenizde mevcut (${statusText} • Raf: ${existingBook.shelf_location || 'Belirtilmemiş'}). İkinci kopya olarak eklemek isterseniz lütfen onaylayın.`
          }, { status: 409 });
        }
      }

      const rawTotal = parseInt(total_pages, 10);
      const total = Number.isFinite(rawTotal) && rawTotal >= 1 ? rawTotal : 200;
      const rawCurr = parseInt(current_page, 10);
      let curr = Number.isFinite(rawCurr) ? Math.min(total, Math.max(0, rawCurr)) : 0;
      const bookStatus = status || (curr >= total ? 'completed' : curr > 0 ? 'reading' : 'wishlist');
      if (bookStatus === 'completed' && curr < total) {
        curr = total;
      }
      const rawWpp = parseInt(words_per_page, 10);
      const safeWpp = Number.isFinite(rawWpp) && rawWpp > 0 ? Math.max(50, Math.min(1000, rawWpp)) : 250;
      const rawRating = parseInt(rating, 10);
      const safeRating = Number.isFinite(rawRating) ? Math.max(1, Math.min(5, rawRating)) : 5;
      const bookId = `book-${Date.now()}`;

      await db.insert(books).values({
        id: bookId,
        title: cleanTitle,
        author: cleanAuthor,
        publisher: (typeof publisher === 'string' && publisher.trim()) ? publisher.trim() : 'Genel Yayıncı',
        total_pages: total,
        current_page: curr,
        status: bookStatus,
        format: format || 'physical',
        shelf_location: shelf_location || '',
        words_per_page: safeWpp,
        isbn: isbn || null,
        summary: summary || null,
        cover_url: body.cover_url || null,
        rating: safeRating,
        category: category || 'Kişisel Gelişim',
        purchased_date: body.purchased_date || null,
        purchased_from: body.purchased_from || null,
        purchase_price: parsedPurchasePrice,
        start_date: body.start_date || (curr > 0 ? todayTr : null),
        finish_date: body.finish_date || (bookStatus === 'completed' ? todayTr : null),
        notes: body.notes || null,
        is_lent_out: is_lent_out ? 1 : 0,
        lent_to_name: is_lent_out ? (lent_to_name || null) : null,
        lent_date: is_lent_out ? (lent_date || todayTr) : null,
        is_family_shared: 1,
        user_id: user.id,
        family_id: familyId,
        created_at: now,
        updated_at: now,
        sync_status: 'synced',
        device_id: 'mac-local'
      });

      return NextResponse.json({
        success: true,
        message: `📚 "${cleanTitle}" (${format === 'physical' ? `Fiziki • ${shelf_location || 'Genel Raf'}` : format === 'ebook' ? 'E-Kitap (Kindle)' : 'Sesli Kitap'}) kütüphanenize eklendi!`
      });
    }

    const checkBookAuth = async (bId: string) => {
      const condition = and(
        eq(books.id, bId),
        getVisibleBooksCondition(user.id, familyId)
      );
      const res = await db.select().from(books).where(condition).limit(1);
      return res[0] || null;
    };

    // 2. Emanet Durumu Değiştirme
    if (action === 'toggle_lent') {
      if (!book_id) return NextResponse.json({ success: false, error: 'Kitap ID gereklidir.' }, { status: 400 });
      const targetBook = await checkBookAuth(book_id);
      if (!targetBook) {
        return NextResponse.json({ success: false, error: 'Kitap bulunamadı veya bu işlem için yetkiniz yok.' }, { status: 403 });
      }

      await db.update(books)
        .set({
          is_lent_out: is_lent_out ? 1 : 0,
          lent_to_name: is_lent_out ? (lent_to_name || null) : null,
          lent_date: is_lent_out ? (lent_date || todayTr) : null,
          updated_at: now
        })
        .where(eq(books.id, book_id));

      return NextResponse.json({
        success: true,
        message: is_lent_out ? `🤝 Kitap "${lent_to_name}" adlı kişiye emanet verildi olarak işaretlendi.` : '✅ Kitap emanetten teslim alındı.'
      });
    }

    // 3. Kitap Detaylarını Tam Güncelleme
    if (action === 'update_details') {
      if (!book_id) {
        return NextResponse.json({ success: false, error: 'Kitap ID gereklidir.' }, { status: 400 });
      }
      const targetBook = await checkBookAuth(book_id);
      if (!targetBook) {
        return NextResponse.json({ success: false, error: 'Kitap bulunamadı veya bu işlem için yetkiniz yok.' }, { status: 403 });
      }

      if (title !== undefined && (!title || typeof title !== 'string' || !title.trim())) {
        return NextResponse.json({ success: false, error: 'Kitap adı boş olamaz.' }, { status: 400 });
      }
      if (body.cover_url && typeof body.cover_url === 'string' && !isSafeCoverUrl(body.cover_url)) {
        return NextResponse.json({ success: false, error: 'Geçersiz kapak görseli bağlantısı.' }, { status: 400 });
      }

      let parsedPurchasePrice: number | null = targetBook.purchase_price ?? null;
      if (body.purchase_price !== undefined) {
        if (body.purchase_price === null || body.purchase_price === '') {
          parsedPurchasePrice = null;
        } else {
          const numPrice = Number(body.purchase_price);
          if (!Number.isFinite(numPrice) || numPrice < 0) {
            return NextResponse.json({ success: false, error: 'Alım fiyatı geçersiz.' }, { status: 400 });
          }
          parsedPurchasePrice = numPrice;
        }
      }

      const rawTotal = total_pages !== undefined && total_pages !== '' ? parseInt(total_pages, 10) : targetBook.total_pages;
      const total = Number.isFinite(rawTotal) && rawTotal >= 1 ? rawTotal : (targetBook.total_pages > 0 ? targetBook.total_pages : 200);
      const rawCurr = current_page !== undefined && current_page !== '' ? parseInt(current_page, 10) : targetBook.current_page;
      let curr = Number.isFinite(rawCurr) ? Math.min(total, Math.max(0, rawCurr)) : 0;

      const bookStatus = status || (curr >= total ? 'completed' : curr > 0 ? 'reading' : 'wishlist');
      if (bookStatus === 'completed' && curr < total) {
        curr = total;
      }

      const rawRating = rating !== undefined && rating !== '' ? parseInt(rating, 10) : (targetBook.rating ?? 5);
      const safeRating = Number.isFinite(rawRating) ? Math.max(1, Math.min(5, rawRating)) : 5;

      let safeWpp: number | undefined = undefined;
      if (body.words_per_page !== undefined && body.words_per_page !== '') {
        const parsedWpp = parseInt(body.words_per_page, 10);
        if (Number.isFinite(parsedWpp) && parsedWpp > 0) {
          safeWpp = Math.max(50, Math.min(1000, parsedWpp));
        }
      }

      await db.update(books)
        .set({
          title: title ? title.trim() : undefined,
          author: author !== undefined ? (author.trim() || 'Bilinmeyen Yazar') : undefined,
          publisher: publisher !== undefined ? publisher.trim() : undefined,
          category: category || undefined,
          status: bookStatus,
          total_pages: total,
          current_page: curr,
          format: format || 'physical',
          shelf_location: shelf_location || '',
          rating: safeRating,
          words_per_page: safeWpp,
          cover_url: body.cover_url !== undefined ? (body.cover_url || null) : undefined,
          purchased_date: body.purchased_date || null,
          purchased_from: body.purchased_from || null,
          purchase_price: parsedPurchasePrice,
          start_date: body.start_date || null,
          finish_date: body.finish_date || (bookStatus === 'completed' ? (targetBook.finish_date || todayTr) : null),
          notes: body.notes || null,
          is_lent_out: is_lent_out ? 1 : 0,
          lent_to_name: is_lent_out ? (lent_to_name || null) : null,
          lent_date: is_lent_out ? (lent_date || todayTr) : null,
          updated_at: now
        })
        .where(eq(books.id, book_id));

      return NextResponse.json({
        success: true,
        message: `✅ "${title ? title.trim() : targetBook.title}" detayları ve notları başarıyla güncellendi!`
      });
    }

    // 4. Sayfa Kelime Yoğunluğu Kalibrasyon Güncellemesi
    if (action === 'update_words_per_page') {
      if (!book_id) {
        return NextResponse.json({ success: false, error: 'Kitap ID gereklidir.' }, { status: 400 });
      }
      const targetBook = await checkBookAuth(book_id);
      if (!targetBook) {
        return NextResponse.json({ success: false, error: 'Kitap bulunamadı veya bu işlem için yetkiniz yok.' }, { status: 403 });
      }

      const rawWpp = parseInt(body.words_per_page, 10);
      if (!Number.isFinite(rawWpp) || rawWpp <= 0) {
        return NextResponse.json({ success: false, error: 'Geçerli bir kelime/sayfa sayısı giriniz.' }, { status: 400 });
      }
      const wpp = Math.max(50, Math.min(1000, rawWpp));
      await db.update(books)
        .set({
          words_per_page: wpp,
          updated_at: now
        })
        .where(eq(books.id, book_id));

      return NextResponse.json({
        success: true,
        words_per_page: wpp,
        message: `🎯 Kitabın sayfa yoğunluğu ${wpp} kelime/sayfa olarak kalibre edildi!`
      });
    }

    // 4.5. Hedef Bitiş Tarihi Güncelleme (Okuma Bitiş Simülatörü)
    if (action === 'update_target_date') {
      if (!book_id) {
        return NextResponse.json({ success: false, error: 'Kitap ID gereklidir.' }, { status: 400 });
      }
      const targetBook = await checkBookAuth(book_id);
      if (!targetBook) {
        return NextResponse.json({ success: false, error: 'Kitap bulunamadı veya bu işlem için yetkiniz yok.' }, { status: 403 });
      }
      const rawDate = typeof body.target_finish_date === 'string' ? body.target_finish_date.trim() : '';
      const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : null;
      await db.update(books)
        .set({ target_finish_date: safeDate, updated_at: now })
        .where(eq(books.id, book_id));
      return NextResponse.json({
        success: true,
        target_finish_date: safeDate,
        message: safeDate ? `🎯 Hedef bitiş tarihi ${safeDate} olarak kaydedildi.` : '🎯 Hedef bitiş tarihi temizlendi.'
      });
    }

    // 4.6. Goodreads CSV Toplu İçe Aktarma (Önizleme-Onay Sonrası)
    if (action === 'import_goodreads_batch') {
      const incomingBooks = Array.isArray(body.books) ? body.books : [];
      if (incomingBooks.length === 0) {
        return NextResponse.json({ success: false, error: 'Aktarılacak kitap listesi boş.' }, { status: 400 });
      }
      let insertedCount = 0;
      for (const item of incomingBooks.slice(0, 200)) {
        const cleanTitle = typeof item.title === 'string' ? item.title.trim() : '';
        if (!cleanTitle) continue;
        const cleanAuthor = typeof item.author === 'string' && item.author.trim() ? item.author.trim() : 'Bilinmeyen Yazar';
        const total = Math.max(1, parseInt(item.total_pages, 10) || 200);
        const st = item.status === 'completed' || item.status === 'reading' ? item.status : 'wishlist';
        const curr = st === 'completed' ? total : 0;
        const ratingVal = Math.max(1, Math.min(5, parseInt(item.rating, 10) || 5));

        await db.insert(books).values({
          id: `book-gr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: cleanTitle,
          author: cleanAuthor,
          publisher: 'Goodreads İçe Aktarım',
          total_pages: total,
          current_page: curr,
          status: st,
          format: 'physical',
          shelf_location: 'Goodreads',
          words_per_page: 250,
          isbn: typeof item.isbn === 'string' && item.isbn.trim() ? item.isbn.trim() : null,
          rating: ratingVal,
          category: 'Kişisel Gelişim',
          start_date: curr > 0 ? todayTr : null,
          finish_date: st === 'completed' ? todayTr : null,
          is_lent_out: 0,
          is_family_shared: 1,
          user_id: user.id,
          family_id: familyId,
          created_at: now,
          updated_at: now,
          sync_status: 'synced',
          device_id: 'web-client'
        });
        insertedCount++;
      }
      return NextResponse.json({
        success: true,
        message: `📚 ${insertedCount} kitap Goodreads CSV üzerinden kütüphanenize eklendi!`
      });
    }

    // 5. Hızlı Sayfa Güncelleme
    if (!book_id || current_page === undefined || current_page === null || current_page === '') {
      return NextResponse.json({ success: false, error: 'Kitap ID ve sayfa sayısı gereklidir.' }, { status: 400 });
    }

    const parsedPage = Number(current_page);
    if (!Number.isFinite(parsedPage)) {
      return NextResponse.json({ success: false, error: 'Geçerli bir sayfa sayısı gereklidir.' }, { status: 400 });
    }

    const targetBook = await checkBookAuth(book_id);
    if (!targetBook) {
      return NextResponse.json({ success: false, error: 'Kitap bulunamadı veya bu işlem için yetkiniz yok.' }, { status: 403 });
    }

    const newPage = targetBook.total_pages > 0
      ? Math.min(targetBook.total_pages, Math.max(0, Math.round(parsedPage)))
      : Math.max(0, Math.round(parsedPage));
    const newStatus = targetBook.total_pages > 0 && newPage >= targetBook.total_pages
      ? 'completed'
      : newPage > 0
      ? 'reading'
      : (targetBook.status === 'wishlist' ? 'wishlist' : 'reading');

    await db.update(books)
      .set({ 
        current_page: newPage, 
        status: newStatus,
        start_date: targetBook.start_date || (newPage > 0 ? todayTr : null),
        finish_date: newStatus === 'completed' ? (targetBook.finish_date || todayTr) : null,
        updated_at: now 
      })
      .where(eq(books.id, book_id));

    return NextResponse.json({
      success: true,
      message: newStatus === 'completed' 
        ? `🏆 Tebrikler! "${targetBook.title}" kitabını tamamladınız!` 
        : `📖 "${targetBook.title}" ${newPage}. sayfaya güncellendi!`
    });
  } catch (error: any) {
    console.error('Update Book Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url, 'http://localhost');
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Kitap ID gereklidir.' }, { status: 400 });
    }

    const familyId = user.family_id || `fam-${user.id}`;
    const isFamilyAdmin = user.is_master_account === 1 || user.role === 'admin';
    const bookCondition = and(
      eq(books.id, id),
      isFamilyAdmin
        ? or(eq(books.user_id, user.id), and(eq(books.family_id, familyId), eq(books.is_family_shared, 1)))
        : eq(books.user_id, user.id)
    );

    const targetBook = (await db.select().from(books).where(bookCondition).limit(1))[0];
    if (!targetBook) {
      return NextResponse.json({ success: false, error: 'Kitap bulunamadı veya silme yetkiniz yok.' }, { status: 404 });
    }

    // 1. Kitaba ait alt ilişkili verileri cascade temizle (Foreign Key Constraint Violation önleme)
    await db.delete(readingSessions).where(eq(readingSessions.book_id, id));
    await db.delete(bookQuotes).where(eq(bookQuotes.book_id, id));

    // 2. Kitabı sil
    await db.delete(books).where(eq(books.id, id));

    return NextResponse.json({ success: true, message: '🗑️ Kitap kütüphaneden silindi.' });
  } catch (error: any) {
    console.error('Delete Book Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
