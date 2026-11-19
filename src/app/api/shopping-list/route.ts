import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { shoppingListItems, walletsAccounts, transactions, categories } from '@/db/schema';
import { eq, and, or, sql } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { eventBus, EVENTS } from '@/lib/events';
import { getTodayTurkeyDate } from '@/lib/date-utils';
import { ensureFamilyCategories, getFamilySeedCategoryId } from '@/lib/budget-categories';

export async function GET() {
  try {
    await initDatabase();
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
    await initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    const body = await request.json();
    const { action, ...data } = body;
    const now = new Date().toISOString();
    const today = getTodayTurkeyDate();
    const familyId = user.family_id || (user.id ? `fam-${user.id}` : null);

    if (action === 'add') {
      const currentItems = familyId
        ? await db.select().from(shoppingListItems).where(eq(shoppingListItems.family_id, familyId))
        : await db.select().from(shoppingListItems).where(eq(shoppingListItems.user_id, user.id));

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
      if (!data.id) {
        return NextResponse.json({ success: false, error: 'Ürün ID zorunludur.' }, { status: 400 });
      }

      await db.update(shoppingListItems).set({
        name: data.name,
        quantity: data.quantity,
        unit: data.unit,
        category: data.category,
        estimated_price: Number(data.estimated_price) || 0,
        updated_at: now
      }).where(and(
        eq(shoppingListItems.id, data.id),
        familyId ? eq(shoppingListItems.family_id, familyId) : eq(shoppingListItems.user_id, user.id)
      ));
      return NextResponse.json({ success: true, message: 'Ürün güncellendi!' });
    }

    if (action === 'toggle') {
      const userCondition = and(
        eq(shoppingListItems.id, data.id),
        familyId ? eq(shoppingListItems.family_id, familyId) : eq(shoppingListItems.user_id, user.id)
      );
      const item = (await db.select().from(shoppingListItems).where(userCondition).limit(1))[0];
      if (!item) {
        return NextResponse.json({ success: false, error: 'Ürün bulunamadı veya bu işlem için yetkiniz yok.' }, { status: 403 });
      }
      await db.update(shoppingListItems).set({
        is_checked: item.is_checked === 1 ? 0 : 1,
        updated_at: now
      }).where(userCondition);
      return NextResponse.json({ success: true });
    }

    if (action === 'delete') {
      const userCondition = and(
        eq(shoppingListItems.id, data.id),
        familyId ? eq(shoppingListItems.family_id, familyId) : eq(shoppingListItems.user_id, user.id)
      );
      const item = (await db.select().from(shoppingListItems).where(userCondition).limit(1))[0];
      if (!item) {
        return NextResponse.json({ success: false, error: 'Ürün bulunamadı veya bu işlem için yetkiniz yok.' }, { status: 403 });
      }
      await db.delete(shoppingListItems).where(userCondition);
      return NextResponse.json({ success: true });
    }

    if (action === 'clear_checked') {
      const checked = await db.select().from(shoppingListItems)
        .where(and(eq(shoppingListItems.is_checked, 1), familyId ? eq(shoppingListItems.family_id, familyId) : eq(shoppingListItems.user_id, user.id)));
      for (const item of checked) {
        await db.delete(shoppingListItems).where(eq(shoppingListItems.id, item.id));
      }
      return NextResponse.json({ success: true, deleted: checked.length });
    }

    if (action === 'clear_all') {
      await db.delete(shoppingListItems)
        .where(familyId ? eq(shoppingListItems.family_id, familyId) : eq(shoppingListItems.user_id, user.id));
      return NextResponse.json({ success: true, message: 'Tüm liste temizlendi!' });
    }

    // Alışverişi Bitir & Cüzdana Harcama Olarak İşle
    if (action === 'checkout_to_wallet') {
      const walletId = data.wallet_id;
      const checkedItems = await db.select().from(shoppingListItems)
        .where(and(eq(shoppingListItems.is_checked, 1), familyId ? eq(shoppingListItems.family_id, familyId) : eq(shoppingListItems.user_id, user.id)));
      
      if (!walletId) {
        return NextResponse.json({ success: false, error: 'Lütfen harcama yapılacak cüzdanı seçin.' }, { status: 400 });
      }

      const totalAmount = (checkedItems).reduce((sum: number, i: any) => sum + (i.estimated_price || 0), 0);
      if (totalAmount <= 0) {
        return NextResponse.json({ success: false, error: 'Alınan ürün tutarı 0 TL. Harcama kaydedilemedi.' }, { status: 400 });
      }

      // Cüzdanı al ve yetkisini doğrula
      const wallet = (await db.select().from(walletsAccounts).where(
        and(
          eq(walletsAccounts.id, walletId),
          familyId ? or(eq(walletsAccounts.family_id, familyId), eq(walletsAccounts.user_id, user.id)) : eq(walletsAccounts.user_id, user.id)
        )
      ).limit(1))[0];

      if (!wallet) {
        return NextResponse.json({ success: false, error: 'Seçilen hesap bulunamadı veya bu işlem için yetkiniz yok.' }, { status: 403 });
      }

      // Limit / bakiye kontrolü (KMH ve Kredi kartı dahil)
      if (wallet.type === 'credit_card') {
        const avail = Math.max(0, (wallet.credit_limit || 0) - wallet.balance);
        if (totalAmount > avail) {
          return NextResponse.json({ success: false, error: `Kredi Kartı Limiti Aşıldı! ${wallet.name} kartınızda sadece ${avail.toLocaleString('tr-TR')} ₺ kullanılabilir limit var.` }, { status: 400 });
        }
      } else if (wallet.type === 'kmh') {
        const avail = wallet.balance + (wallet.overdraft_limit || 0);
        if (totalAmount > avail) {
          return NextResponse.json({ success: false, error: `KMH Limiti Aşıldı! ${wallet.name} hesabınızda toplam ${avail.toLocaleString('tr-TR')} ₺ kullanılabilir limit var.` }, { status: 400 });
        }
      } else if (totalAmount > wallet.balance) {
        return NextResponse.json({ success: false, error: `Yetersiz Bakiye! ${wallet.name} hesabınızda sadece ${wallet.balance.toLocaleString('tr-TR')} ₺ bakiye var.` }, { status: 400 });
      }

      const isCreditCard = wallet.type === 'credit_card';
      let newBalance = wallet.balance;
      if (isCreditCard) {
        newBalance = (wallet.balance || 0) + totalAmount;
      } else if (wallet.type === 'kmh') {
        newBalance = (wallet.balance || 0) - totalAmount; // KMH eksiye düşebilir
      } else {
        newBalance = Math.max(0, (wallet.balance || 0) - totalAmount);
      }

      // Kategori eşleştirme (Aileye izole 'Market & Gıda' kategorisi)
      const expectedMarketCatId = familyId ? getFamilySeedCategoryId('cat-market', familyId) : 'cat-market';
      const marketCat = (await db.select().from(categories).where(
        familyId
          ? and(
              eq(categories.family_id, familyId),
              or(
                eq(categories.id, expectedMarketCatId),
                eq(categories.name, 'Market & Gıda'),
                eq(categories.name, 'Market'),
                eq(categories.name, 'Gıda & Mutfak')
              )
            )
          : or(
              eq(categories.id, 'cat-market'),
              eq(categories.name, 'Market & Gıda'),
              eq(categories.name, 'Market'),
              eq(categories.name, 'Gıda & Mutfak')
            )
      ).limit(1))[0];

      let resolvedMarketCatId = marketCat?.id || null;
      if (!resolvedMarketCatId && familyId) {
        await ensureFamilyCategories(familyId);
        resolvedMarketCatId = expectedMarketCatId;
      }

      const txId = `tx-shop-${Date.now()}`;
      const itemNames = (checkedItems).map((i: any) => i.name).join(', ');

      // Atomik Veritabanı İşlemi (db.transaction)
      await db.transaction(async (tx) => {
        // 1. Cüzdan bakiyesini atomik SQL ifadesi ile güncelle (TOCTOU race condition koruması)
        await tx.update(walletsAccounts).set({
          balance: isCreditCard 
            ? sql`${walletsAccounts.balance} + ${totalAmount}` 
            : sql`${walletsAccounts.balance} - ${totalAmount}`,
          updated_at: now
        }).where(eq(walletsAccounts.id, walletId));

        // 2. Harcama işlemi kaydet (transactions)
        await tx.insert(transactions).values({
          id: txId,
          wallet_id: walletId,
          category_id: resolvedMarketCatId,
          merchant: 'Market Alışverişi',
          amount: totalAmount,
          currency: wallet.currency || 'TRY',
          transaction_date: today,
          notes: `Market Listesi Alışverişi: ${itemNames.substring(0, 100)}...`,
          is_verified: 1,
          is_family_shared: 1,
          sync_status: 'synced',
          device_id: 'web-client',
          user_id: user.id,
          family_id: familyId,
          created_at: now,
          updated_at: now
        });

        // 3. Alınan ürünleri listeden temizle
        for (const item of checkedItems) {
          await tx.delete(shoppingListItems).where(eq(shoppingListItems.id, item.id));
        }
      });

      // 4. Event Bus Bildirimi
      await eventBus.emit(EVENTS.TRANSACTION_CREATED, {
        transactionId: txId,
        amount: totalAmount,
        merchant: 'Market Alışverişi',
        wallet_id: walletId,
        category_id: resolvedMarketCatId,
        userId: user.id,
        familyId
      });

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
