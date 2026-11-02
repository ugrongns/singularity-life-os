// Singularity Life OS - Finansal Harcama Davranışları & No-Spend Analitiği (Faz 3)

export interface RawTransactionHabit {
  id: string;
  amount: number;
  transaction_date: string; // YYYY-MM-DD
  merchant?: string | null;
  notes?: string | null;
  is_installment?: number | null;
  installment_number?: number | null;
  total_installments?: number | null;
  category_id?: string | null;
  category_type?: string | null; // 'expense' | 'income'
  category_name?: string | null;
  user_id?: string | null;
}

export interface DayOfWeekSpending {
  dayIndex: number; // 0: Pazar, 1: Pazartesi, ..., 6: Cumartesi
  name: string; // 'Pzt', 'Sal', vb.
  amount: number;
  percent: number;
}

export interface MonthlySavingsRate {
  month: string; // YYYY-MM
  monthLabel: string; // örn. 'Ekim 2026'
  income: number;
  expense: number;
  savings: number;
  savingsRate: number; // %
}

export interface PeakPeriodMetric {
  periodName: string; // '1-10 Ay Başı', '11-20 Ay Ortası', '21-31 Ay Sonu'
  amount: number;
  percent: number;
  peakDay: number; // En çok harcanan gün (1-31)
  peakDayAmount: number;
  isImpulsiveSalarySpike: boolean;
}

export interface SpendingHabitsSummary {
  noSpendDaysThisMonth: number;
  daysPassedInMonth: number;
  totalDaysInMonth: number;
  noSpendTarget: number; // 8 gün
  targetAchieved: boolean;
  noSpendDates: string[]; // YYYY-MM-DD
  weekdayExpense: number;
  weekendExpense: number;
  weekdayPercent: number; // %
  weekendPercent: number; // %
  dayOfWeekDistribution: DayOfWeekSpending[];
  savingsRateTrend: MonthlySavingsRate[];
  currentSavingsRate: number; // %
  peakPeriods: PeakPeriodMetric;
  totalExpense90Days: number;
  totalIncome90Days: number;
}

/**
 * Bir işlemin gelir işlemi olup olmadığını belirler.
 */
export function isIncomeTransaction(tx: RawTransactionHabit): boolean {
  if (tx.category_type === 'income') return true;
  const m = (tx.merchant ?? '').toLowerCase();
  const n = (tx.notes ?? '').toLowerCase();
  return (
    m.includes('maaş') ||
    m.includes('gelir') ||
    m.includes('kira geliri') ||
    m.includes('temettü') ||
    n.includes('maaş') ||
    n.includes('gelir')
  );
}

/**
 * Bir işlemin hesaplar arası transfer veya kart borcu ödemesi olup olmadığını belirler.
 */
export function isTransferTransaction(tx: RawTransactionHabit): boolean {
  const m = (tx.merchant ?? '').toLowerCase();
  const n = (tx.notes ?? '').toLowerCase();
  return (
    m.startsWith('💳 kart ödemesi') ||
    m.startsWith('🔄 transfer') ||
    m.includes('vadeli mevduat') ||
    m.includes('kart borç ödemesi') ||
    n.includes('transfer') ||
    n.includes('borç ödemesi')
  );
}

/**
 * 90 günlük hareketleri analiz ederek harcama kalıplarını ve no-spend günlerini hesaplar.
 */
