import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { walletsAccounts, categories, transactions, vehicleLegalReminders, familyMembers, recurringBills, vehicles, sinkingFunds } from '@/db/schema';
import { calculateSafeDailySpendLimit } from '@/lib/debt-simulators';
import { desc, eq, and, sql, or, inArray } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

import {
  calculateBillSchedule,
  calculateCreditCardSchedule,
  getCreditCardStatementDueMonth,
  isCardNonPurchaseTx,
  localYYYYMM
} from '@/lib/bill-schedule';
import { diffTurkeyCalendarDays, getTodayTurkeyDate, parseTurkeyCalendarDate } from '@/lib/date-utils';
import { ensureFamilyCategories } from '@/lib/budget-categories';
import { fetchLiveExchangeRates } from '@/lib/market-data';

export async function GET(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }
    const userId = user.id;

    const { searchParams } = new URL(req.url, 'http://localhost');
    const monthParam = searchParams.get('month'); // YYYY-MM

    const todayTurkeyStr = getTodayTurkeyDate();
    const today = parseTurkeyCalendarDate(todayTurkeyStr);
    const currentMonthStr = monthParam || localYYYYMM(today);

    // Canlı Piyasa & TCMB / Serbest Piyasa Kurları
    const liveRates = await fetchLiveExchangeRates();
    const USD_RATE = liveRates.USD_TRY || 0;
    const EUR_RATE = liveRates.EUR_TRY || 0;
    const GBP_RATE = liveRates.GBP_TRY || 0;
    const GOLD_GRAM_RATE = liveRates.GOLD_GRAM_TRY || 0;
    const BTC_RATE = liveRates.BTC_TRY || 0;

    const familyId = user?.family_id || (userId ? `fam-${userId}` : null);

    // 2.5. Aile Üyeleri Haritası
    const allFamilyMembers = familyId
      ? await db.select().from(familyMembers).where(and(eq(familyMembers.is_active, 1), eq(familyMembers.family_id, familyId)))
      : await db.select().from(familyMembers).where(eq(familyMembers.is_active, 1));
    const familyMap = new Map((allFamilyMembers).map((fm: any) => [fm.id, fm]));
    const userToMemberMap = new Map((allFamilyMembers).filter((fm: any) => fm.user_id).map((fm: any) => [fm.user_id, fm]));

    // 1. Hesaplar & Cüzdanlar (Sahiplik ve Rozet Bilgisi Eklenmiş)
    const rawAccounts = userId
      ? await db.select().from(walletsAccounts).where(
          and(
            eq(walletsAccounts.is_active, 1),
            familyId
              ? and(
                  eq(walletsAccounts.family_id, familyId),
                  or(
                    eq(walletsAccounts.user_id, userId),
                    eq(walletsAccounts.is_family_shared, 1),
                    sql`${walletsAccounts.user_id} IS NULL`
                  )
                )
              : eq(walletsAccounts.user_id, userId)
          )
        )
      : [];
    const accounts = rawAccounts.map((acc: any) => {
      const ownerMember = acc.user_id ? userToMemberMap.get(acc.user_id) : null;
      const isMine = Boolean(userId && acc.user_id === userId);
      const isJoint = !acc.user_id;

      return {
        ...acc,
        owner_name: ownerMember ? ownerMember.name : (isJoint ? 'Ortak Hesap' : (isMine ? (user?.full_name || 'Ben') : 'Ortak')),
        owner_avatar: ownerMember?.avatar || (isJoint ? '👥' : (isMine ? (user?.avatar_emoji || '👑') : '👥')),
        is_mine: isMine,
        is_joint: isJoint,
        can_edit: isMine || user?.role === 'admin' || user?.is_master_account === 1 || isJoint
      };
    });

    // 2. Kategoriler (Yalnızca bu aileye ait izole kategoriler; boşsa çekirdek şablonları ilk kez oluştur)
    let allCategories = familyId
      ? await db.select().from(categories).where(eq(categories.family_id, familyId))
      : [];
    if (allCategories.length === 0 && familyId) {
      allCategories = await ensureFamilyCategories(familyId);
    }
    const categoryMap = new Map((allCategories).map((c: any) => [c.id, c]));
    const accountMap = new Map((accounts).map((a: any) => [a.id, a]));

    const isTransferOrPaymentTx = (tx: any) => {
      const cat = tx.category_id ? categoryMap.get(tx.category_id) : null;
      const merchantLower = (tx.merchant || '').toLowerCase();
      const notesLower = (tx.notes || '').toLowerCase();
      return (
        isCardNonPurchaseTx({
          categoryType: cat?.type || null,
          merchant: tx.merchant,
          notes: tx.notes
        }) && (
          tx.merchant?.includes('Kart Ödemesi') ||
          tx.merchant?.includes('Kart Ödeme Tahsilatı') ||
          tx.merchant?.includes('Kart Ödeme') ||
          tx.merchant?.includes('Transfer Çıkışı') ||
          tx.merchant?.includes('Gelen Transfer') ||
          tx.merchant?.includes('Transfer:') ||
          merchantLower.includes('kart borç ödemesi') ||
          tx.notes?.includes('[from_wallet:') ||
          tx.notes?.includes('[to_wallet:')
        )
      ) || Boolean(
        tx.merchant?.includes('Vadeli Mevduat Açılışı') ||
        tx.merchant?.includes('Vadeli Mevduat Dönüşü (Anapara)') ||
        tx.merchant?.includes('Kredi Çekim Anaparası') ||
        tx.merchant?.startsWith('🤝 Şahıs') ||
        tx.merchant?.startsWith('🤝 Şahsa') ||
        notesLower.includes('borç ödemesi') ||
        notesLower.includes('transfer')
      );
    };

    const isBudgetIncomeTx = (tx: any) => {
      const cat = tx.category_id ? categoryMap.get(tx.category_id) : null;
      if (cat) return cat.type === 'income';
      const merchantLower = (tx.merchant || '').toLowerCase();
      const notesLower = (tx.notes || '').toLowerCase();
      return (
        merchantLower.includes('kira geliri') ||
        merchantLower.includes('maaş') ||
        merchantLower.includes('temettü') ||
        merchantLower.includes('faiz geliri') ||
        merchantLower.includes('gelir girişi') ||
        merchantLower.includes('gelir') ||
        notesLower.includes('düzeltme geliri') ||
        notesLower.includes('faiz getirisi')
      );
    };

    // 3. Tüm Aile İşlemlerini Tek Sorguda Çek ve Bellekte İndeksle (15+ N+1 sorguyu 1 sorguya indirir)
    const allFamilyTxs = userId
      ? await db.select()
          .from(transactions)
          .where(
            familyId
              ? and(eq(transactions.family_id, familyId), or(eq(transactions.user_id, userId), eq(transactions.is_family_shared, 1)))
              : eq(transactions.user_id, userId)
          )
          .orderBy(desc(transactions.transaction_date), desc(transactions.created_at))
      : [];

    // O(1) erişim için Cüzdan bazlı, Takvim Ayı (YYYY-MM) bazlı ve Tahmini Ekstre Ayı bazlı işlem indeksleri
    const cardTxByWallet = new Map<string, any[]>();
    const txByMonth = new Map<string, any[]>();
    const forecastTxByMonth = new Map<string, any[]>();
    for (const tx of allFamilyTxs) {
      if (tx.wallet_id) {
        const wList = cardTxByWallet.get(tx.wallet_id);
        if (wList) wList.push(tx);
        else cardTxByWallet.set(tx.wallet_id, [tx]);
      }
      if (tx.transaction_date) {
        const mKey = tx.transaction_date.slice(0, 7);
        const mList = txByMonth.get(mKey);
        if (mList) mList.push(tx);
        else txByMonth.set(mKey, [tx]);

        const acc = tx.wallet_id ? accountMap.get(tx.wallet_id) : null;
        const fKey = (acc && acc.type === 'credit_card' && acc.due_day)
          ? (getCreditCardStatementDueMonth(tx.transaction_date, acc) || mKey)
          : mKey;
        const fList = forecastTxByMonth.get(fKey);
        if (fList) fList.push(tx);
        else forecastTxByMonth.set(fKey, [tx]);
      }
    }

    // Gelir ve Transfer/Ödeme olan tüm işlemleri harcamalar listesinden çıkar (Sadece gerçek 3. şahıs giderleri görünsün)
    const recentTx = (allFamilyTxs)
      .filter((tx: any) => {
        const isIncome = isBudgetIncomeTx(tx) || tx.notes?.toLowerCase().includes('gelir');
        const isTransfer = isTransferOrPaymentTx(tx);

        return !isIncome && !isTransfer && (!tx.is_installment || tx.installment_number === 1);
      })
      .slice(0, 15)
      .map((tx: any) => {
        const fm = tx.member_id ? familyMap.get(tx.member_id) : (tx.user_id ? userToMemberMap.get(tx.user_id) : null);
        const cat = tx.category_id ? categoryMap.get(tx.category_id) : null;
        const acc = tx.wallet_id ? accountMap.get(tx.wallet_id) : null;
        return {
          ...tx,
          category_name: cat?.name || null,
          category_icon: cat?.icon || null,
          wallet_name: acc?.name || null,
          member_avatar: fm?.avatar || (tx.user_id === userId ? (user?.avatar_emoji || '👑') : '👤'),
          member_name: fm?.name || (tx.user_id === userId ? (user?.full_name || 'Ben') : null),
          is_mine: Boolean(userId && tx.user_id === userId),
          can_delete: Boolean(userId && tx.user_id === userId) || user?.role === 'admin' || user?.is_master_account === 1
        };
      });

    // 4. Yaklaşan 5 Ödeme (Tarihe Göre Sıralı: Taksitler, Kredi Kartı Son Ödemeleri, Bakım/Muayene)
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

    // B. Kredi Kartı Son Ödeme & Risk Motoru (monthParam'dan bağımsız gerçek ekstre döngüsü)
    for (const acc of accounts) {
      if (acc.type === 'credit_card') {
        const rawCardTx = cardTxByWallet.get(acc.id) || [];
        const cardTx = rawCardTx.map((t: any) => ({
          ...t,
          categoryType: t.category_id ? categoryMap.get(t.category_id)?.type || null : null
        }));
        const ccSchedule = calculateCreditCardSchedule(acc, cardTx, today);

        // Hesaba ekstre & gecikme alanlarını ekle
        acc.is_overdue = ccSchedule.is_overdue;
        acc.overdue_amount = ccSchedule.overdue_amount;
        acc.days_overdue = ccSchedule.days_overdue;
        acc.estimated_late_interest = ccSchedule.estimated_late_interest;
        acc.next_due_date = ccSchedule.next_due_date;
        acc.days_until_due = ccSchedule.days_until_due;
        acc.current_cycle_spending = ccSchedule.current_cycle_spending;
        acc.closed_statement_debt = ccSchedule.closed_statement_debt;
        acc.closed_due_date = ccSchedule.closed_due_date;
        acc.active_due_date = ccSchedule.active_due_date;

        if (acc.due_day && (Number(acc.balance) || 0) > 0) {
          if (ccSchedule.is_overdue && ccSchedule.overdue_amount > 0) {
            upcomingList.push({
              id: `cc-${acc.id}`,
              title: `${acc.name} Geciken Ekstre`,
              category: 'Kredi Kartı',
              amount: ccSchedule.overdue_amount,
              due_date: ccSchedule.last_due_date,
              days_left: -ccSchedule.days_overdue,
              type: 'card_due',
              badge: '🚨 Gecikmede'
            });
          } else if (ccSchedule.closed_statement_debt > 0) {
            upcomingList.push({
              id: `cc-${acc.id}`,
              title: `${acc.name} Ekstre Borcu`,
              category: 'Kredi Kartı',
              amount: ccSchedule.closed_statement_debt,
              due_date: ccSchedule.closed_due_date,
              days_left: ccSchedule.days_until_due,
              type: 'card_due',
              badge: '💳 Ekstre'
            });
          } else if (ccSchedule.open_cycle_debt > 0) {
            upcomingList.push({
              id: `cc-${acc.id}`,
              title: `${acc.name} Gelecek Ekstre`,
              category: 'Kredi Kartı',
              amount: ccSchedule.open_cycle_debt,
              due_date: ccSchedule.active_due_date,
              days_left: ccSchedule.days_until_due,
              type: 'card_due',
              badge: '🗓️ Açık Dönem'
            });
          }
        }
      }
    }

    // C. Araç Yasal & Muayene Hatırlatıcıları (Kullanıcı / Aile Araçlarına Göre Filtreli)
    const userVehicles = userId
      ? await db.select({ id: vehicles.id }).from(vehicles).where(
          familyId
            ? or(eq(vehicles.family_id, familyId), eq(vehicles.user_id, userId))
            : eq(vehicles.user_id, userId)
        )
      : [];
    const vehicleIds = userVehicles.map(v => v.id);
    const legalReminders = vehicleIds.length > 0
      ? await db.select().from(vehicleLegalReminders).where(
          and(
            eq(vehicleLegalReminders.is_completed, 0),
            inArray(vehicleLegalReminders.vehicle_id, vehicleIds)
          )
        )
      : [];
    for (const leg of legalReminders) {
      const diffDays = diffTurkeyCalendarDays(leg.due_date, todayTurkeyStr) ?? 0;
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
    const memberSpending: Record<string, number> = {};
    let totalMonthlyExpense = 0;
    let totalMonthlyIncome = 0;

    const monthlyTx = txByMonth.get(currentMonthStr) || [];

    for (const tx of monthlyTx) {
      // Transfer ve Kart Borç Ödemeleri (Virman) Harcama veya Gelir Sayılamaz!
      if (isTransferOrPaymentTx(tx)) {
        continue;
      }

      if (isBudgetIncomeTx(tx)) {
        totalMonthlyIncome += tx.amount;
      } else {
        totalMonthlyExpense += tx.amount;
        if (tx.category_id) {
          categorySpending[tx.category_id] = (categorySpending[tx.category_id] || 0) + tx.amount;
        }
        // Kişi bazlı harcama hesabı (member_id veya user_id)
        const memberKey = tx.member_id || (tx.user_id ? `user-${tx.user_id}` : 'other');
        memberSpending[memberKey] = (memberSpending[memberKey] || 0) + tx.amount;
      }
    }

    // Kişi Başına Harcama Dağılımı Listesi
    const memberBreakdown = Object.entries(memberSpending).map(([key, spent]) => {
      let name = 'Ortak / Diğer';
      let avatar = '👥';
      const memberId = key;

      if (key.startsWith('user-')) {
        const uId = key.replace('user-', '');
        const fm = userToMemberMap.get(uId);
        name = fm ? fm.name : (uId === userId ? (user?.full_name || 'Ben') : 'Aile Üyesi');
        avatar = fm?.avatar || (uId === userId ? (user?.avatar_emoji || '👑') : '👤');
      } else if (familyMap.has(key)) {
        const fm = familyMap.get(key);
        name = fm?.name || 'Aile Üyesi';
        avatar = fm?.avatar || '👤';
      }

      const percentage = totalMonthlyExpense > 0 ? Math.round((spent / totalMonthlyExpense) * 100) : 0;
      return {
        memberId,
        name,
        avatar,
        totalSpent: spent,
        percentage
      };
    }).sort((a, b) => b.totalSpent - a.totalSpent);

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
        const pastTxs = txByMonth.get(pastMonth) || [];
        const pastIncome = (pastTxs)
          .filter((t: any) => !isTransferOrPaymentTx(t) && isBudgetIncomeTx(t))
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
      const isKmh = acc.type === 'kmh';

      // Döviz kurları ile TL'ye çevrilir
      const rate = acc.currency === 'USD' ? USD_RATE :
        acc.currency === 'EUR' ? EUR_RATE :
        acc.currency === 'GBP' ? GBP_RATE :
        acc.currency === 'GOLD' ? GOLD_GRAM_RATE : 1.0;

      if (isCreditCard || isLoan) {
        totalDebtsTRY += (acc.balance * rate);
      } else if (isKmh && acc.balance < 0) {
        // KMH eksi bakiye borç olarak sayılır
        totalDebtsTRY += (Math.abs(acc.balance) * rate);
      } else if (!isInvAcc) {
        // Banka, nakit, kasa, artı bakiyeli KMH vb.
        totalCashAssetsTRY += (Math.max(0, acc.balance) * rate);
      }
    }

    const netWorthTRY = totalCashAssetsTRY - totalDebtsTRY;

    const multiCurrencyNetWorth = {
      TRY: netWorthTRY,
      USD: USD_RATE > 0 ? Math.round(netWorthTRY / USD_RATE) : 0,
      EUR: EUR_RATE > 0 ? Math.round(netWorthTRY / EUR_RATE) : 0,
      GBP: GBP_RATE > 0 ? Math.round(netWorthTRY / GBP_RATE) : 0,
      GOLD_GRAM: GOLD_GRAM_RATE > 0 ? (netWorthTRY / GOLD_GRAM_RATE).toFixed(1) : '0.0',
      BTC: BTC_RATE > 0 ? (netWorthTRY / BTC_RATE).toFixed(2) : '0.00',
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

      // Kredi kartı harcamaları kesim ve son ödeme gününe göre gerçek ekstre ödeme ayına gruplanır
      const monthTxs = forecastTxByMonth.get(fMonthStr) || [];

      const installmentTxs = (monthTxs).filter((t: any) => {
        if (t.is_installment !== 1 || isTransferOrPaymentTx(t)) return false;
        const tCat = t.category_id ? categoryMap.get(t.category_id) : null;
        return tCat?.type !== 'income';
      });
      const committedAmount = (installmentTxs).reduce((sum: number, t: any) => sum + t.amount, 0);

      // O aya ait toplam harcama (transfer/kart ödemeleri hariç)
      let fTotalExpense = 0;
      let fTotalIncome = 0;
      for (const t of (monthTxs)) {
        if (isTransferOrPaymentTx(t)) continue;
        if (isBudgetIncomeTx(t)) fTotalIncome += t.amount;
        else fTotalExpense += t.amount;
      }

      const isColdStart = accounts.length === 0 && effectiveIncome === 0 && allFamilyTxs.length === 0;
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

    const isColdStart = accounts.length === 0 && effectiveIncome === 0 && allFamilyTxs.length === 0;

    // Birikim Hedefleri (Sinking Funds)
    let sinkingFundsRows: any[] = [];
    try {
      const rows = await db
        .select()
        .from(sinkingFunds)
        .where(
          familyId
            ? or(
                eq(sinkingFunds.user_id, userId),
                and(eq(sinkingFunds.family_id, familyId), eq(sinkingFunds.is_family_shared, 1))
              )
            : eq(sinkingFunds.user_id, userId)
        )
        .orderBy(desc(sinkingFunds.created_at));
      if (Array.isArray(rows)) sinkingFundsRows = rows;
    } catch {
      sinkingFundsRows = [];
    }

    // Güvenli Günlük Harcama Limiti (TR takvim gününe göre ayın kalan günü)
    const [selYear, selMonth] = currentMonthStr.split('-').map(Number);
    const daysInSelectedMonth = new Date(selYear, selMonth, 0).getDate();
    const todayMonthStr = todayTurkeyStr.slice(0, 7);
    const todayDayNum = Number(todayTurkeyStr.slice(8, 10)) || 1;
    const remainingDaysInMonth =
      currentMonthStr === todayMonthStr
        ? Math.max(1, daysInSelectedMonth - todayDayNum + 1)
        : daysInSelectedMonth;

    const unpaidBillsSum = (top5Upcoming || [])
      .filter((u: any) => !u.is_paid)
      .reduce((acc: number, u: any) => acc + (Number(u.amount) || 0), 0);

    const safeDailyLimit = calculateSafeDailySpendLimit({
      monthlyIncome: totalMonthlyIncome,
      monthlyExpenseSoFar: totalMonthlyExpense,
      unpaidFixedBillsTotal: unpaidBillsSum,
      remainingDaysInMonth
    });

    // CSV içe aktarım mükerrer kontrolü için son 500 harcama + gelir özeti (virman hariç)
    const duplicateCheckTransactions = allFamilyTxs
      .filter((tx: any) => !isTransferOrPaymentTx(tx))
      .slice(0, 500)
      .map((tx: any) => ({
        transaction_date: tx.transaction_date,
        amount: tx.amount,
        merchant: tx.merchant
      }));

    return NextResponse.json({
      success: true,
      data: {
        accounts,
        categories: categoriesWithSpending,
        recentTransactions: recentTx,
        duplicateCheckTransactions,
        upcomingPayments: top5Upcoming,
        sinkingFunds: sinkingFundsRows,
        safeDailyLimit,
        netWorth: multiCurrencyNetWorth,
        marketRates: liveRates,
        monthlySummary: {
          selectedMonth: currentMonthStr,
          totalExpense: totalMonthlyExpense,
          totalIncome: totalMonthlyIncome,
          totalBudgetLimit: isColdStart ? 0 : totalBudgetLimitSum,
          maxAllowedCap,
          totalCreditCardLimits,
          budgetScore,
          futureForecast,
          memberBreakdown,
          familyMembers: allFamilyMembers.map((m: any) => ({
            id: m.id,
            user_id: m.user_id,
            name: m.name,
            avatar: m.avatar,
            role: m.role,
            is_current_user: m.user_id === userId
          })),
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
