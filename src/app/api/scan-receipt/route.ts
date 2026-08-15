import { NextResponse } from 'next/server';
import { parseReceiptImage } from '@/lib/ai-vision';

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let base64Images: string[] = [];
    let mimeTypes: string[] = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const files = formData.getAll('files') as File[];
      const base64Inputs = formData.getAll('base64Images') as string[];

      if (files.length > 0) {
        for (const file of files) {
          if (!(file instanceof File)) continue;
          const buffer = Buffer.from(await file.arrayBuffer());
          base64Images.push(buffer.toString('base64'));
          mimeTypes.push(file.type || 'image/jpeg');
        }
      } else if (base64Inputs.length > 0) {
        base64Images = base64Inputs;
        mimeTypes = base64Inputs.map(() => 'image/jpeg');
      }
    } else if (contentType.includes('application/json')) {
      const body = await req.json();
      base64Images = body.base64Images || [];
      mimeTypes = body.mimeTypes || [];
    }

    // AI Vision Pipeline ile Fişi Tara (Görsel yoksa bile akıllı varsayılan taslak döndürür)
    const parsedDraft = await parseReceiptImage(base64Images, mimeTypes);

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
