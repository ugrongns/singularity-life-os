// Singularity Life OS — Esnek Alışkanlık & Rutin Motoru (Habit OS)
import { getTodayTurkeyDate, shiftTurkeyDate, parseTurkeyDate } from './date-utils';

export type HabitTargetType = 'boolean' | 'numeric' | 'timer';
export type HabitFrequencyType = 'daily' | 'specific_days' | 'flexible_weekly';
export type HabitTimeOfDay = 'morning' | 'afternoon' | 'evening' | 'all_day';
export type HabitLinkedModule = 'reading' | 'workout' | 'water' | null;

export interface HabitItem {
  id: string;
  user_id: string;
  family_id?: string | null;
  title: string;
  description?: string | null;
  category: string;
  color: string;
  icon: string;
  target_type: HabitTargetType | string;
  target_value: number;
  unit_label: string;
  frequency_type: HabitFrequencyType | string;
  frequency_days_json?: string | null;
  weekly_target_count: number;
  time_of_day: HabitTimeOfDay | string;
  linked_module?: string | null;
  is_archived: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface HabitLogItem {
  id: string;
  habit_id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  value: number;
  is_completed: number;
  note?: string | null;
}

export interface HabitMatrixCell {
  date: string;
  completed: boolean;
  value: number;
  scheduled: boolean;
}

export interface HabitStats {
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  weeklyCompletedCount: number;
  weeklyTargetCount: number;
  weeklyQuotaSatisfied: boolean;
  consistency30dPercent: number;
  last14Days: HabitMatrixCell[];
  last112Days: HabitMatrixCell[];
}

export interface HabitBadge {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
}

export function parseFrequencyDays(jsonStr?: string | null): number[] {
  if (!jsonStr) return [];
  try {
    const arr = JSON.parse(jsonStr);
    if (!Array.isArray(arr)) return [];
    return arr.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6);
  } catch {
    return [];
  }
}

/**
 * Verilen YYYY-MM-DD tarihinin Pazartesi-Pazar hafta başlangıcını (Pazartesi YYYY-MM-DD) döndürür.
 */
export function getTurkeyWeekStartMonday(dateStr: string): string {
  const dt = parseTurkeyDate(dateStr);
  const dow = dt.getUTCDay(); // 0=Paz, 1=Pzt ... 6=Cmt
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  return shiftTurkeyDate(dateStr, diffToMonday);
}

/**
 * Belirli bir günde bu alışkanlığın planlı olup olmadığını belirler.
 */
export function isHabitScheduledOnDate(habit: HabitItem, dateStr: string): boolean {
  if (habit.frequency_type === 'specific_days') {
    const days = parseFrequencyDays(habit.frequency_days_json);
    if (days.length === 0) return true;
    const dow = parseTurkeyDate(dateStr).getUTCDay(); // 0=Paz..6=Cmt
    return days.includes(dow);
  }
  return true;
}

/**
 * Tek bir alışkanlık için seri, esnek haftalık kota, 30 günlük tutarlılık ve 14g/112g matrisini hesaplar.
 */
