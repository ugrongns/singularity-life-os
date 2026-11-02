// Singularity Life OS - Aralıklı Oruç & Ötofaji Geçmiş Analitiği (Faz 1)

export interface RawFastingSession {
  id: string;
  user_id?: string | null;
  family_id?: string | null;
  member_id?: string | null;
  protocol: string;
  start_time: string;
  target_end_time: string;
  actual_end_time?: string | null;
  is_active: number | boolean;
  notes?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface BiologicalPhaseInfo {
  phase: string;
  badge: string;
  phaseColor: string;
  description: string;
}

export interface FastingSessionStats {
  id: string;
  protocol: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  targetHours: number;
  autophagyHours: number;
  reachedAutophagy: boolean;
  phase: string;
  badge: string;
  phaseColor: string;
  isSuccessful: boolean;
}

export interface DailyFastingMetric {
  date: string; // YYYY-MM-DD
  dayLabel: string; // örn. "14 Eki"
  fastingHours: number;
  autophagyHours: number;
  reachedAutophagy: boolean;
  sessionsCount: number;
}

export interface FastingHistorySummary {
  totalCompletedSessions: number;
  currentMonthFastingHours: number;
  currentMonthAutophagyHours: number;
  longestFastHours: number;
  successRate: number; // 0-100
  dailyFastingHours: DailyFastingMetric[];
  sessions: FastingSessionStats[];
}

/**
 * Süreye (saat) göre biyolojik ötofaji ve hücresel fazı belirler.
 */
export function determineBiologicalPhase(durationHours: number): BiologicalPhaseInfo {
  if (durationHours >= 48) {
    return {
      phase: 'Kök Hücre & HGH Zirvesi',
      badge: '👑 Kök Hücre',
      phaseColor: '#EC4899',
      description: 'Büyüme hormonu zirvede, eski akyuvarlar temizlenip yeni kök hücre üretimi başladı.'
    };
  }
  if (durationHours >= 36) {
    return {
      phase: 'Derin Hücresel Temizlik',
      badge: '🧬 Derin Otofaji',
      phaseColor: '#6366F1',
      description: 'Hücre içi çöp, katlanmamış proteinler ve disfonksiyonel mitokondriler temizleniyor.'
    };
  }
  if (durationHours >= 24) {
    return {
      phase: 'Tam Otofaji & Glikojen Sıfırlama',
      badge: '🔥 Tam Otofaji',
      phaseColor: '#F59E0B',
      description: 'Karaciğer glikojeni sıfırlandı; hasarlı proteinler tamamen geri dönüştürülüyor.'
    };
  }
  if (durationHours >= 16) {
    return {
      phase: 'Temel Otofaji',
      badge: '✨ Temel Otofaji',
      phaseColor: '#8B5CF6',
      description: 'Hücresel gençleşme devrede, hasarlı hücre organelleri sindirilmeye başlandı.'
    };
  }
  if (durationHours >= 12) {
    return {
      phase: 'Ketozis & Yağ Yakımı',
      badge: '⚡ Yağ Yakımı',
      phaseColor: '#10B981',
      description: 'İnsülin tabana oturdu, karaciğer keton üretimine geçiş yaptı.'
    };
  }
  return {
    phase: 'Sindirime Geçiş & Kan Şekeri Düşüşü',
    badge: '🌱 Standart',
    phaseColor: '#3B82F6',
    description: 'Sindirim sistemi dinlenme evresinde, kan şekeri dengeleniyor.'
  };
}

/**
 * Protokol dizgisinden veya hedeften saat cinsinden hedef süreyi çıkarır.
 */
export function parseTargetHours(protocol: string, startTimeStr?: string, targetEndTimeStr?: string): number {
  if (startTimeStr && targetEndTimeStr) {
    const s = new Date(startTimeStr).getTime();
    const t = new Date(targetEndTimeStr).getTime();
    if (!isNaN(s) && !isNaN(t) && t > s) {
      return Math.round(((t - s) / (1000 * 3600)) * 10) / 10;
    }
  }

  const p = (protocol ?? '').trim();
  if (p === '12:12') return 12;
  if (p === '14:10') return 14;
  if (p === '16:8') return 16;
  if (p === '18:6') return 18;
  if (p === '20:4') return 20;
  if (p === 'OMAD' || p === '23:1') return 23;
  if (p.startsWith('24')) return 24;
  if (p.startsWith('36')) return 36;
  if (p.startsWith('48')) return 48;
  if (p.startsWith('72')) return 72;

  const match = p.match(/^(\d+)/);
  if (match) return parseInt(match[1], 10);
  return 16;
}

/**
 * Tek bir seansı doğrular ve istatistiklerini hesaplar.
 * Yarım kalan, iptal edilen (notes: cancelled) veya aktif seansları eler (null döner).
 */
export function calculateSessionStats(session: RawFastingSession): FastingSessionStats | null {
  // 1. Aktif seanslar henüz tamamlanmamıştır
  if (session.is_active === 1 || session.is_active === true) {
    return null;
  }

  // 2. Bitiş zamanı olmayan seanslar geçersizdir
  if (!session.actual_end_time) {
    return null;
  }

  // 3. İptal edilen seanslar filtrelenir
  if (session.notes && session.notes.toLowerCase().includes('cancel')) {
    return null;
  }

  const startMs = new Date(session.start_time).getTime();
  const endMs = new Date(session.actual_end_time).getTime();

  if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) {
    return null;
  }

