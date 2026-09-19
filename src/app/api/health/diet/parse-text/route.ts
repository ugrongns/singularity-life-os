import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

interface ParsedDietText {
  title: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  description: string;
  checklist: string[];
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }

    const body = await req.json();
    const rawText = body.text?.trim();

    if (!rawText) {
      return NextResponse.json({ success: false, error: 'Lütfen diyetisyen metnini girin.' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      try {
        const promptText = `Sen uzman bir diyetisyen, klinik beslenme uzmanı ve gıda veritabanı analistisin.
Aşağıda verilen diyetisyen mesajını veya öğün notunu analiz et:
"${rawText}"

GÖREVLERİN:
1. Öğün için kısa, şık bir başlık belirle (ör. "2 Haşlanmış Yumurtalı Kahvaltı", "Izgara Somonlu Akşam Menüsü").
2. Öğün tipini belirle: "breakfast", "lunch", "dinner" veya "snack".
3. Kısa bir açıklama yaz (1 cümle).
4. Öğündeki tüm malzemeleri ve porsiyonları tek tek ayıran bir kontrol listesi (checklist) dizisi oluştur (ör. ["2 adet haşlanmış yumurta", "5 adet az tuzlu siyah zeytin", "1 dilim tam buğday ekmeği", "30g lor peyniri", "Bol yeşillik (roka, maydanoz)"]).
5. Malzemelerin gramaj ve porsiyonlarına göre TÜRKİYE gıda verilerine uygun toplam besin değerlerini tahmin et:
   - calories (kcal - sayı)
   - protein_g (gram - sayı)
   - carbs_g (gram - sayı)
   - fat_g (gram - sayı)

SADECE aşağıdaki JSON formatında çıktı üret, başka hiçbir açıklama yazma:
{
  "title": "Öğün Başlığı",
  "meal_type": "breakfast",
  "description": "Kısa açıklama",
  "checklist": ["1. malzeme", "2. malzeme"],
  "calories": 420,
  "protein_g": 24,
  "carbs_g": 35,
  "fat_g": 18
}`;

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [{ text: promptText }]
                }
              ],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.2
              }
            })
          }
        );

        if (geminiRes.ok) {
          const jsonResult = await geminiRes.json();
          const textOutput = jsonResult.candidates?.[0]?.content?.parts?.[0]?.text;
          if (textOutput) {
            const cleanJson = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            return NextResponse.json({
              success: true,
              data: {
                title: parsed.title || 'Diyetisyen Öğünü',
                meal_type: ['breakfast', 'lunch', 'dinner', 'snack'].includes(parsed.meal_type) ? parsed.meal_type : 'breakfast',
                description: parsed.description || 'Diyetisyen planından aktarıldı',
                checklist: Array.isArray(parsed.checklist) ? parsed.checklist : [rawText],
                calories: Number(parsed.calories) || 0,
                protein_g: Number(parsed.protein_g) || 0,
                carbs_g: Number(parsed.carbs_g) || 0,
                fat_g: Number(parsed.fat_g) || 0
              }
            });
          }
        }
      } catch (aiErr) {
        console.error('Gemini Diet Parser Error:', aiErr);
      }
    }

    // Fallback: Basit Kural Tabanlı Ayrıştırıcı
    const lines = rawText
      .split(/[\n,;•\-\*]+/)
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 2);

    let mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' = 'breakfast';
    const lower = rawText.toLowerCase();
    if (lower.includes('öğle') || lower.includes('ogle')) mealType = 'lunch';
    else if (lower.includes('akşam') || lower.includes('aksam')) mealType = 'dinner';
    else if (lower.includes('ara') || lower.includes('atıştırma') || lower.includes('atistirma')) mealType = 'snack';

    return NextResponse.json({
      success: true,
      data: {
        title: `${lines[0] || 'Diyetisyen Öğün Alternatifi'}`,
        meal_type: mealType,
        description: 'Diyetisyen metninden ayrıştırıldı',
        checklist: lines.length > 0 ? lines : [rawText],
        calories: 350,
        protein_g: 18,
        carbs_g: 30,
        fat_g: 12
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
