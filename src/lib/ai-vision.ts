import { normalizeBookCategory } from '@/lib/book-categories';

export interface ParsedReceipt {
  merchant: string;
  amount: number;
  currency: string;
  date: string;
  category_id: string;
  category_name: string;
  items: Array<{ name: string; price: number; quantity?: number; barcode?: string; vat_rate?: number }>;
  tax_amount?: number;
  tax_breakdown?: {
    vat_1?: number;
    vat_10?: number;
    vat_20?: number;
  };
  confidence: number;
  raw_text?: string;
  reference_number?: string;
  qr_url?: string;
  source_type?: 'qr_ebelge' | 'qr_gib_code' | 'ai_ocr';
}

/**
 * Resmi Gemini Modelleri Öncelik Zinciri
 */
export const RESILIENT_GEMINI_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.5-flash',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash'
];

/**
 * Otomatik Failover / Yeniden Deneme Özellikli Gemini Vision API Çağrıcısı
 */
async function callGeminiVision(
  apiKey: string,
  contents: any[],
  generationConfig: any = { responseMimeType: 'application/json', temperature: 0.1 }
): Promise<any> {
  for (const model of RESILIENT_GEMINI_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            generationConfig
          })
        }
      );

      if (response.ok) {
        return await response.json();
      }
      console.warn(`[AI Vision] Model ${model} döndürdü: ${response.status}`);
    } catch (err) {
      console.warn(`[AI Vision] ${model} çağrılırken hata:`, err);
    }
  }
  return null;
}

/**
 * Fiş & Fatura Görsel Ayrıştırma Motoru (AI Vision Pipeline)
 * Gemini Vision API veya Gelişmiş Yerel OCR Deseni kullanır.
 */
export async function parseReceiptImage(
  base64Input: string | string[],
  mimeInput: string | string[] = [],
  qrData?: string
): Promise<ParsedReceipt> {
  const base64Images = Array.isArray(base64Input) ? base64Input : [base64Input];
  const mimeTypes = Array.isArray(mimeInput) ? mimeInput : [mimeInput];
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const promptText = `Sen uzman bir finansal fiş, fatura ve POS slip OCR analizörüsün.
Gönderilen görseldeki fişi, faturayı veya slipi son derece titiz analiz et.
Buruşukluk, eksik ışık veya kısmi silinme durumunda dahi en mantıklı tahminleri çıkar.

Örnek Çıktı Kalıpları (Few-Shot Examples):
Örnek 1 (Market):
{
  "merchant": "MİGROS T.A.Ş.",
  "amount": 485.50,
  "currency": "TRY",
  "date": "2026-08-20",
  "category_suggestion": "Market & Gıda",
  "items": [
    {"name": "Süt 1L", "price": 38.50, "quantity": 2, "vat_rate": 1},
    {"name": "Ekmek", "price": 15.00, "quantity": 1, "vat_rate": 1},
    {"name": "Deterjan 2kg", "price": 180.00, "quantity": 1, "vat_rate": 20}
  ],
  "tax_amount": 35.0,
  "tax_breakdown": {
    "vat_1": 0.92,
    "vat_10": 0.0,
    "vat_20": 30.0
  },
  "confidence": 0.95
}

Örnek 2 (Akaryakıt / İstasyon):
{
  "merchant": "SHELL PETROL A.Ş.",
  "amount": 1850.00,
  "currency": "TRY",
  "date": "2026-08-21",
  "category_suggestion": "Ulaşım & Akaryakıt",
  "items": [
    {"name": "V-Power Kurşunsuz 95 (41.5 Litre)", "price": 1850.00, "quantity": 1, "vat_rate": 20}
  ],
  "tax_amount": 308.33,
  "tax_breakdown": {
    "vat_1": 0.0,
    "vat_10": 0.0,
    "vat_20": 308.33
  },
  "confidence": 0.98
}

Şimdi gönderilen görseli analiz et ve SADECE yukarıdaki gibi geçerli bir JSON çıktısı üret.${qrData ? `\n\nÖNEMLİ: Bu fişte okunan Karekod / QR verisi şudur: "${qrData}". Görseldeki bilgiler ile bu karekod içeriğini (mağaza, tarih, referans no, tutar vb.) birleştirerek en doğru analizi yap.` : ''}`;

      const jsonResult = await callGeminiVision(
        apiKey,
        [
          {
            parts: [
              {
                text: promptText
              },
              ...base64Images.map((base64Image, index) => ({
                inlineData: {
                  mimeType: mimeTypes[index] || 'image/jpeg',
                  data: base64Image.replace(/^data:image\/\w+;base64,/, '')
                }
              }))
            ]
          }
        ],
        {
          responseMimeType: 'application/json',
          temperature: 0.1
        }
      );

      if (jsonResult) {
        console.log('[AI Vision Debug] Gemini Response:', JSON.stringify(jsonResult, null, 2));
        const textOutput = jsonResult.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textOutput) {
          const parsed = JSON.parse(textOutput);
          return {
            merchant: parsed.merchant || 'Market / İşletme',
            amount: Number(parsed.amount) || 0,
            currency: parsed.currency || 'TRY',
            date: parsed.date || new Date().toISOString().split('T')[0],
            category_id: mapCategoryToId(parsed.category_suggestion),
            category_name: parsed.category_suggestion || 'Market & Gıda',
            items: Array.isArray(parsed.items) ? parsed.items : [],
            tax_amount: Number(parsed.tax_amount) || 0,
            tax_breakdown: parsed.tax_breakdown || undefined,
            confidence: Number(parsed.confidence) || 0.95,
            reference_number: parsed.reference_number || undefined,
            qr_url: qrData?.startsWith('http') ? qrData : undefined,
            source_type: 'ai_ocr'
          };
        }
      }
    } catch (err) {
      console.warn('[AI Vision] Gemini API hatası, akıllı simülasyona dönülüyor:', err);
    }
  }

  // Fallback (Fotoğraftan fiş/fatura okunamadıysa dürüst nötr taslak)
  const today = new Date().toISOString().split('T')[0];
  return {
    merchant: '',
    amount: 0,
    currency: 'TRY',
    date: today,
    category_id: 'cat-market',
    category_name: 'Market & Gıda',
    items: [],
    tax_amount: 0,
    confidence: 0.15,
    raw_text: 'Görselden fiş/fatura bilgisi okunamadı. Lütfen tutar ve işletmeyi manuel giriniz.'
  };
}

