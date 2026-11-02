// Singularity Life OS - Kitap Okuma Hızı (WPM) & Seans Zaman Serisi (Faz 2)
import { clampWpm } from '@/lib/module4-utils';

export interface RawReadingSessionWithBook {
  session_id: string;
  book_id: string;
  pages_read: number;
  duration_minutes: number;
  session_date: string;
  created_at: string;
  user_id?: string | null;
  book_title?: string | null;
  book_author?: string | null;
  book_category?: string | null;
  words_per_page?: number | null;
}

export interface EnrichedReadingSession {
  sessionId: string;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  category: string;
  pagesRead: number;
  durationMinutes: number;
  sessionDate: string;
  createdAt: string;
  wpm: number;
  wordsPerPage: number;
}

export interface CategoryWpmMetric {
  category: string;
  avgWpm: number;
  totalPages: number;
  totalMinutes: number;
  sessionCount: number;
}

export interface DailyReadingMetric {
  date: string; // YYYY-MM-DD
  dayLabel: string; // örn. "14 Eki"
  pagesRead: number;
  durationMinutes: number;
  avgWpm: number;
  sessionCount: number;
}

export interface ReadingAnalyticsSummary {
  totalSessions: number;
  totalPagesRead: number;
  totalMinutesRead: number;
  recentWpm: number; // Son 7 seans ortalaması
  allTimeWpm: number; // Tüm seanslar ortalaması
  accelerationPercent: number; // ((Son 5 ort. WPM - İlk 5 ort. WPM) / İlk 5 ort.) * 100
  categories: CategoryWpmMetric[];
  dailyTrend: DailyReadingMetric[]; // Son 30 gün
  sessions: EnrichedReadingSession[];
}

/**
 * Seans WPM hesaplaması:
 * session_wpm = Math.round((pages_read * (books.words_per_page ?? 250)) / duration_minutes)
 * clampWpm ile [60, 1200] aralığına normalize edilir.
 */
export function calculateSessionWpm(
  pagesRead: number,
  durationMinutes: number,
  wordsPerPage?: number | null
): number {
  const safePages = pagesRead ?? 0;
  const safeDuration = durationMinutes ?? 0;

  if (safeDuration <= 0 || safePages <= 0) {
    return 220; // Varsayılan sağlıklı okuma hızı
  }

  // Eksik words_per_page durumunda güvenli 250 varsayılanı (Falsy 0 korumalı)
  const safeWordsPerPage = (wordsPerPage !== null && wordsPerPage !== undefined && wordsPerPage > 0)
    ? wordsPerPage
    : 250;

  const rawWpm = (safePages * safeWordsPerPage) / safeDuration;
  return clampWpm(rawWpm);
}

/**
 * Okuma seanslarını ve kitap verilerini birleştirerek istatistiki özet ve zaman serisi üretir.
 */
