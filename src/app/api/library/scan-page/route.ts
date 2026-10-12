import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 });
    }

    const body = await req.json();
    const { image_base64, mime_type = 'image/jpeg' } = body;

    if (!image_base64) {
      return NextResponse.json({ success: false, error: 'Lütfen bir sayfa fotoğrafı sağlayın.' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        source: 'heuristic',
        error: 'Gemini API anahtarı (GEMINI_API_KEY) sistemde tanımlı değil. Lütfen ortam değişkenlerini kontrol edin.'
      }, { status: 503 });
    }

    const promptText = `Sen uzman bir OCR ve doküman transkripsiyon uzmanısın. Fotoğraftaki kitap sayfasında yer alan TÜM METNİ eksiksiz olarak Türkçe transkribe et. 
Eğer görüntü net değilse, sayfa eğikse veya bazı kelimeleri kesin olarak okuyamıyorsan, o kısmı UYDURMA — emin olmadığın kelimeleri [OKUNAMADI] olarak işaretle.
Başka hiçbir açıklama veya giriş cümlesi yazma, SADECE sayfadan okuduğun ham metni döndür.`;

    const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash-latest'];
    let lastError = 'Yapay Zekâ Görsel OCR servisine erişilemedi.';

    for (const modelName of MODELS) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: promptText },
                    {
                      inlineData: {
                        mimeType: mime_type,
                        data: image_base64.replace(/^data:image\/\w+;base64,/, '')
                      }
                    }
                  ]
                }
              ],
              generationConfig: {
                temperature: 0.0
              }
            })
          }
        );

        if (!response.ok) {
          const errJson = await response.json().catch(() => ({}));
          const errMsg = errJson?.error?.message || response.statusText;
          console.warn(`[AI Vision Page Scan Error ${modelName} (${response.status})]:`, errMsg);
          if (response.status === 429) {
            lastError = 'Gemini API kota limiti aşıldı (Rate limit). Lütfen kısa süre sonra tekrar deneyin.';
          } else if (response.status === 403 || response.status === 401) {
            lastError = `Gemini API kimlik doğrulama hatası (${response.status}): API anahtarı geçersiz veya yetkisiz.`;
          } else {
            lastError = `Gemini API servisi yanıt vermedi (${modelName}: ${response.status})`;
          }
          continue;
        }

        const jsonResult = await response.json();

        if (jsonResult.error) {
          console.warn(`[AI Vision Page Scan Error ${modelName}]`, jsonResult.error);
          lastError = jsonResult.error.message || lastError;
          continue;
        }

        const rawText = jsonResult.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const trimmedText = rawText.trim();

        if (trimmedText.length > 10) {
          // 1. Okunamayan Kelime / Halüsinasyon Kontrolü
          const unreadableMatches = trimmedText.match(/\[OKUNAMADI\]/gi);
          const unreadableCount = unreadableMatches ? unreadableMatches.length : 0;
          const isLowConfidence = unreadableCount >= 3;

          // 2. JS Tarafında Deterministik Kelime Hesabı ([OKUNAMADI] etiketleri temizlenerek)
          const cleanTextForCounting = trimmedText.replace(/\[OKUNAMADI\]/gi, '');
          const words = cleanTextForCounting
            .split(/[\s\r\n\t]+/)
            .map((w: string) => w.replace(/[^\p{L}\p{N}]/gu, '').trim())
            .filter((w: string) => w.length >= 2);

          const wordCount = words.length;
          const sampleText = words.slice(0, 10).join(' ');

          console.log('\n===========================================');
          console.log('📖 SAYFA KELİME ANALİZİ & OCR LOGLARI');
          console.log('===========================================');
          console.log('⏰ Zaman:', new Date().toLocaleString('tr-TR'));
          console.log('📸 Görsel Veri Boyutu:', `${Math.round(image_base64.length / 1024)} KB`);
          console.log('🤖 Yapay Zekâ Modeli:', modelName);
          console.log('📊 Kaynak Türü (Source):', 'ai');
          console.log('⚠️ Okunamayan Kelime Sayısı:', unreadableCount);
          console.log('🎯 Güvenilirlik (Confidence):', isLowConfidence ? 'DÜŞÜK ⚠️' : 'YÜKSEK ✅');
          console.log('🔍 Hesaplanan Net Kelime Sayısı:', `${wordCount} Kelime`);
          console.log('💬 Okunan İlk 10 Kelime:', `"${sampleText}..."`);
          console.log('===========================================\n');

          return NextResponse.json({
            success: true,
            source: 'ai',
            model_name: modelName,
            is_low_confidence: isLowConfidence,
            unreadable_count: unreadableCount,
            data: {
              word_count: wordCount,
              sample_text: sampleText,
              full_text: trimmedText
            }
          });
        }
      } catch (mErr: any) {
        console.warn(`[AI Vision Page Scan Model ${modelName} Error]`, mErr);
        lastError = mErr.message || lastError;
      }
    }

    return NextResponse.json({
      success: false,
      source: 'heuristic',
      error: lastError
    }, { status: 502 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
