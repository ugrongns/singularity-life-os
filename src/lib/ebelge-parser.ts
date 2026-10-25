import { ParsedReceipt } from './ai-vision';

/**
 * Türkiye GİB / e-Belge / e-Arşiv Fiş & Fatura Karekod Çözümleme Modülü
 * Migros, BİM, A101, ŞOK, CarrefourSA ve Gelir İdaresi Başkanlığı Karekod formatlarını destekler.
 */

export interface EBelgeParseResult extends ParsedReceipt {
  reference_number?: string;
  ettn?: string;
  qr_url?: string;
  source_type: 'qr_ebelge' | 'qr_gib_code' | 'ai_ocr';
}

/**
 * Metnin veya URL'nin bir e-Belge / QR bağlantısı olup olmadığını kontrol eder
 */
export function isEBelgeOrQRUrl(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  return (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.includes('fitbulut.com') ||
    trimmed.includes('gib.gov.tr') ||
    trimmed.includes('migros.com.tr') ||
    trimmed.includes('VKN:') ||
    trimmed.includes('ETTN:')
  );
}

/**
 * GİB Standart Karekod Formatını Ayrıştırır
 * Örnek: VKN:6220529513|TKN:12345678901|TARIH:2026-10-24|SAAT:15:46:00|TOPLAM:430.85|KDV:22.25|ETTN:...
 */
export function parseGibKarekodText(text: string): EBelgeParseResult | null {
  if (!text || (!text.includes('VKN:') && !text.includes('ETTN:') && !text.includes('TOPLAM:'))) {
    return null;
  }

  const parts = text.split('|');
  const dict: Record<string, string> = {};
  for (const part of parts) {
    const colonIdx = part.indexOf(':');
    if (colonIdx > 0) {
      const k = part.substring(0, colonIdx).trim().toUpperCase();
      const v = part.substring(colonIdx + 1).trim();
      dict[k] = v;
    }
  }

  const amount = parseFloat(dict['TOPLAM']?.replace(',', '.') || '0') || 0;
  const tax = parseFloat(dict['KDV']?.replace(',', '.') || '0') || 0;
  const rawDate = dict['TARIH'] || new Date().toISOString().split('T')[0];
  let formattedDate = rawDate;
  if (/^\d{2}[-/.]\d{2}[-/.]\d{4}$/.test(rawDate)) {
    const [d, m, y] = rawDate.split(/[-/.]/);
    formattedDate = `${y}-${m}-${d}`;
  }

  return {
    merchant: dict['VKN'] === '6220529513' ? 'MİGROS TİCARET A.Ş.' : `Kurumsal Fatura (VKN: ${dict['VKN'] || 'Belirtilmedi'})`,
    amount,
    currency: 'TRY',
    date: formattedDate,
    category_id: 'cat-market',
    category_name: 'Market & Gıda',
    items: [],
    tax_amount: tax > 0 ? tax : undefined,
    confidence: 0.98,
    reference_number: dict['REF'] || dict['ISLEM'] || undefined,
    ettn: dict['ETTN'] || undefined,
    source_type: 'qr_gib_code',
    raw_text: text
  };
}

/**
 * Fitbulut / Sovos / Migros / GİB HTML sayfasını parse eder
 */