export function computeHabitStats(
  habit: HabitItem,
  logs: HabitLogItem[],
  todayTr: string = getTodayTurkeyDate()
): HabitStats {
  const habitLogs = logs.filter(l => l.habit_id === habit.id);
  const logByDate = new Map<string, HabitLogItem>();
  for (const l of habitLogs) {
    logByDate.set(l.date, l);
  }

  const weekStart = getTurkeyWeekStartMonday(todayTr);
  let weeklyCompletedCount = 0;
  for (let i = 0; i < 7; i++) {
    const d = shiftTurkeyDate(weekStart, i);
    if (d > todayTr) break;
    const log = logByDate.get(d);
    if (log && log.is_completed === 1) weeklyCompletedCount++;
  }

  const weeklyTarget =
    habit.frequency_type === 'flexible_weekly'
      ? Math.max(1, Math.min(7, habit.weekly_target_count || 3))
      : habit.frequency_type === 'specific_days'
        ? Math.max(1, parseFrequencyDays(habit.frequency_days_json).length || 3)
        : 7;

  const weeklyQuotaSatisfied = weeklyCompletedCount >= weeklyTarget;

  // 112 günlük (16 hafta) matris ve tutarlılık
  const last112Days: HabitMatrixCell[] = [];
  for (let i = 111; i >= 0; i--) {
    const d = shiftTurkeyDate(todayTr, -i);
    const log = logByDate.get(d);
    last112Days.push({
      date: d,
      completed: Boolean(log && log.is_completed === 1),
      value: log ? log.value : 0,
      scheduled: isHabitScheduledOnDate(habit, d)
    });
  }
  const last14Days = last112Days.slice(-14);

  // Son 30 gün tutarlılık yüzdesi (esnek haftalık hedeflerde haftalık kotaya göre cezasız)
  let consistency30dPercent = 0;
  if (habit.frequency_type === 'flexible_weekly') {
    const weeksMap = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = shiftTurkeyDate(todayTr, -i);
      const ws = getTurkeyWeekStartMonday(d);
      const log = logByDate.get(d);
      weeksMap.set(ws, (weeksMap.get(ws) || 0) + (log && log.is_completed === 1 ? 1 : 0));
    }
    const weekRatios = Array.from(weeksMap.values()).map(cnt => Math.min(1, cnt / weeklyTarget));
    consistency30dPercent =
      weekRatios.length > 0
        ? Math.round((weekRatios.reduce((a, b) => a + b, 0) / weekRatios.length) * 100)
        : 0;
  } else {
    let scheduledDays = 0;
    let doneDays = 0;
    for (let i = 29; i >= 0; i--) {
      const d = shiftTurkeyDate(todayTr, -i);
      if (isHabitScheduledOnDate(habit, d)) {
        scheduledDays++;
        const log = logByDate.get(d);
        if (log && log.is_completed === 1) doneDays++;
      }
    }
    consistency30dPercent = scheduledDays > 0 ? Math.min(100, Math.round((doneDays / scheduledDays) * 100)) : 0;
  }

  // Seri (Streak) Hesabı
  let currentStreak = 0;
  if (habit.frequency_type === 'flexible_weekly') {
    // Haftalık kota dolduysa ardışık başarılı haftalardaki toplam gün veya aktif hafta korunur
    let cursorWeek = weekStart;
    if (weeklyQuotaSatisfied) {
      currentStreak += weeklyCompletedCount;
      cursorWeek = shiftTurkeyDate(weekStart, -7);
    } else {
      // Bu hafta henüz bitmediyse önceki haftalardan gelen seriyi koru ve bu haftanın günlerini ekle
      currentStreak += weeklyCompletedCount;
      cursorWeek = shiftTurkeyDate(weekStart, -7);
    }
    for (let w = 0; w < 20; w++) {
      let wDone = 0;
      for (let d = 0; d < 7; d++) {
        const dayStr = shiftTurkeyDate(cursorWeek, d);
        if (logByDate.get(dayStr)?.is_completed === 1) wDone++;
      }
      if (wDone >= weeklyTarget) {
        currentStreak += wDone;
        cursorWeek = shiftTurkeyDate(cursorWeek, -7);
      } else {
        break;
      }
    }
  } else {
    // Günlük veya belirli günler serisi (bugün henüz işaretlenmediyse dünden başlat)
    const todayDone = logByDate.get(todayTr)?.is_completed === 1;
    let cursor = todayDone ? todayTr : shiftTurkeyDate(todayTr, -1);
    for (let i = 0; i < 365; i++) {
      const scheduled = isHabitScheduledOnDate(habit, cursor);
      const done = logByDate.get(cursor)?.is_completed === 1;
      if (done) {
        currentStreak++;
      } else if (scheduled) {
        break;
      }
      cursor = shiftTurkeyDate(cursor, -1);
    }
  }

  // En uzun seri (112 gün penceresi içinde)
  let longestStreak = currentStreak;
  let running = 0;
  for (const cell of last112Days) {
    if (cell.completed) {
      running++;
      if (running > longestStreak) longestStreak = running;
    } else if (cell.scheduled && habit.frequency_type !== 'flexible_weekly') {
      running = 0;
    }
  }

  const totalCompletions = habitLogs.filter(l => l.is_completed === 1).length;

  return {
    currentStreak,
    longestStreak,
    totalCompletions,
    weeklyCompletedCount,
    weeklyTargetCount: weeklyTarget,
    weeklyQuotaSatisfied,
    consistency30dPercent,
    last14Days,
    last112Days
  };
}

/**
 * Tüm aktif alışkanlıklardan 0-100 Alışkanlık Sağlık Skoru ve 7 rozet üretir.
 */
export function computeHabitSummaryAndBadges(
  habits: HabitItem[],
  statsMap: Record<string, HabitStats>
): { healthScore: number; badges: HabitBadge[] } {
  const activeHabits = habits.filter(h => h.is_archived !== 1);
  if (activeHabits.length === 0) {
    return {
      healthScore: 0,
      badges: buildHabitBadges(0, 0, false)
    };
  }

  const avgConsistency =
    activeHabits.reduce((acc, h) => acc + (statsMap[h.id]?.consistency30dPercent || 0), 0) /
    activeHabits.length;
  const maxStreak = Math.max(0, ...activeHabits.map(h => statsMap[h.id]?.longestStreak || 0));
  const totalCompletions = activeHabits.reduce((acc, h) => acc + (statsMap[h.id]?.totalCompletions || 0), 0);
  const hasPerfectWeek = activeHabits.some(h => Boolean(statsMap[h.id]?.weeklyQuotaSatisfied));

  const streakBonus = Math.min(20, maxStreak);
  const healthScore = Math.min(100, Math.round(avgConsistency * 0.8 + streakBonus));

  return {
    healthScore,
    badges: buildHabitBadges(maxStreak, totalCompletions, hasPerfectWeek)
  };
}

function buildHabitBadges(maxStreak: number, totalCompletions: number, hasPerfectWeek: boolean): HabitBadge[] {
  return [
    { id: 'first_step', title: 'İlk Adım', description: 'İlk alışkanlığını tamamladın', icon: '🌱', unlocked: totalCompletions >= 1 },
    { id: 'spark_3', title: '3 Günlük Kıvılcım', description: '3 gün kesintisiz seri yakaladın', icon: '🔥', unlocked: maxStreak >= 3 },
    { id: 'rhythm_7', title: 'Haftalık Ritim', description: '7 günlük seri tamamladın', icon: '⚡', unlocked: maxStreak >= 7 },
    { id: 'habit_21', title: '21 Gün Kuralı', description: '21 günlük istikrar sağladın', icon: '🧠', unlocked: maxStreak >= 21 },
    { id: 'iron_30', title: '30 Gün Demir İrade', description: '30 gün aralıksız devam ettin', icon: '🛡️', unlocked: maxStreak >= 30 },
    { id: 'perfect_week', title: 'Mükemmel Hafta', description: 'Haftalık alışkanlık kotasını doldurdun', icon: '🏆', unlocked: hasPerfectWeek },
    { id: 'century_100', title: '100 Tamamlama', description: 'Toplam 100 kez alışkanlık tamamladın', icon: '💎', unlocked: totalCompletions >= 100 }
  ];
}
