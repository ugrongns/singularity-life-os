// Singularity Life OS - Bütünsel Yaşam Takvimi & Isı Haritası Motoru (Faz 4)
import { isIncomeTransaction, isTransferTransaction } from '@/lib/financial-habits';
import { calculateSessionWpm } from '@/lib/reading-analytics';
import { getTodayTurkeyDate, shiftTurkeyDate, parseTurkeyDate } from '@/lib/date-utils';
import { toTurkeyDay } from '@/lib/tasks-engine';

export interface RawHeatmapData {
  fastingSessions: Array<{
    start_time: string;
    actual_end_time?: string | null;
    is_active: number | boolean;
    notes?: string | null;
  }>;
  readingSessions: Array<{
    pages_read: number;
    duration_minutes: number;
    session_date: string;
    words_per_page?: number | null;
  }>;
  transactions: Array<{
    amount: number;
    transaction_date: string;
    merchant?: string | null;
    notes?: string | null;
    category_type?: string | null;
  }>;
  waterLogs: Array<{
    date: string;
    amount_ml: number;
  }>;
  completedTasks?: Array<{
    completed_at?: string | null;
    is_mit?: number | null;
  }>;
}

export interface DayHeatmapCell {
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 0 = Pazar, 1 = Pzt, ..., 6 = Cmt
  dayLabel: string; // "14 Eki"
  fastingHours: number;
  autophagyHours: number;
  reachedAutophagy: boolean;
  pagesRead: number;
  avgWpm: number;
  spentAmount: number;
  isNoSpend: boolean;
  waterMl: number;
  habitsMetCount: number; // 0..4
  dominantLevel: number; // 0 (boş), 1 (hafif), 2 (orta), 3 (mükemmel)
  completedTasksCount: number;
  completedMitsCount: number;
}

export interface HeatmapSummary {
  days: DayHeatmapCell[];
  totalDays: number;
  totalActiveDays: number; // dominantLevel > 0
  perfectDaysCount: number; // dominantLevel === 3
  totalFastingHours: number;
  totalAutophagyHours: number;
  totalPagesRead: number;
  totalNoSpendDays: number;
  totalCompletedTasks: number;
  totalCompletedMits: number;
}

/**
 * Günlük hücre verilerini ve 0..3 dominant level skorunu hesaplar.
 */
