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

function toTurkeyCalendarNoonMs(dateStr?: string | null): number | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  let y: number | undefined;
  let m: number | undefined;
  let d: number | undefined;

  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (ymd) {
    y = Number(ymd[1]);
    m = Number(ymd[2]);
    d = Number(ymd[3]);
  } else {
    const dmy = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(trimmed);
    if (dmy) {
      d = Number(dmy[1]);
      m = Number(dmy[2]);
      y = Number(dmy[3]);
    } else {
      const parsed = new Date(trimmed);
      if (isNaN(parsed.getTime())) return null;
      const trDay = getTodayTurkeyDate(parsed);
      const parts = trDay.split('-').map(Number);
      y = parts[0];
      m = parts[1];
      d = parts[2];
    }
  }

  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  if (
    isNaN(dt.getTime()) ||
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return dt.getTime();
}

/**
 * İki takvim günü arasındaki gün farkını (target - base) saat dilimi/saat kayması olmadan hesaplar.
 * Geçersiz tarihlerde null döner.
 */
export function diffTurkeyCalendarDays(
  targetDateStr?: string | null,
  baseDateStr: string = getTodayTurkeyDate()
): number | null {
  const targetMs = toTurkeyCalendarNoonMs(targetDateStr);
  const baseMs = toTurkeyCalendarNoonMs(baseDateStr);
  if (targetMs === null || baseMs === null) return null;
  return Math.round((targetMs - baseMs) / 86_400_000);
}

/**
 * YYYY-MM-DD tarih dizesini, yıl/ay/gün bileşenleri Türkiye takvim gününe sabitlenmiş Date nesnesine çevirir.
 * calculateCreditCardSchedule gibi getFullYear/getMonth/getDate okuyan yardımcılar için UTC kaymasını önler.
 */
export function parseTurkeyCalendarDate(dateStr: string = getTodayTurkeyDate()): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (match) {
    const dt = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (!isNaN(dt.getTime())) return dt;
  }
  return new Date();
}

/**
 * UTC ISO zaman damgasını (ör. completed_at, created_at) Türkiye yerel takvim gününe (YYYY-MM-DD) çevirir.
 * Geçersiz/boş girdide null döner.
 */
export function toTurkeyDay(isoTimestamp?: string | null): string | null {
  if (!isoTimestamp) return null;
  const d = new Date(isoTimestamp);
  if (isNaN(d.getTime())) return null;
  return getTodayTurkeyDate(d);
}

/**
 * ISO zaman damgasından veya Date nesnesinden Türkiye saat dilimindeki saati (0..23) döndürür.
 */
export function getTurkeyHour(isoOrDate: string | Date): number {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (isNaN(d.getTime())) return 12;
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul',
    hour: 'numeric',
    hour12: false
  }).format(d);
  const parsed = parseInt(formatted, 10);
  if (!Number.isFinite(parsed)) return 12;
  return parsed === 24 ? 0 : parsed % 24;
}

/**
 * Türkçe karakterleri (İ/i/ı/ş/ğ/ç/ö/ü) normalize ederek arama için sadeleştirir.
 */
export function normalizeTurkishSearch(text?: string | null): string {
  if (!text) return '';
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .trim();
}

/**
 * Türkçe karakter duyarsız arama eşleştirici.
 */
export function matchesTurkishQuery(
  query: string | undefined,
  fields: Array<string | null | undefined>
): boolean {
  const normalizedQuery = normalizeTurkishSearch(query);
  if (!normalizedQuery) return true;
  return fields.some(field => {
    if (!field) return false;
    return normalizeTurkishSearch(field).includes(normalizedQuery);
  });
}
