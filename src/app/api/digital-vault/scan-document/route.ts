import { NextResponse } from 'next/server';
import { parseVaultDocumentImage } from '@/lib/ai-vision';
import fs from 'fs';
import path from 'path';
import { getAuthUser } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 });
    }

    const contentType = req.headers.get('content-type') || '';
    let base64Image = '';
    let mimeType = 'image/jpeg';
    let documentImageUrl = '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const base64Input = formData.get('base64') as string | null;

      if (file) {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        base64Image = buffer.toString('base64');
        mimeType = file.type || 'image/jpeg';

        // Yüklenen resmi güvenli dizine kaydet (private_storage/vault/...)
        const uploadDir = path.join(process.cwd(), 'private_storage', 'vault');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        const ext = path.extname(file.name) || '.jpg';
        const filename = `vault-scan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}${ext}`;
        const filePath = path.join(uploadDir, filename);
        fs.writeFileSync(filePath, buffer);

        documentImageUrl = `/api/digital-vault/file?filename=${filename}`;
      } else if (base64Input) {
        base64Image = base64Input;
      }
    } else if (contentType.includes('application/json')) {
      const body = await req.json();
      base64Image = body.base64 || '';
      mimeType = body.mimeType || 'image/jpeg';
    }

    if (!base64Image) {
      return NextResponse.json({ success: false, error: 'Belge görseli bulunamadı.' }, { status: 400 });
    }

    // AI Vision Pipeline ile Belgeyi Oku ve Ayrıştır
    const parsedDraft = await parseVaultDocumentImage(base64Image, mimeType);

    return NextResponse.json({
      success: true,
      data: {
        ...parsedDraft,
        document_image_url: documentImageUrl || null
      },
      message: '📸 Belge AI ile başarıyla okundu!'
    });
  } catch (error: any) {
    console.error('Scan Document Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
