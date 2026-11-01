// ✅ Timezone-safe yerel YYYY-MM ve YYYY-MM-DD
export const localYYYYMM = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export const localYYYYMMDD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

/**
 * Ay sonu taşmasını (setMonth overflow) önleyen güvenli tarih toplayıcı.
 * Örn: 31 Ocak + 1 ay -> 28 Şubat (artık yılda 29 Şubat)
 */
export function addMonthsDate(baseDate: Date, monthsToAdd: number, targetDay?: number): Date {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const day = targetDay !== undefined ? targetDay : baseDate.getDate();

  const totalMonths = month + monthsToAdd;
  const targetYear = year + Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;

  const maxDay = daysInMonth(targetYear, targetMonth);
  const clampedDay = Math.min(day, maxDay);

  return new Date(targetYear, targetMonth, clampedDay);
}

export function addMonthsSafe(baseDate: Date, monthsToAdd: number, targetDay?: number): string {
  return localYYYYMMDD(addMonthsDate(baseDate, monthsToAdd, targetDay));
}

/**
 * Fatura / Abonelik için bir sonraki ilk denk gelen vade ve tebliğ tarihlerini hesaplar.
 * Yeni tanımlanan faturalar geçmiş tarihler için asla 'gecikmede / ödenmemiş' olarak işaretlenmez.
 */
