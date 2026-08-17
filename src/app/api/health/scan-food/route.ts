import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { packagedFoodScans } from '@/db/schema';
import { desc, eq , or } from 'drizzle-orm';
import { parsePlateImage, parsePackagedFoodImage } from '@/lib/ai-vision';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  try {
    initDatabase();
    const user = await getAuthUser();
    const userId = user?.id;

    const scans = userId
      ? await db.select().from(packagedFoodScans).where(or(eq(packagedFoodScans.user_id, userId), eq(packagedFoodScans.user_id, ''))).orderBy(desc(packagedFoodScans.created_at)).limit(10)
      : await db.select().from(packagedFoodScans).orderBy(desc(packagedFoodScans.created_at)).limit(10);
    return NextResponse.json({ success: true, data: scans });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    initDatabase();
    const body = await req.json();
    const { type = 'plate', base64, mimeType = 'image/jpeg', barcode_text } = body;

    if (type === 'plate') {
      // Eğer gerçek görsel varsa AI ile analiz et
      if (base64) {
        const plateData = await parsePlateImage(base64, mimeType);
        return NextResponse.json({
          success: true,
          data: plateData,
          message: `🍽️ ${plateData.name} tabağı analiz edildi! (${plateData.base_calories} kcal, %${Math.round(plateData.confidence * 100)} güven)`
        });
      }

      // Görsel yoksa simülasyon
      return NextResponse.json({
        success: true,
        data: {
          name: 'Izgara Tavuk & Bulgur Pilavı',
          meal_type: 'lunch',
          base_calories: 520,
          base_protein: 42,
          base_carbs: 48,
          base_fat: 14,
          confidence: 0.75,
          items: [
            { name: 'Izgara Tavuk Göğsü (180g)', calories: 296, protein: 38, carbs: 0, fat: 6 },
            { name: 'Bulgur Pilavı (120g)', calories: 178, protein: 4, carbs: 46, fat: 1 },
            { name: 'Zeytinyağlı Salata (50g)', calories: 46, protein: 0, carbs: 2, fat: 7 }
          ]
        }
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

        // Örnek simülasyon barkodları kontrolü
        if (barcode === '869055512348') {
          foodAnalysis = {
            product_name: 'Organik Soğuk Sıkım Zeytinyağı (Örnek Simülasyon)',
            brand: 'Ege Bahçeleri',
            barcode,
            health_score: 96,
            risk_level: 'clean',
            additives_detected: 'Hiçbir katkı maddesi, koruyucu veya kimyasal solvent içermez. %100 Saf.',
            pesticide_risk_summary: 'AB Organik Tarım Sertifikalı. Pestisit kalıntısı: 0 ppm (Sıfır Kalıntı).',
            alternative_suggestions: 'Mükemmel sağlıklı yağ asidi ve polifenol kaynağı.'
          };
        } else if (barcode === '869055512341') {
          foodAnalysis = {
            product_name: 'Kremalı Çilekli Bisküvi (Örnek Simülasyon)',
            brand: 'Süper Tat',
            barcode,
            health_score: 36,
            risk_level: 'high_risk',
            additives_detected: 'E471 (Emülgatör), E129 (Allura Red), Hidrojenize Bitkisel Yağ, Yüksek Fruktozlu Mısır Şurubu',
            pesticide_risk_summary: 'Ultra-işlenmiş gıda. Raf ömrü uzatıcı sentetik antioksidanlar ve potansiyel tarım ilacı kalıntı riski taşır.',
            alternative_suggestions: 'Ev yapımı yulaflı kuru meyveli atıştırmalıklar veya katkısız kuruyemişler önerilir.'
          };
        } else {
          // Gerçek Barkod Sorgulama (Open Food Facts & Gemini)
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

                foodAnalysis = {
                  product_name: productName,
                  brand,
                  barcode,
                  health_score: healthScore,
                  risk_level: riskLevel,
                  additives_detected: additives ? `Tespit Edilen Katkılar: ${additives}` : '',
                  pesticide_risk_summary: novaScore === 4 ? 'Ultra-işlenmiş gıda kategorisinde. Tarım ilacı ve raf ömrü uzatıcı kimyasal riski yüksek.' : 'İşlenmişlik seviyesi düşük.',
                  alternative_suggestions: 'Benzer gıda grubunda katkısız ve işlenmemiş alternatifler tercih edilebilir.'
                };

                // Eğer veritabanında detaylı katkı bilgisi eksikse Gemini AI ile toksikoloji ve içerik derin analizi yap
                const apiKey = process.env.GEMINI_API_KEY;
                if (apiKey) {
                  try {
                    const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        contents: [{
                          parts: [{
                            text: `Uzman gıda mühendisi ve toksikolog olarak "${brand} ${productName}" (Barkod: ${barcode}) ürününün üretici standartlarını, ambalaj içeriğini, katkı maddelerini (E-kodları), koruyucularını, tuz/şeker/yağ oranlarını ve pestisit riski durumunu değerlendir.
SADECE aşağıdaki JSON formatında yanıt ver:
{
  "product_name": "${productName}",
  "brand": "${brand}",
  "barcode": "${barcode}",
  "health_score": 85,
  "risk_level": "clean",
  "additives_detected": "Detaylı içerik profili, E-kodları, koruyucular veya doğal peynir altı suyu çökeltisi açıklaması",
  "pesticide_risk_summary": "Pestisit, kimyasal solvent ve işlenmişlik riski değerlendirmesi",
  "alternative_suggestions": "Sağlıklı beslenme tavsiyesi"
}`
                          }]
                        }],
                        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
                      })
                    });
                    const aiData = await aiRes.json();
                    const textOutput = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (textOutput) {
                      const enriched = JSON.parse(textOutput.replace(/```json/g, '').replace(/```/g, '').trim());
                      foodAnalysis = {
                        product_name: enriched.product_name || productName,
                        brand: enriched.brand || brand,
                        barcode,
                        health_score: Number(enriched.health_score) || healthScore,
                        risk_level: enriched.risk_level || riskLevel,
                        additives_detected: enriched.additives_detected || 'Katkı maddesi bilgisi temiz.',
                        pesticide_risk_summary: enriched.pesticide_risk_summary || foodAnalysis.pesticide_risk_summary,
                        alternative_suggestions: enriched.alternative_suggestions || foodAnalysis.alternative_suggestions
                      };
                    }
                  } catch (e) {
                    console.warn('[Barcode AI Enrichment Error]:', e);
                  }
                }

                if (!foodAnalysis.additives_detected) {
                  foodAnalysis.additives_detected = 'Katkı maddesi bilgisi temiz / tespit edilmedi.';
                }
              }
            }
          } catch (e) {
            console.warn('[Barcode Scan] Open Food Facts error:', e);
          }

          // Open Food Facts'ta bulunamadıysa Türkiye Web Arama İndeksi + Gemini AI ile sorgula
          if (!foodAnalysis) {
            let searchSnippet = '';
            try {
              const ddgRes = await fetch(`https://html.duckduckgo.com/html/?q=${barcode}+barkod`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
              });
              if (ddgRes.ok) {
                const html = await ddgRes.text();
                const snippets = html.match(/<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/g) || [];
                searchSnippet = snippets.map(s => s.replace(/<[^>]+>/g, '')).join(' ').substring(0, 1200);
              }
            } catch (e) {
              console.warn('[Barcode Web Search Error]:', e);
            }

            const apiKey = process.env.GEMINI_API_KEY;
            if (apiKey) {
              try {
                const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
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
                const aiData = await aiRes.json();
                const text = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                  foodAnalysis = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
                }
              } catch (e) {
                console.warn('[Barcode Scan Gemini Error]:', e);
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
      }

      const user = await getAuthUser();
      const now = new Date().toISOString();
      const scanId = `scan-${Date.now()}`;

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
        user_id: user?.id || null,
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
