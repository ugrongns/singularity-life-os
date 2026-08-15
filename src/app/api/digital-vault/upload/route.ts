import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'Hiçbir dosya seçilmedi.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // public/uploads/vault dizinini oluştur (yoksa)
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'vault');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Dosya uzantısını belirle (.pdf, .jpg, .png, .webp vs.)
    const ext = path.extname(file.name) || '.jpg';
    const filename = `vault-${Date.now()}-${Math.random().toString(36).substring(2, 7)}${ext}`;
    const filePath = path.join(uploadDir, filename);

    // Dosyayı diske yaz
    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/vault/${filename}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      fileName: file.name,
      message: '📁 Belge başarıyla yüklendi!'
    });
  } catch (error: any) {
    console.error('Upload Vault Document Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
