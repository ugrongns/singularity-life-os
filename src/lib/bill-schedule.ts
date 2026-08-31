// ✅ Timezone-safe yerel YYYY-MM ve YYYY-MM-DD
export const localYYYYMM = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export const localYYYYMMDD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

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
      candDueDate = new Date(currYear + 1, nextQMonth, Math.min(dueDay, daysInMonth(currYear + 1, nextQMonth)));
      nextDueDate = candDueDate;
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
        const nextMonth = currMonth + 1;
        const nextYear = nextMonth > 11 ? currYear + 1 : currYear;
        const nextMonthNorm = nextMonth % 12;
        nextDueDate = new Date(nextYear, nextMonthNorm, Math.min(dueDay, daysInMonth(nextYear, nextMonthNorm)));
      } else {
        // Fatura geçmişte zaten vardı ve ödenmedi -> Gecikmede!
        isOverdue = true;
        overdueDays = Math.round((todayStart.getTime() - candDueDate.getTime()) / (1000 * 60 * 60 * 24));
        nextDueDate = candDueDate;
      }
    } else {
      nextDueDate = candDueDate;
      isOverdue = false;
    }
  }

  // Kalan gün sayısı
  const diffMs = nextDueDate.getTime() - todayStart.getTime();
  const daysLeft = isOverdue ? -overdueDays : Math.round(diffMs / (1000 * 60 * 60 * 24));

  // Tebliğ / Kesim Günü Hesabı
  let nextBillingDate: Date | null = null;
  let isBillingOpen = true;

  if (billingDay) {
    if (billingDay <= dueDay) {
      // Tebliğ günü son ödeme ile aynı ayda
      const bMonth = nextDueDate.getMonth();
      const bYear = nextDueDate.getFullYear();
      nextBillingDate = new Date(bYear, bMonth, Math.min(billingDay, daysInMonth(bYear, bMonth)));
    } else {
      // Tebliğ günü son ödemeden bir önceki ayda (örn: kesim 25, son ödeme 5)
      const prevM = nextDueDate.getMonth() - 1;
      const prevY = prevM < 0 ? nextDueDate.getFullYear() - 1 : nextDueDate.getFullYear();
      const prevMNorm = (prevM + 12) % 12;
      nextBillingDate = new Date(prevY, prevMNorm, Math.min(billingDay, daysInMonth(prevY, prevMNorm)));
    }

    isBillingOpen = isOverdue || nextBillingDate <= todayStart;
  }

  const nextDueMonthStr = localYYYYMM(nextDueDate);
  const isPaidThisMonth = bill.last_paid_month === currentMonthStr || (bill.last_paid_month && bill.last_paid_month >= nextDueMonthStr);
  const isDueThisMonth = isOverdue || nextDueMonthStr === currentMonthStr;

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
