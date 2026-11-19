import { parseTurkeyDate, shiftTurkeyDate } from '@/lib/date-utils';

export type TimeBlockCategory =
  | 'deep_work'
  | 'meeting'
  | 'health'
  | 'reading'
  | 'family'
  | 'personal'
  | 'break';

export interface TimeBlockCategoryMeta {
  id: TimeBlockCategory;
  label: string;
  color: string;
  emoji: string;
}

export const TIME_BLOCK_CATEGORIES: TimeBlockCategoryMeta[] = [
  { id: 'deep_work', label: 'Derin Odak', color: '#3B82F6', emoji: '🎯' },
  { id: 'meeting', label: 'Toplantı', color: '#8B5CF6', emoji: '🤝' },
  { id: 'health', label: 'Sağlık & Spor', color: '#10B981', emoji: '💪' },
  { id: 'reading', label: 'Okuma & Öğrenme', color: '#F59E0B', emoji: '📚' },
  { id: 'family', label: 'Aile & Sosyal', color: '#EC4899', emoji: '👨‍👩‍👧' },
  { id: 'personal', label: 'Kişisel', color: '#06B6D4', emoji: '🌿' },
  { id: 'break', label: 'Mola & Dinlenme', color: '#64748B', emoji: '☕' },
];

export interface TimeBlockItem {
  id: string;
  user_id: string;
  family_id?: string | null;
  title: string;
  category: string;
  date: string;
  start_time: string;
  end_time: string;
  color: string;
  is_completed: number;
  is_family_shared: number;
  linked_task_id?: string | null;
  linked_book_id?: string | null;
  linked_habit_id?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TimeBlocksSummary {
  totalBlocks: number;
  completedBlocks: number;
  totalMinutes: number;
  completedMinutes: number;
  conflictCount: number;
  completionRate: number;
}

/**
 * Parses an HH:mm string into minutes since 00:00.
 * Returns -1 if the format or range is invalid.
 */
export function parseTimeToMinutes(hhmm: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec((hhmm || '').trim());
  if (!match) return -1;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return -1;
  return hours * 60 + minutes;
}

/**
 * Formats a minute duration into a concise Turkish label (e.g. "1s 30dk").
 */
export function formatMinutesToDuration(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h === 0) return `${m}dk`;
  if (m === 0) return `${h}s`;
  return `${h}s ${m}dk`;
}

/**
 * Returns the category metadata for a given category key, defaulting to deep_work.
 */
export function getTimeBlockCategoryMeta(category: string): TimeBlockCategoryMeta {
  return (
    TIME_BLOCK_CATEGORIES.find((c) => c.id === category) ?? TIME_BLOCK_CATEGORIES[0]
  );
}

/**
 * Detects overlapping time blocks on the same date and returns a Set of conflicting block IDs.
 */
export function detectTimeBlockConflicts(blocks: TimeBlockItem[]): Set<string> {
  const conflicts = new Set<string>();
  const byDate = new Map<string, Array<{ id: string; start: number; end: number }>>();

  for (const block of blocks) {
    const start = parseTimeToMinutes(block.start_time);
    const end = parseTimeToMinutes(block.end_time);
    if (start < 0 || end <= start) continue;

    const list = byDate.get(block.date) ?? [];
    list.push({ id: block.id, start, end });
    byDate.set(block.date, list);
  }

  for (const dayBlocks of byDate.values()) {
    const sorted = [...dayBlocks].sort((a, b) => a.start - b.start);
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (sorted[j].start < sorted[i].end) {
          conflicts.add(sorted[i].id);
          conflicts.add(sorted[j].id);
        } else {
          break;
        }
      }
    }
  }

  return conflicts;
}

/**
 * Computes summary metrics for a list of time blocks.
 */
export function computeTimeBlocksSummary(blocks: TimeBlockItem[]): TimeBlocksSummary {
  const conflicts = detectTimeBlockConflicts(blocks);
  let totalMinutes = 0;
  let completedMinutes = 0;
  let completedBlocks = 0;

  for (const block of blocks) {
    const start = parseTimeToMinutes(block.start_time);
    const end = parseTimeToMinutes(block.end_time);
    const duration = start >= 0 && end > start ? end - start : 0;
    totalMinutes += duration;
    if (block.is_completed === 1) {
      completedBlocks += 1;
      completedMinutes += duration;
    }
  }

  const totalBlocks = blocks.length;
  const completionRate =
    totalBlocks > 0 ? Math.round((completedBlocks / totalBlocks) * 100) : 0;

  return {
    totalBlocks,
    completedBlocks,
    totalMinutes,
    completedMinutes,
    conflictCount: conflicts.size,
    completionRate,
  };
}

/**
 * Returns the 7 YYYY-MM-DD dates (Monday..Sunday) for the Turkey week containing anchorDate.
 */
export function getTurkeyWeekDates(anchorDate: string): string[] {
  const dateObj = parseTurkeyDate(anchorDate);
  const jsDay = dateObj.getUTCDay(); // 0=Sun, 1=Mon..6=Sat
  const offsetFromMonday = jsDay === 0 ? -6 : 1 - jsDay;
  const monday = shiftTurkeyDate(anchorDate, offsetFromMonday);
  return Array.from({ length: 7 }, (_, idx) => shiftTurkeyDate(monday, idx));
}
