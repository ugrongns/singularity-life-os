import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { PgDialect } from 'drizzle-orm/pg-core';
import * as schema from '../src/db/schema';
import {
  calculateKeyResultProgress,
  calculateObjectiveProgress,
  getDefaultOkrPeriod,
  getVisionPillarMeta,
  summarizeOkrConfidence,
} from '../src/lib/okr-engine';

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
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

import { GET, POST } from '../src/app/api/okr/route';

function setupMockDb(tableRows: Map<unknown, unknown[]>) {
  const dialect = new PgDialect();
  const recordedQueries: Array<{ table: unknown; sql: string; params: unknown[] }> = [];
  const insertedRows: Array<{ table: unknown; values: unknown }> = [];
  const updatedRows: Array<{ table: unknown; set: unknown }> = [];

  mockSelect.mockImplementation(() => {
    let currentTable: unknown = null;
    let rows: unknown[] = [];

    const chain: Record<string, unknown> = {
      from: (table: unknown) => {
        currentTable = table;
        rows = tableRows.get(table) ?? [];
        return chain;
      },
      where: (expr: unknown) => {
        try {
          const compiled = dialect.sqlToQuery(expr as never);
          recordedQueries.push({ table: currentTable, sql: compiled.sql, params: compiled.params });
        } catch {
          recordedQueries.push({ table: currentTable, sql: String(expr), params: [] });
        }
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
    values: (values: unknown) => {
      insertedRows.push({ table, values });
      return Promise.resolve([]);
    },
  }));

  mockUpdate.mockImplementation((table: unknown) => ({
    set: (set: unknown) => ({
      where: () => {
        updatedRows.push({ table, set });
        return Promise.resolve([]);
      },
    }),
  }));

  mockDelete.mockImplementation(() => ({
    where: () => Promise.resolve([]),
  }));

  mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      insert: (table: unknown) => ({
        values: (values: unknown) => {
          insertedRows.push({ table, values });
          return Promise.resolve([]);
        },
      }),
      update: (table: unknown) => ({
        set: (set: unknown) => ({
          where: () => {
            updatedRows.push({ table, set });
            return Promise.resolve([]);
          },
        }),
      }),
    };
    return fn(tx);
  });

  return { recordedQueries, insertedRows, updatedRows };
}

