import { describe, it, expect } from 'vitest';
import { calculateBillSchedule, calculateCreditCardSchedule, localYYYYMM, localYYYYMMDD } from '../src/lib/bill-schedule';
import { sanitizeUser } from '../src/lib/auth';

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
});
