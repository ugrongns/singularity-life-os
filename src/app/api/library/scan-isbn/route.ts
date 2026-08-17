import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { books } from '@/db/schema';
import { eq, like } from 'drizzle-orm';
import { parseBookCoverOrISBNImage } from '@/lib/ai-vision';
import { getAuthUser } from '@/lib/auth';

export const maxDuration = 60;

type Provider = 'google_books' | 'open_library' | 'isbndb';
type ResolverStatus = 'FOUND' | 'NOT_FOUND' | 'TIMEOUT' | 'HTTP_ERROR' | 'RATE_LIMITED' | 'CONFIG' | 'INVALID' | 'ERROR';
type ResolverDiagnostic = { provider: Provider; status: ResolverStatus; http_status?: number; duration_ms: number; message?: string };
type BookData = {
  title: string;
  author: string;
  publisher: string;
  total_pages: number;
  isbn: string;
  category: string;
  format: 'physical';
  shelf_location: string;
  words_per_page: number;
  summary: string;
  cover_url: string | null;
  source: Provider;
};

function normalizeIsbn(value: string) {
  return (value || '').replace(/[^0-9X]/gi, '').toUpperCase();
}

function isValidIsbn(value: string) {
  const isbn = normalizeIsbn(value);
  if (/^\d{13}$/.test(isbn)) {
    let sum = 0;
    for (let i = 0; i < 13; i++) sum += Number(isbn[i]) * (i % 2 === 0 ? 1 : 3);
    return sum % 10 === 0;
  }
  if (/^\d{9}[\dX]$/.test(isbn)) {
    let sum = 0;
    for (let i = 0; i < 10; i++) sum += (isbn[i] === 'X' ? 10 : Number(isbn[i])) * (10 - i);
    return sum % 11 === 0;
  }
  return false;
}

function toIsbn13(value: string) {
  const isbn = normalizeIsbn(value);
  if (/^\d{13}$/.test(isbn)) return isbn;
  if (!/^\d{9}[\dX]$/.test(isbn)) return isbn;
  const core = `978${isbn.slice(0, 9)}`;
  let sum = 0;
  for (let i = 0; i < core.length; i++) sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3);
  return `${core}${(10 - (sum % 10)) % 10}`;
}

function normalizeCategory(categories?: string[]) {
  const raw = categories?.[0] || '';
  if (!raw) return 'Kişisel Gelişim';
  if (/fiction|novel|literature|roman/i.test(raw)) return 'Edebiyat / Roman';
  if (/business|econom|finance|management/i.test(raw)) return 'İş & Ekonomi';
  if (/philosophy/i.test(raw)) return 'Felsefe';
  if (/history/i.test(raw)) return 'Tarih';
  if (/science|technology|mathematics/i.test(raw)) return 'Bilim';
  return raw;
}

