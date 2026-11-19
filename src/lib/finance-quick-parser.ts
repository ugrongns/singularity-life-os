// Singularity Life OS — Doğal Dil Finans Hızlı Giriş Ayrıştırıcısı (Sıfır AI Kotası)
import { normalizeTurkishSearch } from './date-utils';

export interface QuickFinanceAccount {
  id: string;
  name: string;
  type: string;
  currency?: string;
}

export interface QuickFinanceCategory {
  id: string;
  name: string;
  type?: string;
}

export interface ParsedQuickFinanceDraft {
  txType: 'expense' | 'income';
  amount: string;
  numericAmount: number;
  merchant: string;
  walletId: string;
  walletName: string;
  categoryId: string;
  categoryName: string;
}

const INCOME_KEYWORDS = ['gelir', 'maas', 'prim', 'temettu', 'kira geliri', 'iade', 'odeme alindi', 'avans', 'burs', 'harclik'];

const CATEGORY_HINTS: Array<{ keywords: string[]; catMatchers: string[]; type: 'expense' | 'income' }> = [
  { keywords: ['maas', 'gelir', 'prim', 'temettu', 'kira geliri', 'ek gelir'], catMatchers: ['maas', 'gelir'], type: 'income' },
  { keywords: ['kahve', 'yemek', 'restoran', 'kafe', 'cafe', 'starbucks', 'kahvalt', 'kebap', 'pizza', 'burger', 'sinema', 'eglence', 'disari'], catMatchers: ['eglence', 'disari', 'yeme'], type: 'expense' },
  { keywords: ['market', 'migros', 'bim', 'a101', 'sok', 'carrefour', 'file', 'gida', 'ekmek', 'sut', 'manav', 'kasap', 'firin'], catMatchers: ['market', 'gida'], type: 'expense' },
  { keywords: ['benzin', 'mazot', 'yakit', 'opet', 'shell', 'bp', 'petrol', 'otopark', 'taksi', 'uber', 'metro', 'otobus', 'bilet', 'hgs', 'ogs'], catMatchers: ['ulasim', 'yakit'], type: 'expense' },
  { keywords: ['fatura', 'elektrik', 'su', 'dogalgaz', 'internet', 'telefon', 'turkcell', 'vodafone', 'ttnet', 'aidat', 'abonelik', 'netflix', 'spotify'], catMatchers: ['fatura', 'abonelik'], type: 'expense' },
  { keywords: ['kira', 'konut', 'ev', 'depozito'], catMatchers: ['kira', 'konut'], type: 'expense' },
  { keywords: ['eczane', 'ilac', 'doktor', 'hastane', 'saglik', 'vitamin', 'dis', 'kuafor', 'berber'], catMatchers: ['saglik', 'kisisel'], type: 'expense' }
];

/**
 * Türkçe sayı biçimlerini (1.450,50 / 1450.50 / 1450,5 / 15bin / 65000) sayıya çevirir.
 */
export function parseQuickTurkishAmount(rawToken: string): number {
  let clean = rawToken.trim().toLowerCase();
  let multiplier = 1;
  if (clean.endsWith('bin') || clean.endsWith('k')) {
    multiplier = 1000;
    clean = clean.replace(/(bin|k)$/i, '').trim();
  }

  // Hem nokta hem virgül varsa (örn. 1.450,50 veya 1,450.50)
  if (clean.includes('.') && clean.includes(',')) {
    const lastDot = clean.lastIndexOf('.');
    const lastComma = clean.lastIndexOf(',');
    if (lastComma > lastDot) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else {
      clean = clean.replace(/,/g, '');
    }
  } else if (clean.includes(',')) {
    const parts = clean.split(',');
    if (parts[1] && parts[1].length <= 2) {
      clean = clean.replace(',', '.');
    } else {
      clean = clean.replace(/,/g, '');
    }
  } else if (clean.includes('.')) {
    const parts = clean.split('.');
    // "1.500" gibi binlik ayracıysa noktayı sil, "14.5" veya "14.50" ise ondalık bırak
    if (parts.length > 2 || (parts[1] && parts[1].length === 3)) {
      clean = clean.replace(/\./g, '');
    }
  }

  const parsed = parseFloat(clean);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.round(parsed * multiplier * 100) / 100;
}

/**
 * Tek satırlık Türkçe finans metnini ("Kahve 120 nakit", "+65000 maaş garanti") ayrıştırır.
 */
