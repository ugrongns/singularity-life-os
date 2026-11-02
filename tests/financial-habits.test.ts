import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getFinancialHabits } from '../src/app/api/budget/habits/route';
import { getAuthUser } from '../src/lib/auth';
import {
  isIncomeTransaction,
  isTransferTransaction,
  calculateSpendingHabits,
  RawTransactionHabit
} from '../src/lib/financial-habits';

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

describe('💰 Singularity Faz 3: Finansal Harcama Davranışları & No-Spend Analitiği (TDD)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. OWASP BOLA & IDOR Güvenlik Denetimleri', () => {
    it('Yetkisiz isteklerde 401 Unauthorized dönmelidir', async () => {
      vi.mocked(getAuthUser).mockResolvedValue(null);

      const req = new Request('http://localhost:3000/api/budget/habits');
      const res = await getFinancialHabits(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/Yetkisiz/i);
    });

    it('Kullanıcı sadece kendi ve yetkili ailesine ait harcama kayıtlarını çekebilmelidir (BOLA İzolasyonu)', async () => {
      vi.mocked(getAuthUser).mockResolvedValue({
        id: 'user-ugur-fin',
        family_id: 'fam-ugur'
      } as any);

      const mockRows: RawTransactionHabit[] = [
        {
          id: 'tx-1',
          amount: 250,
          transaction_date: '2026-10-15',
          merchant: 'Migros',
          category_type: 'expense',
          category_name: 'Market',
          user_id: 'user-ugur-fin'
        }
      ];

      mockSelect.mockReturnValue(createSelectChain(mockRows));

      const req = new Request('http://localhost:3000/api/budget/habits');
      const res = await getFinancialHabits(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.weekdayExpense + json.data.weekendExpense).toBe(250);
    });
  });

  describe('2. Gelir & Transfer Hareketlerinin Giderden Ayrıştırılması', () => {
    it('Maaş ve gelir hareketleri gider olarak sayılmamalı, gelire eklenmelidir', () => {
      const txIncomeCat: RawTransactionHabit = {
        id: 'inc-1',
        amount: 50000,
        transaction_date: '2026-10-01',
        merchant: 'Şirket A.Ş.',
        category_type: 'income',
        category_name: 'Maaş'
      };

      const txIncomeMerchant: RawTransactionHabit = {
        id: 'inc-2',
        amount: 15000,
        transaction_date: '2026-10-05',
        merchant: 'Kira Geliri',
        category_type: 'expense' // kategori hatalı girilse dahi merchant filtresi korur
      };

      expect(isIncomeTransaction(txIncomeCat)).toBe(true);
      expect(isIncomeTransaction(txIncomeMerchant)).toBe(true);
    });

    it('Kart borcu ödemeleri ve hesaplar arası transferler harcama (expense) olarak sayılmamalıdır', () => {
      const txCardPay: RawTransactionHabit = {
        id: 'tr-1',
        amount: 8000,
        transaction_date: '2026-10-10',
        merchant: '💳 Kart Ödemesi: Denizbank Bonus',
        category_type: 'expense'
      };

      const txTransfer: RawTransactionHabit = {
        id: 'tr-2',
        amount: 5000,
        transaction_date: '2026-10-12',
        merchant: '🔄 Transfer: Ana Hesap -> Birikim',
        category_type: 'expense'
      };

      expect(isTransferTransaction(txCardPay)).toBe(true);
      expect(isTransferTransaction(txTransfer)).toBe(true);
    });
  });

  describe('3. No-Spend Günleri & Davranışsal Metrikler', () => {
    it('Ay içinde harcama yapılmayan günler (No-Spend Days) doğru tespit edilmelidir', () => {
      const refDate = new Date('2026-10-10T12:00:00.000Z'); // 10 Ekim (Ayın ilk 10 günü)

      // 10 gün içinde sadece 2 gün harcama var: 2 Ekim ve 5 Ekim
      const mockTxs: RawTransactionHabit[] = [
        { id: '1', amount: 500, transaction_date: '2026-10-02', merchant: 'Kahve', category_type: 'expense' },
        { id: '2', amount: 1200, transaction_date: '2026-10-05', merchant: 'Market', category_type: 'expense' },
        { id: '3', amount: 45000, transaction_date: '2026-10-01', merchant: 'Maaş', category_type: 'income' } // Gelir harcama sayılmaz
      ];

      const summary = calculateSpendingHabits(mockTxs, refDate);

      // 10 günün 2'sinde harcama yapıldı -> 8 No-Spend günü!
      expect(summary.daysPassedInMonth).toBe(10);
      expect(summary.noSpendDaysThisMonth).toBe(8);
      expect(summary.targetAchieved).toBe(true); // 8 gün hedefine ulaşıldı
      expect(summary.noSpendDates).toContain('2026-10-01');
      expect(summary.noSpendDates).toContain('2026-10-03');
      expect(summary.noSpendDates).not.toContain('2026-10-02');
      expect(summary.noSpendDates).not.toContain('2026-10-05');
    });

    it('Hafta içi vs Hafta sonu harcama yüzdesi toplamı kesinlikle %100 olmalıdır', () => {
      // 2026-10-02 Cuma (Hafta içi) = 600 TL
      // 2026-10-03 Cumartesi (Hafta sonu) = 400 TL
      const mockTxs: RawTransactionHabit[] = [
        { id: '1', amount: 600, transaction_date: '2026-10-02', merchant: 'Restoran', category_type: 'expense' },
        { id: '2', amount: 400, transaction_date: '2026-10-03', merchant: 'Sinema', category_type: 'expense' }
      ];

      const summary = calculateSpendingHabits(mockTxs, new Date('2026-10-15'));

      expect(summary.weekdayExpense).toBe(600);
      expect(summary.weekendExpense).toBe(400);
      expect(summary.weekdayPercent).toBe(60);
      expect(summary.weekendPercent).toBe(40);
      expect(summary.weekdayPercent + summary.weekendPercent).toBe(100);
      expect(summary.dayOfWeekDistribution).toHaveLength(7);
    });

    it('Tasarruf oranı eğrisi (Gelir - Gider) / Gelir * 100 hesabı doğrulanmalıdır', () => {
      // Ekim 2026: Gelir = 50.000, Gider = 30.000 -> Tasarruf = 20.000 (%40)
      const mockTxs: RawTransactionHabit[] = [
        { id: '1', amount: 50000, transaction_date: '2026-10-01', merchant: 'Maaş', category_type: 'income' },
        { id: '2', amount: 30000, transaction_date: '2026-10-08', merchant: 'Kira & Faturalar', category_type: 'expense' }
      ];

      const summary = calculateSpendingHabits(mockTxs, new Date('2026-10-25'));
      const oct = summary.savingsRateTrend.find(m => m.month === '2026-10');

      expect(oct).toBeDefined();
      expect(oct!.income).toBe(50000);
      expect(oct!.expense).toBe(30000);
      expect(oct!.savings).toBe(20000);
      expect(oct!.savingsRate).toBe(40);
      expect(summary.currentSavingsRate).toBe(40);
    });

    it('Ay başı (1-10) maaş sonrası dürtüsel harcama piki tespit edilmelidir', () => {
      // 1-10 arası: 15.000 TL harcama, 11-20 arası: 2.000 TL, 21-31 arası: 1.000 TL
      const mockTxs: RawTransactionHabit[] = [
        { id: '1', amount: 15000, transaction_date: '2026-10-03', merchant: 'Teknoloji', category_type: 'expense' },
        { id: '2', amount: 2000, transaction_date: '2026-10-15', merchant: 'Market', category_type: 'expense' },
        { id: '3', amount: 1000, transaction_date: '2026-10-25', merchant: 'Ulaşım', category_type: 'expense' }
      ];

      const summary = calculateSpendingHabits(mockTxs, new Date('2026-10-28'));

      expect(summary.peakPeriods.periodName).toContain('1-10 Ay Başı');
      expect(summary.peakPeriods.peakDay).toBe(3);
      expect(summary.peakPeriods.peakDayAmount).toBe(15000);
      expect(summary.peakPeriods.isImpulsiveSalarySpike).toBe(true); // 15.000 / 18.000 = %83 > %50
    });
  });
});