describe('🎯 OKR Engine Matematik & Yardımcı Testleri', () => {
  it('getDefaultOkrPeriod geçerli tarihlerden doğru çeyreği döndürür ve geçersiz tarihte 2026-Q4 düşer', () => {
    expect(getDefaultOkrPeriod('2026-02-15')).toBe('2026-Q1');
    expect(getDefaultOkrPeriod('2026-05-01')).toBe('2026-Q2');
    expect(getDefaultOkrPeriod('2026-08-20')).toBe('2026-Q3');
    expect(getDefaultOkrPeriod('2026-11-19')).toBe('2026-Q4');
    expect(getDefaultOkrPeriod('invalid')).toBe('2026-Q4');
  });

  it('getVisionPillarMeta bilinen sütunu döndürür, bilinmeyende kariyer sütununa düşer', () => {
    expect(getVisionPillarMeta('pillar_health').id).toBe('pillar_health');
    expect(getVisionPillarMeta('unknown_pillar').id).toBe('pillar_career');
  });

  it('calculateKeyResultProgress artan, azalan (target=0 dahil), eşit ve boolean KR değerlerini doğru hesaplar', () => {
    expect(
      calculateKeyResultProgress({ kr_type: 'numeric', start_value: 0, target_value: 100, current_value: 45 })
    ).toBe(45);

    // Azalan hedef: 10 -> 0 (mevcut 5 => %50)
    expect(
      calculateKeyResultProgress({ kr_type: 'numeric', start_value: 10, target_value: 0, current_value: 5 })
    ).toBe(50);

    // Azalan hedefte sınır aşımı clamping (0..100)
    expect(
      calculateKeyResultProgress({ kr_type: 'numeric', start_value: 90, target_value: 80, current_value: 95 })
    ).toBe(0);
    expect(
      calculateKeyResultProgress({ kr_type: 'numeric', start_value: 90, target_value: 80, current_value: 75 })
    ).toBe(100);

    // Sıfıra bölünme koruması (start === target)
    expect(
      calculateKeyResultProgress({ kr_type: 'numeric', start_value: 10, target_value: 10, current_value: 10 })
    ).toBe(100);
    expect(
      calculateKeyResultProgress({ kr_type: 'numeric', start_value: 10, target_value: 10, current_value: 5 })
    ).toBe(0);

    // Boolean KR
    expect(
      calculateKeyResultProgress({ kr_type: 'boolean', start_value: 0, target_value: 1, current_value: 0 })
    ).toBe(0);
    expect(
      calculateKeyResultProgress({ kr_type: 'boolean', start_value: 0, target_value: 1, current_value: 1 })
    ).toBe(100);
  });

  it('calculateObjectiveProgress ağırlıklı ortalama hesaplar ve boş/geçersiz ağırlıkları güvenle yönetir', () => {
    expect(calculateObjectiveProgress([])).toBe(0);

    // KR1: %100 (ağırlık 3), KR2: %0 (ağırlık 1) => 300 / 4 = %75
    expect(
      calculateObjectiveProgress([
        { kr_type: 'numeric', start_value: 0, target_value: 10, current_value: 10, weight: 3 },
        { kr_type: 'numeric', start_value: 0, target_value: 10, current_value: 0, weight: 1 },
      ])
    ).toBe(75);

    // Ağırlık 0 veya negatif ise 1 kabul edilir
    expect(
      calculateObjectiveProgress([
        { kr_type: 'numeric', start_value: 0, target_value: 10, current_value: 10, weight: 0 },
        { kr_type: 'numeric', start_value: 0, target_value: 10, current_value: 0, weight: -2 },
      ])
    ).toBe(50);
  });

  it('summarizeOkrConfidence genel ilerleme ve güven dağılımını doğru özetler', () => {
    const summary = summarizeOkrConfidence([
      {
        id: 'o1',
        user_id: 'u1',
        pillar_id: 'pillar_health',
        period: '2026-Q4',
        title: 'Hedef 1',
        status: 'completed',
        confidence: 'on_track',
        is_family_shared: 0,
        keyResults: [
          {
            id: 'k1',
            objective_id: 'o1',
            user_id: 'u1',
            title: 'KR 1',
            kr_type: 'numeric',
            start_value: 0,
            target_value: 10,
            current_value: 10,
            unit: 'adet',
            weight: 1,
            confidence: 'on_track',
          },
        ],
      },
      {
        id: 'o2',
        user_id: 'u1',
        pillar_id: 'pillar_career',
        period: '2026-Q4',
        title: 'Hedef 2',
        status: 'in_progress',
        confidence: 'at_risk',
        is_family_shared: 0,
        keyResults: [
          {
            id: 'k2',
            objective_id: 'o2',
            user_id: 'u1',
            title: 'KR 2',
            kr_type: 'numeric',
            start_value: 0,
            target_value: 10,
            current_value: 2,
            unit: 'adet',
            weight: 1,
            confidence: 'at_risk',
          },
        ],
      },
    ]);

    expect(summary).toEqual({
      totalObjectives: 2,
      completedObjectives: 1,
      averageProgress: 60,
      onTrackCount: 1,
      needsAttentionCount: 0,
      atRiskCount: 1,
    });
  });
});

