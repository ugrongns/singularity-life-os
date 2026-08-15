import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { image_base64, mime_type = 'image/jpeg' } = body;

    if (!image_base64) {
      return NextResponse.json({ success: false, error: 'Lütfen bir akıllı tartı ekran görüntüsü sağlayın.' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'Gemini API Anahtarı tanımlı değil.' }, { status: 500 });
    }

    const promptText = `Sen uzman bir biyo-impeditif akıllı tartı ve sağlık verisi analiz uzmanısın. 
Fotoğraftaki akıllı tartı uygulamasının ekran görüntüsünden yer alan TÜM VÜCUT METRİKLERİNİ dikkatle oku ve SADECE aşağıdaki JSON formatında geçerli bir JSON objesi döndür:

{
  "measurement_date": "YYYY/MM/DD HH:mm:ss veya YYYY-MM-DD" (Tarih ve saat görünüyorsa oku, yoksa boş bırak),
  "weight_kg": 84.65,
  "bmi": 27.6,
  "body_fat_percent": 26.1,
  "body_fat_mass_kg": 22.1,
  "skeletal_muscle_percent": 38.8,
  "skeletal_muscle_mass_kg": 32.8,
  "muscle_percent": 70.4,
  "muscle_mass_kg": 59.6,
  "water_percent": 52.9,
  "water_mass_kg": 44.8,
  "visceral_fat_rating": 14.5,
  "bone_mass_kg": 2.87,
  "bmr_calories": 1771.0,
  "protein_percent": 17.5,
  "obesity_degree_percent": 27.3,
  "metabolic_age": 43.0,
  "fat_free_mass_kg": 62.53,
  "actual_age": 39,
  "height_cm": 175
}

Kurallar:
- SADECE JSON döndür. Başka açıklama yazma.
- Fotoğrafta görünmeyen metrikleri null olarak bırak.
- Sayıları float/number tipinde döndür (virgülleri noktaya çevir).`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
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

    const jsonResult = await response.json();

    if (jsonResult.error) {
      console.warn('[Smart Scale OCR Error]', jsonResult.error);
      return NextResponse.json({ success: false, error: 'Tartı verileri okunamadı.' }, { status: 500 });
    }

    const rawText = jsonResult.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleanJsonText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

    const parsedData = JSON.parse(cleanJsonText);

    return NextResponse.json({
      success: true,
      data: parsedData
    });
  } catch (error: any) {
    console.error('Scan Smart Scale Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
