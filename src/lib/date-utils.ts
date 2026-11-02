/**
 * Singularity Life OS — Date & Timezone Utilities
 * Standardized date utilities for Europe/Istanbul (Türkiye)
 */

export function getTodayTurkeyDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(date);
}

export function parseTurkeyDate(dateStr: string): Date {
  // If YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  }
  // If DD.MM.YYYY or DD/MM/YYYY
  if (/^\d{1,2}[./-]\d{1,2}[./-]\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split(/[./-]/).map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  }
  return new Date(dateStr);
}

export function getDaysAgoTurkeyDate(days: number, fromDate?: string): string {
  const base = fromDate || getTodayTurkeyDate();
  return shiftTurkeyDate(base, -days);
}

export function shiftTurkeyDate(baseDateStr: string, deltaDays: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(baseDateStr)) {
    return getTodayTurkeyDate();
  }
  const [y, m, d] = baseDateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays, 12, 0, 0));
  return dt.toISOString().slice(0, 10);
}

export function formatTurkishDisplayDate(dateStr: string, includeRelative: boolean = true): string {
  const today = getTodayTurkeyDate();
  const yesterday = shiftTurkeyDate(today, -1);
  const tomorrow = shiftTurkeyDate(today, 1);

  const months = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ];
  const days = [
    'Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'
  ];

  const parsed = parseTurkeyDate(dateStr);
  const dayName = days[parsed.getUTCDay()];
  const monthName = months[parsed.getUTCMonth()];
  const dayNum = parsed.getUTCDate();
  const year = parsed.getUTCFullYear();

  if (includeRelative) {
    if (dateStr === today) return `Bugün, ${dayNum} ${monthName}`;
    if (dateStr === yesterday) return `Dün, ${dayNum} ${monthName}`;
    if (dateStr === tomorrow) return `Yarın, ${dayNum} ${monthName}`;
  }

  return `${dayNum} ${monthName} ${year}, ${dayName}`;
}

export function getShortTurkishDayName(dateStr: string): string {
  const shortDays = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  const parsed = parseTurkeyDate(dateStr);
  return shortDays[parsed.getUTCDay()];
}

export function getDaysRangeTurkey(count: number, endDateStr?: string): string[] {
  const end = endDateStr || getTodayTurkeyDate();
  const res: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    res.push(shiftTurkeyDate(end, -i));
  }
  return res;
}
