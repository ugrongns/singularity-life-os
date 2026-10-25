import { describe, it, expect } from 'vitest';
import { isEBelgeOrQRUrl, parseGibKarekodText, parseEBelgeHtml, isSafeEBelgeUrl } from '../src/lib/ebelge-parser';

describe('e-Belge & QR Fiş / Fatura Parser', () => {
  it('isSafeEBelgeUrl prevents SSRF attacks and blocks non-whitelisted/internal hosts', () => {
    // Valid HTTPS whitelist hosts
    expect(isSafeEBelgeUrl('https://ebelge.gib.gov.tr/earsiv/fatura/123')).toBe(true);
    expect(isSafeEBelgeUrl('https://sites.fitbulut.com/view?id=123')).toBe(true);
    expect(isSafeEBelgeUrl('https://fatura.migros.com.tr/fis/123')).toBe(true);

    // SSRF vectors: localhost, private IP, AWS metadata, plaintext http
    expect(isSafeEBelgeUrl('http://169.254.169.254/latest/meta-data/')).toBe(false);
    expect(isSafeEBelgeUrl('https://169.254.169.254/')).toBe(false);
    expect(isSafeEBelgeUrl('http://127.0.0.1:3000/api/secret')).toBe(false);
    expect(isSafeEBelgeUrl('https://127.0.0.1:8080/')).toBe(false);
    expect(isSafeEBelgeUrl('http://localhost:3000')).toBe(false);
    expect(isSafeEBelgeUrl('https://localhost/')).toBe(false);
    expect(isSafeEBelgeUrl('https://192.168.1.1/admin')).toBe(false);
    expect(isSafeEBelgeUrl('https://10.0.0.1/')).toBe(false);
    expect(isSafeEBelgeUrl('https://evil-hacker.com/malicious-receipt')).toBe(false);
    expect(isSafeEBelgeUrl('ftp://ebelge.gib.gov.tr/fatura')).toBe(false);
    expect(isSafeEBelgeUrl('')).toBe(false);
  });

  it('isEBelgeOrQRUrl correctly detects QR links and GİB codes', () => {
    expect(isEBelgeOrQRUrl('https://sites.fitbulut.com/eBelgeGoruntuleyici/ViewDocument.aspx?ID=6220529513&UUID=36407bb8-3882-4ed7-8afa-54fed93e587f')).toBe(true);
    expect(isEBelgeOrQRUrl('https://ebelge.gib.gov.tr/earsiv/fatura/123')).toBe(true);
    expect(isEBelgeOrQRUrl('VKN:6220529513|TARIH:2026-10-24|TOPLAM:430.85|KDV:22.25')).toBe(true);
    expect(isEBelgeOrQRUrl('random text 12345')).toBe(false);
    expect(isEBelgeOrQRUrl('')).toBe(false);
  });

  it('parseGibKarekodText extracts fields from standard pipe-delimited text', () => {
    const rawGib = 'VKN:6220529513|TARIH:24-10-2026|SAAT:15:46:00|TOPLAM:430,85|KDV:22,25|ETTN:36407bb8-3882-4ed7-8afa-54fed93e587f|REF:063921026770261024';
    const result = parseGibKarekodText(rawGib);

    expect(result).not.toBeNull();
    expect(result?.merchant).toBe('MİGROS TİCARET A.Ş.');
    expect(result?.amount).toBe(430.85);
    expect(result?.tax_amount).toBe(22.25);
    expect(result?.date).toBe('2026-10-24');
    expect(result?.ettn).toBe('36407bb8-3882-4ed7-8afa-54fed93e587f');
    expect(result?.reference_number).toBe('063921026770261024');
    expect(result?.source_type).toBe('qr_gib_code');
  });

  it('parseEBelgeHtml accurately extracts store, items, amounts, and dates from e-Belge HTML', () => {
    const sampleHtml = `
      <html>
        <body>
          <tr><td><span>Mağaza:</span></td><td>6392- YENI BATI ANKARA MM MIGROS</td></tr>
          <tr><td><span>Fatura Tarihi:</span></td><td>24-10-2026</td></tr>
          <tr><td>Referans No:</td><td>063921026770261024</td></tr>
          <div>ETTN: 36407bb8-3882-4ed7-8afa-54fed93e587f</div>
          <table>
            <tr>
              <td>Ürün Kodu</td><td>Ürün Barkodu</td><td>Ürün Adı</td>
              <td>Miktar</td><td>Birim</td><td>Birim Fiyat</td><td>Brüt Tutar</td>
              <td>İskonto</td><td>İsk. Sonrası Brüt Tutar</td><td>KDV</td>
            </tr>
            <tr>
              <td>20001073</td><td>8697581702809</td><td>MLIFE KAFESSİZ M BOY TAVUK YUMURTASI 10 LU 53-62 G</td>
              <td>1</td><td>Adet</td><td>104,95</td><td>104.95</td><td></td><td>104.95</td><td>1</td>
            </tr>
            <tr>
              <td>31113664</td><td>8006530170062</td><td>ORKİD PLATINUM GECE EKSTRA PLUS 14 LÜ</td>
              <td>1</td><td>Adet</td><td>219,95</td><td>219.95</td><td></td><td>219.95</td><td>10</td>
            </tr>
            <tr>
              <td>32090075</td><td>2001111341301</td><td>MİGROS PLASTİK POŞET YENİ</td>
              <td>1</td><td>Adet</td><td>1,00</td><td>1.00</td><td></td><td>1.00</td><td>20</td>
            </tr>
          </table>
          <table>
            <tr><td><strong> ARA TOPLAM :</strong></td><td> 325.90</td></tr>
            <tr><td><strong> FATURA TOPLAMI :</strong></td><td> 325.90</td></tr>
            <tr><td><strong> TOPLAM KDV :</strong></td><td> 22.08</td></tr>
          </table>
        </body>
      </html>
    `;

    const result = parseEBelgeHtml(sampleHtml, 'https://sites.fitbulut.com/view#Refid063921026770261024');

    expect(result.merchant).toBe('MİGROS (YENI BATI ANKARA MM MIGROS)');
    expect(result.date).toBe('2026-10-24');
    expect(result.amount).toBe(325.90);
    expect(result.tax_amount).toBe(22.08);
    expect(result.reference_number).toBe('063921026770261024');
    expect(result.ettn).toBe('36407bb8-3882-4ed7-8afa-54fed93e587f');
    expect(result.items.length).toBe(3);
    expect(result.items[0].name).toBe('MLIFE KAFESSİZ M BOY TAVUK YUMURTASI 10 LU 53-62 G');
    expect(result.items[0].barcode).toBe('8697581702809');
    expect(result.items[0].price).toBe(104.95);
    expect(result.items[1].name).toBe('ORKİD PLATINUM GECE EKSTRA PLUS 14 LÜ');
    expect(result.items[1].price).toBe(219.95);
    expect(result.items[2].name).toBe('MİGROS PLASTİK POŞET YENİ');
    expect(result.items[2].price).toBe(1.00);
    expect(result.source_type).toBe('qr_ebelge');
    expect(result.confidence).toBe(1.0);
  });
});
