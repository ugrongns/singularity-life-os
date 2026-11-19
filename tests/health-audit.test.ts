import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import * as schema from '../src/db/schema';

const {
  mockGetAuthUser,
  mockVerifyPassword,
  mockClearAuthSessionCache,
  mockGetStravaConfig,
  mockResolveAuthorizedMemberId,
  mockLearnFromSavedMeal,
  mockEnsureFamilyCategories,
  mockEmitEvent,
  mockCookies,
  mockSelect,
  mockInsert,
  mockUpdate,
  mockDelete,
  mockTransaction,
} = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockVerifyPassword: vi.fn(),
  mockClearAuthSessionCache: vi.fn(),
  mockGetStravaConfig: vi.fn(),
  mockResolveAuthorizedMemberId: vi.fn(),
  mockLearnFromSavedMeal: vi.fn(),
  mockEnsureFamilyCategories: vi.fn(),
  mockEmitEvent: vi.fn(),
  mockCookies: vi.fn(),
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getAuthUser: mockGetAuthUser,
  verifyPassword: mockVerifyPassword,
  clearAuthSessionCache: mockClearAuthSessionCache,
}));

vi.mock('@/lib/strava', () => ({
  getStravaConfig: mockGetStravaConfig,
}));

vi.mock('@/lib/nutrition-memory', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/nutrition-memory')>();
  return {
    ...actual,
    resolveAuthorizedMemberId: mockResolveAuthorizedMemberId,
    learnFromSavedMeal: mockLearnFromSavedMeal,
  };
});

vi.mock('@/lib/budget-categories', () => ({
  ensureFamilyCategories: mockEnsureFamilyCategories,
}));

vi.mock('@/lib/events', () => ({
  EVENTS: {
    DIET_MEAL_RECORDED: 'diet.meal_recorded',
  },
  eventBus: {
    emit: mockEmitEvent,
  },
}));

vi.mock('next/headers', () => ({
  cookies: mockCookies,
}));

