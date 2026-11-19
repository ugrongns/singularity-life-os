import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import * as schema from '../src/db/schema';

const {
  mockGetAuthUser,
  mockFetchLiveExchangeRates,
  mockSelect,
  mockInsert,
  mockUpdate,
  mockDelete,
  mockTransaction,
} = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockFetchLiveExchangeRates: vi.fn(),
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getAuthUser: mockGetAuthUser,
  verifyPassword: vi.fn().mockResolvedValue(true),
  clearAuthSessionCache: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ delete: vi.fn() }),
}));

vi.mock('@/lib/market-data', () => ({
  fetchLiveExchangeRates: mockFetchLiveExchangeRates,
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

import { GET as getBudget } from '../src/app/api/budget/route';
import { POST as postTransaction, DELETE as deleteTransaction } from '../src/app/api/transactions/route';
import { POST as postAccount } from '../src/app/api/budget/accounts/route';
import { POST as postCategory, DELETE as deleteCategory } from '../src/app/api/budget/categories/route';
import { GET as getCategoryDetails } from '../src/app/api/budget/category-details/route';
import { PATCH as patchRecurringBill } from '../src/app/api/budget/recurring-bills/route';
import { POST as postDeleteAccount } from '../src/app/api/auth/delete-account/route';
import {
  GET as getPersonalDebts,
  POST as postPersonalDebt,
  DELETE as deletePersonalDebt,
} from '../src/app/api/budget/personal-debts/route';
import { getTodayTurkeyDate } from '../src/lib/date-utils';

type TableDataMap = Map<unknown, unknown[][]>;

function createMockDbHarness(tableQueues: TableDataMap) {
  const inserted: Array<{ table: unknown; values: unknown }> = [];
  const updated: Array<{ table: unknown; set: unknown; whereSql: string }> = [];
  const deleted: Array<{ table: unknown; whereSql: string }> = [];
  const selectedWhereSql: Array<{ table: unknown; whereSql: string }> = [];
  const dialect = new PgDialect();

  const renderSql = (expr: unknown) => {
    if (!expr) return '';
    try {
      return dialect.sqlToQuery(expr as never).sql;
    } catch {
      return String(expr);
    }
  };

  const renderQuery = (expr: unknown) => {
    if (!expr) return { sql: '', params: [] as unknown[] };
    try {
      const q = dialect.sqlToQuery(expr as never);
      return { sql: q.sql, params: q.params };
    } catch {
      return { sql: String(expr), params: [] as unknown[] };
    }
  };

  const makeSelect = () => {
    let currentTable: unknown = null;
    let currentRows: unknown[] = [];

    const chain: Record<string, unknown> = {
      from: (table: unknown) => {
        currentTable = table;
        const queue = tableQueues.get(table);
        if (queue && queue.length > 0) {
          currentRows = queue.length > 1 ? (queue.shift() ?? []) : (queue[0] ?? []);
        } else {
          currentRows = [];
        }
        return chain;
      },
      innerJoin: () => chain,
      leftJoin: () => chain,
      where: (expr: unknown) => {
        selectedWhereSql.push({ table: currentTable, whereSql: renderSql(expr) });
        return chain;
      },
      orderBy: () => chain,
      limit: () => Promise.resolve(currentRows),
      for: () => Promise.resolve(currentRows),
      then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve(currentRows).then(onFulfilled, onRejected),
    };
    return chain;
  };

  const makeInsert = (table: unknown) => ({
    values: (vals: unknown) => {
      inserted.push({ table, values: vals });
      const resolved = Array.isArray(vals) ? vals : [vals];
      const ret: Record<string, unknown> = {
        onConflictDoNothing: () => Promise.resolve(resolved),
        then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
          Promise.resolve(resolved).then(onFulfilled, onRejected),
      };
      return ret;
    },
  });

  const makeUpdate = (table: unknown) => {
    let lastSet: unknown = null;
    const chain: Record<string, unknown> = {
      set: (vals: unknown) => {
        lastSet = vals;
        return chain;
      },
      where: (expr: unknown) => {
        const rendered = renderQuery(expr);
        updated.push({ table, set: lastSet, whereSql: `${rendered.sql} | ${JSON.stringify(rendered.params)}` });
        return Promise.resolve([]);
      },
    };
    return chain;
  };

  const makeDelete = (table: unknown) => ({
    where: (expr: unknown) => {
      const rendered = renderQuery(expr);
      deleted.push({ table, whereSql: `${rendered.sql} | ${JSON.stringify(rendered.params)}` });
      return Promise.resolve([]);
    },
  });

  mockSelect.mockImplementation(() => makeSelect());
  mockInsert.mockImplementation((table: unknown) => makeInsert(table));
  mockUpdate.mockImplementation((table: unknown) => makeUpdate(table));
  mockDelete.mockImplementation((table: unknown) => makeDelete(table));
  mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
    cb({
      select: () => makeSelect(),
      insert: (table: unknown) => makeInsert(table),
      update: (table: unknown) => makeUpdate(table),
      delete: (table: unknown) => makeDelete(table),
    })
  );

  return { inserted, updated, deleted, selectedWhereSql };
}

const mockUser = {
  id: 'user-1',
  username: 'ugur',
  display_name: 'Uğur',
  family_id: 'fam-1',
  role: 'admin',
  is_master_account: 1,
};

describe('💰 Bütçe Modülü (!denetle bütçe) Regresyon & Güvenlik Testleri', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUser.mockResolvedValue(mockUser);
    mockFetchLiveExchangeRates.mockResolvedValue({
      USD_TRY: 38.0,
      EUR_TRY: 41.0,
      GBP_TRY: 48.0,
      GOLD_GRAM_TRY: 3200.0,
      BTC_TRY: 3200000.0,
      source: 'live',
      updatedAt: '2026-11-18T12:00:00.000Z',
    });
  });

  it('GET /api/budget: kurlar unavailable/0 iken NaN/Infinity üretmez, mevduat faizini gelir sayar ve son işlemleri zenginleştirir', async () => {
    const todayStr = getTodayTurkeyDate();
    const currentMonth = todayStr.slice(0, 7);

    mockFetchLiveExchangeRates.mockResolvedValue({
      USD_TRY: 0,
      EUR_TRY: 0,
      GBP_TRY: 0,
      GOLD_GRAM_TRY: 0,
      BTC_TRY: 0,
      source: 'unavailable',
      updatedAt: '2026-11-18T12:00:00.000Z',
    });

    const fillerTxs = Array.from({ length: 16 }, (_, idx) => ({
      id: `tx-fill-${idx}`,
      user_id: 'user-1',
      wallet_id: 'w-1',
      category_id: 'cat-market-fam-1',
      amount: 100,
      merchant: `Market ${idx}`,
      transaction_date: `${currentMonth}-02`,
      created_at: `${currentMonth}-02T10:00:00Z`,
      is_installment: 0,
    }));

    const queues = new Map<unknown, unknown[][]>([
      [schema.familyMembers, [[{ id: 'user-1', family_id: 'fam-1', display_name: 'Uğur', is_active: 1 }]]],
      [
        schema.walletsAccounts,
        [[{ id: 'w-1', user_id: 'user-1', family_id: 'fam-1', name: 'Ana Banka', type: 'bank', currency: 'TRY', balance: 5000, is_active: 1, is_family_shared: 1 }]],
      ],
      [
        schema.categories,
        [
          [
            { id: 'cat-market-fam-1', family_id: 'fam-1', name: 'Market', icon: '🛒', monthly_budget_limit: 5000, group_50_30_20: 'needs' },
            { id: 'cat-maas-fam-1', family_id: 'fam-1', name: 'Maaş & Gelir', icon: '💰', monthly_budget_limit: 0, group_50_30_20: 'savings' },
          ],
        ],
      ],
      [
        schema.transactions,
        [
          [
            {
              id: 'tx-interest',
              user_id: 'user-1',
              wallet_id: 'w-1',
              category_id: null,
              amount: 1250,
              merchant: 'Vadeli Mevduat Faiz Geliri',
              transaction_date: todayStr,
              created_at: `${todayStr}T12:00:00Z`,
              is_installment: 0,
            },
            {
              id: 'tx-uncat-inc',
              user_id: 'user-1',
              wallet_id: 'w-1',
              category_id: null,
              amount: 500,
              merchant: 'Gelir Girişi',
              transaction_date: todayStr,
              created_at: `${todayStr}T11:00:00Z`,
              is_installment: 0,
            },
            {
              id: 'tx-loan-princ',
              user_id: 'user-1',
              wallet_id: 'w-1',
              category_id: null,
              amount: 10000,
              merchant: 'Kredi Çekim Anaparası',
              transaction_date: todayStr,
              created_at: `${todayStr}T10:30:00Z`,
              is_installment: 0,
            },
            ...fillerTxs,
          ],
        ],
      ],
      [schema.vehicles, [[]]],
      [schema.recurringBills, [[]]],
    ]);

    createMockDbHarness(queues);

    const res = await getBudget(new Request(`http://localhost/api/budget?month=${currentMonth}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Kurlar 0 iken NaN/Infinity olmamalı
    expect(body.data.netWorth).toEqual({
      TRY: 5000,
      USD: 0,
      EUR: 0,
      GBP: 0,
      GOLD_GRAM: '0.0',
      BTC: '0.00',
      breakdown: {
        cashAndBanks: 5000,
        investmentsAndBES: 0,
        realEstate: 0,
        debts: 0,
      },
    });

    // Faiz + Gelir Girişi gelir olarak sayılmalı (1250 + 500 = 1750), 10000 kredi anaparası hariç tutulmalı
    expect(body.data.monthlySummary.totalIncome).toBe(1750);
    expect(body.data.monthlySummary.totalExpense).toBe(1600);

    // Son işlemler harcama dışı kalemler elendikten sonra 15 adet ve zenginleştirilmiş dönmeli
    expect(body.data.recentTransactions).toHaveLength(15);
    expect(body.data.recentTransactions[0]).toMatchObject({
      category_name: 'Market',
      category_icon: '🛒',
      wallet_name: 'Ana Banka',
    });
  });

  it('POST /api/transactions: geçersiz tutar 400, başkasının özel cüzdanı (is_family_shared=0) 403 ve INSUFFICIENT_FUNDS 400 döner', async () => {
    createMockDbHarness(new Map());
    const badRes = await postTransaction(
      new Request('http://localhost/api/transactions', {
        method: 'POST',
        body: JSON.stringify({ amount: 'abc', merchant: 'Test', wallet_id: 'w-1', type: 'expense' }),
      })
    );
    expect(badRes.status).toBe(400);

    // Başka kullanıcının özel cüzdanı (is_family_shared = 0) -> 403
    const privateQueues = new Map<unknown, unknown[][]>([
      [
        schema.walletsAccounts,
        [[{ id: 'w-priv', user_id: 'user-other', family_id: 'fam-1', name: 'Gizli Cüzdan', type: 'bank', balance: 1000, is_active: 1, is_family_shared: 0 }]],
      ],
    ]);
    createMockDbHarness(privateQueues);
    const bolaRes = await postTransaction(
      new Request('http://localhost/api/transactions', {
        method: 'POST',
        body: JSON.stringify({ amount: 100, merchant: 'Market', wallet_id: 'w-priv', type: 'expense' }),
      })
    );
    expect(bolaRes.status).toBe(403);

    // Yetersiz bakiye (INSUFFICIENT_FUNDS) -> 400
    const insufficientQueues = new Map<unknown, unknown[][]>([
      [
        schema.walletsAccounts,
        [
          [{ id: 'w-1', user_id: 'user-1', family_id: 'fam-1', name: 'Ana Banka', type: 'bank', balance: 50, is_active: 1, is_family_shared: 1 }],
          [{ id: 'w-1', user_id: 'user-1', family_id: 'fam-1', name: 'Ana Banka', type: 'bank', balance: 50, is_active: 1, is_family_shared: 1 }],
        ],
      ],
    ]);
    createMockDbHarness(insufficientQueues);
    const insuffRes = await postTransaction(
      new Request('http://localhost/api/transactions', {
        method: 'POST',
        body: JSON.stringify({ amount: 200, merchant: 'Market', wallet_id: 'w-1', type: 'expense' }),
      })
    );
    expect(insuffRes.status).toBe(400);
    const insuffBody = await insuffRes.json();
    expect(insuffBody.error.toLowerCase()).toContain('yetersiz bakiye');
  });

  it('DELETE /api/transactions: giden transfer silinince yalnızca eşli linked_tx silinir, gelen transfer çift yönlü iade edilir ve sistem anapara satırı engellenir', async () => {
    // 1. Giden transfer silme ([linked_tx:tx-in-2]) -> tarihsel diğer transferler silinmemeli
    const outgoingQueues = new Map<unknown, unknown[][]>([
      [
        schema.transactions,
        [
          [
            {
              id: 'tx-out-1',
              user_id: 'user-1',
              wallet_id: 'w-src',
              amount: 300,
              merchant: '🔄 Transfer: Hedef Hesap',
              notes: '[to_wallet:w-dst] [linked_tx:tx-in-2] Transfer Açıklaması',
            },
          ],
          [{ id: 'tx-in-2', wallet_id: 'w-dst', amount: 300, notes: '[from_wallet:w-src] [linked_tx:tx-out-1]' }],
        ],
      ],
      [
        schema.walletsAccounts,
        [
          [{ id: 'w-src', user_id: 'user-1', family_id: 'fam-1', type: 'bank', balance: 700, is_active: 1 }],
          [{ id: 'w-dst', user_id: 'user-1', family_id: 'fam-1', type: 'bank', balance: 1300, is_active: 1 }],
        ],
      ],
    ]);
    const harnessOut = createMockDbHarness(outgoingQueues);
    const delOutRes = await deleteTransaction(new Request('http://localhost/api/transactions?id=tx-out-1', { method: 'DELETE' }));
    expect(delOutRes.status).toBe(200);
    expect(harnessOut.deleted).toHaveLength(2);
    expect(harnessOut.deleted[0].whereSql).toContain('"tx-in-2"');
    expect(harnessOut.deleted[1].whereSql).toContain('"tx-out-1"');
    expect(harnessOut.updated[0].set).toMatchObject({ balance: 1000 });
    expect(harnessOut.updated[1].set).toMatchObject({ balance: 1000 });

    // 2. Gelen transfer silme ([from_wallet:w-src] [linked_tx:tx-out-1]) -> her iki cüzdanı da geri alır
    const incomingQueues = new Map<unknown, unknown[][]>([
      [
        schema.transactions,
        [
          [
            {
              id: 'tx-in-2',
              user_id: 'user-1',
              wallet_id: 'w-dst',
              amount: 250,
              merchant: '🔄 Transfer: Kaynak Hesaptan Gelen',
              notes: '[from_wallet:w-src] [linked_tx:tx-out-1] Aktarım',
            },
          ],
          [{ id: 'tx-out-1', wallet_id: 'w-src', amount: 250, notes: '[to_wallet:w-dst] [linked_tx:tx-in-2]' }],
        ],
      ],
      [
        schema.walletsAccounts,
        [
          [{ id: 'w-dst', user_id: 'user-1', family_id: 'fam-1', type: 'bank', balance: 1250, is_active: 1 }],
          [{ id: 'w-src', user_id: 'user-1', family_id: 'fam-1', type: 'bank', balance: 750, is_active: 1 }],
        ],
      ],
    ]);
    const harnessIn = createMockDbHarness(incomingQueues);
    const delInRes = await deleteTransaction(new Request('http://localhost/api/transactions?id=tx-in-2', { method: 'DELETE' }));
    expect(delInRes.status).toBe(200);
    expect(harnessIn.updated[0].set).toMatchObject({ balance: 1000 });
    expect(harnessIn.updated[1].set).toMatchObject({ balance: 1000 });

    // 3. Sistem Kredi Çekim Anaparası silinemez -> 400
    const sysQueues = new Map<unknown, unknown[][]>([
      [
        schema.transactions,
        [[{ id: 'tx-sys', user_id: 'user-1', wallet_id: 'w-src', amount: 10000, merchant: 'Kredi Çekim Anaparası', notes: '' }]],
      ],
      [schema.walletsAccounts, [[{ id: 'w-src', user_id: 'user-1', family_id: 'fam-1', type: 'bank', balance: 10000 }]]],
    ]);
    createMockDbHarness(sysQueues);
    const sysRes = await deleteTransaction(new Request('http://localhost/api/transactions?id=tx-sys', { method: 'DELETE' }));
    expect(sysRes.status).toBe(400);
  });

  it('POST /api/budget/accounts: 10.000 TL / 3 taksit kredi kuruş artık payını ilk taksite ekler ve family_id null yabancı hesabı 403 ile engeller', async () => {
    const loanQueues = new Map<unknown, unknown[][]>([
      [schema.familyMembers, [[{ id: 'user-1', family_id: 'fam-1', is_active: 1 }]]],
    ]);
    const harness = createMockDbHarness(loanQueues);

    const loanRes = await postAccount(
      new Request('http://localhost/api/budget/accounts', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create',
          name: 'İhtiyaç Kredisi',
          type: 'loan',
          loan_original_amount: 10000,
          loan_total_repayment: 10000,
          total_installments: 3,
          first_installment_date: '2026-12-01',
        }),
      })
    );
    expect(loanRes.status).toBe(200);

    const installmentInserts = harness.inserted
      .filter(entry => entry.table === schema.transactions)
      .map(entry => entry.values as { is_installment?: number; amount: number })
      .filter(val => val.is_installment === 1);
    expect(installmentInserts).toHaveLength(3);
    expect(installmentInserts.map(b => b.amount)).toEqual([3333.34, 3333.33, 3333.33]);

    // family_id = null ve başka kullanıcıya ait hesaba update -> 403 BOLA
    const foreignUpdateQueues = new Map<unknown, unknown[][]>([
      [schema.familyMembers, [[{ id: 'user-1', family_id: 'fam-1', is_active: 1 }]]],
      [
        schema.walletsAccounts,
        [[{ id: 'acc-foreign', user_id: 'other-user', family_id: null, name: 'Yabancı', type: 'bank', balance: 500, is_active: 1 }]],
      ],
    ]);
    createMockDbHarness(foreignUpdateQueues);
    const bolaRes = await postAccount(
      new Request('http://localhost/api/budget/accounts', {
        method: 'POST',
        body: JSON.stringify({ action: 'update', id: 'acc-foreign', name: 'Ele Geçirilen', type: 'bank', balance: 9999 }),
      })
    );
    expect(bolaRes.status).toBe(403);
  });

  it('POST /api/budget/categories: cross-tenant is_family_shared kategorileri toplam bütçe havuzuna katmaz ve negatif limiti 400 ile reddeder', async () => {
    createMockDbHarness(new Map());
    const badRes = await postCategory(
      new Request('http://localhost/api/budget/categories', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test', monthly_budget_limit: -50 }),
      })
    );
    expect(badRes.status).toBe(400);

    const catQueues = new Map<unknown, unknown[][]>([
      [schema.familyMembers, [[{ id: 'user-1', family_id: 'fam-1', is_active: 1 }]]],
      [schema.categories, [[{ id: 'cat-mine', family_id: 'fam-1', name: 'Gıda', monthly_budget_limit: 5000 }]]],
    ]);
    const harness = createMockDbHarness(catQueues);

    const okRes = await postCategory(
      new Request('http://localhost/api/budget/categories', {
        method: 'POST',
        body: JSON.stringify({ name: 'Kahve', monthly_budget_limit: 1200, group_50_30_20: 'wants' }),
      })
    );
    expect(okRes.status).toBe(200);
    const catSelect = harness.selectedWhereSql.find(q => q.table === schema.categories);
    expect(catSelect?.whereSql).not.toContain('is_family_shared');
  });

  it('PATCH /api/budget/recurring-bills: aynı dönemde mükerrer ödemeyi (400) ve yetersiz cüzdan bakiyesini (400) engeller', async () => {
    const todayStr = getTodayTurkeyDate();
    const currentMonth = todayStr.slice(0, 7);

    // 1. Aynı dönem tekrar ödeme -> 400
    const alreadyPaidQueues = new Map<unknown, unknown[][]>([
      [
        schema.recurringBills,
        [[{ id: 'bill-1', user_id: 'user-1', family_id: 'fam-1', name: 'İnternet', amount: 450, due_day: 15, last_paid_month: currentMonth, status: 'active' }]],
      ],
    ]);
    createMockDbHarness(alreadyPaidQueues);
    const dupRes = await patchRecurringBill(
      new Request('http://localhost/api/budget/recurring-bills', {
        method: 'PATCH',
        body: JSON.stringify({ id: 'bill-1', action: 'mark_paid', create_transaction: false }),
      })
    );
    expect(dupRes.status).toBe(400);

    // 2. Ödeme sırasında yetersiz bakiye -> 400
    const insuffQueues = new Map<unknown, unknown[][]>([
      [
        schema.recurringBills,
        [[{ id: 'bill-2', user_id: 'user-1', family_id: 'fam-1', name: 'Elektrik', amount: 1500, due_day: 20, last_paid_month: '2026-01', status: 'active' }]],
      ],
      [
        schema.walletsAccounts,
        [[{ id: 'w-1', user_id: 'user-1', family_id: 'fam-1', name: 'Banka', type: 'bank', balance: 200, is_active: 1, is_family_shared: 1 }]],
      ],
    ]);
    createMockDbHarness(insuffQueues);
    const insuffRes = await patchRecurringBill(
      new Request('http://localhost/api/budget/recurring-bills', {
        method: 'PATCH',
        body: JSON.stringify({ id: 'bill-2', action: 'mark_paid', create_transaction: true, wallet_id: 'w-1' }),
      })
    );
    expect(insuffRes.status).toBe(400);
    const insuffBody = await insuffRes.json();
    expect(insuffBody.error.toLowerCase()).toContain('yetersiz bakiye');
  });

  it('GET/POST/DELETE /api/budget/personal-debts: 401 koruması, TRY dışı cüzdan reddi (400) ve silmede tarihi kur yerine tx tutarı iadesi', async () => {
    mockGetAuthUser.mockResolvedValueOnce(null);
    const unauthRes = await getPersonalDebts();
    expect(unauthRes.status).toBe(401);

    // USD cüzdan bağlama -> 400
    const usdWalletQueues = new Map<unknown, unknown[][]>([
      [
        schema.walletsAccounts,
        [[{ id: 'w-usd', user_id: 'user-1', family_id: 'fam-1', name: 'Dolar Hesabı', type: 'bank', currency: 'USD', balance: 1000, is_active: 1, is_family_shared: 1 }]],
      ],
    ]);
    createMockDbHarness(usdWalletQueues);
    const usdRes = await postPersonalDebt(
      new Request('http://localhost/api/budget/personal-debts', {
        method: 'POST',
        body: JSON.stringify({
          type: 'debt',
          person_name: 'Ahmet',
          index_amount: 100,
          index_type: 'USD',
          connected_wallet_id: 'w-usd',
        }),
      })
    );
    expect(usdRes.status).toBe(400);

    // Silmede bugünkü canlı kur (100 * 38 = 3800) değil orijinal işlem tutarı (2500 TRY) iade edilmeli
    const deleteQueues = new Map<unknown, unknown[][]>([
      [
        schema.personalDebtsReceivables,
        [
          [
            {
              id: 'pd-1',
              user_id: 'user-1',
              family_id: 'fam-1',
              type: 'receivable',
              person_name: 'Ahmet',
              index_amount: 100,
              index_type: 'USD',
              paid_amount: 0,
              connected_wallet_id: 'w-try',
              due_date: '2026-12-30',
              status: 'open',
            },
          ],
        ],
      ],
      [schema.transactions, [[{ id: 'tx-pd-1', user_id: 'user-1', wallet_id: 'w-try', amount: 2500 }]]],
      [
        schema.walletsAccounts,
        [[{ id: 'w-try', user_id: 'user-1', family_id: 'fam-1', type: 'bank', currency: 'TRY', balance: 5000, is_active: 1 }]],
      ],
    ]);
    const harnessDel = createMockDbHarness(deleteQueues);
    const delRes = await deletePersonalDebt(new Request('http://localhost/api/budget/personal-debts?id=pd-1', { method: 'DELETE' }));
    expect(delRes.status).toBe(200);
    // Verilen borç (receivable) silinirken başlangıçta düşülen 2500 TRY geri eklenir -> 5000 + 2500 = 7500
    expect(harnessDel.updated[0].set).toMatchObject({ balance: 7500 });
  });

  it('Çok kiracılı kategori izolasyonu: aileler arası seed güncelleme/detay BOLA engeli, şablon çözümü ve delete-account telegram_% izolasyonu', async () => {
    // 1. Aile B yöneticisi yalnızca kendi cat-market-fam-2 kopyasını güncelleyebilir; başka ailenin kategorisi ve null family_id reddedilir (403)
    mockGetAuthUser.mockResolvedValue({
      id: 'user-b',
      family_id: 'fam-2',
      role: 'admin',
      is_master_account: 1,
    });

    const catUpdateQueues = new Map<unknown, unknown[][]>([
      [schema.walletsAccounts, [[]]],
      [
        schema.categories,
        [
          [{ id: 'cat-market-fam-2', family_id: 'fam-2', name: 'Market', type: 'expense', monthly_budget_limit: 0 }],
          [{ id: 'cat-market-fam-2', family_id: 'fam-2', name: 'Market', type: 'expense', monthly_budget_limit: 0 }],
        ],
      ],
    ]);
    const harnessCatB = createMockDbHarness(catUpdateQueues);
    const ownSeedUpdate = await postCategory(
      new Request('http://localhost/api/budget/categories', {
        method: 'POST',
        body: JSON.stringify({ id: 'cat-market', name: 'Aile B Market', monthly_budget_limit: 2500 }),
      })
    );
    expect(ownSeedUpdate.status).toBe(200);
    expect(harnessCatB.updated[0].whereSql).toContain('cat-market-fam-2');
    expect(harnessCatB.updated[0].whereSql).toContain('fam-2');

    // Başka aile kategorisi veya family_id: null kategori güncellemesi 403 dönmeli
    const foreignCatQueues = new Map<unknown, unknown[][]>([
      [schema.walletsAccounts, [[]]],
      [
        schema.categories,
        [
          [],
          [{ id: 'cat-market-fam-1', family_id: 'fam-1', name: 'Aile A Market', type: 'expense', monthly_budget_limit: 5000 }],
        ],
      ],
    ]);
    createMockDbHarness(foreignCatQueues);
    const foreignUpdate = await postCategory(
      new Request('http://localhost/api/budget/categories', {
        method: 'POST',
        body: JSON.stringify({ id: 'cat-market-fam-1', name: 'Sızma', monthly_budget_limit: 100 }),
      })
    );
    expect(foreignUpdate.status).toBe(403);

    // 2. DELETE /api/budget/categories aile çekirdek kategorisini 400 ile engeller
    createMockDbHarness(
      new Map<unknown, unknown[][]>([
        [schema.categories, [[{ id: 'cat-market-fam-2', family_id: 'fam-2', name: 'Market' }]]],
      ])
    );
    const delSeedRes = await deleteCategory(
      new Request('http://localhost/api/budget/categories?id=cat-market-fam-2', { method: 'DELETE' })
    );
    expect(delSeedRes.status).toBe(400);

    // 3. GET /api/budget/category-details family_id: null olan kayda 403 döner
    createMockDbHarness(
      new Map<unknown, unknown[][]>([
        [schema.categories, [[{ id: 'cat-orphan', family_id: null, name: 'Yetim Kategori', type: 'expense' }]]],
      ])
    );
    const detRes = await getCategoryDetails(
      new Request('http://localhost/api/budget/category-details?category_id=cat-orphan')
    );
    expect(detRes.status).toBe(403);

    // 4. POST /api/transactions template 'cat-market' geldiğinde eksikse aile kategorilerini seed edip 'cat-market-fam-2' olarak kaydeder
    const txSeedQueues = new Map<unknown, unknown[][]>([
      [
        schema.walletsAccounts,
        [[{ id: 'w-b1', user_id: 'user-b', family_id: 'fam-2', name: 'B Bankası', type: 'bank', balance: 5000, is_active: 1, is_family_shared: 1 }]],
      ],
      [schema.categories, [[]]],
    ]);
    const harnessTxSeed = createMockDbHarness(txSeedQueues);
    const txRes = await postTransaction(
      new Request('http://localhost/api/transactions', {
        method: 'POST',
        body: JSON.stringify({ wallet_id: 'w-b1', category_id: 'cat-market', amount: 120, merchant: 'Migros', type: 'expense' }),
      })
    );
    expect(txRes.status).toBe(200);
    const catSeedInsert = harnessTxSeed.inserted.find(e => e.table === schema.categories);
    expect(catSeedInsert).toBeDefined();
    const txInsert = harnessTxSeed.inserted.find(e => e.table === schema.transactions);
    expect((txInsert?.values as { category_id: string }).category_id).toBe('cat-market-fam-2');

    // 5. POST /api/auth/delete-account küresel 'telegram_%' silmemeli ve ailenin categories kayıtlarını temizlemeli
    mockGetAuthUser.mockResolvedValue({
      id: 'user-1',
      family_id: 'fam-1',
      role: 'admin',
      password_hash: 'h',
      password_salt: 's',
    });
    const delAccHarness = createMockDbHarness(new Map<unknown, unknown[][]>());
    const delAccRes = await postDeleteAccount(
      new Request('http://localhost/api/auth/delete-account', {
        method: 'POST',
        body: JSON.stringify({ password: 'secret-password' }),
      })
    );
    expect(delAccRes.status).toBe(200);

    const catDeletes = delAccHarness.deleted.filter(d => d.table === schema.categories);
    expect(catDeletes.length).toBe(1);
    expect(catDeletes[0].whereSql).toContain('fam-1');

    const appSettingsDeletes = delAccHarness.deleted.filter(d => d.table === schema.appSettings);
    expect(appSettingsDeletes.length).toBe(1);
    expect(appSettingsDeletes[0].whereSql).not.toContain('"telegram_%"');
    expect(appSettingsDeletes[0].whereSql).toContain('fam-1');
    expect(appSettingsDeletes[0].whereSql).toContain('user-1');
  });
});
