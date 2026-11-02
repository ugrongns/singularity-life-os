import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getFastingHistory } from '../src/app/api/health/fasting/history/route';
import { POST as handleFastingPost } from '../src/app/api/health/fasting/route';
import { getAuthUser } from '../src/lib/auth';
import {
  determineBiologicalPhase,
  calculateSessionStats,
  calculateFastingHistoryAnalytics,
  RawFastingSession
} from '../src/lib/fasting-analytics';

// DB Mock
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();

vi.mock('@/db', () => ({
  db: {
    select: (...args: any[]) => mockSelect(...args),
    update: (...args: any[]) => mockUpdate(...args),
    insert: (...args: any[]) => mockInsert(...args),
  },
  initDatabase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
}));

function createSelectChain(data: any[]) {
  const obj: any = {};
  obj.from = vi.fn(() => obj);
  obj.where = vi.fn(() => obj);
  obj.orderBy = vi.fn(() => obj);
  obj.limit = vi.fn(() => Promise.resolve(data));
  obj.then = (onFulfilled: any, onRejected?: any) => Promise.resolve(data).then(onFulfilled, onRejected);
  return obj;
}

function createUpdateChain(result: any = []) {
  const obj: any = { lastSet: null, lastWhere: null };
  obj.set = vi.fn((setObj: any) => {
    obj.lastSet = setObj;
    return obj;
  });
  obj.where = vi.fn((whereObj: any) => {
    obj.lastWhere = whereObj;
    return Promise.resolve(result);
  });
  obj.then = (onFulfilled: any, onRejected?: any) => Promise.resolve(result).then(onFulfilled, onRejected);
  return obj;
}

