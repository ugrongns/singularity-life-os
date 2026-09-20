import { NextResponse } from 'next/server';
import { parseBookCoverOrISBNImage } from '@/lib/ai-vision';
import { getAuthUser } from '@/lib/auth';
import { normalizeBookCategory } from '@/lib/book-categories';
import { db, initDatabase } from '@/db';
import { books } from '@/db/schema';
import { eq, or, and, sql } from 'drizzle-orm';

export const maxDuration = 60;

interface BookSearchResult {
  title: string;
  author: string;
  publisher: string;
  total_pages: number;
  category: string;
  summary: string;
  cover_url: string | null;
  source: string;
}

// ISBN Temizleme Yardımcısı
function cleanIsbnString(raw: string): string {
  return (raw || '').replace(/[^0-9X]/gi, '').trim();
}

// 📚 KULLANICININ MEVCUT KÜTÜPHANESİNDE MÜKERRER KİTAP ARAMA
async function findExistingBookInLibrary(
  userId: string,
  familyId: string,
  cleanIsbn?: string,
  title?: string,
  author?: string
) {
  try {
    await initDatabase();
    // 1. ISBN ile eşleşme
    if (cleanIsbn && cleanIsbn.length >= 9) {
      const byIsbn = await db.select().from(books).where(
        and(
          or(eq(books.user_id, userId), eq(books.family_id, familyId)),
          or(
            eq(books.isbn, cleanIsbn),
            sql`REPLACE(REPLACE(COALESCE(${books.isbn}, ''), '-', ''), ' ', '') = ${cleanIsbn}`
          )
        )
      ).limit(1);

      if (byIsbn && byIsbn.length > 0) return byIsbn[0];
    }

    // 2. Başlık ve Yazar ile eşleşme
    if (title && title.trim().length > 2) {
      const cleanTitle = title.trim();
      const byTitle = await db.select().from(books).where(
        and(
          or(eq(books.user_id, userId), eq(books.family_id, familyId)),
          sql`LOWER(TRIM(${books.title})) = LOWER(TRIM(${cleanTitle}))`
        )
      ).limit(1);

      if (byTitle && byTitle.length > 0) {
        if (!author || byTitle[0].author.toLowerCase().includes(author.toLowerCase().slice(0, 4))) {
          return byTitle[0];
        }
      }
    }
  } catch (err) {
    console.warn('findExistingBookInLibrary hatası:', err);
  }
  return null;
}

