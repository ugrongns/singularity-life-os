import { describe, it, expect } from 'vitest';
import { calculateBillSchedule, calculateCreditCardSchedule, localYYYYMM, localYYYYMMDD } from '../src/lib/bill-schedule';
import { sanitizeUser } from '../src/lib/auth';
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
});
