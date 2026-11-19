import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import {
  parseTimeToMinutes,
  formatMinutesToDuration,
  formatMinutesToTime,
  detectTimeBlockConflicts,
  computeTimeBlocksSummary,
  findNextAvailableSlot,
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

const {
  mockSelect,
  mockUpdate,
  mockDelete,
  mockInsert,
  mockGetAuthUser,
} = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockInsert: vi.fn(),
  mockGetAuthUser: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    select: (...args: any[]) => mockSelect(...args),
    update: (...args: any[]) => mockUpdate(...args),
    delete: (...args: any[]) => mockDelete(...args),
    insert: (...args: any[]) => mockInsert(...args),
  },
  initDatabase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/auth', () => ({
  getAuthUser: mockGetAuthUser,
}));

import { GET as getTimeBlocks, POST as postTimeBlocks } from '@/app/api/time-blocks/route';

function createSelectChain(data: any[]) {
  const obj: any = {};
  obj.from = vi.fn(() => obj);
  obj.where = vi.fn(() => obj);
  obj.orderBy = vi.fn(() => obj);
  obj.limit = vi.fn(() => Promise.resolve(data));
  obj.then = (onFulfilled: any, onRejected?: any) =>
    Promise.resolve(data).then(onFulfilled, onRejected);
  return obj;
}

function createInsertChain() {
  const obj: any = { lastValues: null };
  obj.values = vi.fn((vals: any) => {
    obj.lastValues = vals;
    return Promise.resolve([vals]);
  });
  return obj;
}

function createUpdateChain() {
  const obj: any = { lastSet: null };
  obj.set = vi.fn((vals: any) => {
    obj.lastSet = vals;
    return obj;
  });
  obj.where = vi.fn(() => Promise.resolve([]));
  return obj;
}

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

  it('finds conflict-free next available slots cleanly with 15-minute stepping', () => {
    expect(formatMinutesToTime(0)).toBe('00:00');
    expect(formatMinutesToTime(570)).toBe('09:30');
    expect(formatMinutesToTime(1439)).toBe('23:59');

    // Preferred slot free -> returns directly without shifting
    const free = findNextAvailableSlot([], '10:00', 60);
    expect(free).toEqual({ start_time: '10:00', end_time: '11:00', shifted: false });

    // Preferred slot 10:00-11:00 occupied -> shifts to 11:00-12:00
    const shifted = findNextAvailableSlot(
      [{ start_time: '10:00', end_time: '11:00' }],
      '10:00',
      60
    );
    expect(shifted).toEqual({ start_time: '11:00', end_time: '12:00', shifted: true });

    // Multiple blocks with only a 30-min gap between 11:00-11:30; needs 45 min -> jumps past 12:30
    const gapSkip = findNextAvailableSlot(
      [
        { start_time: '10:00', end_time: '11:00' },
        { start_time: '11:30', end_time: '12:30' },
      ],
      '10:00',
      45
    );
    expect(gapSkip).toEqual({ start_time: '12:30', end_time: '13:15', shifted: true });
  });
});

