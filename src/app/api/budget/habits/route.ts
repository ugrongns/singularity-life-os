import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { transactions, categories } from '@/db/schema';
import { eq, desc, and, gte, or } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { calculateSpendingHabits, RawTransactionHabit } from '@/lib/financial-habits';

export async function GET(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }

    const today = new Date();
    // Son 90 günün başlangıç tarihi (YYYY-MM-DD)
    const ninetyDaysAgo = new Date(today);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().slice(0, 10);

    const familyId = user.family_id || `fam-${user.id}`;

    // OWASP BOLA: Sadece oturum açmış kullanıcının ailesine/kendisine ait işlemler çekilir
    const rows = await db.select({
      id: transactions.id,
      amount: transactions.amount,
      transaction_date: transactions.transaction_date,
      merchant: transactions.merchant,
      notes: transactions.notes,
      is_installment: transactions.is_installment,
      installment_number: transactions.installment_number,
      total_installments: transactions.total_installments,
      category_id: transactions.category_id,
      category_type: categories.type,
      category_name: categories.name,
      user_id: transactions.user_id
    })
      .from(transactions)
      .leftJoin(categories, eq(transactions.category_id, categories.id))
      .where(
        and(
          or(
            eq(transactions.user_id, user.id),
            and(eq(transactions.family_id, familyId), eq(transactions.is_family_shared, 1))
          ),
          gte(transactions.transaction_date, ninetyDaysAgoStr)
        )
      )
      .orderBy(desc(transactions.transaction_date), desc(transactions.created_at))
      .limit(500);

    const summary = calculateSpendingHabits(rows as RawTransactionHabit[], today);

    return NextResponse.json({
      success: true,
      data: summary
    });
  } catch (error: any) {
    console.error('Financial Habits API Error:', error);
    return NextResponse.json({ success: false, error: error.message ?? 'Harcama alışkanlıkları analitiği alınamadı.' }, { status: 500 });
  }
}
