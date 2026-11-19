import { describe, it, expect } from 'vitest';
import {
  parseTimeToMinutes,
  formatMinutesToDuration,
  detectTimeBlockConflicts,
  computeTimeBlocksSummary,
  getTurkeyWeekDates,
  TimeBlockItem,
} from '@/lib/time-blocks-engine';
import {
  VISION_PILLARS,
  calculateKeyResultProgress,
  calculateObjectiveProgress,
  summarizeOkrConfidence,
  getDefaultOkrPeriod,
  OkrObjectiveItem,
} from '@/lib/okr-engine';

describe('Time Blocks Engine (Faz 3)', () => {
  it('parses valid HH:mm strings and rejects invalid ones', () => {
    expect(parseTimeToMinutes('00:00')).toBe(0);
    expect(parseTimeToMinutes('09:30')).toBe(570);
    expect(parseTimeToMinutes('23:59')).toBe(1439);
    expect(parseTimeToMinutes('24:00')).toBe(-1);
    expect(parseTimeToMinutes('10:60')).toBe(-1);
    expect(parseTimeToMinutes('invalid')).toBe(-1);
  });

  it('formats durations cleanly in Turkish', () => {
    expect(formatMinutesToDuration(45)).toBe('45dk');
    expect(formatMinutesToDuration(120)).toBe('2s');
    expect(formatMinutesToDuration(90)).toBe('1s 30dk');
  });

  it('detects overlapping blocks on the same date without false positives on touching boundaries', () => {
    const base: Omit<TimeBlockItem, 'id' | 'date' | 'start_time' | 'end_time'> = {
      user_id: 'u1',
      title: 'Test',
      category: 'deep_work',
      color: '#3B82F6',
      is_completed: 0,
      is_family_shared: 0,
    };

    const blocks: TimeBlockItem[] = [
      { ...base, id: 'b1', date: '2026-11-19', start_time: '09:00', end_time: '10:30' },
      { ...base, id: 'b2', date: '2026-11-19', start_time: '10:00', end_time: '11:00' }, // overlaps b1
      { ...base, id: 'b3', date: '2026-11-19', start_time: '11:00', end_time: '12:00' }, // touches b2, no overlap
      { ...base, id: 'b4', date: '2026-11-20', start_time: '09:00', end_time: '10:30' }, // different day
    ];

    const conflicts = detectTimeBlockConflicts(blocks);
    expect(conflicts.has('b1')).toBe(true);
    expect(conflicts.has('b2')).toBe(true);
    expect(conflicts.has('b3')).toBe(false);
    expect(conflicts.has('b4')).toBe(false);
  });

  it('computes summary metrics accurately', () => {
    const blocks: TimeBlockItem[] = [
      {
        id: '1',
        user_id: 'u1',
        title: 'A',
        category: 'deep_work',
        date: '2026-11-19',
        start_time: '09:00',
        end_time: '10:00',
        color: '#3B82F6',
        is_completed: 1,
        is_family_shared: 0,
      },
      {
        id: '2',
        user_id: 'u1',
        title: 'B',
        category: 'reading',
        date: '2026-11-19',
        start_time: '14:00',
        end_time: '14:30',
        color: '#F59E0B',
        is_completed: 0,
        is_family_shared: 0,
      },
    ];

    const summary = computeTimeBlocksSummary(blocks);
    expect(summary.totalBlocks).toBe(2);
    expect(summary.completedBlocks).toBe(1);
    expect(summary.totalMinutes).toBe(90);
    expect(summary.completedMinutes).toBe(60);
    expect(summary.completionRate).toBe(50);
    expect(summary.conflictCount).toBe(0);
  });

  it('returns Monday..Sunday Turkey week dates for any anchor date', () => {
    // 2026-11-19 is Thursday
    const week = getTurkeyWeekDates('2026-11-19');
    expect(week).toHaveLength(7);
    expect(week[0]).toBe('2026-11-16'); // Monday
    expect(week[6]).toBe('2026-11-22'); // Sunday

    // Sunday anchor should still return the same Mon..Sun week
    const sundayWeek = getTurkeyWeekDates('2026-11-22');
    expect(sundayWeek[0]).toBe('2026-11-16');
    expect(sundayWeek[6]).toBe('2026-11-22');
  });
});

describe('OKR Engine (Faz 3)', () => {
  it('defines 6 vision pillars and maps quarter periods', () => {
    expect(VISION_PILLARS).toHaveLength(6);
    expect(getDefaultOkrPeriod('2026-02-15')).toBe('2026-Q1');
    expect(getDefaultOkrPeriod('2026-05-01')).toBe('2026-Q2');
    expect(getDefaultOkrPeriod('2026-08-10')).toBe('2026-Q3');
    expect(getDefaultOkrPeriod('2026-11-19')).toBe('2026-Q4');
  });

  it('calculates Key Result progress for numeric, decreasing, boolean, and clamped targets', () => {
    expect(
      calculateKeyResultProgress({
        kr_type: 'numeric',
        start_value: 0,
        target_value: 20,
        current_value: 10,
      })
    ).toBe(50);

    // Decreasing target (e.g. body weight 85 -> 75, currently 80)
    expect(
      calculateKeyResultProgress({
        kr_type: 'numeric',
        start_value: 85,
        target_value: 75,
        current_value: 80,
      })
    ).toBe(50);

    // Over-achieved is clamped to 100
    expect(
      calculateKeyResultProgress({
        kr_type: 'numeric',
        start_value: 0,
        target_value: 10,
        current_value: 15,
      })
    ).toBe(100);

    // Boolean
    expect(
      calculateKeyResultProgress({
        kr_type: 'boolean',
        start_value: 0,
        target_value: 1,
        current_value: 1,
      })
    ).toBe(100);
    expect(
      calculateKeyResultProgress({
        kr_type: 'boolean',
        start_value: 0,
        target_value: 1,
        current_value: 0,
      })
    ).toBe(0);
  });

  it('calculates weighted Objective progress and summarizes confidence', () => {
    const objectives: OkrObjectiveItem[] = [
      {
        id: 'obj1',
        user_id: 'u1',
        pillar_id: 'pillar_career',
        period: '2026-Q4',
        title: 'Launch V2',
        status: 'in_progress',
        confidence: 'on_track',
        is_family_shared: 0,
        keyResults: [
          {
            id: 'kr1',
            objective_id: 'obj1',
            user_id: 'u1',
            title: 'Ship modules',
            kr_type: 'numeric',
            start_value: 0,
            target_value: 10,
            current_value: 10,
            unit: 'adet',
            weight: 2,
            confidence: 'on_track',
          },
          {
            id: 'kr2',
            objective_id: 'obj1',
            user_id: 'u1',
            title: 'Write docs',
            kr_type: 'numeric',
            start_value: 0,
            target_value: 10,
            current_value: 5,
            unit: 'adet',
            weight: 1,
            confidence: 'needs_attention',
          },
        ],
      },
    ];

    // (100*2 + 50*1) / 3 = 83.33 -> 83
    expect(calculateObjectiveProgress(objectives[0].keyResults ?? [])).toBe(83);
    const summary = summarizeOkrConfidence(objectives);
    expect(summary.totalObjectives).toBe(1);
    expect(summary.averageProgress).toBe(83);
    expect(summary.onTrackCount).toBe(1);
  });
});
