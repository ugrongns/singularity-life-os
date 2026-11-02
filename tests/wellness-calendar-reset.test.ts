import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getWellness, POST as postWellness } from '../src/app/api/wellness/route';
import { getAuthUser } from '../src/lib/auth';
import { getTodayTurkeyDate, shiftTurkeyDate } from '../src/lib/date-utils';

// DB Mock
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockInsert = vi.fn();

vi.mock('@/db', () => ({
  db: {
    select: (...args: any[]) => mockSelect(...args),
    update: (...args: any[]) => mockUpdate(...args),
    delete: (...args: any[]) => mockDelete(...args),
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

function createUpdateChain() {
  const obj: any = {};
  obj.set = vi.fn(() => obj);
  obj.where = vi.fn(() => Promise.resolve({}));
  obj.then = (onFulfilled: any, onRejected?: any) => Promise.resolve({}).then(onFulfilled, onRejected);
  return obj;
}

function createDeleteChain() {
  const obj: any = {};
  obj.where = vi.fn(() => Promise.resolve({}));
  obj.then = (onFulfilled: any, onRejected?: any) => Promise.resolve({}).then(onFulfilled, onRejected);
  return obj;
}

function createInsertChain() {
  const obj: any = {};
  obj.values = vi.fn(() => Promise.resolve({}));
  obj.then = (onFulfilled: any, onRejected?: any) => Promise.resolve({}).then(onFulfilled, onRejected);
  return obj;
}

describe('💊 Singularity /boost & /wellness: Günlük Sıfırlama & Takvim Denetimi (TDD)', () => {
  const today = getTodayTurkeyDate();
  const yesterday = shiftTurkeyDate(today, -1);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue(createUpdateChain());
    mockDelete.mockReturnValue(createDeleteChain());
    mockInsert.mockReturnValue(createInsertChain());
  });

  describe('1. OWASP BOLA & IDOR Güvenliği', () => {
    it('Yetkisiz POST isteklerinde 401 Unauthorized dönmelidir', async () => {
      vi.mocked(getAuthUser).mockResolvedValue(null);
      const req = new Request('http://localhost:3000/api/wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_day' })
      });
      const res = await postWellness(req);
      const json = await res.json();
      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/Yetkisiz/i);
    });
  });

  describe('2. Günlük Otomatik Sıfırlama Mantığı (Daily Reset & Self-Healing)', () => {
    it('Yeni günde su kaydı yoksa dünün tüketimi devretmemeli, kesinlikle 0 ml dönmelidir', async () => {
      vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-ugur-reset', family_id: 'fam-ugur' } as any);

      // 1. update: self-healing
      // 2. select: rawSupplements
      // 3. select: todayIntakeLogs
      // 4. select: todayMood
      // 5. select: todaySleep
      // 6. select: userProfile (consumed_water_ml: 2500 - dünden kalma)
      // 7. select: todayWaterList (boş - bugün henüz su içilmedi)
      // 8..11: 7-day histories (mood, sleep, water, recentIntake)
      // 12: latestBiometric
      // 13: scaleLogs
      // 14..17: calendarHistory 14-day queries
      mockSelect
        .mockReturnValueOnce(createSelectChain([])) // rawSupplements
        .mockReturnValueOnce(createSelectChain([])) // todayIntakeLogs
        .mockReturnValueOnce(createSelectChain([])) // todayMood
        .mockReturnValueOnce(createSelectChain([])) // todaySleep
        .mockReturnValueOnce(createSelectChain([{ daily_water_target_ml: 2500, consumed_water_ml: 2500 }])) // userProfile
        .mockReturnValueOnce(createSelectChain([])) // todayWaterList (EMPTY for today!)
        .mockReturnValueOnce(createSelectChain([])) // moodHistory
        .mockReturnValueOnce(createSelectChain([])) // sleepHistory
        .mockReturnValueOnce(createSelectChain([])) // waterHistory
        .mockReturnValueOnce(createSelectChain([])) // recentIntakeLogs
        .mockReturnValueOnce(createSelectChain([])) // latestBiometric
        .mockReturnValueOnce(createSelectChain([])) // scaleLogs
        .mockReturnValueOnce(createSelectChain([])) // recentWaterList (14 days)
        .mockReturnValueOnce(createSelectChain([])) // recentIntakeList (14 days)
        .mockReturnValueOnce(createSelectChain([])) // recentMoodList (14 days)
        .mockReturnValueOnce(createSelectChain([])); // recentSleepList (14 days)

      const req = new Request('http://localhost:3000/api/wellness');
      const res = await getWellness(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.todayWater.amount_ml).toBe(0); // Dünden kalan 2500 devretmemeli, 0 olmalı!
      expect(json.data.todayWater.goal_ml).toBe(2500);
    });

    it('reset_day eylemi çağrıldığında bugünkü takviyeler ve su sayacı sıfırlanmalıdır', async () => {
      vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-ugur-reset', family_id: 'fam-ugur' } as any);

      // Profil mock'u update için
      mockSelect.mockReturnValueOnce(createSelectChain([{ id: 'hp-1', consumed_water_ml: 1500 }]));

      const req = new Request('http://localhost:3000/api/wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_day', date: today })
      });
      const res = await postWellness(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toMatch(/sıfırlandı/i);
      expect(mockDelete).toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe('3. Takvim & Geçmiş Tarih Gezinimi (Calendar & Date Navigation)', () => {
    it('Geçmiş bir tarih parametresi (?date=YYYY-MM-DD) verildiğinde o tarihin verileri dönmelidir', async () => {
      vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-ugur-calendar', family_id: 'fam-ugur' } as any);

      const pastRoutine = {
        id: 'supp-1',
        name: 'Omega 3',
        dose: '1000mg',
        timing: 'morning',
        is_active: 1,
        is_taken_today: 0,
        last_taken_date: yesterday
      };

      const pastIntakeLog = {
        id: 'log-1',
        supplement_id: 'supp-1',
        date: yesterday,
        taken_at: `${yesterday}T08:30:00Z`
      };

      const pastWaterLog = {
        id: 'water-1',
        date: yesterday,
        amount_ml: 2250,
        goal_ml: 2500
      };

      const pastMoodLog = {
        id: 'mood-1',
        date: yesterday,
        mood_score: 5,
        mood_emoji: '😄'
      };

      mockSelect
        .mockReturnValueOnce(createSelectChain([pastRoutine])) // rawSupplements
        .mockReturnValueOnce(createSelectChain([pastIntakeLog])) // selectedDateIntakeLogs
        .mockReturnValueOnce(createSelectChain([pastMoodLog])) // selectedMood
        .mockReturnValueOnce(createSelectChain([])) // selectedSleep
        .mockReturnValueOnce(createSelectChain([{ daily_water_target_ml: 2500 }])) // userProfile
        .mockReturnValueOnce(createSelectChain([pastWaterLog])) // selectedWaterList
        .mockReturnValueOnce(createSelectChain([])) // moodHistory
        .mockReturnValueOnce(createSelectChain([])) // sleepHistory
        .mockReturnValueOnce(createSelectChain([])) // waterHistory
        .mockReturnValueOnce(createSelectChain([])) // recentIntakeLogs
        .mockReturnValueOnce(createSelectChain([])) // latestBiometric
        .mockReturnValueOnce(createSelectChain([])) // scaleLogs
        .mockReturnValueOnce(createSelectChain([pastWaterLog])) // recentWaterList (14 days)
        .mockReturnValueOnce(createSelectChain([pastIntakeLog])) // recentIntakeList (14 days)
        .mockReturnValueOnce(createSelectChain([pastMoodLog])) // recentMoodList (14 days)
        .mockReturnValueOnce(createSelectChain([])); // recentSleepList (14 days)

      const req = new Request(`http://localhost:3000/api/wellness?date=${yesterday}`);
      const res = await getWellness(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.selectedDate).toBe(yesterday);
      expect(json.data.isToday).toBe(false);

      // Dün alınmış takviye geçmiş kayıtlara göre taken = 1 olmalı
      expect(json.data.supplements.all[0].is_taken_today).toBe(1);
      expect(json.data.todayWater.amount_ml).toBe(2250);
      expect(json.data.todayMood.mood_score).toBe(5);

      // 14 günlük takvim geçmişi listelenmeli
      expect(json.data.calendarHistory).toBeDefined();
      expect(Array.isArray(json.data.calendarHistory)).toBe(true);
      expect(json.data.calendarHistory.length).toBe(14);
    });

    it('Geçersiz tarih parametresi girildiğinde sessizce bugüne dönmelidir', async () => {
      vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-ugur-calendar', family_id: 'fam-ugur' } as any);

      mockSelect
        .mockReturnValueOnce(createSelectChain([])) // rawSupplements
        .mockReturnValueOnce(createSelectChain([])) // todayIntakeLogs
        .mockReturnValueOnce(createSelectChain([])) // todayMood
        .mockReturnValueOnce(createSelectChain([])) // todaySleep
        .mockReturnValueOnce(createSelectChain([])) // userProfile
        .mockReturnValueOnce(createSelectChain([])) // todayWaterList
        .mockReturnValueOnce(createSelectChain([])) // moodHistory
        .mockReturnValueOnce(createSelectChain([])) // sleepHistory
        .mockReturnValueOnce(createSelectChain([])) // waterHistory
        .mockReturnValueOnce(createSelectChain([])) // recentIntakeLogs
        .mockReturnValueOnce(createSelectChain([])) // latestBiometric
        .mockReturnValueOnce(createSelectChain([])) // scaleLogs
        .mockReturnValueOnce(createSelectChain([])) // recentWaterList
        .mockReturnValueOnce(createSelectChain([])) // recentIntakeList
        .mockReturnValueOnce(createSelectChain([])) // recentMoodList
        .mockReturnValueOnce(createSelectChain([])); // recentSleepList

      const req = new Request('http://localhost:3000/api/wellness?date=invalid-date-string');
      const res = await getWellness(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.selectedDate).toBe(today);
      expect(json.data.isToday).toBe(true);
    });

    it('Gelecek bir tarih girildiğinde otomatik olarak bugüne sınırlandırılmalıdır (Clamp to Today)', async () => {
      vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-ugur-calendar', family_id: 'fam-ugur' } as any);

      mockSelect
        .mockReturnValueOnce(createSelectChain([]))
        .mockReturnValueOnce(createSelectChain([]))
        .mockReturnValueOnce(createSelectChain([]))
        .mockReturnValueOnce(createSelectChain([]))
        .mockReturnValueOnce(createSelectChain([]))
        .mockReturnValueOnce(createSelectChain([]))
        .mockReturnValueOnce(createSelectChain([]))
        .mockReturnValueOnce(createSelectChain([]))
        .mockReturnValueOnce(createSelectChain([]))
        .mockReturnValueOnce(createSelectChain([]))
        .mockReturnValueOnce(createSelectChain([]))
        .mockReturnValueOnce(createSelectChain([]))
        .mockReturnValueOnce(createSelectChain([]))
        .mockReturnValueOnce(createSelectChain([]))
        .mockReturnValueOnce(createSelectChain([]))
        .mockReturnValueOnce(createSelectChain([]));

      const req = new Request('http://localhost:3000/api/wellness?date=2099-12-31');
      const res = await getWellness(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.selectedDate).toBe(today);
      expect(json.data.isToday).toBe(true);
    });
  });

  describe('4. Takviye Alımı İdempotentliği & Geçmiş Stok Güncellemesi', () => {
    it('take_supplement aynı gün için tekrar çağrıldığında mükerrer kayıt ve çifte stok düşümü engellenmelidir', async () => {
      vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-ugur-take', family_id: 'fam-ugur' } as any);

      const routine = {
        id: 'supp-1',
        name: 'B12 Vitamini',
        dose: '1000mcg',
        remaining_pills: 29,
        streak_days: 5,
        last_taken_date: today
      };

      const existingLog = {
        id: 'log-existing',
        supplement_id: 'supp-1',
        date: today
      };

      // 1. select: suppList
      // 2. select: existingLogs (zaten alınmış!)
      mockSelect
        .mockReturnValueOnce(createSelectChain([routine]))
        .mockReturnValueOnce(createSelectChain([existingLog]));

      const req = new Request('http://localhost:3000/api/wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'take_supplement', id: 'supp-1', date: today })
      });
      const res = await postWellness(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toMatch(/zaten alınmış/i);
      // Mükerrer insert veya update yapılmamalı
      expect(mockInsert).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('Geçmiş bir gün için takviye alındığında stok düşülmeli ancak is_taken_today bugünü bozmamalıdır', async () => {
      vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-ugur-take', family_id: 'fam-ugur' } as any);

      const routine = {
        id: 'supp-2',
        name: 'Magnezyum',
        dose: '200mg',
        remaining_pills: 10,
        streak_days: 2,
        last_taken_date: null
      };

      // 1. select: suppList
      // 2. select: existingLogs (henüz dünün kaydı yok)
      mockSelect
        .mockReturnValueOnce(createSelectChain([routine]))
        .mockReturnValueOnce(createSelectChain([]));

      const req = new Request('http://localhost:3000/api/wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'take_supplement', id: 'supp-2', date: yesterday })
      });
      const res = await postWellness(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mockInsert).toHaveBeenCalled(); // Log eklendi
      expect(mockUpdate).toHaveBeenCalled(); // Stok 9'a düşüldü
    });
  });

  describe('5. Ruh Hali (Mood) & Uyku (Sleep) Upsert Bütünlüğü', () => {
    it('Aynı gün için ruh hali tekrar kaydedildiğinde yeni satır eklenmemeli, var olan satır güncellenmelidir (Upsert)', async () => {
      vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-ugur-mood', family_id: 'fam-ugur' } as any);

      const existingMood = {
        id: 'mood-existing-1',
        mood_score: 3,
        date: today,
        user_id: 'user-ugur-mood'
      };

      // select: existingMoodList
      mockSelect.mockReturnValueOnce(createSelectChain([existingMood]));

      const req = new Request('http://localhost:3000/api/wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_mood',
          mood_score: 5,
          mood_emoji: '🤩',
          date: today
        })
      });
      const res = await postWellness(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.id).toBe('mood-existing-1');
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('Aynı gün için uyku tekrar kaydedildiğinde yeni satır eklenmemeli, var olan satır güncellenmelidir (Upsert)', async () => {
      vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-ugur-sleep', family_id: 'fam-ugur' } as any);

      const existingSleep = {
        id: 'sleep-existing-1',
        duration_hours: 6.5,
        date: today,
        user_id: 'user-ugur-sleep'
      };

      // select: existingSleepList
      mockSelect.mockReturnValueOnce(createSelectChain([existingSleep]));

      const req = new Request('http://localhost:3000/api/wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_sleep',
          bedtime: '23:00',
          wake_time: '07:30',
          quality_rating: 4,
          date: today
        })
      });
      const res = await postWellness(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.id).toBe('sleep-existing-1');
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });
});
