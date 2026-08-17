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

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // private_storage/vault dizinini oluştur (public dışı güvenli alan)
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
    const secureUrl = `/api/digital-vault/file?filename=${filename}`;

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
