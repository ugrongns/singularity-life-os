import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { walletsAccounts, transactions, categories } from '@/db/schema';
import { eq, desc, or, sql } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { calculateCreditCardSchedule, isCardNonPurchaseTx } from '@/lib/bill-schedule';
import { getTodayTurkeyDate, parseTurkeyCalendarDate } from '@/lib/date-utils';

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
    const belongsToFamily = cardAccount.family_id
      ? Boolean(familyId && cardAccount.family_id === familyId)
      : cardAccount.user_id === user.id;
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
    const categoryMap = new Map((allCategories).map((c: any) => [c.id, { name: c.name, type: c.type }]));

    const enrichedCardTx = allCardTx.map((tx: any) => {
      const cat = tx.category_id ? categoryMap.get(tx.category_id) : null;
      return {
        ...tx,
        category_name: cat?.name || (tx.is_installment === 1 ? 'Taksitli Harcama' : 'Genel'),
        categoryType: cat?.type || null
      };
    });

    const today = parseTurkeyCalendarDate(getTodayTurkeyDate());
    const ccSchedule = calculateCreditCardSchedule(cardAccount, enrichedCardTx, today);
    const closedStartISO = ccSchedule.closed_cycle_start_date;
    const closedEndISO = ccSchedule.statement_cutoff_date;
    const cycleStartISO = ccSchedule.cycle_start_date;
    const cycleEndISO = ccSchedule.cycle_end_date;

    // 1. Tek Çekim Harcamalar (is_installment === 0, ödeme/virman/gelir mutabakatı hariç)
    const closedSingleTransactions = enrichedCardTx
      .filter((tx: any) =>
        (!tx.is_installment || tx.is_installment === 0) &&
        !isCardNonPurchaseTx(tx) &&
        tx.transaction_date >= closedStartISO &&
        tx.transaction_date <= closedEndISO
      )
      .map((tx: any) => ({ ...tx, cycle_period: 'closed' as const }));

    const openSingleTransactions = enrichedCardTx
      .filter((tx: any) =>
        (!tx.is_installment || tx.is_installment === 0) &&
        !isCardNonPurchaseTx(tx) &&
        tx.transaction_date >= cycleStartISO &&
        tx.transaction_date <= cycleEndISO
      )
      .map((tx: any) => ({ ...tx, cycle_period: 'open' as const }));

    const singleTransactions = [...openSingleTransactions, ...closedSingleTransactions];

    // 2. Aktif Taksitli Harcamalar (is_installment === 1)
    // Tüm kardeş taksit satırlarını gruplayarak gerçek ilk tarih ve toplam tutarı hesapla
    const installmentGroupMap = new Map<string, {
      id: string;
      parent_id: string;
      merchant: string;
      total_installments: number;
      category_name: string;
      rows: any[];
    }>();

    for (const tx of enrichedCardTx) {
      if (tx.is_installment === 1 && !isCardNonPurchaseTx(tx)) {
        const groupKey = tx.parent_transaction_id || `${tx.merchant}-${tx.total_installments}`;
        const existing = installmentGroupMap.get(groupKey);
        if (!existing) {
          installmentGroupMap.set(groupKey, {
            id: groupKey,
            parent_id: groupKey,
            merchant: tx.merchant,
            total_installments: tx.total_installments || 1,
            category_name: tx.category_name || 'Taksitli Harcama',
            rows: [tx]
          });
        } else {
          existing.rows.push(tx);
        }
      }
    }

    const remainingCutoffDate = ccSchedule.closed_statement_debt > 0 ? closedStartISO : cycleStartISO;

    const activeInstallments = Array.from(installmentGroupMap.values())
      .map(group => {
        const sortedRows = [...group.rows].sort((a, b) =>
          (a.transaction_date || '').localeCompare(b.transaction_date || '') ||
          ((Number(a.installment_number) || 0) - (Number(b.installment_number) || 0))
        );
        const totalInst = Math.max(group.total_installments, sortedRows.length);
        const firstDate = sortedRows[0].transaction_date;
        const rowsSum = Math.round(sortedRows.reduce((s, r) => s + (Number(r.amount) || 0), 0) * 100) / 100;
        const totalAmount = sortedRows.length === 1 && totalInst > 1
          ? Math.round((Number(sortedRows[0].amount) || 0) * totalInst * 100) / 100
          : rowsSum;

        const currentCycleRow =
          sortedRows.find(r => r.transaction_date >= cycleStartISO && r.transaction_date <= cycleEndISO) ||
          sortedRows.find(r => r.transaction_date >= closedStartISO && r.transaction_date <= closedEndISO) ||
          sortedRows.find(r => r.transaction_date > cycleEndISO) ||
          sortedRows[0];

        const monthlyAmount = Number(currentCycleRow.amount) || 0;
        const dueCount = sortedRows.filter(r => r.transaction_date <= cycleEndISO).length;
        const derivedCompleted = Math.max(1, Math.min(dueCount, totalInst));
        const completedInstallments = currentCycleRow.installment_number
          ? Math.max(1, Math.min(Number(currentCycleRow.installment_number), totalInst))
          : derivedCompleted;
        const remainingAmount = Math.round(
          sortedRows
            .filter(r => r.transaction_date >= remainingCutoffDate)
            .reduce((s, r) => s + (Number(r.amount) || 0), 0) * 100
        ) / 100;

        return {
          id: group.id,
          parent_id: group.parent_id,
          merchant: group.merchant,
          monthly_amount: monthlyAmount,
          total_installments: totalInst,
          total_amount: totalAmount,
          remaining_amount: remainingAmount,
          category_name: group.category_name,
          first_date: firstDate,
          start_date: firstDate,
          current_installment_number: completedInstallments,
          completed_installments: completedInstallments,
          _rows: sortedRows
        };
      })
      .filter(inst => {
        const hasPending = inst.completed_installments < inst.total_installments || inst.remaining_amount > 0;
        const hasThisCycleTx = inst._rows.some((r: any) => r.transaction_date >= cycleStartISO && r.transaction_date <= cycleEndISO);
        const hasClosedCycleTx = ccSchedule.closed_statement_debt > 0 && inst._rows.some((r: any) => r.transaction_date >= closedStartISO && r.transaction_date <= closedEndISO);
        return hasPending || hasThisCycleTx || hasClosedCycleTx;
      })
      .map(({ _rows, ...rest }) => rest);

    // Hesaplama Özeti (Kesilmiş Ekstre vs Açık Dönem ayrımı)
    const closedSingleTotal = Math.round(closedSingleTransactions.reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0) * 100) / 100;
    const openSingleTotal = Math.round(openSingleTransactions.reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0) * 100) / 100;

    const closedInstallmentTotal = Math.round(
      enrichedCardTx
        .filter((tx: any) => tx.is_installment === 1 && !isCardNonPurchaseTx(tx) && tx.transaction_date >= closedStartISO && tx.transaction_date <= closedEndISO)
        .reduce((sum: number, tx: any) => sum + (Number(tx.amount) || 0), 0) * 100
    ) / 100;

    const openInstallmentTotal = Math.round(
      enrichedCardTx
        .filter((tx: any) => tx.is_installment === 1 && !isCardNonPurchaseTx(tx) && tx.transaction_date >= cycleStartISO && tx.transaction_date <= cycleEndISO)
        .reduce((sum: number, tx: any) => sum + (Number(tx.amount) || 0), 0) * 100
    ) / 100;

    const singleTotal = ccSchedule.closed_statement_debt > 0 ? closedSingleTotal : openSingleTotal;
    const monthlyInstallmentTotal = ccSchedule.closed_statement_debt > 0 ? closedInstallmentTotal : openInstallmentTotal;

    // Kesilmiş ekstre borcu (closed_statement_debt) ve açık dönem harcaması (open_cycle_debt) birbirinden ayrılır
    const currentStatementDebt = ccSchedule.closed_statement_debt;
    const openCycleDebt = ccSchedule.open_cycle_debt;
    const futureInstallmentsDebt = ccSchedule.future_installments_debt;

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
          days_until_due: ccSchedule.days_until_due,
          closed_statement_debt: ccSchedule.closed_statement_debt,
          closed_due_date: ccSchedule.closed_due_date,
          active_due_date: ccSchedule.active_due_date,
          statement_cutoff_date: ccSchedule.statement_cutoff_date
        },
        summary: {
          singleTotal,
          monthlyInstallmentTotal,
          closedSingleTotal,
          closedInstallmentTotal,
          openSingleTotal,
          openInstallmentTotal,
          currentStatementDebt,      // KESİLMİŞ EKSTRE BORCU (bu dönem ödenecek)
          openCycleDebt,             // AÇIK DÖNEM HARCAMALARI (kesim sonrası, gelecek ekstre)
          futureInstallmentsDebt,    // GELECEK DÖNEM TAKSİT BORÇLARI
          totalCardDebt: cardAccount.balance, // TOPLAM KART BORCU
          closedCycleStartDate: closedStartISO,
          closedCutoffDate: closedEndISO,
          closedDueDate: ccSchedule.closed_due_date,
          openCycleStartDate: cycleStartISO,
          openCycleEndDate: cycleEndISO,
          activeDueDate: ccSchedule.active_due_date,
          schedule: ccSchedule
        },
        singleTransactions,
        closedSingleTransactions,
        openSingleTransactions,
        activeInstallments
      }
    });
  } catch (error: any) {
    console.error('Card Statement API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
