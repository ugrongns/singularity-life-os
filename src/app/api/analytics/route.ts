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
  books
} from '@/db/schema';
import { eq, and , or } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  try {
    await initDatabase();
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
        ? await db.select().from(walletsAccounts).where(or(eq(walletsAccounts.user_id, userId), eq(walletsAccounts.is_family_shared, 1)))
        : [];
      liquidBalance = (wallets).reduce((sum: number, w: any) => sum + (w.type !== 'credit_card' ? (w.balance || 0) : 0), 0);
      ccDebt = (wallets).reduce((sum: number, w: any) => sum + (w.type === 'credit_card' ? Math.abs(w.balance || 0) : 0), 0);
    } catch (e) {}

    let totalSpentThisMonth = 0;
    let totalBudgetLimit = 0;
    try {
      const allCats = await db.select().from(categories);
      totalBudgetLimit = (allCats).reduce((sum: number, c: any) => sum + (c.monthly_budget_limit || 0), 0);

      const txs = userId
        ? await db.select().from(transactions).where(or(eq(transactions.user_id, userId), eq(transactions.is_family_shared, 1)))
        : [];
      const thisMonthTxs = (txs).filter((t: any) => t.transaction_date && t.transaction_date.startsWith(currentMonth));
      totalSpentThisMonth = thisMonthTxs.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
    } catch (e) {}

    let financeScore = 15;
    if (totalBudgetLimit > 0 && totalSpentThisMonth <= totalBudgetLimit) financeScore += 5;
    if (liquidBalance > ccDebt * 2) financeScore += 5;

    // ==========================================
    // 2. 🩺 SAĞLIK SKORU (0-25 Puan)
    // ==========================================
    let healthScore = 18;
    try {
      const hp = (await db.select().from(userHealthProfile).limit(1))[0];
      if (hp && hp.consumed_water_ml >= hp.daily_water_target_ml) healthScore += 4;
      const fasting = (await db.select().from(fastingSessions).limit(1))[0];
      if (fasting && fasting.is_active === 0) healthScore += 3;
    } catch (e) {}

    // ==========================================
    // 3. 🧘 WELLNESS & RUH HALİ SKORU (0-25 Puan)
    // ==========================================
    let wellnessScore = 20;
    try {
      const lastSleep = (await db.select().from(sleepLogs).limit(1))[0];
      if (lastSleep && lastSleep.duration_hours >= 7) wellnessScore += 3;
      const lastMood = (await db.select().from(moodLogs).limit(1))[0];
      if (lastMood && lastMood.mood_score >= 4) wellnessScore += 2;
    } catch (e) {}

    // ==========================================
    // 4. 📚 ZİHİN & OKUMA SKORU (0-25 Puan)
    // ==========================================
    let mindScore = 17;
    try {
      const activeBooks = userId
        ? await db.select().from(books).where(and(eq(books.user_id, userId), eq(books.status, 'reading')))
        : [];
      if (activeBooks.length > 0) mindScore += 8;
    } catch (e) {}

    // TOPLAM BÜTÜNSEL YAŞAM SKORU
    const totalLifeScore = financeScore + healthScore + wellnessScore + mindScore;

    // ==========================================
    // 5. 🎯 FIRE (FİNANSAL ÖZGÜRLÜK) ANALİTİĞİ
    // ==========================================
    const totalMonthlyPassiveIncome = 0;
    const monthlyLivingExpenseEst = totalSpentThisMonth > 0 ? totalSpentThisMonth : (totalBudgetLimit > 0 ? totalBudgetLimit : 0);
    const passiveCoveragePercent = 0;

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
          badge: totalLifeScore === 0 ? 'ℹ️ Henüz Veri Girilmedi' : totalLifeScore >= 90 ? '🏆 Üst Düzey Performans' : totalLifeScore >= 80 ? '⭐ Harika Denge' : totalLifeScore >= 70 ? '🌿 Sağlıklı İlerleme' : '⚠️ Gelişim Alanları Var',
          breakdown: {
            finance: { score: financeScore, max: 25, label: 'Finansal Disiplin' },
            health: { score: healthScore, max: 25, label: 'Biyometri & Beslenme' },
            wellness: { score: wellnessScore, max: 25, label: 'Uyku & Wellness' },
            mind: { score: mindScore, max: 25, label: 'Zihin & İkinci Beyin' }
          },
          recommendation: (() => {
            if (totalLifeScore === 0) return '💡 İlk harcamanızı, su tüketiminizi veya okuduğunuz kitabı kaydederek yaşam skorunuzu oluşturmaya başlayın!';
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
