/**
 * Singularity Life OS - Araç Yasal Hatırlatıcıları & Takvim Hesaplama Motoru
 * - TÜVTÜRK Araç Muayene Periyotları (Hususi: 3 yıl + her 2 yılda bir)
 * - Motorlu Taşıtlar Vergisi (MTV) 1. & 2. Taksit Takvimi (31 Ocak / 31 Temmuz)
 * - Zorunlu Trafik Sigortası & Kasko Yıllık Döngüleri
 */

import { getTodayTurkeyDate, parseTurkeyCalendarDate } from '@/lib/date-utils';

export interface GeneratedLegalReminder {
  id: string;
  vehicle_id: string;
  type: 'muayene' | 'mtv_1' | 'mtv_2' | 'sigorta' | 'kasko';
  title: string;
  due_date: string;
  cost_estimate: number;
  policy_no: string;
  is_completed: number;
  created_at: string;
  updated_at: string;
}

export interface VehicleMaintenanceRecordLike {
  id?: string;
  vehicle_id?: string;
  type?: string | null;
  km_at_service?: number | null;
  next_service_km?: number | null;
  next_service_date?: string | null;
  service_date?: string | null;
}

export function isPeriodicMaintenanceType(type?: string | null): boolean {
  if (!type) return true;
  const normalized = type.trim().toLowerCase();
  return normalized === 'periyodik_bakim' || normalized.includes('periyodik');
}

/**
 * 15.000 KM periyodik bakım döngüsünü hesaplar.
 * - Ara onarımlar (akü, lastik, fren vb.) 15.000 KM periyodik yağ/filtre döngüsünü sıfırlamaz.
 * - Geçmiş periyodik bakım varsa ve güncel KM hedef KM'yi aşmışsa (gecikmiş bakım),
 *   döngüyü gizlice sonraki 15.000 KM dilimine sıfırlamaz; remainingKm = 0 ve isOverdue = true döner.
 */
export function calculateVehicleMaintenanceCycle<T extends VehicleMaintenanceRecordLike>(
  currentKmInput: number,
  records: T[] = []
) {
  const currentKm = Math.max(0, Number(currentKmInput) || 0);
  const periodicCompleted = records
    .filter(r => isPeriodicMaintenanceType(r.type) && Number(r.km_at_service ?? 0) <= currentKm)
    .sort((a, b) => Number(b.km_at_service ?? 0) - Number(a.km_at_service ?? 0));

  const lastCompletedService = periodicCompleted[0] || null;

  let cycleStartKm: number;
  let nextServiceKm: number;

  if (lastCompletedService) {
    cycleStartKm = Math.max(0, Number(lastCompletedService.km_at_service) || 0);
    const candidateNext = Number(lastCompletedService.next_service_km) || 0;
    nextServiceKm = candidateNext > cycleStartKm ? candidateNext : cycleStartKm + 15000;
  } else {
    cycleStartKm = Math.floor(currentKm / 15000) * 15000;
    nextServiceKm = cycleStartKm + 15000;
  }

  const cycleTotalDistance = Math.max(1000, nextServiceKm - cycleStartKm);
  const drivenInCycle = Math.max(0, currentKm - cycleStartKm);
  const remainingKm = Math.max(0, nextServiceKm - currentKm);
  const overdueKm = Math.max(0, currentKm - nextServiceKm);
  const isOverdue = Boolean(lastCompletedService && currentKm >= nextServiceKm);
  const kmProgressPercentage = Math.max(
    0,
    Math.min(100, Math.round((drivenInCycle / cycleTotalDistance) * 100))
  );

  return {
    lastService: lastCompletedService,
    cycleStartKm,
    nextServiceKm,
    remainingKm,
    overdueKm,
    isOverdue,
    kmProgressPercentage,
    nextServiceDate: lastCompletedService?.next_service_date || null,
  };
}

export interface FuelLogLike {
  km: number;
  liters: number;
  total_amount: number;
  is_full_tank?: number | boolean | null;
  fuel_date?: string | null;
  created_at?: string | null;
}

/**
 * Parçalı (kısmi) dolumları bir sonraki tam depoya kadar biriktirerek
 * gerçekçi yakıt tüketimi (L/100km) ve kilometre maliyeti (₺/km) hesaplar.
 */
export function calculateFuelConsumption(fuelLogs: FuelLogLike[] = []): {
  avgLitersPer100Km: number;
  avgCostPerKm: number;
} {
  if (!Array.isArray(fuelLogs) || fuelLogs.length < 2) {
    return { avgLitersPer100Km: 0, avgCostPerKm: 0 };
  }

  const sorted = [...fuelLogs].sort((a, b) => {
    const kmDiff = Number(a.km) - Number(b.km);
    if (kmDiff !== 0) return kmDiff;
    return String(a.fuel_date || '').localeCompare(String(b.fuel_date || ''));
  });

  const isFull = (log: FuelLogLike) => log.is_full_tank !== 0 && log.is_full_tank !== false;

  let anchorKm: number | null = null;
  let pendingLiters = 0;
  let pendingCost = 0;
  let totalValidKm = 0;
  let totalValidLiters = 0;
  let totalValidCost = 0;

  for (const log of sorted) {
    const km = Number(log.km);
    const liters = Number(log.liters);
    const cost = Number(log.total_amount);
    if (!Number.isFinite(km) || !Number.isFinite(liters) || liters <= 0 || !Number.isFinite(cost) || cost < 0) {
      continue;
    }

    if (anchorKm === null) {
      if (isFull(log)) {
        anchorKm = km;
      }
      continue;
    }

    pendingLiters += liters;
    pendingCost += cost;

    if (isFull(log)) {
      const dist = km - anchorKm;
      if (dist >= 50 && dist <= 2500) {
        totalValidKm += dist;
        totalValidLiters += pendingLiters;
        totalValidCost += pendingCost;
      }
      anchorKm = km;
      pendingLiters = 0;
      pendingCost = 0;
    }
  }

  if (totalValidKm <= 0) {
    return { avgLitersPer100Km: 0, avgCostPerKm: 0 };
  }

  return {
    avgLitersPer100Km: Math.round((totalValidLiters / totalValidKm) * 100 * 10) / 10,
    avgCostPerKm: Math.round((totalValidCost / totalValidKm) * 100) / 100,
  };
}

