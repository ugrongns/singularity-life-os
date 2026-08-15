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
      ? db.select().from(packagedFoodScans).where(eq(packagedFoodScans.user_id, userId)).orderBy(desc(packagedFoodScans.created_at)).limit(10).all()
      : [];
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
        const barcode = barcode_text || '869055512345';
        const isClean = barcode.endsWith('5') || barcode.endsWith('8');

        foodAnalysis = isClean ? {
          product_name: 'Organik Soğuk Sıkım Zeytinyağı',
          brand: 'Ege Bahçeleri',
          barcode,
          health_score: 96,
          risk_level: 'clean',
          additives_detected: 'Hiçbir katkı maddesi, koruyucu veya kimyasal solvent içermez. %100 Saf.',
          pesticide_risk_summary: 'AB Organik Tarım Sertifikalı. Pestisit kalıntısı: 0 ppm (Sıfır Kalıntı).',
          alternative_suggestions: 'Mükemmel sağlıklı yağ asidi ve polifenol kaynağı.'
        } : {
          product_name: 'Kremalı Çilekli Bisküvi',
          brand: 'Süper Tat',
          barcode,
          health_score: 36,
          risk_level: 'high_risk',
          additives_detected: 'E471 (Emülgatör), E129 (Allura Red - Yapay Renklendirici), Hidrojenize Bitkisel Yağ, Yüksek Fruktozlu Mısır Şurubu',
          pesticide_risk_summary: 'Ultra-işlenmiş gıda. Raf ömrü uzatıcı sentetik antioksidanlar ve potansiyel tarım ilacı kalıntı riski taşır.',
          alternative_suggestions: 'Ev yapımı yulaflı kuru meyveli atıştırmalıklar veya katkısız kuruyemişler önerilir.'
        };
      }

      const now = new Date().toISOString();
      const scanId = `scan-${Date.now()}`;

      db.insert(packagedFoodScans).values({
        id: scanId,
        product_name: foodAnalysis.product_name,
        brand: foodAnalysis.brand,
        barcode: foodAnalysis.barcode,
        health_score: foodAnalysis.health_score,
        risk_level: foodAnalysis.risk_level,
        additives_detected: foodAnalysis.additives_detected,
        pesticide_risk_summary: foodAnalysis.pesticide_risk_summary,
        alternative_suggestions: foodAnalysis.alternative_suggestions,
        created_at: now,
        updated_at: now
      }).run();

      return NextResponse.json({ success: true, data: foodAnalysis });
    }

    return NextResponse.json({ success: false, error: 'Geçersiz analiz tipi.' }, { status: 400 });
  } catch (error: any) {
    console.error('Scan Food API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
