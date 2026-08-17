import { NextResponse } from 'next/server';
import { parseReceiptImage } from '@/lib/ai-vision';
import { db, initDatabase } from '@/db';
import { shoppingListItems } from '@/db/schema';
import { eq , or } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    initDatabase();
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
        const buffer = Buffer.from(await file.arrayBuffer());
        base64Image = buffer.toString('base64');
        mimeType = file.type || 'image/jpeg';
      } else if (base64Input) {
        base64Image = base64Input;
      }
    } else if (contentType.includes('application/json')) {
      const body = await req.json();
      base64Image = body.base64 || '';
      mimeType = body.mimeType || 'image/jpeg';
    }

    if (!base64Image) {
      return NextResponse.json({ success: false, error: 'Fiş görseli bulunamadı.' }, { status: 400 });
    }

    // AI Vision Pipeline ile Fişi Tara
    const parsedReceipt = await parseReceiptImage(base64Image, mimeType);

    // Mevcut alışveriş listesindeki ürünleri al
    const currentItems = await db.select().from(shoppingListItems);
    const now = new Date().toISOString();
    let matchedCount = 0;
    const matchedNames: string[] = [];

    // Fişteki ürünlerle alışveriş listesindeki ürünleri eşleştir
    for (const receiptItem of parsedReceipt.items || []) {
      const rNameLower = receiptItem.name.toLowerCase();
      
      const matched = (currentItems).find((i: any) => {
        const iNameLower = i.name.toLowerCase();
        return iNameLower.includes(rNameLower) || rNameLower.includes(iNameLower);
      });

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