export function calculateBillSchedule(bill: any, today: Date) {
  const currYear = today.getFullYear();
  const currMonth = today.getMonth(); // 0-11
  const currDate = today.getDate();
  const todayStart = new Date(currYear, currMonth, currDate);
  const currentMonthStr = localYYYYMM(today);

  const dueDay = Number(bill.due_day) || 1;
  const billingDay = bill.billing_day ? Number(bill.billing_day) : null;
  const period = bill.period || 'monthly';
  const dueMonthParam = bill.due_month ? Number(bill.due_month) : null;

  let candDueDate: Date;
  let nextDueDate: Date;
  let isOverdue = false;
  let overdueDays = 0;

  if (period === 'yearly') {
    const targetMonth = dueMonthParam && dueMonthParam >= 1 && dueMonthParam <= 12 ? dueMonthParam - 1 : 0;
    const clampedDue = Math.min(dueDay, daysInMonth(currYear, targetMonth));
    candDueDate = new Date(currYear, targetMonth, clampedDue);

    if (candDueDate < todayStart) {
      const clampedNextDue = Math.min(dueDay, daysInMonth(currYear + 1, targetMonth));
      nextDueDate = new Date(currYear + 1, targetMonth, clampedNextDue);
    } else {
      nextDueDate = candDueDate;
    }
  } else if (period === 'quarterly') {
    const baseMonth = dueMonthParam && dueMonthParam >= 1 && dueMonthParam <= 12 ? (dueMonthParam - 1) % 3 : 0;
    const quarterMonths = [baseMonth, baseMonth + 3, baseMonth + 6, baseMonth + 9].filter(m => m < 12);
    const targetMonth = quarterMonths.find(m => {
      const d = new Date(currYear, m, Math.min(dueDay, daysInMonth(currYear, m)));
      return d >= todayStart;
    }) ?? quarterMonths[0];

    const clampedDue = Math.min(dueDay, daysInMonth(currYear, targetMonth));
    candDueDate = new Date(currYear, targetMonth, clampedDue);

    if (candDueDate < todayStart) {
      const nextQMonth = quarterMonths[0];
      const clampedNext = Math.min(dueDay, daysInMonth(currYear + 1, nextQMonth));
      nextDueDate = new Date(currYear + 1, nextQMonth, clampedNext);
    } else {
      nextDueDate = candDueDate;
    }
  } else {
    // Aylık (monthly) - varsayılan
    const clampedDue = Math.min(dueDay, daysInMonth(currYear, currMonth));
    candDueDate = new Date(currYear, currMonth, clampedDue);

    if (candDueDate < todayStart) {
      // Faturanın oluşturulma tarihi bu ayki vade gününden sonra mı?
      const createdDate = bill.created_at ? new Date(bill.created_at) : null;
      const createdStart = createdDate ? new Date(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate()) : null;
      const isCreatedAfterPastDue = createdStart ? createdStart > candDueDate : false;

      const isPaidForThisMonth = bill.last_paid_month === localYYYYMM(candDueDate);

      if (isCreatedAfterPastDue || isPaidForThisMonth) {
        // Fatura bu vadeden sonra oluşturulduğu veya zaten ödendiği için gecikmede değil;
        // Bir sonraki ayın ilk denk gelen gününe ayarlanır.
        isOverdue = false;
        nextDueDate = addMonthsDate(candDueDate, 1, dueDay);
      } else {
        // Fatura geçmişte zaten vardı ve ödenmedi -> Gecikmede!
        isOverdue = true;
        overdueDays = Math.round((todayStart.getTime() - candDueDate.getTime()) / (1000 * 60 * 60 * 24));
        nextDueDate = candDueDate;
      }
    } else {
      // Vade günü bugün veya bu ay içinde gelecekteki bir gün
      const isPaidForThisMonth = bill.last_paid_month === currentMonthStr;
      if (isPaidForThisMonth) {
        // Bu ayki vade zaten ödendiği için bir sonraki ayın ilk vadesine ayarlanır
        isOverdue = false;
        nextDueDate = addMonthsDate(candDueDate, 1, dueDay);
      } else {
        nextDueDate = candDueDate;
        isOverdue = false;
      }
    }
  }

  // Kalan gün sayısı
  const diffMs = nextDueDate.getTime() - todayStart.getTime();
  const daysLeft = isOverdue ? -overdueDays : Math.round(diffMs / (1000 * 60 * 60 * 24));

  // Tebliğ / Kesim Günü Hesabı
  let nextBillingDate: Date | null = null;
  let isBillingOpen = false;

  const nextDueMonthStr = localYYYYMM(nextDueDate);
  const isPaidThisMonth = bill.last_paid_month === currentMonthStr || (bill.last_paid_month && bill.last_paid_month >= nextDueMonthStr);
  const isDueThisMonth = isOverdue || nextDueMonthStr === currentMonthStr;

  if (billingDay) {
    if (billingDay <= dueDay) {
      // Tebliğ günü son ödeme ile aynı ayda
      const bMonth = nextDueDate.getMonth();
      const bYear = nextDueDate.getFullYear();
      nextBillingDate = new Date(bYear, bMonth, Math.min(billingDay, daysInMonth(bYear, bMonth)));
    } else {
      // Tebliğ günü son ödemeden bir önceki ayda (örn: kesim 25, son ödeme 5)
      nextBillingDate = addMonthsDate(nextDueDate, -1, billingDay);
    }

    isBillingOpen = isOverdue || nextBillingDate <= todayStart;
  } else {
    // Tebliğ günü yoksa (sabit abonelik / kira): Sadece gecikmede ise veya vadesi bu ay içindeyse ödeme açıktır
    isBillingOpen = isOverdue || isDueThisMonth;
  }

  const formattedNextDue = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(nextDueDate);
  const formattedNextBilling = nextBillingDate
    ? new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' }).format(nextBillingDate)
    : null;

  return {
    next_due_date: localYYYYMMDD(nextDueDate),
    next_billing_date: nextBillingDate ? localYYYYMMDD(nextBillingDate) : null,
    days_left: daysLeft,
    is_overdue: isOverdue,
    overdue_days: overdueDays,
    is_billing_open: isBillingOpen,
    is_paid_this_month: Boolean(isPaidThisMonth),
    is_due_this_month: Boolean(isDueThisMonth),
    formatted_next_due: formattedNextDue,
    formatted_next_billing: formattedNextBilling
  };
}

export interface CreditCardScheduleResult {
  is_overdue: boolean;
  overdue_amount: number;
  days_overdue: number;
  estimated_late_interest: number;
  next_due_date: string;
  days_until_due: number;
  current_cycle_spending: number;
  last_due_date: string;
  statement_cutoff_date: string;
  cycle_start_date: string;
  cycle_end_date: string;
}

