// Singularity Life OS — Kredi Kartı Asgari Ödeme Tuzağı, Nakit Avans & Fransız İtfa Motoru

export const TR_LOAN_TAX_MULTIPLIER = 1.3; // %15 KKDF + %15 BSMV = %30 vergi çarpanı

export interface MinPaymentTrapRow {
  month: number;
  startingBalance: number;
  minPayment: number;
  interestAndTax: number;
  principalPaid: number;
  endingBalance: number;
}

export interface MinPaymentTrapResult {
  appliedMinRatePercent: number; // %20 veya %40
  bddkRuleLabel: string;
  firstMonthMinPayment: number;
  monthsToPayoff: number;
  hitMaxCap: boolean;
  totalPaid: number;
  totalInterestAndTax: number;
  schedule: MinPaymentTrapRow[];
}

/**
 * BDDK %20 / %40 Asgari Ödeme Tuzağı Simülatörü
 * Limit > 50.000 TL için %40, aksi halde %20 asgari ödeme oranı uygulanır (override edilebilir).
 */
export function simulateMinimumPaymentTrap(params: {
  balance: number;
  creditLimit?: number;
  monthlyContractualRatePercent?: number;
  customMinPaymentPercent?: number;
  maxMonths?: number;
}): MinPaymentTrapResult {
  const balance = Math.max(0, Number(params.balance) || 0);
  const creditLimit = Math.max(0, Number(params.creditLimit) || 0);
  const monthlyRate = Math.max(0, Number(params.monthlyContractualRatePercent ?? 4.25));
  const defaultMinRate = creditLimit > 50000 ? 40 : 20;
  const minRatePercent =
    params.customMinPaymentPercent && params.customMinPaymentPercent > 0
      ? Math.min(100, Math.max(10, params.customMinPaymentPercent))
      : defaultMinRate;
  const maxMonths = params.maxMonths ?? 120;

  const bddkRuleLabel =
    creditLimit > 50000
      ? 'BDDK Kuralı: 50.000 ₺ üstü limitlerde asgari %40'
      : 'BDDK Kuralı: 50.000 ₺ ve altı limitlerde asgari %20';

  if (balance <= 0) {
    return {
      appliedMinRatePercent: minRatePercent,
      bddkRuleLabel,
      firstMonthMinPayment: 0,
      monthsToPayoff: 0,
      hitMaxCap: false,
      totalPaid: 0,
      totalInterestAndTax: 0,
      schedule: []
    };
  }

  const effectiveMonthlyRate = (monthlyRate / 100) * TR_LOAN_TAX_MULTIPLIER;
  let current = balance;
  let totalPaid = 0;
  let totalInterestAndTax = 0;
  const schedule: MinPaymentTrapRow[] = [];

  for (let m = 1; m <= maxMonths; m++) {
    if (current <= 0.01) break;
    // Dönem başı borç üzerinden asgari ödeme (pratikte min 100 TL eşiği veya kalan borç)
    const rawMin = current * (minRatePercent / 100);
    const minPayment = current <= 100 ? current : Math.min(current, Math.max(100, rawMin));

    const remainingAfterPayment = Math.max(0, current - minPayment);
    const interestAndTax = remainingAfterPayment * effectiveMonthlyRate;
    const endingBalance = remainingAfterPayment + interestAndTax;

    totalPaid += minPayment;
    totalInterestAndTax += interestAndTax;

    schedule.push({
      month: m,
      startingBalance: Math.round(current * 100) / 100,
      minPayment: Math.round(minPayment * 100) / 100,
      interestAndTax: Math.round(interestAndTax * 100) / 100,
      principalPaid: Math.round((minPayment - Math.min(minPayment, interestAndTax)) * 100) / 100,
      endingBalance: Math.round(endingBalance * 100) / 100
    });

    current = endingBalance;
  }

  const hitMaxCap = current > 0.01;
  return {
    appliedMinRatePercent: minRatePercent,
    bddkRuleLabel,
    firstMonthMinPayment: schedule[0]?.minPayment ?? 0,
    monthsToPayoff: schedule.length,
    hitMaxCap,
    totalPaid: Math.round(totalPaid * 100) / 100,
    totalInterestAndTax: Math.round(totalInterestAndTax * 100) / 100,
    schedule
  };
}

export interface CashAdvanceCostResult {
  amount: number;
  days: number;
  rawInterest: number;
  taxAmount: number;
  feeAmount: number;
  totalCost: number;
  totalRepayment: number;
  costPercent: number;
}

