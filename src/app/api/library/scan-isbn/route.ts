import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { books } from '@/db/schema';
import { eq, like } from 'drizzle-orm';
import { parseBookCoverOrISBNImage } from '@/lib/ai-vision';
import { getAuthUser } from '@/lib/auth';

export const maxDuration = 60;

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

    // 1. ÖNCELİK: Gemini AI Kütüphane & ISBN Bilgi Motoru (Anında ~400ms Yanıt)
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
  "category": "Kişisel Gelişim / Edebiyat / Tarih / Roman / Felsefe / Bilim",
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
            }),
            signal: AbortSignal.timeout(4000)
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

              if (parsedBook && parsedBook.title && parsedBook.title !== 'Bilinmeyen Kitap' && parsedBook.title.length > 1) {
                return NextResponse.json({
                  success: true,
                  data: {
                    title: parsedBook.title,
                    author: parsedBook.author || 'Bilinmeyen Yazar',
                    publisher: parsedBook.publisher || 'Genel Yayıncı',
                    total_pages: Number(parsedBook.total_pages) || 200,
                    isbn: rawIsbn,
                    category: parsedBook.category || 'Edebiyat / Roman',
                    format: 'physical',
                    shelf_location: 'Salon Kitaplığı',
                    words_per_page: 250,
                    summary: parsedBook.summary || `ISBN (${rawIsbn}) ile tanımlanan kitap.`,
                    cover_url: null
                  },
                  message: `📚 "${parsedBook.title}" (${parsedBook.author}) kitabı tanımlandı!`
                });
              }
            }
          }
        } catch (aiErr) {
          console.warn(`[Gemini ISBN ${modelName} Warning]:`, aiErr);
        }
      }
    }

    // 2. ALTERNATİF: Google Books API (Maks 1500ms Timeout)
    try {
      const gBooksRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${rawIsbn}`, {
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(1500)
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
                total_pages: info.pageCount || 200,
                isbn: rawIsbn,
                category: info.categories ? info.categories[0] : 'Kişisel Gelişim',
                format: 'physical',
                shelf_location: 'Salon Kitaplığı',
                words_per_page: 250,
                summary: info.description || `${info.title} - ${info.authors?.join(', ')}`,
                cover_url: info.imageLinks?.thumbnail?.replace('http:', 'https:') || null
              },
              message: `📚 "${info.title}" Google Books üzerinden tanımlandı!`
            });
          }
        }
      }
    } catch (gErr) {
      console.warn('Google Books API timeout/error');
    }

    // 3. ALTERNATİF: Open Library API (Maks 1500ms Timeout)
    try {
      const openLibRes = await fetch(`https://openlibrary.org/isbn/${rawIsbn}.json`, {
        headers: { 'User-Agent': 'SingularityLifeOS/2.1' },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(1500)
      });
      if (openLibRes.ok) {
        const bookData = await openLibRes.json();
        const coverUrl = bookData.covers?.[0]
          ? `https://covers.openlibrary.org/b/id/${bookData.covers[0]}-M.jpg`
          : null;

        return NextResponse.json({
          success: true,
          data: {
            title: bookData.title || 'Bilinmeyen Kitap',
            author: 'Bilinmeyen Yazar',
            publisher: bookData.publishers?.[0] || 'Genel Yayıncı',
            total_pages: bookData.number_of_pages || 200,
            isbn: rawIsbn,
            category: 'Kişisel Gelişim',
            format: 'physical',
            shelf_location: 'Salon Kitaplığı',
            words_per_page: 250,
            summary: bookData.description?.value || bookData.description || 'Açık kütüphane verisi.',
            cover_url: coverUrl
          },
          message: `📚 "${bookData.title}" OpenLibrary üzerinden tanımlandı!`
        });
      }
    } catch (apiErr) {
      console.warn('OpenLibrary API timeout/error');
    }

    // 4. Bulunamazsa Temiz Boş Form Doldurma
    return NextResponse.json({
      success: true,
      data: {
        title: '',
        author: '',
        publisher: '',
        total_pages: 200,
        isbn: rawIsbn,
        category: 'Kişisel Gelişim',
        format: 'physical',
        shelf_location: 'Salon Kitaplığı',
        words_per_page: 250,
        summary: `ISBN: ${rawIsbn}`,
        cover_url: null
      },
      message: `ℹ️ ISBN (${rawIsbn}) okundu. Lütfen kitap adı ve yazarını yazarak onaylayın.`
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
