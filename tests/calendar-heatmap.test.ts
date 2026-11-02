import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getCalendarHeatmap } from '../src/app/api/analytics/calendar/route';
import { getAuthUser } from '../src/lib/auth';
import {
  calculateHeatmapMatrix,
  RawHeatmapData
} from '../src/lib/calendar-heatmap';

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
  obj.leftJoin = vi.fn(() => obj);
  obj.where = vi.fn(() => obj);
  obj.orderBy = vi.fn(() => obj);
  obj.limit = vi.fn(() => Promise.resolve(data));
  obj.then = (onFulfilled: any, onRejected?: any) => Promise.resolve(data).then(onFulfilled, onRejected);
  return obj;
}

describe('🌌 Singularity Faz 4: Bütünsel Yaşam Takvimi & Isı Haritası (TDD)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. OWASP BOLA & IDOR Güvenlik Denetimleri', () => {
    it('Yetkisiz isteklerde 401 Unauthorized dönmelidir', async () => {
      vi.mocked(getAuthUser).mockResolvedValue(null);

      const req = new Request('http://localhost:3000/api/analytics/calendar');
      const res = await getCalendarHeatmap(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/Yetkisiz/i);
    });

    it('Kullanıcı oturum açtığında tüm modül verileri birleştirilerek takvim matrisi dönmelidir', async () => {
      vi.mocked(getAuthUser).mockResolvedValue({
        id: 'user-ugur-calendar',
        family_id: 'fam-ugur'
      } as any);

      // 4 tablo sorgusu için mock döngüsü
      mockSelect
        .mockReturnValueOnce(createSelectChain([])) // fasting
        .mockReturnValueOnce(createSelectChain([])) // reading
        .mockReturnValueOnce(createSelectChain([])) // transactions
        .mockReturnValueOnce(createSelectChain([])); // water

      const req = new Request('http://localhost:3000/api/analytics/calendar?days=90');
      const res = await getCalendarHeatmap(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.days).toHaveLength(90);
    });
  });

  describe('2. Çok Boyutlu Alışkanlık & Isı Haritası Hesaplaması', () => {
    it('Oruç, okuma, bütçe ve su verileri aynı günde birleştiğinde 4/4 puan ve dominantLevel: 3 olmalıdır', () => {
      const targetDate = '2026-10-15';
      const refDate = new Date(`${targetDate}T12:00:00.000Z`);

      const rawData: RawHeatmapData = {
        fastingSessions: [
          {
            start_time: `${targetDate}T00:00:00.000Z`,
            actual_end_time: `${targetDate}T18:00:00.000Z`, // 18 saat oruç (2s ötofaji)
            is_active: 0
          }
        ],
        readingSessions: [
          {
            pages_read: 25, // >= 10 sayfa okundu
            duration_minutes: 30,
            session_date: targetDate,
            words_per_page: 250
          }
        ],
        transactions: [
          // 0 harcama -> No-spend günü!
        ],
        waterLogs: [
          {
            date: targetDate,
            amount_ml: 2200 // >= 1500 ml su içildi
          }
        ]
      };

      const summary = calculateHeatmapMatrix(rawData, 1, refDate);
      const dayCell = summary.days[0];

      expect(dayCell.date).toBe(targetDate);
      expect(dayCell.fastingHours).toBe(18);
      expect(dayCell.autophagyHours).toBe(2);
      expect(dayCell.reachedAutophagy).toBe(true);
      expect(dayCell.pagesRead).toBe(25);
      expect(dayCell.spentAmount).toBe(0);
      expect(dayCell.isNoSpend).toBe(true);
      expect(dayCell.waterMl).toBe(2200);

      // 4'ü de sağlandı
      expect(dayCell.habitsMetCount).toBe(4);
      expect(dayCell.dominantLevel).toBe(3); // Mükemmel gün!
      expect(summary.perfectDaysCount).toBe(1);
    });

    it('Hiçbir aktivite yapılmayan günde dominantLevel: 0 ve alışkanlık sayısı 0 olmalıdır', () => {
      const targetDate = '2026-10-16';
      const refDate = new Date(`${targetDate}T12:00:00.000Z`);

      const rawData: RawHeatmapData = {
        fastingSessions: [],
        readingSessions: [],
        transactions: [
          {
            amount: 850, // Yüksek harcama -> No spend değil
            transaction_date: targetDate,
            category_type: 'expense'
          }
        ],
        waterLogs: []
      };

      const summary = calculateHeatmapMatrix(rawData, 1, refDate);
      const dayCell = summary.days[0];

      expect(dayCell.fastingHours).toBe(0);
      expect(dayCell.pagesRead).toBe(0);
      expect(dayCell.spentAmount).toBe(850);
      expect(dayCell.isNoSpend).toBe(false);
      expect(dayCell.habitsMetCount).toBe(0);
      expect(dayCell.dominantLevel).toBe(0); // Boş gün
    });

    it('365 günlük takvimde tam 365 hücre üretilmelidir', () => {
      const summary = calculateHeatmapMatrix({
        fastingSessions: [],
        readingSessions: [],
        transactions: [],
        waterLogs: []
      }, 365, new Date('2026-10-31'));

      expect(summary.days).toHaveLength(365);
      expect(summary.totalDays).toBe(365);
    });
  });
});