export function calculateHeatmapMatrix(
  data: RawHeatmapData,
  totalDays: number = 365,
  referenceDate: Date = new Date()
): HeatmapSummary {
  const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

  // 1. Oruç seanslarını gün bazında indeksle
  const fastingByDate = new Map<string, { totalHours: number; autophagyHours: number }>();
  for (const f of data.fastingSessions || []) {
    if (f.is_active === 1 || f.is_active === true || !f.actual_end_time) continue;
    if (f.notes && f.notes.toLowerCase().includes('cancel')) continue;

    const sMs = new Date(f.start_time).getTime();
    const eMs = new Date(f.actual_end_time).getTime();
    if (isNaN(sMs) || isNaN(eMs) || eMs <= sMs) continue;

    const rawHours = (eMs - sMs) / (1000 * 3600);
    if (rawHours < 0.16) continue;

    const dStr = toTurkeyDay(f.actual_end_time) ?? f.actual_end_time.slice(0, 10);
    const existing = fastingByDate.get(dStr) || { totalHours: 0, autophagyHours: 0 };
    const durH = Math.round(rawHours * 10) / 10;
    const autoH = durH >= 16 ? Math.round((durH - 16) * 10) / 10 : 0;

    existing.totalHours += durH;
    existing.autophagyHours += autoH;
    fastingByDate.set(dStr, existing);
  }

  // 2. Okuma seanslarını gün bazında indeksle
  const readingByDate = new Map<string, { pages: number; minutes: number; totalWpm: number; count: number }>();
  for (const r of data.readingSessions || []) {
    const dStr = r.session_date?.slice(0, 10);
    if (!dStr) continue;

    const wpm = calculateSessionWpm(r.pages_read, r.duration_minutes, r.words_per_page ?? 250);
    const existing = readingByDate.get(dStr) || { pages: 0, minutes: 0, totalWpm: 0, count: 0 };
    existing.pages += (r.pages_read ?? 0);
    existing.minutes += (r.duration_minutes ?? 0);
    existing.totalWpm += wpm;
    existing.count += 1;
    readingByDate.set(dStr, existing);
  }

  // 3. Harcama işlemlerini gün bazında indeksle (Gelir ve transferler hariç)
  const spendingByDate = new Map<string, number>();
  for (const tx of data.transactions || []) {
    if (isTransferTransaction(tx as any) || isIncomeTransaction(tx as any)) continue;
    const dStr = tx.transaction_date?.slice(0, 10);
    if (!dStr) continue;

    const cur = spendingByDate.get(dStr) ?? 0;
    spendingByDate.set(dStr, cur + (tx.amount ?? 0));
  }

  // 4. Su kayıtlarını gün bazında indeksle
  const waterByDate = new Map<string, number>();
  for (const w of data.waterLogs || []) {
    const dStr = w.date?.slice(0, 10);
    if (!dStr) continue;
    const cur = waterByDate.get(dStr) ?? 0;
    waterByDate.set(dStr, cur + (w.amount_ml ?? 0));
  }

  // 4.1 Tamamlanan Görevleri ve MIT'leri Türkiye takvim günü bazında indeksle
  const tasksByDate = new Map<string, { tasks: number; mits: number }>();
  for (const t of data.completedTasks || []) {
    const dStr = toTurkeyDay(t.completed_at) ?? t.completed_at?.slice(0, 10);
    if (!dStr) continue;
    const existing = tasksByDate.get(dStr) || { tasks: 0, mits: 0 };
    existing.tasks += 1;
    if (Number(t.is_mit) === 1) existing.mits += 1;
    tasksByDate.set(dStr, existing);
  }

  // 5. Gün gün matris üretimi (Europe/Istanbul takvim günü bazlı)
  const cells: DayHeatmapCell[] = [];
  let totalFastingHours = 0;
  let totalAutophagyHours = 0;
  let totalPagesRead = 0;
  let totalNoSpendDays = 0;
  let totalActiveDays = 0;
  let perfectDaysCount = 0;
  let totalCompletedTasks = 0;
  let totalCompletedMits = 0;
  const todayTr = getTodayTurkeyDate(referenceDate);

  for (let i = totalDays - 1; i >= 0; i--) {
    const dateStr = shiftTurkeyDate(todayTr, -i);
    const parsedDay = parseTurkeyDate(dateStr);
    const dayOfWeek = parsedDay.getUTCDay();
    const dayLabel = `${parsedDay.getUTCDate()} ${monthNames[parsedDay.getUTCMonth()]}`;

    const fast = fastingByDate.get(dateStr) || { totalHours: 0, autophagyHours: 0 };
    const read = readingByDate.get(dateStr) || { pages: 0, minutes: 0, totalWpm: 0, count: 0 };
    const spent = Math.round((spendingByDate.get(dateStr) ?? 0) * 100) / 100;
    const isNoSpend = spent === 0;
    const water = waterByDate.get(dateStr) ?? 0;
    const taskInfo = tasksByDate.get(dateStr) || { tasks: 0, mits: 0 };

    const fastingH = Math.round(fast.totalHours * 10) / 10;
    const autophagyH = Math.round(fast.autophagyHours * 10) / 10;
    const avgWpm = read.count > 0 ? Math.round(read.totalWpm / read.count) : 0;

    // 4'lü Alışkanlık Skorlaması:
    // 1. Oruç Tutuldu mu? (>= 14 saat)
    const habitFasting = fastingH >= 14 ? 1 : 0;
    // 2. Okuma Yapıldı mı? (>= 10 sayfa)
    const habitReading = read.pages >= 10 ? 1 : 0;
    // 3. Harcamasız Gün veya Düşük Bütçede Kalındı mı? (isNoSpend veya spent <= 250 TL)
    const habitFinance = (isNoSpend || spent <= 250) ? 1 : 0;
    // 4. Su Tüketimi / Sağlık Dengesi Tutuldu mu? (>= 1500 ml)
    const habitWater = water >= 1500 ? 1 : 0;

    const habitsMetCount = habitFasting + habitReading + habitFinance + habitWater;

    // Dominant Level (0: boş, 1: hafif, 2: orta, 3: mükemmel gün)
    let dominantLevel = 0;
    if (habitsMetCount >= 3) {
      dominantLevel = 3;
    } else if (habitsMetCount === 2) {
      dominantLevel = 2;
    } else if (habitsMetCount === 1) {
      dominantLevel = 1;
    }

    if (dominantLevel > 0) totalActiveDays++;
    if (dominantLevel === 3) perfectDaysCount++;
    if (isNoSpend) totalNoSpendDays++;

    totalFastingHours += fastingH;
    totalAutophagyHours += autophagyH;
    totalPagesRead += read.pages;
    totalCompletedTasks += taskInfo.tasks;
    totalCompletedMits += taskInfo.mits;

    cells.push({
      date: dateStr,
      dayOfWeek,
      dayLabel,
      fastingHours: fastingH,
      autophagyHours: autophagyH,
      reachedAutophagy: fastingH >= 16,
      pagesRead: read.pages,
      avgWpm,
      spentAmount: spent,
      isNoSpend,
      waterMl: water,
      habitsMetCount,
      dominantLevel,
      completedTasksCount: taskInfo.tasks,
      completedMitsCount: taskInfo.mits
    });
  }

  return {
    days: cells,
    totalDays,
    totalActiveDays,
    perfectDaysCount,
    totalFastingHours: Math.round(totalFastingHours * 10) / 10,
    totalAutophagyHours: Math.round(totalAutophagyHours * 10) / 10,
    totalPagesRead,
    totalNoSpendDays,
    totalCompletedTasks,
    totalCompletedMits
  };
}
