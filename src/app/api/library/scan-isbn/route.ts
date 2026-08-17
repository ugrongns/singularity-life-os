import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { books } from '@/db/schema';
import { eq, like } from 'drizzle-orm';
import { parseBookCoverOrISBNImage } from '@/lib/ai-vision';
import { getAuthUser } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    initDatabase();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 });
    }

    const body = await req.json();
    const { isbn_text, image_base64, mime_type } = body;

    const rawIsbn = (isbn_text || '').replace(/[^0-9X]/gi, '');

    // 0. VERİTABANINDA MEVCUT KİTAP KONTROLÜ (ISBN İle)
    if (rawIsbn) {
      const existingByIsbn = (await db.select().from(books).where(eq(books.isbn, rawIsbn)))[0];
      if (existingByIsbn) {
        return NextResponse.json({
          success: true,
          is_already_in_library: true,
          existing_book: existingByIsbn,
          data: {
            title: existingByIsbn.title,
            author: existingByIsbn.author,
            publisher: existingByIsbn.publisher || '',
            total_pages: existingByIsbn.total_pages,
            isbn: existingByIsbn.isbn,
            category: existingByIsbn.category || 'Kişisel Gelişim',
            format: existingByIsbn.format || 'physical',
            shelf_location: existingByIsbn.shelf_location || 'Salon Kitaplığı',
            words_per_page: existingByIsbn.words_per_page || 250,
            summary: existingByIsbn.summary || '',
            cover_url: existingByIsbn.cover_url || null
          },
          message: `📚 "${existingByIsbn.title}" kitabı kütüphanenizde zaten mevcut!`
        });
      }
    }

    // 1. EĞER GÖRSEL YÜKLENDİYSE GERÇEK GEMINI AI VISION İLE TARAMA YAP
    if (image_base64) {
      const visionResult = await parseBookCoverOrISBNImage(image_base64, mime_type || 'image/jpeg');

      if (visionResult.title) {
        const existingByTitle = (await db.select().from(books).where(like(books.title, `%${visionResult.title.trim()}%`)))[0];
        if (existingByTitle) {
          return NextResponse.json({
            success: true,
            is_already_in_library: true,
            existing_book: existingByTitle,
            data: visionResult,
            message: `📚 "${existingByTitle.title}" kitabı kütüphanenizde zaten mevcut!`
          });
        }
      }

      return NextResponse.json({
        success: true,
        is_already_in_library: false,
        data: visionResult
      });
    }

    if (!rawIsbn && !image_base64) {
      return NextResponse.json({ success: false, error: 'Lütfen geçerli bir ISBN numarası veya görsel sağlayın.' }, { status: 400 });
    }

    // 1. Open Library Direct ISBN API Sorgusu (En Hızlı Ve Kapsamlı)
    try {
      const openLibRes = await fetch(`https://openlibrary.org/isbn/${rawIsbn}.json`, {
        headers: { 'User-Agent': 'SingularityLifeOS/2.1' },
        next: { revalidate: 3600 }
      });
      if (openLibRes.ok) {
        const bookData = await openLibRes.json();
        let authorName = 'Bilinmeyen Yazar';

        // Yazar adını çek
        if (bookData.authors && bookData.authors[0]?.key) {
          try {
            const authorRes = await fetch(`https://openlibrary.org${bookData.authors[0].key}.json`);
            if (authorRes.ok) {
              const authorData = await authorRes.json();
              if (authorData.name) authorName = authorData.name;
            }
          } catch (e) {}
        }

        const coverUrl = bookData.covers?.[0]
          ? `https://covers.openlibrary.org/b/id/${bookData.covers[0]}-M.jpg`
          : null;

        return NextResponse.json({
          success: true,
          data: {
            title: bookData.title || 'Bilinmeyen Kitap',
            author: authorName,
            publisher: bookData.publishers?.[0] || 'Genel Yayıncı',
            total_pages: bookData.number_of_pages || 250,
            isbn: rawIsbn,
            category: 'Kişisel Gelişim',
            format: 'physical',
            shelf_location: 'Salon Kitaplığı',
            words_per_page: 250,
            summary: bookData.description?.value || bookData.description || 'Açık kütüphane verisinden çekilen kitap.',
            cover_url: coverUrl
          }
        });
      }
    } catch (apiErr) {
      console.warn('OpenLibrary direct fetch failed:', apiErr);
    }

    // 2. Google Books API (Geniş Türkçe ve Uluslararası Kütüphane İndeksi)
    try {
      const gBooksRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${rawIsbn}`, {
        next: { revalidate: 3600 }
      });
      if (gBooksRes.ok) {
        const gData = await gBooksRes.json();
        if (gData.items && gData.items.length > 0) {
          const info = gData.items[0].volumeInfo;
          if (info && info.title) {
            return NextResponse.json({
              success: true,
              data: {
                title: info.title,
                author: info.authors ? info.authors.join(', ') : 'Bilinmeyen Yazar',
                publisher: info.publisher || 'Genel Yayıncı',
                total_pages: info.pageCount || 250,
                isbn: rawIsbn,
                category: info.categories ? info.categories[0] : 'Kişisel Gelişim',
                format: 'physical',
                shelf_location: 'Salon Kitaplığı',
                words_per_page: 250,
                summary: info.description || `${info.title} - ${info.authors?.join(', ')}`,
                cover_url: info.imageLinks?.thumbnail?.replace('http:', 'https:') || null
              }
            });
          }
        }
      }
    } catch (gErr) {
      console.warn('Google Books API lookup error:', gErr);
    }

    // 3. Open Library Secondary API Sorgusu
    try {
      const openLibRes = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${rawIsbn}&jscmd=data&format=json`, {
        headers: { 'User-Agent': 'SingularityLifeOS/2.1' },
        next: { revalidate: 3600 }
      });
      const openLibData = await openLibRes.json();
      const bookKey = `ISBN:${rawIsbn}`;

      if (openLibData[bookKey]) {
        const b = openLibData[bookKey];
        return NextResponse.json({
          success: true,
          data: {
            title: b.title || 'Bilinmeyen Kitap',
            author: b.authors?.[0]?.name || 'Bilinmeyen Yazar',
            publisher: b.publishers?.[0]?.name || 'Genel Yayıncı',
            total_pages: b.number_of_pages || 250,
            isbn: rawIsbn,
            category: 'Kişisel Gelişim',
            format: 'physical',
            shelf_location: 'Salon Kitaplığı',
            words_per_page: 250,
            summary: b.notes || 'Kitap açıklaması',
            cover_url: b.cover?.medium || null
          }
        });
      }
    } catch (apiErr) {
      console.warn('OpenLibrary fallback fetch failed:', apiErr);
    }

    // 4. DuckDuckGo Web Araması (Türkçe Kitaplar İçin)
    try {
      const searchRes = await fetch(`https://html.duckduckgo.com/html/?q=${rawIsbn}+kitap`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      if (searchRes.ok) {
        const html = await searchRes.text();
        const titleRegex = /<a[^>]*class="[^"]*result__title[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
        const matches = [...html.matchAll(titleRegex)];
        if (matches && matches.length > 0) {
          const rawSnippet = matches[0][1] || '';
          let cleanText = rawSnippet
            .replace(/<[^>]+>/g, '')
            .replace(/^[^>]*>/, '')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&quot;/gi, '"')
            .replace(/&#39;/gi, "'")
            .replace(/[\r\n\t]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

          cleanText = cleanText.replace(/DuckDuckGo|satın al|fiyatı|bkmkitap|kitapyurdu|idefix|trendyol|hepsiburada|amazon|kitap/gi, '').trim();

          const parts = cleanText.split(/[-–—/|:]/).map(p => p.trim().replace(/^class="[^"]*">/, '')).filter(Boolean);
          if (parts.length > 0 && parts[0].length >= 2) {
            const detectedTitle = parts[0].replace(/^[^a-zA-Z0-9ÇĞİÖŞÜçğıöşü]+/, '').trim();
            const detectedAuthor = (parts[1] || 'Bilinmeyen Yazar').replace(/^[^a-zA-Z0-9ÇĞİÖŞÜçğıöşü]+/, '').trim();

            if (detectedTitle && detectedTitle.length >= 2) {
              return NextResponse.json({
                success: true,
                data: {
                  title: detectedTitle,
                  author: detectedAuthor || 'Bilinmeyen Yazar',
                  publisher: 'Türkçe Yayıncı',
                  total_pages: 240,
                  isbn: rawIsbn,
                  category: 'Kişisel Gelişim',
                  format: 'physical',
                  shelf_location: 'Salon Kitaplığı',
                  words_per_page: 250,
                  summary: `İnternet aramasından otomatik tanımlanan kitap (ISBN: ${rawIsbn}).`,
                  cover_url: null
                }
              });
            }
          }
        }
      }
    } catch (webErr) {
      console.warn('Web search lookup failed:', webErr);
    }

    // 5. Nötr Varsayılan Doldurma (Kullanıcı Elle Temizlemek Zorunda Kalmasın)
    return NextResponse.json({
      success: true,
      data: {
        title: '',
        author: '',
        publisher: '',
        total_pages: 240,
        isbn: rawIsbn,
        category: 'Kişisel Gelişim',
        format: 'physical',
        shelf_location: 'Salon Kitaplığı',
        words_per_page: 250,
        summary: `Barkod algılandı (ISBN: ${rawIsbn}).`,
        cover_url: null
      },
      message: `ℹ️ ISBN (${rawIsbn}) barkodu okundu. Kitap açık kütüphane veritabanında bulunamadı, lütfen kitap adı ve yazarını girerek onaylayın.`
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
