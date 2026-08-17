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

    // 4. Gemini AI Kütüphane & ISBN Bilgi Tabanı Sorgusu (En Güvenilir & Hızlı Çözüm)
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const promptText = `Sen uzman bir kütüphaneci ve bibliyografya uzmanısın.
Aşağıdaki ISBN numarasına ait Türkçe veya uluslararası kitabın doğrulanmış resmi bilgilerini bul ve SADECE JSON formatında döndür:
ISBN: "${rawIsbn}"

JSON Şeması:
{
  "title": "Kitabın Tam Adı",
  "author": "Yazar Adı Soyadı",
  "publisher": "Yayınevi Adı",
  "total_pages": 250,
  "category": "Kişisel Gelişim / Edebiyat / Tarih / Bilim vb.",
  "summary": "Kitabın 2-3 cümlelik kısa ve etkileyici özeti"
}`;

      const MODELS_TO_TRY = ['gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-pro-latest'];
      for (const modelName of MODELS_TO_TRY) {
        try {
          const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: promptText }] }],
              generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
            })
          });

          if (aiRes.ok) {
            const aiData = await aiRes.json();
            const textOutput = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textOutput) {
              const cleanJson = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
              let parsedBook = JSON.parse(cleanJson);
              if (Array.isArray(parsedBook) && parsedBook.length > 0) {
                parsedBook = parsedBook[0];
              }

              if (parsedBook && parsedBook.title && parsedBook.title !== 'Bilinmeyen Kitap') {
                return NextResponse.json({
                  success: true,
                  data: {
                    title: parsedBook.title,
                    author: parsedBook.author || 'Bilinmeyen Yazar',
                    publisher: parsedBook.publisher || 'Genel Yayıncı',
                    total_pages: Number(parsedBook.total_pages) || 250,
                    isbn: rawIsbn,
                    category: parsedBook.category || 'Kişisel Gelişim',
                    format: 'physical',
                    shelf_location: 'Salon Kitaplığı',
                    words_per_page: 250,
                    summary: parsedBook.summary || `ISBN (${rawIsbn}) ile tanımlanan kitap.`,
                    cover_url: null
                  },
                  message: `📚 "${parsedBook.title}" kitabı ISBN üzerinden başarıyla tanımlandı!`
                });
              }
            }
          }
        } catch (aiErr) {
          console.warn(`[Gemini ISBN ${modelName} Error]:`, aiErr);
        }
      }
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
