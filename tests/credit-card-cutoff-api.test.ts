import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

vi.mock('@/lib/market-data', () => ({
  fetchLiveExchangeRates: vi.fn().mockResolvedValue({
    USD_TRY: 35,
    EUR_TRY: 38,
    GBP_TRY: 44,
    GOLD_GRAM_TRY: 3000,
    BTC_TRY: 3000000,
  }),
}));

import { GET as getBudget } from '../src/app/api/budget/route';
import { GET as getCardStatement } from '../src/app/api/budget/card-statement/route';
import { GET as getNotifications } from '../src/app/api/notifications/route';
import { GET as getTasks } from '../src/app/api/tasks/route';
import { getAuthUser } from '../src/lib/auth';

function createSelectChain(data: any[]) {
  const obj: any = {};
  obj.from = vi.fn(() => obj);
  obj.where = vi.fn(() => obj);
  obj.orderBy = vi.fn(() => obj);
  obj.limit = vi.fn(() => Promise.resolve(data));
  obj.then = (onFulfilled: any, onRejected?: any) => Promise.resolve(data).then(onFulfilled, onRejected);
  return obj;
}

describe('Credit Card Post-Cutoff API Integration (Budget & Card Statement)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // 17 November 2026, 12:00 local
    vi.setSystemTime(new Date(2026, 10, 17, 12, 0, 0));
    vi.mocked(getAuthUser).mockResolvedValue({
      id: 'user-1',
      family_id: 'fam-1',
      full_name: 'Uğur',
      role: 'admin',
      is_master_account: 1,
    } as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('GET /api/budget puts post-cutoff card spending on active_due_date regardless of monthParam and buckets futureForecast by due month', async () => {
    const accounts = [
      {
        id: 'cc-1',
        name: 'Bonus Card',
        type: 'credit_card',
        balance: 2000,
        credit_limit: 50000,
        cutoff_day: 10,
        due_day: 20,
        currency: 'TRY',
        user_id: 'user-1',
        family_id: 'fam-1',
        is_active: 1,
      },
      {
        id: 'bank-1',
        name: 'Vadesiz',
        type: 'bank',
        balance: 10000,
        currency: 'TRY',
        user_id: 'user-1',
        family_id: 'fam-1',
        is_active: 1,
      },
    ];

    const categoriesData = [
      { id: 'cat-market', name: 'Market', type: 'expense', monthly_budget_limit: 10000, group_50_30_20: 'needs' },
      { id: 'cat-rec-inc', name: 'Bakiye Mutabakatı', type: 'income', monthly_budget_limit: 0, group_50_30_20: 'needs' },
    ];

    const txData = [
      {
        id: 'tx-post-cutoff',
        wallet_id: 'cc-1',
        category_id: 'cat-market',
        merchant: 'Migros',
        amount: 2000,
        currency: 'TRY',
        transaction_date: '2026-11-17',
        is_installment: 0,
        installment_number: 1,
        total_installments: 1,
        user_id: 'user-1',
        family_id: 'fam-1',
      },
      {
        id: 'tx-payment-in',
        wallet_id: 'cc-1',
        category_id: null,
        merchant: '💳 Kart Ödeme Tahsilatı: Vadesiz',
        notes: 'Ekstre ödemesi [from_wallet:bank-1] [linked_tx:tx-pay-out]',
        amount: 1000,
        currency: 'TRY',
        transaction_date: '2026-11-12',
        is_installment: 0,
        user_id: 'user-1',
        family_id: 'fam-1',
      },
    ];

    // Mock with month=2026-10 (historical month param) to prove upcomingPayments is NOT affected by monthParam
    mockSelect
      .mockReturnValueOnce(createSelectChain([])) // familyMembers
      .mockReturnValueOnce(createSelectChain(accounts)) // walletsAccounts
      .mockReturnValueOnce(createSelectChain(categoriesData)) // categories
      .mockReturnValueOnce(createSelectChain(txData)) // transactions
      .mockReturnValueOnce(createSelectChain([])) // vehicles
      .mockReturnValueOnce(createSelectChain([])); // recurringBills

    const res = await getBudget(new Request('http://localhost/api/budget?month=2026-10'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);

    const card = json.data.accounts.find((a: any) => a.id === 'cc-1');
    expect(card.closed_statement_debt).toBe(0);
    expect(card.closed_due_date).toBe('2026-11-20');
    expect(card.active_due_date).toBe('2026-12-20');
    expect(card.next_due_date).toBe('2026-12-20');
    expect(card.is_overdue).toBe(false);

    const ccUpcoming = json.data.upcomingPayments.find((u: any) => u.id === 'cc-cc-1');
    expect(ccUpcoming).toBeDefined();
    expect(ccUpcoming.due_date).toBe('2026-12-20');
    expect(ccUpcoming.amount).toBe(2000);
    expect(ccUpcoming.days_left).toBe(33);

    // futureForecast should bucket the Nov 17 post-cutoff expense into 2026-12, NOT 2026-11,
    // and exclude Kart Ödeme Tahsilatı from both expense and income
    const novForecast = json.data.monthlySummary.futureForecast.find((f: any) => f.monthStr === '2026-11');
    const decForecast = json.data.monthlySummary.futureForecast.find((f: any) => f.monthStr === '2026-12');
    expect(novForecast.totalExpense).toBe(0);
    expect(novForecast.totalIncome).toBe(0);
    expect(decForecast.totalExpense).toBe(2000);
  });

  it('GET /api/budget/card-statement separates closed vs open cycles, filters non-purchases, and aggregates installments in ascending order', async () => {
    const cardAccount = {
      id: 'cc-1',
      name: 'Axess',
      type: 'credit_card',
      balance: 6000, // 1500 closed + 1500 open + 1000 reconcile expense + 2000 future installments = 6000
      credit_limit: 40000,
      cutoff_day: 10,
      due_day: 20,
      currency: 'TRY',
      user_id: 'user-1',
      family_id: 'fam-1',
    };

    const categoriesData = [
      { id: 'cat-market', name: 'Market', type: 'expense' },
      { id: 'cat-tech', name: 'Teknoloji', type: 'expense' },
      { id: 'cat-rec-exp', name: 'Bakiye Mutabakatı', type: 'expense' },
      { id: 'cat-rec-inc', name: 'Bakiye Mutabakatı', type: 'income' },
    ];

    // Ordered desc by transaction_date (just like DB query)
    const txDataDesc = [
      {
        id: 'tx-inst-3',
        wallet_id: 'cc-1',
        category_id: 'cat-tech',
        merchant: 'Apple Store',
        amount: 1000,
        transaction_date: '2027-01-17',
        is_installment: 1,
        installment_number: 3,
        total_installments: 3,
        parent_transaction_id: 'parent-inst-1',
      },
      {
        id: 'tx-inst-2',
        wallet_id: 'cc-1',
        category_id: 'cat-tech',
        merchant: 'Apple Store',
        amount: 1000,
        transaction_date: '2026-12-17',
        is_installment: 1,
        installment_number: 2,
        total_installments: 3,
        parent_transaction_id: 'parent-inst-1',
      },
      {
        id: 'tx-inst-1',
        wallet_id: 'cc-1',
        category_id: 'cat-tech',
        merchant: 'Apple Store',
        amount: 1000.01, // 1 kuruş remainder on 1st installment
        transaction_date: '2026-11-17',
        is_installment: 1,
        installment_number: 1,
        total_installments: 3,
        parent_transaction_id: 'parent-inst-1',
      },
      {
        id: 'tx-rec-exp',
        wallet_id: 'cc-1',
        category_id: 'cat-rec-exp',
        merchant: 'Bakiye Mutabakatı',
        notes: '⚖️ Bakiye Mutabakatı: Banka ile eşitleme (-1.000 TRY düzeltme gideri)',
        amount: 1000,
        transaction_date: '2026-11-16',
        is_installment: 0,
      },
      {
        id: 'tx-open-single',
        wallet_id: 'cc-1',
        category_id: 'cat-market',
        merchant: 'Carrefour',
        amount: 499.99,
        transaction_date: '2026-11-15',
        is_installment: 0,
      },
      {
        id: 'tx-payment',
        wallet_id: 'cc-1',
        category_id: null,
        merchant: '💳 Kart Ödeme Tahsilatı: Vadesiz',
        notes: 'Ödeme [from_wallet:bank-1]',
        amount: 500,
        transaction_date: '2026-11-12',
        is_installment: 0,
      },
      {
        id: 'tx-rec-inc',
        wallet_id: 'cc-1',
        category_id: 'cat-rec-inc',
        merchant: 'Bakiye Mutabakatı',
        notes: '⚖️ Bakiye Mutabakatı: Banka ile eşitleme (+200 TRY düzeltme geliri)',
        amount: 200,
        transaction_date: '2026-11-12',
        is_installment: 0,
      },
      {
        id: 'tx-closed-single',
        wallet_id: 'cc-1',
        category_id: 'cat-market',
        merchant: 'Migros Eski Dönem',
        amount: 1500,
        transaction_date: '2026-11-05',
        is_installment: 0,
      },
    ];

    mockSelect
      .mockReturnValueOnce(createSelectChain([cardAccount])) // walletsAccounts
      .mockReturnValueOnce(createSelectChain(txDataDesc)) // transactions
      .mockReturnValueOnce(createSelectChain(categoriesData)); // categories

    const res = await getCardStatement(new Request('http://localhost/api/budget/card-statement?account_id=cc-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);

    // Non-purchase rows (payment & income reconciliation) excluded from singleTransactions; expense reconciliation kept
    const singleMerchants = json.data.singleTransactions.map((t: any) => t.merchant);
    expect(singleMerchants).not.toContain('💳 Kart Ödeme Tahsilatı: Vadesiz');
    expect(singleMerchants.filter((m: string) => m === 'Bakiye Mutabakatı')).toHaveLength(1);
    expect(singleMerchants).toContain('Carrefour');
    expect(singleMerchants).toContain('Migros Eski Dönem');

    // Summary checks
    expect(json.data.summary.currentStatementDebt).toBe(1500);
    expect(json.data.summary.openCycleDebt).toBe(2500); // 1000.01 + 499.99 + 1000
    expect(json.data.summary.futureInstallmentsDebt).toBe(2000);
    expect(json.data.summary.closedDueDate).toBe('2026-11-20');
    expect(json.data.summary.activeDueDate).toBe('2026-12-20');

    // Installment aggregation checks: earliest date + exact cent total_amount + remaining_amount
    expect(json.data.activeInstallments).toHaveLength(1);
    const inst = json.data.activeInstallments[0];
    expect(inst.id).toBe('parent-inst-1');
    expect(inst.first_date).toBe('2026-11-17');
    expect(inst.total_amount).toBe(3000.01);
    expect(inst.current_installment_number).toBe(1);
    expect(inst.remaining_amount).toBe(3000.01);
  });

  it('GET /api/notifications suppresses alerts for post-cutoff open-cycle spending and filters Kart Ödeme Tahsilatı + income reconciliation', async () => {
    // 17 Nov 2026: cutoff 10, due 20 -> closedDueDate is 20 Nov (3 days away!)
    // Card A has ONLY post-cutoff spending (2000) + expense reconciliation (500) + income reconciliation (300) + payment (1000); balance = 2500 -> closed_statement_debt = 0 -> MUST NOT alert!
    // Card B has 1200 closed debt + 800 post-cutoff spending; balance = 2000 -> MUST alert for 1200 (not 2000)!
    const accounts = [
      { id: 'cc-open-only', name: 'OpenOnlyCard', type: 'credit_card', balance: 2500, cutoff_day: 10, due_day: 20, is_active: 1 },
      { id: 'cc-mixed', name: 'MixedCard', type: 'credit_card', balance: 2000, cutoff_day: 10, due_day: 20, is_active: 1 },
    ];

    const cardTxs = [
      { wallet_id: 'cc-open-only', amount: 2000, transaction_date: '2026-11-15', is_installment: 0, merchant: 'Migros', notes: null, category_id: 'cat-market' },
      { wallet_id: 'cc-open-only', amount: 500, transaction_date: '2026-11-16', is_installment: 0, merchant: 'Bakiye Mutabakatı', notes: 'düzeltme gideri', category_id: 'cat-rec-exp' },
      { wallet_id: 'cc-open-only', amount: 300, transaction_date: '2026-11-14', is_installment: 0, merchant: 'Bakiye Mutabakatı', notes: 'düzeltme geliri', category_id: 'cat-rec-inc' },
      { wallet_id: 'cc-open-only', amount: 1000, transaction_date: '2026-11-12', is_installment: 0, merchant: '💳 Kart Ödeme Tahsilatı: Vadesiz', notes: '[from_wallet:bank-1]', category_id: null },
      { wallet_id: 'cc-mixed', amount: 1200, transaction_date: '2026-11-04', is_installment: 0, merchant: 'Eski Dönem', notes: null, category_id: 'cat-market' },
      { wallet_id: 'cc-mixed', amount: 800, transaction_date: '2026-11-16', is_installment: 0, merchant: 'Yeni Dönem', notes: null, category_id: 'cat-market' },
    ];

    const notifCategories = [
      { id: 'cat-market', type: 'expense' },
      { id: 'cat-rec-exp', type: 'expense' },
      { id: 'cat-rec-inc', type: 'income' },
    ];

    mockSelect
      .mockReturnValueOnce(createSelectChain([])) // digitalVaultItems
      .mockReturnValueOnce(createSelectChain([])) // importantDates
      .mockReturnValueOnce(createSelectChain([])) // vehicles
      .mockReturnValueOnce(createSelectChain([])) // homeMaintenanceRecords
      .mockReturnValueOnce(createSelectChain(accounts)) // walletsAccounts
      .mockReturnValueOnce(createSelectChain(cardTxs)) // transactions
      .mockReturnValueOnce(createSelectChain(notifCategories)) // categories
      .mockReturnValueOnce(createSelectChain([])); // recurringBills

    const res = await getNotifications();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);

    const openOnlyNotif = json.data.notifications.find((n: any) => n.id.includes('cc-open-only'));
    expect(openOnlyNotif).toBeUndefined();

    const mixedNotif = json.data.notifications.find((n: any) => n.id === 'card-cc-mixed');
    expect(mixedNotif).toBeDefined();
    expect(mixedNotif.due_date).toBe('2026-11-20');
    expect(mixedNotif.days_left).toBe(3);
    expect(mixedNotif.subtitle).toContain('1.200');
  });

  it('GET /api/tasks cross-module bridge ignores post-cutoff open-cycle card spending and surfaces only closed_statement_debt', async () => {
    const accounts = [
      { id: 'cc-post', name: 'PostCutoffCard', type: 'credit_card', balance: 1500, cutoff_day: 10, due_day: 20, is_active: 1 },
      { id: 'cc-due', name: 'ClosedDebtCard', type: 'credit_card', balance: 2500, cutoff_day: 10, due_day: 20, is_active: 1 },
    ];

    const cardTxs = [
      { wallet_id: 'cc-post', amount: 1500, transaction_date: '2026-11-16', is_installment: 0, merchant: 'A101', notes: null, category_id: 'cat-market' },
      { wallet_id: 'cc-post', amount: 700, transaction_date: '2026-11-12', is_installment: 0, merchant: '💳 Kart Ödeme Tahsilatı: Vadesiz', notes: '[from_wallet:bank-1]', category_id: null },
      { wallet_id: 'cc-due', amount: 1000, transaction_date: '2026-11-05', is_installment: 0, merchant: 'Eski Harcama', notes: null, category_id: 'cat-market' },
      { wallet_id: 'cc-due', amount: 1500, transaction_date: '2026-11-17', is_installment: 0, merchant: 'Yeni Harcama', notes: null, category_id: 'cat-market' },
    ];

    const taskCategories = [
      { id: 'cat-market', type: 'expense' },
    ];

    mockSelect
      .mockReturnValueOnce(createSelectChain([])) // familyMembers
      .mockReturnValueOnce(createSelectChain([])) // tasks
      .mockReturnValueOnce(createSelectChain([])) // recurringBills
      .mockReturnValueOnce(createSelectChain(accounts)) // walletsAccounts
      .mockReturnValueOnce(createSelectChain([])) // vehicles
      .mockReturnValueOnce(createSelectChain([])) // homeMaintenanceRecords
      .mockReturnValueOnce(createSelectChain([])) // digitalVaultItems
      .mockReturnValueOnce(createSelectChain(cardTxs)) // transactions
      .mockReturnValueOnce(createSelectChain(taskCategories)); // categories

    const res = await getTasks(new Request('http://localhost/api/tasks?view=all'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);

    const postAction = json.data.crossModuleActions.find((a: any) => a.source_ref_id === 'card-cc-post');
    expect(postAction).toBeUndefined();

    const dueAction = json.data.crossModuleActions.find((a: any) => a.source_ref_id === 'card-cc-due');
    expect(dueAction).toBeDefined();
    expect(dueAction.due_date).toBe('2026-11-20');
    expect(dueAction.subtitle).toContain('1.000');
  });

  it('GET /api/budget/card-statement accurately reflects installment 2/3 across closed and open cycles', async () => {
    const cardAccount = {
      id: 'cc-1',
      name: 'World',
      type: 'credit_card',
      balance: 2000, // tx1 (1000, closed) already paid; tx2 (1000, open) + tx3 (1000, future) = 2000
      credit_limit: 30000,
      cutoff_day: 10,
      due_day: 20,
      currency: 'TRY',
      user_id: 'user-1',
      family_id: 'fam-1',
    };

    const categoriesData = [{ id: 'cat-tech', name: 'Teknoloji', type: 'expense' }];
    const txDataDesc = [
      {
        id: 'tx-inst-3',
        wallet_id: 'cc-1',
        category_id: 'cat-tech',
        merchant: 'MediaMarkt',
        amount: 1000,
        transaction_date: '2026-12-15', // > 2026-12-10 cycleEndISO -> future
        is_installment: 1,
        installment_number: 3,
        total_installments: 3,
        parent_transaction_id: 'parent-mm',
      },
      {
        id: 'tx-inst-2',
        wallet_id: 'cc-1',
        category_id: 'cat-tech',
        merchant: 'MediaMarkt',
        amount: 1000,
        transaction_date: '2026-11-15', // in open cycle (2026-11-11..2026-12-10)
        is_installment: 1,
        installment_number: 2,
        total_installments: 3,
        parent_transaction_id: 'parent-mm',
      },
      {
        id: 'tx-inst-1',
        wallet_id: 'cc-1',
        category_id: 'cat-tech',
        merchant: 'MediaMarkt',
        amount: 1000,
        transaction_date: '2026-10-15', // in closed cycle (2026-10-11..2026-11-10)
        is_installment: 1,
        installment_number: 1,
        total_installments: 3,
        parent_transaction_id: 'parent-mm',
      },
    ];

    mockSelect
      .mockReturnValueOnce(createSelectChain([cardAccount]))
      .mockReturnValueOnce(createSelectChain(txDataDesc))
      .mockReturnValueOnce(createSelectChain(categoriesData));

    const res = await getCardStatement(new Request('http://localhost/api/budget/card-statement?account_id=cc-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.summary.currentStatementDebt).toBe(0);
    expect(json.data.summary.openCycleDebt).toBe(1000);
    expect(json.data.summary.futureInstallmentsDebt).toBe(1000);
    expect(json.data.activeInstallments).toHaveLength(1);
    expect(json.data.activeInstallments[0].first_date).toBe('2026-10-15');
    expect(json.data.activeInstallments[0].current_installment_number).toBe(2);
    expect(json.data.activeInstallments[0].remaining_amount).toBe(2000);
    expect(json.data.activeInstallments[0].total_amount).toBe(3000);
  });
});
