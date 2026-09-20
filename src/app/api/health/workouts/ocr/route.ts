import { NextResponse } from 'next/server';
import { parseWorkoutImage } from '@/lib/workout-ocr';
import { getAuthUser } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 });
    }

    const contentType = req.headers.get('content-type') || '';
    let base64Images: string[] = [];
    let mimeTypes: string[] = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const files = formData.getAll('files') as File[];
      const base64Inputs = formData.getAll('base64Images') as string[];

      if (files.length > 0) {
        for (const file of files) {
          if (!(file instanceof File)) continue;
          const buffer = Buffer.from(await file.arrayBuffer());
          base64Images.push(buffer.toString('base64'));
          mimeTypes.push(file.type || 'image/jpeg');
        }
      } else if (base64Inputs.length > 0) {
        base64Images = base64Inputs;
        mimeTypes = base64Inputs.map(() => 'image/jpeg');
      }
    } else if (contentType.includes('application/json')) {
      const body = await req.json();
      base64Images = body.base64Images || [];
      mimeTypes = body.mimeTypes || [];
    }

    if (base64Images.length === 0) {
      return NextResponse.json({ success: false, error: 'Lütfen en az bir ekran görüntüsü yükleyin.' }, { status: 400 });
    }

    // AI Vision ile antrenman ekran görüntüsünü tara
    const parsedDraft = await parseWorkoutImage(base64Images, mimeTypes);

    // Kural: Doğrudan DB'ye kaydetme (No auto-commit).
    // Kullanıcının modalda inceleyip tek tıkla onaylaması için taslak döndür.
    return NextResponse.json({
      success: true,
      data: parsedDraft
    });
  } catch (error: any) {
    console.error('Workout OCR Route Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
