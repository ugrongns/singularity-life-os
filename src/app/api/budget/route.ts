import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { walletsAccounts, categories, transactions, vehicleLegalReminders, familyMembers, recurringBills } from '@/db/schema';
import { desc, asc, eq, and, sql , or } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

import { calculateBillSchedule } from '@/lib/bill-schedule';

export async function GET(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    const userId = user?.id;

    const { searchParams } = new URL(req.url, 'http://localhost');
    const monthParam = searchParams.get('month'); // YYYY-MM

    const today = new Date();
    // ✅ Timezone-safe: yerel yıl/ay bileşenleri kullanılır (toISOString() UTC'ye kaydırır)
    const localYYYYMM = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const localYYYYMMDD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const currentMonthStr = monthParam || localYYYYMM(today);

    const USD_RATE = 36.50;
    const EUR_RATE = 39.80;
    const GOLD_GRAM_RATE = 3180;
    const BTC_RATE = 3500000;

    const familyId = user?.family_id || (userId ? `fam-${userId}` : null);

    // 1. Hesaplar & Cüzdanlar
    const rawAccounts = userId
      ? await db.select().from(walletsAccounts).where(
          and(
            eq(walletsAccounts.is_active, 1),
            familyId
              ? and(eq(walletsAccounts.family_id, familyId), or(eq(walletsAccounts.user_id, userId), eq(walletsAccounts.is_family_shared, 1)))
              : eq(walletsAccounts.user_id, userId)
          )
        )
      : [];
    const accounts = rawAccounts;

    // 2. Kategoriler
    const allCategories = await db.select().from(categories);
    const categoryMap = new Map((allCategories).map((c: any) => [c.id, c]));

    // 3. Son 5 Harcama (Geçmiş İşlemler)
    const allRecentTx = userId
      ? await db.select()
          .from(transactions)
          .where(
            familyId
              ? and(eq(transactions.family_id, familyId), or(eq(transactions.user_id, userId), eq(transactions.is_family_shared, 1)))
              : eq(transactions.user_id, userId)
          )
          .orderBy(desc(transactions.transaction_date), desc(transactions.created_at))
          .limit(50)
      : [];

    // 2.5. Aile Üyeleri Haritası
    const allFamilyMembers = await db.select().from(familyMembers);
    const familyMap = new Map((allFamilyMembers).map((fm: any) => [fm.id, fm]));

    // Gelir ve Transfer/Ödeme olan tüm işlemleri harcamalar listesinden çıkar (Sadece gerçek 3. şahıs giderleri görünsün)
    const recentTx = (allRecentTx)
      .filter((tx: any) => {
        const cat = tx.category_id ? categoryMap.get(tx.category_id) : null;
        const isIncome = (cat && cat.type === 'income') ||
          tx.merchant?.toLowerCase().includes('kira geliri') ||
          tx.merchant?.toLowerCase().includes('maaş') ||
          tx.merchant?.toLowerCase().includes('temettü') ||
          tx.notes?.toLowerCase().includes('gelir');

        const isTransfer = (
          tx.merchant?.startsWith('💳 Kart Ödemesi:') ||
          tx.merchant?.startsWith('🔄 Transfer:') ||
          tx.merchant?.toLowerCase().includes('kart borç ödemesi') ||
          tx.notes?.toLowerCase().includes('borç ödemesi') ||
          tx.notes?.toLowerCase().includes('transfer')
        );

        return !isIncome && !isTransfer && (!tx.is_installment || tx.installment_number === 1);
      })
      .slice(0, 6)
      .map((tx: any) => {
        const fm = tx.member_id ? familyMap.get(tx.member_id) : null;
        return {
          ...tx,
          member_avatar: fm?.avatar || '👤',
          member_name: fm?.name || null
        };
      });

    // 4. Yaklaşan 5 Ödeme (Tarihe Göre Sıralı: Taksitler, Kredi Kartı Son Ödemeleri, Bakım/Muayene)
    const todayISO = localYYYYMMDD(today); // ✅ Timezone-safe

    const upcomingList: Array<{
      id: string;
      title: string;
      category: string;
      amount: number;
      due_date: string;
      days_left: number;
      type: 'installment' | 'card_due' | 'vehicle_legal' | 'bill';
      badge: string;
    }> = [];

    // B. Kredi Kartı Son Ödeme Günleri
    for (const acc of accounts) {
      if (acc.type === 'credit_card' && acc.due_day) {
        let cardDueDate = new Date(today.getFullYear(), today.getMonth(), acc.due_day);
        if (cardDueDate < today) {
          cardDueDate = new Date(today.getFullYear(), today.getMonth() + 1, acc.due_day);
        }
        const diffDays = Math.ceil((cardDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const dueDateStr = localYYYYMMDD(cardDueDate); // ✅ Timezone-safe

        // Bu kartın bu ayki net ekstre borcunu hesapla
        const cardTx = await db.select().from(transactions).where(eq(transactions.wallet_id, acc.id));

        const singleTotal = (cardTx)
          .filter((t: any) => (!t.is_installment || t.is_installment === 0) && t.transaction_date.startsWith(currentMonthStr))
          .reduce((sum: number, t: any) => sum + t.amount, 0);

        const instMap = new Map<string, number>();
        for (const t of (cardTx)) {
          if (t.is_installment === 1) {
            const key = t.parent_transaction_id || `${t.merchant}-${t.total_installments}`;
            instMap.set(key, t.amount);
          }
        }
        const installmentMonthlyTotal = Array.from(instMap.values()).reduce((sum, amt) => sum + amt, 0);
        const cardStatementAmount = (singleTotal + installmentMonthlyTotal) > 0 ? (singleTotal + installmentMonthlyTotal) : acc.balance;

        upcomingList.push({
          id: `cc-${acc.id}`,
          title: `${acc.name} Ekstre Borcu`,
          category: 'Kredi Kartı',
          amount: cardStatementAmount,
          due_date: dueDateStr,
          days_left: diffDays,
          type: 'card_due',
          badge: '💳 Ekstre'
        });
      }
    }

    // C. Araç Yasal & Muayene Hatırlatıcıları
    const legalReminders = await db.select().from(vehicleLegalReminders).where(eq(vehicleLegalReminders.is_completed, 0));
    for (const leg of legalReminders) {
      const legDate = new Date(leg.due_date);
      const diffDays = Math.ceil((legDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const typeLabel = leg.type === 'muayene' ? 'TÜVTÜRK Araç Muayenesi' : leg.type === 'kasko' ? 'Kasko Poliçesi' : 'Trafik Sigortası';

      upcomingList.push({
        id: `leg-${leg.id}`,
        title: typeLabel,
        category: 'Araç Masrafı',
        amount: leg.cost_estimate || 0,
        due_date: leg.due_date,
        days_left: diffDays,
        type: 'vehicle_legal',
        badge: '🚗 Araç'
      });
    }

    // D. Periyodik Fatura & Abonelikler (Bu ay ödenmemiş olanlar)
    const userBills = userId
      ? await db.select().from(recurringBills).where(
          and(
            eq(recurringBills.status, 'active'),
            familyId
              ? or(eq(recurringBills.family_id, familyId), eq(recurringBills.user_id, userId))
              : eq(recurringBills.user_id, userId)
          )
        )
      : [];

    for (const bill of userBills) {
      const schedule = calculateBillSchedule(bill, today);
      if (!schedule.is_paid_this_month) {
        const isVariable = bill.amount_type === 'variable';
        const typeBadge = bill.type === 'subscription' ? '📱 Abonelik' : '🧾 Fatura';
        const badge = isVariable ? `${typeBadge} (Tahmini)` : typeBadge;

        upcomingList.push({
          id: `bill-${bill.id}`,
          title: bill.name,
          category: bill.type === 'subscription' ? 'Abonelik' : 'Fatura',
          amount: bill.amount,
          due_date: schedule.next_due_date,
          days_left: schedule.days_left,
          type: 'bill',
          badge
        });
      }
    }

    // Tarihe göre artan sırala (En yakın ödeme en üstte) ve ilk 5'i al
    upcomingList.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    const top5Upcoming = upcomingList.slice(0, 5);

    // 5. Seçili Ayki Harcama & Gelirleri Ayrı Ayrı Hesapla
    const categorySpending: Record<string, number> = {};
    let totalMonthlyExpense = 0;
    let totalMonthlyIncome = 0;

    const monthlyTx = userId
      ? await db.select().from(transactions).where(
          and(
            familyId
              ? and(eq(transactions.family_id, familyId), or(eq(transactions.user_id, userId), eq(transactions.is_family_shared, 1)))
              : eq(transactions.user_id, userId),
            sql`substr(${transactions.transaction_date}, 1, 7) = ${currentMonthStr}`
          )
        )
      : [];

    for (const tx of monthlyTx) {
      const cat = tx.category_id ? categoryMap.get(tx.category_id) : null;
      const isIncome = cat ? cat.type === 'income' : (tx.merchant?.toLowerCase().includes('kira geliri') || tx.merchant?.toLowerCase().includes('maaş') || tx.merchant?.toLowerCase().includes('temettü'));
      
      // Transfer ve Kart Borç Ödemeleri (Virman) Harcama veya Gelir Sayılamaz!
      const isTransfer = (
        tx.merchant?.startsWith('💳 Kart Ödemesi:') ||
        tx.merchant?.startsWith('🔄 Transfer:') ||
        tx.merchant?.toLowerCase().includes('kart borç ödemesi') ||
        tx.notes?.toLowerCase().includes('borç ödemesi') ||
        tx.notes?.toLowerCase().includes('transfer')
      );

      if (isTransfer) {
        continue;
      }

      if (isIncome) {
        totalMonthlyIncome += tx.amount;
      } else {
        totalMonthlyExpense += tx.amount;
        if (tx.category_id) {
          categorySpending[tx.category_id] = (categorySpending[tx.category_id] || 0) + tx.amount;
        }
      }
    }

    const categoriesWithSpending = (allCategories).map((cat: any) => ({
      ...cat,
      spent_this_month: categorySpending[cat.id] || 0,
      percentage: cat.monthly_budget_limit ? Math.min(Math.round(((categorySpending[cat.id] || 0) / cat.monthly_budget_limit) * 100), 100) : 0
    }));

    // 6. 50 / 30 / 20 Bütçe Sağlık Skoru & Limit Tavanı Hesabı
    let totalCreditCardLimits = 0;
    for (const acc of accounts) {
      if (acc.type === 'credit_card') {
        totalCreditCardLimits += (acc.credit_limit || 0);
      }
    }

    // ✅ Hardcode 94.000 kaldırıldı: gerçek gelir yoksa son 3 ayın ortalamasını hesapla
    let effectiveIncome = totalMonthlyIncome;
    if (effectiveIncome <= 0) {
      let incomeSum = 0;
      let incomeMonths = 0;
      for (let back = 1; back <= 3; back++) {
        const pastDate = new Date(today.getFullYear(), today.getMonth() - back, 1);
        const pastMonth = localYYYYMM(pastDate);
        const pastTxs = userId
          ? await db.select().from(transactions)
              .where(
                and(
                  familyId
                    ? and(eq(transactions.family_id, familyId), or(eq(transactions.user_id, userId), eq(transactions.is_family_shared, 1)))
                    : eq(transactions.user_id, userId),
                  sql`substr(${transactions.transaction_date}, 1, 7) = ${pastMonth}`
                )
              )
          : [];
        const pastIncome = (pastTxs)
          .filter((t: any) => {
            const c = t.category_id ? categoryMap.get(t.category_id) : null;
            return c ? c.type === 'income' : (t.merchant?.toLowerCase().includes('maaş') || t.merchant?.toLowerCase().includes('kira geliri'));
          })
          .reduce((s: number, t: any) => s + t.amount, 0);
        if (pastIncome > 0) { incomeSum += pastIncome; incomeMonths++; }
      }
      effectiveIncome = incomeMonths > 0 ? Math.round(incomeSum / incomeMonths) : 0;
    }
    const maxAllowedCap = effectiveIncome + totalCreditCardLimits;

    let plannedNeeds = 0;
    let plannedWants = 0;
    let plannedSavings = 0;

    const expenseCategoriesOnly = (categoriesWithSpending).filter((c: any) => c.type !== 'income');
    const totalBudgetLimitSum = (expenseCategoriesOnly).reduce((sum: number, c: any) => sum + (c.monthly_budget_limit || 0), 0);

    for (const cat of expenseCategoriesOnly) {
      const group = (cat as any).group_50_30_20 || 'needs';
      const lim = cat.monthly_budget_limit || 0;
      if (group === 'wants') plannedWants += lim;
      else if (group === 'savings') plannedSavings += lim;
      else plannedNeeds += lim;
    }

    const idealNeeds = effectiveIncome * 0.50;
    const idealWants = effectiveIncome * 0.30;
    const idealSavings = effectiveIncome * 0.20;

    let budgetScoreValue = 0;
    let budgetScoreGrade = '⚪ Bütçe & Gelir Tanımlanmadı';

    if (effectiveIncome > 0) {
      const needsPenalty = idealNeeds > 0 && plannedNeeds > idealNeeds ? ((plannedNeeds - idealNeeds) / idealNeeds) * 35 : 0;
      const wantsPenalty = idealWants > 0 && plannedWants > idealWants ? ((plannedWants - idealWants) / idealWants) * 40 : 0;
      const savingsPenalty = idealSavings > 0 && plannedSavings < idealSavings ? ((idealSavings - plannedSavings) / idealSavings) * 25 : 0;

      const rawScore = Math.round(100 - (needsPenalty + wantsPenalty + savingsPenalty));
      budgetScoreValue = Math.max(0, Math.min(100, rawScore));

      const needsDiff = plannedNeeds - idealNeeds;
      const wantsDiff = plannedWants - idealWants;
      const savingsDiff = idealSavings - plannedSavings;

      if (budgetScoreValue >= 85) {
        budgetScoreGrade = '🟢 Mükemmel 50/30/20 Dengesi';
      } else if (budgetScoreValue >= 75) {
        budgetScoreGrade = '🔵 Sağlıklı Bütçe Dağılımı';
      } else {
        // Sapma kaynağına göre dinamik ve doğru teşhis koy!
        if (needsDiff > 0 && needsDiff >= wantsDiff) {
          if (savingsDiff > 0) {
            budgetScoreGrade = '🟡 İhtiyaç Bütçesi Yüksek & Birikim Yetersiz';
          } else {
            budgetScoreGrade = '🟡 Zorunlu İhtiyaç Bütçesi Yüksek';
          }
        } else if (wantsDiff > 0 && wantsDiff > needsDiff) {
          if (savingsDiff > 0) {
            budgetScoreGrade = '🟡 İstek Bütçesi Yüksek & Birikim Yetersiz';
          } else {
            budgetScoreGrade = '🟡 İstek / Yaşam Bütçesi Yüksek';
          }
        } else if (savingsDiff > 0) {
          budgetScoreGrade = '🟡 Birikim / Borç Ödeme Payı Yetersiz';
        } else {
          budgetScoreGrade = '🔴 Riskli Bütçe Yapısı';
        }
      }
    }

    const budgetScore = {
      score: budgetScoreValue,
      grade: budgetScoreGrade,
      breakdown: {
        needs: { planned: plannedNeeds, ideal: idealNeeds, pct: totalBudgetLimitSum > 0 ? Math.round((plannedNeeds / totalBudgetLimitSum) * 100) : 0 },
        wants: { planned: plannedWants, ideal: idealWants, pct: totalBudgetLimitSum > 0 ? Math.round((plannedWants / totalBudgetLimitSum) * 100) : 0 },
        savings: { planned: plannedSavings, ideal: idealSavings, pct: totalBudgetLimitSum > 0 ? Math.round((plannedSavings / totalBudgetLimitSum) * 100) : 0 }
      }
    };

    // 7. Net Değer Hesabı (Cüzdanlar + Yatırımlar + Gayrimenkul - Borçlar)
    let totalCashAssetsTRY = 0;
    let totalDebtsTRY = 0;

    for (const acc of accounts) {
      const isInvAcc = ['brokerage', 'crypto_exchange', 'crypto_wallet'].includes(acc.type);
      const isCreditCard = acc.type === 'credit_card';
      const isLoan = acc.type === 'loan';

      if (isCreditCard || isLoan) {
        totalDebtsTRY += acc.balance;
      } else if (!isInvAcc) {
        // Banka, nakit, kasa (Döviz kurları ile TL'ye çevrilir)
        const rate = acc.currency === 'USD' ? USD_RATE : acc.currency === 'EUR' ? EUR_RATE : acc.currency === 'GOLD' ? GOLD_GRAM_RATE : 1.0;
        totalCashAssetsTRY += (acc.balance * rate);
      }
    }

    const netWorthTRY = totalCashAssetsTRY - totalDebtsTRY;

    const multiCurrencyNetWorth = {
      TRY: netWorthTRY,
      USD: Math.round(netWorthTRY / USD_RATE),
      EUR: Math.round(netWorthTRY / EUR_RATE),
      GOLD_GRAM: (netWorthTRY / GOLD_GRAM_RATE).toFixed(1),
      BTC: (netWorthTRY / BTC_RATE).toFixed(2),
      breakdown: {
        cashAndBanks: totalCashAssetsTRY,
        investmentsAndBES: 0,
        realEstate: 0,
        debts: totalDebtsTRY
      }
    };

    // 6.5 Gelecek 6 Ay Taksit & Bütçe Projeksiyonu
    // ✅ Düzeltme: Sadece taksitler değil, o aya ait TÜM harcamalar gösteriliyor
    const futureForecast: Array<{
      monthStr: string;
      monthName: string;
      committedInstallments: number;
      committedAmount: number;     // sadece taksit toplamı (borç yükü)
      totalExpense: number;        // o aya ait toplam harcama (taksit + normal)
      totalIncome: number;         // o aya ait gelir (geçmiş aylar için gerçek, gelecek için 0)
      totalBudgetLimit: number;
      freeBudget: number;
      commitmentPercentage: number;
    }> = [];

    const startYear = today.getFullYear();
    const startMonth = today.getMonth();

    for (let m = 0; m < 6; m++) {
      const fDate = new Date(startYear, startMonth + m, 1);
      const fMonthStr = localYYYYMM(fDate); // ✅ Timezone-safe
      const fMonthName = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(fDate);

      const monthTxs = userId
        ? await db.select()
            .from(transactions)
            .where(
              and(
                familyId
                  ? and(eq(transactions.family_id, familyId), or(eq(transactions.user_id, userId), eq(transactions.is_family_shared, 1)))
                  : eq(transactions.user_id, userId),
                sql`substr(${transactions.transaction_date}, 1, 7) = ${fMonthStr}`
              )
            )
        : [];

      const installmentTxs = (monthTxs).filter((t: any) => t.is_installment === 1);
      const committedAmount = (installmentTxs).reduce((sum: number, t: any) => sum + t.amount, 0);

      // O aya ait toplam harcama (transfer/kart ödemeleri hariç)
      let fTotalExpense = 0;
      let fTotalIncome = 0;
      for (const t of (monthTxs)) {
        const tCat = t.category_id ? categoryMap.get(t.category_id) : null;
        const tIsIncome = tCat ? tCat.type === 'income' : (t.merchant?.toLowerCase().includes('maaş') || t.merchant?.toLowerCase().includes('kira geliri') || t.merchant?.toLowerCase().includes('temettü'));
        const tIsTransfer = (t.merchant?.startsWith('💳 Kart Ödemesi:') || t.merchant?.startsWith('🔄 Transfer:') || t.notes?.toLowerCase().includes('borç ödemesi') || t.notes?.toLowerCase().includes('transfer'));
        if (tIsTransfer) continue;
        if (tIsIncome) fTotalIncome += t.amount;
        else fTotalExpense += t.amount;
      }

      const isColdStart = accounts.length === 0 && effectiveIncome === 0 && allRecentTx.length === 0;
      const effectiveBudgetLimit = isColdStart ? 0 : totalBudgetLimitSum;
      const freeBudget = Math.max(0, effectiveBudgetLimit - committedAmount);
      const commitmentPercentage = effectiveBudgetLimit > 0 ? Math.min(100, Math.round((committedAmount / effectiveBudgetLimit) * 100)) : 0;

      futureForecast.push({
        monthStr: fMonthStr,
        monthName: fMonthName,
        committedInstallments: installmentTxs.length,
        committedAmount,
        totalExpense: fTotalExpense,
        totalIncome: fTotalIncome,
        totalBudgetLimit: effectiveBudgetLimit,
        freeBudget,
        commitmentPercentage
      });
    }

    const isColdStart = accounts.length === 0 && effectiveIncome === 0 && allRecentTx.length === 0;

    return NextResponse.json({
      success: true,
      data: {
        accounts,
        categories: categoriesWithSpending,
        recentTransactions: recentTx,
        upcomingPayments: top5Upcoming,
        netWorth: multiCurrencyNetWorth,
        monthlySummary: {
          selectedMonth: currentMonthStr,
          totalExpense: totalMonthlyExpense,
          totalIncome: totalMonthlyIncome,
          totalBudgetLimit: isColdStart ? 0 : totalBudgetLimitSum,
          maxAllowedCap,
          totalCreditCardLimits,
          budgetScore,
          futureForecast,
          // ✅ Timezone-safe: YYYY-MM-01 UTC olarak parse edildiği için yerel ay adı yanlış çıkabilirdi
          monthName: new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(
            new Date(parseInt(currentMonthStr.slice(0, 4)), parseInt(currentMonthStr.slice(5, 7)) - 1, 1)
          )
        }
      }
    });
  } catch (error: any) {
    console.error('Budget API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
