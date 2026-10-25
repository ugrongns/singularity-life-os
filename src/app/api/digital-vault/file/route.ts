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
    const id = searchParams.get('id');
    const rawFilename = searchParams.get('filename');

    if (!id && !rawFilename) {
      return NextResponse.json({ success: false, error: 'Belge ID veya dosya adı belirtilmedi.' }, { status: 400 });
    }

    const familyId = user.family_id || `fam-${user.id}`;
    const { db } = await import('@/db');
    const { digitalVaultItems } = await import('@/db/schema');
    const { eq, like } = await import('drizzle-orm');

    let vaultRecord: any = null;

    if (id) {
      const records = await db.select().from(digitalVaultItems).where(eq(digitalVaultItems.id, id)).limit(1);
      vaultRecord = records[0] || null;
    } else if (rawFilename) {
      const sanitizedFilename = path.basename(rawFilename);
      if (!sanitizedFilename || sanitizedFilename.includes('..')) {
        return NextResponse.json({ success: false, error: 'Geçersiz dosya adı.' }, { status: 400 });
      }

      const records = await db.select().from(digitalVaultItems).where(
        like(digitalVaultItems.document_image_url, `%${sanitizedFilename}%`)
      ).limit(1);
      vaultRecord = records[0] || null;
    }

    // OWASP BOLA / Gizlilik Doğrulaması
    if (vaultRecord) {
      const isSameFamily = vaultRecord.family_id === familyId || vaultRecord.user_id === user.id;
      if (!isSameFamily) {
        return NextResponse.json({ success: false, error: 'Yetkisiz erişim: Bu belge ailenize ait değil.' }, { status: 403 });
      }
      const canView = vaultRecord.user_id === user.id || vaultRecord.is_family_shared === 1 || user.is_master_account === 1;
      if (!canView) {
        return NextResponse.json({ success: false, error: 'Bu özel kasadaki belgeyi görüntüleme yetkiniz yok.' }, { status: 403 });
      }

      // 1. Kalıcı Depolama (Base64 Data URI) Doğrudan Servis
      const docUrl = vaultRecord.document_image_url;
      if (docUrl && docUrl.startsWith('data:')) {
        const match = docUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          const mimeType = match[1];
          const fileBuffer = Buffer.from(match[2], 'base64');
          const ext = mimeType === 'application/pdf' ? '.pdf' :
                      mimeType === 'image/png' ? '.png' :
                      mimeType === 'image/webp' ? '.webp' : '.jpg';
          const safeTitle = (vaultRecord.title || 'belge')
            .replace(/[^a-zA-Z0-9_\u00C0-\u017F-]/g, '_')
            .slice(0, 50);

          return new Response(fileBuffer, {
            headers: {
              'Content-Type': mimeType,
              'Content-Disposition': `inline; filename="${safeTitle}${ext}"`,
              'Cache-Control': 'private, max-age=86400'
            }
          });
        }
      }
    }

    // 2. Geriye dönük uyumluluk: Yerel diskten servis et (Legacy dosyalar)
    if (rawFilename) {
      const sanitizedFilename = path.basename(rawFilename);
      let filePath = path.join(process.cwd(), 'private_storage', 'vault', sanitizedFilename);
      if (!fs.existsSync(filePath)) {
        filePath = path.join(process.cwd(), 'public', 'uploads', 'vault', sanitizedFilename);
      }

      if (fs.existsSync(filePath)) {
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
      }
    }

    return NextResponse.json({ success: false, error: 'Belge dosyası bulunamadı.' }, { status: 404 });
  } catch (error: any) {
    console.error('Serve Vault File Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
