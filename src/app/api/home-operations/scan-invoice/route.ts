import { NextResponse } from 'next/server';
import { parseApplianceInvoiceImage } from '@/lib/ai-vision';
import fs from 'fs';
import path from 'path';
import { getAuthUser } from '@/lib/auth';

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

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString('base64');
    const mimeType = file.type || 'image/jpeg';

    // Fatura belgesi görselini `public/uploads/home/` klasörüne kaydet
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'home');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const fileExt = file.name.substring(file.name.lastIndexOf('.')) || '.jpg';
    const fileName = `invoice-${Date.now()}${fileExt}`;
    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/home/${fileName}`;

    // Gemini Vision OCR ile faturayı analiz et
    const parsedData = await parseApplianceInvoiceImage(base64Image, mimeType);

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
