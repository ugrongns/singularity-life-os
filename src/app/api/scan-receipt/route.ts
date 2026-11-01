import { NextResponse } from 'next/server';
import path from 'path';
import { parseReceiptImage } from '@/lib/ai-vision';
import { fetchAndParseEBelge, parseGibKarekodText, parseUblTrXml, isEBelgeOrQRUrl } from '@/lib/ebelge-parser';
import { getAuthUser } from '@/lib/auth';

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.xml'];
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/xml', 'text/xml'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_BASE64_LENGTH = 15 * 1024 * 1024; // 15 MB

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 });
    }

    const contentType = req.headers.get('content-type') || '';
    let base64Images: string[] = [];
    let mimeTypes: string[] = [];
    let qrData: string | undefined;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const files = formData.getAll('files') as File[];
      const base64Inputs = formData.getAll('base64Images') as string[];
      const rawQr = formData.get('qr_data') as string;
      if (rawQr && rawQr.trim()) {
        qrData = rawQr.trim();
      }

      if (files.length > 0) {
        for (const file of files) {
          if (!file || typeof (file as any).arrayBuffer !== 'function') continue;
          if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({
              success: false,
              error: 'Dosya boyutu çok yüksek. Lütfen 10 MB altı bir dosya yükleyin.'
            }, { status: 400 });
          }

          const ext = path.extname(file.name || '').toLowerCase();
          const fMime = (file.type || '').toLowerCase();
          if ((ext && !ALLOWED_EXTENSIONS.includes(ext)) || (fMime && !ALLOWED_MIME_TYPES.includes(fMime))) {
            return NextResponse.json({
              success: false,
              error: 'Geçersiz dosya türü. Sadece JPG, PNG, WEBP, PDF veya XML yükleyebilirsiniz.'
            }, { status: 400 });
          }

          const buffer = Buffer.from(await (file as any).arrayBuffer());

          // XML e-Fatura / e-Arşiv Dosyası Doğrudan Ayrıştırma (Bulgu 21)
          if (ext === '.xml' || fMime.includes('xml')) {
            const xmlStr = buffer.toString('utf8');
            const ublResult = parseUblTrXml(xmlStr);
            if (ublResult) {
              return NextResponse.json({ success: true, data: ublResult });
            }
          }

          base64Images.push(buffer.toString('base64'));
          mimeTypes.push(fMime || 'image/jpeg');
        }
      }
      
      if (base64Images.length === 0 && base64Inputs.length > 0) {
        for (const b64 of base64Inputs) {
          if (b64.length > MAX_BASE64_LENGTH) {
            return NextResponse.json({ success: false, error: 'Base64 veri boyutu 15 MB sınırını aşıyor.' }, { status: 400 });
          }
          base64Images.push(b64);
          mimeTypes.push('image/jpeg');
        }
      }
    } else if (contentType.includes('application/json')) {
      const body = await req.json();
      base64Images = body.base64Images || [];
      mimeTypes = body.mimeTypes || [];
      if (body.qr_data && typeof body.qr_data === 'string') {
        qrData = body.qr_data.trim();
      }

      for (const b64 of base64Images) {
        if (b64.length > MAX_BASE64_LENGTH) {
          return NextResponse.json({ success: false, error: 'Base64 veri boyutu 15 MB sınırını aşıyor.' }, { status: 400 });
        }
      }
    }

    // 1. ÖNCELİKLİ HIZLI YOL: GİB / e-Belge / UBL-TR Karekod Çözümleme
    if (qrData) {
      console.log(`[Scan Receipt] QR Karekod algılandı: ${qrData.substring(0, 100)}...`);

      // A. XML İçeriği Doğrudan Ayrıştırma
      if (qrData.startsWith('<?xml') || qrData.includes('<Invoice') || qrData.includes(':Invoice')) {
        const ublResult = parseUblTrXml(qrData);
        if (ublResult && (ublResult.amount > 0 || ublResult.merchant)) {
          return NextResponse.json({ success: true, data: ublResult });
        }
      }

      // A. GİB Standart Karekod Metni (VKN/ETTN/TOPLAM)
      const gibResult = parseGibKarekodText(qrData);
      if (gibResult && (gibResult.amount > 0 || gibResult.merchant)) {
        return NextResponse.json({
          success: true,
          data: gibResult
        });
      }

      // B. e-Belge / Entegratör URL'si (Fitbulut / Sovos / Migros / GİB vb.)
      if (qrData.startsWith('http')) {
        const eBelgeResult = await fetchAndParseEBelge(qrData);
        if (eBelgeResult && (eBelgeResult.amount > 0 || eBelgeResult.items.length > 0)) {
          return NextResponse.json({
            success: true,
            data: eBelgeResult
          });
        }
      }
    }

    // 2. AI Vision Pipeline ile Fişi Tara (Görsel ve varsa QR verisini birlikte analiz et)
    const parsedDraft = await parseReceiptImage(base64Images, mimeTypes, qrData);

    // Kural: Asla doğrudan veritabanına yazma (No auto-commit).
    // Kullanıcının 1 tıkla onaylaması ve taksit seçmesi için taslak olarak geri dön.
    return NextResponse.json({
      success: true,
      data: parsedDraft
    });
  } catch (error: any) {
    console.error('Scan Receipt Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
