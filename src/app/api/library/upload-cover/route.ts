import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getAuthUser } from '@/lib/auth';

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

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
        error: 'Dosya boyutu çok yüksek. Lütfen 10 MB altı bir dosya yükleyin.'
      }, { status: 400 });
    }

    // 2. Uzantı ve MIME Tipi Kontrolü
    const ext = path.extname(file.name).toLowerCase();
    const mimeType = (file.type || '').toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(ext) || (mimeType && !ALLOWED_MIME_TYPES.includes(mimeType))) {
      return NextResponse.json({
        success: false,
        error: 'Geçersiz dosya türü. Sadece JPG, PNG, WEBP veya PDF yükleyebilirsiniz.'
      }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let publicUrl = '';

    // 1. Yerel ortamda diske yazmayı dene (localhost)
    try {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'covers');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const fileExt = ext || '.jpg';
      const filename = `cover-${Date.now()}-${Math.random().toString(36).substring(2, 7)}${fileExt}`;
      const filePath = path.join(uploadDir, filename);

      fs.writeFileSync(filePath, buffer);
      publicUrl = `/uploads/covers/${filename}`;
    } catch (fsError) {
      // 2. Vercel / Serverless ortamlarda disk salt-okunur (EROFS) olduğu için Base64 Data URL'e düş
      console.warn('Filesystem read-only (Serverless environment), converting cover to Base64 Data URL.');
      const effectiveMime = mimeType || (ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.pdf' ? 'application/pdf' : 'image/jpeg');
      publicUrl = `data:${effectiveMime};base64,${buffer.toString('base64')}`;
    }

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
