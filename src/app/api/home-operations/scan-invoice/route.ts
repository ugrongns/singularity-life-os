import { NextResponse } from 'next/server';
import { parseApplianceInvoiceImage } from '@/lib/ai-vision';
import fs from 'fs';
import path from 'path';
import { getAuthUser } from '@/lib/auth';

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'Görsel yüklenmedi' }, { status: 400 });
    }

    // 1. Boyut Sınırı Kontrolü
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        success: false,
        error: 'Dosya boyutu çok yüksek. Lütfen 10 MB altı bir dosya yükleyin.'
      }, { status: 400 });
    }

    // 2. Uzantı ve MIME Tipi Kontrolü
    const fileExt = path.extname(file.name).toLowerCase();
    const mimeType = (file.type || '').toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(fileExt) || (mimeType && !ALLOWED_MIME_TYPES.includes(mimeType))) {
      return NextResponse.json({
        success: false,
        error: 'Geçersiz dosya türü. Sadece JPG, PNG, WEBP veya PDF yükleyebilirsiniz.'
      }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString('base64');
    const effectiveMimeType = mimeType || (fileExt === '.pdf' ? 'application/pdf' : fileExt === '.png' ? 'image/png' : fileExt === '.webp' ? 'image/webp' : 'image/jpeg');

    // Bulgu 18: Hassas fatura/garanti belgelerini herkese açık public/ dizinine yazmak yerine
    // yetkisiz erişimi engelleyen Data URI formatında sakla/döndür
    const publicUrl = `data:${effectiveMimeType};base64,${base64Image}`;

    // Gemini Vision OCR ile faturayı analiz et
    const parsedData = await parseApplianceInvoiceImage(base64Image, effectiveMimeType);

    return NextResponse.json({
      success: true,
      receiptUrl: publicUrl,
      data: parsedData,
      message: '🧾 Fatura/Garanti belgesi başarıyla okundu!'
    });
  } catch (error: any) {
    console.error('Scan invoice error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
