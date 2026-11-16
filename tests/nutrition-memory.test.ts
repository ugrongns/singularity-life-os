import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const {
  mockGetAuthUser,
  mockInsertedMeals,
  mockInsertedMealItems,
  mockInsertedProfiles,
  mockUpdatedProfiles,
  mockDeletedTables,
  mockWhereArgs,
  state
} = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockInsertedMeals: [] as any[],
  mockInsertedMealItems: [] as any[],
  mockInsertedProfiles: [] as any[],
  mockUpdatedProfiles: [] as any[],
  mockDeletedTables: [] as any[],
  mockWhereArgs: [] as Array<{ table: string; expr: any }>,
  state: {
    meals: [] as any[],
    mealItems: [] as any[],
    profiles: [] as any[],
    familyMembers: [] as any[]
  }
}));

import { nutritionMeals, nutritionMealItems, foodNutrientProfiles, familyMembers } from '../src/db/schema';

vi.mock('@/lib/auth', () => ({
  getAuthUser: mockGetAuthUser
}));

vi.mock('@/db', () => {
  const select = vi.fn(() => {
    let selectedRows: any[] = [];
    let currentTableName = 'unknown';
    const chain: any = {
      from: vi.fn((table: any) => {
        if (table === nutritionMeals) {
          currentTableName = 'nutrition_meals';
          selectedRows = state.meals;
        } else if (table === nutritionMealItems) {
          currentTableName = 'nutrition_meal_items';
          selectedRows = state.mealItems;
        } else if (table === foodNutrientProfiles) {
          currentTableName = 'food_nutrient_profiles';
          selectedRows = state.profiles;
        } else if (table === familyMembers) {
          currentTableName = 'family_members';
          selectedRows = state.familyMembers;
        } else {
          selectedRows = [];
        }
        return chain;
      }),
      where: vi.fn((expr: any) => {
        mockWhereArgs.push({ table: currentTableName, expr });
        return chain;
      }),
      orderBy: vi.fn(() => chain),
      limit: vi.fn(() => Promise.resolve(selectedRows)),
      then: (resolve: any, reject?: any) => Promise.resolve(selectedRows).then(resolve, reject)
    };
    return chain;
  });

  const insert = vi.fn((table: any) => ({
    values: vi.fn((vals: any) => {
      if (table === nutritionMeals) mockInsertedMeals.push(vals);
      if (table === nutritionMealItems) mockInsertedMealItems.push(vals);
      if (table === foodNutrientProfiles) mockInsertedProfiles.push(vals);
      return Promise.resolve([vals]);
    })
  }));

  const update = vi.fn((table: any) => ({
    set: vi.fn((vals: any) => ({
      where: vi.fn(() => {
        if (table === foodNutrientProfiles) mockUpdatedProfiles.push(vals);
        return Promise.resolve([]);
      })
    }))
  }));

  const del = vi.fn((table: any) => ({
    where: vi.fn(() => {
      if (table === nutritionMealItems) mockDeletedTables.push('nutrition_meal_items');
      else if (table === nutritionMeals) mockDeletedTables.push('nutrition_meals');
      return Promise.resolve([]);
    })
  }));

  return {
    initDatabase: vi.fn().mockResolvedValue(undefined),
    db: { select, insert, update, delete: del }
  };
});

import {
  normalizeFoodKey,
  parseSingleFoodToken,
  splitMealDescriptionIntoTokens,
  reconcileAtwaterCalories,
  isPlausiblePer100g,
  resolveMealTextWithMemory,
  searchNutritionMemory,
  learnFromSavedMeal,
  buildCategoriesDataJson
} from '../src/lib/nutrition-memory';
import { GET as lookupGet, POST as lookupPost } from '../src/app/api/health/nutrition/lookup/route';
import { GET as nutritionGet, POST as nutritionPost, DELETE as nutritionDelete } from '../src/app/api/health/nutrition/route';
import { GET as nutritionProfileGet } from '../src/app/api/health/nutrition-profile/route';

