import { db } from '@/db';
import { familyMembers, foodNutrientProfiles, nutritionMealItems, nutritionMeals } from '@/db/schema';
import { RESILIENT_GEMINI_MODELS } from '@/lib/ai-vision';
import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm';

export type NutritionSourceType =
  | 'user_history_item'
  | 'user_history_meal'
  | 'learned_profile'
  | 'static_db'
  | 'ai_estimated'
  | 'manual_required';

export interface MacroValues {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface ParsedFoodInput {
  rawText: string;
  cleanName: string;
  normalizedKey: string;
  grams: number;
  explicitGrams: boolean;
  quantityLabel: string;
  quantityCount?: number;
  quantityUnit?: string;
}

export interface ResolvedFoodItem {
  name: string;
  normalizedKey: string;
  grams: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  basePer100g: MacroValues;
  source: NutritionSourceType;
  sourceBadge: string;
  quotaUsed: boolean;
}

export interface MemorySuggestionItem {
  id: string;
  name: string;
  normalizedKey: string;
  defaultGrams: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  basePer100g: MacroValues;
  source: 'user_history_item' | 'user_history_meal' | 'learned_profile' | 'static_db';
  sourceBadge: string;
  mealType?: string;
}

export interface MealResolutionResult {
  items: ResolvedFoodItem[];
  total: MacroValues & { grams: number };
  quotaUsedCount: number;
  memoryHitCount: number;
}

export interface LearnItemInput {
  name: string;
  grams?: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

// ============================================================================
// 🏛️ Çekirdek TÜRKOMP & USDA 100g Besin Sözlüğü (0 AI Kotası)
// ============================================================================
interface StaticFoodEntry {
  key: string;
  foodName: string;
  per100g: MacroValues;
  unitGrams?: Partial<Record<string, number>>;
  matcher: (normalized: string, hasWord: (w: string) => boolean, hasPhrase: (p: string) => boolean) => boolean;
}

const STANDALONE_MODIFIERS = new Set([
  'beyaz', 'kirmizi', 'siyah', 'yesil', 'sari', 'mor', 'taze', 'cig', 'haslanmis',
  'kuru', 'organik', 'tam', 'yarim', 'yagsiz', 'az', 'az yagli', 'tam yagli', 'dogal', 'suzme',
  'ev', 'koy', 'kizarmis', 'firinda', 'izgara', 'kavrulmus', 'tuzsuz', 'tuzlu', 'sade', 'klasik',
  'yapimi', 'ev yapimi', 'bol', 'azcik', 'butun'
]);

const DISH_MODIFIER_WORDS = [
  'corba', 'corbasi', 'salata', 'salatasi', 'borek', 'boregi', 'tatli', 'tatlisi',
  'kek', 'keki', 'pasta', 'pastasi', 'pizza', 'burger', 'sandwich', 'sandvic',
  'tost', 'doner', 'durum', 'kebap', 'lahmacun', 'pide', 'makarna', 'dolma', 'sarma'
];

const CORE_STATIC_FOODS: StaticFoodEntry[] = [
  {
    key: 'yumurta',
    foodName: 'Haşlanmış Yumurta (Bütün)',
    per100g: { calories: 155, protein_g: 13.0, carbs_g: 1.1, fat_g: 11.0 },
    unitGrams: { adet: 50, tane: 50 },
    matcher: (n, hasWord, hasPhrase) =>
      !hasAnyDishWord(n) &&
      !hasWord('sucuklu') &&
      !hasWord('kasarli') &&
      !hasWord('peynirli') &&
      !hasWord('pastirmali') &&
      !hasWord('kavurmali') &&
      !hasWord('aki') &&
      !hasWord('sarisi') &&
      !hasWord('beyazi') &&
      (hasWord('yumurta') || hasWord('egg') || hasWord('omlet') || hasPhrase('haslanmis yumurta') || hasPhrase('cirpilmis yumurta'))
  },
  {
    key: 'tavuk',
    foodName: 'Tavuk Göğsü (Izgara / Haşlama)',
    per100g: { calories: 165, protein_g: 31.0, carbs_g: 0.0, fat_g: 3.6 },
    unitGrams: { porsiyon: 180, adet: 180 },
    matcher: (n, hasWord) =>
      !hasAnyDishWord(n) &&
      !hasWord('kanat') &&
      !hasWord('baget') &&
      !hasWord('but') &&
      !hasWord('sinitzel') &&
      !hasWord('schnitzel') &&
      !hasWord('sote') &&
      !hasWord('nugget') &&
      !hasWord('paneli') &&
      (hasWord('tavuk') || hasWord('pilic'))
  },
  {
    key: 'yulaf',
    foodName: 'Tam Yulaf Ezmesi',
    per100g: { calories: 389, protein_g: 16.9, carbs_g: 66.3, fat_g: 6.9 },
    unitGrams: { kase: 60, porsiyon: 60, tabak: 60, bardak: 80, 'su bardagi': 80 },
    matcher: (n, hasWord) =>
      !hasAnyDishWord(n) &&
      !hasWord('kurabiye') &&
      !hasWord('kurabiyesi') &&
      !hasWord('ekmek') &&
      !hasWord('ekmegi') &&
      !hasWord('sutu') &&
      !hasWord('unu') &&
      !hasWord('ezmeli') &&
      !hasWord('bar') &&
      (hasWord('yulaf') || hasWord('oat') || hasWord('oatmeal'))
  },
  {
    key: 'muz',
    foodName: 'Taze Muz',
    per100g: { calories: 89, protein_g: 1.1, carbs_g: 22.8, fat_g: 0.3 },
    unitGrams: { adet: 120, tane: 120 },
    matcher: (n, hasWord) => !hasAnyDishWord(n) && !hasWord('sutu') && (hasWord('muz') || hasWord('banana'))
  },
  {
    key: 'sut',
    foodName: 'Tam Yağlı Süt (%3.0)',
    per100g: { calories: 61, protein_g: 3.2, carbs_g: 4.8, fat_g: 3.3 },
    unitGrams: { bardak: 200, 'su bardagi': 200, 'cay bardagi': 100, fincan: 150, kupa: 250 },
    matcher: (n, hasWord) =>
      !hasAnyDishWord(n) &&
      !hasWord('badem') &&
      !hasWord('yulaf') &&
      !hasWord('soya') &&
      !hasWord('hindistan') &&
      !hasWord('kahve') &&
      !hasWord('cikolata') &&
      !hasWord('sutlu') &&
      !hasWord('peynir') &&
      !hasWord('receli') &&
      !hasWord('misir') &&
      !hasWord('tozu') &&
      (hasWord('sut') || hasWord('milk'))
  },
  {
    key: 'suzme_yogurt',
    foodName: 'Süzme Yoğurt',
    per100g: { calories: 97, protein_g: 9.0, carbs_g: 3.8, fat_g: 5.0 },
    unitGrams: { kase: 200, porsiyon: 200, 'yemek kasigi': 25, 'corba kasigi': 25 },
    matcher: (n, _hasWord, hasPhrase) => !hasAnyDishWord(n) && hasPhrase('suzme yogurt')
  },
  {
    key: 'yogurt',
    foodName: 'Doğal Tam Yağlı Yoğurt',
    per100g: { calories: 61, protein_g: 3.5, carbs_g: 4.7, fat_g: 3.3 },
    unitGrams: { kase: 200, porsiyon: 200, 'yemek kasigi': 25, 'corba kasigi': 25 },
    matcher: (n, hasWord, hasPhrase) => !hasAnyDishWord(n) && !hasPhrase('suzme yogurt') && hasWord('yogurt')
  },
  {
    key: 'zeytinyagi',
    foodName: 'Naturel Sızma Zeytinyağı',
    per100g: { calories: 884, protein_g: 0.0, carbs_g: 0.0, fat_g: 100.0 },
    unitGrams: { 'yemek kasigi': 10, 'corba kasigi': 10, yk: 10, 'tatli kasigi': 5, tk: 5, 'cay kasigi': 3, ck: 3 },
    matcher: (_n, _hasWord, hasPhrase) =>
      hasPhrase('zeytinyagi') || hasPhrase('zeytin yagi') || hasPhrase('olive oil') || hasPhrase('sizma zeytinyagi')
  },
  {
    key: 'zeytin',
    foodName: 'Sofralık Siyah / Yeşil Zeytin',
    per100g: { calories: 115, protein_g: 0.8, carbs_g: 6.3, fat_g: 10.7 },
    unitGrams: { adet: 4, tane: 4 },
    matcher: (_n, hasWord) => hasWord('zeytin') && !hasWord('yagi') && !hasWord('yag') && !hasWord('ezmesi') && !hasWord('zeytinli')
  },
  {
    key: 'dana_eti',
    foodName: 'Yağsız Dana Eti / Biftek',
    per100g: { calories: 215, protein_g: 26.1, carbs_g: 0.0, fat_g: 11.8 },
    matcher: (n, hasWord, hasPhrase) =>
      !hasAnyDishWord(n) &&
      (hasPhrase('dana eti') || hasPhrase('kirmizi et') || hasWord('biftek') || hasWord('bonfile') || hasPhrase('dana kiyma') || n === 'kiyma' || n === 'et')
  },
  {
    key: 'badem',
    foodName: 'Çiğ İç Badem',
    per100g: { calories: 579, protein_g: 21.2, carbs_g: 21.6, fat_g: 49.9 },
    unitGrams: { adet: 1.2, tane: 1.2, avuc: 30 },
    matcher: (n, hasWord) => !hasAnyDishWord(n) && !hasWord('sutu') && !hasWord('unu') && !hasWord('ezmesi') && (hasWord('badem') || hasWord('almond'))
  },
  {
    key: 'elma',
    foodName: 'Taze Elma',
    per100g: { calories: 52, protein_g: 0.3, carbs_g: 13.8, fat_g: 0.2 },
    unitGrams: { adet: 150, tane: 150 },
    matcher: (n, hasWord) => !hasAnyDishWord(n) && !hasWord('sirkesi') && (hasWord('elma') || hasWord('apple'))
  },
  {
    key: 'mercimek',
    foodName: 'Haşlanmış Mercimek',
    per100g: { calories: 116, protein_g: 9.0, carbs_g: 20.1, fat_g: 0.4 },
    matcher: (n, hasWord) => !hasAnyDishWord(n) && !hasWord('koftesi') && (hasWord('mercimek') || hasWord('lentil'))
  },
  {
    key: 'avokado',
    foodName: 'Taze Avokado',
    per100g: { calories: 160, protein_g: 2.0, carbs_g: 8.5, fat_g: 14.7 },
    unitGrams: { adet: 150, tane: 150 },
    matcher: (n, hasWord) => !hasAnyDishWord(n) && (hasWord('avokado') || hasWord('avocado'))
  },
  {
    key: 'fistik_ezmesi',
    foodName: 'Doğal Şekersiz Fıstık Ezmesi',
    per100g: { calories: 588, protein_g: 25.1, carbs_g: 20.0, fat_g: 50.4 },
    unitGrams: { 'yemek kasigi': 16, 'corba kasigi': 16, yk: 16, 'tatli kasigi': 8, tk: 8 },
    matcher: (_n, _hasWord, hasPhrase) => hasPhrase('fistik ezmesi') || hasPhrase('peanut butter')
  },
  {
    key: 'pirinc',
    foodName: 'Haşlanmış Pirinç Pilavı / Basmati',
    per100g: { calories: 130, protein_g: 2.7, carbs_g: 28.2, fat_g: 0.3 },
    unitGrams: { porsiyon: 180, tabak: 180, kase: 180, kepce: 90 },
    matcher: (n, hasWord, hasPhrase) =>
      !hasAnyDishWord(n) &&
      !hasWord('unu') &&
      !hasWord('patlagi') &&
      !hasWord('sutu') &&
      !hasWord('nisastasi') &&
      (hasWord('pirinc') || hasPhrase('pirinc pilavi') || hasWord('basmati') || hasPhrase('yasemin pirinc'))
  },
  {
    key: 'ceviz',
    foodName: 'Çiğ Kuru İç Ceviz',
    per100g: { calories: 654, protein_g: 15.2, carbs_g: 13.7, fat_g: 65.2 },
    unitGrams: { adet: 5, tane: 5, avuc: 30 },
    matcher: (n, hasWord) =>
      !hasAnyDishWord(n) &&
      !hasWord('hindistan') &&
      !hasWord('brezilya') &&
      !hasWord('muskat') &&
      (hasWord('ceviz') || hasWord('walnut'))
  },
  {
    key: 'somon',
    foodName: 'Izgara Somon Balığı',
    per100g: { calories: 206, protein_g: 22.1, carbs_g: 0.0, fat_g: 12.3 },
    unitGrams: { porsiyon: 180 },
    matcher: (n, hasWord) => !hasAnyDishWord(n) && (hasWord('somon') || hasWord('salmon'))
  },
  {
    key: 'ton_baligi',
    foodName: 'Ton Balığı',
    per100g: { calories: 186, protein_g: 25.4, carbs_g: 0.0, fat_g: 8.2 },
    unitGrams: { kutu: 75, paket: 75, adet: 75, tane: 75 },
    matcher: (n, hasWord, hasPhrase) =>
      !hasAnyDishWord(n) && (hasPhrase('ton baligi') || hasWord('dardanel') || hasWord('tuna') || n === 'ton')
  },
  {
    key: 'lor',
    foodName: 'Lor Peyniri',
    per100g: { calories: 112, protein_g: 19.8, carbs_g: 3.2, fat_g: 2.4 },
    matcher: (n, hasWord) => !hasAnyDishWord(n) && hasWord('lor')
  },
  {
    key: 'beyaz_peynir',
    foodName: 'Tam Yağlı Beyaz Peynir / Ezine',
    per100g: { calories: 260, protein_g: 16.0, carbs_g: 1.5, fat_g: 21.0 },
    unitGrams: { dilim: 30 },
    matcher: (n, hasWord, hasPhrase) =>
      !hasAnyDishWord(n) && (hasPhrase('beyaz peynir') || hasWord('ezine') || hasWord('feta') || n === 'peynir')
  },
  {
    key: 'kasar_peyniri',
    foodName: 'Taze / Eski Kaşar Peyniri',
    per100g: { calories: 350, protein_g: 27.0, carbs_g: 1.0, fat_g: 26.5 },
    unitGrams: { dilim: 25 },
    matcher: (n, hasWord, hasPhrase) =>
      !hasAnyDishWord(n) && (hasWord('kasar') || hasWord('cheddar') || hasWord('cedar') || hasPhrase('eski kasar') || hasPhrase('taze kasar'))
  },
  {
    key: 'tulum_peyniri',
    foodName: 'Tulum Peyniri',
    per100g: { calories: 330, protein_g: 24.0, carbs_g: 2.0, fat_g: 25.0 },
    matcher: (n, hasWord, hasPhrase) =>
      !hasAnyDishWord(n) && (hasWord('tulum') || hasPhrase('erzincan tulum') || hasPhrase('izmir tulum'))
  },
  {
    key: 'hurma',
    foodName: 'Hurma / Hurma Ezmesi',
    per100g: { calories: 277, protein_g: 1.8, carbs_g: 75.0, fat_g: 0.2 },
    unitGrams: { adet: 10, tane: 10 },
    matcher: (n, hasWord, hasPhrase) => !hasAnyDishWord(n) && (hasWord('hurma') || hasWord('date') || hasPhrase('hurma ezmesi'))
  },
  {
    key: 'mercimek_corbasi',
    foodName: 'Kırmızı Mercimek Çorbası',
    per100g: { calories: 72, protein_g: 4.5, carbs_g: 10.2, fat_g: 1.5 },
    unitGrams: { kase: 250, porsiyon: 250, tabak: 250, kepce: 150 },
    matcher: (_n, _hasWord, hasPhrase) => hasPhrase('mercimek corbasi') || hasPhrase('ezogelin corbasi')
  },
  {
    key: 'ekmek',
    foodName: 'Tam Buğday / Çavdar Ekmeği',
    per100g: { calories: 247, protein_g: 13.0, carbs_g: 41.0, fat_g: 3.4 },
    unitGrams: { dilim: 30, adet: 250 },
    matcher: (n, hasWord, hasPhrase) =>
      !hasAnyDishWord(n) && (hasWord('ekmek') || hasWord('ekmegi') || hasPhrase('tam bugday ekmegi') || hasPhrase('cavdar ekmegi'))
  },
  {
    key: 'bulgur',
    foodName: 'Haşlanmış Bulgur Pilavı',
    per100g: { calories: 120, protein_g: 3.1, carbs_g: 21.6, fat_g: 2.4 },
    unitGrams: { porsiyon: 180, tabak: 180, kase: 180, kepce: 90 },
    matcher: (n, hasWord, hasPhrase) => !hasWord('koftesi') && !hasWord('salatasi') && (hasWord('bulgur') || hasPhrase('bulgur pilavi'))
  },
  {
    key: 'izgara_kofte',
    foodName: 'Izgara Dana Köfte',
    per100g: { calories: 235, protein_g: 20.5, carbs_g: 3.8, fat_g: 15.2 },
    unitGrams: { adet: 30, tane: 30, porsiyon: 180 },
    matcher: (n, hasWord) =>
      !hasWord('cig') && !hasWord('mercimek') && !hasWord('icli') && (hasWord('kofte') || hasWord('koftesi'))
  },
  {
    key: 'makarna',
    foodName: 'Haşlanmış Makarna',
    per100g: { calories: 157, protein_g: 5.8, carbs_g: 30.9, fat_g: 0.9 },
    unitGrams: { porsiyon: 180, tabak: 180, kase: 180 },
    matcher: (_n, hasWord) =>
      !hasWord('tavuklu') &&
      !hasWord('kiymali') &&
      !hasWord('peynirli') &&
      !hasWord('ton') &&
      !hasWord('firinda') &&
      (hasWord('makarna') || hasWord('spagetti') || hasWord('penne'))
  }
];

function hasAnyDishWord(normalized: string): boolean {
  return DISH_MODIFIER_WORDS.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(normalized));
}

// Türkçe karakterleri ASCII'ye güvenli indirge ve birleşik aksanları temizle
export function toAsciiTurkishLower(text: string): string {
  return String(text || '')
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .replace(/Ş/g, 's')
    .replace(/ş/g, 's')
    .replace(/Ğ/g, 'g')
    .replace(/ğ/g, 'g')
    .replace(/Ü/g, 'u')
    .replace(/ü/g, 'u')
    .replace(/Ö/g, 'o')
    .replace(/ö/g, 'o')
    .replace(/Ç/g, 'c')
    .replace(/ç/g, 'c')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

const UNIT_WEIGHT_DEFAULTS: Record<string, number> = {
  g: 1,
  gr: 1,
  gram: 1,
  ml: 1,
  kg: 1000,
  kilo: 1000,
  lt: 1000,
  litre: 1000,
  adet: 100,
  tane: 100,
  porsiyon: 250,
  kase: 250,
  tabak: 250,
  'su bardagi': 200,
  'cay bardagi': 100,
  bardak: 200,
  fincan: 150,
  kupa: 250,
  'yemek kasigi': 12,
  'corba kasigi': 12,
  yk: 12,
  'tatli kasigi': 5,
  tk: 5,
  'cay kasigi': 3,
  ck: 3,
  dilim: 30,
  avuc: 30,
  kepce: 150,
  olcek: 30,
  scoop: 30,
  dis: 5,
  paket: 100,
  kutu: 100
};

const MASS_VOLUME_UNITS = new Set(['g', 'gr', 'gram', 'ml', 'kg', 'kilo', 'lt', 'litre']);
const GENERIC_COUNT_UNITS = new Set(['adet', 'tane', 'paket', 'kutu']);

const FOOD_ADET_OVERRIDES: Array<{ keyword: string; unitWeights: Partial<Record<string, number>> }> = [
  { keyword: 'findik', unitWeights: { adet: 1.2, tane: 1.2, avuc: 30 } },
  { keyword: 'sarmisak', unitWeights: { dis: 5 } },
  { keyword: 'sarimsak', unitWeights: { dis: 5 } }
];

const SORTED_UNIT_PATTERNS = [
  'su bardagi',
  'cay bardagi',
  'yemek kasigi',
  'corba kasigi',
  'tatli kasigi',
  'cay kasigi',
  'porsiyon',
  'gram',
  'litre',
  'bardak',
  'fincan',
  'dilim',
  'kepce',
  'olcek',
  'scoop',
  'paket',
  'tabak',
  'kilo',
  'kupa',
  'adet',
  'tane',
  'kase',
  'avuc',
  'kutu',
  'dis',
  'gr',
  'ml',
  'kg',
  'lt',
  'yk',
  'tk',
  'ck',
  'g'
];

function resolveUnitGramWeight(
  unit: string,
  cleanNameAscii: string
): { weight: number; hasKnownWeight: boolean } {
  const staticMatch = findStaticFoodMatch(cleanNameAscii);
  if (staticMatch?.unitGrams && staticMatch.unitGrams[unit] !== undefined) {
    return { weight: staticMatch.unitGrams[unit]!, hasKnownWeight: true };
  }

  for (const entry of FOOD_ADET_OVERRIDES) {
    if (new RegExp(`\\b${entry.keyword}\\b`, 'i').test(cleanNameAscii) && entry.unitWeights[unit] !== undefined) {
      return { weight: entry.unitWeights[unit]!, hasKnownWeight: true };
    }
  }

  const weight = UNIT_WEIGHT_DEFAULTS[unit] ?? 100;
  const hasKnownWeight = MASS_VOLUME_UNITS.has(unit) || !GENERIC_COUNT_UNITS.has(unit);
  return { weight, hasKnownWeight };
}

/**
 * Türkçe yemek ve ürün adlarını arama/eşleştirme için sadeleştirir:
 * baştaki/sondaki gramaj, miktar ve noktalama işaretlerini temizler.
 */
export function normalizeFoodKey(input: string): string {
  const parsed = parseSingleFoodToken(input);
  if (parsed.normalizedKey) return parsed.normalizedKey;

  return toAsciiTurkishLower(input)
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tekil besin metnini ayrıştırarak temiz besin adını ve gramajını çıkarır.
 * Örnekler: "2 adet haşlanmış yumurta", "150g ızgara tavuk", "yarım avokado", "1 kase yulaf"
 */
export function parseSingleFoodToken(raw: string): ParsedFoodInput {
  const rawTrimmed = String(raw || '').trim();
  if (!rawTrimmed) {
    return {
      rawText: '',
      cleanName: '',
      normalizedKey: '',
      grams: 100,
      explicitGrams: false,
      quantityLabel: '100 g'
    };
  }

  let workingOrig = rawTrimmed.replace(/(\d),(\d)/g, '$1.$2').trim();
  let workingAscii = toAsciiTurkishLower(workingOrig);

  let explicitGrams = false;
  let trailingExplicit = false;
  let grams = 100;
  let quantityLabel = '100 g';
  let quantityCount: number | undefined;
  let quantityUnit: string | undefined;

  const unitRegexGroup = SORTED_UNIT_PATTERNS.join('|');

  // 1. Sonda parantez içi veya çıplak miktar/gramaj kontrolü: "Haşlanmış Yumurta (100g)" veya "Tavuk 180g"
  const trailingParenMatch = workingAscii.match(/^(.*?)\s*\(\s*(\d+(?:\.\d+)?)\s*(kg|kilo|lt|litre|g|gr|gram|ml)\.?\s*\)\s*$/);
  const trailingGramMatch = workingAscii.match(/^(.*?)\s+(\d+(?:\.\d+)?)\s*(kg|kilo|lt|litre|g|gr|gram|ml)\.?\s*$/);
  const trailingUnitMatch = workingAscii.match(
    new RegExp(`^(.*?)\\s+(?:\\(?\\s*(\\d+(?:\\.\\d+)?)\\s*(${unitRegexGroup})\\b\\.?\\s*\\)?)\\s*$`)
  );

  if (trailingParenMatch && trailingParenMatch[1].trim()) {
    const unit = trailingParenMatch[3];
    const mult = unit === 'kg' || unit === 'kilo' || unit === 'lt' || unit === 'litre' ? 1000 : 1;
    grams = Math.max(1, Math.round(parseFloat(trailingParenMatch[2]) * mult));
    explicitGrams = true;
    trailingExplicit = true;
    quantityLabel = `${grams} ${unit === 'ml' ? 'ml' : 'g'}`;
    workingOrig = workingOrig.replace(/\(\s*\d+(?:[.,]\d+)?\s*(?:kg|kilo|lt|litre|g|gr|gram|ml)\.?\s*\)\s*$/i, '').trim();
    workingAscii = toAsciiTurkishLower(workingOrig);
  } else if (trailingGramMatch && trailingGramMatch[1].trim()) {
    const unit = trailingGramMatch[3];
    const mult = unit === 'kg' || unit === 'kilo' || unit === 'lt' || unit === 'litre' ? 1000 : 1;
    grams = Math.max(1, Math.round(parseFloat(trailingGramMatch[2]) * mult));
    explicitGrams = true;
    trailingExplicit = true;
    quantityLabel = `${grams} ${unit === 'ml' ? 'ml' : 'g'}`;
    workingOrig = workingOrig.replace(/\s+\d+(?:[.,]\d+)?\s*(?:kg|kilo|lt|litre|g|gr|gram|ml)\.?\s*$/i, '').trim();
    workingAscii = toAsciiTurkishLower(workingOrig);
  } else if (trailingUnitMatch && trailingUnitMatch[1].trim()) {
    const qty = parseFloat(trailingUnitMatch[2]);
    const unit = trailingUnitMatch[3];
    const resolved = resolveUnitGramWeight(unit, trailingUnitMatch[1].trim());
    if (qty > 0) {
      grams = Math.max(1, Math.round(qty * resolved.weight));
      explicitGrams = resolved.hasKnownWeight;
      trailingExplicit = resolved.hasKnownWeight;
      quantityCount = qty;
      quantityUnit = unit;
      quantityLabel = `${qty} ${unit}`;
      workingOrig = workingOrig
        .replace(new RegExp(`\\s+(?:\\(?\\s*\\d+(?:[.,]\\d+)?\\s*(?:${unitRegexGroup})\\.?\\s*\\)?)\\s*$`, 'i'), '')
        .trim();
      workingAscii = toAsciiTurkishLower(workingOrig);
    }
  }

  // 2. Baştaki yapışık veya boşluklu miktar/birim kontrolü ("2 adet Haşlanmış Yumurta (100g)" gibi ikili ifadeleri de temizler)
  const gluedGramMatch = workingAscii.match(/^(\d+(?:\.\d+)?)(kg|kilo|lt|litre|g|gr|gram|ml)\.?\s+(.+)$/);
  const leadingMatch = workingAscii.match(
    new RegExp(`^(yarim|ceyrek|\\d+(?:\\.\\d+)?)\\s*(?:(${unitRegexGroup})\\b\\.?)?\\s+(.+)$`)
  );

  if (gluedGramMatch && gluedGramMatch[3].trim()) {
    const unit = gluedGramMatch[2];
    const mult = unit === 'kg' || unit === 'kilo' || unit === 'lt' || unit === 'litre' ? 1000 : 1;
    if (!trailingExplicit) {
      grams = Math.max(1, Math.round(parseFloat(gluedGramMatch[1]) * mult));
      explicitGrams = true;
      quantityLabel = `${grams} ${unit === 'ml' ? 'ml' : 'g'}`;
    }
    workingOrig = workingOrig.replace(/^\d+(?:[.,]\d+)?\s*(?:kg|kilo|lt|litre|g|gr|gram|ml)\.?\s+/i, '').trim();
  } else if (leadingMatch && leadingMatch[3].trim()) {
    const qtyWord = leadingMatch[1];
    const qty = qtyWord === 'yarim' ? 0.5 : qtyWord === 'ceyrek' ? 0.25 : parseFloat(qtyWord);
    const hasExplicitUnit = Boolean(leadingMatch[2]);
    const unit = leadingMatch[2] || 'adet';
    const remainderAscii = leadingMatch[3].trim();

    // "7 Tahıllı Ekmek", "4 Peynirli Pizza" gibi sayı + "-lı/-li/-lu/-lü" sıfatlarını adet sanma
    const isAdjectivePhrase = !hasExplicitUnit && /^\S+(?:li|lu)\s+\S+/.test(remainderAscii);

    if (!isAdjectivePhrase && qty > 0) {
      if (!trailingExplicit) {
        const resolved = resolveUnitGramWeight(unit, remainderAscii);
        grams = Math.max(1, Math.round(qty * resolved.weight));
        explicitGrams = resolved.hasKnownWeight;
        quantityCount = qty;
        quantityUnit = unit;
        quantityLabel = MASS_VOLUME_UNITS.has(unit)
          ? `${grams} ${unit === 'ml' || unit === 'lt' || unit === 'litre' ? 'ml' : 'g'}`
          : resolved.hasKnownWeight
          ? `${qtyWord} ${unit} (~${grams}g)`
          : `${qtyWord} ${unit}`;
      }

      const originalStripped = workingOrig
        .replace(
          /^(?:yar[ıi]m|çeyrek|ceyrek|\d+(?:[.,]\d+)?)\s*(?:(?:su\s+bardağı|su\s+bardagi|çay\s+bardağı|cay\s+bardagi|yemek\s+kaşığı|yemek\s+kasigi|çorba\s+kaşığı|corba\s+kasigi|tatlı\s+kaşığı|tatli\s+kasigi|çay\s+kaşığı|cay\s+kasigi|porsiyon|gram|litre|bardak|fincan|dilim|kepçe|kepce|ölçek|olcek|scoop|paket|tabak|kilo|kupa|adet|tane|kase|avuç|avuc|kutu|diş|dis|gr|ml|kg|lt|yk|tk|ck|g)\.?)?\s+/i,
          ''
        )
        .trim();

      if (originalStripped) {
        workingOrig = originalStripped;
      }
    }
  }

  const normalizedKey = toAsciiTurkishLower(workingOrig)
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    rawText: rawTrimmed,
    cleanName: workingOrig || rawTrimmed,
    normalizedKey,
    grams,
    explicitGrams,
    quantityLabel,
    quantityCount,
    quantityUnit
  };
}

/**
 * Virgül, noktalı virgül, artı, satır veya "ve" ile ayrılmış çoklu öğün metnini parçalar.
 */
export function splitMealDescriptionIntoTokens(text: string): ParsedFoodInput[] {
  const safeDecimals = String(text || '').replace(/(\d),(\d)/g, '$1.$2');
  return safeDecimals
    .split(/[,;+\n]+|\s+ve\s+/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map(parseSingleFoodToken)
    .filter((token) => token.cleanName.length > 0);
}

/**
 * Atwater formülü (4P + 4K + 9Y) ile kalori tutarsızlıklarını normalize eder.
 * Yüksek lifli gıdalarda gerçek kalorinin toplam karbonhidrat * 4 değerinden düşük olmasına izin verir.
 */
export function reconcileAtwaterCalories(
  calories: number,
  protein_g: number,
  carbs_g: number,
  fat_g: number
): number {
  const p = Math.max(0, Number(protein_g) || 0);
  const c = Math.max(0, Number(carbs_g) || 0);
  const f = Math.max(0, Number(fat_g) || 0);
  const kcal = Math.max(0, Number(calories) || 0);
  const atwater = Math.round(p * 4 + c * 4 + f * 9);

  if (kcal <= 0 && atwater > 0) return atwater;
  if (atwater > 0 && kcal > atwater * 1.45) return atwater;
  if (atwater > 0 && c < 15 && kcal < atwater * 0.3) return atwater;
  return Math.round(kcal);
}

/**
 * 100 gramlık profilin fiziksel biyokimya sınırlarında olup olmadığını denetler (max ~900 kcal/100g).
 */
export function isPlausiblePer100g(macros: MacroValues): boolean {
  const totalGrams = (Number(macros.protein_g) || 0) + (Number(macros.carbs_g) || 0) + (Number(macros.fat_g) || 0);
  const cal = Number(macros.calories) || 0;
  return cal >= 0 && cal <= 920 && totalGrams >= 0 && totalGrams <= 105;
}

/**
 * 100 gram bazındaki makro değerlerini hedef gramaja ölçekler.
 */
export function scaleMacrosFrom100g(basePer100g: MacroValues, grams: number): MacroValues {
  const ratio = Math.max(0, grams) / 100;
  const protein_g = Math.round((Number(basePer100g.protein_g) || 0) * ratio * 10) / 10;
  const carbs_g = Math.round((Number(basePer100g.carbs_g) || 0) * ratio * 10) / 10;
  const fat_g = Math.round((Number(basePer100g.fat_g) || 0) * ratio * 10) / 10;
  const rawCalories = Math.round((Number(basePer100g.calories) || 0) * ratio);

  return {
    calories: reconcileAtwaterCalories(rawCalories, protein_g, carbs_g, fat_g),
    protein_g,
    carbs_g,
    fat_g
  };
}

/**
 * Herhangi bir porsiyon makro değerini 100g standardına normalize eder.
 */
export function normalizeTo100g(macros: MacroValues, grams: number): MacroValues {
  const safeGrams = Math.max(1, Number(grams) || 100);
  const ratio = 100 / safeGrams;
  const protein_g = Math.round((Number(macros.protein_g) || 0) * ratio * 10) / 10;
  const carbs_g = Math.round((Number(macros.carbs_g) || 0) * ratio * 10) / 10;
  const fat_g = Math.round((Number(macros.fat_g) || 0) * ratio * 10) / 10;
  const calories = reconcileAtwaterCalories(Math.round((Number(macros.calories) || 0) * ratio), protein_g, carbs_g, fat_g);

  return { calories, protein_g, carbs_g, fat_g };
}

/**
 * `food_nutrient_profiles.categories_data` JSON alanından 100g makro değerlerini okur.
 */
export function extractMacrosFromCategoriesData(
  raw: string | Record<string, any> | null | undefined,
  portionG = 100
): MacroValues | null {
  if (!raw) return null;
  let parsed: Record<string, any>;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  } else {
    parsed = raw;
  }

  if (parsed?.base_per_100g && typeof parsed.base_per_100g === 'object') {
    const b = parsed.base_per_100g;
    const cal = Number(b.calories) || 0;
    const pro = Number(b.protein_g) || 0;
    const carb = Number(b.carbs_g) || 0;
    const fat = Number(b.fat_g) || 0;
    if (cal > 0 || pro > 0 || carb > 0 || fat > 0) {
      return {
        calories: reconcileAtwaterCalories(cal, pro, carb, fat),
        protein_g: Math.round(pro * 10) / 10,
        carbs_g: Math.round(carb * 10) / 10,
        fat_g: Math.round(fat * 10) / 10
      };
    }
  }

  const macroArr: Array<{ label?: string; value?: string }> = Array.isArray(parsed?.macros)
    ? parsed.macros
    : Array.isArray(parsed?.categories?.macros)
    ? parsed.categories.macros
    : [];

  if (macroArr.length === 0) return null;

  const parseNumericValue = (valStr?: string) => {
    const m = String(valStr || '').replace(',', '.').match(/([\d.]+)/);
    return m ? parseFloat(m[1]) : 0;
  };

  let calories = 0;
  let protein_g = 0;
  let carbs_g = 0;
  let fat_g = 0;

  for (const row of macroArr) {
    const label = toAsciiTurkishLower(row.label || '');
    if (label.startsWith('└')) continue;
    const num = parseNumericValue(row.value);
    if (label.includes('enerji') || label.includes('kalori')) calories = num;
    else if (label.includes('protein')) protein_g = num;
    else if (label.includes('karbonhidrat')) carbs_g = num;
    else if (
      label.includes('yag') &&
      !label.includes('doymus') &&
      !label.includes('coklu') &&
      !label.includes('tekli') &&
      !label.includes('trans') &&
      !label.includes('ucucu')
    ) {
      fat_g = num;
    }
  }

  if (calories <= 0 && protein_g <= 0 && carbs_g <= 0 && fat_g <= 0) {
    return null;
  }

  const actualPortion = Number(parsed.portion_g) || Number(portionG) || 100;
  return normalizeTo100g({ calories, protein_g, carbs_g, fat_g }, actualPortion);
}

/**
 * `/api/health/nutrition-profile` ile uyumlu 100g `categories_data` JSON çıktısı üretir.
 * Mevcut kayıtlardaki `vitamins`, `minerals`, `special_compounds` dizilerini korur.
 */
export function buildCategoriesDataJson(
  foodName: string,
  basePer100g: MacroValues,
  badge: string,
  preservedData?: Record<string, any> | null
): string {
  const calories = reconcileAtwaterCalories(
    basePer100g.calories,
    basePer100g.protein_g,
    basePer100g.carbs_g,
    basePer100g.fat_g
  );

  const prevVitamins = Array.isArray(preservedData?.vitamins) ? preservedData.vitamins : [];
  const prevMinerals = Array.isArray(preservedData?.minerals) ? preservedData.minerals : [];
  const prevCompounds = Array.isArray(preservedData?.special_compounds) ? preservedData.special_compounds : [];

  return JSON.stringify({
    food_name: foodName,
    portion_g: 100,
    base_per_100g: {
      calories,
      protein_g: Math.round(basePer100g.protein_g * 10) / 10,
      carbs_g: Math.round(basePer100g.carbs_g * 10) / 10,
      fat_g: Math.round(basePer100g.fat_g * 10) / 10
    },
    macros: [
      { label: 'Enerji (Kalori)', value: `${calories} kcal`, daily_percent: Math.round((calories / 2000) * 100) },
      { label: 'Protein', value: `${Math.round(basePer100g.protein_g * 10) / 10} g`, daily_percent: Math.round((basePer100g.protein_g / 50) * 100) },
      { label: 'Toplam Yağ', value: `${Math.round(basePer100g.fat_g * 10) / 10} g`, daily_percent: Math.round((basePer100g.fat_g / 65) * 100) },
      { label: 'Karbonhidrat', value: `${Math.round(basePer100g.carbs_g * 10) / 10} g`, daily_percent: Math.round((basePer100g.carbs_g / 275) * 100) }
    ],
    vitamins: prevVitamins,
    minerals: prevMinerals,
    special_compounds: prevCompounds,
    source_info:
      prevVitamins.length > 0 || prevMinerals.length > 0
        ? preservedData?.source_info
        : {
            type: 'learned_memory',
            badge,
            confidence: 95,
            reference: 'Singularity Öğrenen Besin Hafızası'
          }
  });
}

function findStaticFoodMatch(normalizedQuery: string): StaticFoodEntry | null {
  if (!normalizedQuery || normalizedQuery.length < 2 || STANDALONE_MODIFIERS.has(normalizedQuery)) {
    return null;
  }

  const hasWord = (word: string) => new RegExp(`\\b${word}\\b`, 'i').test(normalizedQuery);
  const hasPhrase = (phrase: string) => normalizedQuery.includes(phrase);

  for (const entry of CORE_STATIC_FOODS) {
    if (entry.matcher(normalizedQuery, hasWord, hasPhrase)) {
      return entry;
    }
  }
  return null;
}

// Strict çözümleme eşleşmesi: yalnızca hazırlama sıfatı farkına (örn. "yumurta" <-> "haslanmis yumurta") izin verir;
// "badem" ile "badem sutu" veya "yumurta" ile "yumurta aki" çakışmasını engeller.
function isStrictMemoryMatch(tokenKey: string, candidateKey: string): boolean {
  if (!tokenKey || !candidateKey) return false;
  if (tokenKey === candidateKey) return true;

  const tokenWords = tokenKey.split(' ').filter(Boolean);
  const candidateWords = candidateKey.split(' ').filter(Boolean);
  if (tokenWords.length === 0 || candidateWords.length === 0) return false;

  const tokenSet = new Set(tokenWords);
  const candidateSet = new Set(candidateWords);

  const allTokenInCandidate = tokenWords.every((w) => candidateSet.has(w));
  if (allTokenInCandidate && candidateWords.length - tokenWords.length === 1) {
    const extraWords = candidateWords.filter((w) => !tokenSet.has(w));
    return extraWords.every((w) => STANDALONE_MODIFIERS.has(w));
  }

  const allCandidateInToken = candidateWords.every((w) => tokenSet.has(w));
  if (allCandidateInToken && tokenWords.length - candidateWords.length === 1) {
    const extraWords = tokenWords.filter((w) => !candidateSet.has(w));
    return extraWords.every((w) => STANDALONE_MODIFIERS.has(w));
  }

  return false;
}

// Autocomplete (dropdown) eşleşmesi: kullanıcı yazarken geçmişindeki ilgili yemekleri listeler
function isSuggestionMatch(queryKey: string, candidateKey: string): boolean {
  if (!queryKey) return true;
  if (!candidateKey) return false;
  if (candidateKey.includes(queryKey)) return true;

  const queryWords = queryKey.split(' ').filter(Boolean);
  return queryWords.length > 0 && queryWords.every((qw) => candidateKey.includes(qw));
}

interface LoadedMemoryContext {
  mealItems: Array<{
    id: string;
    name: string;
    normalizedKey: string;
    grams: number;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    basePer100g: MacroValues;
    created_at: string;
  }>;
  meals: Array<{
    id: string;
    name: string;
    normalizedKey: string;
    meal_type: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    created_at: string;
  }>;
  learnedProfiles: Array<{
    id: string;
    food_name: string;
    normalizedKey: string;
    basePer100g: MacroValues;
    isOwnUser: boolean;
    updated_at: string;
  }>;
}

async function loadUserMemoryContext(userId: string, familyId?: string | null): Promise<LoadedMemoryContext> {
  const result: LoadedMemoryContext = {
    mealItems: [],
    meals: [],
    learnedProfiles: []
  };

  if (!userId) return result;

  // 1. Kullanıcının / ailenin geçmiş öğünlerini getir
  let rawMeals: any[] = [];
  try {
    const fetchedMeals = await db
      .select()
      .from(nutritionMeals)
      .where(
        or(
          eq(nutritionMeals.user_id, userId),
          familyId ? and(eq(nutritionMeals.family_id, familyId), eq(nutritionMeals.is_family_shared, 1)) : undefined
        )
      )
      .orderBy(desc(nutritionMeals.created_at))
      .limit(150);
    if (Array.isArray(fetchedMeals)) {
      rawMeals = fetchedMeals;
    }
  } catch (err) {
    console.warn('[NutritionMemory] nutritionMeals okuma uyarısı:', err);
  }

  for (const m of rawMeals) {
    result.meals.push({
      id: m.id,
      name: m.name,
      normalizedKey: normalizeFoodKey(m.name),
      meal_type: m.meal_type || 'lunch',
      calories: Number(m.calories) || 0,
      protein_g: Number(m.protein_g) || 0,
      carbs_g: Number(m.carbs_g) || 0,
      fat_g: Number(m.fat_g) || 0,
      created_at: m.created_at || ''
    });
  }

  // 2. Kullanıcının öğünlerine bağlı tekil kalem hafızasını getir (BOLA izoleli)
  const mealIds = rawMeals.map((m) => m.id).filter(Boolean);
  if (mealIds.length > 0) {
    try {
      const rawItems = await db
        .select()
        .from(nutritionMealItems)
        .where(inArray(nutritionMealItems.meal_id, mealIds))
        .orderBy(desc(nutritionMealItems.created_at))
        .limit(300);

      for (const item of Array.isArray(rawItems) ? rawItems : []) {
        const g = Math.max(1, Number(item.grams) || 100);
        const macros: MacroValues = {
          calories: Number(item.calories) || 0,
          protein_g: Number(item.protein_g) || 0,
          carbs_g: Number(item.carbs_g) || 0,
          fat_g: Number(item.fat_g) || 0
        };
        if (macros.calories <= 0 && macros.protein_g <= 0 && macros.carbs_g <= 0 && macros.fat_g <= 0) {
          continue;
        }
        result.mealItems.push({
          id: item.id,
          name: item.name,
          normalizedKey: normalizeFoodKey(item.name),
          grams: g,
          ...macros,
          basePer100g: normalizeTo100g(macros, g),
          created_at: item.created_at || ''
        });
      }
    } catch (err) {
      console.warn('[NutritionMemory] nutritionMealItems okuma uyarısı:', err);
    }
  }

  // 3. Öğrenilen besin profillerini getir (kullanıcının kendi kayıtları öncelikli, ardından genel profiller)
  try {
    const fetchedProfiles = await db
      .select()
      .from(foodNutrientProfiles)
      .where(or(eq(foodNutrientProfiles.user_id, userId), isNull(foodNutrientProfiles.user_id)))
      .orderBy(desc(foodNutrientProfiles.updated_at))
      .limit(300);

    const rawProfiles = Array.isArray(fetchedProfiles) ? [...fetchedProfiles] : [];

    // Kendi kullanıcı profillerini öncele
    rawProfiles.sort((a: any, b: any) => {
      const aOwn = a.user_id === userId ? 1 : 0;
      const bOwn = b.user_id === userId ? 1 : 0;
      if (aOwn !== bOwn) return bOwn - aOwn;
      return String(b.updated_at || '').localeCompare(String(a.updated_at || ''));
    });

    for (const prof of rawProfiles) {
      const base = extractMacrosFromCategoriesData(prof.categories_data, Number(prof.portion_g) || 100);
      if (!base) continue;
      result.learnedProfiles.push({
        id: prof.id,
        food_name: prof.food_name,
        normalizedKey: normalizeFoodKey(prof.food_name),
        basePer100g: base,
        isOwnUser: prof.user_id === userId,
        updated_at: prof.updated_at || ''
      });
    }
  } catch (err) {
    console.warn('[NutritionMemory] foodNutrientProfiles okuma uyarısı:', err);
  }

  return result;
}

/**
 * Yazarken anlık geçmiş & öğrenilen besin önerileri döner (%100 DB/yerel, 0 AI kotası).
 */
export async function searchNutritionMemory({
  userId,
  familyId,
  query,
  limit = 8
}: {
  userId: string;
  familyId?: string | null;
  query: string;
  limit?: number;
}): Promise<MemorySuggestionItem[]> {
  const activeSegment = String(query || '').split(/[,;+\n]+|\s+ve\s+/i).pop() || '';
  const queryKey = normalizeFoodKey(activeSegment);
  const ctx = await loadUserMemoryContext(userId, familyId);
  const suggestions: MemorySuggestionItem[] = [];
  const seenKeys = new Set<string>();

  const pushUnique = (item: MemorySuggestionItem, extraDedupeKey?: string) => {
    if (!item.normalizedKey || seenKeys.has(item.normalizedKey)) return;
    if (extraDedupeKey && seenKeys.has(extraDedupeKey)) return;
    seenKeys.add(item.normalizedKey);
    if (extraDedupeKey) seenKeys.add(extraDedupeKey);
    suggestions.push(item);
  };

  // Kademe 1A: Kullanıcının geçmiş kalemleri (gramajlı kesin veri)
  for (const item of ctx.mealItems) {
    if (item.calories <= 0 && item.protein_g <= 0 && item.carbs_g <= 0 && item.fat_g <= 0) continue;
    if (!isSuggestionMatch(queryKey, item.normalizedKey)) continue;
    pushUnique({
      id: `item-${item.id}`,
      name: item.name,
      normalizedKey: item.normalizedKey,
      defaultGrams: item.grams,
      calories: Math.round(item.calories),
      protein_g: Math.round(item.protein_g * 10) / 10,
      carbs_g: Math.round(item.carbs_g * 10) / 10,
      fat_g: Math.round(item.fat_g * 10) / 10,
      basePer100g: item.basePer100g,
      source: 'user_history_item',
      sourceBadge: '🕒 Geçmiş Kaydınızdan (0 Kota)'
    });
    if (suggestions.length >= limit) return suggestions;
  }

  // Kademe 1B: Kullanıcının geçmiş tekil öğünleri (çoklu birleşik öğün başlıklarını 100g gıda gibi önerme)
  for (const meal of ctx.meals) {
    if (splitMealDescriptionIntoTokens(meal.name).length > 1) continue;
    if (!isSuggestionMatch(queryKey, meal.normalizedKey)) continue;
    if (meal.calories <= 0 && meal.protein_g <= 0 && meal.carbs_g <= 0 && meal.fat_g <= 0) continue;
    const mealMacros: MacroValues = {
      calories: Math.round(meal.calories),
      protein_g: Math.round(meal.protein_g * 10) / 10,
      carbs_g: Math.round(meal.carbs_g * 10) / 10,
      fat_g: Math.round(meal.fat_g * 10) / 10
    };
    const matchedProf = ctx.learnedProfiles.find((p) => p.normalizedKey === meal.normalizedKey);
    pushUnique({
      id: `meal-${meal.id}`,
      name: meal.name,
      normalizedKey: meal.normalizedKey,
      defaultGrams: 100,
      ...mealMacros,
      basePer100g: matchedProf ? matchedProf.basePer100g : mealMacros,
      source: 'user_history_meal',
      sourceBadge: '🕒 Geçmiş Öğününüz (0 Kota)',
      mealType: meal.meal_type
    });
    if (suggestions.length >= limit) return suggestions;
  }

  // Kademe 2: Öğrenilen besin profilleri (100g bazlı)
  for (const prof of ctx.learnedProfiles) {
    if (!isSuggestionMatch(queryKey, prof.normalizedKey)) continue;
    pushUnique({
      id: `prof-${prof.id}`,
      name: prof.food_name,
      normalizedKey: prof.normalizedKey,
      defaultGrams: 100,
      ...prof.basePer100g,
      basePer100g: prof.basePer100g,
      source: 'learned_profile',
      sourceBadge: '📚 Öğrenilen Hafıza (0 Kota)'
    });
    if (suggestions.length >= limit) return suggestions;
  }

  // Kademe 3: Çekirdek TÜRKOMP / USDA sözlüğü
  if (queryKey.length >= 2) {
    for (const entry of CORE_STATIC_FOODS) {
      const entryNameKey = normalizeFoodKey(entry.foodName);
      if (!entryNameKey.includes(queryKey) && !entry.key.includes(queryKey)) continue;
      pushUnique(
        {
          id: `static-${entry.key}`,
          name: entry.foodName,
          normalizedKey: entry.key,
          defaultGrams: 100,
          ...entry.per100g,
          basePer100g: entry.per100g,
          source: 'static_db',
          sourceBadge: '🏛️ TÜRKOMP & USDA (0 Kota)'
        },
        entryNameKey
      );
      if (suggestions.length >= limit) return suggestions;
    }
  }

  return suggestions;
}

/**
 * Bir besinin 100g profilini `food_nutrient_profiles` tablosuna ekler veya günceller.
 * Mevcut kayıtlardaki vitamin/mineral/biyoaktif içerikleri korur ve fiziksel sınır kontrolü uygular.
 */
async function upsertLearnedProfile(
  userId: string,
  foodName: string,
  basePer100g: MacroValues,
  badge = '📚 Öğrenilen Besin Hafızası'
): Promise<void> {
  const cleanName = String(foodName || '').trim();
  const targetKey = normalizeFoodKey(cleanName);
  if (!cleanName || !targetKey) return;
  if (basePer100g.calories <= 0 && basePer100g.protein_g <= 0 && basePer100g.carbs_g <= 0 && basePer100g.fat_g <= 0) {
    return;
  }
  if (!isPlausiblePer100g(basePer100g)) {
    return;
  }

  const now = new Date().toISOString();

  try {
    const existingProfiles = await db
      .select()
      .from(foodNutrientProfiles)
      .where(eq(foodNutrientProfiles.user_id, userId))
      .orderBy(desc(foodNutrientProfiles.updated_at))
      .limit(500);

    const matched = (Array.isArray(existingProfiles) ? existingProfiles : []).find(
      (p: any) => normalizeFoodKey(p.food_name) === targetKey
    );

    let preservedData: Record<string, any> | null = null;
    if (matched?.categories_data) {
      try {
        preservedData = JSON.parse(matched.categories_data);
      } catch {
        preservedData = null;
      }
    }

    const categoriesData = buildCategoriesDataJson(cleanName, basePer100g, badge, preservedData);

    if (matched) {
      await db
        .update(foodNutrientProfiles)
        .set({
          food_name: matched.food_name || cleanName,
          portion_g: 100,
          categories_data: categoriesData,
          updated_at: now
        })
        .where(eq(foodNutrientProfiles.id, matched.id));
    } else {
      await db.insert(foodNutrientProfiles).values({
        id: `profile-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        food_name: cleanName,
        portion_g: 100,
        categories_data: categoriesData,
        created_at: now,
        updated_at: now,
        user_id: userId
      });
    }
  } catch (err) {
    console.warn('[NutritionMemory] foodNutrientProfiles upsert uyarısı:', err);
  }
}

function toGeminiResolvedEntry(aiItem: any) {
  const protein = Math.max(0, Number(aiItem?.per_100g_protein_g) || 0);
  const carbs = Math.max(0, Number(aiItem?.per_100g_carbs_g) || 0);
  const fat = Math.max(0, Number(aiItem?.per_100g_fat_g) || 0);
  const calories = reconcileAtwaterCalories(Number(aiItem?.per_100g_calories) || 0, protein, carbs, fat);

  if (calories <= 0 && protein <= 0 && carbs <= 0 && fat <= 0) return null;

  const basePer100g: MacroValues = {
    calories,
    protein_g: Math.round(protein * 10) / 10,
    carbs_g: Math.round(carbs * 10) / 10,
    fat_g: Math.round(fat * 10) / 10
  };
  if (!isPlausiblePer100g(basePer100g)) return null;

  return {
    displayName: aiItem.display_name ? String(aiItem.display_name).trim() : undefined,
    grams: Math.max(1, Math.round(Number(aiItem.estimated_grams) || 100)),
    basePer100g
  };
}

async function fetchUnknownFoodsFromGemini(
  tokens: ParsedFoodInput[]
): Promise<Map<string, { grams: number; basePer100g: MacroValues; displayName?: string }>> {
  const resolvedMap = new Map<string, { grams: number; basePer100g: MacroValues; displayName?: string }>();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || tokens.length === 0) return resolvedMap;

  // Tekrarlı bilinmeyen kalemleri ("1 lahmacun, 1 lahmacun") AI isteğinde tekilleştir
  const uniqueTokens: ParsedFoodInput[] = [];
  const seenKeys = new Set<string>();
  for (const t of tokens) {
    if (!seenKeys.has(t.normalizedKey)) {
      seenKeys.add(t.normalizedKey);
      uniqueTokens.push(t);
    }
  }

  const itemsListText = uniqueTokens
    .map((t, idx) => {
      const gramHint = t.explicitGrams
        ? `${t.grams} gram`
        : t.quantityCount && t.quantityUnit
        ? `belirtilen miktar: "${t.quantityLabel}" — toplam gerçek gramajı hesapla`
        : 'belirtilmedi - standart 1 porsiyon gramajı tahmin et';
      return `${idx + 1}. "${t.rawText}" (anahtar: "${t.cleanName}", ${gramHint})`;
    })
    .join('\n');

  const promptText = `Sen uzman bir klinik diyetisyen ve TÜRKOMP / USDA gıda analiz motorusun.
Aşağıdaki besinlerin hem 100 gram bazındaki makro değerlerini hem de standart/belirtilen gramaj bilgisini çıkar:
${itemsListText}

KURALLAR:
1. "input_name" alanı yukarıda verilen anahtar metinle birebir aynı olmalıdır.
2. Tüm makro alanlarını sayı (number) olarak ver; bilmediğin uydurma değer üretme.
3. "estimated_grams" kullanıcı miktar ("5 adet" vb.) belirttiyse o miktarın toplam gramı, belirtmediyse 1 standart porsiyonun gramıdır.
4. "per_100g" her zaman 100 gram ürünün besin değeridir.

SADECE aşağıdaki JSON formatında yanıt ver:
{
  "items": [
    {
      "input_name": "örnek ürün",
      "display_name": "Örnek Ürün (Temiz Türkçe Ad)",
      "estimated_grams": 100,
      "per_100g_calories": 150,
      "per_100g_protein_g": 12.0,
      "per_100g_carbs_g": 10.0,
      "per_100g_fat_g": 6.5
    }
  ]
}`;

  for (const modelName of RESILIENT_GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.1
            }
          })
        }
      );

      if (!res.ok) continue;

      const json = await res.json();
      const textOutput = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textOutput) continue;

      const cleanJson = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      const aiItems: any[] = Array.isArray(parsed?.items) ? parsed.items : [];

      for (const aiItem of aiItems) {
        const key = normalizeFoodKey(aiItem.input_name || aiItem.display_name || '');
        if (!key) continue;
        const entry = toGeminiResolvedEntry(aiItem);
        if (entry) resolvedMap.set(key, entry);
      }

      if (aiItems.length === uniqueTokens.length) {
        for (let tIdx = 0; tIdx < uniqueTokens.length; tIdx++) {
          const tKey = uniqueTokens[tIdx].normalizedKey;
          if (!resolvedMap.has(tKey) && aiItems[tIdx]) {
            const entry = toGeminiResolvedEntry(aiItems[tIdx]);
            if (entry) resolvedMap.set(tKey, entry);
          }
        }
      }

      if (resolvedMap.size > 0) break;
    } catch (err) {
      console.warn(`[NutritionMemory] Gemini (${modelName}) çözümleme hatası:`, err);
    }
  }

  return resolvedMap;
}

const MAX_MEAL_TOKENS = 15;

/**
 * 4 Kademeli Sıfır Kota Arama Zinciri:
 * 1. Kullanıcının geçmiş kalemleri ve öğünleri (`nutrition_meal_items` -> `nutrition_meals`)
 * 2. Öğrenilen besin profilleri (`food_nutrient_profiles`)
 * 3. Yerel TÜRKOMP / USDA çekirdek sözlüğü (`CORE_STATIC_FOODS`)
 * 4. Yalnızca bilinmeyen kalemler için tek toplu Gemini AI isteği (Onaysız DB yazımı yapılmaz)
 */
export async function resolveMealTextWithMemory({
  userId,
  familyId,
  text
}: {
  userId: string;
  familyId?: string | null;
  text: string;
}): Promise<MealResolutionResult> {
  const tokens = splitMealDescriptionIntoTokens(text).slice(0, MAX_MEAL_TOKENS);
  if (tokens.length === 0) {
    return {
      items: [],
      total: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, grams: 0 },
      quotaUsedCount: 0,
      memoryHitCount: 0
    };
  }

  const ctx = await loadUserMemoryContext(userId, familyId);
  const resolvedByIndex = new Array<ResolvedFoodItem | null>(tokens.length).fill(null);
  const unresolvedIndices: number[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // Kademe 1A: Kullanıcının geçmiş öğün kalemi (`nutrition_meal_items`)
    const matchedItem = ctx.mealItems.find(
      (item) =>
        (item.calories > 0 || item.protein_g > 0 || item.carbs_g > 0 || item.fat_g > 0) &&
        isStrictMemoryMatch(token.normalizedKey, item.normalizedKey)
    );
    if (matchedItem) {
      if (!token.explicitGrams) {
        const useCount = token.quantityCount && token.quantityCount > 0 ? token.quantityCount : 1;
        const targetGrams = Math.max(1, Math.round(matchedItem.grams * useCount));
        const scaled = useCount === 1
          ? {
              calories: Math.round(matchedItem.calories),
              protein_g: Math.round(matchedItem.protein_g * 10) / 10,
              carbs_g: Math.round(matchedItem.carbs_g * 10) / 10,
              fat_g: Math.round(matchedItem.fat_g * 10) / 10
            }
          : scaleMacrosFrom100g(matchedItem.basePer100g, targetGrams);
        resolvedByIndex[i] = {
          name: matchedItem.name,
          normalizedKey: matchedItem.normalizedKey,
          grams: targetGrams,
          ...scaled,
          basePer100g: matchedItem.basePer100g,
          source: 'user_history_item',
          sourceBadge: '🕒 Geçmiş Kaydınızdan (0 Kota)',
          quotaUsed: false
        };
      } else {
        const scaled = scaleMacrosFrom100g(matchedItem.basePer100g, token.grams);
        resolvedByIndex[i] = {
          name: token.cleanName,
          normalizedKey: matchedItem.normalizedKey,
          grams: token.grams,
          ...scaled,
          basePer100g: matchedItem.basePer100g,
          source: 'user_history_item',
          sourceBadge: '🕒 Geçmiş Kaydınızdan (0 Kota)',
          quotaUsed: false
        };
      }
      continue;
    }

    // Kademe 1B: Kullanıcının geçmiş tekil öğünü (`nutrition_meals`)
    const matchedMeal = ctx.meals.find(
      (meal) =>
        splitMealDescriptionIntoTokens(meal.name).length === 1 &&
        isStrictMemoryMatch(token.normalizedKey, meal.normalizedKey) &&
        (meal.calories > 0 || meal.protein_g > 0 || meal.carbs_g > 0 || meal.fat_g > 0)
    );
    const matchedProfile = ctx.learnedProfiles.find((prof) =>
      isStrictMemoryMatch(token.normalizedKey, prof.normalizedKey)
    );

    if (matchedMeal && !token.explicitGrams) {
      const mealMacros: MacroValues = {
        calories: Math.round(matchedMeal.calories),
        protein_g: Math.round(matchedMeal.protein_g * 10) / 10,
        carbs_g: Math.round(matchedMeal.carbs_g * 10) / 10,
        fat_g: Math.round(matchedMeal.fat_g * 10) / 10
      };
      resolvedByIndex[i] = {
        name: matchedMeal.name,
        normalizedKey: matchedMeal.normalizedKey,
        grams: 100,
        ...mealMacros,
        basePer100g: matchedProfile ? matchedProfile.basePer100g : mealMacros,
        source: 'user_history_meal',
        sourceBadge: '🕒 Geçmiş Öğününüz (0 Kota)',
        quotaUsed: false
      };
      continue;
    }

    // Kademe 2: Öğrenilen Besin Profilleri (`food_nutrient_profiles`, 100g bazlı)
    if (matchedProfile) {
      const targetGrams = token.grams;
      const scaled = scaleMacrosFrom100g(matchedProfile.basePer100g, targetGrams);
      resolvedByIndex[i] = {
        name: token.explicitGrams ? token.cleanName : matchedProfile.food_name,
        normalizedKey: matchedProfile.normalizedKey,
        grams: targetGrams,
        ...scaled,
        basePer100g: matchedProfile.basePer100g,
        source: 'learned_profile',
        sourceBadge: '📚 Öğrenilen Hafıza (0 Kota)',
        quotaUsed: false
      };
      continue;
    }

    // Kademe 1B Fallback: Eski `nutrition_meals` kaydı var ama `learnedProfiles` yoksa gramaja oranla (0 Kota)
    if (matchedMeal && token.explicitGrams) {
      const mealBase: MacroValues = {
        calories: Math.round(matchedMeal.calories),
        protein_g: Math.round(matchedMeal.protein_g * 10) / 10,
        carbs_g: Math.round(matchedMeal.carbs_g * 10) / 10,
        fat_g: Math.round(matchedMeal.fat_g * 10) / 10
      };
      const scaled = scaleMacrosFrom100g(mealBase, token.grams);
      resolvedByIndex[i] = {
        name: token.cleanName || matchedMeal.name,
        normalizedKey: matchedMeal.normalizedKey,
        grams: token.grams,
        ...scaled,
        basePer100g: mealBase,
        source: 'user_history_meal',
        sourceBadge: '🕒 Geçmiş Öğününüz (0 Kota)',
        quotaUsed: false
      };
      continue;
    }

    // Kademe 3: Yerel TÜRKOMP / USDA Sözlüğü (`CORE_STATIC_FOODS`)
    const matchedStatic = findStaticFoodMatch(token.normalizedKey);
    if (matchedStatic) {
      const scaled = scaleMacrosFrom100g(matchedStatic.per100g, token.grams);
      resolvedByIndex[i] = {
        name: token.cleanName,
        normalizedKey: matchedStatic.key,
        grams: token.grams,
        ...scaled,
        basePer100g: matchedStatic.per100g,
        source: 'static_db',
        sourceBadge: '🏛️ TÜRKOMP & USDA (0 Kota)',
        quotaUsed: false
      };
      continue;
    }

    unresolvedIndices.push(i);
  }

  // Kademe 4: Yalnızca hafızada olmayan yeni kalemler için tek toplu AI çağrısı
  // (AI Data Shield gereği kullanıcı formu kaydetmeden DB'ye yazılmaz)
  let quotaUsedCount = 0;
  if (unresolvedIndices.length > 0) {
    const unknownTokens = unresolvedIndices.map((idx) => tokens[idx]);
    const aiMap = await fetchUnknownFoodsFromGemini(unknownTokens);

    for (const idx of unresolvedIndices) {
      const token = tokens[idx];
      const aiData = aiMap.get(token.normalizedKey);

      if (aiData) {
        quotaUsedCount += 1;
        const targetGrams = token.explicitGrams ? token.grams : aiData.grams;
        const scaled = scaleMacrosFrom100g(aiData.basePer100g, targetGrams);
        const finalName = token.cleanName || aiData.displayName || token.rawText;

        resolvedByIndex[idx] = {
          name: finalName,
          normalizedKey: token.normalizedKey,
          grams: targetGrams,
          ...scaled,
          basePer100g: aiData.basePer100g,
          source: 'ai_estimated',
          sourceBadge: '🤖 AI Tahmini (Onay Bekliyor)',
          quotaUsed: true
        };
      } else {
        resolvedByIndex[idx] = {
          name: token.cleanName,
          normalizedKey: token.normalizedKey,
          grams: token.grams,
          calories: 0,
          protein_g: 0,
          carbs_g: 0,
          fat_g: 0,
          basePer100g: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
          source: 'manual_required',
          sourceBadge: '✍️ Manuel Giriş Gerekli',
          quotaUsed: false
        };
      }
    }
  }

  const finalItems = resolvedByIndex.filter((item): item is ResolvedFoodItem => item !== null);
  const memoryHitCount = finalItems.filter((item) => !item.quotaUsed && item.source !== 'manual_required').length;

  const total = finalItems.reduce(
    (acc, item) => ({
      calories: Math.round(acc.calories + item.calories),
      protein_g: Math.round((acc.protein_g + item.protein_g) * 10) / 10,
      carbs_g: Math.round((acc.carbs_g + item.carbs_g) * 10) / 10,
      fat_g: Math.round((acc.fat_g + item.fat_g) * 10) / 10,
      grams: Math.round(acc.grams + item.grams)
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, grams: 0 }
  );

  return {
    items: finalItems,
    total,
    quotaUsedCount,
    memoryHitCount
  };
}

/**
 * Kullanıcı öğünü onaylayıp kaydettiğinde (`POST /api/health/nutrition`):
 * 1. Makrosu > 0 olan alt kalemleri `nutrition_meal_items` tablosuna yazar.
 * 2. Tekil besinleri 100g bazında `food_nutrient_profiles` tablosuna kalıcı olarak öğretir.
 */
export async function learnFromSavedMeal({
  userId,
  mealId,
  mealName,
  totalCalories,
  totalProteinG,
  totalCarbsG,
  totalFatG,
  defaultGrams,
  items
}: {
  userId: string;
  mealId: string;
  mealName: string;
  totalCalories: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;
  defaultGrams?: number;
  items?: LearnItemInput[];
}): Promise<void> {
  if (!userId || !mealId) return;

  const now = new Date().toISOString();
  const validItems = Array.isArray(items)
    ? items.filter((it) => it && String(it.name || '').trim().length > 0)
    : [];

  const parsedSingleMeal = parseSingleFoodToken(mealName);
  const hasExplicitDefaultGrams =
    defaultGrams !== undefined && defaultGrams !== null && Number.isFinite(Number(defaultGrams)) && Number(defaultGrams) > 0;
  const singleGrams = hasExplicitDefaultGrams
    ? Math.max(1, Number(defaultGrams))
    : parsedSingleMeal.explicitGrams
    ? parsedSingleMeal.grams
    : 100;
  const singleName = hasExplicitDefaultGrams
    ? String(mealName || 'Öğün').trim()
    : parsedSingleMeal.cleanName || String(mealName || 'Öğün').trim();

  const isCompositeSingle = validItems.length === 0 && splitMealDescriptionIntoTokens(mealName).length > 1;
  if (isCompositeSingle) {
    // Çoklu serbest metni tekil 100g besin gibi kaydetme (hafıza zehirlenmesini önle)
    return;
  }

  const itemsToPersist: Array<{
    name: string;
    grams: number;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }> =
    validItems.length > 0
      ? validItems.map((it) => {
          const parsedItem = parseSingleFoodToken(String(it.name));
          const hasExplicitItemGrams =
            it.grams !== undefined && it.grams !== null && Number.isFinite(Number(it.grams)) && Number(it.grams) > 0;
          const itemGrams = hasExplicitItemGrams
            ? Math.max(1, Number(it.grams))
            : parsedItem.explicitGrams
            ? parsedItem.grams
            : 100;
          return {
            name: parsedItem.cleanName || String(it.name).trim(),
            grams: itemGrams,
            calories: Math.max(0, Number(it.calories) || 0),
            protein_g: Math.max(0, Number(it.protein_g) || 0),
            carbs_g: Math.max(0, Number(it.carbs_g) || 0),
            fat_g: Math.max(0, Number(it.fat_g) || 0)
          };
        })
      : [
          {
            name: singleName,
            grams: singleGrams,
            calories: Math.max(0, Number(totalCalories) || 0),
            protein_g: Math.max(0, Number(totalProteinG) || 0),
            carbs_g: Math.max(0, Number(totalCarbsG) || 0),
            fat_g: Math.max(0, Number(totalFatG) || 0)
          }
        ];

  for (const item of itemsToPersist) {
    if (item.calories <= 0 && item.protein_g <= 0 && item.carbs_g <= 0 && item.fat_g <= 0) {
      continue;
    }

    const cleanProfileName = hasExplicitDefaultGrams && validItems.length === 0
      ? item.name
      : parseSingleFoodToken(item.name).cleanName || item.name;

    try {
      await db.insert(nutritionMealItems).values({
        id: `mitem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        meal_id: mealId,
        name: cleanProfileName,
        grams: item.grams,
        calories: item.calories,
        protein_g: item.protein_g,
        carbs_g: item.carbs_g,
        fat_g: item.fat_g,
        created_at: now,
        updated_at: now
      });
    } catch (err) {
      console.warn('[NutritionMemory] nutritionMealItems insert uyarısı:', err);
    }

    if (splitMealDescriptionIntoTokens(cleanProfileName).length > 1) {
      continue;
    }

    const basePer100g = normalizeTo100g(
      {
        calories: item.calories,
        protein_g: item.protein_g,
        carbs_g: item.carbs_g,
        fat_g: item.fat_g
      },
      item.grams
    );

    await upsertLearnedProfile(
      userId,
      cleanProfileName,
      basePer100g,
      '🕒 Kullanıcı Kaydından Öğrenildi'
    );
  }
}

export interface HealthMemberScope {
  authorized: boolean;
  memberId: string | null;
  isPrimarySelf: boolean;
}

/**
 * Opsiyonel `member_id` parametresi için kullanıcı/aile erişim yetkisini (OWASP BOLA) doğrular.
 * `requestedMemberId` verilmemişse ekstra DB sorgusu yapmadan tüm hane kapsamını döndürür.
 */
export async function resolveOptionalHealthMemberScope(
  userId: string,
  familyId: string | null,
  requestedMemberId?: string | null
): Promise<HealthMemberScope> {
  const cleanRequested =
    typeof requestedMemberId === 'string' && requestedMemberId.trim() && requestedMemberId.trim() !== 'all'
      ? requestedMemberId.trim()
      : null;

  if (!cleanRequested) {
    return { authorized: true, memberId: null, isPrimarySelf: true };
  }

  try {
    const found = await db
      .select({ id: familyMembers.id, user_id: familyMembers.user_id })
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.id, cleanRequested),
          or(
            eq(familyMembers.user_id, userId),
            familyId ? eq(familyMembers.family_id, familyId) : undefined
          )
        )
      )
      .limit(1);

