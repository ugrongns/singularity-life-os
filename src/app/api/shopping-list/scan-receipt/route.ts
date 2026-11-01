import { NextResponse } from 'next/server';
import { parseReceiptImage } from '@/lib/ai-vision';
import { db, initDatabase } from '@/db';
import { shoppingListItems } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import path from 'path';

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_BASE64_LENGTH = 15 * 1024 * 1024; // 15 MB

function isReceiptItemMatch(itemName: string, receiptItemName: string): boolean {
  const iLower = itemName.toLowerCase().trim();
  const rLower = receiptItemName.toLowerCase().trim();

  if (!iLower || !rLower) return false;
  if (iLower === rLower) return true;

  // 2-3 harfli kısa kelimelerde substring includes yanılgısını önle (örn: 'su', 'un', 'et')
  if (iLower.length <= 3 || rLower.length <= 3) {
    const wordsI = iLower.split(/[\s,.;:()\[\]{}*\/\\_+-]+/).filter(Boolean);
    const wordsR = rLower.split(/[\s,.;:()\[\]{}*\/\\_+-]+/).filter(Boolean);
    return wordsI.includes(rLower) || wordsR.includes(iLower);
  }

  return iLower.includes(rLower) || rLower.includes(iLower);
}

export async function POST(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 });
    }

    const contentType = req.headers.get('content-type') || '';
    let base64Image = '';
    let mimeType = 'image/jpeg';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const base64Input = formData.get('base64') as string | null;

      if (file) {
        if (file.size > MAX_FILE_SIZE) {
          return NextResponse.json({
            success: false,
            error: 'Dosya boyutu çok yüksek. Lütfen 10 MB altı bir dosya yükleyin.'
          }, { status: 400 });
        }

        const ext = path.extname(file.name).toLowerCase();
        const fMime = (file.type || '').toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext) || (fMime && !ALLOWED_MIME_TYPES.includes(fMime))) {
          return NextResponse.json({
            success: false,
            error: 'Geçersiz dosya türü. Sadece JPG, PNG, WEBP veya PDF yükleyebilirsiniz.'
          }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        base64Image = buffer.toString('base64');
        mimeType = fMime || (ext === '.pdf' ? 'application/pdf' : ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg');
      } else if (base64Input) {
        if (base64Input.length > MAX_BASE64_LENGTH) {
          return NextResponse.json({ success: false, error: 'Base64 veri boyutu sınırı aşıldı.' }, { status: 400 });
        }
        base64Image = base64Input;
      }
    } else if (contentType.includes('application/json')) {
      const body = await req.json();
      base64Image = body.base64 || '';
      mimeType = (body.mimeType || 'image/jpeg').toLowerCase();
      if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
        return NextResponse.json({
          success: false,
          error: 'Geçersiz MIME türü. Sadece JPG, PNG, WEBP veya PDF desteklenir.'
        }, { status: 400 });
      }
      if (base64Image.length > MAX_BASE64_LENGTH) {
        return NextResponse.json({ success: false, error: 'Base64 veri boyutu sınırı aşıldı.' }, { status: 400 });
      }
    }

    if (!base64Image) {
      return NextResponse.json({ success: false, error: 'Fiş görseli bulunamadı.' }, { status: 400 });
    }

    // AI Vision Pipeline ile Fişi Tara
    const parsedReceipt = await parseReceiptImage(base64Image, mimeType);

    // Mevcut alışveriş listesindeki ürünleri al (kullanıcı/aileye özel)
    const familyId = user.family_id || `fam-${user.id}`;
    const currentItems = await db.select().from(shoppingListItems)
      .where(familyId ? eq(shoppingListItems.family_id, familyId) : eq(shoppingListItems.user_id, user.id));
    const now = new Date().toISOString();
    let matchedCount = 0;
    const matchedNames: string[] = [];

    // Fişteki ürünlerle alışveriş listesindeki ürünleri tip güvenli eşleştir (Bulgu 6)
    const receiptItems = Array.isArray(parsedReceipt.items)
      ? parsedReceipt.items.filter((item): item is { name: string; price: number; quantity?: number; barcode?: string } =>
          Boolean(item && typeof item === 'object' && typeof item.name === 'string' && typeof item.price === 'number')
        )
      : [];

    for (const receiptItem of receiptItems) {
      const matched = (currentItems).find((i: any) => isReceiptItemMatch(i.name, receiptItem.name));

      if (matched) {
        await db.update(shoppingListItems).set({
          is_checked: 1,
          estimated_price: receiptItem.price > 0 ? receiptItem.price : matched.estimated_price,
          updated_at: now
        }).where(eq(shoppingListItems.id, matched.id));

        matchedCount++;
        matchedNames.push(matched.name);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        receipt: parsedReceipt,
        matchedCount,
        matchedNames
      },
      message: matchedCount > 0 
        ? `🎉 Fiş tarandı! ${matchedCount} adet ürün listede eşleştirilerek "Alındı ✓" işaretlendi.`
        : `📸 Fiş tarandı (Toplam: ₺${parsedReceipt.amount}). Listede doğrudan eşleşen ürün bulunamadı.`
    });
  } catch (error: any) {
    console.error('Scan Shopping Receipt Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
