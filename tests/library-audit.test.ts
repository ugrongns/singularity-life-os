import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import * as schema from '../src/db/schema';

const {
  mockGetAuthUser,
  mockSelect,
  mockInsert,
  mockUpdate,
  mockDelete,
  mockTransaction,
} = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getAuthUser: mockGetAuthUser,
}));

vi.mock('@/db', () => ({
  initDatabase: vi.fn().mockResolvedValue(undefined),
  db: {
    select: (...args: any[]) => mockSelect(...args),
    insert: (...args: any[]) => mockInsert(...args),
    update: (...args: any[]) => mockUpdate(...args),
    delete: (...args: any[]) => mockDelete(...args),
    transaction: (...args: any[]) => mockTransaction(...args),
  },
}));

import { GET as getLibrary, POST as postLibrary, DELETE as deleteLibrary } from '../src/app/api/library/route';
import { POST as postSession } from '../src/app/api/library/sessions/route';
import { GET as getQuotes, POST as postQuote, DELETE as deleteQuote } from '../src/app/api/library/quotes/route';
import { POST as scanIsbn } from '../src/app/api/library/scan-isbn/route';
import { POST as uploadCover } from '../src/app/api/library/upload-cover/route';
import { POST as postVoiceCommand } from '../src/app/api/voice-command/route';
import { POST as postBackup } from '../src/app/api/backup/route';
import { calculateReadingAnalytics } from '../src/lib/reading-analytics';

function createSelectChain(data: any[], onWhere?: (expr: any) => void) {
  const chain: any = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    where: vi.fn((expr: any) => {
      if (onWhere) onWhere(expr);
      return chain;
    }),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(data)),
    then: (onFulfilled: any, onRejected?: any) => Promise.resolve(data).then(onFulfilled, onRejected),
  };
  return chain;
}

function createUpdateChain(result: any = []) {
  const chain: any = { lastSet: null };
  chain.set = vi.fn((vals: any) => {
    chain.lastSet = vals;
    return chain;
  });
  chain.where = vi.fn(() => Promise.resolve(result));
  chain.then = (onFulfilled: any, onRejected?: any) => Promise.resolve(result).then(onFulfilled, onRejected);
  return chain;
}

function createInsertChain() {
  const chain: any = { lastValues: null, allValues: [] };
  chain.values = vi.fn((vals: any) => {
    chain.lastValues = vals;
    chain.allValues.push(vals);
    return Promise.resolve([vals]);
  });
  chain.then = (onFulfilled: any, onRejected?: any) => Promise.resolve([]).then(onFulfilled, onRejected);
  return chain;
}

function createDeleteChain() {
  const chain: any = {};
  chain.where = vi.fn(() => Promise.resolve([]));
  chain.then = (onFulfilled: any, onRejected?: any) => Promise.resolve([]).then(onFulfilled, onRejected);
  return chain;
}