export interface ParsedVaultDocument {
  title: string;
  type: string; // 'passport' | 'id_card' | 'title_deed' | 'warranty' | 'insurance' | 'contract' | 'license' | 'other'
  owner: string;
  issuer: string;
  document_number: string;
  issue_date: string;
  expiry_date: string;
  notes: string;
  confidence: number;
}

/**
 * Dijital Kasa Belge Ayrıştırma Motoru (AI Vision Document OCR Pipeline)
 * Pasaport, Kimlik, Tapu, Garanti, Sigorta, Ehliyet belgelerini analiz eder.
 */
export async function parseVaultDocumentImage(
  base64Image: string,
  mimeType: string = 'image/jpeg'
): Promise<ParsedVaultDocument> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const jsonResult = await callGeminiVision(
        apiKey,
        [
          {
            parts: [
              {
                text: `Sen bir profesyonel resmi belge, kimlik, pasaport, tapu, sigorta ve garanti belgesi tarayıcısısın. Gönderilen görseldeki belgeyi analiz et ve SADECE aşağıdaki JSON formatında geçerli bir JSON çıktısı üret, başka hiçbir metin ekleme:
{
  "title": "Belge Başlığı / Adı (Örn: T.C. Bordo Pasaport, Samsung TV Garanti Belgesi, Kadıköy Daire Tapusu)",
  "type": "passport | id_card | license | warranty | contract | title_deed | health | insurance | invoice | other",
  "owner": "Belge Sahibi / Adı Soyadı",
  "issuer": "Veren Kurum / Marka (Örn: Nüfus ve Vatandaşlık İşleri, Samsung Türkiye, Aksigorta)",
  "document_number": "Belge veya Seri Numarası (Örn: U12345678, SN2024-889)",
  "issue_date": "YYYY-MM-DD formatında veriliş tarihi veya boş string",
  "expiry_date": "YYYY-MM-DD formatında son kullanma / bitiş tarihi veya boş string",
  "notes": "Belgeden okunan önemli detaylar ve özet bilgiler"
}`
              },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Image.replace(/^data:image\/\w+;base64,/, '')
                }
              }
            ]
          }
        ],
        {
          responseMimeType: 'application/json',
          temperature: 0.1
        }
      );

      const textOutput = jsonResult?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (textOutput) {
        const parsed = JSON.parse(textOutput);
        return {
          title: parsed.title || 'Taranan Belge',
          type: parsed.type || 'other',
          owner: parsed.owner || 'Kullanıcı',
          issuer: parsed.issuer || '',
          document_number: parsed.document_number || '',
          issue_date: parsed.issue_date || '',
          expiry_date: parsed.expiry_date || '',
          notes: parsed.notes || '',
          confidence: 0.95
        };
      }
    } catch (err) {
      console.warn('[AI Vision] Gemini API hatası:', err);
    }
  }

  // Fallback (Belge görseli okunamadıysa dürüst nötr taslak)
  return {
    title: '',
    type: 'other',
    owner: '',
    issuer: '',
    document_number: '',
    issue_date: '',
    expiry_date: '',
    notes: 'Belge görseli net okunamadı. Lütfen belge detaylarını manuel doldurunuz.',
    confidence: 0.10
  };
}

