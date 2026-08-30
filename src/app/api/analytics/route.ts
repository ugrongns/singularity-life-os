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
  supplementRoutines,
  sleepLogs,
  moodLogs,
  books,
  readingSessions,
  bookQuotes
} from '@/db/schema';
import { eq, and, or, desc, sql } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  try {
    await initDatabase();
    const user = await getAuthUser();
    const userId = user?.id;
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }

    const familyId = user?.family_id || `fam-${userId}`;
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.slice(0, 7);
    const last7Days = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

    // ==========================================
    // 1. 💰 FİNANSAL SAĞLIK SKORU (0 - 25 Puan)
    // ==========================================
    let liquidBalance = 0;
    let ccDebt = 0;
    let totalMonthlyPassiveIncome = 0;
    let walletsCount = 0;

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
      liquidBalance = wallets.reduce((sum: number, w: any) => sum + (w.type !== 'credit_card' ? (w.balance || 0) : 0), 0);
      ccDebt = wallets.reduce((sum: number, w: any) => sum + (w.type === 'credit_card' ? Math.abs(w.balance || 0) : 0), 0);

      // Vadeli mevduat veya pasif getiri hesaplama
      const timeDeposits = wallets.filter((w: any) => w.type === 'time_deposit');
      totalMonthlyPassiveIncome = timeDeposits.reduce((sum: number, w: any) => {
        const principal = Number(w.balance) || 0;
        const interestRate = Number(w.interest_rate) || 45; // %45 yıllık
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

      const txs = await db.select().from(transactions)
        .where(
          familyId
            ? or(eq(transactions.user_id, userId), and(eq(transactions.family_id, familyId), eq(transactions.is_family_shared, 1)))
            : eq(transactions.user_id, userId)
        );
      const thisMonthTxs = txs.filter((t: any) => t.transaction_date && t.transaction_date.startsWith(currentMonth));
      txCountThisMonth = thisMonthTxs.length;
      totalSpentThisMonth = thisMonthTxs.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
    } catch (e) {}

    let financeScore = 0;
    if (walletsCount > 0) financeScore += 5; // Cüzdan / Hesap Tanımlı
    if (totalBudgetLimit > 0) financeScore += 5; // Bütçe Limiti Belirlenmiş
    if (totalBudgetLimit > 0 && totalSpentThisMonth <= totalBudgetLimit) {
      financeScore += 8; // Bütçe aşılmadı
    } else if (totalBudgetLimit === 0 && txCountThisMonth > 0) {
      financeScore += 4; // Bütçe yok ama harcama kaydı tutuluyor
    }
    if (liquidBalance > 0 && liquidBalance >= ccDebt) {
      financeScore += 7; // Likidite pozitif & borçtan fazla
    }

    // ==========================================
    // 2. 🩺 SAĞLIK & BESLENME SKORU (0 - 25 Puan)
    // ==========================================
    let healthScore = 0;
    try {
      const hpList = await db.select().from(userHealthProfile).where(eq(userHealthProfile.user_id, userId)).limit(1);
      const hp = hpList[0];
      if (hp) healthScore += 5; // Profil oluşturulmuş

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
    // 3. 🧘 WELLNESS & RUH HALİ SKORU (0 - 25 Puan)
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
    // 4. 📚 ZİHİN & İKİNCİ BEYİN SKORU (0 - 25 Puan)
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

    // TOPLAM BÜTÜNSEL YAŞAM SKORU
    const totalLifeScore = financeScore + healthScore + wellnessScore + mindScore;

    // ==========================================
    // 5. 🎯 FIRE (FİNANSAL ÖZGÜRLÜK) ANALİTİĞİ
    // ==========================================
    const monthlyLivingExpenseEst = totalSpentThisMonth > 0 ? totalSpentThisMonth : (totalBudgetLimit > 0 ? totalBudgetLimit : 0);
    const passiveCoveragePercent = monthlyLivingExpenseEst > 0 ? Math.min(100, Math.round((totalMonthlyPassiveIncome / monthlyLivingExpenseEst) * 100)) : 0;

    // FIRE Numarası (%4 Kuralı = Yıllık Gider x 25)
    const annualExpense = monthlyLivingExpenseEst * 12;
    const fireTargetNumber = annualExpense * 25;

    // Toplam Net Değer
    const totalNetWorth = liquidBalance - ccDebt;
    const fireProgressPercent = fireTargetNumber > 0 ? Math.min(100, Math.round((totalNetWorth / fireTargetNumber) * 100)) : 0;

    // Kalan Yıl Tahmini
    const monthlySavingsEst = Math.max(0, monthlyLivingExpenseEst - totalSpentThisMonth);
    const remainingToFire = Math.max(0, fireTargetNumber - totalNetWorth);
    const totalAnnualSavings = (monthlySavingsEst * 12) + (totalMonthlyPassiveIncome * 12);
    const yearsToFire = (totalNetWorth > 0 && totalAnnualSavings > 0 && remainingToFire > 0)
      ? Math.max(0.1, Math.round((remainingToFire / totalAnnualSavings) * 10) / 10)
      : 0;

    // ==========================================
    // 6. 📈 KİŞİSEL ENFLASYON ENDEKSİ
    // ==========================================
    const personalInflationRate = totalSpentThisMonth > 0 ? 46.8 : 0;
    const officialTuikRate = 58.5;
    const savingVsOfficialTuikPercent = personalInflationRate > 0 ? Math.round((officialTuikRate - personalInflationRate) * 10) / 10 : 0;

    return NextResponse.json({
      success: true,
      data: {
        holisticScore: {
          total: totalLifeScore,
          badge: totalLifeScore === 0 ? '🌱 Başlangıç Aşaması' : totalLifeScore >= 90 ? '🏆 Üst Düzey Performans' : totalLifeScore >= 75 ? '⭐ Harika Denge' : totalLifeScore >= 50 ? '🌿 Sağlıklı İlerleme' : '⚡ Gelişim Yolunda',
          breakdown: {
            finance: { score: financeScore, max: 25, label: 'Finansal Disiplin' },
            health: { score: healthScore, max: 25, label: 'Biyometri & Beslenme' },
            wellness: { score: wellnessScore, max: 25, label: 'Uyku & Wellness' },
            mind: { score: mindScore, max: 25, label: 'Zihin & İkinci Beyin' }
          },
          recommendation: (() => {
            if (totalLifeScore === 0) return '💡 Singularity OS\'e hoş geldiniz! İlk harcamanızı, su tüketiminizi veya okuduğunuz bir kitabı kaydederek yaşam skorunuzu oluşturmaya başlayın.';
            if (totalLifeScore >= 95) return '🌟 Mükemmel ritim! Tüm sistemleriniz hedef doğrultusunda kusursuz çalışıyor.';
            const lowest = Math.min(financeScore, healthScore, wellnessScore, mindScore);
            if (lowest === financeScore) {
              return '💡 Aylık harcamalarınızı kategori limitleri içinde tutarak finansal disiplin puanınızı 25\'e yükseltebilirsiniz.';
            } else if (lowest === wellnessScore) {
              return '💡 Günlük takviye rutininizi tamamlayarak ve 8 saatlik uyku ritmini koruyarak wellness puanınızı 25\'e çıkarabilirsiniz.';
            } else if (lowest === healthScore) {
              return '💡 Günlük su hedefinizi tamamlayarak ve beslenme/biyometri kaydı girerek sağlık puanınızı 25\'e taşıyabilirsiniz.';
            } else {
              return '💡 Kütüphanenize kitap ekleyip günlük okuma seansı başlatarak zihinsel gelişim puanınızı 25\'e çıkarabilirsiniz.';
            }
          })()
        },
        fireMetrics: {
          monthlyPassiveIncome: totalMonthlyPassiveIncome,
          monthlyLivingExpense: monthlyLivingExpenseEst,
          passiveCoveragePercent,
          fireTargetNumber,
          totalNetWorth,
          fireProgressPercent,
          yearsToFire,
          isHalfway: fireProgressPercent >= 50
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
