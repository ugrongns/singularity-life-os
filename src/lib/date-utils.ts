/**
 * Singularity Life OS — Date & Timezone Utilities
 * Standardized date utilities for Europe/Istanbul (Türkiye)
 */

export function getTodayTurkeyDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(date);
}

export function getDaysAgoTurkeyDate(days: number): string {
  const d = new Date(Date.now() - days * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(d);
}

export function parseTurkeyDate(dateStr: string): Date {
  // If YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  // If DD.MM.YYYY or DD/MM/YYYY
  if (/^\d{1,2}[./-]\d{1,2}[./-]\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split(/[./-]/).map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(dateStr);
}
