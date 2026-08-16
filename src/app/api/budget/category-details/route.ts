import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { categories, transactions, walletsAccounts } from '@/db/schema';
import { eq, desc, sql , or } from 'drizzle-orm';

export async function GET(req: Request) {
  try {
    initDatabase();
    const { searchParams } = new URL(req.url, 'http://localhost');
    const categoryId = searchParams.get('category_id');
    const monthParam = searchParams.get('month'); // YYYY-MM

    if (!categoryId) {
      return NextResponse.json({ success: false, error: 'Kategori ID zorunludur.' }, { status: 400 });
    }

    const currentMonthStr = monthParam || new Date().toISOString().slice(0, 7);

    // Kategori Detayı
    const category = (await db.select().from(categories).where(eq(categories.id, categoryId)))[0];
    if (!category) {
      return NextResponse.json({ success: false, error: 'Kategori bulunamadı.' }, { status: 404 });
    }

    // Hesap isimlerini haritalamak için cüzdanları al
    const wallets = await db.select().from(walletsAccounts);
    const walletMap = new Map((wallets).map((w: any) => [w.id, w.name]));

    // Bu kategoriye ve seçili aya ait tüm işlemler
    const txList = await db.select()
      .from(transactions)
      .where(
        sql`${transactions.category_id} = ${categoryId} AND substr(${transactions.transaction_date}, 1, 7) = ${currentMonthStr}`
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
