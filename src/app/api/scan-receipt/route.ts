import { NextResponse } from 'next/server';
import { parseReceiptImage } from '@/lib/ai-vision';
import { fetchAndParseEBelge, parseGibKarekodText, isEBelgeOrQRUrl } from '@/lib/ebelge-parser';
import { getAuthUser } from '@/lib/auth';

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
          const buffer = Buffer.from(await (file as any).arrayBuffer());
          base64Images.push(buffer.toString('base64'));
          mimeTypes.push((file as any).type || 'image/jpeg');
        }
      }
      
      if (base64Images.length === 0 && base64Inputs.length > 0) {
        base64Images = base64Inputs;
        mimeTypes = base64Inputs.map(() => 'image/jpeg');
      }
    } else if (contentType.includes('application/json')) {
      const body = await req.json();
      base64Images = body.base64Images || [];
      mimeTypes = body.mimeTypes || [];
      if (body.qr_data && typeof body.qr_data === 'string') {
        qrData = body.qr_data.trim();
      }
    }

    // 1. ÖNCELİKLİ HIZLI YOL: GİB / e-Belge Karekod Çözümleme
    if (qrData) {
      console.log(`[Scan Receipt] QR Karekod algılandı: ${qrData.substring(0, 100)}...`);

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
