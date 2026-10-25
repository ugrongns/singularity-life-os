import { NextResponse } from 'next/server';
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

    // Vercel Serverless ve PostgreSQL için 4.5 MB güvenlik sınırı
    if (file.size > 4.5 * 1024 * 1024) {
      return NextResponse.json({
        success: false,
        error: 'Dosya boyutu çok yüksek. Lütfen 4.5 MB altı bir dosya yükleyin.'
      }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Dosya uzantısını ve MIME tipini belirle
    const ext = path.extname(file.name).toLowerCase();
    const mimeType = file.type || (
      ext === '.pdf' ? 'application/pdf' :
      ext === '.png' ? 'image/png' :
      ext === '.webp' ? 'image/webp' :
      'image/jpeg'
    );

    // Kalıcı Depolama: Vercel geçici diski yerine Base64 Data URI olarak PostgreSQL'e saklanır
    // Böylece sunucu cold start veya konteyner sıfırlanmalarında veri kaybı %100 önlenir
    const secureUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;

    return NextResponse.json({
      success: true,
      url: secureUrl,
      fileName: file.name,
      message: '📁 Belge kalıcı dijital kasaya başarıyla yüklendi!'
    });
  } catch (error: any) {
    console.error('Upload Vault Document Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
