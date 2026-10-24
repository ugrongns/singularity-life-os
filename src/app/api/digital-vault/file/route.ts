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

    // OWASP BOLA / Gizlilik Doğrulaması: Belgenin bu aileye ait ve erişilebilir olduğunu teyit et
    const familyId = user.family_id || `fam-${user.id}`;
    const { db } = await import('@/db');
    const { digitalVaultItems } = await import('@/db/schema');
    const { like } = await import('drizzle-orm');

    const vaultRecord = (await db.select().from(digitalVaultItems).where(
      like(digitalVaultItems.document_image_url, `%${sanitizedFilename}%`)
    ).limit(1))[0];

    if (vaultRecord) {
      const isSameFamily = vaultRecord.family_id === familyId || vaultRecord.user_id === user.id;
      if (!isSameFamily) {
        return NextResponse.json({ success: false, error: 'Yetkisiz erişim: Bu belge ailenize ait değil.' }, { status: 403 });
      }
      const canView = vaultRecord.user_id === user.id || vaultRecord.is_family_shared === 1 || user.is_master_account === 1;
      if (!canView) {
        return NextResponse.json({ success: false, error: 'Bu özel kasadaki belgeyi görüntüleme yetkiniz yok.' }, { status: 403 });
      }
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