export function calculateSpendingHabits(
  transactions: RawTransactionHabit[],
  referenceDate: Date = new Date()
): SpendingHabitsSummary {
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth(); // 0-11
  const refDay = referenceDate.getDate();

  // Cari ayın gün sayısı
  const totalDaysInMonth = new Date(refYear, refMonth + 1, 0).getDate();
  const daysPassedInMonth = Math.min(refDay, totalDaysInMonth);

  // Cari ay kodu YYYY-MM
  const currentMonthStr = `${refYear}-${String(refMonth + 1).padStart(2, '0')}`;

  // 1. İşlemleri Süz (Gelir ve Transferleri Ayrıştır)
  const validExpenses: RawTransactionHabit[] = [];
  const validIncomes: RawTransactionHabit[] = [];

  for (const tx of transactions) {
    if (isTransferTransaction(tx)) {
      continue;
    }
    if (isIncomeTransaction(tx)) {
      validIncomes.push(tx);
    } else {
      validExpenses.push(tx);
    }
  }

  // 2. Gün Bazında Giderleri Haritalandır (Cari Ay)
  const dailyExpensesMap = new Map<string, number>();
  for (const exp of validExpenses) {
    const dStr = exp.transaction_date?.slice(0, 10);
    if (!dStr) continue;
    const cur = dailyExpensesMap.get(dStr) ?? 0;
    dailyExpensesMap.set(dStr, cur + (exp.amount ?? 0));
  }

  // No-Spend Günleri Tespiti (Cari ayın bugüne kadar olan günleri içinde 0 TL harcananlar)
  const noSpendDates: string[] = [];
  for (let day = 1; day <= daysPassedInMonth; day++) {
    const dStr = `${currentMonthStr}-${String(day).padStart(2, '0')}`;
    const daySpent = dailyExpensesMap.get(dStr) ?? 0;
    if (daySpent <= 0) {
      noSpendDates.push(dStr);
    }
  }

  const noSpendDaysThisMonth = noSpendDates.length;
  const noSpendTarget = 8;
  const targetAchieved = noSpendDaysThisMonth >= noSpendTarget;

  // 3. Haftanın Günleri Dağılımı (Son 90 Günün Harcamaları)
  // JS getDay(): 0 = Pazar, 1 = Pazartesi, ..., 6 = Cumartesi
  const dayNamesOrder = [
    { idx: 1, name: 'Pzt' },
    { idx: 2, name: 'Sal' },
    { idx: 3, name: 'Çar' },
    { idx: 4, name: 'Per' },
    { idx: 5, name: 'Cum' },
    { idx: 6, name: 'Cmt' },
    { idx: 0, name: 'Paz' }
  ];

  const dayTotals = new Map<number, number>();
  let weekdayExpense = 0;
  let weekendExpense = 0;

  for (const exp of validExpenses) {
    const parts = exp.transaction_date?.slice(0, 10).split('-');
    if (!parts || parts.length < 3) continue;
    const dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const dayIdx = dateObj.getDay();

    const amt = exp.amount ?? 0;
    dayTotals.set(dayIdx, (dayTotals.get(dayIdx) ?? 0) + amt);

    if (dayIdx === 0 || dayIdx === 6) {
      weekendExpense += amt;
    } else {
      weekdayExpense += amt;
    }
  }

  const totalExpense90Days = Math.round((weekdayExpense + weekendExpense) * 100) / 100;
  const totalIncome90Days = Math.round(validIncomes.reduce((s, i) => s + (i.amount ?? 0), 0) * 100) / 100;

  let weekdayPercent = 0;
  let weekendPercent = 0;

  if (totalExpense90Days > 0) {
    weekdayPercent = Math.round((weekdayExpense / totalExpense90Days) * 100);
    weekendPercent = 100 - weekdayPercent; // Toplamın kesin %100 olması garantisi
  }

  const dayOfWeekDistribution: DayOfWeekSpending[] = dayNamesOrder.map(d => {
    const amt = Math.round((dayTotals.get(d.idx) ?? 0) * 100) / 100;
    const pct = totalExpense90Days > 0 ? Math.round((amt / totalExpense90Days) * 100) : 0;
    return {
      dayIndex: d.idx,
      name: d.name,
      amount: amt,
      percent: pct
    };
  });

  // 4. Tasarruf Oranı Eğrisi (Son 3 Ay)
  // Ay isimleri
  const monthLabels = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const savingsRateTrend: MonthlySavingsRate[] = [];

  for (let mOffset = 2; mOffset >= 0; mOffset--) {
    const targetDate = new Date(refYear, refMonth - mOffset, 1);
    const mStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
    const mLabel = `${monthLabels[targetDate.getMonth()]} ${targetDate.getFullYear()}`;

    const monthIncomes = validIncomes.filter(tx => tx.transaction_date?.startsWith(mStr));
    const monthExpenses = validExpenses.filter(tx => tx.transaction_date?.startsWith(mStr));

    const inc = Math.round(monthIncomes.reduce((sum, tx) => sum + (tx.amount ?? 0), 0));
    const exp = Math.round(monthExpenses.reduce((sum, tx) => sum + (tx.amount ?? 0), 0));
    const sav = inc - exp;

    let rate = 0;
    if (inc > 0) {
      rate = Math.round(((inc - exp) / inc) * 100);
    } else if (exp === 0) {
      rate = 0;
    } else {
      rate = -100; // Gelir yokken gider varsa tasarruf negatiftir
    }

    savingsRateTrend.push({
      month: mStr,
      monthLabel: mLabel,
      income: inc,
      expense: exp,
      savings: sav,
      savingsRate: rate
    });
  }

  const currentSavingsRate = savingsRateTrend.length > 0
    ? savingsRateTrend[savingsRateTrend.length - 1].savingsRate
    : 0;

  // 5. En Yüksek Harcama Dilimi (Ay Başı 1-10 vs Ay Ortası 11-20 vs Ay Sonu 21-31)
  let p1Sum = 0; // 1-10
  let p2Sum = 0; // 11-20
  let p3Sum = 0; // 21-31
  const daysInCurrentMonthExpenses = new Map<number, number>();

  for (const exp of validExpenses) {
    if (!exp.transaction_date?.startsWith(currentMonthStr)) continue;
    const day = parseInt(exp.transaction_date.slice(8, 10), 10);
    const amt = exp.amount ?? 0;
    if (day >= 1 && day <= 10) p1Sum += amt;
    else if (day >= 11 && day <= 20) p2Sum += amt;
    else if (day >= 21) p3Sum += amt;

    daysInCurrentMonthExpenses.set(day, (daysInCurrentMonthExpenses.get(day) ?? 0) + amt);
  }

  const totalCurMonthExpense = p1Sum + p2Sum + p3Sum;
  let peakDay = 1;
  let peakDayAmount = 0;

  for (const [day, amt] of daysInCurrentMonthExpenses.entries()) {
    if (amt > peakDayAmount) {
      peakDayAmount = amt;
      peakDay = day;
    }
  }

  const isImpulsiveSalarySpike = totalCurMonthExpense > 0 && (p1Sum / totalCurMonthExpense) >= 0.50;

  let periodName = '1-10 Ay Başı (Maaş Sonrası)';
  let peakPeriodAmount = p1Sum;
  if (p2Sum > p1Sum && p2Sum >= p3Sum) {
    periodName = '11-20 Ay Ortası';
    peakPeriodAmount = p2Sum;
  } else if (p3Sum > p1Sum && p3Sum > p2Sum) {
    periodName = '21-31 Ay Sonu';
    peakPeriodAmount = p3Sum;
  }

  const peakPeriods: PeakPeriodMetric = {
    periodName,
    amount: Math.round(peakPeriodAmount),
    percent: totalCurMonthExpense > 0 ? Math.round((peakPeriodAmount / totalCurMonthExpense) * 100) : 0,
    peakDay,
    peakDayAmount: Math.round(peakDayAmount),
    isImpulsiveSalarySpike
  };

  return {
    noSpendDaysThisMonth,
    daysPassedInMonth,
    totalDaysInMonth,
    noSpendTarget,
    targetAchieved,
    noSpendDates,
    weekdayExpense: Math.round(weekdayExpense * 100) / 100,
    weekendExpense: Math.round(weekendExpense * 100) / 100,
    weekdayPercent,
    weekendPercent,
    dayOfWeekDistribution,
    savingsRateTrend,
    currentSavingsRate,
    peakPeriods,
    totalExpense90Days,
    totalIncome90Days
  };
}
