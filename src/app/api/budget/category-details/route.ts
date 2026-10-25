import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { categories, transactions, walletsAccounts } from '@/db/schema';
import { eq, desc, sql, or, and } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url, 'http://localhost');
    const categoryId = searchParams.get('category_id');
    const monthParam = searchParams.get('month'); // YYYY-MM

    if (!categoryId) {
      return NextResponse.json({ success: false, error: 'Kategori ID zorunludur.' }, { status: 400 });
    }

    const familyId = user.family_id || (user.id ? `fam-${user.id}` : null);
    const currentMonthStr = monthParam || new Date().toISOString().slice(0, 7);

    // Kategori Detayı - Kullanıcının ailesine ait veya sistem/ortak kategori olmalı
    const category = (await db.select().from(categories).where(eq(categories.id, categoryId)))[0];
    if (!category) {
      return NextResponse.json({ success: false, error: 'Kategori bulunamadı.' }, { status: 404 });
    }

    if (category.family_id && familyId && category.family_id !== familyId) {
      return NextResponse.json({ success: false, error: 'Bu kategoriye erişim yetkiniz yok.' }, { status: 403 });
    }

    // Hesap isimlerini haritalamak için yalnızca ailenin cüzdanlarını al (BOLA Koruması)
    const wallets = familyId
      ? await db.select().from(walletsAccounts).where(
          and(
            eq(walletsAccounts.family_id, familyId),
            or(eq(walletsAccounts.user_id, user.id), eq(walletsAccounts.is_family_shared, 1), sql`${walletsAccounts.user_id} IS NULL`)
          )
        )
      : await db.select().from(walletsAccounts).where(eq(walletsAccounts.user_id, user.id));

    const walletMap = new Map((wallets).map((w: any) => [w.id, w.name]));

    // Bu kategoriye, seçili aya ve yalnızca bu aileye/kullanıcıya ait işlemler (BOLA Koruması)
    const familyTxFilter = familyId
      ? and(
          eq(transactions.family_id, familyId),
          or(eq(transactions.user_id, user.id), eq(transactions.is_family_shared, 1))
        )
      : eq(transactions.user_id, user.id);

    const txList = await db.select()
      .from(transactions)
      .where(
        and(
          eq(transactions.category_id, categoryId),
          sql`substr(${transactions.transaction_date}, 1, 7) = ${currentMonthStr}`,
          familyTxFilter
        )
      )
      .orderBy(desc(transactions.transaction_date), desc(transactions.created_at));

    const formattedTxList = (txList).map((tx: any) => ({
      ...tx,
      wallet_name: walletMap.get(tx.wallet_id) || 'Bilinmeyen Hesap'
    }));

    const totalSpent = (txList).reduce((sum: number, t: any) => sum + t.amount, 0);

    return NextResponse.json({
      success: true,
      data: {
        category,
        monthStr: currentMonthStr,
        totalSpent,
        monthlyBudgetLimit: category.monthly_budget_limit || 0,
        transactions: formattedTxList
      }
    });
  } catch (error: any) {
    console.error('Category Details API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