export function calculateReadingAnalytics(
  rawRows: RawReadingSessionWithBook[],
  referenceDate: Date = new Date()
): ReadingAnalyticsSummary {
  if (!rawRows || rawRows.length === 0) {
    return {
      totalSessions: 0,
      totalPagesRead: 0,
      totalMinutesRead: 0,
      recentWpm: 0,
      allTimeWpm: 0,
      accelerationPercent: 0,
      categories: [],
      dailyTrend: generateEmptyDailyTrend(referenceDate),
      sessions: []
    };
  }

  // 1. Seansları zenginleştir
  const enriched: EnrichedReadingSession[] = rawRows.map(row => {
    const wpp = (row.words_per_page !== null && row.words_per_page !== undefined && row.words_per_page > 0)
      ? row.words_per_page
      : 250;
    const wpm = calculateSessionWpm(row.pages_read, row.duration_minutes, wpp);

    return {
      sessionId: row.session_id,
      bookId: row.book_id,
      bookTitle: row.book_title ?? 'Bilinmeyen Kitap',
      bookAuthor: row.book_author ?? 'Bilinmeyen Yazar',
      category: row.book_category ?? 'Kişisel Gelişim',
      pagesRead: row.pages_read ?? 0,
      durationMinutes: Math.round((row.duration_minutes ?? 0) * 10) / 10,
      sessionDate: row.session_date ?? row.created_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      createdAt: row.created_at ?? row.session_date ?? new Date().toISOString(),
      wpm,
      wordsPerPage: wpp
    };
  });

  // Tarihe göre sırala: Yeniden eskiye (En son kaydedilen seans en başta - Liste için)
  enriched.sort((a, b) => {
    const timeA = new Date(a.createdAt || a.sessionDate).getTime();
    const timeB = new Date(b.createdAt || b.sessionDate).getTime();
    if (timeB !== timeA) return timeB - timeA;
    return b.sessionId.localeCompare(a.sessionId);
  });

  const totalSessions = enriched.length;
  const totalPagesRead = enriched.reduce((sum, s) => sum + s.pagesRead, 0);
  const totalMinutesRead = Math.round(enriched.reduce((sum, s) => sum + s.durationMinutes, 0) * 10) / 10;

  // Tüm Zamanlar Ortalama WPM
  const allTimeWpm = totalSessions > 0
    ? Math.round(enriched.reduce((sum, s) => sum + s.wpm, 0) / totalSessions)
    : 0;

  // Son 7 Seans Hareketli Ortalama WPM
  const recentSlice = enriched.slice(0, 7);
  const recentWpm = recentSlice.length > 0
    ? Math.round(recentSlice.reduce((sum, s) => sum + s.wpm, 0) / recentSlice.length)
    : 0;

  // Hızlanma Yüzdesi: ((Son 5 seans ort. WPM - İlk 5 seans ort. WPM) / İlk 5 seans ort.) * 100
  // Kronolojik sıralama: eskiden yeniye (Zaman serisi ve grafik için)
  const chronological = [...enriched].sort((a, b) => {
    const timeA = new Date(a.createdAt || a.sessionDate).getTime();
    const timeB = new Date(b.createdAt || b.sessionDate).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return a.sessionId.localeCompare(b.sessionId);
  });
  let accelerationPercent = 0;

  if (chronological.length >= 2) {
    const sampleSize = Math.min(5, Math.floor(chronological.length / 2) || 1);
    const firstSlice = chronological.slice(0, sampleSize);
    const lastSlice = chronological.slice(-sampleSize);

    const firstAvg = firstSlice.reduce((sum, s) => sum + s.wpm, 0) / firstSlice.length;
    const lastAvg = lastSlice.reduce((sum, s) => sum + s.wpm, 0) / lastSlice.length;

    if (firstAvg > 0) {
      accelerationPercent = Math.round(((lastAvg - firstAvg) / firstAvg) * 100);
    }
  }

  // Kategori Bazında Hız Analitiği
  const categoryMap = new Map<string, { totalWpm: number; count: number; totalPages: number; totalMinutes: number }>();

  for (const s of enriched) {
    const cat = s.category || 'Genel';
    const existing = categoryMap.get(cat) || { totalWpm: 0, count: 0, totalPages: 0, totalMinutes: 0 };
    existing.totalWpm += s.wpm;
    existing.count += 1;
    existing.totalPages += s.pagesRead;
    existing.totalMinutes += s.durationMinutes;
    categoryMap.set(cat, existing);
  }

  const categories: CategoryWpmMetric[] = Array.from(categoryMap.entries()).map(([cat, val]) => ({
    category: cat,
    avgWpm: Math.round(val.totalWpm / val.count),
    totalPages: val.totalPages,
    totalMinutes: Math.round(val.totalMinutes * 10) / 10,
    sessionCount: val.count
  })).sort((a, b) => b.totalPages - a.totalPages);

  // Son 30 Günlük Zaman Serisi (Gün Gün Sayfa, Dakika ve WPM)
  const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const dailyTrend: DailyReadingMetric[] = [];

  for (let i = 29; i >= 0; i--) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayLabel = `${d.getDate()} ${monthNames[d.getMonth()]}`;

    const daySessions = enriched.filter(s => s.sessionDate.slice(0, 10) === dateStr);
    const pages = daySessions.reduce((sum, s) => sum + s.pagesRead, 0);
    const minutes = Math.round(daySessions.reduce((sum, s) => sum + s.durationMinutes, 0) * 10) / 10;
    const dayAvgWpm = daySessions.length > 0
      ? Math.round(daySessions.reduce((sum, s) => sum + s.wpm, 0) / daySessions.length)
      : 0;

    dailyTrend.push({
      date: dateStr,
      dayLabel,
      pagesRead: pages,
      durationMinutes: minutes,
      avgWpm: dayAvgWpm,
      sessionCount: daySessions.length
    });
  }

  return {
    totalSessions,
    totalPagesRead,
    totalMinutesRead,
    recentWpm,
    allTimeWpm,
    accelerationPercent,
    categories,
    dailyTrend,
    sessions: enriched
  };
}

function generateEmptyDailyTrend(referenceDate: Date): DailyReadingMetric[] {
  const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const daily: DailyReadingMetric[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() - i);
    daily.push({
      date: d.toISOString().slice(0, 10),
      dayLabel: `${d.getDate()} ${monthNames[d.getMonth()]}`,
      pagesRead: 0,
      durationMinutes: 0,
      avgWpm: 0,
      sessionCount: 0
    });
  }
  return daily;
}
