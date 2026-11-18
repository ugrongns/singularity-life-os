import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import {
  walletsAccounts,
  transactions,
  categories,
  userHealthProfile,
  fastingSessions,
  nutritionMeals,
  waterIntakeLogs,
  smartScaleLogs,
  biometrics,
  workoutSessions,
  supplementRoutines,
  sleepLogs,
  moodLogs,
  books,
  readingSessions,
  bookQuotes,
  tasks
} from '@/db/schema';
import { eq, and, or, desc, sql } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { fetchLiveExchangeRates } from '@/lib/market-data';
import { getTodayTurkeyDate, shiftTurkeyDate } from '@/lib/date-utils';
import { calculateTasksFocusScoreBreakdown, scalePillarTo20 } from '@/lib/tasks-engine';
import {
  calculateNormalizedMonthlyExpense,
  calculateFireProgress
} from '@/lib/module4-utils';

export async function GET() {
  try {
    await initDatabase();
    const user = await getAuthUser();
    const userId = user?.id;
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }

    const familyId = user?.family_id || `fam-${userId}`;
    const today = getTodayTurkeyDate();
    const currentMonth = today.slice(0, 7);
    const last7Days = shiftTurkeyDate(today, -6);

    // ==========================================
    // 1. 💰 FİNANSAL SAĞLIK SKORU (Ham: 0 - 25, Bütünsel Matris: 0 - 20)
    // ==========================================
    let liquidBalance = 0;
    let ccDebt = 0;
    let totalMonthlyPassiveIncome = 0;
    let walletsCount = 0;
    let thisMonthIncome = 0;
    let txsList: any[] = [];
    let incomeCatIds = new Set<string>();

    const liveRates = await fetchLiveExchangeRates();
    const getTryValue = (balance: number, currency: string) => {
      const c = (currency || 'TRY').toUpperCase();
      if (c === 'USD') return balance * (liveRates.USD_TRY || 0);
      if (c === 'EUR') return balance * (liveRates.EUR_TRY || 0);
      if (c === 'GBP') return balance * (liveRates.GBP_TRY || 0);
      if (c === 'GOLD') return balance * (liveRates.GOLD_GRAM_TRY || 0);
      return balance;
    };

    try {
      const wallets = await db.select().from(walletsAccounts)
        .where(
          and(
            eq(walletsAccounts.is_active, 1),
            familyId
              ? or(eq(walletsAccounts.user_id, userId), and(eq(walletsAccounts.family_id, familyId), eq(walletsAccounts.is_family_shared, 1)))
              : eq(walletsAccounts.user_id, userId)
          )
        );
      
      walletsCount = wallets.length;
      // Kredi ve kredi kartı hesapları borç olarak toplanır; nakit, vadesiz, vadeli ve yatırım hesapları varlık sayılır
      liquidBalance = wallets.reduce((sum: number, w: any) => {
        if (w.type === 'credit_card' || w.type === 'loan') return sum;
        return sum + getTryValue(Number(w.balance) || 0, w.currency);
      }, 0);

      ccDebt = wallets.reduce((sum: number, w: any) => {
        if (w.type === 'credit_card' || w.type === 'loan') {
          return sum + getTryValue(Math.abs(Number(w.balance) || 0), w.currency);
        }
        return sum;
      }, 0);

      // Vadeli mevduat veya pasif getiri hesaplama
      const timeDeposits = wallets.filter((w: any) => w.type === 'time_deposit');
      totalMonthlyPassiveIncome = timeDeposits.reduce((sum: number, w: any) => {
        const principal = Number(w.balance) || 0;
        const interestRate = Number(w.interest_rate) || 0;
        const monthlyYield = (principal * (interestRate / 100)) / 12;
        return sum + Math.round(monthlyYield);
      }, 0);
    } catch (e) {}

    let totalSpentThisMonth = 0;
    let totalBudgetLimit = 0;
    let txCountThisMonth = 0;

    try {
      const allCats = familyId
        ? await db.select().from(categories).where(eq(categories.family_id, familyId))
        : await db.select().from(categories);
      totalBudgetLimit = allCats.reduce((sum: number, c: any) => sum + (c.monthly_budget_limit || 0), 0);
      incomeCatIds = new Set(allCats.filter((c: any) => c.type === 'income').map((c: any) => c.id));

      const txs = await db.select().from(transactions)
        .where(
          familyId
            ? or(eq(transactions.user_id, userId), and(eq(transactions.family_id, familyId), eq(transactions.is_family_shared, 1)))
            : eq(transactions.user_id, userId)
        );
      txsList = txs;
      const thisMonthTxs = txs.filter((t: any) => t.transaction_date && t.transaction_date.startsWith(currentMonth));
      txCountThisMonth = thisMonthTxs.length;

      let thisMonthExpense = 0;
      for (const t of thisMonthTxs) {
        const isIncome = (t.category_id ? incomeCatIds.has(t.category_id) : false) || t.merchant?.includes('Gelir Girişi') || t.merchant?.includes('Maaş');
        const isTransfer = t.merchant?.startsWith('🔄 Transfer') || t.merchant?.startsWith('💳 Kart Ödemesi');
        if (isIncome) {
          thisMonthIncome += (Number(t.amount) || 0);
        } else if (!isTransfer) {
          thisMonthExpense += (Number(t.amount) || 0);
        }
      }
      totalSpentThisMonth = thisMonthExpense;
    } catch (e) {}

    let financeScore = 0;
    // 1. Pozitif bakiye veya aktif işlem yapılması (+5 puan)
    if (walletsCount > 0 && (liquidBalance > 0 || txCountThisMonth > 0)) {
      financeScore += 5;
    }
    // 2. Bütçe limiti belirlenmiş ve aktif işlem takip ediliyor (+5 puan)
    if (totalBudgetLimit > 0 && txCountThisMonth > 0) {
      financeScore += 5;
    }
    // 3. Bütçe disiplini: Bu ay işlem var ve harcamalar bütçeyi aşmadı (+8 puan)
    if (totalBudgetLimit > 0 && txCountThisMonth > 0 && totalSpentThisMonth <= totalBudgetLimit) {
      financeScore += 8;
    } else if (totalBudgetLimit === 0 && txCountThisMonth > 0) {
      financeScore += 4; // Bütçe yok ama harcama kaydı tutuluyor
    }
    // 4. Net likidite borçtan fazla (+7 puan)
    if (liquidBalance > 0 && liquidBalance >= ccDebt) {
      financeScore += 7;
    }

    // ==========================================
    // 2. 🩺 SAĞLIK & BESLENME SKORU (Ham: 0 - 25, Bütünsel Matris: 0 - 20)
    // ==========================================
    let healthScore = 0;
    try {
      // Antrenman / Egzersiz kaydı (+5 puan)
      const workouts = await db.select().from(workoutSessions).where(eq(workoutSessions.user_id, userId)).limit(1);
      if (workouts.length > 0) {
        healthScore += 5;
      }

      // Su tüketimi (Bugün)
      const waterList = await db.select().from(waterIntakeLogs).where(and(eq(waterIntakeLogs.date, today), eq(waterIntakeLogs.user_id, userId))).limit(1);
      const todayWater = waterList[0];
      if (todayWater && todayWater.amount_ml > 0) {
        const goal = todayWater.goal_ml || 2500;
        const waterPct = (todayWater.amount_ml / goal) * 100;
        if (waterPct >= 100) healthScore += 10;
        else if (waterPct >= 50) healthScore += 6;
        else healthScore += 3;
      }

      // Oruç veya beslenme öğün kaydı
      const fastingList = await db.select().from(fastingSessions).where(eq(fastingSessions.user_id, userId)).limit(1);
      const mealsList = await db.select().from(nutritionMeals).where(eq(nutritionMeals.user_id, userId)).limit(1);
      if (fastingList.length > 0 || mealsList.length > 0) {
        healthScore += 5;
      }

      // Biyometri / Akıllı Tartı kaydı
      const scaleList = await db.select().from(smartScaleLogs).where(eq(smartScaleLogs.user_id, userId)).limit(1);
      const bioList = await db.select().from(biometrics).where(eq(biometrics.user_id, userId)).limit(1);
      if (scaleList.length > 0 || bioList.length > 0) {
        healthScore += 5;
      }
    } catch (e) {}

    // ==========================================
    // 3. 🧘 WELLNESS & RUH HALİ SKORU (Ham: 0 - 25, Bütünsel Matris: 0 - 20)
    // ==========================================
    let wellnessScore = 0;
    try {
      // Uyku takibi (Son 7 gün)
      const sleepList = await db.select().from(sleepLogs)
        .where(and(eq(sleepLogs.user_id, userId), sql`${sleepLogs.date} >= ${last7Days}`))
        .orderBy(desc(sleepLogs.date));
      
      if (sleepList.length > 0) {
        wellnessScore += 5;
        const avgSleep = sleepList.reduce((acc: number, s: any) => acc + (s.duration_hours || 0), 0) / sleepList.length;
        if (avgSleep >= 7 && avgSleep <= 9) wellnessScore += 5;
        else if (avgSleep >= 6) wellnessScore += 3;
      }

      // Ruh hali (Mood) takibi
      const moodList = await db.select().from(moodLogs)
        .where(and(eq(moodLogs.user_id, userId), sql`${moodLogs.date} >= ${last7Days}`))
        .orderBy(desc(moodLogs.date));

      if (moodList.length > 0) {
        wellnessScore += 5;
        const avgMood = moodList.reduce((acc: number, m: any) => acc + (m.mood_score || 0), 0) / moodList.length;
        if (avgMood >= 4) wellnessScore += 3;
        else if (avgMood >= 3) wellnessScore += 2;
      }

      // Takviye / İlaç Rutinleri
      const supps = await db.select().from(supplementRoutines).where(and(eq(supplementRoutines.user_id, userId), eq(supplementRoutines.is_active, 1)));
      if (supps.length > 0) {
        wellnessScore += 4;
        const takenToday = supps.filter((s: any) => s.is_taken_today === 1).length;
        if (takenToday > 0) wellnessScore += 3;
      }
    } catch (e) {}

    // ==========================================
    // 4. 📚 ZİHİN & İKİNCİ BEYİN SKORU (Ham: 0 - 25, Bütünsel Matris: 0 - 20)
    // ==========================================
    let mindScore = 0;
    try {
      const allBooks = await db.select().from(books).where(eq(books.user_id, userId));
      if (allBooks.length > 0) mindScore += 5; // Kitaplıkta kitap var

      const activeBooks = allBooks.filter((b: any) => b.status === 'reading');
      if (activeBooks.length > 0) mindScore += 8; // Aktif okunan kitap var

      const sessions = await db.select().from(readingSessions).where(eq(readingSessions.user_id, userId)).limit(1);
      if (sessions.length > 0) mindScore += 7; // Okuma seansı yapılmış

      const quotes = await db.select().from(bookQuotes).where(eq(bookQuotes.user_id, userId)).limit(1);
      if (quotes.length > 0) mindScore += 5; // Alıntı kaydedilmiş
    } catch (e) {}

    // ==========================================
    // 5. 🎯 GÖREV & ODAK DİSİPLİNİ SKORU (0 - 20 Puan)
    // ==========================================
    let focusStats = {
      score: 0,
      max: 20 as const,
      completedLast7Days: 0,
      completedToday: 0,
      todayMitCompleted: 0,
      todayMitTotal: 0,
      focusMinutesLogged: 0
    };
    try {
      const visibleTasks = await db.select().from(tasks).where(
        familyId
          ? or(eq(tasks.user_id, userId), and(eq(tasks.family_id, familyId), eq(tasks.is_family_shared, 1)))
          : eq(tasks.user_id, userId)
      );
      focusStats = calculateTasksFocusScoreBreakdown(visibleTasks, today, last7Days);
    } catch (e) {}

    // 5 x 20 = 100 Bütünsel Ölçekleme
    const finance20 = scalePillarTo20(financeScore);
    const health20 = scalePillarTo20(healthScore);
    const wellness20 = scalePillarTo20(wellnessScore);
    const mind20 = scalePillarTo20(mindScore);
    const focus20 = focusStats.score;

    // TOPLAM BÜTÜNSEL YAŞAM SKORU
    const totalLifeScore = finance20 + health20 + wellness20 + mind20 + focus20;

    // Aksiyon Önerileri Hesaplama (En Yüksek Etkili 3 Aksiyon)
    const actionCandidates = [
      {
        pillar: 'finance',
        score: finance20,
        max: 20,
        gap: Math.max(0, 20 - finance20),
        title: 'Bütçe & Harcama Disiplini',
        desc: totalSpentThisMonth > totalBudgetLimit && totalBudgetLimit > 0
          ? 'Bu ayki harcamaları bütçe limiti altına çekerek disiplin puanını yükseltin.'
          : 'Harcamalarınızı kategorilere dağıtarak aylık bütçe disiplinini koruyun.',
        link: '/budget'
      },
      {
        pillar: 'health',
        score: health20,
        max: 20,
        gap: Math.max(0, 20 - health20),
        title: 'Su & Beslenme Kaydı',
        desc: 'Günlük 2.5L su hedefini tamamlayın ve bugün en az 1 öğün veya oruç kaydı girin.',
        link: '/health'
      },
      {
        pillar: 'wellness',
        score: wellness20,
        max: 20,
        gap: Math.max(0, 20 - wellness20),
        title: 'Uyku & Takviye Rutini',
        desc: 'Günlük takviyelerinizi aldım olarak işaretleyin ve 7-8 saatlik uyku seansını kaydedin.',
        link: '/wellness'
      },
      {
        pillar: 'mind',
        score: mind20,
        max: 20,
        gap: Math.max(0, 20 - mind20),
        title: 'Okuma Seansı & Alıntı',
        desc: 'Aktif kitabınızdan 15 dakikalık okuma seansı başlatın veya 1 yeni alıntı kaydedin.',
        link: '/library'
      },
      {
        pillar: 'focus',
        score: focus20,
        max: 20,
        gap: Math.max(0, 20 - focus20),
        title: 'Günlük Odak (MIT) & Görev Disiplini',
        desc: focusStats.todayMitTotal > 0 && focusStats.todayMitCompleted < focusStats.todayMitTotal
          ? `Bugünkü ${focusStats.todayMitTotal} odak görevinizden kalanları veya bir Pomodoro seansını tamamlayın.`
          : 'Günün 3 Odağını (MIT) belirleyip Pomodoro sayacıyla tamamlayarak yürütme puanınızı yükseltin.',
        link: '/tasks'
      }
    ];

    const topActions = actionCandidates
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 3)
      .map(a => ({
        title: a.title,
        desc: a.desc,
        impact: a.gap > 0 ? `+${a.gap} Puan` : 'Tamamlandı',
        scoreGain: a.gap,
        pillar: a.pillar,
        link: a.link,
        isCompleted: a.gap <= 0
      }));

    // ==========================================
    // 5. 🎯 FIRE (FİNANSAL ÖZGÜRLÜK) ANALİTİĞİ
    // ==========================================
    const currentDayOfMonth = Math.max(1, Number(today.slice(8, 10)) || 1);
    const monthlyLivingExpenseEst = calculateNormalizedMonthlyExpense(
      totalSpentThisMonth,
      currentDayOfMonth,
      totalBudgetLimit
    );
    const passiveCoveragePercent = monthlyLivingExpenseEst > 0 ? Math.min(100, Math.round((totalMonthlyPassiveIncome / monthlyLivingExpenseEst) * 100)) : 0;

    // FIRE Numarası (%4 Kuralı = Yıllık Gider x 25)
    const annualExpense = monthlyLivingExpenseEst * 12;
    const fireTargetNumber = annualExpense * 25;

    // Toplam Net Değer
    const totalNetWorth = liquidBalance - ccDebt;
    const fireProgressPercent = calculateFireProgress(totalNetWorth, fireTargetNumber);

    // Gerçekçi Aylık Tasarruf Tahmini: Bu ayki gelir - gider (veya kullanıcı profili geliri)
    const effectiveMonthlyIncome = thisMonthIncome > 0
      ? thisMonthIncome
      : (Number(user?.monthly_income) || (totalBudgetLimit > 0 ? totalBudgetLimit * 1.2 : 0));
    const monthlySavingsEst = Math.max(0, effectiveMonthlyIncome - totalSpentThisMonth);
    const savingsRatePercent = effectiveMonthlyIncome > 0
      ? Math.max(0, Math.min(100, Math.round((monthlySavingsEst / effectiveMonthlyIncome) * 100)))
      : 0;
    const remainingToFire = Math.max(0, fireTargetNumber - totalNetWorth);
    const totalAnnualSavings = (monthlySavingsEst * 12) + (totalMonthlyPassiveIncome * 12);
    const yearsToFire = (totalNetWorth >= 0 && totalAnnualSavings > 0 && remainingToFire > 0)
      ? Math.max(0.1, Math.round((remainingToFire / totalAnnualSavings) * 10) / 10)
      : 0;

    // Kilometre Taşları (Lean, Regular, Fat FIRE)
    const leanFireTarget = Math.round(fireTargetNumber * 0.7);
    const regularFireTarget = fireTargetNumber;
    const fatFireTarget = Math.round(fireTargetNumber * 1.5);

    const leanFireProgress = calculateFireProgress(totalNetWorth, leanFireTarget);
    const regularFireProgress = fireProgressPercent;
    const fatFireProgress = calculateFireProgress(totalNetWorth, fatFireTarget);

    // ==========================================
    // 6. 📈 KİŞİSEL ENFLASYON ENDEKSİ (Geçen aya göre harcama sepeti değişimi)
    // ==========================================
    const [curYear, curMonth] = today.split('-').map(Number);
    const prevMonthDate = new Date(Date.UTC(curYear, curMonth - 2, 1, 12, 0, 0));
    const prevMonthStr = `${prevMonthDate.getUTCFullYear()}-${String(prevMonthDate.getUTCMonth() + 1).padStart(2, '0')}`;
    const prevMonthExpense = txsList
      .filter((t: any) => t.transaction_date && t.transaction_date.startsWith(prevMonthStr) && !(t.category_id && incomeCatIds.has(t.category_id)) && !t.merchant?.startsWith('🔄 Transfer') && !t.merchant?.startsWith('💳 Kart Ödemesi'))
      .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);

    let personalInflationRate = 0;
    if (prevMonthExpense > 0 && totalSpentThisMonth > 0) {
      const diffPercent = ((totalSpentThisMonth - prevMonthExpense) / prevMonthExpense) * 100;
      personalInflationRate = Math.round(diffPercent * 10) / 10;
    }
    const officialTuikRate: number | null = null;
    const savingVsOfficialTuikPercent: number | null = null;

    return NextResponse.json({
      success: true,
      data: {
        holisticScore: {
          total: totalLifeScore,
          badge: totalLifeScore === 0 ? '🌱 Başlangıç Aşaması' : totalLifeScore >= 90 ? '🏆 Üst Düzey Performans' : totalLifeScore >= 75 ? '⭐ Harika Denge' : totalLifeScore >= 50 ? '🌿 Sağlıklı İlerleme' : '⚡ Gelişim Yolunda',
          breakdown: {
            finance: { score: finance20, max: 20, label: 'Finansal Disiplin' },
            health: { score: health20, max: 20, label: 'Biyometri & Beslenme' },
            wellness: { score: wellness20, max: 20, label: 'Uyku & Wellness' },
            mind: { score: mind20, max: 20, label: 'Zihin & İkinci Beyin' },
            focus: { score: focus20, max: 20, label: 'Odak & Görevler' }
          },
          focusMetrics: focusStats,
          topActions,
          recommendation: (() => {
            if (totalLifeScore === 0) return '💡 Singularity OS\'e hoş geldiniz! İlk harcamanızı, su tüketiminizi, okumanızı veya odak görevinizi kaydederek yaşam skorunuzu oluşturmaya başlayın.';
            if (totalLifeScore >= 95) return '🌟 Mükemmel ritim! Tüm 5 yaşam sisteminiz hedef doğrultusunda kusursuz çalışıyor.';
            const lowest = Math.min(finance20, health20, wellness20, mind20, focus20);
            if (lowest === focus20) {
              return '💡 Günün 3 Odağı (MIT) görevlerinizi ve 25 dakikalık Pomodoro odak seanslarını tamamlayarak Odak puanınızı 20\'ye çıkarabilirsiniz.';
            } else if (lowest === finance20) {
              return '💡 Aylık harcamalarınızı kategori limitleri içinde tutarak finansal disiplin puanınızı 20\'ye yükseltebilirsiniz.';
            } else if (lowest === wellness20) {
              return '💡 Günlük takviye rutininizi tamamlayarak ve 8 saatlik uyku ritmini koruyarak wellness puanınızı 20\'ye çıkarabilirsiniz.';
            } else if (lowest === health20) {
              return '💡 Günlük su hedefinizi tamamlayarak ve beslenme/biyometri kaydı girerek sağlık puanınızı 20\'ye taşıyabilirsiniz.';
            } else {
              return '💡 Kütüphanenize kitap ekleyip günlük okuma seansı başlatarak zihinsel gelişim puanınızı 20\'ye çıkarabilirsiniz.';
            }
          })()
        },
        fireMetrics: {
          monthlyPassiveIncome: totalMonthlyPassiveIncome,
          monthlyLivingExpense: monthlyLivingExpenseEst,
          annualExpense,
          passiveCoveragePercent,
          fireTargetNumber,
          totalNetWorth,
          fireProgressPercent,
          savingsRatePercent,
          monthlySavingsEst,
          effectiveMonthlyIncome,
          yearsToFire,
          isHalfway: fireProgressPercent >= 50,
          milestones: {
            lean: { target: leanFireTarget, progress: leanFireProgress, label: 'Lean FIRE' },
            regular: { target: regularFireTarget, progress: regularFireProgress, label: 'Regular FIRE' },
            fat: { target: fatFireTarget, progress: fatFireProgress, label: 'Fat FIRE' }
          }
        },
        inflationMetrics: {
          personalInflationRate,
          officialTuikRate,
          savingVsOfficialTuikPercent,
          basketSummary: 'Akaryakıt, Gıda & Kira sepetindeki reel harcama verilerine dayalı kişisel enflasyon endeksi'
        }
      }
    });
  } catch (error: any) {
    console.error('Analytics API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
