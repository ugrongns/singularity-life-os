import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { walletsAccounts, transactions, categories } from '@/db/schema';
import { eq, desc, or, and, sql } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { calculateCreditCardSchedule, localYYYYMMDD } from '@/lib/bill-schedule';

export async function GET(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url, 'http://localhost');
    const accountId = searchParams.get('account_id');

    if (!accountId) {
      return NextResponse.json({ success: false, error: 'Hesap ID zorunludur.' }, { status: 400 });
    }

    const cardAccount = (await db.select().from(walletsAccounts).where(eq(walletsAccounts.id, accountId)))[0];
    if (!cardAccount) {
      return NextResponse.json({ success: false, error: 'Kredi kartı hesabı bulunamadı.' }, { status: 404 });
    }

    // BOLA / IDOR Koruması: Hesabın ailenin yetkili sınırları içinde olduğunu doğrula
    const familyId = user.family_id || (user.id ? `fam-${user.id}` : null);
    const belongsToFamily = !cardAccount.family_id || (familyId && cardAccount.family_id === familyId);
    const isOwner = cardAccount.user_id === user.id;
    const isShared = belongsToFamily && (cardAccount.is_family_shared === 1 || !cardAccount.user_id);
    const isLeader = belongsToFamily && (user.is_master_account === 1 || user.role === 'admin');

    if (!belongsToFamily || (!isOwner && !isShared && !isLeader)) {
      return NextResponse.json({ success: false, error: 'Bu kredi kartı hesabına erişim yetkiniz yok.' }, { status: 403 });
    }

    // Bu karta ait tüm işlemleri getir
    const allCardTx = (await db.select()
      .from(transactions)
      .where(eq(transactions.wallet_id, accountId))
      .orderBy(desc(transactions.transaction_date))) as any[];

    // Kategorileri çek (Sistem geneli veya aileye ait kategoriler)
    const allCategories = await db.select().from(categories).where(
      or(
        sql`${categories.family_id} IS NULL`,
        familyId ? eq(categories.family_id, familyId) : sql`1=1`
      )
    );
    const categoryMap = new Map((allCategories).map((c: any) => [c.id, c.name]));

    const today = new Date();
    const todayISO = localYYYYMMDD(today);
    const ccSchedule = calculateCreditCardSchedule(cardAccount, allCardTx, today);
    const cycleStartISO = ccSchedule.cycle_start_date;
    const cycleEndISO = ccSchedule.cycle_end_date;

    // 1. Bu Dönemki Tek Çekim Harcamalar (is_installment === 0)
    // Cari ekstre döneminde (cycleStartISO - cycleEndISO) yapılan tek çekim işlemleri
    const singleTransactions = (allCardTx)
      .filter((tx: any) => (!tx.is_installment || tx.is_installment === 0) && tx.transaction_date >= cycleStartISO && tx.transaction_date <= cycleEndISO)
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
          const totalInst = tx.total_installments || 1;
          const monthlyAmt = Number(tx.amount) || 0;
          installmentGroupMap.set(groupKey, {
            parent_id: groupKey,
            merchant: tx.merchant,
            monthly_amount: monthlyAmt,
            total_installments: totalInst,
            total_amount: Math.round(monthlyAmt * totalInst * 100) / 100,
            category_name: tx.category_id ? categoryMap.get(tx.category_id) || 'Taksitli Harcama' : 'Taksitli Harcama',
            start_date: tx.transaction_date
          });
        }
      }
    }

    // Gerçekleşen taksit sayısını hesapla ve SADECE henüz bitmemiş veya bu döneme ait taksiti olan planları döndür
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
    }).filter(inst => {
      // Tamamlanmamış taksitler veya bu dönem içinde taksit satırı olanlar aktiftir
      const hasPending = inst.completed_installments < inst.total_installments;
      const hasThisCycleTx = allCardTx.some((tx: any) => 
        (tx.parent_transaction_id === inst.parent_id || (tx.merchant === inst.merchant && tx.total_installments === inst.total_installments)) &&
        tx.is_installment === 1 &&
        tx.transaction_date >= cycleStartISO && tx.transaction_date <= cycleEndISO
      );
      return hasPending || hasThisCycleTx;
    });

    // Hesaplama Özeti
    // Bu dönemki tek çekimler (Kuruş yuvarlama güvenli)
    const singleTotal = Math.round(singleTransactions.reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0) * 100) / 100;

    // Bu dönemki taksit dilimleri toplamı (Cari ekstre döngüsüne denk gelen taksit satırları)
    const thisPeriodInstallments = allCardTx.filter((tx: any) => 
      tx.is_installment === 1 && tx.transaction_date >= cycleStartISO && tx.transaction_date <= cycleEndISO
    );
    const monthlyInstallmentTotal = Math.round(thisPeriodInstallments.reduce((sum: number, tx: any) => sum + (Number(tx.amount) || 0), 0) * 100) / 100;

    // Bu ay ödenecek net güncel ekstre borcu (Tek çekim + Bu ayki taksit dilimi)
    const currentStatementDebt = Math.round((singleTotal + monthlyInstallmentTotal) * 100) / 100;

    // Gelecek aylara sarkan taksit borcu
    const futureInstallmentsDebt = Math.max(0, Math.round(((Number(cardAccount.balance) || 0) - currentStatementDebt) * 100) / 100);

    return NextResponse.json({
      success: true,
      data: {
        card: {
          id: cardAccount.id,
          name: cardAccount.name,
          balance: cardAccount.balance, // Toplam Kart Borcu (Limit Kullanımı)
          credit_limit: cardAccount.credit_limit || 0,
          available_limit: Math.max(0, Math.round(((cardAccount.credit_limit || 0) - (cardAccount.balance || 0)) * 100) / 100),
          cutoff_day: cardAccount.cutoff_day || null,
          due_day: cardAccount.due_day || null,
          currency: cardAccount.currency || 'TRY',
          is_overdue: ccSchedule.is_overdue,
          overdue_amount: ccSchedule.overdue_amount,
          days_overdue: ccSchedule.days_overdue,
          estimated_late_interest: ccSchedule.estimated_late_interest,
          next_due_date: ccSchedule.next_due_date,
          days_until_due: ccSchedule.days_until_due
        },
        summary: {
          singleTotal,
          monthlyInstallmentTotal,
          currentStatementDebt,      // BU DÖNEMKİ GÜNCEL EKSTRE BORCU
          futureInstallmentsDebt,    // GELECEK DÖNEM TAKSİT BORÇLARI
          totalCardDebt: cardAccount.balance, // TOPLAM KART BORCU
          schedule: ccSchedule
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
