import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { packagedFoodScans } from '@/db/schema';
import { desc, eq, or, and, ilike } from 'drizzle-orm';
import { parsePlateImage, parsePackagedFoodImage } from '@/lib/ai-vision';
import { getAuthUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }

    const scans = await db.select().from(packagedFoodScans)
      .where(eq(packagedFoodScans.user_id, user.id))
      .orderBy(desc(packagedFoodScans.created_at))
      .limit(10);
    return NextResponse.json({ success: true, data: scans });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }
    const body = await req.json();
    const { type = 'plate', base64, mimeType = 'image/jpeg', barcode_text } = body;

    if (type === 'plate') {
      if (!base64) {
        return NextResponse.json({
          success: false,
          error: 'Lütfen analiz edilecek bir tabak fotoğrafı yükleyin.'
        }, { status: 400 });
      }

      const plateData = await parsePlateImage(base64, mimeType);
      return NextResponse.json({
        success: true,
        data: plateData,
        message: `🍽️ ${plateData.name} tabağı analiz edildi! (${plateData.base_calories} kcal, %${Math.round(plateData.confidence * 100)} güven)`
      });
    } else if (type === 'packaged_barcode') {
      // Paketli Gıda Barkod & Pestisit / Katkı Maddesi Analizi
      let foodAnalysis: any = null;

      if (base64) {
        foodAnalysis = await parsePackagedFoodImage(base64, mimeType);
      } else {
        const barcode = barcode_text ? barcode_text.trim() : '';
        if (!barcode) {
          return NextResponse.json({ success: false, error: 'Barkod numarası veya görsel sağlanmalıdır.' }, { status: 400 });
        }

        // 1. Open Food Facts API Sorgulaması
        try {
          const offRes = await fetch(`https://tr.openfoodfacts.org/api/v2/product/${barcode}.json`, {
            headers: { 'User-Agent': 'SingularityLifeOS/1.0' }
          });
          if (offRes.ok) {
            const offData = await offRes.json();
            if (offData.status === 1 && offData.product) {
              const p = offData.product;
              const productName = p.product_name_tr || p.product_name || `Barkodlu Ürün (${barcode})`;
              const brand = p.brands || 'Genel';
              const additives = p.additives_tags ? p.additives_tags.map((t: string) => t.replace('en:', '')).join(', ').toUpperCase() : '';
              const novaScore = p.nova_group || 3;
              const nutriscore = p.nutriscore_grade ? p.nutriscore_grade.toUpperCase() : 'C';

              let healthScore = 70;
              let riskLevel = 'clean';
              if (novaScore === 4 || nutriscore === 'E' || nutriscore === 'D') {
                healthScore = 40;
                riskLevel = 'high_risk';
              } else if (novaScore === 3 || nutriscore === 'C') {
                healthScore = 65;
                riskLevel = 'moderate';
              } else {
                healthScore = 88;
                riskLevel = 'clean';
              }

              const nutriments = p.nutriments || {};
              const calories100g = Number(nutriments['energy-kcal_100g'] ?? nutriments['energy-kcal']);
              const protein100g = Number(nutriments['proteins_100g'] ?? nutriments['proteins']);
              const carbs100g = Number(nutriments['carbohydrates_100g'] ?? nutriments['carbohydrates']);
              const fat100g = Number(nutriments['fat_100g'] ?? nutriments['fat']);

              foodAnalysis = {
                product_name: productName,
                brand,
                barcode,
                health_score: healthScore,
                risk_level: riskLevel,
                additives_detected: additives ? `Tespit Edilen Katkılar: ${additives}` : 'Katkı maddesi bilgisi temiz.',
                pesticide_risk_summary: novaScore === 4 ? 'Ultra-işlenmiş gıda kategorisinde. Tarım ilacı ve raf ömrü uzatıcı kimyasal riski yüksek.' : 'İşlenmişlik seviyesi düşük.',
                alternative_suggestions: 'Benzer gıda grubunda katkısız ve işlenmemiş alternatifler tercih edilebilir.',
                macros_per_100g: Number.isFinite(calories100g) ? {
                  calories: Math.round(calories100g),
                  protein: Number.isFinite(protein100g) ? Math.round(protein100g * 10) / 10 : 0,
                  carbs: Number.isFinite(carbs100g) ? Math.round(carbs100g * 10) / 10 : 0,
                  fat: Number.isFinite(fat100g) ? Math.round(fat100g * 10) / 10 : 0
                } : null
              };
            }
          }
        } catch (e) {
          console.warn('[Barcode Scan] Open Food Facts error:', e);
        }

        // 2. Web Arama İndeksi + Gemini AI ile sorgulama
        if (!foodAnalysis) {
          let searchSnippet = '';
          try {
            const ddgRes = await fetch(`https://html.duckduckgo.com/html/?q=${barcode}`, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept-Language': 'tr-TR,tr;q=0.9'
              }
            });
            if (ddgRes.ok) {
              const html = await ddgRes.text();
              const snippets = html.match(/<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/g) || [];
              searchSnippet = snippets
                .map(s => s.replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'").replace(/&amp;/g, '&'))
                .join(' ')
                .substring(0, 1500);
            }
          } catch (e) {
            console.warn('[Barcode Web Search Error]:', e);
          }

          const apiKey = process.env.GEMINI_API_KEY;
          if (apiKey) {
            const FOOD_MODELS = ['gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-3-flash-preview', 'gemini-flash-latest'];
            for (const fModel of FOOD_MODELS) {
              try {
                const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${fModel}:generateContent?key=${apiKey}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  signal: AbortSignal.timeout(10000),
                  body: JSON.stringify({
                    contents: [{
                      parts: [{
                        text: `Sen uzman bir gıda mühendisi ve beslenme toksikoloğusun.
${barcode} barkod numarası ve aşağıdaki web arama sonuçları üzerinden ürünün gerçek adını, markasını ve beslenme/katkı maddesi profilini tespit et.

Web Arama İndeksi:
${searchSnippet || 'Ürün bilgisi aranıyor.'}

SADECE aşağıdaki JSON formatında yanıt ver:
{
  "product_name": "Gerçek Ürün Adı (Örn: Dardanel Ekonomik Ton Balığı 4x75g)",
  "brand": "Marka (Örn: Dardanel)",
  "barcode": "${barcode}",
  "health_score": 75,
  "risk_level": "clean | moderate | high_risk",
  "additives_detected": "İçerik açıklaması, E-kodları, koruyucular veya ayçiçek yağı/tuz detayları",
  "pesticide_risk_summary": "Pestisit, cıva/ağır metal ve işlenmişlik riski değerlendirmesi",
  "alternative_suggestions": "Sağlıklı alternatif tavsiyesi"
}`
                      }]
                    }],
                    generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
                  })
                });
                if (!aiRes.ok) continue;
                const aiData = await aiRes.json();
                const text = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                  foodAnalysis = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
                  break;
                }
              } catch (e) {
                console.warn(`[Barcode Scan Gemini Error (${fModel})]:`, e);
              }
            }
          }
        }

        if (!foodAnalysis) {
          foodAnalysis = {
            product_name: `Taranan Barkod (${barcode})`,
            brand: 'Genel',
            barcode,
            health_score: 50,
            risk_level: 'moderate',
            additives_detected: 'Barkod veritabanlarında detaylı içerik bulunamadı. Ürünün içindekiler tablosunu fotoğraf çekerek taratabilirsiniz.',
            pesticide_risk_summary: 'Bilinmiyor.',
            alternative_suggestions: 'Taze ve işlenmemiş ürünler tercih edin.'
          };
        }
      }

      const now = new Date().toISOString();
      const scanId = `scan-${Date.now()}`;
      foodAnalysis.id = scanId;

      await db.insert(packagedFoodScans).values({
        id: scanId,
        product_name: foodAnalysis.product_name,
        brand: foodAnalysis.brand,
        barcode: foodAnalysis.barcode,
        health_score: foodAnalysis.health_score,
        risk_level: foodAnalysis.risk_level,
        additives_detected: foodAnalysis.additives_detected,
        pesticide_risk_summary: foodAnalysis.pesticide_risk_summary,
        alternative_suggestions: foodAnalysis.alternative_suggestions,
        micronutrient_profile: foodAnalysis.micronutrient_profile,
        user_id: user.id,
        created_at: now,
        updated_at: now
      });

      return NextResponse.json({ success: true, data: foodAnalysis });
    }

    return NextResponse.json({ success: false, error: 'Geçersiz analiz tipi.' }, { status: 400 });
  } catch (error: any) {
    console.error('Scan Food API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const clearJunk = searchParams.get('clear_junk') === 'true';

    if (clearJunk) {
      // Yalnızca kullanıcının kendi çöp/okunamayan taramalarını sil (veya master admin tümünü)
      const userCondition = user.is_master_account === 1
        ? or(
            ilike(packagedFoodScans.product_name, '%Taranan Barkod%'),
            ilike(packagedFoodScans.product_name, '%Etiketi Okunamad%')
          )
        : and(
            eq(packagedFoodScans.user_id, user.id),
            or(
              ilike(packagedFoodScans.product_name, '%Taranan Barkod%'),
              ilike(packagedFoodScans.product_name, '%Etiketi Okunamad%')
            )
          );

      await db.delete(packagedFoodScans).where(userCondition);
      return NextResponse.json({ success: true, message: 'Başarısız ve çöp taramalar temizlendi.' });
    }

    if (!id) {
      return NextResponse.json({ success: false, error: 'Silinecek tarama ID sağlanmalıdır.' }, { status: 400 });
    }

    const canDelete = user.is_master_account === 1
      ? eq(packagedFoodScans.id, id)
      : and(eq(packagedFoodScans.id, id), eq(packagedFoodScans.user_id, user.id));

    await db.delete(packagedFoodScans).where(canDelete);
    return NextResponse.json({ success: true, message: 'Ürün tarama kaydı kalıcı olarak silindi.' });
  } catch (error: any) {
    console.error('Delete Food Scan API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
