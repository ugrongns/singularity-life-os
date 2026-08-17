import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { foodNutrientProfiles } from '@/db/schema';
import { getAuthUser } from '@/lib/auth';
import { eq, ilike } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const queryFood = searchParams.get('food_name') || searchParams.get('query') || 'Ceviz';
    const grams = Number(searchParams.get('grams')) || 100;

    // Dahili Standart TÜRKOMP & USDA Referans Portföyü (Anında 2ms Yanıt)
    const STATIC_PROFILES: Record<string, any> = {
      ceviz: {
        food_name: "Çiğ Kuru İç Ceviz",
        portion_g: 100,
        macros: [
          { label: "Enerji (Kalori)", value: "654 kcal", daily_percent: 33 },
          { label: "Toplam Yağ", value: "65.2 g", daily_percent: 100 },
          { label: "└ Çoklu Doymamış Yağ", value: "47.1 g", daily_percent: null },
          { label: "└ Omega-3 (ALA)", value: "9.1 g", daily_percent: 600 },
          { label: "└ Tekli Doymamış Yağ", value: "8.9 g", daily_percent: null },
          { label: "└ Doymuş Yağ", value: "6.1 g", daily_percent: 30 },
          { label: "Karbonhidrat", value: "13.7 g", daily_percent: 5 },
          { label: "└ Diyet Lifi", value: "6.7 g", daily_percent: 27 },
          { label: "└ Doğal Şekerler", value: "2.6 g", daily_percent: null },
          { label: "Protein", value: "15.2 g", daily_percent: 30 },
          { label: "Su", value: "4.0 g", daily_percent: null }
        ],
        vitamins: [
          { label: "B6 Vitamini", value: "0.54 mg", daily_percent: 32 },
          { label: "Folat (B9 Vitamini)", value: "98 mcg", daily_percent: 25 },
          { label: "E Vitamini", value: "0.70 mg", daily_percent: 5 },
          { label: "Tiamin (B1 Vitamini)", value: "0.34 mg", daily_percent: 28 },
          { label: "Riboflavin (B2 Vitamini)", value: "0.15 mg", daily_percent: 12 },
          { label: "C Vitamini", value: "1.3 mg", daily_percent: 2 }
        ],
        minerals: [
          { label: "Manganez", value: "3.4 mg", daily_percent: 150 },
          { label: "Bakır", value: "1.6 mg", daily_percent: 170 },
          { label: "Magnezyum", value: "158 mg", daily_percent: 40 },
          { label: "Fosfor", value: "346 mg", daily_percent: 35 },
          { label: "Demir", value: "2.9 mg", daily_percent: 16 },
          { label: "Çinko", value: "3.1 mg", daily_percent: 28 },
          { label: "Potasyum", value: "441 mg", daily_percent: 9 },
          { label: "Kalsiyum", value: "98 mg", daily_percent: 10 },
          { label: "Sodyum", value: "2 mg", daily_percent: 0 }
        ],
        special_compounds: [
          { label: "Polifenoller / Antioksidanlar (Ellagik Asit)", value: "Yüksek", daily_percent: null },
          { label: "Kolin", value: "39.2 mg", daily_percent: 7 }
        ]
      },
      somon: {
        food_name: "Taze Somon Balığı (Izgara)",
        portion_g: 100,
        macros: [
          { label: "Enerji (Kalori)", value: "206 kcal", daily_percent: 10 },
          { label: "Toplam Yağ", value: "12.3 g", daily_percent: 19 },
          { label: "└ Omega-3 (EPA & DHA)", value: "2.3 g", daily_percent: 150 },
          { label: "Protein", value: "22.1 g", daily_percent: 44 }
        ],
        vitamins: [
          { label: "D Vitamini", value: "11.0 mcg", daily_percent: 73 },
          { label: "B12 Vitamini", value: "3.2 mcg", daily_percent: 133 },
          { label: "Niasin (B3 Vitamini)", value: "8.5 mg", daily_percent: 53 },
          { label: "B6 Vitamini", value: "0.6 mg", daily_percent: 35 }
        ],
        minerals: [
          { label: "Selenyum", value: "36.5 mcg", daily_percent: 66 },
          { label: "Fosfor", value: "252 mg", daily_percent: 25 },
          { label: "Potasyum", value: "384 mg", daily_percent: 8 }
        ],
        special_compounds: [
          { label: "Astaksantin (Pembe Karotenoid Antioksidan)", value: "0.4 mg", daily_percent: null }
        ]
      }
    };

    const cleanQueryKey = queryFood.toLowerCase().trim();
    if (STATIC_PROFILES[cleanQueryKey]) {
      const baseProf = STATIC_PROFILES[cleanQueryKey];
      return NextResponse.json({
        success: true,
        data: {
          food_name: baseProf.food_name,
          portion_g: grams,
          categories: scaleNutrientData(baseProf, grams)
        }
      });
    }

    try { initDatabase(); } catch (e) {}

    // 1. Veritabanından güvenli sorgula
    try {
      const existing = await db.select().from(foodNutrientProfiles).where(ilike(foodNutrientProfiles.food_name, `%${queryFood}%`)).limit(1);
      if (existing.length > 0) {
        const profile = existing[0];
        const categoriesData = JSON.parse(profile.categories_data || '{}');
        return NextResponse.json({
          success: true,
          data: {
            food_name: profile.food_name,
            portion_g: grams,
            categories: scaleNutrientData(categoriesData, grams)
          }
        });
      }
    } catch (e) {
      console.warn('[Nutrient Profile DB Lookup Warning]:', e);
    }

    // 2. Veritabanında yoksa TÜRKOMP / USDA & Gemini AI ile sorgula
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'Gemini API key missing' }, { status: 500 });
    }

    const promptText = `Sen uzman bir gıda mühendisi, biyo-kimyager ve diyetisyensin.
TÜRKOMP (Türkiye Gıda Bileşim Veritabanı) ve USDA (ABD Tarım Bakanlığı) resmi verilerine göre "${grams} gram ${queryFood}" için TÜM MAKRO VE MİKRO BESİN DEĞERLERİNİ çıkar.

SADECE aşağıdaki esnek JSON formatında yanıt ver:
{
  "food_name": "Tam Gıda Adı (Örn: Çiğ Kuru İç Ceviz)",
  "portion_g": ${grams},
  "macros": [
    {"label": "Enerji (Kalori)", "value": "654 kcal", "daily_percent": 33},
    {"label": "Toplam Yağ", "value": "65.2 g", "daily_percent": 100},
    {"label": "└ Çoklu Doymamış Yağ", "value": "47.1 g", "daily_percent": null},
    {"label": "└ Omega-3 (ALA)", "value": "9.1 g", "daily_percent": 600},
    {"label": "└ Tekli Doymamış Yağ", "value": "8.9 g", "daily_percent": null},
    {"label": "└ Doymuş Yağ", "value": "6.1 g", "daily_percent": 30},
    {"label": "Karbonhidrat", "value": "13.7 g", "daily_percent": 5},
    {"label": "└ Diyet Lifi", "value": "6.7 g", "daily_percent": 27},
    {"label": "└ Doğal Şekerler", "value": "2.6 g", "daily_percent": null},
    {"label": "Protein", "value": "15.2 g", "daily_percent": 30},
    {"label": "Su", "value": "4.0 g", "daily_percent": null}
  ],
  "vitamins": [
    {"label": "B6 Vitamini", "value": "0.54 mg", "daily_percent": 32},
    {"label": "Folat (B9 Vitamini)", "value": "98 mcg", "daily_percent": 25},
    {"label": "E Vitamini", "value": "0.70 mg", "daily_percent": 5},
    {"label": "Tiamin (B1 Vitamini)", "value": "0.34 mg", "daily_percent": 28},
    {"label": "Riboflavin (B2 Vitamini)", "value": "0.15 mg", "daily_percent": 12},
    {"label": "C Vitamini", "value": "1.3 mg", "daily_percent": 2}
  ],
  "minerals": [
    {"label": "Manganez", "value": "3.4 mg", "daily_percent": 150},
    {"label": "Bakır", "value": "1.6 mg", "daily_percent": 170},
    {"label": "Magnezyum", "value": "158 mg", "daily_percent": 40},
    {"label": "Fosfor", "value": "346 mg", "daily_percent": 35},
    {"label": "Demir", "value": "2.9 mg", "daily_percent": 16},
    {"label": "Çinko", "value": "3.1 mg", "daily_percent": 28},
    {"label": "Potasyum", "value": "441 mg", "daily_percent": 9},
    {"label": "Kalsiyum", "value": "98 mg", "daily_percent": 10},
    {"label": "Sodyum", "value": "2 mg", "daily_percent": 0}
  ],
  "special_compounds": [
    {"label": "Polifenoller / Antioksidanlar (Ellagik Asit)", "value": "Yüksek", "daily_percent": null},
    {"label": "Kolin", "value": "39.2 mg", "daily_percent": 7}
  ]
}`;

    const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
      })
    });

    const aiData = await aiRes.json();
    const textOutput = aiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textOutput) {
      return NextResponse.json({ success: false, error: 'AI profil üretemedi.' }, { status: 500 });
    }

    const cleanJson = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    // DB'ye kaydet (ileride hızlı çekmek için)
    const now = new Date().toISOString();
    const profileId = `profile-${Date.now()}`;
    await db.insert(foodNutrientProfiles).values({
      id: profileId,
      food_name: parsed.food_name || queryFood,
      portion_g: grams,
      categories_data: JSON.stringify(parsed),
      created_at: now,
      updated_at: now,
      user_id: user?.id || null
    });

    return NextResponse.json({
      success: true,
      data: {
        food_name: parsed.food_name,
        portion_g: grams,
        categories: parsed
      }
    });
  } catch (error: any) {
    console.error('Nutrition Profile API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

function scaleNutrientData(data: any, targetGrams: number) {
  // Porsiyon oranına göre ölçeklendir
  if (!data || data.portion_g === targetGrams) return data;
  const ratio = targetGrams / (data.portion_g || 100);

  const scaled = { ...data, portion_g: targetGrams };

  ['macros', 'vitamins', 'minerals', 'special_compounds'].forEach(catKey => {
    if (Array.isArray(scaled[catKey])) {
      scaled[catKey] = scaled[catKey].map((item: any) => {
        let valStr = item.value || '';
        let numMatch = valStr.match(/([\d.]+)/);
        if (numMatch) {
          const num = parseFloat(numMatch[1]);
          const newNum = Math.round(num * ratio * 10) / 10;
          valStr = valStr.replace(numMatch[1], newNum.toString());
        }
        let dailyPct = item.daily_percent;
        if (typeof dailyPct === 'number') {
          dailyPct = Math.round(dailyPct * ratio);
        }
        return { ...item, value: valStr, daily_percent: dailyPct };
      });
    }
  });

  return scaled;
}