// 1. KAYNAK: Google Books API
async function fetchFromGoogleBooks(cleanIsbn: string): Promise<BookSearchResult | null> {
  try {
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
    const url = apiKey
      ? `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}&key=${apiKey}`
      : `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.items && json.items.length > 0) {
      const info = json.items[0].volumeInfo || {};
      if (info.title) {
        const rawCat = info.categories ? info.categories.join(' / ') : '';
        const resolvedCategory = normalizeBookCategory(rawCat, info.title, info.description);

        return {
          title: info.title,
          author: info.authors ? info.authors.join(', ') : '',
          publisher: info.publisher || '',
          total_pages: info.pageCount || 200,
          category: resolvedCategory,
          summary: info.description || '',
          cover_url: info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || null,
          source: 'Google Books API'
        };
      }
    }
  } catch (err) {
    console.warn('Google Books API fetch hatası:', err);
  }
  return null;
}

// 2. KAYNAK: Open Library API
async function fetchFromOpenLibrary(cleanIsbn: string): Promise<BookSearchResult | null> {
  try {
    const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return null;
    const json = await res.json();
    const key = `ISBN:${cleanIsbn}`;
    if (json[key]) {
      const item = json[key];
      if (item.title) {
        const rawSubject = item.subjects ? item.subjects.map((s: any) => s.name).join(' / ') : '';
        const resolvedCategory = normalizeBookCategory(rawSubject, item.title);

        return {
          title: item.title,
          author: item.authors ? item.authors.map((a: any) => a.name).join(', ') : '',
          publisher: item.publishers ? item.publishers.map((p: any) => p.name).join(', ') : '',
          total_pages: item.number_of_pages || 200,
          category: resolvedCategory,
          summary: '',
          cover_url: item.cover?.medium || item.cover?.large || null,
          source: 'Open Library'
        };
      }
    }
  } catch (err) {
    console.warn('Open Library fetch hatası:', err);
  }
  return null;
}

function extractJsonFromText(text: string): any {
  if (!text) return null;
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
  const raw = jsonMatch ? jsonMatch[1] : text;
  try {
    return JSON.parse(raw.trim());
  } catch (e) {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(text.slice(firstBrace, lastBrace + 1));
      } catch (err) {}
    }
  }
  return null;
}

// HTML Entity Çözümleyici Yardımcı
function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

// 3. KAYNAK: Gemini AI Canlı Arama / Google Search Grounding & Künye Analizi
async function fetchFromGeminiAI(
  cleanIsbn: string,
  seedTitle?: string,
  seedAuthor?: string,
  seedPublisher?: string
): Promise<BookSearchResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const contextHint = seedTitle ? ` (Kitap İpucu: "${seedTitle}" - ${seedAuthor || ''}, ${seedPublisher || ''})` : '';
  const promptText = `Sen uzman bir kütüphanecisin. ISBN numarası "${cleanIsbn}"${contextHint} olan kitabın Türkiye ve dünya kataloglarındaki (Kronik Kitap, Destek Yayınları, Can Yayınları, Yapı Kredi Kültür, İş Bankası, Kitapyurdu, D&R vb.) gerçek ve tam adını, yazarını, yayınevini, sayfa sayısını, açıklayıcı Türkçe arka kapak özetini (2-3 cümle) ve kitabın gerçek konusuna/türüne göre en doğru Türkçe kategorisini (Örn: Tarih, Felsefe, Psikoloji, Bilim, Kişisel Gelişim, Kurgu (Fiction), Beden, Zihin & Ruh, İş & Ekonomi, Din, Sosyal Bilimler, Tıp, Sanat, Teknoloji & Mühendislik vb.) araştır ve SADECE JSON formatında çıktı ver:
\`\`\`json
{
  "title": "Kitap Tam Adı",
  "author": "Yazar Adı",
  "publisher": "Yayınevi Adı",
  "total_pages": 250,
  "category": "Kitabın Gerçek Türkçe Kategorisi",
  "summary": "Kitabın konusu, anlattıkları ve arka kapak metni hakkında 2-3 cümlelik açıklayıcı Türkçe özet."
}
\`\`\``;

  const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
  for (const modelName of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: { temperature: 0.0 }
          }),
          signal: AbortSignal.timeout(8000)
        }
      );

      if (response.ok) {
        const json = await response.json();
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = extractJsonFromText(text);
          if (parsed && parsed.title && parsed.title !== 'Kitap Tam Adı' && parsed.title.length >= 2) {
            const resolvedCategory = normalizeBookCategory(parsed.category, parsed.title, parsed.summary);
            return {
              title: decodeHtmlEntities(parsed.title),
              author: decodeHtmlEntities((parsed.author || seedAuthor || '').replace(/Yazar Adı/i, '').trim()),
              publisher: decodeHtmlEntities((parsed.publisher || seedPublisher || '').replace(/Yayınevi Adı/i, '').trim()),
              total_pages: Number(parsed.total_pages) || 200,
              category: resolvedCategory,
              summary: decodeHtmlEntities(parsed.summary || ''),
              cover_url: null,
              source: 'Gemini AI'
            };
          }
        }
      }
    } catch (e) {
      // Continue to next model
    }
  }
  return null;
}