describe('Time Blocks API & Middleware Security Audit (/calendar & /api/time-blocks)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockReturnValue(createInsertChain());
    mockUpdate.mockReturnValue(createUpdateChain());
  });

  it('middleware.ts matcher includes /calendar, /habits, /notes, and /okr protected routes', () => {
    const middlewareSrc = fs.readFileSync(
      path.resolve(__dirname, '../../middleware.ts'),
      'utf8'
    );
    expect(middlewareSrc).toContain("'/calendar/:path*'");
    expect(middlewareSrc).toContain("'/habits/:path*'");
    expect(middlewareSrc).toContain("'/notes/:path*'");
    expect(middlewareSrc).toContain("'/okr/:path*'");
  });

  it('GET and POST /api/time-blocks return 401 when unauthenticated', async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const getRes = await getTimeBlocks(
      new NextRequest('http://localhost:3000/api/time-blocks')
    );
    expect(getRes.status).toBe(401);

    const postRes = await postTimeBlocks(
      new NextRequest('http://localhost:3000/api/time-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', title: 'X' }),
      })
    );
    expect(postRes.status).toBe(401);
  });

  it('rejects foreign/unauthorized linked_task_id, linked_book_id, or linked_habit_id with 403 (BOLA shield)', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'usr-1', family_id: 'fam-1' });
    mockSelect.mockReturnValueOnce(createSelectChain([])); // Foreign task not visible

    const resTask = await postTimeBlocks(
      new NextRequest('http://localhost:3000/api/time-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          title: 'Foreign Task Block',
          date: '2026-11-19',
          start_time: '09:00',
          end_time: '10:00',
          linked_task_id: 'task-foreign-999',
        }),
      })
    );
    expect(resTask.status).toBe(403);

    mockSelect.mockReturnValueOnce(createSelectChain([])); // Foreign habit not owned
    const resHabit = await postTimeBlocks(
      new NextRequest('http://localhost:3000/api/time-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          title: 'Foreign Habit Block',
          date: '2026-11-19',
          start_time: '08:00',
          end_time: '08:30',
          linked_habit_id: 'hab-foreign-999',
        }),
      })
    );
    expect(resHabit.status).toBe(403);
  });

  it('validates schedule_from_task, schedule_from_book, and schedule_from_habit time ranges and ownership', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'usr-1', family_id: 'fam-1' });

    // Invalid time range (end <= start) -> 400
    const badTimeRes = await postTimeBlocks(
      new NextRequest('http://localhost:3000/api/time-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'schedule_from_task',
          task_id: 'task-1',
          date: '2026-11-19',
          start_time: '15:00',
          end_time: '14:00',
        }),
      })
    );
    expect(badTimeRes.status).toBe(400);

    // Valid schedule_from_habit with owned habit -> 200
    mockSelect
      .mockReturnValueOnce(
        createSelectChain([
          { id: 'hab-1', user_id: 'usr-1', title: 'Sabah Meditasyonu', color: '#10B981' },
        ])
      )
      .mockReturnValueOnce(createSelectChain([])); // dayBlocks for resolveQuickScheduleSlot
    const habitRes = await postTimeBlocks(
      new NextRequest('http://localhost:3000/api/time-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'schedule_from_habit',
          habit_id: 'hab-1',
          date: '2026-11-19',
          start_time: '08:00',
          end_time: '08:30',
        }),
      })
    );
    const habitJson = await habitRes.json();
    expect(habitRes.status).toBe(200);
    expect(habitJson.success).toBe(true);
    expect(habitJson.data.linked_habit_id).toBe('hab-1');
    expect(habitJson.data.title).toBe('Rutin: Sabah Meditasyonu');
  });

  it('allows updating linked_task_id on action: update and blocks foreign linked_task_id with 403', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'usr-1', family_id: 'fam-1' });
    const existingBlock = {
      id: 'blk-1',
      user_id: 'usr-1',
      family_id: null,
      title: 'Odak',
      category: 'deep_work',
      date: '2026-11-19',
      start_time: '09:00',
      end_time: '10:00',
      color: '#3B82F6',
      is_completed: 0,
      is_family_shared: 0,
      linked_task_id: null,
      linked_book_id: null,
      linked_habit_id: null,
      notes: null,
    };

    // 1. Foreign task link -> 403
    mockSelect
      .mockReturnValueOnce(createSelectChain([existingBlock]))
      .mockReturnValueOnce(createSelectChain([]));
    const foreignRes = await postTimeBlocks(
      new NextRequest('http://localhost:3000/api/time-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          id: 'blk-1',
          linked_task_id: 'task-foreign',
        }),
      })
    );
    expect(foreignRes.status).toBe(403);

    // 2. Owned task link -> 200 and persisted
    mockSelect
      .mockReturnValueOnce(createSelectChain([existingBlock]))
      .mockReturnValueOnce(createSelectChain([{ id: 'task-owned' }]));
    const okRes = await postTimeBlocks(
      new NextRequest('http://localhost:3000/api/time-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          id: 'blk-1',
          linked_task_id: 'task-owned',
        }),
      })
    );
    const okJson = await okRes.json();
    expect(okRes.status).toBe(200);
    expect(okJson.data.linked_task_id).toBe('task-owned');
  });

  it('enriches GET /api/time-blocks rows with owner_name and owner_avatar for shared blocks', async () => {
    mockGetAuthUser.mockResolvedValue({
      id: 'usr-1',
      family_id: 'fam-1',
      full_name: 'Uğur',
      avatar_emoji: '👨‍💻',
    });

    mockSelect
      .mockReturnValueOnce(
        createSelectChain([
          {
            id: 'blk-shared',
            user_id: 'usr-2',
            family_id: 'fam-1',
            title: 'Aile Yemeği',
            category: 'family',
            date: '2026-11-19',
            start_time: '19:00',
            end_time: '20:30',
            color: '#EC4899',
            is_completed: 0,
            is_family_shared: 1,
          },
        ])
      )
      .mockReturnValueOnce(createSelectChain([])) // tasks
      .mockReturnValueOnce(createSelectChain([])) // books
      .mockReturnValueOnce(createSelectChain([])) // habits
      .mockReturnValueOnce(
        createSelectChain([
          { id: 'usr-2', full_name: 'Ayşe', username: 'ayse', avatar_emoji: '👩' },
        ])
      ) // users
      .mockReturnValueOnce(createSelectChain([])); // familyMembers

    const res = await getTimeBlocks(
      new NextRequest('http://localhost:3000/api/time-blocks?from=2026-11-19&to=2026-11-19')
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.blocks[0].owner_name).toBe('Ayşe');
    expect(json.data.blocks[0].owner_avatar).toBe('👩');
  });

  it('filters completed tasks using ne(tasks.status, "completed") in GET /api/time-blocks', () => {
    const routeSrc = fs.readFileSync(
      path.resolve(__dirname, '../../app/api/time-blocks/route.ts'),
      'utf8'
    );
    expect(routeSrc).toContain("ne(tasks.status, 'completed')");
    expect(routeSrc).not.toContain("ne(tasks.status, 'done')");
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
