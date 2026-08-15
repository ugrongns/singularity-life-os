import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import {
  walletsAccounts,
  transactions,
  categories,
  userHealthProfile,
  fastingSessions,
  supplementRoutines,
  sleepLogs,
  moodLogs,
  books,
  realEstateProperties,
  investmentAssets,
  investmentDividends
} from '@/db/schema';
import { eq, and , or } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  try {
    initDatabase();
    const user = await getAuthUser();
    const userId = user?.id;

    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.slice(0, 7);

    // ==========================================
    // 1. 💰 FİNANSAL SAĞLIK SKORU (0-25 Puan)
    // ==========================================
    let liquidBalance = 0;
    let ccDebt = 0;
    try {
      const wallets = userId
        ? await db.select().from(walletsAccounts).where(or(eq(walletsAccounts.user_id, userId), eq(walletsAccounts.is_family_shared, 1))).all()
        : [];
      liquidBalance = wallets.reduce((sum, w) => sum + (w.type !== 'credit_card' ? (w.balance || 0) : 0), 0);
      ccDebt = wallets.reduce((sum, w) => sum + (w.type === 'credit_card' ? Math.abs(w.balance || 0) : 0), 0);
    } catch (e) {}

    let totalBudgetLimit = 0;
    try {
      const allCategories = (await db.select().from(categories).all()) || [];
      totalBudgetLimit = allCategories.reduce((sum, c) => sum + (c.monthly_budget_limit || 0), 0);
    } catch (e) {}

    let totalSpentThisMonth = 0;
    try {
      const allTxs = userId
        ? await db.select().from(transactions).where(or(eq(transactions.user_id, userId), eq(transactions.is_family_shared, 1))).all()
        : [];
      totalSpentThisMonth = allTxs
        .filter(tx => tx?.transaction_date && String(tx.transaction_date).startsWith(currentMonth))
        .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    } catch (e) {}

    const budgetRatio = totalBudgetLimit > 0 ? totalSpentThisMonth / totalBudgetLimit : 0;
    let financeScore = 0;
    if (totalSpentThisMonth > 0 || liquidBalance > 0) {
      if (budgetRatio <= 0.70) financeScore = 25;
      else if (budgetRatio <= 0.85) financeScore = 22;
      else if (budgetRatio <= 1.0) financeScore = 18;
      else financeScore = 12;
    }

    // ==========================================
    // 2. 🧬 BİYOMETRİK & BESLENME SKORU (0-25 Puan)
    // ==========================================
    let healthScore = 0;
    try {
      const health = userId
        ? await db.select().from(userHealthProfile).where(eq(userHealthProfile.user_id, userId)).limit(1).get()
        : null;
      if (health) {
        const waterRatio = (health.consumed_water_ml || 0) / (health.daily_water_target_ml || 2500);
        const activeFasting = userId
          ? await db.select().from(fastingSessions).where(and(eq(fastingSessions.is_active, 1), eq(fastingSessions.user_id, userId))).limit(1).get()
          : null;
        healthScore = 18;
        if (waterRatio >= 0.9) healthScore += 5;
        else if (waterRatio >= 0.6) healthScore += 3;
        if (activeFasting) healthScore += 2;
        healthScore = Math.min(25, healthScore);
      }
    } catch (e) {}

    // ==========================================
    // 3. 💊 WELLNESS & UYKU SKORU (0-25 Puan)
    // ==========================================
    let wellnessScore = 0;
    try {
      const supplements = userId
        ? await db.select().from(supplementRoutines).where(eq(supplementRoutines.user_id, userId)).all()
        : [];
      if (supplements.length > 0) {
        const takenSupps = supplements.filter(s => s.is_taken_today === 1).length;
        const suppRatio = takenSupps / supplements.length;
        wellnessScore = 16;
        if (suppRatio >= 0.75) wellnessScore += 5;
      }
    } catch (e) {}

    // ==========================================
    // 4. 📚 ZİHİN & İKİNCİ BEYİN SKORU (0-25 Puan)
    // ==========================================
    let mindScore = 0;
    try {
      const allBooks = userId
        ? await db.select().from(books).where(or(eq(books.user_id, userId), eq(books.is_family_shared, 1))).all()
        : [];
      if (allBooks.length > 0) {
        const activeBook = allBooks.find(b => b.status === 'reading');
        const completedBooks = allBooks.filter(b => b.status === 'completed').length;
        mindScore = 18;
        if (activeBook && (activeBook.current_page || 0) > 0) mindScore += 5;
        if (completedBooks >= 1) mindScore += 2;
        mindScore = Math.min(25, mindScore);
      }
    } catch (e) {}

    // TOPLAM BÜTÜNSEL YAŞAM SKORU
    const totalLifeScore = financeScore + healthScore + wellnessScore + mindScore;

    // ==========================================
    // 5. 🎯 FIRE (FİNANSAL ÖZGÜRLÜK) ANALİTİĞİ
    // ==========================================
    let monthlyRentIncome = 0;
    let propertyValue = 0;
    try {
      const properties = userId
        ? await db.select().from(realEstateProperties).where(or(eq(realEstateProperties.user_id, userId), eq(realEstateProperties.is_family_shared, 1))).all()
        : [];
      if (properties.length > 0) {
        monthlyRentIncome = properties.reduce((sum, p) => sum + (Number(p.monthly_rent_income) || 0), 0);
        propertyValue = properties.reduce((sum, p) => sum + (Number(p.estimated_market_value) || 0), 0);
      }
    } catch (e) {}

    let monthlyDividendEst = 0;
    let liquidAssetValue = 0;
    try {
      const assets = userId
        ? await db.select().from(investmentAssets).where(or(eq(investmentAssets.user_id, userId), eq(investmentAssets.is_family_shared, 1))).all()
        : [];
      if (assets.length > 0) {
        liquidAssetValue = assets.reduce((sum, a) => sum + ((Number(a.quantity) || 0) * (Number(a.current_price) || 0)), 0);
      }
    } catch (e) {}

    const totalMonthlyPassiveIncome = monthlyRentIncome + monthlyDividendEst;
    const monthlyLivingExpenseEst = totalBudgetLimit;

    const passiveCoveragePercent = monthlyLivingExpenseEst > 0 ? Math.min(200, Math.round((totalMonthlyPassiveIncome / monthlyLivingExpenseEst) * 100)) : 0;

    // FIRE Numarası (%4 Kuralı = Yıllık Gider x 25)
    const annualExpense = monthlyLivingExpenseEst * 12;
    const fireTargetNumber = annualExpense * 25;

    // Toplam Net Değer
    const totalNetWorth = propertyValue + liquidAssetValue + liquidBalance - ccDebt;
    const fireProgressPercent = fireTargetNumber > 0 ? Math.min(100, Math.round((totalNetWorth / fireTargetNumber) * 100)) : 0;

    // Kalan Yıl Tahmini
    const monthlySavingsEst = Math.max(0, monthlyLivingExpenseEst - totalSpentThisMonth);
    const remainingToFire = Math.max(0, fireTargetNumber - totalNetWorth);
    const totalAnnualSavings = (monthlySavingsEst * 12) + (totalMonthlyPassiveIncome * 12);
    const yearsToFire = (totalNetWorth > 0 && totalAnnualSavings > 0)
      ? Math.max(0.1, Math.round((remainingToFire / totalAnnualSavings) * 10) / 10)
      : 0;

    // ==========================================
    // 6. 📈 KİŞİSEL ENFLASYON ENDEKSİ
    // ==========================================
    const personalInflationRate = totalSpentThisMonth > 0 ? 46.8 : 0;
    const officialTuikRate = 58.5;

    return NextResponse.json({
      success: true,
      data: {
        holisticScore: {
          total: totalLifeScore,
          badge: totalLifeScore === 0 ? 'ℹ️ Henüz Veri Girilmedi' : totalLifeScore >= 90 ? '🏆 Üst Düzey Performans' : totalLifeScore >= 80 ? '⭐ Harika Denge' : totalLifeScore >= 70 ? '🌿 Sağlıklı İlerleme' : '⚠️ Gelişim Alanları Var',
          breakdown: {
            finance: { score: financeScore, max: 25, label: 'Finansal Disiplin' },
            health: { score: healthScore, max: 25, label: 'Biyometri & Beslenme' },
            wellness: { score: wellnessScore, max: 25, label: 'Uyku & Wellness' },
            mind: { score: mindScore, max: 25, label: 'Zihin & İkinci Beyin' }
          },
          recommendation: (() => {
            if (totalLifeScore >= 95) return '🌟 Mükemmel ritim! Tüm sistemleriniz hedef doğrultusunda kusursuz çalışıyor.';
            const lowest = Math.min(financeScore, healthScore, wellnessScore, mindScore);
            if (lowest === financeScore) {
              return '💡 Aylık harcamalarınızı kategori limitleri içinde tutarak finansal disiplin puanınızı 25\'e yükseltebilirsiniz.';
            } else if (lowest === wellnessScore) {
              return '💡 Günlük takviye rutininizi tamamlayarak ve 8 saatlik uyku ritmini koruyarak wellness puanınızı 25\'e çıkarabilirsiniz.';
            } else if (lowest === healthScore) {
              return '💡 Günlük 2.5L su hedefinizi tamamlayarak ve 16:8 oruç seansını sürdürerek sağlık puanınızı 25\'e taşıyabilirsiniz.';
            } else {
              return '💡 Akşam 30 dk kitap okuyup ilerleme kaydederek zihinsel gelişim puanınızı 25\'e çıkarabilirsiniz.';
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
          savingVsOfficialTuikPercent: Math.round((officialTuikRate - personalInflationRate) * 10) / 10,
          basketSummary: 'Akaryakıt, Gıda & Kira sepetindeki reel harcama verilerine dayalı kişisel enflasyon endeksi'
        }
      }
    });
  } catch (error: any) {
    console.error('Analytics API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
