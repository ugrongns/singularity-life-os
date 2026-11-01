/**
 * Modül 4 (Analitik, FIRE & Holistik Skor) Yardımcı Fonksiyonları ve Doğrulama Kuralları
 */

/**
 * FIRE kilometre taşı ilerleme rozeti metin formatlaması.
 * Bugfix: `%{m.progress}` sözdizim hatası giderildi.
 */
export function formatMilestoneProgress(progress: number, isCompleted?: boolean): string {
  const completed = isCompleted ?? progress >= 100;
  if (completed) {
    return '✓ Ulaşıldı (%100)';
  }
  return `%${progress} Devam Ediyor`;
}

/**
 * FIRE ilerleme yüzdesi hesabı.
 * Bugfix: Negatif net değerlerde (borçlu kullanıcı) negatif yüzdeleri ve >100 taşmalarını önler (0-100 aralığı kelepçesi).
 */
export function calculateFireProgress(totalNetWorth: number, fireTargetNumber: number): number {
  if (fireTargetNumber <= 0) return 0;
  const rawPercent = Math.round((totalNetWorth / fireTargetNumber) * 100);
  return Math.max(0, Math.min(100, rawPercent));
}

/**
 * Holistik skor ve eksen sütun başarı yüzdesi hesabı.
 * Bugfix: 0 / 0 durumunda NaN oluşmasını önleyen koruma.
 */
export function calculateHolisticPillarPercentage(score: number, max: number): number {
  if (!max || max <= 0 || !Number.isFinite(score) || !Number.isFinite(max)) {
    return 0;
  }
  return Math.round((score / max) * 100);
}

/**
 * WPM (dakika başına kelime) hesaplayıcısı fizyolojik sınır koruması.
 * Bugfix: 37.500 WPM gibi uçuk değerlerin kütüphane ETA'larını bozmasını engeller [60, 1200] aralığı.
 */
export function clampWpm(calculatedWpm: number): number {
  if (!Number.isFinite(calculatedWpm)) return 220;
  return Math.max(60, Math.min(1200, Math.round(calculatedWpm)));
}

/**
 * Aylık normalize harcama hesabı (Ayın gününe göre intra-month volatiliteyi önler).
 * Tanımlı bütçe limiti varsa (`totalBudgetLimit > 0`) öncelikli baz alınır;
 * yoksa güncel harcama gün sayısına bölünerek aya normalize edilir (`(spent / day) * 30.5`).
 */
export function calculateNormalizedMonthlyExpense(
  totalSpentThisMonth: number,
  dayOfMonth: number,
  totalBudgetLimit: number = 0
): number {
  if (totalBudgetLimit > 0) {
    return totalBudgetLimit;
  }
  if (totalSpentThisMonth > 0) {
    const day = Math.max(1, dayOfMonth);
    return Math.round((totalSpentThisMonth / day) * 30.5);
  }
  return 0;
}

/**
 * Kişisel enflasyon vs Resmi TÜFE reel avantaj metin formatlaması.
 * Bugfix: Negatif değerlerde `+-11.4%` çift işaret basılmasını engeller.
 */
export function formatRealAdvantage(savingVsOfficialTuikPercent: number): string {
  if (!Number.isFinite(savingVsOfficialTuikPercent)) return '0%';
  if (savingVsOfficialTuikPercent > 0) {
    return `+${savingVsOfficialTuikPercent}%`;
  }
  return `${savingVsOfficialTuikPercent}%`;
}

/**
 * Kalan süre projeksiyon metni & rozet belirleme.
 * Bugfix: `yearsToFire = 0` olduğunda kalıcı "Hesaplanıyor" durumunu giderir.
 */
export function getYearsToFireDisplay(
  fireTargetNumber: number,
  totalNetWorth: number,
  yearsToFire: number,
  savingsRatePercent?: number,
  monthlySavingsEst?: number
): { text: string; color: string } {
  if (fireTargetNumber <= 0) {
    return { text: '—', color: 'var(--text-muted)' };
  }
  if (totalNetWorth >= fireTargetNumber) {
    return { text: 'Hedefe Ulaşıldı! 🏆', color: 'var(--emerald)' };
  }
  if (totalNetWorth < 0) {
    return { text: 'Borçlu', color: '#F43F5E' };
  }
  if (yearsToFire > 0) {
    return { text: `~${yearsToFire} Yıl`, color: 'var(--emerald)' };
  }
  if (monthlySavingsEst !== undefined && monthlySavingsEst > 0) {
    const annualSavings = monthlySavingsEst * 12;
    const remaining = Math.max(0, fireTargetNumber - totalNetWorth);
    const calculatedYears = Math.max(0.1, Math.round((remaining / annualSavings) * 10) / 10);
    return { text: `~${calculatedYears} Yıl`, color: 'var(--emerald)' };
  }
  if ((savingsRatePercent !== undefined && savingsRatePercent <= 0) || (monthlySavingsEst !== undefined && monthlySavingsEst <= 0)) {
    return { text: 'Tasarruf Yok', color: '#F59E0B' };
  }
  return { text: 'Hesaplanıyor', color: 'var(--text-muted)' };
}

