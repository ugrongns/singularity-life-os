export type OkrConfidence = 'on_track' | 'needs_attention' | 'at_risk';
export type OkrStatus = 'in_progress' | 'completed' | 'postponed' | 'abandoned';
export type OkrKrType = 'numeric' | 'percentage' | 'currency' | 'boolean';

export interface VisionPillar {
  id: string;
  label: string;
  emoji: string;
  color: string;
  description: string;
}

export const VISION_PILLARS: VisionPillar[] = [
  {
    id: 'pillar_health',
    label: 'Sağlık & Zindelik',
    emoji: '💪',
    color: '#10B981',
    description: 'Fiziksel enerji, uyku, beslenme ve spor rutini',
  },
  {
    id: 'pillar_career',
    label: 'Kariyer & Üretim',
    emoji: '🚀',
    color: '#3B82F6',
    description: 'Mesleki gelişim, derin odak ve projeler',
  },
  {
    id: 'pillar_finance',
    label: 'Finans & Birikim',
    emoji: '💎',
    color: '#F59E0B',
    description: 'Gelir, bütçe disiplini ve birikim hedefleri',
  },
  {
    id: 'pillar_learning',
    label: 'Öğrenme & Kültür',
    emoji: '📚',
    color: '#8B5CF6',
    description: 'Kitap okuma, yeni beceriler ve entelektüel derinlik',
  },
  {
    id: 'pillar_family',
    label: 'Aile & İlişkiler',
    emoji: '👨‍👩‍👧',
    color: '#EC4899',
    description: 'Aile bağları, kaliteli zaman ve ortak hedefler',
  },
  {
    id: 'pillar_mental',
    label: 'Zihin & Denge',
    emoji: '🧘',
    color: '#06B6D4',
    description: 'İç huzur, alışkanlık tutarlılığı ve farkındalık',
  },
];

export interface OkrPeriodOption {
  id: string;
  label: string;
}

export const OKR_PERIODS: OkrPeriodOption[] = [
  { id: '2026-Q1', label: '2026 Q1 (Oca-Mar)' },
  { id: '2026-Q2', label: '2026 Q2 (Nis-Haz)' },
  { id: '2026-Q3', label: '2026 Q3 (Tem-Eyl)' },
  { id: '2026-Q4', label: '2026 Q4 (Eki-Ara)' },
  { id: '2026-annual', label: '2026 Yıllık' },
  { id: '2027-Q1', label: '2027 Q1 (Oca-Mar)' },
  { id: '2027-annual', label: '2027 Yıllık' },
];

export const OKR_CONFIDENCE_META: Record<
  OkrConfidence,
  { label: string; color: string; bgClass: string }
> = {
  on_track: {
    label: 'Yolunda',
    color: '#10B981',
    bgClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
  needs_attention: {
    label: 'Dikkat Gerekiyor',
    color: '#F59E0B',
    bgClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
  at_risk: {
    label: 'Risk Altında',
    color: '#EF4444',
    bgClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  },
};

export const OKR_STATUS_META: Record<OkrStatus, { label: string }> = {
  in_progress: { label: 'Devam Ediyor' },
  completed: { label: 'Tamamlandı' },
  postponed: { label: 'Ertelendi' },
  abandoned: { label: 'Vazgeçildi' },
};

export interface OkrKeyResultItem {
  id: string;
  objective_id: string;
  user_id: string;
  title: string;
  kr_type: string;
  start_value: number;
  target_value: number;
  current_value: number;
  unit: string;
  weight: number;
  confidence: string;
  linked_module?: string | null;
  linked_ref_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface OkrObjectiveItem {
  id: string;
  user_id: string;
  family_id?: string | null;
  pillar_id: string;
  period: string;
  title: string;
  description?: string | null;
  status: string;
  confidence: string;
  is_family_shared: number;
  created_at?: string;
  updated_at?: string;
  keyResults?: OkrKeyResultItem[];
}

export interface OkrCheckInItem {
  id: string;
  key_result_id: string;
  user_id: string;
  previous_value: number;
  new_value: number;
  confidence: string;
  note?: string | null;
  check_in_date: string;
  created_at: string;
}

/**
 * Returns the default OKR quarter period for a given YYYY-MM-DD Turkey date.
 */
export function getDefaultOkrPeriod(todayDateStr: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(todayDateStr || '');
  if (!match) return '2026-Q4';
  const year = match[1];
  const month = Number(match[2]);
  const quarter = Math.min(4, Math.max(1, Math.ceil(month / 3)));
  const candidate = `${year}-Q${quarter}`;
  return OKR_PERIODS.some((p) => p.id === candidate) ? candidate : '2026-Q4';
}

/**
 * Returns metadata for a vision pillar, falling back to the career pillar.
 */
export function getVisionPillarMeta(pillarId: string): VisionPillar {
  return VISION_PILLARS.find((p) => p.id === pillarId) ?? VISION_PILLARS[1];
}

/**
 * Calculates clamped 0-100 progress for a single Key Result.
 */
export function calculateKeyResultProgress(
  kr: Pick<OkrKeyResultItem, 'kr_type' | 'start_value' | 'target_value' | 'current_value'>
): number {
  if (kr.kr_type === 'boolean') {
    return kr.current_value >= 1 ? 100 : 0;
  }

  const start = Number(kr.start_value) || 0;
  const target = Number(kr.target_value) || 0;
  const current = Number(kr.current_value) || 0;

  if (target === start) {
    return current >= target ? 100 : 0;
  }

  const raw = ((current - start) / (target - start)) * 100;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

/**
 * Calculates weighted average progress (0-100) across an objective's Key Results.
 */
export function calculateObjectiveProgress(
  keyResults: Array<
    Pick<
      OkrKeyResultItem,
      'kr_type' | 'start_value' | 'target_value' | 'current_value' | 'weight'
    >
  >
): number {
  if (!keyResults || keyResults.length === 0) return 0;

  let totalWeight = 0;
  let weightedSum = 0;

  for (const kr of keyResults) {
    const w = Number(kr.weight) > 0 ? Number(kr.weight) : 1;
    totalWeight += w;
    weightedSum += calculateKeyResultProgress(kr) * w;
  }

  if (totalWeight <= 0) return 0;
  return Math.round(weightedSum / totalWeight);
}

/**
 * Summarizes overall OKR progress and confidence breakdown across objectives.
 */
export function summarizeOkrConfidence(objectives: OkrObjectiveItem[]): {
  totalObjectives: number;
  completedObjectives: number;
  averageProgress: number;
  onTrackCount: number;
  needsAttentionCount: number;
  atRiskCount: number;
} {
  let completedObjectives = 0;
  let progressSum = 0;
  let onTrackCount = 0;
  let needsAttentionCount = 0;
  let atRiskCount = 0;

  for (const obj of objectives) {
    if (obj.status === 'completed') completedObjectives += 1;
    progressSum += calculateObjectiveProgress(obj.keyResults ?? []);
    if (obj.confidence === 'on_track') onTrackCount += 1;
    else if (obj.confidence === 'needs_attention') needsAttentionCount += 1;
    else if (obj.confidence === 'at_risk') atRiskCount += 1;
  }

  const totalObjectives = objectives.length;
  const averageProgress =
    totalObjectives > 0 ? Math.round(progressSum / totalObjectives) : 0;

  return {
    totalObjectives,
    completedObjectives,
    averageProgress,
    onTrackCount,
    needsAttentionCount,
    atRiskCount,
  };
}