function mapCategoryToId(categoryName: string = ''): string {
  const lower = categoryName.toLowerCase();
  if (lower.includes('akaryakıt') || lower.includes('benzin') || lower.includes('ulaşım') || lower.includes('otopark') || lower.includes('hgs') || lower.includes('yakıt') || lower.includes('taksi') || lower.includes('otobüs')) return 'cat-ulasim';
  if (lower.includes('fatura') || lower.includes('internet') || lower.includes('elektrik') || lower.includes('su') || lower.includes('doğalgaz') || lower.includes('aidat') || lower.includes('gsm') || lower.includes('telefon') || lower.includes('abonelik')) return 'cat-fatura';
  if (lower.includes('kira') || lower.includes('konut') || lower.includes('apartman') || lower.includes('ev ')) return 'cat-kira';
  if (lower.includes('restoran') || lower.includes('cafe') || lower.includes('kafe') || lower.includes('yemek') || lower.includes('eğlence') || lower.includes('sinema') || lower.includes('konser') || lower.includes('tatil') || lower.includes('otel') || lower.includes('bar')) return 'cat-eeglence';
  if (lower.includes('sağlık') || lower.includes('eczane') || lower.includes('ilaç') || lower.includes('hastane') || lower.includes('doktor') || lower.includes('klinik') || lower.includes('optik') || lower.includes('kozmetik')) return 'cat-saglik';
  if (lower.includes('maaş') || lower.includes('gelir') || lower.includes('prim') || lower.includes('ikramiye') || lower.includes('faiz')) return 'cat-maas';
  if (lower.includes('market') || lower.includes('gıda') || lower.includes('bakkal') || lower.includes('şarküteri') || lower.includes('manav') || lower.includes('kasap') || lower.includes('süpermarket')) return 'cat-market';
  return 'cat-diger';
}

export interface ParsedApplianceInvoice {
  name: string;
  brand: string;
  model: string;
  purchase_date: string;
  warranty_months: number;
  service_phone: string;
  notes: string;
  confidence: number;
}

/**
  Ev Demirbaş / Fatura OCR Ayrıştırma Motoru
  Fatura görselinden cihaz adı, marka, model, satın alma tarihi, garanti süresi ve yetkili servis no çıkartır.
 */