async function withTimeout<T>(factory: (signal: AbortSignal) => Promise<T>, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await factory(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function queryGoogleBooks(isbn: string): Promise<{ book: BookData | null; diagnostic: ResolverDiagnostic }> {
  const started = Date.now();
  try {
    const url = new URL('https://www.googleapis.com/books/v1/volumes');
    url.searchParams.set('q', `isbn:${isbn}`);
    url.searchParams.set('maxResults', '5');
    url.searchParams.set('printType', 'books');
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
    if (apiKey) url.searchParams.set('key', apiKey);

    const response = await withTimeout(signal => fetch(url.toString(), { headers: { Accept: 'application/json' }, cache: 'no-store', signal }), 5000);
    const duration = Date.now() - started;
    if (response.status === 429) return { book: null, diagnostic: { provider: 'google_books', status: 'RATE_LIMITED', http_status: 429, duration_ms: duration, message: 'Google Books rate limit.' } };
    if (!response.ok) return { book: null, diagnostic: { provider: 'google_books', status: 'HTTP_ERROR', http_status: response.status, duration_ms: duration, message: `HTTP ${response.status}` } };

    const data = await response.json();
    const item = (data.items || []).find((candidate: any) => {
      const ids = candidate.volumeInfo?.industryIdentifiers || [];
      return ids.some((id: any) => normalizeIsbn(id.identifier) === isbn || normalizeIsbn(id.identifier) === toIsbn13(isbn));
    }) || data.items?.[0];
    if (!item?.volumeInfo?.title) return { book: null, diagnostic: { provider: 'google_books', status: 'NOT_FOUND', http_status: response.status, duration_ms: duration, message: 'ISBN kayıtlı değil.' } };

    const info = item.volumeInfo;
    const ids = info.industryIdentifiers || [];
    const exactId = ids.find((id: any) => normalizeIsbn(id.identifier) === isbn || normalizeIsbn(id.identifier) === toIsbn13(isbn));
    return {
      book: {
        title: info.title,
        author: info.authors?.join(', ') || 'Bilinmeyen Yazar',
        publisher: info.publisher || '',
        total_pages: Number(info.pageCount) || 200,
        isbn: normalizeIsbn(exactId?.identifier || isbn),
        category: normalizeCategory(info.categories),
        format: 'physical',
        shelf_location: 'Salon Kitaplığı',
        words_per_page: 250,
        summary: info.description || `${info.title} - ${info.authors?.join(', ') || 'Bilinmeyen Yazar'}`,
        cover_url: info.imageLinks?.thumbnail?.replace(/^http:/, 'https:') || null,
        source: 'google_books'
      },
      diagnostic: { provider: 'google_books', status: 'FOUND', http_status: response.status, duration_ms: duration }
    };
  } catch (error: any) {
    const duration = Date.now() - started;
    const timedOut = error?.name === 'AbortError' || error?.name === 'TimeoutError';
    return { book: null, diagnostic: { provider: 'google_books', status: timedOut ? 'TIMEOUT' : 'ERROR', duration_ms: duration, message: timedOut ? '5s timeout' : (error?.message || 'Unknown error') } };
  }
}

async function queryOpenLibrary(isbn: string): Promise<{ book: BookData | null; diagnostic: ResolverDiagnostic }> {
  const started = Date.now();
  try {
    const url = new URL('https://openlibrary.org/search.json');
    url.searchParams.set('isbn', isbn);
    url.searchParams.set('limit', '1');
    url.searchParams.set('fields', 'title,author_name,publisher,number_of_pages_median,cover_i,isbn,subject,first_publish_year');

    const response = await withTimeout(signal => fetch(url.toString(), {
      headers: { Accept: 'application/json', 'User-Agent': 'SingularityLifeOS/2.2 (human-facing library ISBN lookup)' },
      cache: 'no-store',
      signal
    }), 5000);
    const duration = Date.now() - started;
    if (response.status === 429) return { book: null, diagnostic: { provider: 'open_library', status: 'RATE_LIMITED', http_status: 429, duration_ms: duration, message: 'Open Library rate limit.' } };
    if (!response.ok) return { book: null, diagnostic: { provider: 'open_library', status: 'HTTP_ERROR', http_status: response.status, duration_ms: duration, message: `HTTP ${response.status}` } };

    const data = await response.json();
    const doc = data.docs?.[0];
    if (!doc?.title) return { book: null, diagnostic: { provider: 'open_library', status: 'NOT_FOUND', http_status: response.status, duration_ms: duration, message: 'ISBN kayıtlı değil.' } };

    const identifiers = Array.isArray(doc.isbn) ? doc.isbn : [];
    const exactId = identifiers.find((id: string) => normalizeIsbn(id) === isbn || normalizeIsbn(id) === toIsbn13(isbn));
    return {
      book: {
        title: doc.title,
        author: doc.author_name?.join(', ') || 'Bilinmeyen Yazar',
        publisher: doc.publisher?.[0] || '',
        total_pages: Number(doc.number_of_pages_median) || 200,
        isbn: normalizeIsbn(exactId || isbn),
        category: normalizeCategory(doc.subject),
        format: 'physical',
        shelf_location: 'Salon Kitaplığı',
        words_per_page: 250,
        summary: `${doc.title} - ${doc.author_name?.join(', ') || 'Bilinmeyen Yazar'}`,
        cover_url: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
        source: 'open_library'
      },
      diagnostic: { provider: 'open_library', status: 'FOUND', http_status: response.status, duration_ms: duration }
    };
  } catch (error: any) {
    const duration = Date.now() - started;
    const timedOut = error?.name === 'AbortError' || error?.name === 'TimeoutError';
    return { book: null, diagnostic: { provider: 'open_library', status: timedOut ? 'TIMEOUT' : 'ERROR', duration_ms: duration, message: timedOut ? '5s timeout' : (error?.message || 'Unknown error') } };
  }
}

async function queryISBNdb(isbn: string): Promise<{ book: BookData | null; diagnostic: ResolverDiagnostic }> {
  const started = Date.now();
  const apiKey = process.env.ISBNDB_API_KEY;
  if (!apiKey) return { book: null, diagnostic: { provider: 'isbndb', status: 'CONFIG', duration_ms: 0, message: 'ISBNDB_API_KEY tanımlı değil.' } };

  try {
    const response = await withTimeout(signal => fetch(`https://api.isbndb.com/book/${encodeURIComponent(isbn)}`, {
      headers: { Accept: 'application/json', 'x-api-key': apiKey },
      cache: 'no-store',
      signal
    }), 5000);
    const duration = Date.now() - started;
    if (response.status === 429) return { book: null, diagnostic: { provider: 'isbndb', status: 'RATE_LIMITED', http_status: 429, duration_ms: duration, message: 'ISBNdb rate limit/quota.' } };
    if (response.status === 404) return { book: null, diagnostic: { provider: 'isbndb', status: 'NOT_FOUND', http_status: 404, duration_ms: duration, message: 'ISBNdb kaydı bulunamadı.' } };
    if (!response.ok) return { book: null, diagnostic: { provider: 'isbndb', status: 'HTTP_ERROR', http_status: response.status, duration_ms: duration, message: `HTTP ${response.status}` } };

    const data = await response.json();
    const info = data.book;
    if (!info?.title) return { book: null, diagnostic: { provider: 'isbndb', status: 'NOT_FOUND', http_status: response.status, duration_ms: duration, message: 'ISBNdb boş kayıt döndürdü.' } };

    return {
      book: {
        title: info.title,
        author: Array.isArray(info.authors) ? info.authors.join(', ') : 'Bilinmeyen Yazar',
        publisher: info.publisher || '',
        total_pages: Number(info.pages) || 200,
        isbn: normalizeIsbn(info.isbn13 || info.isbn || isbn),
        category: normalizeCategory(info.subjects),
        format: 'physical',
        shelf_location: 'Salon Kitaplığı',
        words_per_page: 250,
        summary: info.synopsys || info.overview || info.excerpt || `${info.title} - ${Array.isArray(info.authors) ? info.authors.join(', ') : 'Bilinmeyen Yazar'}`,
        cover_url: null,
        source: 'isbndb'
      },
      diagnostic: { provider: 'isbndb', status: 'FOUND', http_status: response.status, duration_ms: duration }
    };
  } catch (error: any) {
    const duration = Date.now() - started;
    const timedOut = error?.name === 'AbortError' || error?.name === 'TimeoutError';
    return { book: null, diagnostic: { provider: 'isbndb', status: timedOut ? 'TIMEOUT' : 'ERROR', duration_ms: duration, message: timedOut ? '5s timeout' : (error?.message || 'Unknown error') } };
  }
}

async function queryAuthoritativeBook(isbnOrQuery: string) {
  const cleanIsbn = normalizeIsbn(isbnOrQuery);
  if (!isValidIsbn(cleanIsbn)) {
    return {
      book: null as BookData | null,
      diagnostics: [
        { provider: 'google_books' as const, status: 'INVALID' as const, duration_ms: 0, message: 'Geçersiz ISBN checksum.' },
        { provider: 'open_library' as const, status: 'INVALID' as const, duration_ms: 0, message: 'Geçersiz ISBN checksum.' },
        { provider: 'isbndb' as const, status: 'INVALID' as const, duration_ms: 0, message: 'Geçersiz ISBN checksum.' }
      ]
    };
  }

  const isbn13 = toIsbn13(cleanIsbn);
  // All independent providers are queried in parallel so one slow/blocked provider cannot delay the others.
  const [googleResult, openLibraryResult, isbnDbResult] = await Promise.all([
    queryGoogleBooks(isbn13),
    queryOpenLibrary(isbn13),
    queryISBNdb(isbn13)
  ]);
  const diagnostics = [googleResult.diagnostic, openLibraryResult.diagnostic, isbnDbResult.diagnostic];
  const candidates = [googleResult.book, openLibraryResult.book, isbnDbResult.book].filter(Boolean) as BookData[];
  if (candidates.length === 0) return { book: null, diagnostics };

  const primary = googleResult.book || openLibraryResult.book || isbnDbResult.book!;
  const secondary = candidates.find(candidate => candidate.source !== primary.source);
  return {
    book: {
      ...primary,
      author: primary.author !== 'Bilinmeyen Yazar' ? primary.author : (secondary?.author || primary.author),
      publisher: primary.publisher || secondary?.publisher || '',
      total_pages: primary.total_pages !== 200 ? primary.total_pages : (secondary?.total_pages || primary.total_pages),
      summary: primary.summary || secondary?.summary || '',
      cover_url: primary.cover_url || secondary?.cover_url || null,
      isbn: isbn13
    },
    diagnostics
  };
}

function diagnosticsText(diagnostics: ResolverDiagnostic[]) {
  return diagnostics.map(d => {
    const label = d.provider === 'google_books' ? 'Google Books' : d.provider === 'open_library' ? 'Open Library' : 'ISBNdb';
    return `${label}: ${d.status}${d.http_status ? ` ${d.http_status}` : ''} (${d.duration_ms}ms)`;
  }).join(' | ');
}

export async function POST(req: Request) {
  try {
    initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 });

    const body = await req.json();
    const { isbn_text, image_base64, mime_type, client_title, client_author, client_publisher, client_cover_url } = body;
    const rawIsbn = normalizeIsbn(isbn_text || '');

    if (rawIsbn) {
      const existingByIsbn = (await db.select().from(books).where(eq(books.isbn, rawIsbn)))[0];
      if (existingByIsbn) return NextResponse.json({ success: true, is_already_in_library: true, existing_book: existingByIsbn, diagnostics: [], data: {
        title: existingByIsbn.title, author: existingByIsbn.author, publisher: existingByIsbn.publisher || '', total_pages: existingByIsbn.total_pages,
        isbn: existingByIsbn.isbn, category: existingByIsbn.category || 'Kişisel Gelişim', format: existingByIsbn.format || 'physical',
        shelf_location: existingByIsbn.shelf_location || 'Salon Kitaplığı', words_per_page: existingByIsbn.words_per_page || 250,
        summary: existingByIsbn.summary || '', cover_url: existingByIsbn.cover_url || null
      }, message: `📚 "${existingByIsbn.title}" kitabı kütüphanenizde zaten mevcut!` });
    }

    if (client_title && client_title.trim().length > 1 && !rawIsbn && !image_base64) {
      const cleanTitle = client_title.trim();
      const existingByTitle = (await db.select().from(books).where(like(books.title, `%${cleanTitle}%`)))[0];
      if (existingByTitle) return NextResponse.json({ success: true, is_already_in_library: true, existing_book: existingByTitle, diagnostics: [], data: existingByTitle, message: `📚 "${existingByTitle.title}" kitabı kütüphanenizde zaten mevcut!` });
      return NextResponse.json({ success: true, is_already_in_library: false, diagnostics: [], data: {
        title: cleanTitle, author: client_author || '', publisher: client_publisher || '', total_pages: 200, isbn: rawIsbn,
        category: 'Edebiyat / Roman', format: 'physical', shelf_location: 'Salon Kitaplığı', words_per_page: 250,
        summary: `${cleanTitle} - ${client_author || ''}`, cover_url: client_cover_url || null
      }, message: `📚 "${cleanTitle}" (${client_author || ''}) doğrulandı!` });
    }

    if (image_base64) {
      const visionResult = await parseBookCoverOrISBNImage(image_base64, mime_type || 'image/jpeg');
      const detectedIsbn = normalizeIsbn(visionResult.isbn || '');
      const effectiveIsbn = rawIsbn || detectedIsbn;
      let verifiedBook: BookData | null = null;
      let diagnostics: ResolverDiagnostic[] = [];
      if (effectiveIsbn.length >= 10) {
        const resolved = await queryAuthoritativeBook(effectiveIsbn);
        verifiedBook = resolved.book;
        diagnostics = resolved.diagnostics;
      }

      const finalBookData = {
        title: verifiedBook?.title || visionResult.title || '', author: verifiedBook?.author || visionResult.author || '',
        publisher: verifiedBook?.publisher || visionResult.publisher || '', isbn: verifiedBook?.isbn || effectiveIsbn || '',
        total_pages: Number(verifiedBook?.total_pages || visionResult.total_pages) || 200,
        category: verifiedBook?.category || visionResult.category || 'Kişisel Gelişim', format: 'physical' as const,
        shelf_location: 'Salon Kitaplığı', words_per_page: visionResult.words_per_page || 250,
        summary: verifiedBook?.summary || visionResult.summary || '', cover_url: verifiedBook?.cover_url || null
      };

      if (finalBookData.title) {
        const existingByTitle = (await db.select().from(books).where(like(books.title, `%${finalBookData.title.trim()}%`)))[0];
        if (existingByTitle) return NextResponse.json({ success: true, is_already_in_library: true, existing_book: existingByTitle, diagnostics, data: finalBookData, message: `📚 "${existingByTitle.title}" kitabı kütüphanenizde zaten mevcut!` });
      }

      return NextResponse.json({ success: true, is_already_in_library: false, diagnostics, data: finalBookData,
        message: finalBookData.title ? `📸 Görsel analiz edildi ve "${finalBookData.title}" doğrulandı. | ${diagnosticsText(diagnostics)}` : `ℹ️ ISBN (${effectiveIsbn}) okundu; kitap metadata bulunamadı. | ${diagnosticsText(diagnostics)}`
      });
    }

    if (!rawIsbn) return NextResponse.json({ success: false, error: 'Lütfen geçerli bir ISBN numarası veya görsel sağlayın.' }, { status: 400 });

    const resolved = await queryAuthoritativeBook(rawIsbn);
    const verifiedData = resolved.book;
    const diagnostics = resolved.diagnostics;
    const sourceMessage = diagnosticsText(diagnostics);

    if (verifiedData) return NextResponse.json({ success: true, is_already_in_library: false, diagnostics, data: verifiedData, message: `📚 "${verifiedData.title}" (${verifiedData.author}) doğrulandı. | ${sourceMessage}` });

    return NextResponse.json({
      success: false,
      error: `ISBN (${toIsbn13(rawIsbn)}) okundu fakat kitap metadata bulunamadı. ${sourceMessage}`,
      isbn: toIsbn13(rawIsbn),
      diagnostics,
      data: { title: '', author: '', publisher: '', total_pages: 200, isbn: toIsbn13(rawIsbn), category: 'Kişisel Gelişim', format: 'physical', shelf_location: 'Salon Kitaplığı', words_per_page: 250, summary: `ISBN: ${toIsbn13(rawIsbn)}`, cover_url: null }
    }, { status: 424 });
  } catch (error: any) {
    console.error('[Library ISBN Resolver Fatal]', error);
    return NextResponse.json({ success: false, error: error?.message || 'ISBN çözümleme hatası.' }, { status: 500 });
  }
}