  const rawHours = (endMs - startMs) / (1000 * 3600);
  // 10 dakikadan (0.16 saat) kısa kazara başlatılıp kapatılmış seansları ele
  if (rawHours < 0.16) {
    return null;
  }

  const durationHours = Math.round(rawHours * 10) / 10;
  const targetHours = parseTargetHours(session.protocol, session.start_time, session.target_end_time);

  // 16 saat eşiği ve ötofaji saati
  const reachedAutophagy = durationHours >= 16;
  const autophagyHours = reachedAutophagy ? Math.round((durationHours - 16) * 10) / 10 : 0;

  const phaseInfo = determineBiologicalPhase(durationHours);
  const isSuccessful = durationHours >= (targetHours - 0.05);

  return {
    id: session.id,
    protocol: session.protocol ?? '16:8',
    startTime: session.start_time,
    endTime: session.actual_end_time,
    durationHours,
    targetHours,
    autophagyHours,
    reachedAutophagy,
    phase: phaseInfo.phase,
    badge: phaseInfo.badge,
    phaseColor: phaseInfo.phaseColor,
    isSuccessful
  };
}

/**
 * Tüm seans listesini analiz edip kümülatif özet, aylık metrikler ve son 30 günün dağılımını üretir.
 */
export function calculateFastingHistoryAnalytics(
  rawSessions: RawFastingSession[],
  referenceDate: Date = new Date()
): FastingHistorySummary {
  const validStats: FastingSessionStats[] = [];

  for (const s of rawSessions) {
    const stat = calculateSessionStats(s);
    if (stat) {
      validStats.push(stat);
    }
  }

  // Kronolojik sırala (En yeniden en eskiye)
  validStats.sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime());

  const totalCompletedSessions = validStats.length;

  let successfulCount = 0;
  let longestFastHours = 0;
  let currentMonthFastingHours = 0;
  let currentMonthAutophagyHours = 0;

  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();

  for (const s of validStats) {
    if (s.isSuccessful) successfulCount++;
    if (s.durationHours > longestFastHours) longestFastHours = s.durationHours;

    const endDate = new Date(s.endTime);
    if (endDate.getFullYear() === refYear && endDate.getMonth() === refMonth) {
      currentMonthFastingHours += s.durationHours;
      currentMonthAutophagyHours += s.autophagyHours;
    }
  }

  currentMonthFastingHours = Math.round(currentMonthFastingHours * 10) / 10;
  currentMonthAutophagyHours = Math.round(currentMonthAutophagyHours * 10) / 10;
  longestFastHours = Math.round(longestFastHours * 10) / 10;

  const successRate = totalCompletedSessions > 0
    ? Math.round((successfulCount / totalCompletedSessions) * 100)
    : 0;

  // Son 30 günün gün bazında oruç süreleri dizisi
  const dailyFastingHours: DailyFastingMetric[] = [];
  const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

  for (let i = 29; i >= 0; i--) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayLabel = `${d.getDate()} ${monthNames[d.getMonth()]}`;

    // Bu gün tamamlanan seanslar
    const daySessions = validStats.filter(s => s.endTime.slice(0, 10) === dateStr);
    const dayFasting = daySessions.reduce((acc, curr) => acc + curr.durationHours, 0);
    const dayAutophagy = daySessions.reduce((acc, curr) => acc + curr.autophagyHours, 0);

    dailyFastingHours.push({
      date: dateStr,
      dayLabel,
      fastingHours: Math.round(dayFasting * 10) / 10,
      autophagyHours: Math.round(dayAutophagy * 10) / 10,
      reachedAutophagy: dayFasting >= 16,
      sessionsCount: daySessions.length
    });
  }

  return {
    totalCompletedSessions,
    currentMonthFastingHours,
    currentMonthAutophagyHours,
    longestFastHours,
    successRate,
    dailyFastingHours,
    sessions: validStats
  };
}
