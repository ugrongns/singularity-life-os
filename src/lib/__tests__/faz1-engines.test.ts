import { describe, it, expect } from 'vitest';
import {
  simulateMinimumPaymentTrap,
  simulateCashAdvanceCost,
  calculateLoanAmortization,
  calculateSafeDailySpendLimit
} from '../debt-simulators';
import { parseQuickFinanceInput, parseQuickTurkishAmount } from '../finance-quick-parser';
import { matchesTurkishQuery, getTurkeyHour } from '../date-utils';

describe('Faz 1 — Matematiksel Finans & Doğal Dil Motorları', () => {
  it('BDDK %20 / %40 asgari ödeme kuralını ve %30 KKDF+BSMV vergi çarpanını doğru uygular', () => {
    const lowLimit = simulateMinimumPaymentTrap({
      balance: 20000,
      creditLimit: 40000,
      monthlyContractualRatePercent: 4.25
    });
    expect(lowLimit.appliedMinRatePercent).toBe(20);
    expect(lowLimit.firstMonthMinPayment).toBe(4000);
    expect(lowLimit.monthsToPayoff).toBeGreaterThan(10);
    expect(lowLimit.totalInterestAndTax).toBeGreaterThan(0);

    const highLimit = simulateMinimumPaymentTrap({
      balance: 20000,
      creditLimit: 80000,
      monthlyContractualRatePercent: 4.25
    });
    expect(highLimit.appliedMinRatePercent).toBe(40);
    expect(highLimit.firstMonthMinPayment).toBe(8000);
    expect(highLimit.monthsToPayoff).toBeLessThan(lowLimit.monthsToPayoff);

    const zeroDebt = simulateMinimumPaymentTrap({ balance: 0, creditLimit: 50000 });
    expect(zeroDebt.monthsToPayoff).toBe(0);
    expect(zeroDebt.totalPaid).toBe(0);
  });

  it('Nakit avans günlük faiz + vergi + komisyon hesabını doğru yapar', () => {
    const res = simulateCashAdvanceCost({
      amount: 10000,
      days: 30,
      monthlyRatePercent: 5.0,
      feePercent: 1.0
    });
    // 10.000 * %5 = 500 faiz; %30 vergi = 150; %1 komisyon = 100 + %15 BSMV = 115 -> toplam 765
    expect(res.rawInterest).toBe(500);
    expect(res.feeAmount).toBe(115);
    expect(res.totalCost).toBe(765);
    expect(res.totalRepayment).toBe(10765);
  });

  it('Banka kredisi Fransız itfa ve erken kapama tasarrufunu hesaplar', () => {
    const loan = calculateLoanAmortization({
      principal: 100000,
      totalInstallments: 12,
      monthlyContractualRatePercent: 4.0,
      taxMultiplier: 1.3,
      earlyPayoffAfterMonth: 3
    });
    expect(loan.schedule.length).toBe(12);
    expect(loan.schedule[11].remainingBalance).toBe(0);
    expect(loan.effectiveAnnualCostRatePercent).toBeGreaterThan(50);
    expect(loan.remainingPrincipalToPay).toBeGreaterThan(0);
    expect(loan.savedInterestAndTax).toBeGreaterThan(0);

    // Bilinen taksit tutarından faiz tersine çözüm testi
    const reverse = calculateLoanAmortization({
      principal: 100000,
      totalInstallments: 12,
      knownMonthlyInstallment: loan.monthlyInstallment,
      taxMultiplier: 1.3
    });
    expect(Math.abs(reverse.estimatedMonthlyContractualRatePercent - 4.0)).toBeLessThan(0.15);
  });

  it('Güvenli günlük harcama limitinde sıfıra bölünme ve negatif nakit korumasını uygular', () => {
    const safe = calculateSafeDailySpendLimit({
      monthlyIncome: 50000,
      monthlyExpenseSoFar: 20000,
      unpaidFixedBillsTotal: 10000,
      remainingDaysInMonth: 10
    });
    expect(safe.freeCash).toBe(20000);
    expect(safe.safeDailyLimit).toBe(2000);

    const deficit = calculateSafeDailySpendLimit({
      monthlyIncome: 10000,
      monthlyExpenseSoFar: 15000,
      unpaidFixedBillsTotal: 2000,
      remainingDaysInMonth: 0
    });
    expect(deficit.safeDailyLimit).toBe(0);
    expect(deficit.remainingDaysInMonth).toBe(1);
  });

  it('Doğal dil finans ayrıştırıcısı Türkçe tutar, gelir/gider, cüzdan ve kategoriyi doğru çözer', () => {
    const accounts = [
      { id: 'w-cash', name: 'Nakit Cüzdan', type: 'cash' },
      { id: 'w-garanti', name: 'Garanti Vadesiz', type: 'bank' }
    ];
    const categories = [
      { id: 'cat-maas', name: 'Maaş & Gelir', type: 'income' },
      { id: 'cat-eglence', name: 'Eğlence & Dışarıda Yeme', type: 'expense' },
      { id: 'cat-market', name: 'Market & Gıda', type: 'expense' }
    ];

    const coffee = parseQuickFinanceInput('Kahve 120 nakit', accounts, categories);
    expect(coffee.txType).toBe('expense');
    expect(coffee.numericAmount).toBe(120);
    expect(coffee.walletId).toBe('w-cash');
    expect(coffee.categoryId).toBe('cat-eglence');
    expect(coffee.merchant).toBe('Kahve');

    const salary = parseQuickFinanceInput('+65.000,50 maaş garanti', accounts, categories);
    expect(salary.txType).toBe('income');
    expect(salary.numericAmount).toBe(65000.5);
    expect(salary.walletId).toBe('w-garanti');
    expect(salary.categoryId).toBe('cat-maas');

    expect(parseQuickTurkishAmount('1.450,50')).toBe(1450.5);
    expect(parseQuickTurkishAmount('15bin')).toBe(15000);
  });

  it('Türkçe karakter normalize arama ve Türkiye saati yardımcılarını doğrular', () => {
    expect(matchesTurkishQuery('is bankasi', ['İş Bankası Kredi Kartı'])).toBe(true);
    expect(matchesTurkishQuery('kutuphane', ['Kütüphane Özeti'])).toBe(true);
    // 2026-11-19T18:30:00Z -> TR (+03:00) saat 21
    expect(getTurkeyHour('2026-11-19T18:30:00.000Z')).toBe(21);
  });
});