function serializeDrizzleExpr(node: any): string {
  const seen = new WeakSet();
  try {
    return JSON.stringify(node, (_key, val) => {
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) return '[Circular]';
        seen.add(val);
      }
      return val;
    });
  } catch {
    return String(node);
  }
}

describe('🧠 Singularity Öğrenen Besin Hafızası & Sıfır Kota Çözümleme Motoru', () => {
  const originalGeminiKey = process.env.GEMINI_API_KEY;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    state.meals = [];
    state.mealItems = [];
    state.profiles = [];
    state.familyMembers = [];
    mockInsertedMeals.length = 0;
    mockInsertedMealItems.length = 0;
    mockInsertedProfiles.length = 0;
    mockUpdatedProfiles.length = 0;
    mockDeletedTables.length = 0;
    mockWhereArgs.length = 0;
    mockGetAuthUser.mockResolvedValue({ id: 'usr-1', family_id: 'fam-1', role: 'admin' });
    process.env.GEMINI_API_KEY = '';
  });

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalGeminiKey;
    global.fetch = originalFetch;
  });

  describe('1. Türkçe İsim Normalizasyonu ve Doğal Dil Porsiyon Ayrıştırma', () => {
    it('Türkçe büyük/küçük harfleri ve hem baştaki hem sondaki miktar öneklerini doğru normalize eder', () => {
      expect(normalizeFoodKey('İZGARA TAVUK GÖĞSÜ')).toBe('izgara tavuk gogsu');
      expect(normalizeFoodKey('2 adet Haşlanmış Yumurta')).toBe('haslanmis yumurta');
      expect(normalizeFoodKey('150g Kırmızı Mercimek Çorbası')).toBe('kirmizi mercimek corbasi');
      expect(normalizeFoodKey('Izgara Somon (180g)')).toBe('izgara somon');

      // Hem baş hem sonda birim bulunan ifadeleri temizlemeli
      const bothSides = parseSingleFoodToken('2 adet Haşlanmış Yumurta (100g)');
      expect(bothSides.cleanName).toBe('Haşlanmış Yumurta');
      expect(bothSides.normalizedKey).toBe('haslanmis yumurta');
      expect(bothSides.grams).toBe(100);
      expect(bothSides.explicitGrams).toBe(true);
    });

    it('Türkçe ölçü birimlerini, çorba kaşığı/diş/fincan birimlerini ve sıfat istisnalarını doğru işler', () => {
      const eggs = parseSingleFoodToken('2 adet yumurta');
      expect(eggs.cleanName).toBe('yumurta');
      expect(eggs.grams).toBe(100); // 2 * 50g
      expect(eggs.explicitGrams).toBe(true);

      const avo = parseSingleFoodToken('yarım avokado');
      expect(avo.cleanName).toBe('avokado');
      expect(avo.grams).toBe(75); // 0.5 * 150g
      expect(avo.explicitGrams).toBe(true);

      const oliveOil = parseSingleFoodToken('2 yemek kaşığı zeytinyağı');
      expect(oliveOil.cleanName).toBe('zeytinyağı');
      expect(oliveOil.grams).toBe(20); // 2 * 10g
      expect(oliveOil.explicitGrams).toBe(true);

      const dottedGram = parseSingleFoodToken('150 gr. tavuk');
      expect(dottedGram.cleanName).toBe('tavuk');
      expect(dottedGram.grams).toBe(150);

      const dottedYk = parseSingleFoodToken('2 yk. zeytinyağı');
      expect(dottedYk.cleanName).toBe('zeytinyağı');
      expect(dottedYk.grams).toBe(20);

      const soupSpoon = parseSingleFoodToken('1 çorba kaşığı fıstık ezmesi');
      expect(soupSpoon.cleanName).toBe('fıstık ezmesi');
      expect(soupSpoon.grams).toBe(16);

      const garlic = parseSingleFoodToken('2 diş sarımsak');
      expect(garlic.cleanName).toBe('sarımsak');
      expect(garlic.grams).toBe(10);

      // Alt-dize çakışması olmamalı ("zeytinli poğaça" -> 4g zeytin olmamalı!)
      const pogaca = parseSingleFoodToken('1 adet zeytinli poğaça');
      expect(pogaca.cleanName).toBe('zeytinli poğaça');
      expect(pogaca.grams).not.toBe(4);
      expect(pogaca.explicitGrams).toBe(false);

      const baklava = parseSingleFoodToken('2 adet cevizli baklava');
      expect(baklava.cleanName).toBe('cevizli baklava');
      expect(baklava.grams).not.toBe(10);
      expect(baklava.explicitGrams).toBe(false);

      // Sıfat olan baştaki sayı adet sanılmamalı ("7 Tahıllı Ekmek")
      const grainBread = parseSingleFoodToken('7 Tahıllı Ekmek');
      expect(grainBread.cleanName).toBe('7 Tahıllı Ekmek');
      expect(grainBread.grams).toBe(100);
      expect(grainBread.explicitGrams).toBe(false);
    });

    it('Virgüllü ondalıkları bozmadan çoklu öğün metnini parçalar', () => {
      const tokens = splitMealDescriptionIntoTokens('1,5 kase yulaf, 2 adet yumurta ve 150g somon');
      expect(tokens).toHaveLength(3);
      expect(tokens[0].normalizedKey).toBe('yulaf');
      expect(tokens[0].grams).toBe(90); // 1.5 * 60g
      expect(tokens[1].normalizedKey).toBe('yumurta');
      expect(tokens[1].grams).toBe(100);
      expect(tokens[2].normalizedKey).toBe('somon');
      expect(tokens[2].grams).toBe(150);
    });

    it('Atwater kuralını uçuk sapmalarda düzeltir, yüksek lifli gıdalarda gerçek kaloriyi korur', () => {
      expect(reconcileAtwaterCalories(0, 20, 30, 10)).toBe(290); // 80 + 120 + 90
      expect(reconcileAtwaterCalories(900, 20, 30, 10)).toBe(290); // > 1.45x -> düzeltilir
      expect(reconcileAtwaterCalories(300, 20, 30, 10)).toBe(300); // tolerans içi
      // Yüksek lifli ham kakao tozu (228 kcal, 19.6P, 57.9K [37g lif], 13.7Y) -> atwater=433 olsa bile 228 korunmalı
      expect(reconcileAtwaterCalories(228, 19.6, 57.9, 13.7)).toBe(228);
      // Fiziksel 100g sınırı
      expect(isPlausiblePer100g({ calories: 884, protein_g: 0, carbs_g: 0, fat_g: 100 })).toBe(true);
      expect(isPlausiblePer100g({ calories: 1472, protein_g: 15, carbs_g: 160, fat_g: 80 })).toBe(false);
    });
  });

  describe('2. Sıfır Kota Arama Zinciri (Geçmişten Çekme, Çakışma Koruması & AI Data Shield)', () => {
    it('Kullanıcının geçmiş öğün kalemini (nutrition_meal_items) Gemini API çağırmadan getirir', async () => {
      state.meals = [
        { id: 'meal-prev-1', user_id: 'usr-1', name: 'Mercimek Çorbası', meal_type: 'lunch', calories: 220, protein_g: 14, carbs_g: 32, fat_g: 4, created_at: '2026-11-10T12:00:00Z' }
      ];
      state.mealItems = [
        { id: 'mi-1', meal_id: 'meal-prev-1', name: 'Ev Yapımı Mercimek Çorbası', grams: 250, calories: 220, protein_g: 14, carbs_g: 32, fat_g: 4, created_at: '2026-11-10T12:00:00Z' }
      ];

      const fetchSpy = vi.fn();
      global.fetch = fetchSpy as any;
      process.env.GEMINI_API_KEY = 'test-key-should-not-be-used';

      const result = await resolveMealTextWithMemory({
        userId: 'usr-1',
        familyId: 'fam-1',
        text: 'Ev Yapımı Mercimek Çorbası'
      });

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(result.quotaUsedCount).toBe(0);
      expect(result.memoryHitCount).toBe(1);
      expect(result.items[0].source).toBe('user_history_item');
      expect(result.items[0].grams).toBe(250);
      expect(result.items[0].calories).toBe(220);
      expect(result.items[0].protein_g).toBe(14);
    });

    it('Öğrenilen besin profilini (food_nutrient_profiles) yeni istenen gramaja doğru ölçekler (0 Kota)', async () => {
      state.profiles = [
        {
          id: 'prof-1',
          user_id: 'usr-1',
          food_name: 'Hindi Füme',
          portion_g: 100,
          categories_data: buildCategoriesDataJson(
            'Hindi Füme',
            { calories: 110, protein_g: 22, carbs_g: 1.5, fat_g: 1.8 },
            '📚 Öğrenilen Hafıza'
          ),
          updated_at: '2026-11-11T10:00:00Z'
        }
      ];

      const fetchSpy = vi.fn();
      global.fetch = fetchSpy as any;
      process.env.GEMINI_API_KEY = 'test-key';

      const result = await resolveMealTextWithMemory({
        userId: 'usr-1',
        familyId: 'fam-1',
        text: '200g Hindi Füme'
      });

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(result.quotaUsedCount).toBe(0);
      expect(result.items[0].source).toBe('learned_profile');
      expect(result.items[0].grams).toBe(200);
      expect(result.items[0].calories).toBe(220);
      expect(result.items[0].protein_g).toBe(44);
      expect(result.items[0].carbs_g).toBe(3);
      expect(result.items[0].fat_g).toBe(3.6);
    });

    it('Çift yönlü yanlış eşleşme engellenir ("Badem" != "Badem Sütü", "Yumurta Akı" != "2 adet Yumurta")', async () => {
      state.profiles = [
        {
          id: 'prof-badem',
          user_id: 'usr-1',
          food_name: 'Badem',
          portion_g: 100,
          categories_data: buildCategoriesDataJson('Badem', { calories: 579, protein_g: 21, carbs_g: 21, fat_g: 50 }, '📚'),
          updated_at: '2026-11-12T10:00:00Z'
        },
        {
          id: 'prof-yumurta-aki',
          user_id: 'usr-1',
          food_name: 'Yumurta Akı',
          portion_g: 100,
          categories_data: buildCategoriesDataJson('Yumurta Akı', { calories: 52, protein_g: 11, carbs_g: 0.7, fat_g: 0.2 }, '📚'),
          updated_at: '2026-11-12T10:00:00Z'
        }
      ];

      process.env.GEMINI_API_KEY = '';

      // Badem Sütü Badem profiliyle eşleşmemeli -> manual_required
      const bademSutuRes = await resolveMealTextWithMemory({
        userId: 'usr-1',
        familyId: 'fam-1',
        text: '200ml Badem Sütü'
      });
      expect(bademSutuRes.items[0].source).toBe('manual_required');
      expect(bademSutuRes.items[0].calories).toBe(0);

      // "2 adet Yumurta" Yumurta Akı ile değil Kademe 3 bütün yumurtayla (155 kcal) eşleşmeli!
      const yumurtaRes = await resolveMealTextWithMemory({
        userId: 'usr-1',
        familyId: 'fam-1',
        text: '2 adet Yumurta'
      });
      expect(yumurtaRes.items[0].source).toBe('static_db');
      expect(yumurtaRes.items[0].calories).toBe(155);
    });

    it('Kademe 1A 0 kcal kayıtları zehirlenmesini önler ve eski nutrition_meals kaydını gramajla oranlar', async () => {
      state.meals = [
        { id: 'm-zero', user_id: 'usr-1', name: 'Ev Yapımı Kısır', meal_type: 'lunch', calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, created_at: '2026-11-14T12:00:00Z' },
        { id: 'm-legacy', user_id: 'usr-1', name: 'Özel Ev Tarifi Çorba', meal_type: 'dinner', calories: 160, protein_g: 8, carbs_g: 20, fat_g: 5, created_at: '2026-10-01T18:00:00Z' }
      ];
      state.mealItems = [
        { id: 'mi-zero', meal_id: 'm-zero', name: 'Ev Yapımı Kısır', grams: 150, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, created_at: '2026-11-14T12:00:00Z' }
      ];

      const fetchSpy = vi.fn();
      global.fetch = fetchSpy as any;
      process.env.GEMINI_API_KEY = '';

      // 0 kcal zehirli öğe önerilmemeli / Kademe 1A olarak dönmemeli
      const suggestions = await searchNutritionMemory({ userId: 'usr-1', familyId: 'fam-1', query: 'kısır' });
      expect(suggestions).toHaveLength(0);

      // Eski nutrition_meals kaydı 150g için oranlanmalı
      const legacyRes = await resolveMealTextWithMemory({
        userId: 'usr-1',
        familyId: 'fam-1',
        text: '150g Özel Ev Tarifi Çorba'
      });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(legacyRes.quotaUsedCount).toBe(0);
      expect(legacyRes.items[0].source).toBe('user_history_meal');
      expect(legacyRes.items[0].grams).toBe(150);
      expect(legacyRes.items[0].calories).toBe(240);
      expect(legacyRes.items[0].protein_g).toBe(12);
    });

    it('Karma sorguda yalnızca bilinmeyen kalemi Gemini AI ile çözer ve Anayasa Madde 2.2 gereği onay öncesi DB yazmaz', async () => {
      state.profiles = [
        {
          id: 'prof-known',
          user_id: 'usr-1',
          food_name: 'Izgara Köfte',
          portion_g: 100,
          categories_data: buildCategoriesDataJson(
            'Izgara Köfte',
            { calories: 230, protein_g: 20, carbs_g: 4, fat_g: 15 },
            '📚 Öğrenilen Hafıza'
          ),
          updated_at: '2026-11-12T10:00:00Z'
        }
      ];

      process.env.GEMINI_API_KEY = 'test-gemini-key';
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      items: [
                        {
                          input_name: 'ejder meyvesi',
                          display_name: 'Ejder Meyvesi (Pitaya)',
                          estimated_grams: 150,
                          per_100g_calories: 50,
                          per_100g_protein_g: 1.1,
                          per_100g_carbs_g: 11.0,
                          per_100g_fat_g: 0.4
                        }
                      ]
                    })
                  }
                ]
              }
            }
          ]
        })
      });
      global.fetch = fetchSpy as any;

      // Yinelenen bilinmeyen kalem tek AI satırına indirilmeli
      const result = await resolveMealTextWithMemory({
        userId: 'usr-1',
        familyId: 'fam-1',
        text: '100g Izgara Köfte, 150g Ejder Meyvesi, 150g Ejder Meyvesi'
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const sentBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      const prompt = sentBody.contents[0].parts[0].text;
      expect(prompt.toLowerCase()).toContain('ejder meyvesi');
      expect(prompt.toLowerCase()).not.toContain('izgara köfte');

      expect(result.memoryHitCount).toBe(1);
      expect(result.quotaUsedCount).toBe(2);
      expect(result.items).toHaveLength(3);
      expect(result.items[0].source).toBe('learned_profile');
      expect(result.items[1].source).toBe('ai_estimated');
      expect(result.items[1].calories).toBe(75); // 150g * 50 / 100

      // Anayasa Madde 2.2: Kullanıcı formu onaylayıp kaydetmeden foodNutrientProfiles'a yazılmamalı!
      expect(mockInsertedProfiles).toHaveLength(0);
    });

    it('AI erişilemezse bilinmeyen ürün için asla sahte kalori üretmez (dürüst 0 döner)', async () => {
      process.env.GEMINI_API_KEY = '';

      const result = await resolveMealTextWithMemory({
        userId: 'usr-1',
        familyId: 'fam-1',
        text: '150g Bambaşka Egzotik Yemek'
      });

      expect(result.quotaUsedCount).toBe(0);
      expect(result.items[0].source).toBe('manual_required');
      expect(result.items[0].calories).toBe(0);
      expect(result.items[0].protein_g).toBe(0);
    });
  });

  describe('3. Öğün Kaydedildiğinde Kalıcı Öğrenme (Self-Learning Write-Back & Mikro-Besin Koruması)', () => {
    it('learnFromSavedMeal hem nutrition_meal_items hem de 100g normalize food_nutrient_profiles kaydı oluşturur', async () => {
      await learnFromSavedMeal({
        userId: 'usr-1',
        mealId: 'meal-999',
        mealName: '200g Ev Yapımı Tavuk Sote',
        totalCalories: 320,
        totalProteinG: 40,
        totalCarbsG: 10,
        totalFatG: 12
      });

      expect(mockInsertedMealItems).toHaveLength(1);
      expect(mockInsertedMealItems[0].meal_id).toBe('meal-999');
      expect(mockInsertedMealItems[0].name).toBe('Ev Yapımı Tavuk Sote');
      expect(mockInsertedMealItems[0].grams).toBe(200);
      expect(mockInsertedMealItems[0].calories).toBe(320);

      expect(mockInsertedProfiles).toHaveLength(1);
      expect(mockInsertedProfiles[0].food_name).toBe('Ev Yapımı Tavuk Sote');
      expect(mockInsertedProfiles[0].portion_g).toBe(100);
      const savedCategories = JSON.parse(mockInsertedProfiles[0].categories_data);
      expect(savedCategories.base_per_100g.calories).toBe(160);
      expect(savedCategories.base_per_100g.protein_g).toBe(20);
      expect(savedCategories.base_per_100g.carbs_g).toBe(5);
      expect(savedCategories.base_per_100g.fat_g).toBe(6);
    });

    it('Barkod kaydında ("Gofret 36g", explicit grams: 100) 100g değerleri 100/36 ile şişirmez ve çoklu öğünleri tekil 100g profile yazmaz', async () => {
      await learnFromSavedMeal({
        userId: 'usr-1',
        mealId: 'meal-barcode',
        mealName: 'Ülker Çikolatalı Gofret 36g',
        totalCalories: 530,
        totalProteinG: 6.2,
        totalCarbsG: 56,
        totalFatG: 31,
        defaultGrams: 100
      });

      expect(mockInsertedProfiles).toHaveLength(1);
      const learned = JSON.parse(mockInsertedProfiles[0].categories_data);
      expect(learned.base_per_100g.calories).toBe(530); // 1472'ye şişirilmemeli!

      // Çoklu serbest metin tekil 100g besin profili olarak öğrenilmemeli
      mockInsertedProfiles.length = 0;
      await learnFromSavedMeal({
        userId: 'usr-1',
        mealId: 'meal-combo',
        mealName: 'Izgara Köfte, Bulgur Pilavı, Haydari ve Ayran',
        totalCalories: 980,
        totalProteinG: 52,
        totalCarbsG: 80,
        totalFatG: 48
      });
      expect(mockInsertedProfiles).toHaveLength(0);
    });

    it('Var olan 360° vitamin/mineral profilini güncellerken vitamins/minerals/special_compounds alanlarını korur', async () => {
      state.profiles = [
        {
          id: 'prof-zerdecal',
          user_id: 'usr-1',
          food_name: 'Zerdeçal',
          portion_g: 100,
          categories_data: JSON.stringify({
            food_name: 'Zerdeçal',
            portion_g: 100,
            macros: [
              { label: 'Enerji (Kalori)', value: '312 kcal', daily_percent: 16 },
              { label: 'Protein', value: '9.7 g', daily_percent: 19 },
              { label: 'Toplam Yağ', value: '3.3 g', daily_percent: 5 },
              { label: 'Karbonhidrat', value: '67.1 g', daily_percent: 24 }
            ],
            vitamins: [{ label: 'B6 Vitamini', value: '1.8 mg', daily_percent: 106 }],
            minerals: [{ label: 'Demir', value: '55 mg', daily_percent: 306 }],
            special_compounds: [{ label: 'Kurkuminoidler', value: '3.1 g', daily_percent: null }],
            source_info: { type: 'ai_grounded', badge: '🧬 Gemini AI', confidence: 95 }
          }),
          updated_at: '2026-11-01T10:00:00Z'
        }
      ];

      await learnFromSavedMeal({
        userId: 'usr-1',
        mealId: 'meal-zerdecal',
        mealName: 'Zerdeçal',
        totalCalories: 31,
        totalProteinG: 1,
        totalCarbsG: 6.7,
        totalFatG: 0.3,
        defaultGrams: 10
      });

      expect(mockUpdatedProfiles).toHaveLength(1);
      const updated = JSON.parse(mockUpdatedProfiles[0].categories_data);
      expect(updated.vitamins).toHaveLength(1);
      expect(updated.minerals).toHaveLength(1);
      expect(updated.special_compounds).toHaveLength(1);
    });

    it('0 makrolu öğün kalemini nutrition_meal_items tablosuna yazmaz', async () => {
      await learnFromSavedMeal({
        userId: 'usr-1',
        mealId: 'meal-empty-item',
        mealName: 'Karışık Öğün',
        totalCalories: 155,
        totalProteinG: 13,
        totalCarbsG: 1.1,
        totalFatG: 11,
        items: [
          { name: 'Haşlanmış Yumurta', grams: 100, calories: 155, protein_g: 13, carbs_g: 1.1, fat_g: 11 },
          { name: 'Bilinmeyen Kalem', grams: 100, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
        ]
      });

      expect(mockInsertedMealItems).toHaveLength(1);
      expect(mockInsertedMealItems[0].name).toBe('Haşlanmış Yumurta');
    });
  });

  describe('4. Lookup, Nutrition ve Nutrition-Profile API Güvenlik (BOLA) Doğrulamaları', () => {
    it('Oturumsuz GET/POST isteklerine 401 döner', async () => {
      mockGetAuthUser.mockResolvedValueOnce(null);
      expect((await lookupGet(new Request('http://localhost/api/health/nutrition/lookup?q=yumurta'))).status).toBe(401);

      mockGetAuthUser.mockResolvedValueOnce(null);
      expect(
        (
          await lookupPost(
            new Request('http://localhost/api/health/nutrition/lookup', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: 'yumurta' })
            })
          )
        ).status
      ).toBe(401);

      mockGetAuthUser.mockResolvedValueOnce(null);
      expect((await nutritionGet(new Request('http://localhost/api/health/nutrition'))).status).toBe(401);
    });

    it('POST /api/health/nutrition/lookup boş metinde ve 500 karakter üstü girdide 400 validation hatası döner', async () => {
      const emptyRes = await lookupPost(
        new Request('http://localhost/api/health/nutrition/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: '   ' })
        })
      );
      expect(emptyRes.status).toBe(400);

      const tooLongRes = await lookupPost(
        new Request('http://localhost/api/health/nutrition/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: 'a'.repeat(501) })
        })
      );
      expect(tooLongRes.status).toBe(400);
    });

    it('GET /api/health/nutrition/lookup 0 kota ile mükerrer statik öneri üretmez', async () => {
      state.mealItems = [
        { id: 'mi-1', meal_id: 'm-1', name: 'Kırmızı Mercimek Çorbası', grams: 250, calories: 180, protein_g: 11.2, carbs_g: 25.5, fat_g: 3.8, created_at: '2026-11-15T08:00:00Z' }
      ];
      state.meals = [
        { id: 'm-1', user_id: 'usr-1', name: 'Kırmızı Mercimek Çorbası', meal_type: 'lunch', calories: 180, protein_g: 11.2, carbs_g: 25.5, fat_g: 3.8, created_at: '2026-11-15T08:00:00Z' }
      ];

      const fetchSpy = vi.fn();
      global.fetch = fetchSpy as any;

      const res = await lookupGet(new Request('http://localhost/api/health/nutrition/lookup?q=mercimek'));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.quotaUsed).toBe(false);
      // Aynı ürün hem history hem static olarak iki kez çıkmamalı
      const corbaCount = json.data.suggestions.filter((s: any) => normalizeFoodKey(s.name) === 'kirmizi mercimek corbasi').length;
      expect(corbaCount).toBe(1);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('POST /api/health/nutrition başka ailenin member_id değerini 403 ile reddeder', async () => {
      state.familyMembers = []; // fam-1 içinde eşleşen üye yok
      const res = await nutritionPost(
        new Request('http://localhost/api/health/nutrition', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add_meal',
            name: 'Tavuk',
            member_id: 'mem-other-family',
            calories: 165,
            protein_g: 31,
            carbs_g: 0,
            fat_g: 3.6
          })
        })
      );
      expect(res.status).toBe(403);
      expect(mockInsertedMeals).toHaveLength(0);
    });

    it('GET /api/health/nutrition-profile food_nutrient_profiles sorgusunda BOLA (user_id / isNull) filtresi uygular ve başka kullanıcının kaydını sızdırmaz', async () => {
      state.profiles = [
        {
          id: 'prof-other',
          user_id: 'usr-attacker',
          food_name: 'Gizli Tarif',
          portion_g: 100,
          categories_data: buildCategoriesDataJson('Gizli Tarif', { calories: 500, protein_g: 20, carbs_g: 50, fat_g: 22 }, '📚'),
          updated_at: '2026-11-15T08:00:00Z'
        }
      ];

      process.env.GEMINI_API_KEY = '';
      const res = await nutritionProfileGet(new Request('http://localhost/api/health/nutrition-profile?food_name=Gizli+Tarif'));
      const json = await res.json();

      expect(res.status).toBe(200);
      // WHERE ifadesi kesinlikle user_id ve usr-1 bilgisini içermeli
      const profileWhere = mockWhereArgs.find((w) => w.table === 'food_nutrient_profiles');
      expect(profileWhere).toBeDefined();
      const exprDump = serializeDrizzleExpr(profileWhere?.expr);
      expect(exprDump).toContain('usr-1');

      // Güvenlik: API handler user_id === 'usr-1' || !user_id kontrolü yaptığı için usr-attacker kaydı sızmamalı
      expect(json.data.source_info.type).toBe('low_confidence');
    });

    it('Küçük gramajlı besin kaydında ondalık makro hassasiyetini korur ve öğün silerken önce alt kalemleri temizler', async () => {
      const postRes = await nutritionPost(
        new Request('http://localhost/api/health/nutrition', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add_meal',
            name: 'Çiğ Badem',
            meal_type: 'snack',
            grams: 12,
            calories: 70,
            protein_g: 2.5,
            carbs_g: 2.6,
            fat_g: 6.0
          })
        })
      );
      expect(postRes.status).toBe(200);
      expect(mockInsertedMeals[0].protein_g).toBe(2.5);
      const learned = JSON.parse(mockInsertedProfiles[0].categories_data);
      expect(learned.base_per_100g.protein_g).toBe(20.8);

      state.meals = [{ id: 'meal-to-del', user_id: 'usr-1' }];
      const delRes = await nutritionDelete(new Request('http://localhost/api/health/nutrition?id=meal-to-del', { method: 'DELETE' }));
      expect(delRes.status).toBe(200);
      expect(mockDeletedTables).toEqual(['nutrition_meal_items', 'nutrition_meals']);
    });
  });
});