/**
 * Gün Bazlı Nakit Avans Maliyet Simülatörü (Günlük Faiz + %30 KKDF/BSMV + Çekim Komisyonu)
 */
export function simulateCashAdvanceCost(params: {
  amount: number;
  days: number;
  monthlyRatePercent?: number;
  feePercent?: number;
}): CashAdvanceCostResult {
  const amount = Math.max(0, Number(params.amount) || 0);
  const days = Math.max(1, Math.min(365, Math.round(Number(params.days) || 1)));
  const monthlyRate = Math.max(0, Number(params.monthlyRatePercent ?? 5.0));
  const feePercent = Math.max(0, Number(params.feePercent ?? 1.0));

  if (amount <= 0) {
    return {
      amount: 0,
      days,
      rawInterest: 0,
      taxAmount: 0,
      feeAmount: 0,
      totalCost: 0,
      totalRepayment: 0,
      costPercent: 0
    };
  }

  const rawInterest = amount * (monthlyRate / 100) * (days / 30);
  const interestTax = rawInterest * 0.3; // %15 KKDF + %15 BSMV
  const baseFee = amount * (feePercent / 100);
  const feeBsmv = baseFee * 0.15; // Çekim komisyonuna %15 BSMV
  const feeAmount = baseFee + feeBsmv;
  const taxAmount = interestTax + feeBsmv;
  const totalCost = rawInterest + interestTax + feeAmount;
  const totalRepayment = amount + totalCost;

  return {
    amount: Math.round(amount * 100) / 100,
    days,
    rawInterest: Math.round(rawInterest * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    feeAmount: Math.round(feeAmount * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    totalRepayment: Math.round(totalRepayment * 100) / 100,
    costPercent: Math.round((totalCost / amount) * 10000) / 100
  };
}

export interface LoanAmortizationRow {
  installmentNo: number;
  payment: number;
  principal: number;
  interest: number;
  tax: number;
  remainingBalance: number;
}

export interface LoanAmortizationResult {
  principal: number;
  totalInstallments: number;
  monthlyInstallment: number;
  estimatedMonthlyContractualRatePercent: number;
  effectiveMonthlyRatePercent: number;
  effectiveAnnualCostRatePercent: number; // EYMO
  totalRepayment: number;
  totalInterestAndTax: number;
  earlyPayoffMonth: number;
  remainingPrincipalToPay: number;
  savedInterestAndTax: number;
  schedule: LoanAmortizationRow[];
}

/**
 * Banka Kredisi Fransız İtfa (Anüite), Erken Kapama Tasarrufu & EYMO Motoru
 */
export function calculateLoanAmortization(params: {
  principal: number;
  totalInstallments: number;
  monthlyContractualRatePercent?: number;
  knownMonthlyInstallment?: number;
  taxMultiplier?: number; // İhtiyaç: 1.30 (%15 KKDF + %15 BSMV), Konut: 1.00
  earlyPayoffAfterMonth?: number;
}): LoanAmortizationResult {
  const principal = Math.max(0, Number(params.principal) || 0);
  const n = Math.max(1, Math.min(360, Math.round(Number(params.totalInstallments) || 12)));
  const taxMultiplier = params.taxMultiplier ?? TR_LOAN_TAX_MULTIPLIER;

  if (principal <= 0) {
    return {
      principal: 0,
      totalInstallments: n,
      monthlyInstallment: 0,
      estimatedMonthlyContractualRatePercent: 0,
      effectiveMonthlyRatePercent: 0,
      effectiveAnnualCostRatePercent: 0,
      totalRepayment: 0,
      totalInterestAndTax: 0,
      earlyPayoffMonth: 0,
      remainingPrincipalToPay: 0,
      savedInterestAndTax: 0,
      schedule: []
    };
  }

  let effMonthlyRate = 0;
  let monthlyPayment = 0;

  if (params.monthlyContractualRatePercent !== undefined && params.monthlyContractualRatePercent >= 0) {
    effMonthlyRate = (params.monthlyContractualRatePercent / 100) * taxMultiplier;
    if (effMonthlyRate === 0) {
      monthlyPayment = principal / n;
    } else {
      const factor = Math.pow(1 + effMonthlyRate, n);
      monthlyPayment = (principal * effMonthlyRate * factor) / (factor - 1);
    }
  } else if (params.knownMonthlyInstallment && params.knownMonthlyInstallment > 0) {
    monthlyPayment = params.knownMonthlyInstallment;
    if (monthlyPayment * n <= principal + 0.01) {
      effMonthlyRate = 0;
      monthlyPayment = principal / n;
    } else {
      // Bisection ile efektif aylık faiz oranını bul
      let low = 0.0001;
      let high = 0.35;
      for (let iter = 0; iter < 50; iter++) {
        const mid = (low + high) / 2;
        const factor = Math.pow(1 + mid, n);
        const calcPmt = (principal * mid * factor) / (factor - 1);
        if (calcPmt > monthlyPayment) high = mid;
        else low = mid;
      }
      effMonthlyRate = (low + high) / 2;
    }
  } else {
    effMonthlyRate = 0.0399 * taxMultiplier;
    const factor = Math.pow(1 + effMonthlyRate, n);
    monthlyPayment = (principal * effMonthlyRate * factor) / (factor - 1);
  }

  const schedule: LoanAmortizationRow[] = [];
  let remaining = principal;
  let totalInterestAndTax = 0;

  for (let i = 1; i <= n; i++) {
    const interestAndTax = remaining * effMonthlyRate;
    const rawInterest = taxMultiplier > 0 ? interestAndTax / taxMultiplier : interestAndTax;
    const tax = interestAndTax - rawInterest;
    let principalPart = monthlyPayment - interestAndTax;
    let actualPayment = monthlyPayment;

    if (i === n || principalPart > remaining) {
      principalPart = remaining;
      actualPayment = principalPart + interestAndTax;
    }

    remaining = Math.max(0, remaining - principalPart);
    totalInterestAndTax += interestAndTax;

    schedule.push({
      installmentNo: i,
      payment: Math.round(actualPayment * 100) / 100,
      principal: Math.round(principalPart * 100) / 100,
      interest: Math.round(rawInterest * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      remainingBalance: Math.round(remaining * 100) / 100
    });
  }

  const earlyMonth = Math.max(0, Math.min(n, Math.round(params.earlyPayoffAfterMonth ?? 0)));
  const remainingPrincipalToPay =
    earlyMonth === 0 ? principal : (schedule[earlyMonth - 1]?.remainingBalance ?? 0);
  const futureInterestAndTax = schedule
    .slice(earlyMonth)
    .reduce((acc, row) => acc + row.interest + row.tax, 0);

  const effectiveAnnualCostRatePercent = (Math.pow(1 + effMonthlyRate, 12) - 1) * 100;
  const contractualMonthlyRatePercent =
    taxMultiplier > 0 ? (effMonthlyRate / taxMultiplier) * 100 : effMonthlyRate * 100;

  return {
    principal: Math.round(principal * 100) / 100,
    totalInstallments: n,
    monthlyInstallment: Math.round(monthlyPayment * 100) / 100,
    estimatedMonthlyContractualRatePercent: Math.round(contractualMonthlyRatePercent * 100) / 100,
    effectiveMonthlyRatePercent: Math.round(effMonthlyRate * 10000) / 100,
    effectiveAnnualCostRatePercent: Math.round(effectiveAnnualCostRatePercent * 100) / 100,
    totalRepayment: Math.round((principal + totalInterestAndTax) * 100) / 100,
    totalInterestAndTax: Math.round(totalInterestAndTax * 100) / 100,
    earlyPayoffMonth: earlyMonth,
    remainingPrincipalToPay: Math.round(remainingPrincipalToPay * 100) / 100,
    savedInterestAndTax: Math.round(futureInterestAndTax * 100) / 100,
    schedule
  };
}

export interface SafeDailyLimitResult {
  freeCash: number;
  remainingDaysInMonth: number;
  safeDailyLimit: number;
}

/**
 * Güvenli Günlük Harcama Limiti Hesaplayıcı
 * (Aylık Gelir - Bu Ayki Gider - Kalan Ödenmemiş Sabit Faturalar) / Ayın Kalan Günü
 */
export function calculateSafeDailySpendLimit(params: {
  monthlyIncome: number;
  monthlyExpenseSoFar: number;
  unpaidFixedBillsTotal: number;
  remainingDaysInMonth: number;
}): SafeDailyLimitResult {
  const remainingDays = Math.max(1, Math.round(params.remainingDaysInMonth || 1));
  const freeCash =
    (Number(params.monthlyIncome) || 0) -
    (Number(params.monthlyExpenseSoFar) || 0) -
    (Number(params.unpaidFixedBillsTotal) || 0);
  const safeDailyLimit = Math.max(0, Math.round(freeCash / remainingDays));

  return {
    freeCash: Math.round(freeCash * 100) / 100,
    remainingDaysInMonth: remainingDays,
    safeDailyLimit
  };
}
