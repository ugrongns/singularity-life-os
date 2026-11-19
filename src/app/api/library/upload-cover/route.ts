import { NextResponse } from 'next/server';
import path from 'path';
import { getAuthUser } from '@/lib/auth';

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 4.5 * 1024 * 1024; // 4.5 MB (Vercel serverless & DB güvenliği)

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'Hiçbir dosya seçilmedi.' }, { status: 400 });
    }

    // 1. Boyut Sınırı Kontrolü
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        success: false,
        error: 'Dosya boyutu çok yüksek. Lütfen 4.5 MB altı bir görsel yükleyin.'
      }, { status: 400 });
    }

    // 2. Uzantı ve MIME Tipi Kontrolü
    const ext = path.extname(file.name).toLowerCase();
    const mimeType = (file.type || '').toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(ext) || (mimeType && !ALLOWED_MIME_TYPES.includes(mimeType))) {
      return NextResponse.json({
        success: false,
        error: 'Geçersiz dosya türü. Sadece JPG, PNG veya WEBP görseli yükleyebilirsiniz.'
      }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Kapak görsellerini herkese açık public/ dizinine yazmak yerine kalıcı Base64 Data URL olarak döndür
    const effectiveMime = mimeType || (ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg');
    const publicUrl = `data:${effectiveMime};base64,${buffer.toString('base64')}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      message: '📷 Kapak fotoğrafı başarıyla yüklendi!'
    });
  } catch (error: any) {
    console.error('Upload Cover Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
