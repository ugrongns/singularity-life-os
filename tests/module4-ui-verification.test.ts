import { describe, it, expect } from 'vitest';
import {
  formatMilestoneProgress,
  calculateFireProgress,
  calculateHolisticPillarPercentage,
  clampWpm,
  calculateNormalizedMonthlyExpense,
  formatRealAdvantage,
  getYearsToFireDisplay
} from '@/lib/module4-utils';

describe('🎯 Modül 4 (Analitik, FIRE & Holistik Skor) Doğrulama Testleri (TDD Verification)', () => {

  describe('1. FIRE Kilometre Taşı Metin Formatlaması (Bulgu 1.1)', () => {
    it('Devam eden kilometre taşında sözdizim hatası olmadan "%45 Devam Ediyor" basmalıdır', () => {
      const result = formatMilestoneProgress(45);
      expect(result).toBe('%45 Devam Ediyor');
      expect(result).not.toContain('%{m.progress}');
    });

    it('Sıfır ilerlemede "%0 Devam Ediyor" basmalıdır', () => {
      const result = formatMilestoneProgress(0);
      expect(result).toBe('%0 Devam Ediyor');
    });

    it('%100 ve üzeri tamamlanan kilometre taşında "✓ Ulaşıldı (%100)" basmalıdır', () => {
      const res100 = formatMilestoneProgress(100);
      expect(res100).toBe('✓ Ulaşıldı (%100)');

      const res120 = formatMilestoneProgress(120);
      expect(res120).toBe('✓ Ulaşıldı (%100)');

      const resFlag = formatMilestoneProgress(80, true);
      expect(resFlag).toBe('✓ Ulaşıldı (%100)');
    });
  });

  describe('2. FIRE İlerleme Yüzdesi Kelepçesi (0 - 100 Aralığı) (Bulgu 2.2)', () => {
    it('Borçlu kullanıcıda (negatif net değer) negatif yüzde yerine %0 dönmelidir', () => {
      // Borçlu: Varlık 50.000 TL, Kredi Kartı Borcu 150.000 TL -> Net Değer -100.000 TL
      const netWorth = -100000;
      const target = 2500000;
      const progress = calculateFireProgress(netWorth, target);

      expect(progress).toBe(0);
      expect(progress).toBeGreaterThanOrEqual(0);
    });

    it('Aşırı borçlu uç senaryoda (-1.000.000 TL) yüzde negatif değer almamalıdır', () => {
      const progress = calculateFireProgress(-1000000, 5000000);
      expect(progress).toBe(0);
    });

    it('Hedefi aşan varlıkta maksimum %100 kelepçesi uygulanmalıdır', () => {
      const progress = calculateFireProgress(7500000, 5000000);
      expect(progress).toBe(100);
      expect(progress).toBeLessThanOrEqual(100);
    });

    it('Hedef sıfır veya tanımsızken sıfıra bölme hatası olmadan 0 dönmelidir', () => {
      expect(calculateFireProgress(500000, 0)).toBe(0);
      expect(calculateFireProgress(500000, -100)).toBe(0);
    });

    it('Normal pozitif ilerlemede doğru oransal yüzdeyi hesaplamalıdır (1.25M / 2.5M -> %50)', () => {
      expect(calculateFireProgress(1250000, 2500000)).toBe(50);
      expect(calculateFireProgress(625000, 2500000)).toBe(25);
    });
  });

  describe('3. Holistik Skor 0/0 ve Eksik Veri NaN Koruması (Bulgu 1.6)', () => {
    it('0 / 0 durumunda NaN yerine güvenli 0 dönmelidir', () => {
      const pct = calculateHolisticPillarPercentage(0, 0);
      expect(pct).toBe(0);
      expect(Number.isNaN(pct)).toBe(false);
    });

    it('Maksimum değer tanımsız veya negatif olduğunda 0 dönmelidir', () => {
      expect(calculateHolisticPillarPercentage(10, 0)).toBe(0);
      expect(calculateHolisticPillarPercentage(10, -5)).toBe(0);
      expect(calculateHolisticPillarPercentage(NaN, 25)).toBe(0);
      expect(calculateHolisticPillarPercentage(10, NaN)).toBe(0);
    });

    it('Normal skorlarda doğru yüzde hesaplamalıdır (20/25 -> %80)', () => {
      expect(calculateHolisticPillarPercentage(20, 25)).toBe(80);
      expect(calculateHolisticPillarPercentage(25, 25)).toBe(100);
      expect(calculateHolisticPillarPercentage(0, 25)).toBe(0);
    });
  });

  describe('4. Kütüphane Okuma Hızı (WPM) Fizyolojik Üst Sınır Koruması (Bulgu 3.3)', () => {
    it('37.500 WPM gibi uçuk değerleri fizyolojik tavan olan 1200 WPM\'e kelepçelemelidir', () => {
      const clamped = clampWpm(37500);
      expect(clamped).toBe(1200);
    });

    it('25.000 WPM değerini 1200 WPM ile sınırlamalıdır', () => {
      expect(clampWpm(25000)).toBe(1200);
    });

    it('60 WPM altındaki aşırı yavaş değerleri taban olan 60 WPM\'e kelepçelemelidir', () => {
      expect(clampWpm(15)).toBe(60);
      expect(clampWpm(0)).toBe(60);
      expect(clampWpm(-50)).toBe(60);
    });

    it('Normal insan okuma aralığındaki WPM değerlerini korumalıdır (220, 450, 800 WPM)', () => {
      expect(clampWpm(220)).toBe(220);
      expect(clampWpm(450)).toBe(450);
      expect(clampWpm(800)).toBe(800);
    });

    it('Geçersiz (NaN/Infinity) girdilerde varsayılan 220 WPM dönmelidir', () => {
      expect(clampWpm(NaN)).toBe(220);
      expect(clampWpm(Infinity)).toBe(220);
    });
  });

  describe('5. FIRE İntra-Month Harcama Normalizasyonu (Bulgu 2.3)', () => {
    it('Tanımlı bütçe limiti varsa ayın gününe bakılmaksızın öncelikli baz alınmalıdır', () => {
      const expense = calculateNormalizedMonthlyExpense(1500, 2, 45000);
      expect(expense).toBe(45000);
    });

    it('Bütçe limiti yoksa güncel harcama gün sayısına bölünerek aya normalize edilmelidir', () => {
      // Ayın 2. gününde 2.000 TL harcanmışsa: (2000 / 2) * 30.5 = 30.500 TL
      const expense = calculateNormalizedMonthlyExpense(2000, 2, 0);
      expect(expense).toBe(30500);
    });

    it('Harcama ve bütçe yoksa 0 dönmelidir', () => {
      expect(calculateNormalizedMonthlyExpense(0, 5, 0)).toBe(0);
    });
  });

  describe('6. Kişisel Enflasyon Reel Avantaj İşaret Doğrulaması (Bulgu 3.2)', () => {
    it('Negatif reel avantajda "+-11.4%" yerine "-11.4%" basmalıdır', () => {
      const formatted = formatRealAdvantage(-11.4);
      expect(formatted).toBe('-11.4%');
      expect(formatted).not.toContain('+-');
    });

    it('Pozitif reel avantajda "+15.2%" formatında artı işareti korumalıdır', () => {
      const formatted = formatRealAdvantage(15.2);
      expect(formatted).toBe('+15.2%');
    });

    it('Sıfır reel avantajda "0%" dönmelidir', () => {
      expect(formatRealAdvantage(0)).toBe('0%');
    });
  });

  describe('7. Kalan Yıl Projeksiyon Durum Rozeti (Bulgu 2.1)', () => {
    it('Hedefe ulaşıldığında yearsToFire = 0 ise "Hedefe Ulaşıldı! 🏆" dönmelidir', () => {
      const status = getYearsToFireDisplay(2500000, 2600000, 0, 45, 15000);
      expect(status.text).toBe('Hedefe Ulaşıldı! 🏆');
    });

    it('Net varlık negatifken yearsToFire = 0 olsa bile "Borçlu" dönmelidir', () => {
      const status = getYearsToFireDisplay(2500000, -50000, 0, 0, 0);
      expect(status.text).toBe('Borçlu');
    });

    it('Hedef var ama tasarruf yoksa "Tasarruf Yok" dönmelidir', () => {
      const status = getYearsToFireDisplay(2500000, 100000, 0, 0, 0);
      expect(status.text).toBe('Tasarruf Yok');
    });

    it('Normal projeksiyonda "~12.4 Yıl" göstermelidir', () => {
      const status = getYearsToFireDisplay(2500000, 500000, 12.4, 40, 10000);
      expect(status.text).toBe('~12.4 Yıl');
    });

    it('Net varlık 0 TL iken pozitif tasarruf varsa "Hesaplanıyor" yerine dinamik kalan yılı göstermelidir', () => {
      // 2.5M hedef, 0 net varlık, 10.000 TL/ay tasarruf -> 2.5M / 120k = 20.8 yıl
      const status = getYearsToFireDisplay(2500000, 0, 0, 30, 10000);
      expect(status.text).toBe('~20.8 Yıl');
      expect(status.color).toBe('var(--emerald)');
    });

    it('FIRE hedefi sıfır veya tanımsızken "—" dönmelidir', () => {
      expect(getYearsToFireDisplay(0, 500000, 0).text).toBe('—');
      expect(getYearsToFireDisplay(-100, 500000, 0).text).toBe('—');
    });

    it('Tasarruf oranı veya aylık tasarruf verisi yoksa güvenli "Hesaplanıyor" dönmelidir', () => {
      const status = getYearsToFireDisplay(2500000, 50000, 0, undefined, undefined);
      expect(status.text).toBe('Hesaplanıyor');
    });
  });

  describe('8. Harcama Normalizasyonu Sınır Değerleri', () => {
    it('dayOfMonth = 0 veya negatif verildiğinde sıfıra bölme hatası yapmayıp gün 1 baz alınmalıdır', () => {
      const exp0 = calculateNormalizedMonthlyExpense(1000, 0, 0);
      expect(exp0).toBe(30500);

      const expNeg = calculateNormalizedMonthlyExpense(1000, -5, 0);
      expect(expNeg).toBe(30500);
    });
  });
});
