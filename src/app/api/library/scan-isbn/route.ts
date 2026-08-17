import { NextResponse } from 'next/server';
import { parseBookCoverOrISBNImage } from '@/lib/ai-vision';
import { getAuthUser } from '@/lib/auth';

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
  return raw.replace(/[^0-9X]/gi, '').trim();
}

// 1. KAYNAK: Google Books API
async function fetchFromGoogleBooks(cleanIsbn: string): Promise<BookSearchResult | null> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  const url = apiKey
    ? `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}&key=${apiKey}`
    : `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`;

  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) return null;
  const json = await res.json();
  if (json.items && json.items.length > 0) {
    const info = json.items[0].volumeInfo || {};
    if (info.title) {
      return {
        title: info.title,
        author: info.authors ? info.authors.join(', ') : '',
        publisher: info.publisher || '',
        total_pages: info.pageCount || 200,
        category: info.categories ? info.categories[0] : 'Kişisel Gelişim',
        summary: info.description || 'Google Books verisi.',
        cover_url: info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || null,
        source: 'Google Books API'
      };
    }
  }
  return null;
}

// 2. KAYNAK: Open Library API
async function fetchFromOpenLibrary(cleanIsbn: string): Promise<BookSearchResult | null> {
  const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) return null;
  const json = await res.json();
  const key = `ISBN:${cleanIsbn}`;
  if (json[key]) {
    const item = json[key];
    if (item.title) {
      return {
        title: item.title,
        author: item.authors ? item.authors.map((a: any) => a.name).join(', ') : '',
        publisher: item.publishers ? item.publishers.map((p: any) => p.name).join(', ') : '',
        total_pages: item.number_of_pages || 200,
        category: item.subjects ? item.subjects[0]?.name : 'Kişisel Gelişim',
        summary: 'Open Library açık veritabanı.',
        cover_url: item.cover?.medium || item.cover?.large || null,
        source: 'Open Library'
      };
    }
  }
  return null;
}

// 3. KAYNAK: DuckDuckGo HTML + Türkçe Kitabevleri (BKM Kitap, Kitapyurdu, D&R, İdefix)
async function fetchFromTurkishBookstores(cleanIsbn: string): Promise<BookSearchResult | null> {
  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent('ISBN ' + cleanIsbn)}`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8'
      }
    });

    if (!res.ok) return null;
    const html = await res.text();

    const titleRegex = /<title>(.*?)<\/title>/i;
    const titleMatch = html.match(titleRegex);

    if (titleMatch && titleMatch[1]) {
      const pageTitle = titleMatch[1];
      if (pageTitle.includes('Kitap') || pageTitle.includes('bkmkitap') || pageTitle.includes('dr.com.tr') || pageTitle.includes('kitapyurdu')) {
        const parts = pageTitle.split('-')[0].split('|')[0].trim();
        if (parts && !parts.includes('DuckDuckGo')) {
          return {
            title: parts,
            author: 'Türkçe Kitabevi Verisi',
            publisher: '',
            total_pages: 200,
            category: 'Kişisel Gelişim',
            summary: `Türkçe Kitabevi araması ile bulundu (ISBN: ${cleanIsbn}).`,
            cover_url: null,
            source: 'Türkçe Kitabevleri / DDG'
          };
        }
      }
    }
  } catch (e) {
    // Ignore DDG errors
  }
  return null;
}

// 4. KAYNAK: Gemini AI Canlı Arama / Grounding
async function fetchFromGeminiAI(cleanIsbn: string): Promise<BookSearchResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const promptText = `Sen uzman bir kütüphanecisin. ISBN numarası "${cleanIsbn}" olan kitabın tam adını, yazarını, yayınevini, sayfa sayısını ve 1 cümlelik özetini araştır ve SADECE geçerli bir JSON çıktısı ver:
{
  "title": "Kitap Tam Adı",
  "author": "Yazar Adı",
  "publisher": "Yayınevi Adı",
  "total_pages": 250,
  "category": "Kişisel Gelişim | Edebiyat / Roman | İş & Ekonomi | Felsefe | Tarih | Bilim & Teknoloji",
  "summary": "Kitap hakkında 1 cümlelik özet."
}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
        })
      }
    );

    if (response.ok) {
      const json = await response.json();
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const parsed = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
        if (parsed.title && parsed.title !== 'Kitap Tam Adı') {
          return {
            title: parsed.title,
            author: parsed.author || '',
            publisher: parsed.publisher || '',
            total_pages: Number(parsed.total_pages) || 200,
            category: parsed.category || 'Kişisel Gelişim',
            summary: parsed.summary || `Gemini AI araması ile bulundu (ISBN: ${cleanIsbn}).`,
            cover_url: null,
            source: 'Gemini AI'
          };
        }
      }
    }
  } catch (e) {
    // Ignore Gemini errors
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

    // 1. SEÇENEK: Kapak Fotoğrafından Okuma (2. Aşama)
    if (image_base64) {
      const visionResult = await parseBookCoverOrISBNImage(image_base64, mime_type || 'image/jpeg');

      if (!visionResult.title || visionResult.title === 'Taranan Kitap' || visionResult.title === 'Kitap Tam Adı') {
        return NextResponse.json({
          success: false,
          error: 'Görselden kitap başlığı okunamadı. Lütfen kapak fotoğrafının net olduğundan emin olun.'
        }, { status: 422 });
      }

      return NextResponse.json({
        success: true,
        data: {
          title: visionResult.title,
          author: visionResult.author || '',
          publisher: visionResult.publisher || '',
          isbn: visionResult.isbn || '',
          total_pages: visionResult.total_pages || 200,
          category: visionResult.category || 'Kişisel Gelişim',
          summary: visionResult.summary || ''
        },
        message: `📸 Kitap kapağından "${visionResult.title}" (${visionResult.author || 'Yazar'}) tanımlandı!`
      });
    }

    // 2. SEÇENEK: ISBN Barkod Sorgulama (4 Kademeli Motor)
    if (!isbn) {
      return NextResponse.json({ success: false, error: 'Lütfen geçerli bir ISBN veya Görsel yükleyin.' }, { status: 400 });
    }

    const cleanIsbn = cleanIsbnString(isbn);
    if (cleanIsbn.length < 9) {
      return NextResponse.json({ success: false, error: 'Geçersiz ISBN numarası.' }, { status: 400 });
    }

    // 1. Google Books Sorgula
    let book: BookSearchResult | null = await fetchFromGoogleBooks(cleanIsbn);

    // 2. Open Library Sorgula
    if (!book) {
      book = await fetchFromOpenLibrary(cleanIsbn);
    }

    // 3. Türkçe Kitabevleri Sorgula
    if (!book) {
      book = await fetchFromTurkishBookstores(cleanIsbn);
    }

    // 4. Gemini AI Sorgula
    if (!book) {
      book = await fetchFromGeminiAI(cleanIsbn);
    }

    if (book) {
      return NextResponse.json({
        success: true,
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
        message: `🔍 "${book.title}" (${book.source}) kaynağından başarıyla bulundu!`
      });
    }

    return NextResponse.json({
      success: false,
      error: `ISBN (${cleanIsbn}) veritabanında bulunamadı. Lütfen bilgileri manuel girin.`
    }, { status: 444 });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Sorgulama sırasında bir hata oluştu.' }, { status: 500 });
  }
}
