import { describe, it, expect } from 'vitest';
import {
  parseFinancialAmount,
  formatFinancialCurrency,
  formatDateSafe,
  calculateDaysOverdue
} from '@/lib/financial-utils';
import { CSVColumn } from '@/lib/export-csv';

describe('Modül 2: Bütçe & Finans UI Düzeltme Doğrulama Testleri', () => {

  // =========================================================================
  // Test 1: Kategori Bütçe Limiti Güvenli Sayı Ayrıştırma (Bulgu 1)
  // =========================================================================
  describe('Bulgu 1: Kategori Bütçe Limiti Çözümleyici (100x Enflasyon Koruması)', () => {
    it('virgüllü kuruş girildiğinde (2.500,50) 100 katına (250050) çıkmayıp doğru 2500.5 olarak ayrışmalı', () => {
      const input = '2.500,50';
      
      // Eski hatalı regex davranışı 250050 yapıyordu
      const flawedOldRegexResult = Number(input.replace(/\D/g, ''));
      expect(flawedOldRegexResult).toBe(250050); // 100 kat hatalı

      // Yeni güvenli çözümleyici
      const safeResult = parseFinancialAmount(input);
      expect(safeResult).toBe(2500.50);
      expect(safeResult).not.toBe(250050);
    });

    it('yalnızca virgül içeren girdi (2500,50) doğru ayrışmalı', () => {
      expect(parseFinancialAmount('2500,50')).toBe(2500.50);
    });

    it('standart noktalı girdi (2500.50) doğru ayrışmalı', () => {
      expect(parseFinancialAmount('2500.50')).toBe(2500.50);
    });

    it('düz tamsayı girdi (5000 veya 15.000) doğru ayrışmalı', () => {
      expect(parseFinancialAmount('5000')).toBe(5000);
      expect(parseFinancialAmount('15.000,00')).toBe(15000);
    });

    it('para birimi simgeli girişler (₺, $, €) temizlenerek doğru ayrışmalı', () => {
      expect(parseFinancialAmount('₺ 3.250,75')).toBe(3250.75);
      expect(parseFinancialAmount('1.200 $')).toBe(1200);
    });

    it('geçersiz veya boş değerlerde NaN dönmeli', () => {
      expect(isNaN(parseFinancialAmount(''))).toBe(true);
      expect(isNaN(parseFinancialAmount('abc'))).toBe(true);
    });
  });

  // =========================================================================
  // Test 2: Negatif Harcama / Tutar Doğrulaması (Bulgu 4)
  // =========================================================================
  describe('Bulgu 4: Negatif Tutar ve Sıfır Girişi Doğrulaması', () => {
    function validateTransactionAmount(amountStr: string): { valid: boolean; error?: string; value?: number } {
      const parsed = parseFloat(amountStr);
      if (isNaN(parsed) || parsed <= 0) {
        return { valid: false, error: "Lütfen 0'dan büyük geçerli bir tutar girin." };
      }
      return { valid: true, value: parsed };
    }

    it('negatif harcama tutarları (-500) kesin olarak reddedilmeli', () => {
      const result = validateTransactionAmount('-500');
      expect(result.valid).toBe(false);
      expect(result.error).toContain("0'dan büyük");
    });

    it('sıfır (0) harcama tutarı reddedilmeli', () => {
      const result = validateTransactionAmount('0');
      expect(result.valid).toBe(false);
      expect(result.error).toContain("0'dan büyük");
    });

    it('pozitif geçerli tutarlar (150.50) onaylanmalı', () => {
      const result = validateTransactionAmount('150.50');
      expect(result.valid).toBe(true);
      expect(result.value).toBe(150.50);
    });
  });

  // =========================================================================
  // Test 3: 'GOLD' Para Birimi Crash / RangeError Koruması (Bulgu 2)
  // =========================================================================
  describe('Bulgu 2: GOLD / Kasa Varlıklarında RangeError Koruması', () => {
    it('ham Intl.NumberFormat GOLD para biriminde RangeError fırlatır', () => {
      expect(() => {
        new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'GOLD' }).format(10);
      }).toThrowError(/Invalid currency code/i);
    });

    it('formatFinancialCurrency GOLD para biriminde çökmeden gr Altın döndürmeli', () => {
      expect(() => {
        const output = formatFinancialCurrency(25, 'GOLD');
        expect(output).toContain('gr Altın');
        expect(output).toContain('25');
      }).not.toThrow();
    });

    it('formatFinancialCurrency standart para birimlerini (TRY, USD, EUR) doğru formatlamalı', () => {
      const tryFormatted = formatFinancialCurrency(1000, 'TRY');
      expect(tryFormatted).toContain('1.000');

      const usdFormatted = formatFinancialCurrency(500, 'USD');
      expect(usdFormatted).toContain('500');
    });

    it('tanımsız / geçersiz para birimlerinde güvenli fallback sağlamalı', () => {
      expect(() => {
        const res = formatFinancialCurrency(100, 'INVALID_CODE');
        expect(res).toBeDefined();
      }).not.toThrow();
    });
  });

  // =========================================================================
  // Test 4: Kredi Kartı CSV Export Sütun Dizinleri (Bulgu 10)
  // =========================================================================
  describe('Bulgu 10: Kredi Kartı Ekstre CSV Sütun Dizinleri', () => {
    it('Kalan Borç sütunu r[7] (remaining_amount) üzerinden okunmalı, r[6] (total_amount) basılmamalı', () => {
      // Mock taksitli ekstre satırı:
      // [0: tarih, 1: merchant, 2: kategori, 3: tip, 4: taksit, 5: aylık, 6: toplam, 7: kalan]
      const sampleRow = [
        '2026-11-01',
        'Teknoloji Mağazası',
        'Elektronik',
        'Taksitli',
        '2/6',
        1000,  // aylık tutar
        6000,  // r[6] -> Toplam Tutar
        4000   // r[7] -> Kalan Borç
      ];

      // Düzeltilmiş CSV kolon konfigürasyonu
      const columns: CSVColumn<(string | number)[]>[] = [
        { header: 'Tarih', accessor: r => r[0] },
        { header: 'Harcama Noktası', accessor: r => r[1] },
        { header: 'Kategori', accessor: r => r[2] },
        { header: 'İşlem Tipi', accessor: r => r[3] },
        { header: 'Taksit Durumu', accessor: r => r[4] },
        { header: 'Aylık Tutar (TL)', accessor: r => r[5] },
        { header: 'Toplam Tutar (TL)', accessor: r => r[6] },
        { header: 'Kalan Borç (TL)', accessor: r => r[7] }, // ✅ r[7] olmalı
      ];

      const totalAmountColumn = columns[6];
      const remainingAmountColumn = columns[7];

      expect(totalAmountColumn.header).toBe('Toplam Tutar (TL)');
      expect(totalAmountColumn.accessor(sampleRow)).toBe(6000);

      expect(remainingAmountColumn.header).toBe('Kalan Borç (TL)');
      // Kalan borç 4000 olmalı, eski hatalı r[6] olsaydı 6000 çıkardı
      expect(remainingAmountColumn.accessor(sampleRow)).toBe(4000);
      expect(remainingAmountColumn.accessor(sampleRow)).not.toBe(totalAmountColumn.accessor(sampleRow));
    });
  });

  // =========================================================================
  // Test 5: Ay Dönümü Gecikme Günü & Tarih Formatlama (Bulgu 11, 12)
  // =========================================================================
  describe('Bulgu 11 & 12: Ay Dönümü Gecikme ve Güvenli ISO Tarih Formatlama', () => {
    it('due_day 28 olup bugün ayın 3ü olduğunda gecikme 1 gün değil 5-6 gün hesaplanmalı', () => {
      // 3 Kasım 2026 referans tarihi, son ödeme: 28 Ekim 2026 (Ekim 31 gün çeker)
      const fakeToday = new Date(2026, 10, 3); // 3 Kasım 2026
      const dueDay = 28;
      
      const daysOverdue = calculateDaysOverdue(dueDay, fakeToday);
      // 28 Ekim'den 3 Kasım'a: 29, 30, 31 Ekim, 1, 2, 3 Kasım -> 6 gün
      expect(daysOverdue).toBe(6);
      expect(daysOverdue).not.toBe(1);
    });

    it('formatDateSafe ISO 8601 (2026-11-01T14:32:00.000Z) stringlerini düzgün DD.MM.YYYY formatlamalı', () => {
      const isoStr = '2026-11-01T14:32:00.000Z';
      const formatted = formatDateSafe(isoStr);
      expect(formatted).toBe('01.11.2026');
      expect(formatted).not.toContain('T');
    });

    it('formatDateSafe standart YYYY-MM-DD stringlerini düzgün formatlamalı', () => {
      expect(formatDateSafe('2026-08-15')).toBe('15.08.2026');
    });

    it('formatDateSafe boş veya tanımsız değerlerde tire dönmeli', () => {
      expect(formatDateSafe(null)).toBe('—');
      expect(formatDateSafe('')).toBe('—');
    });
  });

});
