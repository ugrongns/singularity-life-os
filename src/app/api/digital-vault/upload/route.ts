import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getAuthUser } from '@/lib/auth';

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

    // Vercel Serverless 4.5 MB sınırına karşı güvenlik kontrolü
    if (file.size > 4.5 * 1024 * 1024) {
      return NextResponse.json({
        success: false,
        error: 'Dosya boyutu çok yüksek. Lütfen 4.5 MB altı bir dosya yükleyin.'
      }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let secureUrl = '';

    // 1. Yerel ortamda diske yazmayı dene (localhost)
    try {
      const uploadDir = path.join(process.cwd(), 'private_storage', 'vault');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Dosya uzantısını belirle (.pdf, .jpg, .png, .webp vs.)
      const ext = path.extname(file.name) || '.jpg';
      const filename = `vault-${Date.now()}-${Math.random().toString(36).substring(2, 7)}${ext}`;
      const filePath = path.join(uploadDir, filename);

      // Dosyayı güvenli dizine yaz
      fs.writeFileSync(filePath, buffer);

      // Dış dünyaya açık statik URL yerine auth kontrollü API ucu döndür
      secureUrl = `/api/digital-vault/file?filename=${filename}`;
    } catch (fsError) {
      // 2. Vercel / Serverless ortamlarda disk salt-okunur (EROFS) olduğu için Base64 Data URL'e düş
      console.warn('Filesystem read-only (Serverless environment), converting document to Base64 Data URL.');
      const ext = path.extname(file.name).toLowerCase();
      const mimeType = file.type || (ext === '.pdf' ? 'application/pdf' : ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg');
      secureUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
    }

    return NextResponse.json({
      success: true,
      url: secureUrl,
      fileName: file.name,
      message: '📁 Belge güvenli dijital kasaya yüklendi!'
    });
  } catch (error: any) {
    console.error('Upload Vault Document Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