/**
 * TÜVTÜRK Muayene Vade Tarihini Model Yılı ve Geçmişe Göre Otomatik Hesaplar
 * Hususi Araçlar: İlk 3 yaş (Model + 3), ardından her 2 yılda bir.
 */
export function calculateTuvturkInspectionDate(modelYear: number, lastInspectionDate?: string | null): string {
  const todayISO = getTodayTurkeyDate();
  const today = parseTurkeyCalendarDate(todayISO);
  const currentYear = today.getFullYear();
  const safeModelYear = Math.max(1990, Math.min(currentYear + 1, Number(modelYear) || currentYear));

  // Eğer geçmişte yapılmış bir muayene tarihi biliniyorsa +2 yıl ekle
  if (lastInspectionDate) {
    const lastDate = parseTurkeyCalendarDate(lastInspectionDate);
    if (!isNaN(lastDate.getTime())) {
      const nextDate = new Date(lastDate);
      nextDate.setFullYear(nextDate.getFullYear() + 2);
      const nextISO = getTodayTurkeyDate(nextDate);
      // Eğer gelecekteyse bunu döndür
      if (nextISO >= todayISO) {
        return nextISO;
      }
    }
  }

  // Model yılına göre ilk 3 yıl kuralı
  let inspectionYear = safeModelYear + 3;
  while (inspectionYear < currentYear || (inspectionYear === currentYear && `${inspectionYear}-05-15` < todayISO)) {
    inspectionYear += 2; // Her 2 yılda bir tekrarlanır
  }

  // Standart bahar/yaz muayene ayı (15 Mayıs)
  return `${inspectionYear}-05-15`;
}

/**
 * Güncel ve Gelecek Dönem MTV Taksit Tarihlerini Üretir
 * 1. Taksit: 31 Ocak
 * 2. Taksit: 31 Temmuz
 */
export function calculateUpcomingMtvDates(): { type: 'mtv_1' | 'mtv_2'; title: string; due_date: string; cost_estimate: number }[] {
  const todayISO = getTodayTurkeyDate();
  const currentYear = Number(todayISO.slice(0, 4));

  const installments: { type: 'mtv_1' | 'mtv_2'; title: string; due_date: string; cost_estimate: number }[] = [];

  // Mevcut yıl ve sonraki yıl için kontrol et
  for (const yr of [currentYear, currentYear + 1]) {
    const mtv1Date = `${yr}-01-31`;
    const mtv2Date = `${yr}-07-31`;

    if (mtv1Date >= todayISO) {
      installments.push({
        type: 'mtv_1',
        title: `🏛️ ${yr} Yılı MTV 1. Taksit Ödemesi`,
        due_date: mtv1Date,
        cost_estimate: 0
      });
    }

    if (mtv2Date >= todayISO) {
      installments.push({
        type: 'mtv_2',
        title: `🏛️ ${yr} Yılı MTV 2. Taksit Ödemesi`,
        due_date: mtv2Date,
        cost_estimate: 0
      });
    }
  }

  // En yakın 2 taksiti döndür
  return installments.slice(0, 2);
}

/**
 * Bir Araç İçin Yasal Hatırlatıcı Paketini Eksiksiz Üretir
 */
export function generateAutoLegalReminders(vehicleId: string, modelYear: number): GeneratedLegalReminder[] {
  const now = new Date().toISOString();
  const todayISO = getTodayTurkeyDate();
  const results: GeneratedLegalReminder[] = [];

  // 1. TÜVTÜRK Muayene
  const tuvturkDate = calculateTuvturkInspectionDate(modelYear);
  results.push({
    id: `leg-tuv-${vehicleId}-${Date.now()}`,
    vehicle_id: vehicleId,
    type: 'muayene',
    title: '🔧 TÜVTÜRK Periyodik Araç Muayenesi',
    due_date: tuvturkDate,
    cost_estimate: 0,
    policy_no: '',
    is_completed: 0,
    created_at: now,
    updated_at: now
  });

  // 2. MTV Taksitleri
  const mtvList = calculateUpcomingMtvDates();
  mtvList.forEach((mtv, idx) => {
    results.push({
      id: `leg-mtv-${vehicleId}-${idx}-${Date.now()}`,
      vehicle_id: vehicleId,
      type: mtv.type,
      title: mtv.title,
      due_date: mtv.due_date,
      cost_estimate: mtv.cost_estimate,
      policy_no: '',
      is_completed: 0,
      created_at: now,
      updated_at: now
    });
  });

  // 3. Zorunlu Trafik Sigortası (Gelecek 1 Yıl)
  const nextYearDate = parseTurkeyCalendarDate(todayISO);
  nextYearDate.setFullYear(nextYearDate.getFullYear() + 1);
  results.push({
    id: `leg-sig-${vehicleId}-${Date.now()}`,
    vehicle_id: vehicleId,
    type: 'sigorta',
    title: '📋 Zorunlu Trafik Sigortası Yenileme',
    due_date: getTodayTurkeyDate(nextYearDate),
    cost_estimate: 0,
    policy_no: '',
    is_completed: 0,
    created_at: now,
    updated_at: now
  });

  return results;
}
