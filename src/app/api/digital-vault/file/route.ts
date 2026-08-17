import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const rawFilename = searchParams.get('filename');

    if (!rawFilename) {
      return NextResponse.json({ success: false, error: 'Dosya adı belirtilmedi.' }, { status: 400 });
    }

    // Path traversal koruması (.., /, \ engelle)
    const sanitizedFilename = path.basename(rawFilename);
    if (!sanitizedFilename || sanitizedFilename.includes('..')) {
      return NextResponse.json({ success: false, error: 'Geçersiz dosya adı.' }, { status: 400 });
    }

    // Önce private_storage/vault'a bak, geriye dönük uyumluluk için public/uploads/vault'a bak
    let filePath = path.join(process.cwd(), 'private_storage', 'vault', sanitizedFilename);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(process.cwd(), 'public', 'uploads', 'vault', sanitizedFilename);
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ success: false, error: 'Belge dosyası bulunamadı.' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const ext = path.extname(sanitizedFilename).toLowerCase();

    let contentType = 'application/octet-stream';
    if (ext === '.pdf') contentType = 'application/pdf';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.webp') contentType = 'image/webp';

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${sanitizedFilename}"`,
        'Cache-Control': 'private, max-age=3600'
      }
    });
  } catch (error: any) {
    console.error('Serve Vault File Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
