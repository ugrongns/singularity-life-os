// Singularity Life OS — Türkiye Banka Ekstresi CSV Ayrıştırıcısı
import { normalizeTurkishSearch } from './date-utils';
import { parseQuickTurkishAmount } from './finance-quick-parser';

export interface ParsedBankCsvRow {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  txType: 'expense' | 'income';
  isDuplicate: boolean;
  selected: boolean;
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function normalizeTrDateToIso(rawDate: string): string | null {
  const clean = rawDate.trim().split(/\s+/)[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  const dmy = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(clean);
  if (dmy) {
    const d = dmy[1].padStart(2, '0');
    const m = dmy[2].padStart(2, '0');
    const y = dmy[3];
    return `${y}-${m}-${d}`;
  }
  return null;
}

export function parseTrSignedAmount(raw: string): number {
  const trimmed = raw.trim();
  const isNegative = trimmed.startsWith('-') || trimmed.startsWith('(');
  const absVal = parseQuickTurkishAmount(trimmed.replace(/[()+-]|tl|₺|try/gi, '').trim());
  if (absVal <= 0) return 0;
  return isNegative ? -absVal : absVal;
}

/**
 * TR banka ekstresi CSV metnini (; veya , ayracıyla) ayrıştırır ve mevcut işlemlerle mükerrer kontrolü yapar.
 */
export function parseTurkishBankCsv(
  csvText: string,
  existingTxs: Array<{ transaction_date: string; amount: number; merchant?: string | null }> = []
): ParsedBankCsvRow[] {
  const lines = csvText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  // İlk satırdan ayraç tespiti (TR bankaları çoğunlukla ';' kullanır)
  const delimiter = (lines[0].match(/;/g)?.length || 0) >= (lines[0].match(/,/g)?.length || 0) ? ';' : ',';
  const headers = splitDelimitedLine(lines[0], delimiter).map(h => normalizeTurkishSearch(h));

  const dateIdx = headers.findIndex(h => h.includes('tarih') || h.includes('date'));
  const descIdx = headers.findIndex(h => h.includes('aciklama') || h.includes('islem') || h.includes('description') || h.includes('detay'));
  const amountIdx = headers.findIndex(h => h.includes('tutar') || h.includes('miktar') || h.includes('amount'));

  if (dateIdx === -1 || amountIdx === -1) return [];

  const existingKeys = new Set(
    existingTxs.map(t => `${t.transaction_date}|${Math.round(Math.abs(t.amount) * 100)}|${normalizeTurkishSearch(t.merchant).slice(0, 12)}`)
  );

  const parsed: ParsedBankCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitDelimitedLine(lines[i], delimiter);
    const isoDate = normalizeTrDateToIso(cols[dateIdx] || '');
    if (!isoDate) continue;

    const signedAmount = parseTrSignedAmount(cols[amountIdx] || '');
    if (signedAmount === 0) continue;

    const description = (descIdx >= 0 ? cols[descIdx] : '')?.trim() || 'Banka İşlemi';
    const absAmount = Math.abs(signedAmount);
    const txType: 'expense' | 'income' = signedAmount > 0 ? 'income' : 'expense';
    const dupKey = `${isoDate}|${Math.round(absAmount * 100)}|${normalizeTurkishSearch(description).slice(0, 12)}`;
    const isDuplicate = existingKeys.has(dupKey);

    parsed.push({
      date: isoDate,
      description,
      amount: absAmount,
      txType,
      isDuplicate,
      selected: !isDuplicate
    });
  }

  return parsed;
}
