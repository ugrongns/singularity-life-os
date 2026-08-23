import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { shoppingListItems, walletsAccounts, transactions } from '@/db/schema';
import { eq, and , or } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  try {
    initDatabase();
    const user = await getAuthUser();
    const userId = user?.id;

    const familyId = user?.family_id || (userId ? `fam-${userId}` : null);
    const items = userId ? await db.select().from(shoppingListItems).where(familyId ? eq(shoppingListItems.family_id, familyId) : eq(shoppingListItems.user_id, userId)) : [];
    const wallets = userId ? await db.select().from(walletsAccounts).where(and(eq(walletsAccounts.is_active, 1), familyId ? eq(walletsAccounts.family_id, familyId) : eq(walletsAccounts.user_id, userId))) : [];

    const unchecked = (items).filter((i: any) => i.is_checked === 0);
    const checked   = (items).filter((i: any) => i.is_checked === 1);

    const totalEstimated = (items).reduce((sum: number, i: any) => sum + (i.estimated_price || 0), 0);
    const remainingEstimated = (unchecked).reduce((sum: number, i: any) => sum + (i.estimated_price || 0), 0);
    const checkedEstimated = (checked).reduce((sum: number, i: any) => sum + (i.estimated_price || 0), 0);

    // Kategorilere göre grupla ve kategori tutarlarını hesapla
    const byCategory: Record<string, typeof items> = {};
    const categoryTotals: Record<string, number> = {};

    for (const item of items) {
      const cat = item.category || 'Market';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(item);
      categoryTotals[cat] = (categoryTotals[cat] || 0) + (item.estimated_price || 0);
    }

    return NextResponse.json({
      success: true,
      data: {
        items,
        unchecked,
        checked,
        byCategory,
        categoryTotals,
        wallets,
        summary: {
          total: items.length,
          remaining: unchecked.length,
          done: checked.length,
          totalEstimated,
          remainingEstimated,
          checkedEstimated
        }
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    const body = await request.json();
    const { action, ...data } = body;
    const now = new Date().toISOString();
    const today = now.split('T')[0];
    const familyId = user.family_id || `fam-${user.id}`;

    const currentItems = await db.select().from(shoppingListItems).where(eq(shoppingListItems.family_id, familyId));

    if (action === 'add') {
      const nameTrimmed = (data.name || '').trim();
      const existing = (currentItems).find((i: any) => i.name.toLowerCase() === nameTrimmed.toLowerCase());

      if (existing) {
        // Çift ürün eklemek yerine var olanı güncelle ve unchecked yap
        await db.update(shoppingListItems).set({
          quantity: data.quantity || existing.quantity,
          unit: data.unit || existing.unit,
          estimated_price: Number(data.estimated_price) || existing.estimated_price,
          is_checked: 0,
          updated_at: now
        }).where(eq(shoppingListItems.id, existing.id));

        return NextResponse.json({ success: true, id: existing.id, message: 'Ürün zaten listenizde vardı, güncellendi!' });
      }

      const id = `shop-${Date.now()}`;
      await db.insert(shoppingListItems).values({
        id,
        name: nameTrimmed,
        quantity: data.quantity || '1',
        unit: data.unit || 'adet',
        category: data.category || 'Market',
        estimated_price: Number(data.estimated_price) || 0,
        is_checked: 0,
        user_id: user.id,
        family_id: familyId,
        created_at: now,
        updated_at: now
      });
      return NextResponse.json({ success: true, id, message: 'Ürün eklendi!' });
    }

    if (action === 'update') {
      await db.update(shoppingListItems).set({
        name: data.name,
        quantity: data.quantity,
        unit: data.unit,
        category: data.category,
        estimated_price: Number(data.estimated_price) || 0,
        updated_at: now
      }).where(eq(shoppingListItems.id, data.id));
      return NextResponse.json({ success: true, message: 'Ürün güncellendi!' });
    }

    if (action === 'toggle') {
      const item = (await db.select().from(shoppingListItems).where(eq(shoppingListItems.id, data.id)).limit(1))[0];
      if (item) {
        await db.update(shoppingListItems).set({
          is_checked: item.is_checked === 1 ? 0 : 1,
          updated_at: now
        }).where(eq(shoppingListItems.id, data.id));
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'delete') {
      await db.delete(shoppingListItems).where(eq(shoppingListItems.id, data.id));
      return NextResponse.json({ success: true });
    }

    if (action === 'clear_checked') {
      const checked = await db.select().from(shoppingListItems).where(eq(shoppingListItems.is_checked, 1));
      for (const item of checked) {
        await db.delete(shoppingListItems).where(eq(shoppingListItems.id, item.id));
      }
      return NextResponse.json({ success: true, deleted: checked.length });
    }

    if (action === 'clear_all') {
      await db.delete(shoppingListItems);
      return NextResponse.json({ success: true, message: 'Tüm liste temizlendi!' });
    }

    // Hazır Alışveriş Paketleri Ekle (Tekrarlı ürün engellemeli)
    if (action === 'add_preset') {
      const presetType = data.preset || 'diet';
      let presetItems: Array<{ name: string; quantity: string; unit: string; category: string; estimated_price: number }> = [];

      if (presetType === 'diet') {
        presetItems = [
          { name: 'Avokado', quantity: '2', unit: 'adet', category: 'Manav', estimated_price: 120 },
          { name: 'Yulaf Ezmesi', quantity: '500', unit: 'gram', category: 'Market', estimated_price: 45 },
          { name: 'Yumurta (Organik)', quantity: '15', unit: 'adet', category: 'Market', estimated_price: 90 },
          { name: 'Şekersiz Badem Sütü', quantity: '1', unit: 'litre', category: 'Market', estimated_price: 65 },
          { name: 'Chia Tohumu', quantity: '250', unit: 'gram', category: 'Aktariye', estimated_price: 55 }
        ];
      } else if (presetType === 'grocery') {
        presetItems = [
          { name: 'Ekmek', quantity: '2', unit: 'adet', category: 'Fırın', estimated_price: 25 },
          { name: 'Tam Yağlı Beyaz Peynir', quantity: '500', unit: 'gram', category: 'Market', estimated_price: 185 },
          { name: 'Siyah Zeytin', quantity: '500', unit: 'gram', category: 'Market', estimated_price: 120 },
          { name: 'Tuvalet Kağıdı (12li)', quantity: '1', unit: 'paket', category: 'Market', estimated_price: 165 },
          { name: 'Çamaşır Deterjanı', quantity: '3', unit: 'litre', category: 'Market', estimated_price: 240 }
        ];
      } else if (presetType === 'produce') {
        presetItems = [
          { name: 'Kıvırcık Marul', quantity: '2', unit: 'adet', category: 'Manav', estimated_price: 40 },
          { name: 'Çeri Domates', quantity: '1', unit: 'kg', category: 'Manav', estimated_price: 65 },
          { name: 'Çengelköy Salatalık', quantity: '1', unit: 'kg', category: 'Manav', estimated_price: 50 },
          { name: 'Sızma Zeytinyağı', quantity: '1', unit: 'litre', category: 'Market', estimated_price: 450 },
          { name: 'Limon', quantity: '1', unit: 'kg', category: 'Manav', estimated_price: 45 }
        ];
      }

      let added = 0;
      let existingCount = 0;

      for (const item of presetItems) {
        const itemLower = item.name.toLowerCase();
        const existing = (currentItems).find((i: any) => i.name.toLowerCase() === itemLower);

        if (existing) {
          // Zaten varsa duplicate oluşturma, sadece is_checked=0 yap
          await db.update(shoppingListItems).set({
            is_checked: 0,
            updated_at: now
          }).where(eq(shoppingListItems.id, existing.id));
          existingCount++;
        } else {
          const id = `shop-preset-${Date.now()}-${added}`;
          await db.insert(shoppingListItems).values({
            id,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            category: item.category,
            estimated_price: item.estimated_price,
            is_checked: 0,
            created_at: now,
            updated_at: now
          });
          added++;
        }
      }

      const msg = added > 0 
        ? `🥑 ${added} yeni ürün eklendi!${existingCount > 0 ? ` (${existingCount} ürün zaten listenizde vardı)` : ''}`
        : `ℹ️ Paket ürünlerinin tamamı zaten listenizde mevcut.`;

      return NextResponse.json({ success: true, added, existingCount, message: msg });
    }

    // Alışverişi Bitir & Cüzdana Harcama Olarak İşle
    if (action === 'checkout_to_wallet') {
      const walletId = data.wallet_id;
      const checkedItems = await db.select().from(shoppingListItems).where(eq(shoppingListItems.is_checked, 1));
      
      if (!walletId) {
        return NextResponse.json({ success: false, error: 'Lütfen harcama yapılacak cüzdanı seçin.' }, { status: 400 });
      }

      const totalAmount = (checkedItems).reduce((sum: number, i: any) => sum + (i.estimated_price || 0), 0);
      if (totalAmount <= 0) {
        return NextResponse.json({ success: false, error: 'Alınan ürün tutarı 0 TL. Harcama kaydedilemedi.' }, { status: 400 });
      }

      // Cüzdanı al ve bakiyesini güncelle
      const wallet = (await db.select().from(walletsAccounts).where(eq(walletsAccounts.id, walletId)).limit(1))[0];
      if (wallet) {
        await db.update(walletsAccounts).set({
          balance: (wallet.balance || 0) - totalAmount,
          updated_at: now
        }).where(eq(walletsAccounts.id, walletId));
      }

      // Harcama işlemi kaydet (transactions)
      const txId = `tx-shop-${Date.now()}`;
      const itemNames = (checkedItems).map((i: any) => i.name).join(', ');
      await db.insert(transactions).values({
        id: txId,
        wallet_id: walletId,
        merchant: 'Market Alışverişi',
        amount: totalAmount,
        currency: 'TRY',
        transaction_date: today,
        notes: `Market Listesi Alışverişi: ${itemNames.substring(0, 100)}...`,
        is_verified: 1,
        created_at: now,
        updated_at: now
      });

      // Alınan ürünleri listeden temizle
      for (const item of checkedItems) {
        await db.delete(shoppingListItems).where(eq(shoppingListItems.id, item.id));
      }

      return NextResponse.json({
        success: true,
        totalAmount,
        walletName: wallet?.name || 'Cüzdan',
        message: `💳 ₺${totalAmount} tutarındaki market alışverişi ${wallet?.name || 'cüzdanınıza'} harcama olarak işlendi!`
      });
    }

    return NextResponse.json({ success: false, error: 'Bilinmeyen işlem' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
