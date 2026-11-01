/**
 * Financial & Currency Utilities for Singularity Life OS
 */

/**
 * Parses numeric currency strings safely handling Turkish and International formats:
 * - '2.500,50' -> 2500.50
 * - '2500,50'  -> 2500.50
 * - '2,500.50' -> 2500.50
 * - '2500.50'  -> 2500.50
 * - '1.200'    -> 1200 (Turkish thousand separator)
 * - '1.250.000'-> 1250000
 * - '2500'     -> 2500
 */
export function parseFinancialAmount(val: string | number): number {
  if (typeof val === 'number') {
    return isNaN(val) ? NaN : val;
  }
  if (!val || typeof val !== 'string') {
    return NaN;
  }

  // Remove common currency symbols and whitespace
  let cleaned = val.replace(/[₺$€£]/g, '').trim();
  if (!cleaned) return NaN;

  // Handle both . and , present
  if (cleaned.includes('.') && cleaned.includes(',')) {
    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');
    if (lastComma > lastDot) {
      // Turkish format: 1.250,50 -> remove dots, comma to dot
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // US format: 1,250.50 -> remove commas
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    // Only comma present: 2500,50 -> 2500.50
    cleaned = cleaned.replace(',', '.');
  } else if (cleaned.includes('.')) {
    // Only dot present: e.g. '1.200' or '1.250.000' (Turkish thousands) vs '12.50' (decimal)
    const dotParts = cleaned.split('.');
    if (dotParts.length > 2) {
      // Multiple dots: definitely thousands, e.g. 1.250.000
      cleaned = cleaned.replace(/\./g, '');
    } else if (dotParts.length === 2) {
      // Single dot: e.g. '1.200' vs '12.50'
      const afterDot = dotParts[1];
      // If exactly 3 digits after dot, e.g. 1.200, 15.000 -> thousand separator
      if (afterDot.length === 3 && dotParts[0].length >= 1) {
        cleaned = cleaned.replace(/\./g, '');
      }
    }
  }

  const result = parseFloat(cleaned);
  return isNaN(result) ? NaN : result;
}

/**
 * Formats financial amounts safely without throwing RangeError on non-ISO currencies like 'GOLD'.
 */
export function formatFinancialCurrency(
  val: number,
  cur: string = 'TRY',
  maximumFractionDigits: number = 0
): string {
  const safeVal = Number(val) || 0;
  const upperCur = (cur || 'TRY').toUpperCase().trim();

  if (upperCur === 'GOLD') {
    return `${safeVal.toLocaleString('tr-TR', {
      minimumFractionDigits: maximumFractionDigits > 0 ? 2 : 0,
      maximumFractionDigits
    })} gr Altın`;
  }

  const validIsoCurrencies = ['TRY', 'USD', 'EUR', 'GBP'];
  const safeCurrency = validIsoCurrencies.includes(upperCur) ? upperCur : 'TRY';

  try {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: safeCurrency,
      maximumFractionDigits
    }).format(safeVal);
  } catch {
    return `${safeVal.toLocaleString('tr-TR', { maximumFractionDigits })} ${upperCur}`;
  }
}

/**
 * Safely formats a date string (YYYY-MM-DD or full ISO 8601 YYYY-MM-DDTHH:mm:ss) into DD.MM.YYYY.
 */
export function formatDateSafe(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.trim();
    const parts = datePart.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      if (y.length === 4 && m.length <= 2 && d.length <= 2) {
        return `${d.padStart(2, '0')}.${m.padStart(2, '0')}.${y}`;
      }
    }
    const dObj = new Date(dateStr);
    if (!isNaN(dObj.getTime())) {
      const d = String(dObj.getDate()).padStart(2, '0');
      const m = String(dObj.getMonth() + 1).padStart(2, '0');
      const y = dObj.getFullYear();
      return `${d}.${m}.${y}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

/**
 * Calculates days overdue across month boundaries considering month lengths (28-31 days).
 */
export function calculateDaysOverdue(dueDay: number, today: Date = new Date()): number {
  if (!dueDay || dueDay < 1) return 1;

  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-indexed
  const currentDay = today.getDate();

  // If today is past or on the due day of the current month, the due date was in the current month
  let dueYear = currentYear;
  let dueMonth = currentMonth;

  if (currentDay < dueDay) {
    // Due date was in the previous month
    dueMonth = currentMonth - 1;
    if (dueMonth < 0) {
      dueMonth = 11;
      dueYear = currentYear - 1;
    }
  }

  // Get max days in the target due month
  const maxDaysInDueMonth = new Date(dueYear, dueMonth + 1, 0).getDate();
  const clampedDueDay = Math.min(dueDay, maxDaysInDueMonth);

  const dueDate = new Date(dueYear, dueMonth, clampedDueDay);
  const diffMs = today.getTime() - dueDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return Math.max(1, diffDays);
}