export function parseQuickFinanceInput(
  rawInput: string,
  accounts: QuickFinanceAccount[] = [],
  categories: QuickFinanceCategory[] = []
): ParsedQuickFinanceDraft {
  const trimmed = rawInput.trim();
  const normalizedFull = normalizeTurkishSearch(trimmed);

  // 1. Gelir / Gider tespiti
  const startsWithPlus = trimmed.startsWith('+');
  const hasIncomeKeyword = INCOME_KEYWORDS.some(k => normalizedFull.includes(k));
  const txType: 'expense' | 'income' = startsWithPlus || hasIncomeKeyword ? 'income' : 'expense';

  // 2. Tutar tespiti
  const amountRegex = /[+-]?\s*(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:bin|k)?(?:\s*(?:tl|₺|lira))?/gi;
  let numericAmount = 0;
  let matchedAmountSnippet = '';
  const match = amountRegex.exec(trimmed);
  if (match) {
    matchedAmountSnippet = match[0];
    const candidate = parseQuickTurkishAmount(match[0].replace(/[+-]|tl|₺|lira/gi, '').trim());
    if (candidate > 0) numericAmount = candidate;
  }

  // 3. Cüzdan / Hesap eşleştirme
  let matchedWallet: QuickFinanceAccount | undefined;
  const matchedWalletTokens: string[] = [];

  for (const acc of accounts) {
    const accNorm = normalizeTurkishSearch(acc.name);
    if (!accNorm) continue;
    const words = accNorm.split(/\s+/).filter(w => w.length >= 3);
    if (normalizedFull.includes(accNorm)) {
      matchedWallet = acc;
      matchedWalletTokens.push(accNorm);
      break;
    }
    const matchedWord = words.find(w => normalizedFull.split(/\s+/).includes(w));
    if (matchedWord) {
      matchedWallet = acc;
      matchedWalletTokens.push(matchedWord);
      break;
    }
  }

  if (!matchedWallet && accounts.length > 0) {
    if (/\bnakit\b/.test(normalizedFull)) {
      matchedWallet = accounts.find(a => a.type === 'cash') || accounts[0];
      matchedWalletTokens.push('nakit');
    } else if (/\bkart\b|\bkredi karti\b/.test(normalizedFull)) {
      matchedWallet = accounts.find(a => a.type === 'credit_card') || accounts[0];
      matchedWalletTokens.push('kredi karti', 'kart');
    } else if (/\bbanka\b/.test(normalizedFull)) {
      matchedWallet = accounts.find(a => a.type === 'bank') || accounts[0];
      matchedWalletTokens.push('banka');
    } else {
      matchedWallet = accounts[0];
    }
  }

  // 4. Kategori eşleştirme
  const eligibleCategories = categories.filter(c => {
    const cNorm = normalizeTurkishSearch(c.name);
    if (txType === 'income') return c.type === 'income' || cNorm.includes('gelir') || cNorm.includes('maas');
    return c.type !== 'income' && !cNorm.includes('gelir') && !cNorm.includes('maas');
  });

  let matchedCategory: QuickFinanceCategory | undefined;
  for (const hint of CATEGORY_HINTS) {
    if (hint.type !== txType) continue;
    if (hint.keywords.some(k => normalizedFull.includes(k))) {
      matchedCategory = eligibleCategories.find(c => {
        const cNorm = normalizeTurkishSearch(c.name);
        return hint.catMatchers.some(m => cNorm.includes(m));
      });
      if (matchedCategory) break;
    }
  }

  if (!matchedCategory && eligibleCategories.length > 0) {
    matchedCategory =
      eligibleCategories.find(c => normalizeTurkishSearch(c.name).includes('diger')) ||
      eligibleCategories[0];
  }

  // 5. Harcama Noktası / Açıklama temizleme
  let merchantRaw = trimmed;
  if (matchedAmountSnippet) {
    merchantRaw = merchantRaw.replace(matchedAmountSnippet, ' ');
  }
  const tokens = merchantRaw
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => {
      if (!t || t === '+' || t === '-') return false;
      const tNorm = normalizeTurkishSearch(t);
      if (['tl', 'lira', '₺'].includes(tNorm)) return false;
      if (matchedWalletTokens.includes(tNorm)) return false;
      return true;
    });

  const cleanMerchant = tokens
    .map(w => w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1))
    .join(' ')
    .trim();

  return {
    txType,
    amount: numericAmount > 0 ? String(numericAmount) : '',
    numericAmount,
    merchant: cleanMerchant || (txType === 'income' ? 'Gelir Girişi' : 'Hızlı Harcama'),
    walletId: matchedWallet?.id || '',
    walletName: matchedWallet?.name || 'Varsayılan Hesap',
    categoryId: matchedCategory?.id || '',
    categoryName: matchedCategory?.name || (txType === 'income' ? 'Maaş & Gelir' : 'Diğer')
  };
}