describe('📚 Kütüphane Modülü (!denetle kütüphane) Güvenlik & Veri Bütünlüğü Regresyon Testleri', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockImplementation(() => createSelectChain([]));
    mockUpdate.mockImplementation(() => createUpdateChain());
    mockInsert.mockImplementation(() => createInsertChain());
    mockDelete.mockImplementation(() => createDeleteChain());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('1. GET /api/library ve GET /api/library/quotes oturumsuz isteklerde 401 dönmelidir', async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const libRes = await getLibrary();
    expect(libRes.status).toBe(401);

    const quotesRes = await getQuotes();
    expect(quotesRes.status).toBe(401);
  });

  it('2. KRİTİK BOLA: is_master_account=1 olan başka aile admini başka ailenin kitabını güncelleyememeli ve silememelidir', async () => {
    mockGetAuthUser.mockResolvedValue({
      id: 'usr-family-b-admin',
      family_id: 'fam-b',
      role: 'admin',
      is_master_account: 1,
    });

    const pgDialect = new PgDialect();
    const compiledWheres: string[] = [];

    mockSelect.mockImplementation(() =>
      createSelectChain([], (expr) => {
        if (expr) compiledWheres.push(pgDialect.sqlToQuery(expr).sql);
      })
    );

    const updateRes = await postLibrary(
      new Request('http://localhost/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_details',
          book_id: 'book-family-a',
          title: 'Ele Geçirilen Kitap',
        }),
      })
    );
    expect(updateRes.status).toBe(403);

    const deleteRes = await deleteLibrary(
      new Request('http://localhost/api/library?id=book-family-a', { method: 'DELETE' })
    );
    expect(deleteRes.status).toBe(404);

    // Her iki sorgu da asla 1=1 içermemeli ve family_id + is_family_shared kısıtı taşımalıdır
    expect(compiledWheres.length).toBe(2);
    for (const sqlText of compiledWheres) {
      expect(sqlText).not.toContain('1=1');
      expect(sqlText).toContain('"books"."family_id"');
      expect(sqlText).toContain('"books"."is_family_shared"');
    }
  });

  it('3. POST /api/library doğrulamaları: eksik book_id ile kazara kitap oluşturmamalı, NaN/negatif değerleri 400 ile reddetmelidir', async () => {
    mockGetAuthUser.mockResolvedValue({
      id: 'usr-1',
      family_id: 'fam-1',
      role: 'admin',
      is_master_account: 1,
    });

    // book_id olmadan update_words_per_page çağrısı create_book'a düşmemeli
    const missingIdRes = await postLibrary(
      new Request('http://localhost/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_words_per_page',
          title: 'Yanlışlıkla Oluşacak Kitap',
          words_per_page: 280,
        }),
      })
    );
    expect(missingIdRes.status).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();

    // Geçersiz hedef (0 veya 999) reddedilmeli
    const badTargetRes = await postLibrary(
      new Request('http://localhost/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_target', yearly_target_books: 0 }),
      })
    );
    expect(badTargetRes.status).toBe(400);

    // Geçersiz hızlı sayfa sayısı ('abc') 500 yerine 400 dönmeli
    const badQuickPageRes = await postLibrary(
      new Request('http://localhost/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: 'book-1', current_page: 'abc' }),
      })
    );
    expect(badQuickPageRes.status).toBe(400);

    // Güvensiz javascript: cover_url reddedilmeli
    const badCoverRes = await postLibrary(
      new Request('http://localhost/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_book',
          title: 'Güvenli Kitap',
          cover_url: 'javascript:alert(1)',
        }),
      })
    );
    expect(badCoverRes.status).toBe(400);
  });

  it('4. POST /api/library update_details purchase_price=0 değerini korumalı ve total_pages=0 hızlı güncellemede kitabı tamamlanmış yapmamalıdır', async () => {
    mockGetAuthUser.mockResolvedValue({
      id: 'usr-1',
      family_id: 'fam-1',
      role: 'admin',
      is_master_account: 1,
    });

    const existingBook = {
      id: 'book-1',
      user_id: 'usr-1',
      family_id: 'fam-1',
      is_family_shared: 1,
      title: 'Hediye Kitap',
      total_pages: 0,
      current_page: 0,
      status: 'reading',
      rating: 5,
      purchase_price: null,
      finish_date: null,
    };

    mockSelect.mockImplementation(() => createSelectChain([existingBook]));
    const upd1 = createUpdateChain();
    mockUpdate.mockReturnValueOnce(upd1);

    const res1 = await postLibrary(
      new Request('http://localhost/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_details',
          book_id: 'book-1',
          purchase_price: 0,
          total_pages: 120,
          current_page: 250, // total_pages üstüne çıkarsa 120'ye kelepçelenmeli
        }),
      })
    );
    expect(res1.status).toBe(200);
    expect(upd1.lastSet.purchase_price).toBe(0);
    expect(upd1.lastSet.current_page).toBe(120);

    // total_pages=0 iken current_page=0 gönderilince completed olmamalı
    const upd2 = createUpdateChain();
    mockUpdate.mockReturnValueOnce(upd2);
    const res2 = await postLibrary(
      new Request('http://localhost/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: 'book-1', current_page: 0 }),
      })
    );
    expect(res2.status).toBe(200);
    expect(upd2.lastSet.status).toBe('reading');
  });

  it('5. POST /api/library/sessions negatif süreyi ve bitiş<=başlangıç aralığını reddetmeli, current_page toplam sayfayı aşmamalı ve TR tarihi yazmalıdır', async () => {
    vi.useFakeTimers();
    // UTC 18 Kasım 22:30 -> Türkiye 19 Kasım 01:30
    vi.setSystemTime(new Date('2026-11-18T22:30:00.000Z'));

    mockGetAuthUser.mockResolvedValue({
      id: 'usr-1',
      family_id: 'fam-1',
    });

    const sampleBook = {
      id: 'book-1',
      user_id: 'usr-1',
      family_id: 'fam-1',
      is_family_shared: 1,
      title: 'Körlük',
      total_pages: 300,
      current_page: 290,
      status: 'reading',
      start_date: '2026-11-10',
      finish_date: null,
    };

    mockSelect.mockImplementation(() => createSelectChain([sampleBook]));

    // 1. Negatif süre reddedilmeli
    const negDurRes = await postSession(
      new Request('http://localhost/api/library/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: 'book-1', pages_read: 10, duration_minutes: -15 }),
      })
    );
    expect(negDurRes.status).toBe(400);

    // 2. Bitiş <= başlangıç aralığı reddedilmeli
    const badRangeRes = await postSession(
      new Request('http://localhost/api/library/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: 'book-1', start_page: 100, end_page: 90, duration_minutes: 20 }),
      })
    );
    expect(badRangeRes.status).toBe(400);

    // 3. 290. sayfada +20 sayfa okuma: current_page 300'e kelepçelenmeli ve TR günü 2026-11-19 yazılmalı
    const insertChain = createInsertChain();
    const updateChain = createUpdateChain();
    mockInsert.mockReturnValue(insertChain);
    mockUpdate.mockReturnValue(updateChain);
    mockSelect
      .mockReturnValueOnce(createSelectChain([sampleBook])) // book lookup
      .mockReturnValueOnce(createSelectChain([{ pages_read: 10, duration_minutes: 20, words_per_page: 250 }])) // recentSessions
      .mockReturnValueOnce(createSelectChain([])); // userReadingProfile

    const okRes = await postSession(
      new Request('http://localhost/api/library/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: 'book-1', start_page: 290, pages_read: 20, duration_minutes: 25 }),
      })
    );
    expect(okRes.status).toBe(200);
    expect(insertChain.allValues[0].session_date).toBe('2026-11-19');
    expect(updateChain.lastSet.current_page).toBe(300);
    expect(updateChain.lastSet.status).toBe('completed');
    expect(updateChain.lastSet.finish_date).toBe('2026-11-19');
  });

  it('6. POST /api/library/upload-cover public diske yazmadan Data URI döndürmeli ve PDF gibi görsel dışı dosyaları reddetmelidir', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'usr-1', family_id: 'fam-1' });

    const pdfForm = new FormData();
    pdfForm.append('file', new File(['%PDF-1.4'], 'cover.pdf', { type: 'application/pdf' }));
    const pdfRes = await uploadCover(
      new Request('http://localhost/api/library/upload-cover', { method: 'POST', body: pdfForm })
    );
    expect(pdfRes.status).toBe(400);

    const imgForm = new FormData();
    imgForm.append('file', new File(['fake-jpg'], 'cover.jpg', { type: 'image/jpeg' }));
    const imgRes = await uploadCover(
      new Request('http://localhost/api/library/upload-cover', { method: 'POST', body: imgForm })
    );
    const imgJson = await imgRes.json();
    expect(imgRes.status).toBe(200);
    expect(imgJson.url).toMatch(/^data:image\/jpeg;base64,/);
    expect(imgJson.url).not.toContain('/uploads/covers/');
  });

  it('7. POST /api/voice-command reading aksiyonu kullanıcının kitabı yoksa başka kullanıcının kitabını güncellememelidir', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'usr-no-books', family_id: 'fam-no-books' });
    mockSelect.mockImplementation(() => createSelectChain([]));

    const res = await postVoiceCommand(
      new Request('http://localhost/api/voice-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute',
          actions: [{ type: 'reading', title: '20 Sayfa Kitap Okuma', icon: '📚', details: { pages: 20 } }],
        }),
      })
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(json.executed).toEqual([]);
  });

  it('8. POST /api/library/quotes özel (is_family_shared=0) başka üye kitabına alıntı eklemeyi engellemelidir', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'usr-spouse', family_id: 'fam-1' });
    mockSelect.mockImplementation(() => createSelectChain([]));

    const res = await postQuote(
      new Request('http://localhost/api/library/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: 'private-book', quote_text: 'Özel alıntı', page_number: 12 }),
      })
    );
    expect(res.status).toBe(403);
  });

  it('9. calculateReadingAnalytics dailyTrend gece yarısı TR takvim gününe göre doğru etiketlenmelidir', () => {
    // 2026-11-18T22:30:00Z -> Türkiye'de 2026-11-19 01:30
    const summary = calculateReadingAnalytics([], new Date('2026-11-18T22:30:00.000Z'));
    const lastDay = summary.dailyTrend[summary.dailyTrend.length - 1];
    expect(lastDay.date).toBe('2026-11-19');
    expect(lastDay.dayLabel).toBe('19 Kas');
  });

  it('10. /api/backup export reading_sessions ve user_reading_profile tablolarını yalnızca user_id ile izole etmelidir', async () => {
    mockGetAuthUser.mockResolvedValue({
      id: 'usr-1',
      family_id: 'fam-1',
      role: 'member',
      full_name: 'Üye 1',
    });

    const pgDialect = new PgDialect();
    const tableQueries = new Map<any, { sql: string; params: any[] }>();

    mockSelect.mockImplementation(() => {
      let currentTbl: any = null;
      const chain: any = {
        from: vi.fn((tbl: any) => {
          currentTbl = tbl;
          return chain;
        }),
        where: vi.fn((expr: any) => {
          const compiled = pgDialect.sqlToQuery(expr);
          tableQueries.set(currentTbl, { sql: compiled.sql, params: compiled.params });
          return createSelectChain([]);
        }),
        orderBy: vi.fn(() => chain),
        limit: vi.fn(() => Promise.resolve([])),
        then: (onFulfilled: any, onRejected?: any) => Promise.resolve([]).then(onFulfilled, onRejected),
      };
      return chain;
    });

    const res = await postBackup(
      new Request('http://localhost/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'export_json' }),
      })
    );
    expect(res.status).toBe(200);

    const sessQ = tableQueries.get(schema.readingSessions);
    expect(sessQ).toBeDefined();
    expect(sessQ!.sql).toContain('"reading_sessions"."user_id"');
    expect(sessQ!.sql).not.toContain('"reading_sessions"."family_id"');
    expect(sessQ!.params).toEqual(['usr-1']);

    const profQ = tableQueries.get(schema.userReadingProfile);
    expect(profQ).toBeDefined();
    expect(profQ!.sql).toContain('"user_reading_profile"."user_id"');
    expect(profQ!.sql).not.toContain('"user_reading_profile"."family_id"');
    expect(profQ!.params).toEqual(['usr-1']);
  });

  it('11. DELETE /api/library/quotes yetkisiz/sahipsiz alıntıyı reddetmeli, yalnızca sahibinin alıntısını silmelidir', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'usr-member', family_id: 'fam-1', role: 'member', is_master_account: 0 });
    mockSelect.mockImplementation(() => createSelectChain([]));

    const missingIdRes = await deleteQuote(new Request('http://localhost/api/library/quotes', { method: 'DELETE' }));
    expect(missingIdRes.status).toBe(400);

    const forbiddenRes = await deleteQuote(
      new Request('http://localhost/api/library/quotes?id=quote-other', { method: 'DELETE' })
    );
    expect(forbiddenRes.status).toBe(404);
    expect(mockDelete).not.toHaveBeenCalled();

    mockSelect.mockImplementation(() =>
      createSelectChain([{ id: 'quote-own', user_id: 'usr-member', family_id: 'fam-1' }])
    );
    const okRes = await deleteQuote(
      new Request('http://localhost/api/library/quotes?id=quote-own', { method: 'DELETE' })
    );
    const okJson = await okRes.json();
    expect(okRes.status).toBe(200);
    expect(okJson.success).toBe(true);
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it('12. POST /api/library/scan-isbn paralel katalog sorgusunda önceliği korumalı, eksik kapağı yedek katalogdan ve özeti Gemini helper ile birleştirmelidir', async () => {
    const prevGeminiKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'test-gemini-key';

    mockGetAuthUser.mockResolvedValue({ id: 'usr-1', family_id: 'fam-1' });
    mockSelect.mockImplementation(() => createSelectChain([]));

    const calledUrls: string[] = [];
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      calledUrls.push(url);

      if (url.includes('googleapis.com/books/v1/volumes')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                volumeInfo: {
                  title: 'Körlük',
                  authors: ['Jose Saramago'],
                  publisher: 'Kırmızı Kedi',
                  pageCount: 320,
                  categories: ['Fiction'],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('openlibrary.org/api/books')) {
        return new Response(
          JSON.stringify({
            'ISBN:9786051111111': {
              title: 'Blindness',
              authors: [{ name: 'Jose Saramago' }],
              number_of_pages: 290,
              cover: { medium: 'https://covers.openlibrary.org/b/id/999-M.jpg' },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('kitapsepeti.com/arama')) {
        throw new Error('Kitapsepeti timeout');
      }

      if (url.includes('generativelanguage.googleapis.com')) {
        const geminiCalls = calledUrls.filter((u) => u.includes('generativelanguage.googleapis.com')).length;
        if (geminiCalls === 1) {
          return new Response(JSON.stringify({ error: { code: 429 } }), { status: 429 });
        }
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        title: 'Körlük',
                        author: 'José Saramago',
                        publisher: 'Kırmızı Kedi Yayınevi',
                        total_pages: 280,
                        category: 'Kurgu (Fiction)',
                        summary: 'Ansızın yayılan beyaz körlük salgını üzerinden insan doğasını inceleyen başyapıt.',
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(null, { status: 404 });
    });

    vi.stubGlobal('fetch', fetchMock);

    try {
      const res = await scanIsbn(
        new Request('http://localhost/api/library/scan-isbn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isbn: '978-605-111-111-1' }),
        })
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(calledUrls.some((u) => u.includes('googleapis.com/books'))).toBe(true);
      expect(calledUrls.some((u) => u.includes('openlibrary.org/api/books'))).toBe(true);
      expect(calledUrls.some((u) => u.includes('kitapsepeti.com/arama'))).toBe(true);
      expect(json.data.cover_url).toBe('https://covers.openlibrary.org/b/id/999-M.jpg');
      expect(json.data.total_pages).toBe(320);
      expect(json.data.author).toBe('José Saramago');
      expect(json.data.summary).toContain('beyaz körlük salgını');
    } finally {
      if (prevGeminiKey === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = prevGeminiKey;
      }
    }
  });
});
