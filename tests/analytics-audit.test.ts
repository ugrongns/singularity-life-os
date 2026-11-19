import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PgDialect } from 'drizzle-orm/pg-core';
import * as schema from '../src/db/schema';

const {
  mockGetAuthUser,
  mockFetchLiveExchangeRates,
  mockSelect,
  mockInsert,
  mockDelete,
} = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockFetchLiveExchangeRates: vi.fn(),
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getAuthUser: mockGetAuthUser,
}));

vi.mock('@/lib/market-data', () => ({
  fetchLiveExchangeRates: mockFetchLiveExchangeRates,
}));

vi.mock('@/db', () => ({
  initDatabase: vi.fn().mockResolvedValue(undefined),
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

import { GET as getAnalytics, PATCH as patchAnalytics } from '../src/app/api/analytics/route';
import { GET as getAnalyticsCalendar } from '../src/app/api/analytics/calendar/route';
import { calculateHeatmapMatrix } from '../src/lib/calendar-heatmap';
import { isIncomeTransaction, isTransferTransaction } from '../src/lib/financial-habits';

function setupMockDb(tableRows: Map<unknown, unknown[]>) {
  const dialect = new PgDialect();
  const recordedQueries: Array<{ table: unknown; sql: string; params: unknown[] }> = [];

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

  return recordedQueries;
}

describe('📊 Analitik Modülü (!denetle analitik) Denetim & Regresyon Testleri', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchLiveExchangeRates.mockResolvedValue({
      USD_TRY: 40,
      EUR_TRY: 43,
      GBP_TRY: 50,
      GOLD_GRAM_TRY: 3200,
      GOLD_CEYREK_TRY: 5200,
      BTC_TRY: 3500000,
      source: 'truncgil',
      lastUpdated: new Date().toISOString(),
    });
  });

  it('GET /api/analytics ve GET /api/analytics/calendar yetkisiz isteklerde 401 dönmelidir', async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const resAnalytics = await getAnalytics();
    const resCalendar = await getAnalyticsCalendar(new Request('http://localhost/api/analytics/calendar'));

    expect(resAnalytics.status).toBe(401);
    expect(resCalendar.status).toBe(401);
  });

  it('GET /api/analytics/calendar su kayıtlarını yalnızca oturum sahibinin user_id bilgisiyle filtrelemeli (BOLA/mahremiyet) ve 00:00-02:59 TR oruç bitişini doğru güne yazmalıdır', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-11-18T12:00:00Z'));
      mockGetAuthUser.mockResolvedValue({ id: 'user-1', family_id: 'fam-1' });

      const queries = setupMockDb(new Map<unknown, unknown[]>([
        [schema.fastingSessions, [
          {
            start_time: '2026-11-17T04:00:00.000Z',
            actual_end_time: '2026-11-17T22:30:00.000Z', // TR 2026-11-18 01:30 (18.5 saat oruç)
            is_active: 0,
            notes: null,
          },
        ]],
        [schema.waterIntakeLogs, [
          { date: '2026-11-18', amount_ml: 2100 },
        ]],
      ]));

      const res = await getAnalyticsCalendar(new Request('http://localhost/api/analytics/calendar?days=30'));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);

      const waterQuery = queries.find(q => q.table === schema.waterIntakeLogs);
      expect(waterQuery).toBeDefined();
      expect(waterQuery!.sql).toContain('"water_intake_logs"."user_id" =');
      expect(waterQuery!.sql).not.toContain('"water_intake_logs"."family_id"');
      expect(waterQuery!.params).toContain('user-1');
      expect(waterQuery!.params).not.toContain('fam-1');

      const nov17 = json.data.days.find((d: any) => d.date === '2026-11-17');
      const nov18 = json.data.days.find((d: any) => d.date === '2026-11-18');
      expect(nov17.fastingHours).toBe(0);
      expect(nov18.fastingHours).toBe(18.5);
      expect(nov18.autophagyHours).toBe(2.5);
    } finally {
      vi.useRealTimers();
    }
  });

  it('calculateHeatmapMatrix ve isTransferTransaction gelen transfer, kart ödeme tahsilatı, kredi anaparası ve mevduat faizini doğru sınıflandırmalıdır', () => {
    const incomingTransfer = {
      id: 't-1',
      amount: 10000,
      transaction_date: '2026-11-18',
      merchant: '📥 Gelen Transfer: Vadesiz -> Tasarruf',
      notes: 'Birikim [from_wallet:w1]',
      category_type: null,
    };
    const cardCollection = {
      id: 't-2',
      amount: 6000,
      transaction_date: '2026-11-18',
      merchant: '💳 Kart Ödeme Tahsilatı: Maaş Hesabı',
      notes: 'Borç ödeme [from_wallet:w1]',
      category_type: null,
    };
    const loanPrincipal = {
      id: 't-3',
      amount: 50000,
      transaction_date: '2026-11-18',
      merchant: '🏛️ Kredi Çekim Anaparası (İhtiyaç Kredisi)',
      notes: 'nakit anapara girişi [to_wallet:l1]',
      category_type: null,
    };
    const depositInterest = {
      id: 't-4',
      amount: 2500,
      transaction_date: '2026-11-18',
      merchant: '💵 Vadeli Mevduat Faiz Geliri',
      notes: 'Vadeli net faiz getirisi.',
      category_type: null,
    };

    expect(isTransferTransaction(incomingTransfer)).toBe(true);
    expect(isTransferTransaction(cardCollection)).toBe(true);
    expect(isTransferTransaction(loanPrincipal)).toBe(true);
    expect(isTransferTransaction(depositInterest)).toBe(false);
    expect(isIncomeTransaction(depositInterest)).toBe(true);

    const summary = calculateHeatmapMatrix({
      fastingSessions: [],
      readingSessions: [],
      transactions: [incomingTransfer, cardCollection, loanPrincipal, depositInterest],
      waterLogs: [],
    }, 1, new Date('2026-11-18T12:00:00Z'));

    expect(summary.days[0].spentAmount).toBe(0);
    expect(summary.days[0].isNoSpend).toBe(true);
  });

  it('GET /api/analytics yalnızca aileye izole kategorileri (family_id = fam-1) kapsamalı, gelir limitini gider bütçesine eklememeli ve döviz/transfer/faiz gelirini doğru hesaplamalıdır', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-11-18T12:00:00Z'));
      mockGetAuthUser.mockResolvedValue({ id: 'user-1', family_id: 'fam-1' });

      const queries = setupMockDb(new Map<unknown, unknown[]>([
        [schema.walletsAccounts, [
          { id: 'w-try', type: 'checking', balance: 100000, currency: 'TRY', is_active: 1, user_id: 'user-1', family_id: 'fam-1' },
          { id: 'w-usd-td', type: 'time_deposit', balance: 10000, currency: 'USD', interest_rate: 6, is_active: 1, user_id: null, family_id: 'fam-1', is_family_shared: 1 },
        ]],
        [schema.categories, [
          { id: 'cat-maas-fam-1', name: 'Maaş & Gelir', type: 'income', monthly_budget_limit: 90000, family_id: 'fam-1' },
          { id: 'cat-market-fam-1', name: 'Market & Gıda', type: 'expense', monthly_budget_limit: 20000, family_id: 'fam-1' },
        ]],
        [schema.transactions, [
          // Aileye izole gelir kategorili ama merchant adında 'Maaş' geçmeyen gelir
          { id: 'tx-sal', amount: 80000, currency: 'TRY', transaction_date: '2026-11-05', category_id: 'cat-maas-fam-1', merchant: 'Acme Teknoloji A.Ş.' },
          // Vadeli mevduat faiz geliri
          { id: 'tx-int', amount: 1500, currency: 'TRY', transaction_date: '2026-11-10', category_id: null, merchant: '💵 Vadeli Mevduat Faiz Geliri', notes: 'net faiz getirisi' },
          // Gerçek giderler (Bu ay 10.000 TL, Geçen ay 8.000 TL -> +%25 enflasyon)
          { id: 'tx-exp-cur', amount: 10000, currency: 'TRY', transaction_date: '2026-11-12', category_id: 'cat-market-fam-1', merchant: 'Migros' },
          { id: 'tx-exp-prev', amount: 8000, currency: 'TRY', transaction_date: '2026-10-12', category_id: 'cat-market-fam-1', merchant: 'Migros' },
          // Geçen ay ve bu ay hariç tutulması gereken virman / anapara / tahsilat / gelir satırları
          { id: 'tx-trf-in', amount: 30000, currency: 'TRY', transaction_date: '2026-11-13', category_id: null, merchant: '📥 Gelen Transfer: Banka -> Kasa', notes: 'Özel aktarım [from_wallet:w-try]' },
          { id: 'tx-cc-col', amount: 12000, currency: 'TRY', transaction_date: '2026-11-14', category_id: null, merchant: '💳 Kart Ödeme Tahsilatı: Banka', notes: 'Ödeme [from_wallet:w-try]' },
          { id: 'tx-loan', amount: 150000, currency: 'TRY', transaction_date: '2026-10-20', category_id: null, merchant: '🏛️ Kredi Çekim Anaparası (Ev)', notes: 'anapara [to_wallet:l1]' },
          { id: 'tx-prev-inc', amount: 75000, currency: 'TRY', transaction_date: '2026-10-05', category_id: null, merchant: 'Gelir Girişi: Danışmanlık' },
        ]],
      ]));

      const res = await getAnalytics();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);

      // Categories sorgusu yalnızca aileye (family_id = fam-1) izole olmalı, family_id IS NULL içermemeli
      const catQuery = queries.find(q => q.table === schema.categories);
      expect(catQuery!.sql.toLowerCase()).toContain('"categories"."family_id" =');
      expect(catQuery!.sql.toLowerCase()).not.toContain('"categories"."family_id" is null');

      // Wallets sorgusu ortak (user_id IS NULL) hesapları da içermeli
      const walletQuery = queries.find(q => q.table === schema.walletsAccounts);
      expect(walletQuery!.sql.toLowerCase()).toContain('"wallets_accounts"."user_id" is null');

      // Gider bütçe limiti yalnızca cat-market (20.000), cat-maas (90.000) eklenmemeli!
      expect(json.data.fireMetrics.monthlyLivingExpense).toBe(20000);

      // Dövizli vadeli mevduat (10.000 USD * 40 = 400.000 TL * %6 / 12 = 2.000 TL/ay)
      expect(json.data.fireMetrics.monthlyPassiveIncome).toBe(2000);

      // Gelir = 80.000 (Acme) + 1.500 (Faiz) = 81.500 TL; Gider = 10.000 TL
      expect(json.data.fireMetrics.effectiveMonthlyIncome).toBe(81500);
      expect(json.data.fireMetrics.monthlySavingsEst).toBe(71500);

      // Enflasyon: Bu ay 10.000 / Geçen ay 8.000 => +%25 (kredi anaparası ve gelir girişi hariç!)
      expect(json.data.inflationMetrics.personalInflationRate).toBe(25);
    } finally {
      vi.useRealTimers();
    }
  });

  it('GET /api/analytics yapay bütçe*1.2 geliri üretmemeli (son 3 ay gerçek ortalamayı kullanmalı, yoksa 0) ve dünün lazy-reset edilmemiş takviyesini puanlamamalıdır', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-11-18T12:00:00Z'));
      mockGetAuthUser.mockResolvedValue({ id: 'user-1', family_id: 'fam-1' });

      // Senaryo A: Bütçe var ama hiç gerçek gelir yok -> effectiveMonthlyIncome = 0 (uydurma 24.000 değil!)
      setupMockDb(new Map<unknown, unknown[]>([
        [schema.categories, [
          { id: 'cat-market', name: 'Market', type: 'expense', monthly_budget_limit: 20000, family_id: 'fam-1' },
        ]],
        [schema.supplementRoutines, [
          // Dün (2026-11-17) alınmış ama bugün /wellness açılmadığı için is_taken_today=1 kalmış takviye
          { id: 's-1', user_id: 'user-1', is_active: 1, is_taken_today: 1, last_taken_date: '2026-11-17' },
        ]],
      ]));

      const resA = await getAnalytics();
      const jsonA = await resA.json();

      expect(resA.status).toBe(200);
      expect(jsonA.data.fireMetrics.effectiveMonthlyIncome).toBe(0);
      expect(jsonA.data.fireMetrics.savingsRatePercent).toBe(0);
      // Takviye rutini var (+4 ham puan -> 3/20), ama dünkü is_taken_today (+3) eklenmemeli (7/25 -> 6/20 olmamalı)
      expect(jsonA.data.holisticScore.breakdown.wellness.score).toBe(3);

      // Senaryo B: Bu ay henüz maaş yatmamış ama önceki ayda 60.000 TL gelir varsa 3 aylık gerçek ortalama kullanılır
      setupMockDb(new Map<unknown, unknown[]>([
        [schema.transactions, [
          { id: 'tx-oct-inc', amount: 60000, currency: 'TRY', transaction_date: '2026-10-15', merchant: 'Maaş' },
        ]],
      ]));

      const resB = await getAnalytics();
      const jsonB = await resB.json();
      expect(jsonB.data.fireMetrics.effectiveMonthlyIncome).toBe(60000);
    } finally {
      vi.useRealTimers();
    }
  });

  it('Analitik UI ve CSS dosyaları masaüstü KPI taşma korumasını, çift emoji önlemini ve hata ayrımını içermelidir', () => {
    const root = path.resolve(__dirname, '..');
    const css = fs.readFileSync(path.join(root, 'src/styles/globals.css'), 'utf8');
    const fireCard = fs.readFileSync(path.join(root, 'src/components/analytics/FireAnalyticsCard.tsx'), 'utf8');
    const holisticCard = fs.readFileSync(path.join(root, 'src/components/analytics/HolisticScoreCard.tsx'), 'utf8');
    const heatmap = fs.readFileSync(path.join(root, 'src/components/analytics/LifeCalendarHeatmap.tsx'), 'utf8');
    const page = fs.readFileSync(path.join(root, 'src/app/analytics/page.tsx'), 'utf8');

    expect(css).toContain('@media (min-width: 768px) and (max-width: 1023px)');
    expect(fireCard).toContain("flexWrap: 'wrap'");
    expect(fireCard).toContain('handleSaveTuik');
    expect(holisticCard).toContain('hasLeadingEmoji');
    expect(heatmap).toContain('setError(null)');
    expect(heatmap).toContain('{rangeDays} Günlük Katkı Matrisi');
    expect(heatmap).toContain('useCallback');
    expect(heatmap).not.toMatch(/\b(X|Award|Flame)\b/);
    expect(page).toContain('fetchError');

    const pwa = fs.readFileSync(path.join(root, 'src/components/layout/PwaManager.tsx'), 'utf8');
    const sw = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
    const settingsCard = fs.readFileSync(path.join(root, 'src/components/settings/AnalyticsSettingsCard.tsx'), 'utf8');
    const settingsPage = fs.readFileSync(path.join(root, 'src/app/settings/page.tsx'), 'utf8');

    expect(pwa).toContain('isLocalhost');
    expect(sw).toContain('if (isLocalhost)');
    expect(settingsCard).toContain('/api/analytics');
    expect(settingsPage).toContain('AnalyticsSettingsCard');
  });

  it('PATCH /api/analytics isteğe bağlı TÜFE oranını doğrulamalı, aile bazlı kaydetmeli, temizlemeli ve GET içinde reel avantajı hesaplamalıdır', async () => {
    // 1) Yetkisiz 401
    mockGetAuthUser.mockResolvedValue(null);
    const unauthRes = await patchAnalytics(new Request('http://localhost/api/analytics', {
      method: 'PATCH',
      body: JSON.stringify({ officialTuikRate: 45 }),
    }));
    expect(unauthRes.status).toBe(401);

    // 2) Geçersiz aralık 400
    mockGetAuthUser.mockResolvedValue({ id: 'user-1', family_id: 'fam-1' });
    const badRes = await patchAnalytics(new Request('http://localhost/api/analytics', {
      method: 'PATCH',
      body: JSON.stringify({ officialTuikRate: -5 }),
    }));
    expect(badRes.status).toBe(400);

    // 3) Geçerli değer upsert
    const upsertSpy = vi.fn().mockResolvedValue(undefined);
    const valuesSpy = vi.fn(() => ({ onConflictDoUpdate: upsertSpy }));
    mockInsert.mockReturnValue({ values: valuesSpy });

    const okRes = await patchAnalytics(new Request('http://localhost/api/analytics', {
      method: 'PATCH',
      body: JSON.stringify({ officialTuikRate: '48,64' }),
    }));
    const okJson = await okRes.json();
    expect(okRes.status).toBe(200);
    expect(okJson.data.officialTuikRate).toBe(48.6);
    expect(valuesSpy).toHaveBeenCalledWith(expect.objectContaining({
      key: 'tuik_tufe_rate_fam-1',
      value: '48.6',
    }));

    // 4) Temizleme (null) -> delete
    const deleteWhereSpy = vi.fn().mockResolvedValue(undefined);
    mockDelete.mockReturnValue({ where: deleteWhereSpy });

    const clearRes = await patchAnalytics(new Request('http://localhost/api/analytics', {
      method: 'PATCH',
      body: JSON.stringify({ officialTuikRate: null }),
    }));
    const clearJson = await clearRes.json();
    expect(clearRes.status).toBe(200);
    expect(clearJson.data.officialTuikRate).toBeNull();
    expect(deleteWhereSpy).toHaveBeenCalledTimes(1);

    // 5) GET /api/analytics kayıtlı TÜFE oranı ve 2 aylık harcama verisiyle Reel Avantaj hesaplamalıdır
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-11-18T12:00:00Z'));
      setupMockDb(new Map<unknown, unknown[]>([
        [schema.appSettings, [{ key: 'tuik_tufe_rate_fam-1', value: '48.6' }]],
        [schema.transactions, [
          { id: 'tx-nov', amount: 12500, currency: 'TRY', transaction_date: '2026-11-10', merchant: 'Market' },
          { id: 'tx-oct', amount: 10000, currency: 'TRY', transaction_date: '2026-10-10', merchant: 'Market' },
        ]],
      ]));

      const resWithTuik = await getAnalytics();
      const jsonWithTuik = await resWithTuik.json();
      expect(jsonWithTuik.data.inflationMetrics.personalInflationRate).toBe(25);
      expect(jsonWithTuik.data.inflationMetrics.officialTuikRate).toBe(48.6);
      expect(jsonWithTuik.data.inflationMetrics.savingVsOfficialTuikPercent).toBe(23.6);

      // Harcama karşılaştırması yoksa sahte Reel Avantaj gösterilmemeli (null kalmalı)
      setupMockDb(new Map<unknown, unknown[]>([
        [schema.appSettings, [{ key: 'tuik_tufe_rate_fam-1', value: '48.6' }]],
      ]));
      const resNoSpend = await getAnalytics();
      const jsonNoSpend = await resNoSpend.json();
      expect(jsonNoSpend.data.inflationMetrics.officialTuikRate).toBe(48.6);
      expect(jsonNoSpend.data.inflationMetrics.savingVsOfficialTuikPercent).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('5 Opsiyonel İyileştirme: Isı haritası dövizli harcamayı TRY kuruna çevirmeli, dinamik alışkanlık paydasını (4 vs 5) hesaplamalı ve Holistik Skor Sağlık/Zihin sorgularında 30 günlük tarih penceresi uygulamalıdır', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-11-19T12:00:00Z'));
      mockGetAuthUser.mockResolvedValue({ id: 'user-1', family_id: 'fam-1' });

      // 1) GET /api/analytics/calendar: 10 USD harcama (USD_TRY = 40 -> 400 TL) ve 2 aktif alışkanlık -> totalHabitsTarget = 5
      setupMockDb(new Map<unknown, unknown[]>([
        [schema.transactions, [
          {
            amount: 10,
            currency: 'USD',
            transaction_date: '2026-11-19',
            merchant: 'Cloud Subscription',
            notes: null,
            category_type: 'expense'
          }
        ]],
        [schema.habits, [{ id: 'h-1' }, { id: 'h-2' }]],
        [schema.habitLogs, [{ date: '2026-11-19', is_completed: 1 }]],
      ]));

      const calRes = await getAnalyticsCalendar(new Request('http://localhost/api/analytics/calendar?days=30'));
      const calJson = await calRes.json();

      expect(calRes.status).toBe(200);
      expect(calJson.data.activeHabitsCount).toBe(2);
      expect(calJson.data.totalHabitsTarget).toBe(5);

      const nov19 = calJson.data.days.find((d: any) => d.date === '2026-11-19');
      expect(nov19.spentAmount).toBe(400); // 10 USD * 40 TRY = 400 TL (> 250 TL olduğu için düşük bütçe kriterini geçmez)
      expect(nov19.isNoSpend).toBe(false);
      expect(nov19.completedHabitsCount).toBe(1);
      // 1/2 aktif alışkanlık (%50) tamamlandığı için habitCustom = 1
      expect(nov19.habitsMetCount).toBe(1);

      // 2) GET /api/analytics: Sağlık ve Zihin sorgularında son 30 gün (>= 2026-10-21) tarih filtresi bulunmalıdır
      const queries = setupMockDb(new Map<unknown, unknown[]>([]));
      const anaRes = await getAnalytics();
      expect(anaRes.status).toBe(200);

      for (const tbl of [
        schema.workoutSessions,
        schema.fastingSessions,
        schema.nutritionMeals,
        schema.smartScaleLogs,
        schema.biometrics,
        schema.readingSessions,
        schema.bookQuotes,
        schema.notes
      ]) {
        const q = queries.find(x => x.table === tbl);
        expect(q).toBeDefined();
        expect(q!.sql).toContain('>=');
        expect(q!.params).toContain('2026-10-21');
      }
    } finally {
      vi.useRealTimers();
    }
  });
});