export function parseEBelgeHtml(html: string, originalUrl: string = ''): EBelgeParseResult {
  // 1. İşletme / Mağaza Adı
  let merchant = 'Market';
  const storeMatch = html.match(/Mağaza:[\s\S]*?<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
  if (storeMatch) {
    const rawStore = storeMatch[1].replace(/<[^>]+>/g, '').trim();
    merchant = rawStore;
    if (merchant.toUpperCase().includes('MIGROS') || merchant.toUpperCase().includes('MİGROS')) {
      const branch = merchant.replace(/^\d+\s*-\s*/, '').trim();
      merchant = `MİGROS (${branch})`;
    }
  } else {
    // Başlık veya bilinen kurumsal isimler
    if (html.includes('MİGROS TİCARET') || html.includes('MIGROS TICARET')) {
      merchant = 'MİGROS TİCARET A.Ş.';
    } else if (html.includes('BİM BİRLEŞİK')) {
      merchant = 'BİM BİRLEŞİK MAĞAZALAR A.Ş.';
    } else if (html.includes('A101 YENİ')) {
      merchant = 'A101 YENİ MAĞAZACILIK A.Ş.';
    } else if (html.includes('CARREFOURSA')) {
      merchant = 'CARREFOURSA A.Ş.';
    } else if (html.includes('ŞOK MARKETLER')) {
      merchant = 'ŞOK MARKETLER T.A.Ş.';
    } else {
      const sellerParty = html.match(/<td[^>]*class="[^"]*customerName[^"]*"[^>]*>([\s\S]*?)<\/td>/i);
      if (sellerParty) {
        merchant = sellerParty[1].replace(/<[^>]+>/g, '').trim();
      }
    }
  }

  // 2. Fatura Tarihi
  let date = new Date().toISOString().split('T')[0];
  const dateMatch = html.match(/Fatura Tarihi:[\s\S]*?<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
  if (dateMatch) {
    const rawDate = dateMatch[1].replace(/<[^>]+>/g, '').trim();
    const parts = rawDate.match(/(\d{2})[-/.](\d{2})[-/.](\d{4})/);
    if (parts) {
      date = `${parts[3]}-${parts[2]}-${parts[1]}`;
    }
  }

  // 3. Fatura Toplamı
  let amount = 0;
  const totalMatch =
    html.match(/FATURA TOPLAMI\s*:[\s\S]*?<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i) ||
    html.match(/FATURA TOPLAMI\s*:\s*([\d.,]+)/i) ||
    html.match(/ÖDENECEK TUTAR\s*:[\s\S]*?<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
  if (totalMatch) {
    const rawVal = totalMatch[1].replace(/<[^>]+>/g, '').trim().replace(/\s/g, '');
    amount = parseFloat(rawVal.replace(',', '.'));
  }

  // 4. KDV Tutarı
  let tax_amount = 0;
  const taxMatch =
    html.match(/TOPLAM KDV\s*:[\s\S]*?<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i) ||
    html.match(/TOPLAM KDV\s*:\s*([\d.,]+)/i);
  if (taxMatch) {
    const rawTax = taxMatch[1].replace(/<[^>]+>/g, '').trim().replace(/\s/g, '');
    tax_amount = parseFloat(rawTax.replace(',', '.'));
  }

  // 5. Ürün Kalemleri Tablosu
  const items: Array<{ name: string; price: number; quantity?: number; barcode?: string }> = [];
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tMatch;
  while ((tMatch = tableRegex.exec(html)) !== null) {
    const tableHtml = tMatch[1];
    if (tableHtml.includes('Ürün Adı') || tableHtml.includes('Mal/Hizmet') || tableHtml.includes('Ürün Kodu')) {
      const rowMatches = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
      for (let i = 1; i < rowMatches.length; i++) {
        const row = rowMatches[i];
        const cells = (row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || []).map(c => c.replace(/<[^>]+>/g, '').trim());
        if (cells.length >= 6) {
          // Col 0: Ürün Kodu, Col 1: Barkod, Col 2: Ürün Adı, Col 3: Miktar, Col 4: Birim, Col 5: Birim Fiyat, Col 6: Brüt, Col 8: İsk. Sonrası
          const name = cells[2];
          const qty = parseFloat(cells[3]?.replace(',', '.')) || 1;
          const price = parseFloat((cells[8] || cells[6] || cells[5])?.replace(',', '.')) || 0;
          const barcode = cells[1] || '';

          if (name && price > 0) {
            items.push({
              name,
              price,
              quantity: qty,
              barcode: barcode.length >= 8 ? barcode : undefined
            });
          }
        }
      }
      break;
    }
  }

  // Fatura toplamı 0 çıkmışsa kalemlerin toplamını al
  if (amount === 0 && items.length > 0) {
    amount = items.reduce((sum, item) => sum + (item.price || 0), 0);
    amount = Math.round(amount * 100) / 100;
  }

  // Referans No ve ETTN
  const refMatch =
    originalUrl.match(/Refid([a-zA-Z0-9]+)/i) ||
    html.match(/Referans No:[\s\S]*?<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i) ||
    html.match(/Referans numaras[ıi] ile/i);
  let reference_number = '';
  if (refMatch) {
    reference_number = (refMatch[1] || '').replace(/<[^>]+>/g, '').trim();
  }

  const ettnMatch = html.match(/ETTN:\s*([a-f0-9\-]+)/i);
  const ettn = ettnMatch ? ettnMatch[1] : undefined;

  return {
    merchant,
    amount,
    currency: 'TRY',
    date,
    category_id: 'cat-market',
    category_name: 'Market & Gıda',
    items,
    tax_amount: tax_amount > 0 ? tax_amount : undefined,
    confidence: 1.0,
    reference_number: reference_number || undefined,
    ettn,
    qr_url: originalUrl,
    source_type: 'qr_ebelge',
    raw_text: `GİB e-Belge / Karekod: ${originalUrl}`
  };
}

export const TRUSTED_EBELGE_DOMAINS = [
  'gib.gov.tr',
  'fitbulut.com',
  'foriba.com',
  'sovos.com',
  'efinans.com.tr',
  'kolaybi.com',
  'parasut.com',
  'uyumsoft.com.tr',
  'edm.com.tr',
  'inpos.com.tr',
  'hugin.com.tr',
  'veriban.com.tr',
  'nesbilgi.com.tr',
  'izibiz.com.tr',
  'turkcell.com.tr',
  'vodafone.com.tr',
  'turktelekom.com.tr',
  'migros.com.tr',
  'bim.com.tr',
  'a101.com.tr',
  'sokmarket.com.tr',
  'carrefoursa.com',
  'trendyol.com',
  'hepsiburada.com',
  'amazon.com.tr',
  'yemeksepeti.com',
  'getir.com'
];

/**
 * SSRF Koruması: Yalnızca güvenli protokoller ve izin verilen e-Belge domainlerini kabul eder
 */
export function isSafeEBelgeUrl(urlString: string): boolean {
  if (!urlString || typeof urlString !== 'string') return false;
  try {
    const parsed = new URL(urlString.trim());
    // 1. Yalnızca HTTPS protokolü izinlidir (Düz HTTP veya iç protokoller engellenir)
    if (parsed.protocol !== 'https:') return false;

    const hostname = parsed.hostname.toLowerCase();

    // 2. IP adresleri, localhost veya iç ağ / cloud metadata isimleri engellenir
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || // IPv4
      hostname.includes(':') || // IPv6
      hostname.startsWith('127.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('169.254.')
    ) {
      return false;
    }

    // 3. Yalnızca GİB ve bilinen güvenli e-Belge / perakende alan adları
    const isTrusted = TRUSTED_EBELGE_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith(`.${domain}`)
    );

    return isTrusted;
  } catch {
    return false;
  }
}

/**
 * QR Kod URL'sini güvenli bir şekilde arka planda çeker ve ayrıştırır (SSRF Korumalı)
 */
export async function fetchAndParseEBelge(url: string): Promise<EBelgeParseResult | null> {
  if (!url || typeof url !== 'string' || !isSafeEBelgeUrl(url)) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[eBelge Parser] HTTP ${response.status} URL: ${url}`);
      return null;
    }

    const html = await response.text();
    return parseEBelgeHtml(html, url);
  } catch (err: any) {
    console.warn(`[eBelge Parser] Fetch error for ${url}:`, err.message || err);
    return null;
  }
}