vi.mock('@/db', () => ({
  initDatabase: vi.fn().mockResolvedValue(undefined),
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

import { GET as getScanFood, POST as postScanFood, DELETE as deleteScanFood } from '../src/app/api/health/scan-food/route';
import { GET as getWorkouts, POST as postWorkouts } from '../src/app/api/health/workouts/route';
import { GET as getStravaCallback } from '../src/app/api/health/workouts/strava/callback/route';
import { GET as getDietOptions } from '../src/app/api/health/diet/route';
import { GET as getNutrition, POST as postNutrition } from '../src/app/api/health/nutrition/route';
import { GET as getWater, POST as postWater } from '../src/app/api/health/water/route';
import { GET as getFasting, POST as postFasting } from '../src/app/api/health/fasting/route';
import { GET as getFastingHistory } from '../src/app/api/health/fasting/history/route';
import { GET as getNutritionProfile } from '../src/app/api/health/nutrition-profile/route';
import { POST as postDeleteAccount } from '../src/app/api/auth/delete-account/route';
import { POST as postResetUserData } from '../src/app/api/auth/reset-user-data/route';
import { POST as postTelegram } from '../src/app/api/telegram/route';
import { POST as postVoiceCommand } from '../src/app/api/voice-command/route';
import { calculateFastingHistoryAnalytics } from '../src/lib/fasting-analytics';
import { RESILIENT_GEMINI_MODELS } from '../src/lib/ai-vision';

interface RecordedOp {
  op: 'select' | 'insert' | 'update' | 'delete';
  table: unknown;
  sql?: string;
  params?: unknown[];
  values?: unknown;
}

function setupMockDb(tableRows: Map<unknown, unknown[]> = new Map()) {
  const dialect = new PgDialect();
  const recorded: RecordedOp[] = [];

  const compileWhere = (expr: unknown) => {
    try {
      return dialect.sqlToQuery(expr as never);
    } catch {
      return { sql: String(expr), params: [] as unknown[] };
    }
  };

  mockSelect.mockImplementation(() => {
    let currentTable: unknown = null;
    let rows: unknown[] = [];

    const chain: Record<string, unknown> = {
      from: (table: unknown) => {
        currentTable = table;
        rows = tableRows.get(table) ?? [];
        return chain;
      },
      leftJoin: () => chain,
      where: (expr: unknown) => {
        const compiled = compileWhere(expr);
        recorded.push({ op: 'select', table: currentTable, sql: compiled.sql, params: compiled.params });
        return chain;
      },
      orderBy: () => chain,
      limit: () => Promise.resolve(rows),
      then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve(rows).then(onFulfilled, onRejected),
    };
    return chain;
  });

  mockInsert.mockImplementation((table: unknown) => ({
    values: (vals: unknown) => {
      recorded.push({ op: 'insert', table, values: vals });
      const chain = {
        onConflictDoUpdate: () => Promise.resolve(undefined),
        returning: () => Promise.resolve(Array.isArray(vals) ? vals : [vals]),
        then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
          Promise.resolve(undefined).then(onFulfilled, onRejected),
      };
      return chain;
    },
  }));

  mockUpdate.mockImplementation((table: unknown) => ({
    set: (vals: unknown) => ({
      where: (expr: unknown) => {
        const compiled = compileWhere(expr);
        recorded.push({ op: 'update', table, values: vals, sql: compiled.sql, params: compiled.params });
        return Promise.resolve(undefined);
      },
    }),
  }));

  mockDelete.mockImplementation((table: unknown) => ({
    where: (expr: unknown) => {
      const compiled = compileWhere(expr);
      recorded.push({ op: 'delete', table, sql: compiled.sql, params: compiled.params });
      return Promise.resolve(undefined);
    },
    then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => {
      recorded.push({ op: 'delete', table });
      return Promise.resolve(undefined).then(onFulfilled, onRejected);
    },
  }));

  mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      select: (...args: unknown[]) => mockSelect(...args),
      insert: (...args: unknown[]) => mockInsert(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
    };
    return cb(tx);
  });

  return recorded;
}

describe('🩺 Sağlık & Beslenme Modülü (!denetle sağlık) Denetim & Regresyon Testleri', () => {
  const originalFetch = globalThis.fetch;
  const originalGeminiKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.GEMINI_API_KEY;
    globalThis.fetch = originalFetch;

    mockGetAuthUser.mockResolvedValue({
      id: 'user-master-1',
      family_id: 'fam-1',
      role: 'admin',
      is_master_account: 1,
      password_hash: 'hash',
      password_salt: 'salt',
    });
    mockResolveAuthorizedMemberId.mockResolvedValue({ authorized: true, memberId: 'user-master-1' });
    mockLearnFromSavedMeal.mockResolvedValue(undefined);
    mockEnsureFamilyCategories.mockResolvedValue(undefined);
    mockEmitEvent.mockResolvedValue(undefined);
    mockVerifyPassword.mockResolvedValue(true);
    mockCookies.mockResolvedValue({
      get: vi.fn((key: string) => (key === 'strava_oauth_nonce' ? { value: 'nonce-123' } : undefined)),
      delete: vi.fn(),
    });
    mockGetStravaConfig.mockResolvedValue({
      clientId: 'client-1',
      clientSecret: 'secret-1',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
    if (originalGeminiKey !== undefined) {
      process.env.GEMINI_API_KEY = originalGeminiKey;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
  });

  describe('🔒 OWASP BOLA & Cross-Tenant İzolasyonu', () => {
    it('scan-food DELETE: is_master_account=1 olsa bile başka kullanıcının kaydını silememeli (404 + user_id filtresi)', async () => {
      const recorded = setupMockDb(new Map([[schema.packagedFoodScans, []]]));

      const res = await deleteScanFood(new Request('http://localhost:3000/api/health/scan-food?id=victim-scan-99', { method: 'DELETE' }));
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.success).toBe(false);

      const selectOp = recorded.find(r => r.op === 'select' && r.table === schema.packagedFoodScans);
      expect(selectOp).toBeDefined();
      expect(selectOp?.sql).toContain('"packaged_food_scans"."user_id" =');
      expect(selectOp?.params).toContain('user-master-1');
      expect(recorded.some(r => r.op === 'delete')).toBe(false);
    });

    it('scan-food DELETE (?clear_junk=true): is_master_account=1 iken yalnızca kendi user_id kayıtlarını temizlemeli', async () => {
      const recorded = setupMockDb();

      const res = await deleteScanFood(new Request('http://localhost:3000/api/health/scan-food?clear_junk=true', { method: 'DELETE' }));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);

      const deleteOp = recorded.find(r => r.op === 'delete' && r.table === schema.packagedFoodScans);
      expect(deleteOp).toBeDefined();
      expect(deleteOp?.sql).toContain('"packaged_food_scans"."user_id" =');
      expect(deleteOp?.params).toContain('user-master-1');
    });

    it('workouts DELETE: eksik workout_id için 400, başka kullanıcı için is_master_account=1 olsa bile 404 döndürmeli', async () => {
      const recorded = setupMockDb(new Map([[schema.workoutSessions, []]]));

      const badRes = await postWorkouts(
        new Request('http://localhost:3000/api/health/workouts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete' }),
        })
      );
      expect(badRes.status).toBe(400);

      const forbiddenRes = await postWorkouts(
        new Request('http://localhost:3000/api/health/workouts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', workout_id: 'wk-other-user' }),
        })
      );
      expect(forbiddenRes.status).toBe(404);

      const selectOp = recorded.find(r => r.op === 'select' && r.table === schema.workoutSessions);
      expect(selectOp?.sql).toContain('"workout_sessions"."user_id" =');
      expect(selectOp?.params).toContain('user-master-1');
      expect(recorded.some(r => r.op === 'delete')).toBe(false);
    });

    it('workouts DELETE: kendi kaydı bulunduğunda hem workoutExerciseLogs hem workoutSessions silinirken user_id şartını korumalı', async () => {
      const recorded = setupMockDb(new Map([[schema.workoutSessions, [{ id: 'wk-own-1', user_id: 'user-master-1' }]]]));

      const res = await postWorkouts(
        new Request('http://localhost:3000/api/health/workouts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', workout_id: 'wk-own-1' }),
        })
      );
      expect(res.status).toBe(200);

      const logDelete = recorded.find(r => r.op === 'delete' && r.table === schema.workoutExerciseLogs);
      const sessionDelete = recorded.find(r => r.op === 'delete' && r.table === schema.workoutSessions);
      expect(logDelete?.sql).toContain('"workout_exercise_logs"."user_id" =');
      expect(sessionDelete?.sql).toContain('"workout_sessions"."user_id" =');
    });

    it('strava/callback GET: admin/master kullanıcıda bile global strava_access_token üzerine yazmamalı, sadece user-scoped anahtarları kaydetmeli', async () => {
      const recorded = setupMockDb();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'strava-acc',
          refresh_token: 'strava-ref',
          expires_at: 1893456000,
          athlete: { id: 42, firstname: 'Uğur', lastname: 'Test' },
        }),
      }) as unknown as typeof fetch;

      const res = await getStravaCallback(
        new Request('http://localhost:3000/api/health/workouts/strava/callback?code=auth-code&state=user-master-1:nonce-123')
      );
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/health?strava=connected');

      const insertedKeys = recorded
        .filter(r => r.op === 'insert' && r.table === schema.appSettings)
        .map(r => (r.values as { key: string }).key);

      expect(insertedKeys).toEqual([
        'strava_access_token_user-master-1',
        'strava_refresh_token_user-master-1',
        'strava_expires_at_user-master-1',
        'strava_athlete_id_user-master-1',
        'strava_athlete_name_user-master-1',
      ]);
      expect(insertedKeys).not.toContain('strava_access_token');
      expect(insertedKeys).not.toContain('strava_refresh_token');
    });

    it('diet GET: genel şablon sorgusunda hem user_id is null hem family_id is null koşullarını zorunlu tutmalı', async () => {
      const recorded = setupMockDb(new Map([[schema.dietMealOptions, []]]));

      const res = await getDietOptions();
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.success).toBe(true);

      const selectOp = recorded.find(r => r.op === 'select' && r.table === schema.dietMealOptions);
      expect(selectOp).toBeDefined();
      expect(selectOp?.sql).toContain('"diet_meal_options"."user_id" is null');
      expect(selectOp?.sql).toContain('"diet_meal_options"."family_id" is null');
    });

    it('delete-account & reset-user-data: dietMealOptions tablosunu da kapsayacak şekilde atomik temizlik yapmalı', async () => {
      const recordedDelete = setupMockDb();
      const delRes = await postDeleteAccount(
        new Request('http://localhost:3000/api/auth/delete-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: 'secret' }),
        })
      );
      expect(delRes.status).toBe(200);
      expect(recordedDelete.some(r => r.op === 'delete' && r.table === schema.dietMealOptions)).toBe(true);

      const recordedReset = setupMockDb();
      const resetRes = await postResetUserData(
        new Request('http://localhost:3000/api/auth/reset-user-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scope: 'family' }),
        })
      );
      expect(resetRes.status).toBe(200);
      expect(recordedReset.some(r => r.op === 'delete' && r.table === schema.dietMealOptions)).toBe(true);
    });
  });

  describe('🧮 Matematik, Sınır Koruması & Europe/Istanbul Takvim Doğruluğu', () => {
    it('nutrition POST (update_profile): explicit 0 makro hedeflerini korumalı ve günlük su hedefini 10000 ml üst sınırına çekmeli', async () => {
      const recorded = setupMockDb(new Map([[schema.userHealthProfile, [{ id: 'hp-1', user_id: 'user-master-1' }]]]));

      const res = await postNutrition(
        new Request('http://localhost:3000/api/health/nutrition', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_profile',
            target_calories: 1800,
            target_protein_g: 0,
            target_carbs_g: 0,
            target_fat_g: 0,
            daily_water_target_ml: 99999,
          }),
        })
      );

      expect(res.status).toBe(200);
      const updateOp = recorded.find(r => r.op === 'update' && r.table === schema.userHealthProfile);
      const vals = updateOp?.values as Record<string, unknown>;
      expect(vals.target_protein_g).toBe(0);
      expect(vals.target_carbs_g).toBe(0);
      expect(vals.target_fat_g).toBe(0);
      expect(vals.daily_water_target_ml).toBe(10000);
    });

    it('nutrition POST (add_meal): negatif kalori/makro girdilerini 0 ile sınırlamalı ve DIET_MEAL_RECORDED olayında familyId yayınlamalı', async () => {
      const recorded = setupMockDb();

      const res = await postNutrition(
        new Request('http://localhost:3000/api/health/nutrition', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            meal_type: 'Kahvaltı',
            name: 'Test Öğünü',
            calories: -350,
            protein_g: -12,
            carbs_g: -30,
            fat_g: -8,
            portion_multiplier: -2,
          }),
        })
      );

      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.success).toBe(true);

      const insertOp = recorded.find(r => r.op === 'insert' && r.table === schema.nutritionMeals);
      const inserted = insertOp?.values as Record<string, unknown>;
      expect(inserted.calories).toBe(0);
      expect(inserted.protein_g).toBe(0);
      expect(inserted.carbs_g).toBe(0);
      expect(inserted.fat_g).toBe(0);
      expect(inserted.portion_multiplier).toBe(1);

      expect(mockEmitEvent).toHaveBeenCalledWith(
        'diet.meal_recorded',
        expect.objectContaining({
          userId: 'user-master-1',
          familyId: 'fam-1',
        })
      );
    });

    it('water POST: negatif amount_ml gönderildiğinde günlük su tüketimini düşürmemeli (0 ml olarak sınırlamalı)', async () => {
      const recorded = setupMockDb(
        new Map<unknown, unknown[]>([
          [schema.waterIntakeLogs, [{ id: 'w-1', user_id: 'user-master-1', amount_ml: 750, goal_ml: 2500 }]],
          [schema.userHealthProfile, [{ id: 'hp-1', user_id: 'user-master-1', daily_water_target_ml: 2500, consumed_water_ml: 750 }]],
        ])
      );

      const res = await postWater(
        new Request('http://localhost:3000/api/health/water', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount_ml: -500 }),
        })
      );

      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.consumed_ml).toBe(750);

      const waterUpdate = recorded.find(r => r.op === 'update' && r.table === schema.waterIntakeLogs);
      expect((waterUpdate?.values as { amount_ml: number }).amount_ml).toBe(750);
    });

    it('fasting POST: sayısal protokol saatlerini 1..168 saat aralığında sınırlandırmalı', async () => {
      const recorded = setupMockDb(new Map([[schema.fastingSessions, []]]));

      const res = await postFasting(
        new Request('http://localhost:3000/api/health/fasting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'start', protocol: 999 }),
        })
      );

      expect(res.status).toBe(200);
      const insertOp = recorded.find(r => r.op === 'insert' && r.table === schema.fastingSessions);
      const vals = insertOp?.values as { start_time: string; target_end_time: string };
      const diffHours = Math.round((new Date(vals.target_end_time).getTime() - new Date(vals.start_time).getTime()) / (1000 * 60 * 60));
      expect(diffHours).toBe(168);
    });

    it('nutrition-profile GET: geçersiz gramajı düzeltmeli, AI çıktısını 100g canonical olarak user.id ile kaydedip istenen gramaja ölçeklemeli', async () => {
      process.env.GEMINI_API_KEY = 'test-gemini-key';
      const recorded = setupMockDb(new Map([[schema.foodNutrientProfiles, []]]));

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      food_name: 'Egzotik Quinoa Kasesi',
                      portion_g: 100,
                      macros: [
                        { label: 'Enerji (Kalori)', value: '120 kcal', daily_percent: 6 },
                        { label: 'Protein', value: '4.4 g', daily_percent: 9 },
                      ],
                      vitamins: [],
                      minerals: [],
                      special_compounds: [],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      }) as unknown as typeof fetch;

      expect(RESILIENT_GEMINI_MODELS.every(m => !m.includes('gemini-3.5'))).toBe(true);

      const res = await getNutritionProfile(
        new Request('http://localhost:3000/api/health/nutrition-profile?food_name=Egzotik+Quinoa+Kasesi&grams=250')
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.portion_g).toBe(250);
      expect(json.data.categories.portion_g).toBe(250);
      expect(json.data.categories.macros[0].value).toContain('300');

      const insertOp = recorded.find(r => r.op === 'insert' && r.table === schema.foodNutrientProfiles);
      expect(insertOp).toBeDefined();
      expect((insertOp?.values as { portion_g: number; user_id: string }).portion_g).toBe(100);
      expect((insertOp?.values as { user_id: string }).user_id).toBe('user-master-1');

      const clampedRes = await getNutritionProfile(
        new Request('http://localhost:3000/api/health/nutrition-profile?food_name=Egzotik+Quinoa+Kasesi&grams=99999')
      );
      const clampedJson = await clampedRes.json();
      expect(clampedJson.data.portion_g).toBe(5000);
    });

    it('workouts POST (create): tarih ve saat verilmediğinde UTC değil Europe/Istanbul tarih ve saatini kullanmalı', async () => {
      vi.useFakeTimers();
      // UTC: 2026-11-18 22:15Z -> Istanbul (UTC+3): 2026-11-19 01:15
      vi.setSystemTime(new Date('2026-11-18T22:15:00.000Z'));

      const recorded = setupMockDb();
      const res = await postWorkouts(
        new Request('http://localhost:3000/api/health/workouts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            title: 'Gece Koşusu',
            category: 'running',
            duration_minutes: 30,
          }),
        })
      );

      expect(res.status).toBe(200);
      const insertOp = recorded.find(r => r.op === 'insert' && r.table === schema.workoutSessions);
      const inserted = insertOp?.values as { date: string; start_time: string };
      expect(inserted.date).toBe('2026-11-19');
      expect(inserted.start_time).toBe('01:15');
    });

    it('calculateFastingHistoryAnalytics: 22:30Z (TR 01:30 ertesi gün) biten orucu Europe/Istanbul günü ve ayı altında gruplamalı', () => {
      const refDate = new Date('2026-11-19T10:00:00.000Z');
      const analytics = calculateFastingHistoryAnalytics(
        [
          {
            id: 'f-midnight-tr',
            protocol: '16:8',
            start_time: '2026-11-18T06:30:00.000Z',
            target_end_time: '2026-11-18T22:30:00.000Z',
            actual_end_time: '2026-11-18T22:30:00.000Z',
            is_active: 0,
            created_at: '2026-11-18T06:30:00.000Z',
          },
          {
            id: 'f-month-rollover-tr',
            protocol: '16:8',
            start_time: '2026-10-31T06:00:00.000Z',
            target_end_time: '2026-10-31T22:00:00.000Z',
            actual_end_time: '2026-10-31T22:30:00.000Z', // 2026-11-01 01:30 TR -> Kasım ayına sayılmalı
            is_active: 0,
            created_at: '2026-10-31T06:00:00.000Z',
          },
        ],
        refDate
      );

      expect(analytics.totalCompletedSessions).toBe(2);
      // 16 + 16.5 = 32.5 saat her ikisi de Kasım (TR) ayında sayılmalı
      expect(analytics.currentMonthFastingHours).toBe(32.5);
      const nov19Bar = analytics.dailyFastingHours.find(b => b.date === '2026-11-19');
      expect(nov19Bar?.fastingHours).toBe(16);
      expect(nov19Bar?.sessionsCount).toBe(1);
      const nov18Bar = analytics.dailyFastingHours.find(b => b.date === '2026-11-18');
      expect(nov18Bar?.fastingHours).toBe(0);
    });
  });

  describe('🧩 Çoklu Aile Üyesi İzolasyonu & Kanallar Arası Su Senkronizasyonu (Opsiyonel İyileştirmeler)', () => {
    it('water GET/POST: yetkisiz member_id 403 döndürmeli; aile üyesi için ayrı profil ve su günlüğü izole edilmelidir', async () => {
      setupMockDb(new Map<unknown, unknown[]>([[schema.familyMembers, []]]));

      const unauthGet = await getWater(new Request('http://localhost:3000/api/health/water?member_id=foreign-mem'));
      expect(unauthGet.status).toBe(403);

      const unauthPost = await postWater(
        new Request('http://localhost:3000/api/health/water', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount_ml: 250, member_id: 'foreign-mem' }),
        })
      );
      expect(unauthPost.status).toBe(403);

      const recorded = setupMockDb(
        new Map<unknown, unknown[]>([
          [schema.familyMembers, [{ id: 'fm-spouse', user_id: null, family_id: 'fam-1' }]],
          [schema.userHealthProfile, []],
          [schema.waterIntakeLogs, []],
        ])
      );

      const res = await postWater(
        new Request('http://localhost:3000/api/health/water', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount_ml: 300, member_id: 'fm-spouse' }),
        })
      );
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.consumed_ml).toBe(300);

      const profileInsert = recorded.find(r => r.op === 'insert' && r.table === schema.userHealthProfile);
      expect((profileInsert?.values as { id: string; member_id: string }).id).toBe('hp-user-master-1-fm-spouse');
      expect((profileInsert?.values as { member_id: string }).member_id).toBe('fm-spouse');

      const logInsert = recorded.find(r => r.op === 'insert' && r.table === schema.waterIntakeLogs);
      expect((logInsert?.values as { member_id: string; amount_ml: number }).member_id).toBe('fm-spouse');
      expect((logInsert?.values as { amount_ml: number }).amount_ml).toBe(300);
    });

    it('fasting GET/POST & history GET: yetkisiz member_id 403 döndürmeli ve seçili üyenin oruç seansını izole etmelidir', async () => {
      setupMockDb(new Map<unknown, unknown[]>([[schema.familyMembers, []]]));

      expect((await getFasting(new Request('http://localhost:3000/api/health/fasting?member_id=other'))).status).toBe(403);
      expect((await getFastingHistory(new Request('http://localhost:3000/api/health/fasting/history?member_id=other'))).status).toBe(403);

      const recorded = setupMockDb(
        new Map<unknown, unknown[]>([
          [schema.familyMembers, [{ id: 'fm-spouse', user_id: null, family_id: 'fam-1' }]],
          [schema.fastingSessions, []],
        ])
      );

      const startRes = await postFasting(
        new Request('http://localhost:3000/api/health/fasting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'start', protocol: '18:6', member_id: 'fm-spouse' }),
        })
      );
      expect(startRes.status).toBe(200);

      const closeOp = recorded.find(r => r.op === 'update' && r.table === schema.fastingSessions);
      expect(closeOp?.sql).toContain('"fasting_sessions"."member_id" =');
      expect(closeOp?.params).toContain('fm-spouse');

      const insertOp = recorded.find(r => r.op === 'insert' && r.table === schema.fastingSessions);
      expect((insertOp?.values as { member_id: string }).member_id).toBe('fm-spouse');
    });

    it('telegram (/su) & voice-command (water): hem userHealthProfile.consumed_water_ml hem bugünkü waterIntakeLogs kaydını eşzamanlı günceller', async () => {
      const prevTgSecret = process.env.TELEGRAM_SECRET_TOKEN;
      process.env.TELEGRAM_SECRET_TOKEN = 'tg-sec-test';

      try {
        // Profilde dünden 2000 ml kalmış olsa bile bugün için waterIntakeLogs boşsa 0 + 500 = 500 ml yazılmalı
        const tgRecorded = setupMockDb(
          new Map<unknown, unknown[]>([
            [
              schema.users,
              [
                {
                  id: 'user-master-1',
                  family_id: 'fam-1',
                  telegram_chat_id: '555666',
                  telegram_secret_token: 'tg-sec-test',
                },
              ],
            ],
            [schema.userHealthProfile, [{ id: 'hp-1', user_id: 'user-master-1', consumed_water_ml: 2000, daily_water_target_ml: 2500 }]],
            [schema.waterIntakeLogs, []],
          ])
        );

        const tgRes = await postTelegram(
          new Request('http://localhost:3000/api/telegram', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-telegram-bot-api-secret-token': 'tg-sec-test',
            },
            body: JSON.stringify({
              message: { chat: { id: 555666 }, text: '/su 500' },
            }),
          })
        );
        const tgJson = await tgRes.json();
        expect(tgRes.status).toBe(200);
        expect(tgJson.replied).toContain('500 ml');

        const tgProfileUpdate = tgRecorded.find(r => r.op === 'update' && r.table === schema.userHealthProfile);
        expect((tgProfileUpdate?.values as { consumed_water_ml: number }).consumed_water_ml).toBe(500);

        const tgLogInsert = tgRecorded.find(r => r.op === 'insert' && r.table === schema.waterIntakeLogs);
        expect(tgLogInsert).toBeDefined();
        expect((tgLogInsert?.values as { amount_ml: number }).amount_ml).toBe(500);

        // Sesli komutta bugünkü log (500 ml) üzerine +350 ml eklendiğinde 850 ml olarak güncellenmeli
        const voiceRecorded = setupMockDb(
          new Map<unknown, unknown[]>([
            [schema.userHealthProfile, [{ id: 'hp-1', user_id: 'user-master-1', consumed_water_ml: 500, daily_water_target_ml: 2500 }]],
            [schema.waterIntakeLogs, [{ id: 'w-today', user_id: 'user-master-1', amount_ml: 500, goal_ml: 2500 }]],
          ])
        );

        const voiceRes = await postVoiceCommand(
          new Request('http://localhost:3000/api/voice-command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'execute',
              actions: [{ type: 'water', title: 'Su İçimi', icon: '💧', details: { amount_ml: 350 } }],
            }),
          })
        );
        const voiceJson = await voiceRes.json();
        expect(voiceRes.status).toBe(200);
        expect(voiceJson.success).toBe(true);

        const voiceProfileUpdate = voiceRecorded.find(r => r.op === 'update' && r.table === schema.userHealthProfile);
        expect((voiceProfileUpdate?.values as { consumed_water_ml: number }).consumed_water_ml).toBe(850);
        const voiceLogUpdate = voiceRecorded.find(r => r.op === 'update' && r.table === schema.waterIntakeLogs);
        expect((voiceLogUpdate?.values as { amount_ml: number }).amount_ml).toBe(850);
      } finally {
        if (prevTgSecret === undefined) delete process.env.TELEGRAM_SECRET_TOKEN;
        else process.env.TELEGRAM_SECRET_TOKEN = prevTgSecret;
      }
    });

    it('workouts, scan-food ve nutrition profili aile üyesi (member_id) filtresi & BOLA yetki kontrolünü desteklemeli', async () => {
      setupMockDb(new Map<unknown, unknown[]>([[schema.familyMembers, []]]));

      expect((await getWorkouts(new Request('http://localhost:3000/api/health/workouts?member_id=other'))).status).toBe(403);
      expect((await getScanFood(new Request('http://localhost:3000/api/health/scan-food?member_id=other'))).status).toBe(403);
      expect((await getNutrition(new Request('http://localhost:3000/api/health/nutrition?member_id=other'))).status).toBe(403);

      const recorded = setupMockDb(
        new Map<unknown, unknown[]>([
          [schema.familyMembers, [{ id: 'fm-spouse', user_id: null, family_id: 'fam-1' }]],
          [schema.userHealthProfile, []],
          [schema.waterIntakeLogs, []],
          [schema.workoutSessions, []],
          [schema.nutritionMeals, []],
        ])
      );

      // Antrenman oluşturma member_id kaydetmeli
      const wkRes = await postWorkouts(
        new Request('http://localhost:3000/api/health/workouts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            member_id: 'fm-spouse',
            title: 'Pilates Seansı',
            sport_type: 'other',
            duration_minutes: 40,
          }),
        })
      );
      expect(wkRes.status).toBe(200);
      const wkInsert = recorded.find(r => r.op === 'insert' && r.table === schema.workoutSessions);
      expect((wkInsert?.values as { member_id: string }).member_id).toBe('fm-spouse');

      // Paketli gıda taraması member_id kaydetmeli
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
      const scanRes = await postScanFood(
        new Request('http://localhost:3000/api/health/scan-food', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'packaged_barcode',
            barcode_text: '8690123456789',
            member_id: 'fm-spouse',
          }),
        })
      );
      expect(scanRes.status).toBe(200);
      const scanInsert = recorded.find(r => r.op === 'insert' && r.table === schema.packagedFoodScans);
      expect((scanInsert?.values as { member_id: string }).member_id).toBe('fm-spouse');

      // Seçili üyenin profil hedefleri ayrı profile (hp-user-master-1-fm-spouse) kaydedilmeli ve açık 0 hedefler summary'de korunmalı
      const profRes = await postNutrition(
        new Request('http://localhost:3000/api/health/nutrition', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_profile',
            member_id: 'fm-spouse',
            daily_calorie_target: 1650,
            target_protein_g: 110,
            target_carbs_g: 0,
            target_fat_g: 60,
            daily_water_target_ml: 2200,
          }),
        })
      );
      expect(profRes.status).toBe(200);
      const hpInsert = recorded.find(r => r.op === 'insert' && r.table === schema.userHealthProfile);
      expect((hpInsert?.values as { id: string; member_id: string; target_carbs_g: number }).id).toBe(
        'hp-user-master-1-fm-spouse'
      );
      expect((hpInsert?.values as { member_id: string }).member_id).toBe('fm-spouse');
      expect((hpInsert?.values as { target_carbs_g: number }).target_carbs_g).toBe(0);
    });
  });
});
