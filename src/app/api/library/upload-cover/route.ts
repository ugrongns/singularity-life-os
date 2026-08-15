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

    // public/uploads/covers dizinini oluştur (yoksa)
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'covers');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Dosya uzantısını belirle (.jpg, .png, .webp vs.)
    const ext = path.extname(file.name) || '.jpg';
    const filename = `cover-${Date.now()}-${Math.random().toString(36).substring(2, 7)}${ext}`;
    const filePath = path.join(uploadDir, filename);

    // Dosyayı diske yaz
    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/covers/${filename}`;

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
