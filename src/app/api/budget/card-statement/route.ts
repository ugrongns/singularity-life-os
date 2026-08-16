import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { walletsAccounts, transactions, categories } from '@/db/schema';
import { eq, desc , or } from 'drizzle-orm';

export async function GET(req: Request) {
  try {
    initDatabase();
    const { searchParams } = new URL(req.url, 'http://localhost');
    const accountId = searchParams.get('account_id');

    if (!accountId) {
      return NextResponse.json({ success: false, error: 'Hesap ID zorunludur.' }, { status: 400 });
    }

    const cardAccount = (await db.select().from(walletsAccounts).where(eq(walletsAccounts.id, accountId)))[0];
    if (!cardAccount) {
      return NextResponse.json({ success: false, error: 'Kredi kartı hesabı bulunamadı.' }, { status: 404 });
    }

    // Bu karta ait tüm işlemleri getir
    const allCardTx = (await db.select()
      .from(transactions)
      .where(eq(transactions.wallet_id, accountId))
      .orderBy(desc(transactions.transaction_date))) as any[];

    // Kategorileri çek
    const allCategories = await db.select().from(categories);
    const categoryMap = new Map((allCategories).map((c: any) => [c.id, c.name]));

    const today = new Date();
    const todayISO = today.toISOString().split('T')[0];
    const currentMonthStr = todayISO.slice(0, 7);

    // 1. Bu Ayki Tek Çekim Harcamalar (is_installment === 0)
    const singleTransactions = (allCardTx)
      .filter((tx: any) => (!tx.is_installment || tx.is_installment === 0))
      .map((tx: any) => ({
        ...tx,
        category_name: tx.category_id ? categoryMap.get(tx.category_id) || 'Genel' : 'Genel'
      }));

    // 2. Aktif Taksitli Harcamalar (is_installment === 1)
    // Taksit gruplarını parent_transaction_id veya merchant'a göre grupla
    const installmentGroupMap = new Map<string, any>();

    for (const tx of (allCardTx)) {
      if (tx.is_installment === 1) {
        const groupKey = tx.parent_transaction_id || `${tx.merchant}-${tx.total_installments}`;
        if (!installmentGroupMap.has(groupKey)) {
          installmentGroupMap.set(groupKey, {
            parent_id: groupKey,
            merchant: tx.merchant,
            monthly_amount: tx.amount,
            total_installments: tx.total_installments || 1,
            total_amount: (tx.amount) * (tx.total_installments || 1),
            category_name: tx.category_id ? categoryMap.get(tx.category_id) || 'Taksitli Harcama' : 'Taksitli Harcama',
            start_date: tx.transaction_date
          });
        }
      }
    }

    // Gerçekleşen taksit sayısını (vadesi bugün veya geçmiş tarihe denk gelen taksitler) hesapla
    const activeInstallments = Array.from(installmentGroupMap.values()).map(inst => {
      const dueCount = (allCardTx).filter((tx: any) => 
        (tx.parent_transaction_id === inst.parent_id || (tx.merchant === inst.merchant && tx.total_installments === inst.total_installments)) &&
        tx.is_installment === 1 &&
        tx.transaction_date <= todayISO
      ).length;

      return {
        ...inst,
        completed_installments: Math.max(1, Math.min(dueCount, inst.total_installments))
      };
    });

    // Hesaplama Özeti
    // Bu ayki tek çekimler
    const singleTotal = singleTransactions
      .filter((t: any) => t.transaction_date.startsWith(currentMonthStr))
      .reduce((sum: number, t: any) => sum + t.amount, 0);

    // Bu ayki taksit dilimleri toplamı
    const monthlyInstallmentTotal = activeInstallments.reduce((sum: number, inst: any) => sum + inst.monthly_amount, 0);

    // Bu ay ödenecek net güncel ekstre borcu (Tek çekim + Bu ayki taksit dilimi)
    const currentStatementDebt = singleTotal + monthlyInstallmentTotal;

    // Gelecek aylara sarkan taksit borcu
    const futureInstallmentsDebt = Math.max(0, cardAccount.balance - currentStatementDebt);

    return NextResponse.json({
      success: true,
      data: {
        card: {
          id: cardAccount.id,
          name: cardAccount.name,
          balance: cardAccount.balance, // Toplam Kart Borcu (Limit Kullanımı)
          credit_limit: cardAccount.credit_limit || 0,
          available_limit: Math.max(0, (cardAccount.credit_limit || 0) - cardAccount.balance),
          cutoff_day: cardAccount.cutoff_day || null,
          due_day: cardAccount.due_day || null,
          currency: cardAccount.currency || 'TRY'
        },
        summary: {
          singleTotal,
          monthlyInstallmentTotal,
          currentStatementDebt,      // BU AYKİ GÜNCEL EKSTRE BORCU
          futureInstallmentsDebt,    // GELECEK DÖNEM TAKSİT BORÇLARI
          totalCardDebt: cardAccount.balance // TOPLAM KART BORCU
        },
        singleTransactions,
        activeInstallments
      }
    });
  } catch (error: any) {
    console.error('Card Statement API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