    if (Array.isArray(found) && found.length > 0) {
      return {
        authorized: true,
        memberId: found[0].id,
        isPrimarySelf: found[0].user_id === userId,
      };
    }
  } catch {
    return { authorized: false, memberId: null, isPrimarySelf: false };
  }

  return { authorized: false, memberId: null, isPrimarySelf: false };
}

/**
 * İstekle gelen `member_id` değerinin kullanıcının kendi ailesine ait olduğunu (BOLA) doğrular.
 * `requestedMemberId` verilmemişse aktif kullanıcı/aile üyesini döner.
 */
export async function resolveAuthorizedMemberId(
  userId: string,
  familyId: string | null,
  requestedMemberId?: string | null
): Promise<{ memberId: string | null; authorized: boolean }> {
  const cleanRequested = typeof requestedMemberId === 'string' && requestedMemberId.trim()
    ? requestedMemberId.trim()
    : null;

  if (cleanRequested) {
    try {
      const found = await db
        .select({ id: familyMembers.id })
        .from(familyMembers)
        .where(
          and(
            eq(familyMembers.id, cleanRequested),
            or(
              eq(familyMembers.user_id, userId),
              familyId ? eq(familyMembers.family_id, familyId) : undefined
            )
          )
        )
        .limit(1);

      if (Array.isArray(found) && found.length > 0) {
        return { memberId: found[0].id, authorized: true };
      }
    } catch {
      return { memberId: null, authorized: false };
    }
    return { memberId: null, authorized: false };
  }

  try {
    const member =
      (await db.select().from(familyMembers).where(and(eq(familyMembers.is_active, 1), eq(familyMembers.user_id, userId))).limit(1))[0] ||
      (familyId
        ? (await db.select().from(familyMembers).where(and(eq(familyMembers.is_active, 1), eq(familyMembers.family_id, familyId))).limit(1))[0]
        : null);
    return { memberId: member?.id || null, authorized: true };
  } catch {
    return { memberId: null, authorized: true };
  }
}