// 4. KAYNAK: DuckDuckGo HTML + Türkçe Kitabevleri (Gelişmiş Yedek Arama)
async function fetchFromTurkishBookstores(cleanIsbn: string): Promise<BookSearchResult | null> {
  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent('ISBN ' + cleanIsbn + ' kitap')}`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8'
      },
      signal: AbortSignal.timeout(5000)
    });

    if (!res.ok) return null;
    const html = await res.text();

    const headings = [...html.matchAll(/<h2 class="result__title">[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/gi)];
    const storePattern = /[\s\-_|–·•]*(BKM\s*Kitap|Bkmkitap|Kitapyurdu|D&R|İdefix|Idefix|Amazon|Hepsiburada|Trendyol|Nadir\s*Kitap|Nadirkitap|Palme\s*Kitabevi|Destek\s*Dükkan|Scala\s*Kitapçı|Kitapbulan|Kırmızı\s*Kedi|Pandora|Eganba|Pelikan\s*Kitabevi|Kidega|OdaKitap|Kitap365|Hugendubel[\s\S]*)[\s\S]*/gi;

    for (const match of headings) {
      let rawTitle = decodeHtmlEntities(match[1].replace(/<[^>]+>/g, '').trim());
      if (rawTitle && !rawTitle.toLowerCase().includes('duckduckgo') && rawTitle.length > 3) {
        let cleaned = rawTitle
          .replace(/^Amazon\.[a-z.]+\s*:\s*/i, '')
          .replace(/:\s*Books$/i, '')
          .replace(/:\s*Kitaplar$/i, '')
          .replace(storePattern, '')
          .replace(/\s*\.\.\.\s*$/, '')
          .trim();

        if (!cleaned || cleaned.length < 2) continue;

        let title = cleaned;
        let author = '';
        let publisher = '';

        if (cleaned.includes('/')) {
          const parts = cleaned.split('/').map(p => p.trim());
          if (parts.length >= 2) {
            title = parts[0];
            author = parts[1];
          }
        } else if (cleaned.includes('-')) {
          const parts = cleaned.split('-').map(p => p.trim());
          if (parts.length >= 2) {
            title = parts[0];
            author = parts[1];
          }
        }

        const pubMatch = title.match(/^(Destek Yayınları|Kronik Kitap|Can Yayınları|Yapı Kredi Yayınları|İş Bankası Kültür Yayınları|İletişim Yayınları|Everest Yayınları|Doğan Kitap|Pegasus Yayınları|İthaki Yayınları)\s+(.*)/i);
        if (pubMatch) {
          publisher = pubMatch[1];
          title = pubMatch[2];
        }

        if (title && title.length >= 2) {
          const resolvedCategory = normalizeBookCategory('', title);
          return {
            title: title.trim(),
            author: author.trim(),
            publisher: publisher.trim(),
            total_pages: 248,
            category: resolvedCategory,
            summary: `${title}${author ? ' - ' + author : ''} hakkında Türkçe katalog kaydı.`,
            cover_url: null,
            source: 'Türkçe Kitap Ağı'
          };
        }
      }
    }
  } catch (e) {
    console.warn('Turkish bookstore parser error:', e);
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 });
    }

    const body = await req.json();
    const { isbn, image_base64, mime_type } = body;

    const familyId = user.family_id || `fam-${user.id}`;

    // 1. SEÇENEK: Kapak Fotoğrafından Okuma (2. Aşama)
    if (image_base64) {
      const visionResult = await parseBookCoverOrISBNImage(image_base64, mime_type || 'image/jpeg');

      if (!visionResult.title || visionResult.title === 'Taranan Kitap' || visionResult.title === 'Kitap Tam Adı') {
        return NextResponse.json({
          success: false,
          error: 'Görselden kitap başlığı okunamadı. Lütfen kapak fotoğrafının net olduğundan emin olun.'
        }, { status: 422 });
      }

      const cleanVisionIsbn = cleanIsbnString(visionResult.isbn || '');
      const existingInLibrary = await findExistingBookInLibrary(user.id, familyId, cleanVisionIsbn, visionResult.title, visionResult.author);

      return NextResponse.json({
        success: true,
        already_in_library: !!existingInLibrary,
        existing_book: existingInLibrary || null,
        data: {
          title: visionResult.title,
          author: visionResult.author || '',
          publisher: visionResult.publisher || '',
          isbn: visionResult.isbn || '',
          total_pages: visionResult.total_pages || 200,
          category: visionResult.category || 'Kurgu (Fiction)',
          summary: visionResult.summary || ''
        },
        message: existingInLibrary
          ? `⚠️ Bu kitap kütüphanenizde zaten kayıtlı: "${existingInLibrary.title}"`
          : `📸 Kitap kapağından "${visionResult.title}" (${visionResult.author || 'Yazar'}) tanımlandı!`
      });
    }

    // 2. SEÇENEK: ISBN Barkod Sorgulama (Hibrit Akıllı Birleştirme Motoru)
    if (!isbn) {
      return NextResponse.json({ success: false, error: 'Lütfen geçerli bir ISBN veya Görsel yükleyin.' }, { status: 400 });
    }

    const cleanIsbn = cleanIsbnString(isbn);
    if (cleanIsbn.length < 9) {
      return NextResponse.json({ success: false, error: 'Geçersiz ISBN numarası.' }, { status: 400 });
    }

    // Kullanıcının kendi kütüphanesinde mükerrer kontrolü
    const existingInLibrary = await findExistingBookInLibrary(user.id, familyId, cleanIsbn);

    // 1. Aşama: Dış Katalogları Sorgula (Google Books & Open Library -> Kapak resmi, sayfa sayısı ve temel künye)
    let catalogBook: BookSearchResult | null = await fetchFromGoogleBooks(cleanIsbn);
    if (!catalogBook) {
      catalogBook = await fetchFromOpenLibrary(cleanIsbn);
    }

    // 2. Aşama: Gemini AI ile Canlı Künye, Zengin Türkçe Özet ve Derinlemesine Kategori Analizi Yap
    const geminiBook = await fetchFromGeminiAI(
      cleanIsbn,
      catalogBook?.title,
      catalogBook?.author,
      catalogBook?.publisher
    );

    let book: BookSearchResult | null = null;

    if (geminiBook && catalogBook) {
      // Hibrit Birleştirme (Smart Fusion): Kapak görseli ve kesin sayfa sayısı katalogdan, zengin Türkçe özet ve doğru edebi kategori Gemini'dan
      book = {
        title: geminiBook.title || catalogBook.title,
        author: geminiBook.author || catalogBook.author,
        publisher: geminiBook.publisher || catalogBook.publisher,
        total_pages: catalogBook.total_pages > 0 ? catalogBook.total_pages : geminiBook.total_pages,
        category: geminiBook.category || catalogBook.category,
        summary: geminiBook.summary || catalogBook.summary || '',
        cover_url: catalogBook.cover_url || geminiBook.cover_url || null,
        source: `${catalogBook.source} + Gemini AI Fusion`
      };
    } else if (geminiBook) {
      book = geminiBook;
    } else if (catalogBook) {
      book = catalogBook;
    } else {
      // 3. Aşama: Yedek Türkçe Kitabevleri / Web Arama
      book = await fetchFromTurkishBookstores(cleanIsbn);
    }

    if (book) {
      return NextResponse.json({
        success: true,
        already_in_library: !!existingInLibrary,
        existing_book: existingInLibrary || null,
        data: {
          title: book.title,
          author: book.author,
          publisher: book.publisher,
          isbn: cleanIsbn,
          total_pages: book.total_pages,
          category: book.category,
          summary: book.summary,
          cover_url: book.cover_url || null
        },
        message: existingInLibrary
          ? `⚠️ Bu kitap kütüphanenizde zaten kayıtlı: "${existingInLibrary.title}"`
          : `🔍 "${book.title}" (${book.source}) kaynağından başarıyla bulundu!`
      });
    }

    // Dış kaynaklarda bulunamadıysa ama kullanıcının kütüphanesinde zaten kayıtlıysa
    if (existingInLibrary) {
      return NextResponse.json({
        success: true,
        already_in_library: true,
        existing_book: existingInLibrary,
        data: {
          title: existingInLibrary.title,
          author: existingInLibrary.author,
          publisher: existingInLibrary.publisher || '',
          isbn: cleanIsbn,
          total_pages: existingInLibrary.total_pages,
          category: existingInLibrary.category || 'Kişisel Gelişim',
          summary: existingInLibrary.summary || '',
          cover_url: existingInLibrary.cover_url || null
        },
        message: `⚠️ Bu kitap kütüphanenizde zaten kayıtlı: "${existingInLibrary.title}"`
      });
    }

    return NextResponse.json({
      success: false,
      error: `ISBN (${cleanIsbn}) veritabanında bulunamadı. Lütfen bilgileri manuel girin.`
    }, { status: 444 });

  } catch (error: any) {
    console.error('ISBN tarama genel hatası:', error);
    const isFetchFail = error?.message?.toLowerCase().includes('fetch failed') || error?.name === 'TypeError';
    const errorMsg = isFetchFail
      ? 'Dış katalog servisleri geçici olarak yanıt vermedi (bağlantı zaman aşımı). Lütfen birkaç saniye sonra tekrar deneyin veya kitap bilgilerini manuel girin.'
      : (error?.message || 'Sorgulama sırasında bir hata oluştu.');
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