describe('🔐 /api/okr Yetki, Aile İzolasyonu, Check-in ve Canlı Metrik Testleri', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET ve POST yetkisiz isteklerde 401 dönmelidir', async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const getRes = await GET(new NextRequest('http://localhost/api/okr?period=2026-Q4'));
    const postRes = await POST(
      new NextRequest('http://localhost/api/okr', {
        method: 'POST',
        body: JSON.stringify({ action: 'create_objective', title: 'Test' }),
      })
    );

    expect(getRes.status).toBe(401);
    expect(postRes.status).toBe(401);
  });

  it('GET currentUserId döndürür ve habit_logs sorgusunda is_completed = 1 filtresini uygular', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'user-1', family_id: 'fam-1' });
    const { recordedQueries } = setupMockDb(
      new Map<unknown, unknown[]>([
        [schema.okrObjectives, []],
        [schema.books, [{ id: 'b1', finish_date: '2026-04-10' }]],
        [schema.sinkingFunds, [{ current_amount: 12500.4 }]],
        [schema.workoutSessions, [{ id: 'w1' }, { id: 'w2' }]],
        [schema.tasks, [{ id: 't1', completed_at: '2099-01-01T00:00:00.000Z' }]],
        [schema.habitLogs, [{ id: 'h1' }, { id: 'h2' }, { id: 'h3' }]],
      ])
    );

    const res = await GET(new NextRequest('http://localhost/api/okr?period=2026-Q4'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.currentUserId).toBe('user-1');
    expect(json.data.liveMetrics).toEqual({
      books_year: 1,
      sinking_fund: 12500,
      workouts_30d: 2,
      tasks_30d: 1,
      habits_score: 3,
    });

    const habitQuery = recordedQueries.find((q) => q.table === schema.habitLogs);
    expect(habitQuery).toBeDefined();
    expect(habitQuery?.sql).toContain('"habit_logs"."is_completed"');
    expect(habitQuery?.params).toContain(1);
  });

  it('POST create_kr target_value=0 değerini 100 ile ezmeden korur', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'user-1', family_id: 'fam-1' });
    const { insertedRows } = setupMockDb(
      new Map<unknown, unknown[]>([[schema.okrObjectives, [{ id: 'obj-1' }]]])
    );

    const res = await POST(
      new NextRequest('http://localhost/api/okr', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create_kr',
          objective_id: 'obj-1',
          title: 'Geciken görev sayısını sıfırla',
          start_value: 10,
          current_value: 4,
          target_value: 0,
          unit: 'adet',
          weight: 2,
        }),
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.target_value).toBe(0);
    expect(json.data.start_value).toBe(10);
    expect(json.data.current_value).toBe(4);
    expect(insertedRows).toHaveLength(1);
  });

  it('POST record_check_in geçersiz sayıları 400 ile reddeder ve geçerli check-in işlemini db.transaction içinde atomik yürütür', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'user-1', family_id: 'fam-1' });
    const { insertedRows, updatedRows } = setupMockDb(
      new Map<unknown, unknown[]>([
        [
          schema.okrKeyResults,
          [{ id: 'kr-1', user_id: 'user-1', current_value: 20, confidence: 'on_track' }],
        ],
      ])
    );

    const badRes = await POST(
      new NextRequest('http://localhost/api/okr', {
        method: 'POST',
        body: JSON.stringify({
          action: 'record_check_in',
          key_result_id: 'kr-1',
          new_value: '',
        }),
      })
    );
    expect(badRes.status).toBe(400);
    expect(mockTransaction).not.toHaveBeenCalled();

    const okRes = await POST(
      new NextRequest('http://localhost/api/okr', {
        method: 'POST',
        body: JSON.stringify({
          action: 'record_check_in',
          key_result_id: 'kr-1',
          new_value: 55,
          confidence: 'needs_attention',
          note: 'İyi ilerleme',
        }),
      })
    );
    const okJson = await okRes.json();

    expect(okRes.status).toBe(200);
    expect(okJson.success).toBe(true);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(insertedRows).toHaveLength(1);
    expect(updatedRows).toHaveLength(1);
    expect(okJson.data.previous_value).toBe(20);
    expect(okJson.data.new_value).toBe(55);
  });

  it('POST BOLA: başka kullanıcının hedef veya KR kaydında update/delete/check-in 404 dönmelidir', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'user-2', family_id: 'fam-1' });
    setupMockDb(new Map<unknown, unknown[]>());

    for (const payload of [
      { action: 'update_objective', id: 'obj-1', title: 'Hack' },
      { action: 'delete_objective', id: 'obj-1' },
      { action: 'create_kr', objective_id: 'obj-1', title: 'Hack KR' },
      { action: 'delete_kr', id: 'kr-1' },
      { action: 'record_check_in', key_result_id: 'kr-1', new_value: 99 },
    ]) {
      const res = await POST(
        new NextRequest('http://localhost/api/okr', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
      );
      expect(res.status).toBe(404);
    }
  });
});
