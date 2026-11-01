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
 * Türkçe Para / Tutar Formatını Güvenli Sayıya Dönüştürür (1000 Kat Hata Önleme - Bulgu 3)
 * Desteklenen Formatlar:
 * "1.250,50" -> 1250.50
 * "1.250 TL" -> 1250
 * "500,25" -> 500.25
 * "150" -> 150
 * "1.250.000 TL" -> 1250000
 */
export function parseTurkishNumber(val: string | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val !== 'string') return 0;

  let str = val.trim();
  str = str.replace(/[^\d.,\-+]/g, '');
  if (!str) return 0;

  const lastDot = str.lastIndexOf('.');
  const lastComma = str.lastIndexOf(',');

  if (lastDot !== -1 && lastComma !== -1) {
    if (lastComma > lastDot) {
      // Örn: "1.250,50" veya "1.250.000,75" -> Noktaları at, virgülü noktaya çevir
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Örn: "1,250.50" veya "1,250,000.75" -> Virgülleri at
      str = str.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    const commaCount = (str.match(/,/g) || []).length;
    if (commaCount > 1 || /^[\-+]?\d{1,3}(,\d{3})+$/.test(str)) {
      // Örn: "1,250,000" -> Binlik ayracı virgül
      str = str.replace(/,/g, '');
    } else {
      // Örn: "500,25" -> Ondalık ayracı virgül
      str = str.replace(',', '.');
    }
  } else if (lastDot !== -1) {
    const dotCount = (str.match(/\./g) || []).length;
    if (dotCount > 1 || /^[\-+]?\d{1,3}(\.\d{3})+$/.test(str)) {
      // Örn: "1.250" veya "1.250.000" -> Binlik ayracı nokta
      str = str.replace(/\./g, '');
    }
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
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
    trimmed.startsWith('<?xml') ||
    trimmed.includes('<Invoice') ||
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

  const amount = parseTurkishNumber(dict['TOPLAM']);
  const tax = parseTurkishNumber(dict['KDV']);
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
    const rawVal = totalMatch[1].replace(/<[^>]+>/g, '').trim();
    amount = parseTurkishNumber(rawVal);
  }

  // 4. KDV Tutarı
  let tax_amount = 0;
  const taxMatch =
    html.match(/TOPLAM KDV\s*:[\s\S]*?<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i) ||
    html.match(/TOPLAM KDV\s*:\s*([\d.,]+)/i);
  if (taxMatch) {
    const rawTax = taxMatch[1].replace(/<[^>]+>/g, '').trim();
    tax_amount = parseTurkishNumber(rawTax);
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
          const qty = parseTurkishNumber(cells[3]) || 1;
          const price = parseTurkishNumber(cells[8] || cells[6] || cells[5]) || 0;
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

/**
 * UBL-TR Standart XML e-Fatura / e-Arşiv Ayrıştırıcısı (Bulgu 21)
 */
export function parseUblTrXml(xmlText: string, originalUrl: string = ''): EBelgeParseResult | null {
  if (!xmlText || (!xmlText.includes('<Invoice') && !xmlText.includes(':Invoice') && !xmlText.includes('xmlns'))) {
    return null;
  }

  // 1. Satıcı / Merchant Adı
  let merchant = 'Kurumsal E-Fatura';
  const supplierMatch =
    xmlText.match(/<cac:AccountingSupplierParty>[\s\S]*?<cbc:Name>([\s\S]*?)<\/cbc:Name>/i) ||
    xmlText.match(/<cac:PartyName>[\s\S]*?<cbc:Name>([\s\S]*?)<\/cbc:Name>/i) ||
    xmlText.match(/<cac:PartyLegalEntity>[\s\S]*?<cbc:RegistrationName>([\s\S]*?)<\/cbc:RegistrationName>/i);
  if (supplierMatch) {
    merchant = supplierMatch[1].replace(/<[^>]+>/g, '').trim();
  }

  // 2. VKN / TCKN
  const vknMatch = xmlText.match(/<cac:AccountingSupplierParty>[\s\S]*?<cbc:ID[^>]*schemeID="VKN"[^>]*>([\s\S]*?)<\/cbc:ID>/i) ||
                   xmlText.match(/<cbc:ID[^>]*schemeID="(?:VKN|TCKN)"[^>]*>([\s\S]*?)<\/cbc:ID>/i);
  const vkn = vknMatch ? vknMatch[1].trim() : undefined;

  // 3. Fatura Tarihi
  let date = new Date().toISOString().split('T')[0];
  const dateMatch = xmlText.match(/<cbc:IssueDate>([\s\S]*?)<\/cbc:IssueDate>/i);
  if (dateMatch) {
    date = dateMatch[1].trim();
  }

  // 4. Ödenecek Tutar
  let amount = 0;
  const payableMatch = xmlText.match(/<cbc:PayableAmount[^>]*>([\s\S]*?)<\/cbc:PayableAmount>/i) ||
                      xmlText.match(/<cbc:TaxInclusiveAmount[^>]*>([\s\S]*?)<\/cbc:TaxInclusiveAmount>/i) ||
                      xmlText.match(/<cbc:LineExtensionAmount[^>]*>([\s\S]*?)<\/cbc:LineExtensionAmount>/i);
  if (payableMatch) {
    amount = parseTurkishNumber(payableMatch[1].trim());
  }

  // 5. KDV Tutarı
  let taxAmount = 0;
  const taxMatch = xmlText.match(/<cac:TaxTotal>[\s\S]*?<cbc:TaxAmount[^>]*>([\s\S]*?)<\/cbc:TaxAmount>/i);
  if (taxMatch) {
    taxAmount = parseTurkishNumber(taxMatch[1].trim());
  }

  // 6. ETTN (UUID) & Fatura Numarası
  const uuidMatch = xmlText.match(/<cbc:UUID>([\s\S]*?)<\/cbc:UUID>/i);
  const ettn = uuidMatch ? uuidMatch[1].trim() : undefined;

  const idMatch = xmlText.match(/<cbc:ID>([\s\S]*?)<\/cbc:ID>/i);
  const referenceNumber = idMatch ? idMatch[1].trim() : undefined;

  // 7. Kalemler (InvoiceLine)
  const items: Array<{ name: string; price: number; quantity?: number; barcode?: string; vat_rate?: number }> = [];
  const lineRegex = /<cac:InvoiceLine>([\s\S]*?)<\/cac:InvoiceLine>/gi;
  let lineMatch;
  while ((lineMatch = lineRegex.exec(xmlText)) !== null) {
    const lineContent = lineMatch[1];
    const nameMatch = lineContent.match(/<cac:Item>[\s\S]*?<cbc:Name>([\s\S]*?)<\/cbc:Name>/i);
    const qtyMatch = lineContent.match(/<cbc:InvoicedQuantity[^>]*>([\s\S]*?)<\/cbc:InvoicedQuantity>/i);
    const priceMatch =
      lineContent.match(/<cac:Price>[\s\S]*?<cbc:PriceAmount[^>]*>([\s\S]*?)<\/cbc:PriceAmount>/i) ||
      lineContent.match(/<cbc:LineExtensionAmount[^>]*>([\s\S]*?)<\/cbc:LineExtensionAmount>/i);

    if (nameMatch) {
      const name = nameMatch[1].replace(/<[^>]+>/g, '').trim();
      const qty = qtyMatch ? parseTurkishNumber(qtyMatch[1]) : 1;
      const price = priceMatch ? parseTurkishNumber(priceMatch[1]) : 0;
      if (name && price > 0) {
        items.push({
          name,
          price,
          quantity: qty > 0 ? qty : 1
        });
      }
    }
  }

  if (amount === 0 && items.length > 0) {
    amount = items.reduce((sum, item) => sum + item.price, 0);
  }

  return {
    merchant: vkn && merchant === 'Kurumsal E-Fatura' ? `Kurumsal Fatura (VKN: ${vkn})` : merchant,
    amount,
    currency: 'TRY',
    date,
    category_id: 'cat-market',
    category_name: 'Market & Gıda',
    items,
    tax_amount: taxAmount > 0 ? taxAmount : undefined,
    confidence: 1.0,
    reference_number: referenceNumber,
    ettn,
    qr_url: originalUrl || undefined,
    source_type: 'qr_ebelge',
    raw_text: `UBL-TR e-Fatura / e-Arşiv: ${referenceNumber || ettn || ''}`
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
 * QR Kod URL'sini güvenli bir şekilde arka planda çeker ve ayrıştırır (SSRF ve Body Limit Korumalı)
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

    // Content-Length kontrolü (Maksimum 5MB)
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 5 * 1024 * 1024) {
      console.warn(`[eBelge Parser] Boyut sınırı aşıldı: ${contentLength} bayt`);
      return null;
    }

    const rawText = await response.text();
    // Maksimum 2MB metin işle (ReDoS / OOM engelle)
    const text = rawText.slice(0, 2 * 1024 * 1024);

    if (text.trim().startsWith('<?xml') || text.includes('<Invoice') || text.includes(':Invoice')) {
      const xmlRes = parseUblTrXml(text, url);
      if (xmlRes) return xmlRes;
    }

    return parseEBelgeHtml(text, url);
  } catch (err: any) {
    console.warn(`[eBelge Parser] Fetch error for ${url}:`, err.message || err);
    return null;
  }
}
