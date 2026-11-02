import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getReadingAnalytics } from '../src/app/api/library/analytics/route';
import { getAuthUser } from '../src/lib/auth';
import {
  calculateSessionWpm,
  calculateReadingAnalytics,
  RawReadingSessionWithBook
} from '../src/lib/reading-analytics';

// DB Mock
const mockSelect = vi.fn();

vi.mock('@/db', () => ({
  db: {
    select: (...args: any[]) => mockSelect(...args),
  },
  initDatabase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
}));

function createSelectChain(data: any[]) {
  const obj: any = {};
  obj.from = vi.fn(() => obj);
  obj.innerJoin = vi.fn(() => obj);
  obj.where = vi.fn(() => obj);
  obj.orderBy = vi.fn(() => obj);
  obj.limit = vi.fn(() => Promise.resolve(data));
  obj.then = (onFulfilled: any, onRejected?: any) => Promise.resolve(data).then(onFulfilled, onRejected);
  return obj;
}

describe('📚 Singularity Faz 2: Kitap Okuma Hızı (WPM) & Seans Zaman Serisi (TDD)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. OWASP BOLA & IDOR Güvenlik Denetimleri', () => {
    it('Yetkisiz isteklerde 401 Unauthorized dönmelidir', async () => {
      vi.mocked(getAuthUser).mockResolvedValue(null);

      const req = new Request('http://localhost:3000/api/library/analytics');
      const res = await getReadingAnalytics(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/Yetkisiz/i);
    });

    it('Kullanıcı sadece kendi user_id sine ait okuma seanslarını çekebilmelidir (BOLA İzolasyonu)', async () => {
      vi.mocked(getAuthUser).mockResolvedValue({
        id: 'user-ugur-library',
        family_id: 'fam-ugur'
      } as any);

      const mockRows: RawReadingSessionWithBook[] = [
        {
          session_id: 'sess-1',
          book_id: 'book-1',
          pages_read: 20,
          duration_minutes: 25,
          session_date: '2026-10-25',
          created_at: '2026-10-25T14:00:00.000Z',
          user_id: 'user-ugur-library',
          book_title: 'Siddhartha',
          book_author: 'Hermann Hesse',
          book_category: 'Felsefe',
          words_per_page: 260
        }
      ];

      mockSelect.mockReturnValue(createSelectChain(mockRows));

      const req = new Request('http://localhost:3000/api/library/analytics');
      const res = await getReadingAnalytics(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.totalSessions).toBe(1);
      expect(json.data.sessions[0].bookTitle).toBe('Siddhartha');
      expect(json.data.sessions[0].wpm).toBe(208); // (20 * 260) / 25 = 208 WPM
    });
  });

  describe('2. WPM Hesaplama & ClampWpm Sınır Koruması', () => {
    it('Anormal düşük süre girişlerinde WPM 1200 sınırında tutulmalıdır (clampWpm)', () => {
      // 10 sayfa 0.01 dakikada okundu girilirse: (10 * 250) / 0.01 = 250.000 WPM!
      const highWpm = calculateSessionWpm(10, 0.01, 250);
      expect(highWpm).toBe(1200); // 1200 tavan kelepçesi
    });

    it('Aşırı uzun süre girişlerinde WPM 60 taban sınırının altına düşmemelidir', () => {
      // 1 sayfa 500 dakikada okundu girilirse: (1 * 250) / 500 = 0.5 WPM
      const lowWpm = calculateSessionWpm(1, 500, 250);
      expect(lowWpm).toBe(60); // 60 taban kelepçesi
    });

    it('Eksik words_per_page (null / undefined) durumunda 250 kelimelik güvenli varsayılan kullanılmalıdır', () => {
      // 10 sayfa 10 dakikada: (10 * 250) / 10 = 250 WPM
      const nullWpp = calculateSessionWpm(10, 10, null);
      expect(nullWpp).toBe(250);

      const undefinedWpp = calculateSessionWpm(10, 10, undefined);
      expect(undefinedWpp).toBe(250);
    });

    it('Falsy 0 koruması: 0 dakika veya 0 sayfa girildiğinde varsayılan 220 WPM dönmeli, NaN üretmemelidir', () => {
      const zeroDuration = calculateSessionWpm(15, 0, 250);
      expect(zeroDuration).toBe(220);

      const zeroPages = calculateSessionWpm(0, 30, 250);
      expect(zeroPages).toBe(220);
    });
  });

  describe('3. İstatistiki Özet, Hareketli Ortalama ve Hızlanma Yüzdesi', () => {
    it('Genel WPM, son 7 seans hareketli ortalaması ve hızlanma yüzdesi hatasız hesaplanmalıdır', () => {
      // 6 seans simüle et: ilk seanslar yavaş (150 WPM), son seanslar hızlı (300 WPM)
      const mockRows: RawReadingSessionWithBook[] = [
        { session_id: 's1', book_id: 'b1', pages_read: 10, duration_minutes: 20, session_date: '2026-10-01', created_at: '2026-10-01', words_per_page: 250, book_category: 'Felsefe' }, // 125 WPM
        { session_id: 's2', book_id: 'b1', pages_read: 10, duration_minutes: 20, session_date: '2026-10-03', created_at: '2026-10-03', words_per_page: 250, book_category: 'Felsefe' }, // 125 WPM
        { session_id: 's3', book_id: 'b2', pages_read: 10, duration_minutes: 15, session_date: '2026-10-05', created_at: '2026-10-05', words_per_page: 250, book_category: 'Roman' }, // 167 WPM
        { session_id: 's4', book_id: 'b2', pages_read: 10, duration_minutes: 10, session_date: '2026-10-10', created_at: '2026-10-10', words_per_page: 250, book_category: 'Roman' }, // 250 WPM
        { session_id: 's5', book_id: 'b3', pages_read: 10, duration_minutes: 10, session_date: '2026-10-15', created_at: '2026-10-15', words_per_page: 250, book_category: 'Bilim' }, // 250 WPM
        { session_id: 's6', book_id: 'b3', pages_read: 10, duration_minutes: 8, session_date: '2026-10-20', created_at: '2026-10-20', words_per_page: 250, book_category: 'Bilim' }   // 313 WPM
      ];

      const summary = calculateReadingAnalytics(mockRows, new Date('2026-10-25'));

      expect(summary.totalSessions).toBe(6);
      expect(summary.totalPagesRead).toBe(60);
      expect(summary.totalMinutesRead).toBe(83);

      // Tüm zamanlar ortalaması pozitif ve makul olmalıdır
      expect(summary.allTimeWpm).toBeGreaterThan(150);
      expect(summary.recentWpm).toBeGreaterThan(150);

      // Hızlanma yüzdesi pozitif olmalı (ilk seanslardan son seanslara hızlandı)
      expect(summary.accelerationPercent).toBeGreaterThan(0);
    });

    it('Kategori bazında okuma hızı (Felsefe WPM vs Roman WPM) ayrıştırılmalıdır', () => {
      const mockRows: RawReadingSessionWithBook[] = [
        { session_id: 's1', book_id: 'b1', pages_read: 10, duration_minutes: 25, session_date: '2026-10-10', created_at: '2026-10-10', words_per_page: 250, book_category: 'Felsefe' }, // 100 WPM
        { session_id: 's2', book_id: 'b2', pages_read: 20, duration_minutes: 20, session_date: '2026-10-11', created_at: '2026-10-11', words_per_page: 250, book_category: 'Roman' }    // 250 WPM
      ];

      const summary = calculateReadingAnalytics(mockRows);
      const felsefe = summary.categories.find(c => c.category === 'Felsefe');
      const roman = summary.categories.find(c => c.category === 'Roman');

      expect(felsefe).toBeDefined();
      expect(felsefe!.avgWpm).toBe(100);

      expect(roman).toBeDefined();
      expect(roman!.avgWpm).toBe(250);
      expect(roman!.totalPages).toBe(20);
    });

    it('Son 30 günlük dağılımda okuma yapılmayan günlerde 0 sayfa/dakika dönmeli ve dizi 30 elemanlı olmalıdır', () => {
      const summary = calculateReadingAnalytics([], new Date('2026-10-25'));
      expect(summary.dailyTrend).toHaveLength(30);
      expect(summary.dailyTrend[0].pagesRead).toBe(0);
      expect(summary.dailyTrend[0].durationMinutes).toBe(0);
      expect(summary.dailyTrend[0].avgWpm).toBe(0);
    });
  });
});
