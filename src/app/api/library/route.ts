import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { books, userReadingProfile, readingSessions } from '@/db/schema';
import { eq, desc , or , and } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  try {
    initDatabase();
    const user = await getAuthUser();
    const userId = user?.id;

    const allBooks = userId
      ? db.select().from(books).where(or(eq(books.user_id, userId), eq(books.is_family_shared, 1))).orderBy(desc(books.created_at)).all()
      : [];
    const allSessions = db.select().from(readingSessions).all();
    const profile = (userId ? db.select().from(userReadingProfile).where(eq(userReadingProfile.user_id, userId)).limit(1).get() : null) || {
      yearly_target_books: allBooks.length > 0 ? 24 : 0,
      calibrated_avg_wpm: 0,
      avg_seconds_per_page: 0
    };

    const completedBooks = allBooks.filter(b => b.status === 'completed');

    // Her kitap için özel okuma seansları, hız (WPM) ve süre hesabı
    const booksWithStats = allBooks.map(b => {
      const bookSessions = allSessions.filter(s => s.book_id === b.id);
      const sessionCount = bookSessions.length;
      const totalPagesRead = bookSessions.reduce((acc, s) => acc + (s.pages_read || 0), 0);
      const totalDurationMinutes = bookSessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0);
      
      const wordsPerPage = b.words_per_page || 250;
      const totalWordsRead = totalPagesRead * wordsPerPage;

      let bookWpm: number | null = null;
      let avgMinutesPerPage: string | null = null;

      if (totalDurationMinutes > 0 && totalWordsRead > 0) {
        bookWpm = Math.round(totalWordsRead / totalDurationMinutes);
      }
      if (totalDurationMinutes > 0 && totalPagesRead > 0) {
        avgMinutesPerPage = (totalDurationMinutes / totalPagesRead).toFixed(1);
      }

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
          wpm: bookWpm || profile.calibrated_avg_wpm || 220,
          hasSessionData: bookWpm !== null,
          avgMinutesPerPage: avgMinutesPerPage || ((profile.avg_seconds_per_page || 84) / 60).toFixed(1)
        }
      };
    });

    const activeReadingBook = booksWithStats.find(b => b.status === 'reading') || booksWithStats[0];

    // Aktif okunan kitap için Kalan Süre (ETA) Hesabı (O kitabın özel hızı veya genel profil WPM'i ile)
    let activeBookETA = null;
    if (activeReadingBook && activeReadingBook.status === 'reading') {
      const remainingPages = Math.max(0, activeReadingBook.total_pages - activeReadingBook.current_page);
      const wordsPerPage = activeReadingBook.words_per_page || 250;
      const wpm = activeReadingBook.stats?.wpm || profile.calibrated_avg_wpm || 220;
      
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
          targetProgressPercent: Math.min(100, Math.round((completedBooks.length / profile.yearly_target_books) * 100)),
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
    initDatabase();
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

    // 1. Yeni Kitap Ekleme (Manuel veya Kamera / ISBN)
    if (action === 'create_book' || (title && !book_id && action !== 'update_details')) {
      const total = parseInt(total_pages) || 200;
      const curr = parseInt(current_page) || 0;
      const bookStatus = status || (curr >= total ? 'completed' : curr > 0 ? 'reading' : 'wishlist');
      const bookId = `book-${Date.now()}`;

      db.insert(books).values({
        id: bookId,
        title: title || 'Yeni Kitap',
        author: author || 'Bilinmeyen Yazar',
        publisher: publisher || 'Genel Yayıncı',
        total_pages: total,
        current_page: curr,
        status: bookStatus,
        format: format || 'physical',
        shelf_location: shelf_location || 'Salon Kitaplığı',
        words_per_page: parseInt(words_per_page) || 250,
        isbn: isbn || null,
        summary: summary || null,
        cover_url: body.cover_url || null,
        rating: parseInt(rating) || 5,
        category: category || 'Kişisel Gelişim',
        purchased_date: body.purchased_date || null,
        purchased_from: body.purchased_from || null,
        purchase_price: body.purchase_price ? parseFloat(body.purchase_price) : null,
        start_date: body.start_date || (curr > 0 ? now.split('T')[0] : null),
        finish_date: body.finish_date || (curr >= total ? now.split('T')[0] : null),
        notes: body.notes || null,
        is_lent_out: is_lent_out ? 1 : 0,
        lent_to_name: is_lent_out ? lent_to_name : null,
        lent_date: is_lent_out ? (lent_date || now.split('T')[0]) : null,
        is_family_shared: 1,
        created_at: now,
        updated_at: now,
        sync_status: 'synced',
        device_id: 'mac-local'
      }).run();

      return NextResponse.json({
        success: true,
        message: `📚 "${title}" (${format === 'physical' ? `Fiziki • ${shelf_location}` : format === 'ebook' ? 'E-Kitap (Kindle)' : 'Sesli Kitap'}) kütüphanenize eklendi!`
      });
    }

    // 2. Emanet Durumu Değiştirme
    if (action === 'toggle_lent') {
      db.update(books)
        .set({
          is_lent_out: is_lent_out ? 1 : 0,
          lent_to_name: is_lent_out ? lent_to_name : null,
          lent_date: is_lent_out ? (lent_date || now.split('T')[0]) : null,
          updated_at: now
        })
        .where(eq(books.id, book_id))
        .run();

      return NextResponse.json({
        success: true,
        message: is_lent_out ? `🤝 Kitap "${lent_to_name}" adlı kişiye emanet verildi olarak işaretlendi.` : '✅ Kitap emanetten teslim alındı.'
      });
    }

    // 3. Kitap Detaylarını Tam Güncelleme
    if (action === 'update_details' && book_id) {
      const total = parseInt(total_pages) || 200;
      const curr = parseInt(current_page) || 0;
      const bookStatus = status || (curr >= total ? 'completed' : curr > 0 ? 'reading' : 'wishlist');

      db.update(books)
        .set({
          title: title ? title.trim() : undefined,
          author: author ? author.trim() : undefined,
          publisher: publisher ? publisher.trim() : undefined,
          category: category || undefined,
          status: bookStatus,
          total_pages: total,
          current_page: curr,
          format: format || 'physical',
          shelf_location: shelf_location || 'Salon Kitaplığı',
          rating: rating !== undefined ? parseInt(rating) : 5,
          cover_url: body.cover_url || null,
          purchased_date: body.purchased_date || null,
          purchased_from: body.purchased_from || null,
          purchase_price: body.purchase_price ? parseFloat(body.purchase_price) : null,
          start_date: body.start_date || null,
          finish_date: body.finish_date || (bookStatus === 'completed' ? now.split('T')[0] : null),
          notes: body.notes || null,
          is_lent_out: is_lent_out ? 1 : 0,
          lent_to_name: is_lent_out ? lent_to_name : null,
          lent_date: is_lent_out ? (lent_date || now.split('T')[0]) : null,
          updated_at: now
        })
        .where(eq(books.id, book_id))
        .run();

      return NextResponse.json({
        success: true,
        message: `✅ "${title || 'Kitap'}" detayları ve notları başarıyla güncellendi!`
      });
    }

    // 4. Hızlı Sayfa Güncelleme
    if (!book_id || current_page === undefined) {
      return NextResponse.json({ success: false, error: 'Kitap ID ve sayfa sayısı gereklidir.' }, { status: 400 });
    }

    const targetBook = db.select().from(books).where(eq(books.id, book_id)).get();
    if (!targetBook) {
      return NextResponse.json({ success: false, error: 'Kitap bulunamadı.' }, { status: 404 });
    }

    const newPage = Math.min(targetBook.total_pages, Math.max(0, current_page));
    const newStatus = newPage >= targetBook.total_pages ? 'completed' : 'reading';

    db.update(books)
      .set({ 
        current_page: newPage, 
        status: newStatus,
        finish_date: newStatus === 'completed' ? (targetBook.finish_date || now.split('T')[0]) : targetBook.finish_date,
        updated_at: now 
      })
      .where(eq(books.id, book_id))
      .run();

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
    initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Kitap ID gereklidir.' }, { status: 400 });
    }

    db.delete(books).where(user.is_master_account === 1 ? eq(books.id, id) : and(eq(books.id, id), eq(books.user_id, user.id))).run();

    return NextResponse.json({ success: true, message: '🗑️ Kitap kütüphaneden silindi.' });
  } catch (error: any) {
    console.error('Delete Book Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
