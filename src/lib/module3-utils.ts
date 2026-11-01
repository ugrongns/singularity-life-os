// Singularity Life OS - Modül 3 (Yaşam Alanları, Biyometri, Araç & Kütüphane) Hesaplama ve Doğrulama Yardımcıları

/**
 * 1. Okuma Seansı Sayfa Aralığı Doğrulaması (Bulgu 7)
 * Negatif aralık veya bitiş <= başlangıç hatalarını engeller; WPM hesaplamasını korur.
 */
export function validateReadingSessionPages(
  inputMode: 'count' | 'range',
  startPage: string | number,
  endPageOrCount: string | number
): { valid: boolean; error?: string; pagesRead: number } {
  const start = typeof startPage === 'string' ? parseInt(startPage, 10) || 0 : startPage;
  if (inputMode === 'count') {
    const count = typeof endPageOrCount === 'string' ? parseInt(endPageOrCount, 10) || 0 : endPageOrCount;
    if (count <= 0) {
      return { valid: false, error: 'Okunan sayfa sayısı en az 1 olmalıdır.', pagesRead: 0 };
    }
    return { valid: true, pagesRead: count };
  } else {
    const end = typeof endPageOrCount === 'string' ? parseInt(endPageOrCount, 10) || 0 : endPageOrCount;
    if (end <= start) {
      return { valid: false, error: 'Bitiş sayfası başlangıç sayfasından büyük olmalıdır.', pagesRead: 0 };
    }
    return { valid: true, pagesRead: end - start };
  }
}

/**
 * 2. Çoklu Araç Bakım Defteri İzolasyonu & KPI Hesaplaması (Bulgu 3)
 * Çok araçlı ailelerde servis kayıtlarının birbirine karışmasını engeller.
 */
export function filterAndCalculateMaintenance(records: any[], vehicleId?: string) {
  const filtered = vehicleId
    ? records.filter((r) => r.vehicle_id === vehicleId)
    : records;
  const totalSpent = filtered.reduce((acc, curr) => acc + (Number(curr.cost) || 0), 0);
  const totalCount = filtered.length;
  const avgCost = totalCount > 0 ? Math.round(totalSpent / totalCount) : 0;
  const latestRecord = filtered[0];
  const nextTargetKm = latestRecord ? (Number(latestRecord.km_at_service) || 0) + 15000 : 15000;
  return { filtered, totalSpent, totalCount, avgCost, latestRecord, nextTargetKm };
}

/**
 * 3. İstemci Taraflı Oruç Sayacı (Fasting Timer) Matematiksel Reaktivitesi (Bulgu 2)
 * Sekme arka planda kalsa dahi istemci saatiyle reaktif geçen süre ve metabolik faz hesaplar.
 */
export function calculateFastingProgress(startTimeStr?: string, targetEndTimeStr?: string) {
  if (!startTimeStr) return null;
  const now = Date.now();
  const startTime = new Date(startTimeStr).getTime();
  const targetTime = targetEndTimeStr ? new Date(targetEndTimeStr).getTime() : startTime + 16 * 3600 * 1000;

  const elapsedMs = Math.max(0, now - startTime);
  const totalDurationMs = Math.max(1000, targetTime - startTime);
  const remainingMs = Math.max(0, targetTime - now);

  const elapsedSeconds = Math.floor((elapsedMs / 1000) % 60);
  const elapsedMinutes = Math.floor((elapsedMs / (1000 * 60)) % 60);
  const elapsedHours = Math.floor(elapsedMs / (1000 * 60 * 60));

  const remainingMinutes = Math.floor((remainingMs / (1000 * 60)) % 60);
  const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));

  const progressPercent = Math.min(100, Math.round((elapsedMs / totalDurationMs) * 100));

  const elapsedText = `${elapsedHours.toString().padStart(2, '0')}:${elapsedMinutes.toString().padStart(2, '0')}:${elapsedSeconds.toString().padStart(2, '0')}`;
  const remainingText = remainingMs > 0
    ? `${remainingHours} sa ${remainingMinutes} dk`
    : 'Hedefe Ulaşıldı! 🏆';

  let currentPhase = 'Kan Şekeri Düşüşü';
  let phaseColor = '#3B82F6';
  let phaseDescription = 'Vücut sindirimi tamamlıyor, insülin seviyeleri dengeleniyor.';

  if (elapsedHours >= 72) {
    currentPhase = '🛡️ 72 Saat: Bağışıklık Sistemi Yenilenmesi';
    phaseColor = '#EC4899';
    phaseDescription = 'Eski akyuvarlar tamamen geridönüştürüldü, yeni kök hücre tabanlı bağışıklık sistemi oluşuyor.';
  } else if (elapsedHours >= 48) {
    currentPhase = '👑 48 Saat: Kök Hücre & Büyüme Hormonu Zirvesi';
    phaseColor = '#8B5CF6';
    phaseDescription = 'Büyüme hormonu (HGH) %500 arttı; hücresel yaşlanmaya karşı kök hücre aktivasyonu maksimum seviyede.';
  } else if (elapsedHours >= 36) {
    currentPhase = '🧬 36 Saat: Derin Otofaji & Derin Hücresel Temizlik';
    phaseColor = '#6366F1';
    phaseDescription = 'Hücre içi çöp, katlanmamış proteinler ve disfonksiyonel organeller %300 hızla temizleniyor.';
  } else if (elapsedHours >= 24) {
    currentPhase = '🔥 24 Saat: Tam Otofaji & Glikojen Sıfırlaması';
    phaseColor = '#F59E0B';
    phaseDescription = 'Karaciğer glikojen depoları tamamen boşaldı, otofajik süreç aktif olarak hasarlı proteinleri dönüştürüyor.';
  } else if (elapsedHours >= 18) {
    currentPhase = '🧬 Otofaji Başlangıcı';
    phaseColor = '#8B5CF6';
    phaseDescription = 'Eski ve hasarlı hücreler temizleniyor, hücresel gençleşme devrede.';
  } else if (elapsedHours >= 12) {
    currentPhase = '🔥 Ketozis & Yüksek Yağ Yakımı';
    phaseColor = '#F59E0B';
    phaseDescription = 'Glikojen depoları tükendi; vücut birincil enerji olarak yağ yakıyor.';
  } else if (elapsedHours >= 4) {
    currentPhase = '⚡ Yağ Yakımına Geçiş';
    phaseColor = '#10B981';
    phaseDescription = 'İnsülin düştü, yağ asitleri serbest bırakılıyor.';
  }

  return {
    elapsedText,
    remainingText,
    progressPercent,
    currentPhase,
    phaseColor,
    phaseDescription,
    elapsedMs,
    remainingMs
  };
}