describe('🧪 Singularity Faz 1: Aralıklı Oruç & Ötofaji Geçmiş Analitiği (TDD)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. OWASP BOLA & IDOR Güvenlik Denetimleri', () => {
    it('Oturum açmamış kullanıcılar için 401 Unauthorized dönmelidir', async () => {
      vi.mocked(getAuthUser).mockResolvedValue(null);

      const req = new Request('http://localhost:3000/api/health/fasting/history');
      const res = await getFastingHistory(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/Yetkisiz/i);
    });

    it('Kullanıcı sadece kendi user_id sine ait tamamlanmış seansları çekebilmelidir (BOLA İzolasyonu)', async () => {
      vi.mocked(getAuthUser).mockResolvedValue({
        id: 'user-ugur-123',
        family_id: 'fam-ugur',
        email: 'ugur@singularity.os',
        role: 'admin'
      } as any);

      const userSessions: RawFastingSession[] = [
        {
          id: 'fast-1',
          user_id: 'user-ugur-123',
          protocol: '16:8',
          start_time: '2026-10-20T20:00:00.000Z',
          target_end_time: '2026-10-21T12:00:00.000Z',
          actual_end_time: '2026-10-21T12:30:00.000Z', // 16.5 saat
          is_active: 0,
          created_at: '2026-10-20T20:00:00.000Z'
        }
      ];

      mockSelect.mockReturnValue(createSelectChain(userSessions));

      const req = new Request('http://localhost:3000/api/health/fasting/history');
      const res = await getFastingHistory(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.totalCompletedSessions).toBe(1);
      expect(json.data.sessions[0].id).toBe('fast-1');
    });
  });

  describe('2. Biyolojik Fazlar ve Ötofaji Saatlerinin Ayrıştırılması (16s altı vs 24s üstü)', () => {
    it('16 saat altındaki seanslarda ötofaji saati 0 olmalı ve ketozis/standart faz atanmalıdır', () => {
      const stats = calculateSessionStats({
        id: 'fast-short',
        protocol: '16:8',
        start_time: '2026-10-21T08:00:00.000Z',
        target_end_time: '2026-10-22T00:00:00.000Z',
        actual_end_time: '2026-10-21T22:00:00.000Z', // 14 saat
        is_active: 0,
        created_at: '2026-10-21T08:00:00.000Z'
      });

      expect(stats).not.toBeNull();
      expect(stats!.durationHours).toBe(14);
      expect(stats!.reachedAutophagy).toBe(false);
      expect(stats!.autophagyHours).toBe(0);
      expect(stats!.phase).toContain('Ketozis');
      expect(stats!.isSuccessful).toBe(false); // Hedef 16 idi, 14'te bitti
    });

    it('16 - 24 saat arasındaki seanslarda Temel Otofaji ve artan ötofaji saati hesaplanmalıdır', () => {
      const stats = calculateSessionStats({
        id: 'fast-autophagy-basic',
        protocol: '16:8',
        start_time: '2026-10-21T20:00:00.000Z',
        target_end_time: '2026-10-22T12:00:00.000Z',
        actual_end_time: '2026-10-22T14:30:00.000Z', // 18.5 saat
        is_active: 0,
        created_at: '2026-10-21T20:00:00.000Z'
      });

      expect(stats).not.toBeNull();
      expect(stats!.durationHours).toBe(18.5);
      expect(stats!.reachedAutophagy).toBe(true);
      expect(stats!.autophagyHours).toBe(2.5); // 18.5 - 16 = 2.5 saat
      expect(stats!.phase).toBe('Temel Otofaji');
      expect(stats!.badge).toBe('✨ Temel Otofaji');
      expect(stats!.isSuccessful).toBe(true);
    });

    it('24 saat üzerindeki seanslarda Tam Otofaji & Glikojen Sıfırlama fazı belirlenmelidir', () => {
      const phase24 = determineBiologicalPhase(25);
      expect(phase24.phase).toBe('Tam Otofaji & Glikojen Sıfırlama');
      expect(phase24.badge).toBe('🔥 Tam Otofaji');

      const stats = calculateSessionStats({
        id: 'fast-24',
        protocol: '24h',
        start_time: '2026-10-21T18:00:00.000Z',
        target_end_time: '2026-10-22T18:00:00.000Z',
        actual_end_time: '2026-10-22T20:00:00.000Z', // 26 saat
        is_active: 0,
        created_at: '2026-10-21T18:00:00.000Z'
      });

      expect(stats).not.toBeNull();
      expect(stats!.durationHours).toBe(26);
      expect(stats!.autophagyHours).toBe(10); // 26 - 16
      expect(stats!.phase).toBe('Tam Otofaji & Glikojen Sıfırlama');
    });

    it('36 saat ve 48 saat üzerindeki derin hücresel fazlar doğru tespit edilmelidir', () => {
      const phase36 = determineBiologicalPhase(38);
      expect(phase36.phase).toBe('Derin Hücresel Temizlik');
      expect(phase36.badge).toBe('🧬 Derin Otofaji');

      const phase48 = determineBiologicalPhase(50);
      expect(phase48.phase).toBe('Kök Hücre & HGH Zirvesi');
      expect(phase48.badge).toBe('👑 Kök Hücre');
    });
  });

  describe('3. Yarım Kalan, İptal Edilen ve Hatalı Seansların Filtrelenmesi', () => {
    it('Aktif olan (is_active: 1) seanslar tamamlanmış geçmişe dahil edilmemelidir', () => {
      const stats = calculateSessionStats({
        id: 'fast-active',
        protocol: '16:8',
        start_time: '2026-10-22T10:00:00.000Z',
        target_end_time: '2026-10-23T02:00:00.000Z',
        actual_end_time: null,
        is_active: 1,
        created_at: '2026-10-22T10:00:00.000Z'
      });

      expect(stats).toBeNull();
    });

    it('İptal edilen (notes: cancelled) veya actual_end_time olmayan seanslar elenmelidir', () => {
      const statsCancelled = calculateSessionStats({
        id: 'fast-cancelled',
        protocol: '16:8',
        start_time: '2026-10-22T10:00:00.000Z',
        target_end_time: '2026-10-23T02:00:00.000Z',
        actual_end_time: '2026-10-22T11:00:00.000Z',
        is_active: 0,
        notes: 'cancelled by user',
        created_at: '2026-10-22T10:00:00.000Z'
      });

      expect(statsCancelled).toBeNull();

      const statsNoEnd = calculateSessionStats({
        id: 'fast-no-end',
        protocol: '16:8',
        start_time: '2026-10-22T10:00:00.000Z',
        target_end_time: '2026-10-23T02:00:00.000Z',
        actual_end_time: null,
        is_active: 0,
        created_at: '2026-10-22T10:00:00.000Z'
      });

      expect(statsNoEnd).toBeNull();
    });

    it('10 dakikadan kısa süren kazara açılmış oturumlar elenmelidir', () => {
      const statsTiny = calculateSessionStats({
        id: 'fast-tiny',
        protocol: '16:8',
        start_time: '2026-10-22T10:00:00.000Z',
        target_end_time: '2026-10-23T02:00:00.000Z',
        actual_end_time: '2026-10-22T10:04:00.000Z', // 4 dakika
        is_active: 0,
        created_at: '2026-10-22T10:00:00.000Z'
      });

      expect(statsTiny).toBeNull();
    });
  });

  describe('4. Kümülatif Metrikler, Aylık Özet & Zaman Serisi Dağılımı', () => {
    it('Başarı oranı, aylık toplamlar ve son 30 günün dağılımı hatasız toplanmalıdır', () => {
      const referenceDate = new Date('2026-10-31T12:00:00.000Z');

      const mockSessions: RawFastingSession[] = [
        {
          id: 'fast-1',
          protocol: '16:8',
          start_time: '2026-10-28T20:00:00.000Z',
          target_end_time: '2026-10-29T12:00:00.000Z',
          actual_end_time: '2026-10-29T13:00:00.000Z', // 17 saat (1 saat ötofaji, başarılı)
          is_active: 0,
          created_at: '2026-10-28T20:00:00.000Z'
        },
        {
          id: 'fast-2',
          protocol: '18:6',
          start_time: '2026-10-29T20:00:00.000Z',
          target_end_time: '2026-10-30T14:00:00.000Z',
          actual_end_time: '2026-10-30T14:00:00.000Z', // 18 saat (2 saat ötofaji, başarılı)
          is_active: 0,
          created_at: '2026-10-29T20:00:00.000Z'
        },
        {
          id: 'fast-3',
          protocol: '16:8',
          start_time: '2026-10-30T20:00:00.000Z',
          target_end_time: '2026-10-31T12:00:00.000Z',
          actual_end_time: '2026-10-31T08:00:00.000Z', // 12 saat (0 saat ötofaji, erken bozuldu)
          is_active: 0,
          created_at: '2026-10-30T20:00:00.000Z'
        },
        {
          id: 'fast-cancelled',
          protocol: '16:8',
          start_time: '2026-10-31T10:00:00.000Z',
          target_end_time: '2026-10-31T18:00:00.000Z',
          actual_end_time: '2026-10-31T11:00:00.000Z',
          is_active: 0,
          notes: 'cancelled',
          created_at: '2026-10-31T10:00:00.000Z'
        }
      ];

      const summary = calculateFastingHistoryAnalytics(mockSessions, referenceDate);

      expect(summary.totalCompletedSessions).toBe(3);
      // Toplam süreler: 17 + 18 + 12 = 47 saat
      expect(summary.currentMonthFastingHours).toBe(47);
      // Ötofaji süreleri: 1 + 2 + 0 = 3 saat
      expect(summary.currentMonthAutophagyHours).toBe(3);
      // En uzun oruç: 18 saat
      expect(summary.longestFastHours).toBe(18);
      // Başarı oranı: 2 başarılı / 3 tamamlanan = %67
      expect(summary.successRate).toBe(67);
      // 30 günlük dağılım
      expect(summary.dailyFastingHours).toHaveLength(30);

      // 29 Ekim günü kontrolü
      const day29 = summary.dailyFastingHours.find(d => d.date === '2026-10-29');
      expect(day29).toBeDefined();
      expect(day29!.fastingHours).toBe(17);
      expect(day29!.autophagyHours).toBe(1);
      expect(day29!.reachedAutophagy).toBe(true);
    });
  });

  describe('5. Fasting POST API İptal (Cancel) Desteği', () => {
    it('action: cancel gönderildiğinde seansı is_active: 0 ve notes: cancelled olarak işaretlemelidir', async () => {
      vi.mocked(getAuthUser).mockResolvedValue({
        id: 'user-ugur-123',
        family_id: 'fam-ugur'
      } as any);

      const updateChain = createUpdateChain();
      mockUpdate.mockReturnValue(updateChain);

      const req = new Request('http://localhost:3000/api/health/fasting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' })
      });

      const res = await handleFastingPost(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toMatch(/iptal edildi/i);
      expect(updateChain.lastSet.notes).toBe('cancelled');
      expect(updateChain.lastSet.is_active).toBe(0);
    });
  });
});
