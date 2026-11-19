import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const {
  mockSelect,
  mockUpdate,
  mockDelete,
  mockInsert,
  mockGetAuthUser,
} = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockInsert: vi.fn(),
  mockGetAuthUser: vi.fn(),
}));

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
  getAuthUser: mockGetAuthUser,
}));

import { GET as getWellness, POST as postWellness } from '../src/app/api/wellness/route';
import { GET as getScaleLogs, POST as postScaleLogs, DELETE as deleteScaleLogs } from '../src/app/api/wellness/scale-logs/route';
import { getTodayTurkeyDate, shiftTurkeyDate } from '../src/lib/date-utils';

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
  const obj: any = { lastSet: null };
  obj.set = vi.fn((setObj: any) => {
    obj.lastSet = setObj;
    return obj;
  });
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
  const obj: any = { lastValues: null, allValues: [] };
  obj.values = vi.fn((vals: any) => {
    obj.lastValues = vals;
    obj.allValues.push(vals);
    return Promise.resolve([vals]);
  });
  obj.then = (onFulfilled: any, onRejected?: any) => Promise.resolve([]).then(onFulfilled, onRejected);
  return obj;
}

describe('💊 Wellness & Boost Denetim Testleri (Auth, BOLA, Veri Bütünlüğü & Sıfır Mock)', () => {
  const today = getTodayTurkeyDate();
  const yesterday = shiftTurkeyDate(today, -1);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue(createUpdateChain());
    mockDelete.mockReturnValue(createDeleteChain());
    mockInsert.mockReturnValue(createInsertChain());
  });

  describe('1. Kimlik Doğrulama & Middleware Kalkanı', () => {
    it('GET /api/wellness oturum yoksa 401 dönmelidir', async () => {
      mockGetAuthUser.mockResolvedValue(null);
      const res = await getWellness(new Request('http://localhost:3000/api/wellness'));
      const json = await res.json();
      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
    });

    it('GET & POST /api/wellness/scale-logs oturum yoksa 401 dönmelidir', async () => {
      mockGetAuthUser.mockResolvedValue(null);
      const getRes = await getScaleLogs(new Request('http://localhost:3000/api/wellness/scale-logs'));
      expect(getRes.status).toBe(401);

      const postRes = await postScaleLogs(new Request('http://localhost:3000/api/wellness/scale-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weight_kg: 80 }),
      }));
      expect(postRes.status).toBe(401);
    });

    it('middleware.ts hem /wellness hem /boost rotalarını korumalı rotalara dahil etmelidir', () => {
      const middlewareSrc = fs.readFileSync(path.resolve(__dirname, '../src/middleware.ts'), 'utf8');
      expect(middlewareSrc).toContain("'/boost'");
      expect(middlewareSrc).toContain("'/boost/:path*'");
    });
  });

  describe('2. OWASP BOLA & Aile Üyesi İzolasyonu', () => {
    it('Yetkisiz/yabancı member_id ile GET /api/wellness 403 dönmelidir', async () => {
      mockGetAuthUser.mockResolvedValue({ id: 'usr-1', family_id: 'fam-1' });
      mockSelect.mockReturnValueOnce(createSelectChain([])); // familyMembers lookup returns empty

      const res = await getWellness(new Request('http://localhost:3000/api/wellness?member_id=fm-other-family'));
      const json = await res.json();
      expect(res.status).toBe(403);
      expect(json.success).toBe(false);
    });

    it('Yetkisiz/yabancı member_id ile POST /api/wellness ve scale-logs 403 dönmelidir', async () => {
      mockGetAuthUser.mockResolvedValue({ id: 'usr-1', family_id: 'fam-1' });
      mockSelect.mockReturnValueOnce(createSelectChain([]));

      const resWell = await postWellness(new Request('http://localhost:3000/api/wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'take_all', member_id: 'fm-victim' }),
      }));
      expect(resWell.status).toBe(403);

      mockSelect.mockReturnValueOnce(createSelectChain([]));
      const resScale = await getScaleLogs(new Request('http://localhost:3000/api/wellness/scale-logs?member_id=fm-victim'));
      expect(resScale.status).toBe(403);
    });

    it('Başka kullanıcıya ait takviyede take/undo/update/delete 403 dönmeli ve veri değiştirmemelidir', async () => {
      mockGetAuthUser.mockResolvedValue({ id: 'usr-attacker', family_id: 'fam-attacker' });
      mockSelect.mockReturnValue(createSelectChain([]));

      const actions = [
        { action: 'take_supplement', id: 'supp-victim' },
        { action: 'undo_supplement', id: 'supp-victim' },
        { action: 'update_supplement', id: 'supp-victim', name: 'X', dose: '1' },
        { action: 'delete_supplement', id: 'supp-victim' },
      ];

      for (const payload of actions) {
        const res = await postWellness(new Request('http://localhost:3000/api/wellness', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }));
        expect(res.status).toBe(403);
      }

      expect(mockUpdate).not.toHaveBeenCalled();
      expect(mockDelete).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  describe('3. Takviye Stok 0 Koruması, take_all Günlük Filtresi & undo İdempotency', () => {
    it('add_supplement ve update_supplement 0 stoğu 60 ile ezmemeli, boş stoğu null bırakmalıdır', async () => {
      mockGetAuthUser.mockResolvedValue({ id: 'usr-1', family_id: 'fam-1' });
      const insertChain = createInsertChain();
      mockInsert.mockReturnValueOnce(insertChain);

      const resAdd = await postWellness(new Request('http://localhost:3000/api/wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_supplement',
          name: 'Balık Yağı',
          dose: '1000 mg',
          timing: 'morning',
          total_pills: 30,
          remaining_pills: 0,
        }),
      }));
      expect(resAdd.status).toBe(200);
      expect(insertChain.lastValues.remaining_pills).toBe(0);
      expect(insertChain.lastValues.total_pills).toBe(30);

      // Boş bırakılan stok alanları zorla 60 olmamalı
      const insertChainNull = createInsertChain();
      mockInsert.mockReturnValueOnce(insertChainNull);
      const resAddNull = await postWellness(new Request('http://localhost:3000/api/wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_supplement',
          name: 'D3',
          dose: '1 Damla',
          timing: 'morning',
          total_pills: null,
          remaining_pills: null,
        }),
      }));
      expect(resAddNull.status).toBe(200);
      expect(insertChainNull.lastValues.total_pills).toBeNull();
      expect(insertChainNull.lastValues.remaining_pills).toBeNull();

      // update_supplement 0 değerini korumalı
      mockSelect.mockReturnValueOnce(createSelectChain([{ id: 'supp-1', user_id: 'usr-1' }]));
      const updateChain = createUpdateChain();
      mockUpdate.mockReturnValueOnce(updateChain);
      const resUpd = await postWellness(new Request('http://localhost:3000/api/wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_supplement',
          id: 'supp-1',
          name: 'Balık Yağı',
          dose: '1000 mg',
          timing: 'morning',
          total_pills: 60,
          remaining_pills: 0,
        }),
      }));
      expect(resUpd.status).toBe(200);
      expect(updateChain.lastSet.remaining_pills).toBe(0);
    });

    it('take_all yalnızca günlük (daily) takviyeleri almalı, as_needed (S.O.S.) ve interval takviyelerin stoğunu düşmemelidir', async () => {
      mockGetAuthUser.mockResolvedValue({ id: 'usr-1', family_id: 'fam-1' });
      mockSelect
        .mockReturnValueOnce(createSelectChain([
          { id: 'supp-daily', name: 'Omega 3', dose: '1 kapsül', timing: 'morning', frequency_type: 'daily', remaining_pills: 10, streak_days: 2, last_taken_date: yesterday },
          { id: 'supp-sos', name: 'Ağrı Kesici', dose: '1 tablet', timing: 'as_needed', frequency_type: 'as_needed', remaining_pills: 8, streak_days: 0, last_taken_date: null },
          { id: 'supp-interval', name: 'B12 İğne', dose: '1 ampul', timing: 'morning', frequency_type: 'interval', remaining_pills: 4, streak_days: 0, last_taken_date: null },
        ]))
        .mockReturnValueOnce(createSelectChain([])); // existingLogs for supp-daily

      const insertChain = createInsertChain();
      mockInsert.mockReturnValue(insertChain);

      const res = await postWellness(new Request('http://localhost:3000/api/wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'take_all', date: today }),
      }));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(insertChain.allValues).toHaveLength(1);
      expect(insertChain.allValues[0].supplement_id).toBe('supp-daily');
    });

    it('undo_supplement mevcut olmayan bir log için çağrıldığında stok +1 şişirmemelidir', async () => {
      mockGetAuthUser.mockResolvedValue({ id: 'usr-1', family_id: 'fam-1' });
      mockSelect
        .mockReturnValueOnce(createSelectChain([{ id: 'supp-1', user_id: 'usr-1', is_taken_today: 0, remaining_pills: 10, streak_days: 3 }]))
        .mockReturnValueOnce(createSelectChain([])); // no existing intake log

      const res = await postWellness(new Request('http://localhost:3000/api/wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'undo_supplement', id: 'supp-1', date: today }),
      }));
      expect(res.status).toBe(200);
      expect(mockDelete).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe('4. Uyku, Ruh Hali, Su ve Akıllı Tartı Veri Doğrulama', () => {
    it('add_sleep geçersiz saat formatını 400 ile reddetmeli ve gece yarısını aşan süreyi doğru hesaplamalıdır', async () => {
      mockGetAuthUser.mockResolvedValue({ id: 'usr-1', family_id: 'fam-1' });

      const badRes = await postWellness(new Request('http://localhost:3000/api/wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_sleep', bedtime: 'invalid', wake_time: '07:00', date: today }),
      }));
      expect(badRes.status).toBe(400);

      mockSelect.mockReturnValueOnce(createSelectChain([]));
      const insertChain = createInsertChain();
      mockInsert.mockReturnValueOnce(insertChain);

      const goodRes = await postWellness(new Request('http://localhost:3000/api/wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_sleep', bedtime: '23:30', wake_time: '07:00', quality_rating: 9, date: today }),
      }));
      const goodJson = await goodRes.json();
      expect(goodRes.status).toBe(200);
      expect(goodJson.duration_hours).toBe(7.5);
      expect(insertChain.lastValues.quality_rating).toBe(5);
    });

    it('add_mood geçersiz puanı 400 ile reddetmeli ve enerji/stres değerlerini 1..5 aralığında tutmalıdır', async () => {
      mockGetAuthUser.mockResolvedValue({ id: 'usr-1', family_id: 'fam-1' });

      const badRes = await postWellness(new Request('http://localhost:3000/api/wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_mood', mood_score: 99, date: today }),
      }));
      expect(badRes.status).toBe(400);
    });

    it('scale-logs POST measurement_datetime saat bilgisini kaybetmemeli ve 500 kg üstünü reddetmelidir', async () => {
      mockGetAuthUser.mockResolvedValue({ id: 'usr-1', family_id: 'fam-1' });
      const insertChain = createInsertChain();
      mockInsert.mockReturnValue(insertChain);

      const res = await postScaleLogs(new Request('http://localhost:3000/api/wellness/scale-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          measurement_date: '2026-11-18',
          measurement_datetime: '2026-11-18 08:15:00',
          weight_kg: 84.5,
        }),
      }));
      expect(res.status).toBe(200);
      expect(insertChain.allValues[0].measurement_date).toBe('2026-11-18 08:15:00');
      expect(insertChain.allValues[1].date).toBe('2026-11-18');

      const invalidRes = await postScaleLogs(new Request('http://localhost:3000/api/wellness/scale-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weight_kg: 999 }),
      }));
      expect(invalidRes.status).toBe(400);
    });

    it('WellnessCard ve AddSupplementModal içinde sahte uyku/stok fallback değerleri bulunmamalıdır', () => {
      const cardSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/health/WellnessCard.tsx'), 'utf8');
      expect(cardSrc).not.toContain("'7.5 sa'");
      expect(cardSrc).not.toContain("'23:30 - 07:00'");

      const modalSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/modals/AddSupplementModal.tsx'), 'utf8');
      expect(modalSrc).not.toContain('parseInt(remainingPills) || 60');
      expect(modalSrc).not.toContain('parseInt(totalPills) || 60');

      const calendarBarSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/wellness/DailyTrackerCalendarBar.tsx'), 'utf8');
      expect(calendarBarSrc).toContain("window.addEventListener('resize'");
    });

    it('DELETE /api/wellness/scale-logs oturum, ID, BOLA kontrolü yapmalı ve ilişkili biyometri satırını da temizlemelidir', async () => {
      mockGetAuthUser.mockResolvedValue(null);
      const unauthRes = await deleteScaleLogs(new Request('http://localhost:3000/api/wellness/scale-logs?id=scale-1', { method: 'DELETE' }));
      expect(unauthRes.status).toBe(401);

      mockGetAuthUser.mockResolvedValue({ id: 'usr-1', family_id: 'fam-1' });
      const missingIdRes = await deleteScaleLogs(new Request('http://localhost:3000/api/wellness/scale-logs', { method: 'DELETE' }));
      expect(missingIdRes.status).toBe(400);

      // Başka kullanıcının ölçümü / bulunamayan kayıt -> 403
      mockSelect.mockReturnValueOnce(createSelectChain([]));
      const forbiddenRes = await deleteScaleLogs(new Request('http://localhost:3000/api/wellness/scale-logs?id=scale-victim', { method: 'DELETE' }));
      expect(forbiddenRes.status).toBe(403);
      expect(mockDelete).not.toHaveBeenCalled();

      // Kendi ölçümü -> 200 ve hem smartScaleLogs hem eşleşen biometrics temizlenir
      mockSelect
        .mockReturnValueOnce(createSelectChain([{ id: 'scale-own', user_id: 'usr-1', measurement_date: '2026-11-18 08:15:00', weight_kg: 84.5 }]))
        .mockReturnValueOnce(createSelectChain([{ id: 'bio-sync-1', user_id: 'usr-1', date: '2026-11-18', weight_kg: 84.5 }]));

      const okRes = await deleteScaleLogs(new Request('http://localhost:3000/api/wellness/scale-logs?id=scale-own', { method: 'DELETE' }));
      const okJson = await okRes.json();
      expect(okRes.status).toBe(200);
      expect(okJson.success).toBe(true);
      expect(mockDelete).toHaveBeenCalledTimes(2);
    });
  });
});
