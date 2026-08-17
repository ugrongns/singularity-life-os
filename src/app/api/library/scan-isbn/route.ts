import { NextResponse } from 'next/server';
import { parseBookCoverOrISBNImage } from '@/lib/ai-vision';
import { getAuthUser } from '@/lib/auth';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 });
    }

    const body = await req.json();
    const { image_base64, mime_type } = body;

    if (!image_base64) {
      return NextResponse.json({ success: false, error: 'Lütfen analiz edilecek bir kitap kapağı görseli yükleyin.' }, { status: 400 });
    }

    const visionResult = await parseBookCoverOrISBNImage(image_base64, mime_type || 'image/jpeg');

    if (!visionResult.title || visionResult.title === 'Taranan Kitap' || visionResult.title === 'Kitap Tam Adı') {
      return NextResponse.json({
        success: false,
        error: 'Görselden kitap başlığı okunamadı. Lütfen kapak fotoğrafının net olduğundan emin olun.'
      }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      data: {
        title: visionResult.title,
        author: visionResult.author || '',
        publisher: visionResult.publisher || '',
        isbn: visionResult.isbn || '',
        total_pages: visionResult.total_pages || 200,
        category: visionResult.category || 'Kişisel Gelişim',
        summary: visionResult.summary || ''
      },
      message: `📸 Kitap kapağından "${visionResult.title}" (${visionResult.author || 'Yazar'}) tanımlandı!`
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Görsel işlenirken bir hata oluştu.' }, { status: 500 });
  }
}