export async function parseApplianceInvoiceImage(
  base64Image: string,
  mimeType: string = 'image/jpeg'
): Promise<ParsedApplianceInvoice> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const json = await callGeminiVision(
        apiKey,
        [
          {
            parts: [
              {
                text: `Lütfen bu fatura/fiş veya garanti belgesi görselini analiz et ve aşağıdaki JSON formatında döndür:
{
  "name": "Cihaz veya Ürün Adı (Örn: Çamaşır Makinesi, Buzdolabı, Klima, Robot Süpürge, TV)",
  "brand": "Marka (Örn: Bosch, Siemens, Roborock, Samsung, Arçelik)",
  "model": "Model Kodu (Örn: Series 6 KGN56, S7 MaxV, IQ500)",
  "purchase_date": "Satın Alma Tarihi (YYYY-MM-DD)",
  "warranty_months": Garanti Süresi Ay Sayısı (Sayı, Örn: 24 veya 36),
  "service_phone": "Müşteri Hizmetleri veya Servis Telefonu (Örn: 444 6 333)",
  "notes": "Fatura Numarası, Tutar ve Mağaza Notları"
}
Sadece geçerli JSON yanıtı döndür.`
              },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Image.replace(/^data:image\/\w+;base64,/, '')
                }
              }
            ]
          }
        ],
        {
          responseMimeType: 'application/json',
          temperature: 0.1
        }
      );
      const textResponse = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleanJsonStr = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();

      if (cleanJsonStr) {
        const parsed = JSON.parse(cleanJsonStr);
        return {
          name: parsed.name || 'Ev Cihazı',
          brand: parsed.brand || '',
          model: parsed.model || '',
          purchase_date: parsed.purchase_date || new Date().toISOString().split('T')[0],
          warranty_months: Number(parsed.warranty_months) || 24,
          service_phone: parsed.service_phone || '',
          notes: parsed.notes || '',
          confidence: 0.95
        };
      }
    } catch (err) {
      console.warn('[AI Vision] Gemini API hatası:', err);
    }
  }

  // Fallback (Fatura/garanti belgesi okunamadıysa dürüst nötr taslak)
  const today = new Date().toISOString().split('T')[0];
  return {
    name: '',
    brand: '',
    model: '',
    purchase_date: today,
    warranty_months: 24,
    service_phone: '',
    notes: 'Görselden fatura/garanti bilgisi okunamadı. Lütfen cihaz adı ve garanti süresini manuel giriniz.',
    confidence: 0.10
  };
}

// ==========================================
// 🍽️ YEMEK TABAK ANALİZÖRÜ (Plate Vision AI)
// ==========================================

export interface ParsedPlate {
  name: string;
  meal_type: string;
  base_calories: number;
  base_protein: number;
  base_carbs: number;
  base_fat: number;
  confidence: number;
  items: Array<{ name: string; calories: number; protein: number; carbs: number; fat: number }>;
}

export async function parsePlateImage(
  base64Image: string,
  mimeType: string = 'image/jpeg'
): Promise<ParsedPlate> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const promptText = `Sen profesyonel bir diyetisyen ve besin değerleri uzmanısın. Fotoğraftaki yemek tabağını analiz et ve içindeki yiyeceklerin gramaj, kalori ve makro besin değerlerini tahmin et. SADECE aşağıdaki JSON formatında çıktı üret:\n{"name":"Yemeğin Türkçe adı","meal_type":"breakfast|lunch|dinner|snack","base_calories":550,"base_protein":42,"base_carbs":35,"base_fat":20,"confidence":0.88,"items":[{"name":"Malzeme adı ve gramaj","calories":300,"protein":30,"carbs":0,"fat":12}]}`;

      const jsonResult = await callGeminiVision(
        apiKey,
        [
          {
            parts: [
              { text: promptText },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Image.replace(/^data:image\/\w+;base64,/, '')
                }
              }
            ]
          }
        ],
        {
          responseMimeType: 'application/json',
          temperature: 0.2
        }
      );

      const textOutput = jsonResult?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (textOutput) {
        const cleanJson = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        return {
          name: parsed.name || 'Yemek',
          meal_type: parsed.meal_type || 'lunch',
          base_calories: Number(parsed.base_calories) || 0,
          base_protein: Number(parsed.base_protein) || 0,
          base_carbs: Number(parsed.base_carbs) || 0,
          base_fat: Number(parsed.base_fat) || 0,
          confidence: Number(parsed.confidence) || 0.8,
          items: parsed.items || []
        };
      }
    } catch (err) {
      console.warn('[AI Vision] Plate scan error:', err);
    }
  }

  // Fallback (Tabak fotoğrafından besin çıkarılamadıysa dürüst nötr taslak)
  return {
    name: '',
    meal_type: 'lunch',
    base_calories: 0,
    base_protein: 0,
    base_carbs: 0,
    base_fat: 0,
    confidence: 0.10,
    items: []
  };
}

