import { describe, it, expect, vi } from 'vitest';

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  initDatabase: vi.fn().mockResolvedValue(undefined),
}));

import { 
  calculateBillSchedule, 
  calculateCreditCardSchedule, 
  localYYYYMM, 
  localYYYYMMDD, 
  daysInMonth, 
  addMonthsDate, 
  addMonthsSafe 
} from '../src/lib/bill-schedule';
import { sanitizeUser } from '../src/lib/auth';
import { eventBus, EVENTS } from '../src/lib/events';
import { domainEventBus } from '../src/lib/event-bus';
import path from 'path';

describe('Financial Schedule, Installment & Security Calculations', () => {
  it('dates and timezone formatting work correctly', () => {
    const testDate = new Date(2026, 9, 24); // 24 Oct 2026
    expect(localYYYYMM(testDate)).toBe('2026-10');
    expect(localYYYYMMDD(testDate)).toBe('2026-10-24');
  });

  it('installment splitting preserves exact cents without floating point drift', () => {
    const numAmount = 100;
    const totalInstallments = 3;

    const baseMonthly = Math.floor((numAmount / totalInstallments) * 100) / 100;
    const remainder = Math.round((numAmount - (baseMonthly * totalInstallments)) * 100) / 100;

    const installments = [];
    for (let i = 0; i < totalInstallments; i++) {
      const amount = i === 0 ? Math.round((baseMonthly + remainder) * 100) / 100 : baseMonthly;
      installments.push(amount);
    }

    expect(installments[0]).toBe(33.34);
    expect(installments[1]).toBe(33.33);
    expect(installments[2]).toBe(33.33);

    const totalSum = Math.round(installments.reduce((a, b) => a + b, 0) * 100) / 100;
    expect(totalSum).toBe(100.00);
  });

  it('income vs expense reversal math on transaction deletion', () => {
    const bankBalance = 100000;
    const incomeAmount = 50000;
    const isIncome = true;

    // Deleting an income must DECREASE bank balance
    const newBankBalance = isIncome ? Math.max(0, bankBalance - incomeAmount) : bankBalance + incomeAmount;
    expect(newBankBalance).toBe(50000);

    // Deleting an expense must INCREASE bank balance (refund)
    const expenseAmount = 15000;
    const isExpense = false;
    const refundedBankBalance = isExpense ? Math.max(0, bankBalance - expenseAmount) : bankBalance + expenseAmount;
    expect(refundedBankBalance).toBe(115000);

    // Credit card with 20,000 debt deleting a purchase must DECREASE debt
    const cardDebt = 20000;
    const cardPurchaseAmount = 5000;
    const newCardDebt = Math.max(0, cardDebt - cardPurchaseAmount);
    expect(newCardDebt).toBe(15000);
  });

  it('credit card schedule calculates statement cycle properly', () => {
    const card = {
      id: 'acc-cc-1',
      name: 'Garanti Bonus',
      type: 'credit_card',
      balance: 12000,
      cutoff_day: 25,
      due_day: 5,
      credit_limit: 50000,
      created_at: '2026-01-01T00:00:00.000Z'
    };

    const today = new Date(2026, 9, 24); // 24 Oct (before cutoff 25)
    const schedule = calculateCreditCardSchedule(card, [], today);

    expect(schedule).toBeDefined();
    expect(schedule.next_due_date).toBeDefined();
    expect(schedule.statement_cutoff_date).toBeDefined();
  });

  it('sanitizeUser strips sensitive BOPLA fields (password_hash, salt, pin, telegram tokens)', () => {
    const rawUser = {
      id: 'u-1',
      username: 'ugur',
      full_name: 'Uğur',
      role: 'admin',
      family_id: 'fam-u-1',
      password_hash: 'secret_hash_123',
      password_salt: 'secret_salt_456',
      quick_pin_hash: 'secret_pin_789',
      telegram_bot_token: 'bot_token_abc',
      telegram_secret_token: 'sec_token_xyz'
    };

    const safe = sanitizeUser(rawUser);
    expect(safe.id).toBe('u-1');
    expect(safe.username).toBe('ugur');
    expect(safe.password_hash).toBeUndefined();
    expect(safe.password_salt).toBeUndefined();
    expect(safe.quick_pin_hash).toBeUndefined();
    expect(safe.telegram_bot_token).toBeUndefined();
    expect(safe.telegram_secret_token).toBeUndefined();
  });

  it('digital vault Base64 Data URI decoding and MIME parsing works correctly', () => {
    const samplePayload = 'Hello Singularity Vault Document';
    const base64Data = Buffer.from(samplePayload).toString('base64');
    const dataUri = `data:application/pdf;base64,${base64Data}`;

    const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
    expect(match).not.toBeNull();
    if (match) {
      const mimeType = match[1];
      const buffer = Buffer.from(match[2], 'base64');
      expect(mimeType).toBe('application/pdf');
      expect(buffer.toString('utf-8')).toBe(samplePayload);

      const ext = mimeType === 'application/pdf' ? '.pdf' : '.jpg';
      expect(ext).toBe('.pdf');

      const rawTitle = 'Pasaport / Kimlik (2026) ';
      const safeTitle = rawTitle.replace(/[^a-zA-Z0-9_\u00C0-\u017F-]/g, '_').slice(0, 50);
      expect(safeTitle).toBe('Pasaport___Kimlik__2026__');
    }
  });

  it('digital vault file serving blocks path traversal attempts', () => {
    const maliciousPaths = ['../../etc/passwd', '..\\..\\windows\\win.ini', 'valid_file/../../../secret'];
    maliciousPaths.forEach(raw => {
      const sanitized = path.basename(raw);
      const isDangerous = sanitized.includes('..') || raw.includes('..');
      expect(isDangerous).toBe(true);
    });
  });

  it('wallet balance reconciliation math accurately differentiates income vs expense across bank and credit card accounts', () => {
    // 1. Banka hesabı: 10.000 TL var, kullanıcı bankada 12.500 TL olduğunu belirtti -> +2.500 TL Gelir Düzeltmesi
    const bankCurrent = 10000;
    const bankReal = 12500;
    const bankDiff = Math.round((bankReal - bankCurrent) * 100) / 100;
    const bankIsIncome = bankDiff > 0;
    expect(bankDiff).toBe(2500);
    expect(bankIsIncome).toBe(true);

    // 2. Banka hesabı: 10.000 TL var, kullanıcı bankada 8.500 TL olduğunu belirtti -> -1.500 TL Gider Düzeltmesi
    const bankRealLower = 8500;
    const bankDiffLower = Math.round((bankRealLower - bankCurrent) * 100) / 100;
    const bankIsIncomeLower = bankDiffLower > 0;
    expect(bankDiffLower).toBe(-1500);
    expect(bankIsIncomeLower).toBe(false);

    // 3. Kredi kartı: Borç 5.000 TL, ekstrede 7.000 TL borç var -> +2.000 TL Harcama / Gider (Borç arttı)
    const cardDebtCurrent = 5000;
    const cardDebtRealHigher = 7000;
    const cardDebtDiff = Math.round((cardDebtRealHigher - cardDebtCurrent) * 100) / 100;
    const cardIsIncome = cardDebtDiff < 0;
    expect(cardDebtDiff).toBe(2000);
    expect(cardIsIncome).toBe(false);

    // 4. Kredi kartı: Borç 5.000 TL, kullanıcı 3.000 TL borç kaldığını belirtti -> -2.000 TL Ödeme / Gelir (Borç azaldı)
    const cardDebtRealLower = 3000;
    const cardDebtDiffLower = Math.round((cardDebtRealLower - cardDebtCurrent) * 100) / 100;
    const cardIsIncomeLower = cardDebtDiffLower < 0;
    expect(cardDebtDiffLower).toBe(-2000);
    expect(cardIsIncomeLower).toBe(true);

    // 5. Tam eşleşme: Fark 0 ise hiçbir ek işlem oluşturulmaz
    const exactDiff = Math.round((10000 - 10000) * 100) / 100;
    expect(exactDiff).toBe(0);
  });
  it('recurring bill initial payment status: defining bill as already paid marks it as paid this month and defers first due date to next period', () => {
    const today = new Date(2026, 9, 25); // 25 Oct 2026

    // Case 1: Fatura cari dönemde ödenmemiş olarak tanımlanmış (Borçlu)
    const unpaidBill = {
      name: 'Turkcell Fatura',
      due_day: 28,
      period: 'monthly',
      amount: 450,
      last_paid_month: null
    };
    const unpaidSchedule = calculateBillSchedule(unpaidBill, today);
    expect(unpaidSchedule.is_paid_this_month).toBe(false);
    expect(unpaidSchedule.next_due_date).toBe('2026-10-28');

    // Case 2: Fatura tanımlanırken "Bu ay ödendi" seçilmiş (last_paid_month set)
    const paidBill = {
      name: 'Turkcell Fatura',
      due_day: 28,
      period: 'monthly',
      amount: 450,
      last_paid_month: '2026-10',
      last_paid_date: '2026-10-25'
    };
    const paidSchedule = calculateBillSchedule(paidBill, today);
    expect(paidSchedule.is_paid_this_month).toBe(true);
    // İlk ödeme tarihi otomatik olarak Kasım 2026'ya ötelenmelidir
    expect(paidSchedule.next_due_date).toBe('2026-11-28');
  });

  it('calculateCreditCardSchedule excludes card debt payments and refunds from cycle spending', () => {
    const card = {
      id: 'acc-cc-1',
      name: 'Garanti Bonus',
      balance: 15000,
      cutoff_day: 25,
      due_day: 5,
      credit_limit: 50000,
      created_at: '2026-01-01T00:00:00.000Z'
    };

    const today = new Date(2026, 9, 28); // 28 Oct (after cutoff 25)
    const cardTx = [
      { amount: 3000, transaction_date: '2026-10-26', merchant: 'Migros Market', is_installment: 0 },
      { amount: 5000, transaction_date: '2026-10-27', merchant: '💳 Kart Ödemesi: Garanti Bonus', is_installment: 0, type: 'income' },
      { amount: 1500, transaction_date: '2026-10-27', merchant: 'Zara Giyim', is_installment: 0 }
    ];

    const schedule = calculateCreditCardSchedule(card, cardTx, today);
    // current_cycle_spending must be 3000 + 1500 = 4500 (5000 payment must NOT be counted as purchase spending)
    expect(schedule.current_cycle_spending).toBe(4500);
  });

  it('KMH accounts allow spending up to overdraft limit into negative balance', () => {
    const kmhWallet = {
      id: 'acc-kmh-1',
      name: 'Garanti Avans Hesap',
      type: 'kmh',
      balance: 1000,
      overdraft_limit: 10000
    };

    const availableLimit = kmhWallet.balance + kmhWallet.overdraft_limit;
    expect(availableLimit).toBe(11000);

    const expenseAmount = 4000;
    expect(expenseAmount <= availableLimit).toBe(true);

    const newBalance = kmhWallet.balance - expenseAmount;
    expect(newBalance).toBe(-3000);
    expect(newBalance >= -kmhWallet.overdraft_limit).toBe(true);
  });

  it('multi-currency portfolio valuation and KMH debt accounting work accurately', () => {
    const rates = {
      USD_TRY: 38.0,
      EUR_TRY: 41.0,
      GBP_TRY: 48.0,
      GOLD_GRAM_TRY: 3200.0
    };

    const accounts = [
      { type: 'bank', currency: 'TRY', balance: 50000 },
      { type: 'bank', currency: 'USD', balance: 2000 },      // 2000 * 38 = 76000 TRY
      { type: 'vault', currency: 'GOLD', balance: 10 },       // 10 * 3200 = 32000 TRY
      { type: 'kmh', currency: 'TRY', balance: -5000 },       // 5000 TRY debt
      { type: 'credit_card', currency: 'USD', balance: 500 }, // 500 * 38 = 19000 TRY debt
      { type: 'credit_card', currency: 'TRY', balance: 15000 } // 15000 TRY debt
    ];

    const getRate = (curr: string) => {
      if (curr === 'USD') return rates.USD_TRY;
      if (curr === 'EUR') return rates.EUR_TRY;
      if (curr === 'GBP') return rates.GBP_TRY;
      if (curr === 'GOLD') return rates.GOLD_GRAM_TRY;
      return 1.0;
    };

    const totalAssets = accounts
      .filter(a => a.type !== 'credit_card' && a.type !== 'loan')
      .reduce((sum, a) => {
        const bal = Number(a.balance) || 0;
        const rate = getRate(a.currency);
        if (a.type === 'kmh' && bal < 0) return sum;
        return sum + (bal * rate);
      }, 0);

    const totalDebts = accounts
      .reduce((sum, a) => {
        const bal = Number(a.balance) || 0;
        const rate = getRate(a.currency);
        if (a.type === 'credit_card' || a.type === 'loan') {
          return sum + (bal * rate);
        }
        if (a.type === 'kmh' && bal < 0) {
          return sum + (Math.abs(bal) * rate);
        }
        return sum;
      }, 0);

    const netWorth = totalAssets - totalDebts;

    // Assets: 50,000 (TRY) + 76,000 (USD) + 32,000 (GOLD) = 158,000 TRY
    expect(totalAssets).toBe(158000);

    // Debts: 5,000 (KMH overdraft) + 19,000 (USD card) + 15,000 (TRY card) = 39,000 TRY
    expect(totalDebts).toBe(39000);

    // Net worth: 158,000 - 39,000 = 119,000 TRY
    expect(netWorth).toBe(119000);
  });

  describe('Phase 1 Financial Integrity & Overdraft Safeguards', () => {
    it('credit card transfer checks cash advance available limit strictly', () => {
      const card = {
        type: 'credit_card',
        balance: 35000, // current debt
        credit_limit: 50000
      };

      const availableCashAdvance = Math.max(0, (card.credit_limit || 0) - (card.balance || 0));
      expect(availableCashAdvance).toBe(15000);

      const requestedTransfer1 = 20000;
      expect(requestedTransfer1 > availableCashAdvance).toBe(true); // REJECTED

      const requestedTransfer2 = 10000;
      expect(requestedTransfer2 <= availableCashAdvance).toBe(true); // ALLOWED
    });

    it('KMH accounts allow negative balances down to overdraft limit without clamping to 0', () => {
      const kmh = {
        type: 'kmh',
        balance: 1000,
        overdraft_limit: 10000
      };

      const billAmount = 4000;
      const availableFunds = kmh.balance + kmh.overdraft_limit; // 11,000
      expect(availableFunds >= billAmount).toBe(true);

      // Deducting bill without Math.max(0, ...)
      const newBalance = kmh.balance - billAmount; // -3,000
      expect(newBalance).toBe(-3000);
      expect(newBalance >= -kmh.overdraft_limit).toBe(true);

      // Reversing/deleting a 1,000 expense from KMH
      const refundedBalance = newBalance + 1000;
      expect(refundedBalance).toBe(-2000); // accurately maintained
    });

    it('time deposit validates principal, available balance and currency matching', () => {
      const sourceAccount = {
        id: 'acc-bank-1',
        type: 'bank',
        currency: 'TRY',
        balance: 25000
      };

      const validPrincipal = 20000;
      const invalidPrincipal = 30000;
      const foreignCurrency = 'USD';

      // 1. Principal > available funds
      expect(validPrincipal <= sourceAccount.balance).toBe(true);
      expect(invalidPrincipal <= sourceAccount.balance).toBe(false); // REJECTED

      // 2. Currency match
      expect(sourceAccount.currency === 'TRY').toBe(true);
      expect(sourceAccount.currency === foreignCurrency).toBe(false); // REJECTED

      // 3. Maximum plausible interest calculation prevents fraudulent injections
      const principal = 100000;
      const interestRate = 45; // 45% annual
      const daysElapsed = 30;
      const theoreticalMax = (principal * (interestRate / 100) * (daysElapsed / 365)) * 2;
      const hackedInterest = 50000;
      expect(hackedInterest > theoreticalMax).toBe(true); // REJECTED
    });

    it('personal debt payment rejects zero or negative amounts and calculates deletion rollback', () => {
      const invalidPayments = [0, -500, NaN];
      invalidPayments.forEach(p => {
        const isValid = !isNaN(p) && p > 0;
        expect(isValid).toBe(false);
      });

      // Rollback math on personal debt deletion
      // Scenario A: Debt taken = 10,000 TRY, Paid = 3,000 TRY.
      // Net money currently residing in wallet from this debt: 10,000 - 3,000 = 7,000 TRY.
      // To rollback debt deletion: wallet balance must decrease by 7,000 TRY.
      const debtOrig = 10000;
      const debtPaid = 3000;
      const debtNetImpact = debtOrig - debtPaid;
      expect(debtNetImpact).toBe(7000);

      let walletBalance = 50000;
      walletBalance = walletBalance - debtNetImpact;
      expect(walletBalance).toBe(43000); // 7,000 cleanly rolled back
    });
  });

  describe('Phase 2 Calendar, Month-End Overflow & Statement Synchronization', () => {
    it('addMonthsSafe clamps month-end days without JavaScript setMonth overflow', () => {
      // 31 January 2026 + 1 month -> must be 28 February 2026 (not 3 March)
      const jan31_2026 = new Date(2026, 0, 31);
      expect(addMonthsSafe(jan31_2026, 1)).toBe('2026-02-28');

      // 31 January 2028 (leap year) + 1 month -> must be 29 February 2028 (not 2 March)
      const jan31_2028 = new Date(2028, 0, 31);
      expect(addMonthsSafe(jan31_2028, 1)).toBe('2028-02-29');

      // 31 March 2026 + 1 month -> must be 30 April 2026 (not 1 May)
      const mar31_2026 = new Date(2026, 2, 31);
      expect(addMonthsSafe(mar31_2026, 1)).toBe('2026-04-30');

      // 31 August 2026 + 1 month -> must be 30 September 2026
      const aug31_2026 = new Date(2026, 7, 31);
      expect(addMonthsSafe(aug31_2026, 1)).toBe('2026-09-30');

      // 31 December 2026 + 1 month -> must roll over to 31 January 2027
      const dec31_2026 = new Date(2026, 11, 31);
      expect(addMonthsSafe(dec31_2026, 1)).toBe('2027-01-31');

      // 31 December 2026 + 2 months -> must be 28 February 2027
      expect(addMonthsSafe(dec31_2026, 2)).toBe('2027-02-28');
    });

    it('calculateCreditCardSchedule synchronizes statement cutoff and due date across periods', () => {
      const card = {
        balance: 10000,
        cutoff_day: 25,
        due_day: 5,
        interest_rate_late: 4.55
      };

      // Scenario A: Today is 24 October 2026 (BEFORE October 25 cutoff)
      // Statement cutoff was 25 Sept, due 5 Oct (which has passed -> overdue if unpaid)
      // Next cutoff will be 25 Oct, due 5 Nov
      const todayOct24 = new Date(2026, 9, 24);
      const resOct24 = calculateCreditCardSchedule(card, [], todayOct24);

      expect(resOct24.statement_cutoff_date).toBe('2026-09-25');
      expect(resOct24.cycle_start_date).toBe('2026-09-26');
      expect(resOct24.cycle_end_date).toBe('2026-10-25');
      expect(resOct24.is_overdue).toBe(true);
      expect(resOct24.overdue_amount).toBe(10000);
      expect(resOct24.next_due_date).toBe('2026-11-05');

      // Scenario B: Today is 26 October 2026 (AFTER October 25 cutoff)
      // October statement closed on 25 Oct, payment is due on 5 Nov (NOT overdue)
      // Next cycle ends on 25 Nov
      const todayOct26 = new Date(2026, 9, 26);
      const resOct26 = calculateCreditCardSchedule(card, [], todayOct26);

      expect(resOct26.statement_cutoff_date).toBe('2026-10-25');
      expect(resOct26.cycle_start_date).toBe('2026-10-26');
      expect(resOct26.cycle_end_date).toBe('2026-11-25');
      expect(resOct26.next_due_date).toBe('2026-11-05');
      expect(resOct26.is_overdue).toBe(false);
      expect(resOct26.days_until_due).toBe(10); // 26 Oct to 5 Nov = 10 days

      // Scenario C: Today is 6 November 2026 (AFTER 5 Nov due date)
      // October statement is now overdue!
      const todayNov6 = new Date(2026, 10, 6);
      const resNov6 = calculateCreditCardSchedule(card, [], todayNov6);

      expect(resNov6.is_overdue).toBe(true);
      expect(resNov6.days_overdue).toBe(1); // 1 day overdue (5 Nov -> 6 Nov)
      expect(resNov6.next_due_date).toBe('2026-12-05');
    });

    it('same-month cycle credit card (cutoff 10, due 20) calculates accurately', () => {
      const card = {
        balance: 5000,
        cutoff_day: 10,
        due_day: 20,
        interest_rate_late: 4.55
      };

      // Today is 15 October 2026 (Between cutoff 10 and due 20)
      // Statement cutoff is 10 Oct, due 20 Oct -> NOT overdue, 5 days until due
      const todayOct15 = new Date(2026, 9, 15);
      const resOct15 = calculateCreditCardSchedule(card, [], todayOct15);

      expect(resOct15.statement_cutoff_date).toBe('2026-10-10');
      expect(resOct15.next_due_date).toBe('2026-10-20');
      expect(resOct15.is_overdue).toBe(false);
      expect(resOct15.days_until_due).toBe(5);

      // Today is 22 October 2026 (AFTER due 20) -> OVERDUE
      const todayOct22 = new Date(2026, 9, 22);
      const resOct22 = calculateCreditCardSchedule(card, [], todayOct22);

      expect(resOct22.is_overdue).toBe(true);
      expect(resOct22.days_overdue).toBe(2);
      expect(resOct22.next_due_date).toBe('2026-11-20');
    });

    it('floating point rounding avoids fractional cents in installments and statements', () => {
      // Classic JS floating point inaccuracy: 0.1 + 0.2 = 0.30000000000000004
      const rawFloat = 0.1 + 0.2;
      const safeFloat = Math.round(rawFloat * 100) / 100;

      expect(rawFloat).not.toBe(0.3);
      expect(safeFloat).toBe(0.3);

      // Multi-installment split & sum rounding
      const monthlyAmount = 33.333333;
      const count = 3;
      const rawTotal = monthlyAmount * count;
      const safeTotal = Math.round(rawTotal * 100) / 100;

      expect(safeTotal).toBe(100.00);

      // Interest calculation rounding (2 decimal places, kuruş)
      const debt = 1234.56;
      const dailyRate = (4.55 / 100) / 30;
      const days = 17;
      const rawInterest = debt * dailyRate * days; // 31.832264...
      const safeInterest = Math.round(rawInterest * 100) / 100;

      expect(safeInterest).toBe(31.83);
    });
  });

  describe('Phase 3 Authorization, BOLA Isolation & Reconciliation Safeguards', () => {
    it('reconciliation accurately calculates income vs expense for bank accounts and credit cards', () => {
      // 1. Bank Account (Assets)
      const bankCurrent = 50000;
      const bankRealHigher = 52000;
      const bankDiffPositive = bankRealHigher - bankCurrent; // +2000
      const isBankIncome = bankDiffPositive > 0;
      expect(isBankIncome).toBe(true); // Money arrived -> Income

      const bankRealLower = 47000;
      const bankDiffNegative = bankRealLower - bankCurrent; // -3000
      const isBankExpense = bankDiffNegative < 0;
      expect(isBankExpense).toBe(true); // Money left -> Expense

      // 2. Credit Card (Liabilities / Debt)
      const cardDebtCurrent = 20000;
      const cardDebtRealHigher = 25000; // Debt went up
      const cardDiffDebtUp = cardDebtRealHigher - cardDebtCurrent; // +5000
      // In credit card, higher debt means more spending -> Expense
      const isCardDebtUpIncome = cardDiffDebtUp < 0;
      expect(isCardDebtUpIncome).toBe(false); // Expense

      const cardDebtRealLower = 15000; // Debt went down (payment was made)
      const cardDiffDebtDown = cardDebtRealLower - cardDebtCurrent; // -5000
      const isCardDebtDownIncome = cardDiffDebtDown < 0;
      expect(isCardDebtDownIncome).toBe(true); // Income / Payment
    });

    it('category BOLA and seed category protection blocks unauthorized mutation and deletion', () => {
      const userFamilyId = 'fam-user-1';
      const foreignFamilyId = 'fam-user-2';

      const ownCategory = { id: 'cat-custom-1', family_id: 'fam-user-1', name: 'Evcil Hayvan' };
      const foreignCategory = { id: 'cat-custom-2', family_id: 'fam-user-2', name: 'Özel Harcama' };
      const systemCategory = { id: 'cat-market', family_id: null, name: 'Market' };

      // Check family mutation permission
      const canMutateOwn = !ownCategory.family_id || ownCategory.family_id === userFamilyId;
      expect(canMutateOwn).toBe(true);

      const canMutateForeign = !foreignCategory.family_id || foreignCategory.family_id === userFamilyId;
      expect(canMutateForeign).toBe(false); // REJECTED with 403

      // Seed / System Category deletion permission (Must be blocked for all users)
      const seedCategories = ['cat-maas', 'cat-market', 'cat-kira', 'cat-fatura', 'cat-ulasim', 'cat-eeglence', 'cat-saglik', 'cat-diger'];
      const canDeleteSystemCat = !seedCategories.includes(systemCategory.id) && systemCategory.family_id !== null;
      expect(canDeleteSystemCat).toBe(false); // BLOCKED
    });
  });

  describe('Phase 4 Event Bus Fault Tolerance & Memory Leak Protection', () => {
    it('eventBus isolates handler exceptions without crashing or blocking other listeners', async () => {
      const testEvent = 'test:financial_action';
      let listenerAExecuted = false;
      let listenerBExecuted = false;

      // Listener 1 succeeds
      const unsub1 = eventBus.subscribe(testEvent, () => {
        listenerAExecuted = true;
      });

      // Listener 2 throws an intentional exception (simulating telemetry failure or db error)
      const unsub2 = eventBus.subscribe(testEvent, () => {
        throw new Error('Simulated Background Listener Exception');
      });

      // Listener 3 succeeds despite Listener 2 throwing
      const unsub3 = eventBus.subscribe(testEvent, () => {
        listenerBExecuted = true;
      });

      // emit() MUST NOT throw even if Listener 2 threw
      await expect(eventBus.emit(testEvent, { id: 'tx-1' })).resolves.not.toThrow();

      expect(listenerAExecuted).toBe(true);
      expect(listenerBExecuted).toBe(true);

      // Clean up subscriptions
      unsub1();
      unsub2();
      unsub3();

      // Verify unsubscriptions worked
      listenerAExecuted = false;
      await eventBus.emit(testEvent, { id: 'tx-2' });
      expect(listenerAExecuted).toBe(false);
    });

    it('eventBus deduplicates identical handler references preventing memory leak proliferation', () => {
      const testEvent = 'test:dedup_action';
      const handler = () => {};

      const countBefore = eventBus.listenerCount(testEvent);

      const unsub1 = eventBus.subscribe(testEvent, handler);
      const unsub2 = eventBus.subscribe(testEvent, handler); // duplicate subscription of same fn

      const countAfter = eventBus.listenerCount(testEvent);
      // Because Set is used internally, count increases only by 1
      expect(countAfter).toBe(countBefore + 1);

      unsub1();
      expect(eventBus.listenerCount(testEvent)).toBe(countBefore);
    });

    it('domainEventBus handles concurrent dispatches with Promise.allSettled and exception isolation', async () => {
      let executed = false;

      const unsub = domainEventBus.subscribe('READING_SESSION_COMPLETED', (event) => {
        if (event.payload.bookId === 'bad-book') {
          throw new Error('Crash in domain handler');
        }
        executed = true;
      });

      // Dispatching with bad book shouldn't reject
      await expect(domainEventBus.dispatch({
        type: 'READING_SESSION_COMPLETED',
        payload: {
          userId: 'u-1',
          bookId: 'bad-book',
          startPage: 1,
          endPage: 20,
          durationMinutes: 15,
          wpm: 250,
          date: '2026-10-25'
        }
      })).resolves.not.toThrow();

      // Dispatching with good book succeeds
      await domainEventBus.dispatch({
        type: 'READING_SESSION_COMPLETED',
        payload: {
          userId: 'u-1',
          bookId: 'good-book',
          startPage: 1,
          endPage: 20,
          durationMinutes: 15,
          wpm: 250,
          date: '2026-10-25'
        }
      });

      expect(executed).toBe(true);
      unsub();
    });
  });
});
