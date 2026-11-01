import { describe, it, expect } from 'vitest';
import {
  validateReadingSessionPages,
  filterAndCalculateMaintenance,
  calculateFastingProgress
} from '@/lib/module3-utils';

describe('🎯 Modül 3 UI & Donanım Doğrulama Testleri (TDD Verification)', () => {
  describe('1. Okuma Seansı Sayfa Aralığı Doğrulaması (Bulgu 7)', () => {
    it('Bitiş sayfası başlangıç sayfasından küçük olduğunda işlemi reddetmelidir (start: 150, end: 120)', () => {
      const result = validateReadingSessionPages('range', 150, 120);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Bitiş sayfası başlangıç sayfasından büyük olmalıdır.');
      expect(result.pagesRead).toBe(0);
    });

    it('Bitiş sayfası başlangıç sayfasına eşit olduğunda işlemi reddetmelidir (start: 100, end: 100)', () => {
      const result = validateReadingSessionPages('range', '100', '100');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Bitiş sayfası başlangıç sayfasından büyük olmalıdır.');
      expect(result.pagesRead).toBe(0);
    });

    it('Geçerli aralık girildiğinde okunan sayfa sayısını doğru hesaplamalıdır (start: 50, end: 85 -> 35)', () => {
      const result = validateReadingSessionPages('range', '50', '85');
      expect(result.valid).toBe(true);
      expect(result.pagesRead).toBe(35);
      expect(result.error).toBeUndefined();
    });

    it('Sayfa adedi modunda (count) 0 veya negatif değerleri reddetmelidir', () => {
      const resZero = validateReadingSessionPages('count', 50, '0');
      expect(resZero.valid).toBe(false);
      expect(resZero.error).toBe('Okunan sayfa sayısı en az 1 olmalıdır.');

      const resNeg = validateReadingSessionPages('count', 50, '-5');
      expect(resNeg.valid).toBe(false);
    });

    it('Sayfa adedi modunda (count) pozitif sayfa sayısını kabul etmelidir', () => {
      const result = validateReadingSessionPages('count', 50, '20');
      expect(result.valid).toBe(true);
      expect(result.pagesRead).toBe(20);
    });
  });

  describe('2. Çoklu Araç Bakım Defteri İzolasyonu & KPI Hesaplaması (Bulgu 3)', () => {
    const mockRecords = [
      { id: '1', vehicle_id: 'car-1', description: 'Periyodik Bakım', cost: 4500, km_at_service: 150000 },
      { id: '2', vehicle_id: 'moto-1', description: 'Motosiklet Yağ Değişimi', cost: 1200, km_at_service: 12000 },
      { id: '3', vehicle_id: 'car-1', description: 'Fren Balata Değişimi', cost: 2500, km_at_service: 158000 },
      { id: '4', vehicle_id: 'moto-1', description: 'Zincir Yağlama & Ayar', cost: 500, km_at_service: 14000 }
    ];

    it('Otomobil seçildiğinde sadece otomobil kayıtlarını filtrelemeli ve toplam masrafı izole hesaplamalıdır', () => {
      const { filtered, totalSpent, totalCount, avgCost, nextTargetKm } = filterAndCalculateMaintenance(mockRecords, 'car-1');
      expect(filtered).toHaveLength(2);
      expect(filtered.every(r => r.vehicle_id === 'car-1')).toBe(true);
      expect(totalSpent).toBe(7000); // 4500 + 2500
      expect(totalCount).toBe(2);
      expect(avgCost).toBe(3500);
      expect(nextTargetKm).toBe(165000); // 150000 + 15000
    });

    it('Motosiklet seçildiğinde otomobil harcamaları motosiklet defterine sızmamalıdır', () => {
      const { filtered, totalSpent, totalCount, avgCost, nextTargetKm } = filterAndCalculateMaintenance(mockRecords, 'moto-1');
      expect(filtered).toHaveLength(2);
      expect(filtered.every(r => r.vehicle_id === 'moto-1')).toBe(true);
      expect(totalSpent).toBe(1700); // 1200 + 500
      expect(totalCount).toBe(2);
      expect(avgCost).toBe(850);
      expect(nextTargetKm).toBe(27000); // 12000 + 15000
    });

    it('Kayıt olmayan yeni araç için sıfır maliyet ve varsayılan 15.000 km hedefi dönmelidir', () => {
      const { filtered, totalSpent, totalCount, avgCost, nextTargetKm } = filterAndCalculateMaintenance(mockRecords, 'empty-vehicle');
      expect(filtered).toHaveLength(0);
      expect(totalSpent).toBe(0);
      expect(totalCount).toBe(0);
      expect(avgCost).toBe(0);
      expect(nextTargetKm).toBe(15000);
    });
  });

  describe('3. İstemci Taraflı Oruç Sayacı (Fasting Timer) Matematiksel Reaktivitesi (Bulgu 2)', () => {
    it('Başlangıç zamanı belirtilmediğinde null döndürmelidir', () => {
      const metrics = calculateFastingProgress(undefined);
      expect(metrics).toBeNull();
    });

    it('4 saatlik oruçta Kan Şekeri Düşüşü / Yağ Yakımına Geçiş evresini ve süreyi doğru formatlamalıdır', () => {
      const fourHoursAgo = new Date(Date.now() - 4.5 * 3600 * 1000).toISOString();
      const targetTime = new Date(Date.now() + 11.5 * 3600 * 1000).toISOString();

      const metrics = calculateFastingProgress(fourHoursAgo, targetTime);
      expect(metrics).not.toBeNull();
      expect(metrics?.elapsedText.startsWith('04:')).toBe(true);
      expect(metrics?.currentPhase).toContain('Yağ Yakımına Geçiş');
      expect(metrics?.progressPercent).toBeGreaterThanOrEqual(25);
    });

    it('14 saatlik oruçta Ketozis & Yüksek Yağ Yakımı evresini doğru tespit etmelidir', () => {
      const fourteenHoursAgo = new Date(Date.now() - 14 * 3600 * 1000).toISOString();
      const targetTime = new Date(Date.now() + 2 * 3600 * 1000).toISOString();

      const metrics = calculateFastingProgress(fourteenHoursAgo, targetTime);
      expect(metrics).not.toBeNull();
      expect(metrics?.elapsedText.startsWith('14:')).toBe(true);
      expect(metrics?.currentPhase).toContain('Ketozis');
    });

    it('20 saatlik oruçta Otofaji evresini doğru tespit etmelidir', () => {
      const twentyHoursAgo = new Date(Date.now() - 20 * 3600 * 1000).toISOString();
      const targetTime = new Date(Date.now() - 4 * 3600 * 1000).toISOString(); // Hedef aşıldı

      const metrics = calculateFastingProgress(twentyHoursAgo, targetTime);
      expect(metrics).not.toBeNull();
      expect(metrics?.elapsedText.startsWith('20:')).toBe(true);
      expect(metrics?.currentPhase).toContain('Otofaji');
      expect(metrics?.remainingText).toBe('Hedefe Ulaşıldı! 🏆');
      expect(metrics?.progressPercent).toBe(100);
    });

    it('48 saat ve üzeri oruçta Kök Hücre & HGH Zirvesi evresini doğru tespit etmelidir', () => {
      const fortyEightHoursAgo = new Date(Date.now() - 49 * 3600 * 1000).toISOString();
      const metrics = calculateFastingProgress(fortyEightHoursAgo);
      expect(metrics).not.toBeNull();
      expect(metrics?.currentPhase).toContain('Kök Hücre');
    });
  });
});
