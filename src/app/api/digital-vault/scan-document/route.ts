import { NextResponse } from 'next/server';
import { parseVaultDocumentImage } from '@/lib/ai-vision';
import { getAuthUser } from '@/lib/auth';
import path from 'path';

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_BASE64_LENGTH = 15 * 1024 * 1024; // ~10 MB payload in base64

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
        if (file.size > MAX_FILE_SIZE) {
          return NextResponse.json({
            success: false,
            error: 'Dosya boyutu çok yüksek. Lütfen 10 MB altı bir dosya yükleyin.'
          }, { status: 400 });
        }

        const ext = path.extname(file.name).toLowerCase();
        const fMime = (file.type || '').toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext) || (fMime && !ALLOWED_MIME_TYPES.includes(fMime))) {
          return NextResponse.json({
            success: false,
            error: 'Geçersiz dosya formatı. Sadece JPG, PNG, WEBP veya PDF yükleyebilirsiniz.'
          }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        base64Image = buffer.toString('base64');
        mimeType = fMime || (ext === '.pdf' ? 'application/pdf' : ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg');

        documentImageUrl = `data:${mimeType};base64,${base64Image}`;
      } else if (base64Input) {
        if (base64Input.length > MAX_BASE64_LENGTH) {
          return NextResponse.json({ success: false, error: 'Base64 veri boyutu sınırı aşıldı.' }, { status: 400 });
        }
        base64Image = base64Input;
        documentImageUrl = base64Input.startsWith('data:') ? base64Input : `data:${mimeType};base64,${base64Image}`;
      }
    } else if (contentType.includes('application/json')) {
      const body = await req.json();
      base64Image = body.base64 || '';
      mimeType = (body.mimeType || 'image/jpeg').toLowerCase();
      if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
        return NextResponse.json({
          success: false,
          error: 'Geçersiz MIME tipi. Sadece JPG, PNG, WEBP veya PDF desteklenir.'
        }, { status: 400 });
      }
      if (base64Image) {
        if (base64Image.length > MAX_BASE64_LENGTH) {
          return NextResponse.json({ success: false, error: 'Base64 veri boyutu sınırı aşıldı.' }, { status: 400 });
        }
        documentImageUrl = base64Image.startsWith('data:') ? base64Image : `data:${mimeType};base64,${base64Image}`;
      }
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