// ==========================================
// 📚 KİTAP & ISBN GÖRSEL ANALİZÖRÜ (Book AI Vision)
// ==========================================

export interface ParsedBookVision {
  title: string;
  author: string;
  publisher: string;
  isbn: string;
  total_pages: number;
  category: string;
  summary: string;
  words_per_page: number;
  confidence: number;
}

export async function parseBookCoverOrISBNImage(
  base64Image: string,
  mimeType: string = 'image/jpeg'
): Promise<ParsedBookVision> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const promptText = `Sen uzman bir kütüphaneci ve OCR görsel analiz uzmanısın. Gönderilen fotoğraftaki kitap kapağını, arka kapağını veya ISBN barkodunu incele. Kitap bilgilerini çıkar ve kitabın gerçek konusuna göre en doğru Türkçe kategoriyi tespit et. SADECE aşağıdaki JSON formatında bir yanıt ver:
{
  "title": "Kitap Tam Adı",
  "author": "Yazar Adı Soyadı",
  "publisher": "Yayınevi Adı",
  "isbn": "978... şeklinde 13 haneli ISBN veya boş string",
  "total_pages": 250,
  "category": "Kitabın Gerçek Türkçe Kategorisi (Örn: Psikoloji, Bilim, Tarih, Felsefe, Kurgu (Fiction), Beden, Zihin & Ruh, Kişisel Gelişim, İş & Ekonomi, Din, Tıp vb.)",
  "summary": "Kitap kapağında yazan özet veya genel konusu hakkında 1-2 cümlelik bilgi",
  "words_per_page": 250
}`;

      const MODELS = RESILIENT_GEMINI_MODELS;
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
                          mimeType: mimeType,
                          data: base64Image.replace(/^data:image\/\w+;base64,/, '')
                        }
                      }
                    ]
                  }
                ],
                generationConfig: {
                  responseMimeType: 'application/json',
                  temperature: 0.1
                }
              })
            }
          );

          if (response.ok) {
            const jsonResult = await response.json();
            const textOutput = jsonResult.candidates?.[0]?.content?.parts?.[0]?.text;

            if (textOutput) {
              const cleanJson = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
              let parsed: any = {};
              try { parsed = JSON.parse(cleanJson); } catch (e) {}
              if (Array.isArray(parsed) && parsed.length > 0) parsed = parsed[0];

              const detectedTitle = (parsed.title || '').trim();
              if (detectedTitle && detectedTitle !== 'Taranan Kitap' && detectedTitle !== 'Kitap Tam Adı' && detectedTitle.length >= 2) {
                const resolvedCategory = normalizeBookCategory(parsed.category, detectedTitle, parsed.summary);
                return {
                  title: detectedTitle,
                  author: (parsed.author || '').replace(/Yazar Adı Soyadı/i, '').trim(),
                  publisher: (parsed.publisher || '').replace(/Yayınevi Adı/i, '').trim(),
                  isbn: (parsed.isbn || '').replace(/[^0-9X]/gi, '').trim(),
                  total_pages: Number(parsed.total_pages) || 200,
                  category: resolvedCategory,
                  summary: parsed.summary || 'Yapay zeka görsel analizi ile taranan kitap.',
                  words_per_page: Number(parsed.words_per_page) || 250,
                  confidence: 0.95
                };
              }
            }
          }
        } catch (mErr) {
          console.warn(`[AI Vision Book ${modelName} Warning]:`, mErr);
        }
      }
    } catch (err) {
      console.warn('[AI Vision] Book scan error:', err);
    }
  }

  // Fallback (Fotoğraftan veri çıkarılamadıysa nötr bilgi)
  return {
    title: '',
    author: '',
    publisher: '',
    isbn: '',
    total_pages: 200,
    category: 'Kurgu (Fiction)',
    summary: 'Görselden kitap bilgisi okunamadı. Lütfen barkodu kameraya yaklaştırın veya ISBN girin.',
    words_per_page: 250,
    confidence: 0.10
  };
}

// ==========================================
// 🏷️ PAKETLİ GIDA & KATKI MADDESİ ANALİZÖRÜ
// ==========================================