/**
 * Kredi kartı ekstre ve vade döngüsünü doğru hesaplar.
 * - Cari açık döngüde (son kesimden sonra veya son ödemeden sonra) yapılan harcamalar asla 'gecikmede' sayılmaz.
 * - Sadece geçmiş döneme ait ödenmemiş ekstre borcu varsa gecikme ve faiz hesaplanır.
 */
export function calculateCreditCardSchedule(
  card: {
    balance: number;
    due_day?: number | null;
    cutoff_day?: number | null;
    interest_rate_late?: number | null;
    interest_rate_contractual?: number | null;
    created_at?: string | null;
    updated_at?: string | null;
  },
  cardTransactions: Array<{
    amount: number;
    transaction_date: string;
    is_installment?: number | null;
    type?: string | null;
    merchant?: string | null;
    notes?: string | null;
  }> = [],
  today: Date = new Date()
): CreditCardScheduleResult {
  const currYear = today.getFullYear();
  const currMonth = today.getMonth(); // 0-11
  const currDate = today.getDate();
  const todayStart = new Date(currYear, currMonth, currDate);
  const todayISO = localYYYYMMDD(todayStart);

  const balance = Number(card.balance) || 0;
  const dueDay = card.due_day ? Number(card.due_day) : null;
  // Kesim günü belirtilmemişse: Son ödeme gününden 10 gün önce (veya ayın 25'i)
  const cutoffDay = card.cutoff_day ? Number(card.cutoff_day) : (dueDay && dueDay > 10 ? dueDay - 10 : 25);

  const defaultResult: CreditCardScheduleResult = {
    is_overdue: false,
    overdue_amount: 0,
    days_overdue: 0,
    estimated_late_interest: 0,
    next_due_date: localYYYYMMDD(todayStart),
    days_until_due: 0,
    current_cycle_spending: 0,
    last_due_date: localYYYYMMDD(todayStart),
    statement_cutoff_date: localYYYYMMDD(todayStart),
    cycle_start_date: localYYYYMMDD(todayStart),
    cycle_end_date: localYYYYMMDD(todayStart)
  };

  if (balance <= 0 || !dueDay) {
    if (dueDay) {
      let candDue = new Date(currYear, currMonth, Math.min(dueDay, daysInMonth(currYear, currMonth)));
      if (candDue < todayStart) {
        candDue = addMonthsDate(candDue, 1, dueDay);
      }
      defaultResult.next_due_date = localYYYYMMDD(candDue);
      defaultResult.days_until_due = Math.round((candDue.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
    }
    return defaultResult;
  }

  // 1. Kesim ve Vade Tarihlerini Matematiksel Olarak Belirle
  const thisMonthCutoff = new Date(currYear, currMonth, Math.min(cutoffDay, daysInMonth(currYear, currMonth)));

  let closedCutoff: Date;
  let activeCutoff: Date;

  if (todayStart > thisMonthCutoff) {
    // Bu ayki kesim günü geçmiş: En son kesilen ekstre bu ayın kesimidir.
    closedCutoff = thisMonthCutoff;
    activeCutoff = addMonthsDate(thisMonthCutoff, 1, cutoffDay);
  } else {
    // Bu ayki kesim henüz gelmedi: En son kesilen ekstre önceki ayın kesimidir.
    closedCutoff = addMonthsDate(thisMonthCutoff, -1, cutoffDay);
    activeCutoff = thisMonthCutoff;
  }

  // Cari açık dönemin başlangıcı: En son kesim gününün ertesi günü
  const activeCycleStart = new Date(closedCutoff.getFullYear(), closedCutoff.getMonth(), closedCutoff.getDate() + 1);

  // Kapalı filtrenin son ödeme günü (closedDueDate)
  const closedDueDate = dueDay > cutoffDay
    ? new Date(closedCutoff.getFullYear(), closedCutoff.getMonth(), Math.min(dueDay, daysInMonth(closedCutoff.getFullYear(), closedCutoff.getMonth())))
    : addMonthsDate(closedCutoff, 1, dueDay);

  // Aktif (açık) döngünün son ödeme günü (activeDueDate)
  const activeDueDate = dueDay > cutoffDay
    ? new Date(activeCutoff.getFullYear(), activeCutoff.getMonth(), Math.min(dueDay, daysInMonth(activeCutoff.getFullYear(), activeCutoff.getMonth())))
    : addMonthsDate(activeCutoff, 1, dueDay);

  // Kapalı filtreden bir önceki dönemin son ödeme günü
  const prevClosedCutoff = addMonthsDate(closedCutoff, -1, cutoffDay);
  const prevClosedDueDate = dueDay > cutoffDay
    ? new Date(prevClosedCutoff.getFullYear(), prevClosedCutoff.getMonth(), Math.min(dueDay, daysInMonth(prevClosedCutoff.getFullYear(), prevClosedCutoff.getMonth())))
    : addMonthsDate(prevClosedCutoff, 1, dueDay);

  // Kapalı ekstrenin son ödeme günü geçmiş mi?
  const hasDueDatePassed = todayStart > closedDueDate;

  const nextDueDate = hasDueDatePassed ? activeDueDate : closedDueDate;
  const lastDueDate = hasDueDatePassed ? closedDueDate : prevClosedDueDate;

  const cycleStartISO = localYYYYMMDD(activeCycleStart);
  const cycleEndISO = localYYYYMMDD(activeCutoff);

  // 2. Harcamaları Analiz Et
  let currentCycleSpending = 0;
  let futureInstallments = 0;

  for (const tx of cardTransactions) {
    // Ödeme, virman ve gelir işlemlerini dönem içi harcama sayma
    const isPaymentOrIncome = 
      tx.type === 'income' || 
      tx.merchant?.includes('Kart Ödemesi') || 
      tx.merchant?.includes('Mutabakat') ||
      tx.merchant?.includes('Transfer');

    if (tx.is_installment === 1 && tx.transaction_date > todayISO) {
      futureInstallments += Number(tx.amount) || 0;
    } else if (tx.transaction_date >= cycleStartISO && !isPaymentOrIncome) {
      currentCycleSpending += Number(tx.amount) || 0;
    }
  }

  // İşlem kaydı bulunmayan kartlarda hesap güncelleme/oluşturma tarihini kontrol et
  if (cardTransactions.length === 0) {
    const updatedDate = card.updated_at ? new Date(card.updated_at) : (card.created_at ? new Date(card.created_at) : null);
    if (updatedDate && updatedDate >= lastDueDate) {
      // Son ödeme tarihinden sonra oluşturulmuş/güncellenmiş bakiye cari döngüdedir, gecikmede değildir
      currentCycleSpending = balance;
    }
  }

  // Gelecek ayların taksitleri cari borçtan düşülür
  const effectiveDebt = Math.max(0, balance - futureInstallments);

  // Cari döngüde yapılan harcamalar düşüldükten sonra kalan tutar (geçmiş dönemin ödenmemiş ekstre borcu)
  const overdueCandidate = Math.max(0, Math.round((effectiveDebt - currentCycleSpending) * 100) / 100);

  // Kart henüz son ödeme gününü geçtiyse ve geçmiş ekstre borcu kaldıysa gecikmededir
  const isOverdue = hasDueDatePassed && overdueCandidate > 0;

  const daysOverdue = isOverdue
    ? Math.max(1, Math.round((todayStart.getTime() - closedDueDate.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const lateRatePercent = card.interest_rate_late || 4.55;
  const dailyRate = (lateRatePercent / 100) / 30;
  const estimatedLateInterest = isOverdue
    ? Math.round(overdueCandidate * dailyRate * daysOverdue * 100) / 100
    : 0;

  const daysUntilDue = Math.round((nextDueDate.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));

  return {
    is_overdue: isOverdue,
    overdue_amount: isOverdue ? overdueCandidate : 0,
    days_overdue: daysOverdue,
    estimated_late_interest: estimatedLateInterest,
    next_due_date: localYYYYMMDD(nextDueDate),
    days_until_due: daysUntilDue,
    current_cycle_spending: Math.round(currentCycleSpending * 100) / 100,
    last_due_date: localYYYYMMDD(lastDueDate),
    statement_cutoff_date: localYYYYMMDD(closedCutoff),
    cycle_start_date: cycleStartISO,
    cycle_end_date: cycleEndISO
  };
}
