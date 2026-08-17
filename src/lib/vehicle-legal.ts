/**
 * Singularity Life OS - Araç Yasal Hatırlatıcıları & Takvim Hesaplama Motoru
 * - TÜVTÜRK Araç Muayene Periyotları (Hususi: 3 yıl + her 2 yılda bir)
 * - Motorlu Taşıtlar Vergisi (MTV) 1. & 2. Taksit Takvimi (31 Ocak / 31 Temmuz)
 * - Zorunlu Trafik Sigortası & Kasko Yıllık Döngüleri
 */

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

/**
 * TÜVTÜRK Muayene Vade Tarihini Model Yılı ve Geçmişe Göre Otomatik Hesaplar
 * Hususi Araçlar: İlk 3 yaş (Model + 3), ardından her 2 yılda bir.
 */
export function calculateTuvturkInspectionDate(modelYear: number, lastInspectionDate?: string | null): string {
  const today = new Date();
  const currentYear = today.getFullYear();
  const safeModelYear = Math.max(1990, Math.min(currentYear + 1, Number(modelYear) || currentYear));

  // Eğer geçmişte yapılmış bir muayene tarihi biliniyorsa +2 yıl ekle
  if (lastInspectionDate) {
    const lastDate = new Date(lastInspectionDate);
    if (!isNaN(lastDate.getTime())) {
      const nextDate = new Date(lastDate);
      nextDate.setFullYear(nextDate.getFullYear() + 2);
      // Eğer gelecekteyse bunu döndür
      if (nextDate >= today) {
        return nextDate.toISOString().split('T')[0];
      }
    }
  }

  // Model yılına göre ilk 3 yıl kuralı
  let inspectionYear = safeModelYear + 3;
  while (inspectionYear < currentYear || (inspectionYear === currentYear && today.getMonth() > 5)) {
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
  const today = new Date();
  const currentYear = today.getFullYear();
  const todayISO = today.toISOString().split('T')[0];

  const installments: { type: 'mtv_1' | 'mtv_2'; title: string; due_date: string; cost_estimate: number }[] = [];

  // Mevcut yıl ve sonraki yıl için kontrol et
  for (let yr of [currentYear, currentYear + 1]) {
    const mtv1Date = `${yr}-01-31`;
    const mtv2Date = `${yr}-07-31`;

    if (mtv1Date >= todayISO) {
      installments.push({
        type: 'mtv_1',
        title: `🏛️ ${yr} Yılı MTV 1. Taksit Ödemesi`,
        due_date: mtv1Date,
        cost_estimate: 2450
      });
    }

    if (mtv2Date >= todayISO) {
      installments.push({
        type: 'mtv_2',
        title: `🏛️ ${yr} Yılı MTV 2. Taksit Ödemesi`,
        due_date: mtv2Date,
        cost_estimate: 2450
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
  const results: GeneratedLegalReminder[] = [];

  // 1. TÜVTÜRK Muayene
  const tuvturkDate = calculateTuvturkInspectionDate(modelYear);
  results.push({
    id: `leg-tuv-${vehicleId}-${Date.now()}`,
    vehicle_id: vehicleId,
    type: 'muayene',
    title: '🔧 TÜVTÜRK Periyodik Araç Muayenesi',
    due_date: tuvturkDate,
    cost_estimate: 2850,
    policy_no: 'TÜVTÜRK Randevu',
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
      policy_no: 'GİB / Dijital Vergi Dairesi',
      is_completed: 0,
      created_at: now,
      updated_at: now
    });
  });

  // 3. Zorunlu Trafik Sigortası (Gelecek 1 Yıl)
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  results.push({
    id: `leg-sig-${vehicleId}-${Date.now()}`,
    vehicle_id: vehicleId,
    type: 'sigorta',
    title: '📋 Zorunlu Trafik Sigortası Yenileme',
    due_date: nextYear.toISOString().split('T')[0],
    cost_estimate: 7500,
    policy_no: 'TRF-POL-84920',
    is_completed: 0,
    created_at: now,
    updated_at: now
  });

  return results;
}