export interface ParsedPackagedFood {
  product_name: string;
  brand: string;
  barcode: string;
  health_score: number;
  risk_level: string;
  additives_detected: string;
  pesticide_risk_summary: string;
  alternative_suggestions: string;
  confidence: number;
}

export async function parsePackagedFoodImage(
  base64Image: string,
  mimeType: string = 'image/jpeg'
): Promise<ParsedPackagedFood> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const promptText = `Sen uzman bir gıda mühendisi, gıda toksikoloğusun.
Görseldeki paketli gıdanın ambalajını, logosunu, ürün adını, markasını, arkasındaki içindekiler tablosunu ve E-kodlarını dikkatle OCR ile oku.

Talimatlar:
1. Görseldeki ürünün markasını ve tam adını (Örn: "Ülker Çikolatalı Gofret", "Doritos Taco", "Sütaş Tam Yağlı Süt", "Torku Banada") açıkça tespit et.
2. Fotoğrafta içindekiler tablosu görünüyorsa tabloyu oku. Eğer fotoğrafta ön ambalaj/logo görünüyorsa fakat içindekiler tablosu açılı kalmışsa, tespit ettiğin ürünün bilinen içerik ve katkı maddesi profili (E-kodları, palm yağı, yüksek fruktoz şurubu, koruyucu) üzerinden bilimsel değerlendirme yap.
3. Katkı maddelerini (E-kodları), koruyucu maddeleri, şeker/yağ kalitesini ve pestisit kalıntı riskini puanla (0-100 arası Sağlık Skoru ver).

SADECE aşağıdaki JSON formatında yanıt ver, başka açıklama ekleme:
{
  "product_name": "Ürün Adı",
  "brand": "Marka",
  "barcode": "Ekrandan okunan barkod veya —",
  "health_score": 75,
  "risk_level": "clean | moderate | high_risk",
  "additives_detected": "Tespit edilen veya üründe yer alan E-kodları, emülgatörler, tatlandırıcılar ve koruyucu açıklaması",
  "pesticide_risk_summary": "Tarım ilacı, kimyasal solvent ve işlenmişlik riski değerlendirmesi",
  "alternative_suggestions": "Daha katkısız ve sağlıklı alternatif tavsiyesi"
}`;

      const jsonResult = await callGeminiVision(
        apiKey,
        [
          {
            parts: [
              { text: promptText },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Image.replace(/^data:image\/\w+;base64,/, '')
                }
              }
            ]
          }
        ],
        {
          responseMimeType: 'application/json',
          temperature: 0.1
        }
      );

      const textOutput = jsonResult?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (textOutput) {
        const cleanJson = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        return {
          product_name: parsed.product_name || 'Taranan Paketli Gıda',
          brand: parsed.brand || 'Genel',
          barcode: parsed.barcode || '—',
          health_score: Math.max(0, Math.min(100, Number(parsed.health_score) || 50)),
          risk_level: parsed.risk_level || 'moderate',
          additives_detected: parsed.additives_detected || 'İçerik analizi tamamlandı.',
          pesticide_risk_summary: parsed.pesticide_risk_summary || 'Düşük risk.',
          alternative_suggestions: parsed.alternative_suggestions || 'Doğal gıdalar tercih edilebilir.',
          confidence: 0.95
        };
      }
    } catch (err) {
      console.warn('[AI Vision] Packaged food scan error:', err);
    }
  }

  // Gerçek AI başarısız olursa veya görsel net okunamazsa dürüst uyarı döndür (Asla sahte zeytinyağı döndürme)
  return {
    product_name: 'Gıda Etiketi Okunamadı',
    brand: 'Belirtilmedi',
    barcode: '—',
    health_score: 50,
    risk_level: 'moderate',
    additives_detected: 'Görselde ürün adı, ambalaj yazıları veya içindekiler tablosu net okunamadı. Lütfen paketin arkasındaki etiket alanını net çekerek tekrar deneyin.',
    pesticide_risk_summary: 'Net etiket görseli olmadığından içerik taranamamıştır.',
    alternative_suggestions: 'Paketli ürünlerin arkasındaki İçindekiler metnini yakından ve net odaklayarak taratabilirsiniz.',
    confidence: 0.20
  };
}

