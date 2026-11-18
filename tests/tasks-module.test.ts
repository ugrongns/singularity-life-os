import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { PgDialect } from 'drizzle-orm/pg-core';
import { GET as getTasks, POST as postTasks } from '../src/app/api/tasks/route';
import { GET as getAnalytics } from '../src/app/api/analytics/route';
import { POST as postVoiceCommand } from '../src/app/api/voice-command/route';
import { POST as postTelegram } from '../src/app/api/telegram/route';
import { POST as postResetUserData } from '../src/app/api/auth/reset-user-data/route';
import { POST as postDeleteAccount } from '../src/app/api/auth/delete-account/route';
import { middleware, config as middlewareConfig } from '../src/middleware';
import { getAuthUser } from '../src/lib/auth';
import { eventBus, EVENTS } from '../src/lib/events';
import { tasks, walletsAccounts, vehicles, digitalVaultItems } from '../src/db/schema';
import {
  parseSubtasks,
  calculateSubtaskProgress,
  calculateNextRecurrenceDate,
  resolveSubtaskDrivenStatus,
  toTurkeyDay,
  isTodayMitTask,
  summarizeTodayMit,
  validateMitConstraint,
  filterTasksByView,
  filterTasksByDate,
  filterTasksByScope,
  filterCrossModuleActionsByScope,
  computeTaskTabCounts,
  sortTasksForDisplay,
  formatTaskScheduleLabel,
  describeMitFeedItem,
  getOverdueTasks,
  buildMaterializedRecurrenceDraft,
  normalizeFocusDurationMinutes,
  computeFocusElapsedMinutes,
  computeFocusCountdown,
  formatFocusDurationSummary,
  resolveCrossModuleFollowUp,
  scalePillarTo20,
  calculateTasksFocusScoreBreakdown,
  projectVirtualRecurrences,
  buildTaskCalendarMonth,
  generateCrossModuleActionItems,
  TaskItem,
  CrossModuleAction,
  VirtualRecurrenceItem,
  Subtask
} from '../src/lib/tasks-engine';
import { diffTurkeyCalendarDays, parseTurkeyCalendarDate } from '../src/lib/date-utils';

// Mock DB and Auth
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockTransaction = vi.fn();

vi.mock('@/db', () => ({
  db: {
    select: (...args: any[]) => mockSelect(...args),
    insert: (...args: any[]) => mockInsert(...args),
    update: (...args: any[]) => mockUpdate(...args),
    delete: (...args: any[]) => mockDelete(...args),
    transaction: (...args: any[]) => mockTransaction(...args)
  },
  initDatabase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
  verifyPassword: vi.fn().mockResolvedValue(true),
  clearAuthSessionCache: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ delete: vi.fn() }),
}));

vi.mock('@/lib/market-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/market-data')>();
  return {
    ...actual,
    fetchLiveExchangeRates: vi.fn().mockResolvedValue({
      USD_TRY: 0,
      EUR_TRY: 0,
      GBP_TRY: 0,
      GOLD_GRAM_TRY: 0,
      GOLD_CEYREK_TRY: 0,
      BTC_TRY: 0,
      source: 'unavailable',
      lastUpdated: '2026-11-18T10:00:00Z'
    })
  };
});

function createSelectChain(data: any[]) {
  const obj: any = {};
  obj.from = vi.fn(() => obj);
  obj.leftJoin = vi.fn(() => obj);
  obj.where = vi.fn(() => obj);
  obj.orderBy = vi.fn(() => obj);
  obj.limit = vi.fn(() => Promise.resolve(data));
  obj.then = (onFulfilled: any, onRejected?: any) => Promise.resolve(data).then(onFulfilled, onRejected);
  return obj;
}

function createInsertChain(returningData: any[] = []) {
  const obj: any = {};
  obj.values = vi.fn(() => obj);
  obj.returning = vi.fn(() => Promise.resolve(returningData));
  obj.then = (onFulfilled: any, onRejected?: any) => Promise.resolve(returningData).then(onFulfilled, onRejected);
  return obj;
}

function createUpdateChain(returningData: any[] = []) {
  const obj: any = {};
  obj.set = vi.fn(() => obj);
  obj.where = vi.fn(() => obj);
  obj.returning = vi.fn(() => Promise.resolve(returningData));
  obj.then = (onFulfilled: any, onRejected?: any) => Promise.resolve(returningData).then(onFulfilled, onRejected);
  return obj;
}

function createDeleteChain() {
  const obj: any = {};
  obj.where = vi.fn(() => obj);
  obj.then = (onFulfilled: any, onRejected?: any) => Promise.resolve({ rowCount: 1 }).then(onFulfilled, onRejected);
  return obj;
}

describe('🎯 Singularity Faz 6: Görevler & Odak Motoru (/tasks) Test Paketi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Alt Görevler (Subtasks) & İlerleme Motoru', () => {
    it('Geçerli subtasks JSON dizesini hatasız nesne dizisine ayrıştırmalıdır', () => {
      const json = JSON.stringify([
        { id: 'sub-1', title: 'Belgeleri topla', is_completed: true },
        { id: 'sub-2', title: 'Randevu al', is_completed: false },
        { id: 'sub-3', title: '   ', is_completed: false }, // Boş başlık filtrelenmeli
      ]);

      const subtasks = parseSubtasks(json);
      expect(subtasks).toHaveLength(2);
      expect(subtasks[0]).toEqual({ id: 'sub-1', title: 'Belgeleri topla', is_completed: true });
      expect(subtasks[1]).toEqual({ id: 'sub-2', title: 'Randevu al', is_completed: false });
    });

    it('Geçersiz veya boş subtask girişlerinde boş dizi döndürmelidir', () => {
      expect(parseSubtasks(null)).toEqual([]);
      expect(parseSubtasks(undefined)).toEqual([]);
      expect(parseSubtasks('')).toEqual([]);
      expect(parseSubtasks('{ "invalid": true }')).toEqual([]);
      expect(parseSubtasks('not-a-json')).toEqual([]);
    });

    it('calculateSubtaskProgress doğru tamamlama oranını ve yüzdesini hesaplamalıdır', () => {
      const subtasks: Subtask[] = [
        { id: '1', title: 'A', is_completed: true },
        { id: '2', title: 'B', is_completed: true },
        { id: '3', title: 'C', is_completed: false },
        { id: '4', title: 'D', is_completed: false },
      ];

      const progress = calculateSubtaskProgress(subtasks);
      expect(progress.total).toBe(4);
      expect(progress.completed).toBe(2);
      expect(progress.percent).toBe(50);

      // Boş durum testi
      expect(calculateSubtaskProgress([])).toEqual({ total: 0, completed: 0, percent: 0 });
      expect(calculateSubtaskProgress(null)).toEqual({ total: 0, completed: 0, percent: 0 });
    });

    it('resolveSubtaskDrivenStatus: tüm adımlar tamamlanınca görevi tamamlamalı, adım geri alınınca yeniden açmalıdır', () => {
      const done: Subtask[] = [
        { id: '1', title: 'A', is_completed: true },
        { id: '2', title: 'B', is_completed: true },
      ];
      const partial: Subtask[] = [
        { id: '1', title: 'A', is_completed: true },
        { id: '2', title: 'B', is_completed: false },
      ];

      expect(resolveSubtaskDrivenStatus(done, 'pending')).toEqual({ nextStatus: 'completed', transition: 'completed' });
      expect(resolveSubtaskDrivenStatus(done, 'in_progress')).toEqual({ nextStatus: 'completed', transition: 'completed' });
      expect(resolveSubtaskDrivenStatus(done, 'completed')).toEqual({ nextStatus: 'completed', transition: 'none' });
      expect(resolveSubtaskDrivenStatus(partial, 'completed')).toEqual({ nextStatus: 'pending', transition: 'reopened' });
      expect(resolveSubtaskDrivenStatus(partial, 'pending')).toEqual({ nextStatus: 'pending', transition: 'none' });
      // Boş adım listesi görevi asla otomatik tamamlamamalı ([].every === true tuzağı)
      expect(resolveSubtaskDrivenStatus([], 'pending')).toEqual({ nextStatus: 'pending', transition: 'none' });
      expect(resolveSubtaskDrivenStatus([], null)).toEqual({ nextStatus: 'pending', transition: 'none' });
    });

    it('toggle_subtask API: son adım işaretlenince görevi tamamlamalı ve tekrarlayan görevde mükerrer kopya üretmemelidir', async () => {
      vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1', family_id: 'fam-1' } as any);
      const existingTask = {
        id: 'task-1', title: 'Rutin', status: 'pending', recurrence: 'daily', due_date: '2026-11-17',
        subtasks_json: JSON.stringify([
          { id: 's1', title: 'A', is_completed: true },
          { id: 's2', title: 'B', is_completed: false },
        ]),
        user_id: 'user-1', family_id: 'fam-1'
      };
      mockSelect
        .mockReturnValueOnce(createSelectChain([existingTask]))      // görev sorgusu
        .mockReturnValueOnce(createSelectChain([{ id: 'task-dup' }])); // mükerrer kontrolü → zaten var
      const updateChain = createUpdateChain();
      mockUpdate.mockReturnValue(updateChain);

      const req = new Request('http://localhost/api/tasks', {
        method: 'POST',
        body: JSON.stringify({ action: 'toggle_subtask', task_id: 'task-1', subtask_id: 's2' })
      });
      const res = await postTasks(req);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data.transition).toBe('completed');
      expect(json.data.task_status).toBe('completed');
      expect(json.data.spawned_next_task).toEqual({ id: 'task-dup', due_date: '2026-11-18' });
      expect(mockInsert).not.toHaveBeenCalled();
      const setArg = updateChain.set.mock.calls[0][0];
      expect(setArg.status).toBe('completed');
      expect(typeof setArg.completed_at).toBe('string');
    });

    it('toggle_subtask API: tamamlanmış görevde adım geri alınınca görev yeniden açılmalıdır', async () => {
      vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1', family_id: 'fam-1' } as any);
      const existingTask = {
        id: 'task-2', title: 'Tek seferlik', status: 'completed', recurrence: 'none', due_date: '2026-11-17',
        completed_at: '2026-11-17T10:00:00.000Z',
        subtasks_json: JSON.stringify([
          { id: 's1', title: 'A', is_completed: true },
          { id: 's2', title: 'B', is_completed: true },
        ]),
        user_id: 'user-1', family_id: 'fam-1'
      };
      mockSelect.mockReturnValueOnce(createSelectChain([existingTask]));
      const updateChain = createUpdateChain();
      mockUpdate.mockReturnValue(updateChain);

      const req = new Request('http://localhost/api/tasks', {
        method: 'POST',
        body: JSON.stringify({ action: 'toggle_subtask', task_id: 'task-2', subtask_id: 's1' })
      });
      const json = await (await postTasks(req)).json();

      expect(json.data.transition).toBe('reopened');
      expect(json.data.task_status).toBe('pending');
      const setArg = updateChain.set.mock.calls[0][0];
      expect(setArg.status).toBe('pending');
      expect(setArg.completed_at).toBeNull();
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  describe('2. Tekrarlayan Görevler & Vade Hesabı (Recurrence Engine)', () => {
    it('Günlük tekrarda sonraki günün tarihini tam olarak hesaplamalıdır', () => {
      const nextDate = calculateNextRecurrenceDate('2026-10-15', 'daily');
      expect(nextDate).toBe('2026-10-16');
    });

    it('Haftalık tekrarda tam 7 gün eklemelidir', () => {
      const nextDate = calculateNextRecurrenceDate('2026-10-15', 'weekly');
      expect(nextDate).toBe('2026-10-22');
    });

    it('Aylık tekrarda 31 çeken aydan 28 çeken Şubat ayına geçerken gün taşmasını engellemelidir (clamping)', () => {
      // 31 Ocak 2026 -> 28 Şubat 2026 (2026 artık yıl değildir)
      const nextDate = calculateNextRecurrenceDate('2026-01-31', 'monthly');
      expect(nextDate).toBe('2026-02-28');

      // 31 Ağustos -> 30 Eylül (30 gün çeken ay)
      const nextSep = calculateNextRecurrenceDate('2026-08-31', 'monthly');
      expect(nextSep).toBe('2026-09-30');
    });

    it('recurrence none ise veya belirtilmemişse null dönmelidir', () => {
      expect(calculateNextRecurrenceDate('2026-10-15', 'none')).toBeNull();
      expect(calculateNextRecurrenceDate('2026-10-15', '' as any)).toBeNull();
    });
  });

  describe('3. Günün 3 Odağı (MIT - Anti-Overwhelm Constraint)', () => {
    it('Aynı günde 2 aktif MIT varken 3. MIT eklenmesine izin vermelidir', () => {
      const existing = [
        { id: 't-1', is_mit: 1, status: 'pending', due_date: '2026-10-20' },
        { id: 't-2', is_mit: 1, status: 'in_progress', due_date: '2026-10-20' },
        { id: 't-3', is_mit: 0, status: 'pending', due_date: '2026-10-20' },
      ];

      const check = validateMitConstraint(existing, '2026-10-20');
      expect(check.allowed).toBe(true);
      expect(check.activeMitCount).toBe(2);
      expect(check.maxMit).toBe(3);
    });

    it('Aynı günde 3 aktif MIT varken 4. MIT eklenmesini engellemelidir', () => {
      const existing = [
        { id: 't-1', is_mit: 1, status: 'pending', due_date: '2026-10-20' },
        { id: 't-2', is_mit: 1, status: 'in_progress', due_date: '2026-10-20' },
        { id: 't-3', is_mit: 1, status: 'pending', due_date: '2026-10-20' },
      ];

      const check = validateMitConstraint(existing, '2026-10-20');
      expect(check.allowed).toBe(false);
      expect(check.activeMitCount).toBe(3);
    });

    it('Tamamlanmış MIT görevleri limiti tüketmemelidir', () => {
      const existing = [
        { id: 't-1', is_mit: 1, status: 'completed', due_date: '2026-10-20' },
        { id: 't-2', is_mit: 1, status: 'completed', due_date: '2026-10-20' },
        { id: 't-3', is_mit: 1, status: 'pending', due_date: '2026-10-20' },
      ];

      const check = validateMitConstraint(existing, '2026-10-20');
      expect(check.allowed).toBe(true);
      expect(check.activeMitCount).toBe(1);
    });

    it('Mevcut bir MIT görevi güncellenirken (targetTaskId eşleştiğinde) kendini saymamalıdır', () => {
      const existing = [
        { id: 't-1', is_mit: 1, status: 'pending', due_date: '2026-10-20' },
        { id: 't-2', is_mit: 1, status: 'pending', due_date: '2026-10-20' },
        { id: 't-3', is_mit: 1, status: 'pending', due_date: '2026-10-20' },
      ];

      // t-2 görevini güncelliyoruz -> sayım 2 olmalı ve izin verilmeli
      const check = validateMitConstraint(existing, '2026-10-20', 't-2');
      expect(check.allowed).toBe(true);
      expect(check.activeMitCount).toBe(2);
    });
  });

  describe('4. Akıllı Sekme & Görünüm Filtreleme (filterTasksByView)', () => {
    const sampleTasks: TaskItem[] = [
      {
        id: 't-today',
        title: 'Bugün yapılacak',
        status: 'pending',
        priority: 'high',
        pillar: 'work',
        is_mit: 0,
        due_date: '2026-10-20',
        recurrence: 'none',
        is_family_shared: 0,
        created_at: '2026-10-20T08:00:00Z',
        updated_at: '2026-10-20T08:00:00Z'
      },
      {
        id: 't-overdue',
        title: 'Gecikmiş görev',
        status: 'pending',
        priority: 'critical',
        pillar: 'finance',
        is_mit: 0,
        due_date: '2026-10-18', // Geçmiş
        recurrence: 'none',
        is_family_shared: 0,
        created_at: '2026-10-18T08:00:00Z',
        updated_at: '2026-10-18T08:00:00Z'
      },
      {
        id: 't-mit-nodate',
        title: 'Tarihsiz ama MIT seçilmiş',
        status: 'pending',
        priority: 'high',
        pillar: 'mind',
        is_mit: 1,
        due_date: null,
        recurrence: 'none',
        is_family_shared: 0,
        created_at: '2026-10-19T08:00:00Z',
        updated_at: '2026-10-19T08:00:00Z'
      },
      {
        id: 't-upcoming',
        title: 'Gelecek hafta',
        status: 'pending',
        priority: 'medium',
        pillar: 'general',
        is_mit: 0,
        due_date: '2026-10-25',
        recurrence: 'none',
        is_family_shared: 0,
        created_at: '2026-10-20T08:00:00Z',
        updated_at: '2026-10-20T08:00:00Z'
      },
      {
        id: 't-backlog',
        title: 'Tarihsiz fikir',
        status: 'pending',
        priority: 'low',
        pillar: 'mind',
        is_mit: 0,
        due_date: null,
        recurrence: 'none',
        is_family_shared: 0,
        created_at: '2026-10-10T08:00:00Z',
        updated_at: '2026-10-10T08:00:00Z'
      },
      {
        id: 't-recurring',
        title: 'Haftalık yedek al',
        status: 'pending',
        priority: 'medium',
        pillar: 'work',
        is_mit: 0,
        due_date: '2026-10-22',
        recurrence: 'weekly',
        is_family_shared: 0,
        created_at: '2026-10-15T08:00:00Z',
        updated_at: '2026-10-15T08:00:00Z'
      },
      {
        id: 't-completed',
        title: 'Biten görev',
        status: 'completed',
        priority: 'low',
        pillar: 'wellness',
        is_mit: 0,
        due_date: '2026-10-19',
        completed_at: '2026-10-20T09:00:00Z',
        recurrence: 'none',
        is_family_shared: 0,
        created_at: '2026-10-19T08:00:00Z',
        updated_at: '2026-10-20T09:00:00Z'
      }
    ];

    it("today sekmesi bugün olanları, gecikmişleri ve MIT'leri listelemelidir", () => {
      const todayList = filterTasksByView(sampleTasks, 'today', '2026-10-20');
      const ids = todayList.map(t => t.id);
      expect(ids).toContain('t-today');
      expect(ids).toContain('t-overdue');
      expect(ids).toContain('t-mit-nodate');
      expect(ids).toContain('t-completed'); // Bugün tamamlandığı için (completed_at: 2026-10-20)
      expect(ids).not.toContain('t-upcoming');
      expect(ids).not.toContain('t-backlog');
    });

    it('upcoming sekmesi sadece gelecekteki tamamlanmamış görevleri listelemelidir', () => {
      const upcomingList = filterTasksByView(sampleTasks, 'upcoming', '2026-10-20');
      const ids = upcomingList.map(t => t.id);
      expect(ids).toEqual(['t-upcoming', 't-recurring']);
    });

    it('backlog sekmesi vadesi olmayan görevleri listelemelidir', () => {
      const backlogList = filterTasksByView(sampleTasks, 'backlog', '2026-10-20');
      const ids = backlogList.map(t => t.id);
      expect(ids).toContain('t-backlog');
      expect(ids).not.toContain('t-today');
    });

    it('recurring sekmesi tekrarlayan rutinleri listelemelidir', () => {
      const recList = filterTasksByView(sampleTasks, 'recurring', '2026-10-20');
      expect(recList).toHaveLength(1);
      expect(recList[0].id).toBe('t-recurring');
    });

    it('completed sekmesi sadece tamamlanan görevleri listelemelidir', () => {
      const doneList = filterTasksByView(sampleTasks, 'completed', '2026-10-20');
      expect(doneList).toHaveLength(1);
      expect(doneList[0].id).toBe('t-completed');
    });

    it('gelecek tarihli MIT görevi bugün sekmesine sızmamalı, yaklaşan sekmesinde kalmalıdır (regresyon)', () => {
      const futureMit: TaskItem = {
        id: 't-mit-future', title: 'Order flow notları', status: 'pending', priority: 'critical', pillar: 'work',
        is_mit: 1, due_date: '2026-10-21', recurrence: 'none', is_family_shared: 0,
        created_at: '2026-10-20T08:00:00Z', updated_at: '2026-10-20T08:00:00Z'
      };
      const list = [...sampleTasks, futureMit];
      expect(filterTasksByView(list, 'today', '2026-10-20').map(t => t.id)).not.toContain('t-mit-future');
      expect(filterTasksByView(list, 'upcoming', '2026-10-20').map(t => t.id)).toContain('t-mit-future');
      // Ertesi gün bugüne geçmeli
      expect(filterTasksByView(list, 'today', '2026-10-21').map(t => t.id)).toContain('t-mit-future');
    });

    it('bugün tamamlama kontrolü UTC değil Türkiye takvim gününe göre yapılmalıdır (gece 00:00-03:00)', () => {
      // 2026-10-20T22:30Z = TR 2026-10-21 01:30
      const lateNight: TaskItem = {
        id: 't-late', title: 'Gece bitti', status: 'completed', priority: 'low', pillar: 'general',
        is_mit: 0, due_date: '2026-10-25', completed_at: '2026-10-20T22:30:00Z', recurrence: 'none',
        is_family_shared: 0, created_at: '2026-10-20T08:00:00Z', updated_at: '2026-10-20T22:30:00Z'
      };
      expect(toTurkeyDay('2026-10-20T22:30:00Z')).toBe('2026-10-21');
      expect(toTurkeyDay(null)).toBeNull();
      expect(toTurkeyDay('gecersiz')).toBeNull();
      expect(filterTasksByView([lateNight], 'today', '2026-10-21').map(t => t.id)).toContain('t-late');
      expect(filterTasksByView([lateNight], 'today', '2026-10-20')).toHaveLength(0);
    });
  });

  describe('5. Sistem Köprüsü (Cross-Module Action Engine)', () => {
    it('Yaklaşan fatura, geciken kredi kartı, araç muayene ve kasa evraklarını görev köprüsüne dönüştürmelidir', () => {
      const actions = generateCrossModuleActionItems({
        bills: [
          { id: 'b-1', name: 'Turkcell Fiber', amount: 480, due_day: 22, days_left: 2 },
          { id: 'b-2', name: 'Netflix', amount: 250, due_day: 30, days_left: 10 } // 5 günden fazla, gelmemeli
        ],
        creditCards: [
          { id: 'cc-1', name: 'Garanti Bonus', balance: 12500, days_until_due: 3, is_overdue: false },
          { id: 'cc-2', name: 'Enpara', balance: 4200, is_overdue: true, days_overdue: 2 }
        ],
        vehicles: [
          { id: 'v-1', type: 'muayene', due_date: '2026-10-28', days_left: 8, plate: '34 XYZ 123' },
          { id: 'v-2', type: 'kasko', due_date: '2026-12-01', days_left: 42 } // 14 günden fazla, gelmemeli
        ],
        homeMaintenance: [
          { id: 'hm-1', title: 'Kombi Bakımı', next_due_date: '2026-10-25', days_left: 5, status: 'warning' }
        ],
        vaultItems: [
          { id: 'vt-1', title: 'Pasaport Yenileme', expiry_date: '2026-10-30', days_left: 10 }
        ],
        existingTasks: [],
        todayStr: '2026-10-20'
      });

      expect(actions).toHaveLength(6);
      const modules = actions.map(a => a.source_module);
      expect(modules).toContain('finance');
      expect(modules).toContain('vehicle');
      expect(modules).toContain('home');
      expect(modules).toContain('vault');

      const billAction = actions.find(a => a.source_ref_id === 'b-1');
      expect(billAction?.title).toContain('Turkcell Fiber Faturasını Öde');
      expect(billAction?.priority).toBe('critical');

      const overdueCard = actions.find(a => a.source_ref_id === 'card-cc-2');
      expect(overdueCard?.subtitle).toContain('gecikmede');
      expect(overdueCard?.priority).toBe('critical');
    });

    it('Zaten göreve dönüştürülmüş modül aksiyonlarını mükerrer üretmemelidir (deduplication)', () => {
      const actions = generateCrossModuleActionItems({
        bills: [
          { id: 'b-1', name: 'Turkcell Fiber', amount: 480, due_day: 22, days_left: 2 }
        ],
        creditCards: [],
        existingTasks: [
          { source_module: 'finance', source_ref_id: 'b-1' } // Daha önce içeri aktarılmış
        ],
        todayStr: '2026-10-20'
      });

      expect(actions).toHaveLength(0);
    });
  });

  describe('6. API Güvenliği (OWASP BOLA & IDOR)', () => {
    it('Yetkisiz isteklerde GET /api/tasks 401 dönmelidir', async () => {
      vi.mocked(getAuthUser).mockResolvedValue(null);

      const req = new Request('http://localhost:3000/api/tasks');
      const res = await getTasks(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/Yetkisiz/i);
    });

    it('Yetkisiz isteklerde POST /api/tasks 401 dönmelidir', async () => {
      vi.mocked(getAuthUser).mockResolvedValue(null);

      const req = new Request('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', title: 'Test görevi' })
      });
      const res = await postTasks(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/Yetkisiz/i);
    });

    it('Kullanıcı oturum açtığında GET /api/tasks zenginleştirilmiş görev listesi ve MIT özetini dönmelidir', async () => {
      vi.mocked(getAuthUser).mockResolvedValue({
        id: 'user-ugur-tasks',
        family_id: 'fam-ugur'
      } as any);

      // DB Select Mocks:
      // 1. familyMembers
      // 2. tasks
      // 3. recurringBills
      // 4. walletsAccounts
      // 5. vehicles
      // 6. homeMaintenanceRecords
      // 7. digitalVaultItems
      const todayStr = new Date().toISOString().slice(0, 10);
      mockSelect
        .mockReturnValueOnce(createSelectChain([{ id: 'mem-1', name: 'Hande', avatar: '👩' }])) // members
        .mockReturnValueOnce(createSelectChain([ // tasks
          {
            id: 'task-101',
            title: 'Kira ödemesini yap',
            status: 'pending',
            priority: 'critical',
            pillar: 'finance',
            is_mit: 1,
            due_date: todayStr,
            subtasks_json: JSON.stringify([{ id: 'sub-1', title: 'Dekontu ilet', is_completed: true }]),
            is_family_shared: 1,
            assigned_member_id: 'mem-1',
            user_id: 'user-ugur-tasks',
            family_id: 'fam-ugur',
            created_at: `${todayStr}T08:00:00Z`,
            updated_at: `${todayStr}T08:00:00Z`
          }
        ]))
        .mockReturnValueOnce(createSelectChain([])) // bills
        .mockReturnValueOnce(createSelectChain([])) // accounts
        .mockReturnValueOnce(createSelectChain([])) // vehicles
        .mockReturnValueOnce(createSelectChain([])) // home maint
        .mockReturnValueOnce(createSelectChain([])); // vault

      const req = new Request('http://localhost:3000/api/tasks?view=all');
      const res = await getTasks(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.tasks).toHaveLength(1);
      expect(json.data.tasks[0].assigned_member_name).toBe('Hande');
      expect(json.data.tasks[0].subtasks_progress.percent).toBe(100);
      expect(json.data.mitSummary.activeMitCount).toBe(1);
      expect(json.data.mitSummary.maxMit).toBe(3);
    });

    it('POST create: Boş başlık gönderildiğinde 400 hatası dönmelidir', async () => {
      vi.mocked(getAuthUser).mockResolvedValue({
        id: 'user-ugur-tasks',
        family_id: 'fam-ugur'
      } as any);

      const req = new Request('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', title: '   ' })
      });
      const res = await postTasks(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/başlığı boş/i);
    });

    it('POST create: Günün 4. MIT görevi eklenmeye çalışıldığında 400 hatası ile engellenmelidir', async () => {
      vi.mocked(getAuthUser).mockResolvedValue({
        id: 'user-ugur-tasks',
        family_id: 'fam-ugur'
      } as any);

      // Zaten 3 aktif MIT var
      mockSelect.mockReturnValueOnce(createSelectChain([
        { id: 'm-1', is_mit: 1, status: 'pending', due_date: '2026-10-20' },
        { id: 'm-2', is_mit: 1, status: 'pending', due_date: '2026-10-20' },
        { id: 'm-3', is_mit: 1, status: 'pending', due_date: '2026-10-20' },
      ]));

      const req = new Request('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          title: '4. Büyük Odak Görevi',
          is_mit: true,
          due_date: '2026-10-20'
        })
      });
      const res = await postTasks(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/en fazla 3/i);
    });

    it('diffTurkeyCalendarDays ve parseTurkeyCalendarDate kenar durumlarında doğru takvim günü hesabı yapmalıdır', () => {
      expect(diffTurkeyCalendarDays('2026-12-01', '2026-12-01')).toBe(0);
      expect(diffTurkeyCalendarDays('2026-12-02', '2026-12-01')).toBe(1);
      expect(diffTurkeyCalendarDays('2026-11-30', '2026-12-01')).toBe(-1);
      expect(diffTurkeyCalendarDays('02.12.2026', '2026-12-01')).toBe(1);
      // 2026-11-30T22:30Z = TR 2026-12-01 01:30 -> 2026-12-01'e göre 0 gün
      expect(diffTurkeyCalendarDays('2026-11-30T22:30:00Z', '2026-12-01')).toBe(0);
      expect(diffTurkeyCalendarDays('2026-02-31', '2026-02-28')).toBeNull();
      expect(diffTurkeyCalendarDays(null, '2026-12-01')).toBeNull();
      expect(diffTurkeyCalendarDays('', '2026-12-01')).toBeNull();
      expect(diffTurkeyCalendarDays('gecersiz', '2026-12-01')).toBeNull();

      const cal = parseTurkeyCalendarDate('2026-12-01');
      expect(cal.getFullYear()).toBe(2026);
      expect(cal.getMonth()).toBe(11);
      expect(cal.getDate()).toBe(1);
    });

    it('GET /api/tasks Sistem Köprüsü (fatura, kredi kartı, araç, kasa) 00:00-03:00 TR gece geçişinde UTC yerine Türkiye takvim gününü kullanmalıdır', async () => {
      vi.useFakeTimers();
      try {
        // UTC 2026-11-30 22:30 = Türkiye 2026-12-01 01:30 (ay ve gün değişimi)
        vi.setSystemTime(new Date('2026-11-30T22:30:00Z'));
        vi.mocked(getAuthUser).mockResolvedValue({
          id: 'user-ugur-tasks',
          family_id: 'fam-ugur'
        } as any);

        mockSelect
          .mockReturnValueOnce(createSelectChain([])) // 1. familyMembers
          .mockReturnValueOnce(createSelectChain([])) // 2. tasks
          .mockReturnValueOnce(createSelectChain([ // 3. recurringBills
            { id: 'bill-dec2', name: 'İnternet', amount: 500, due_day: 2, last_paid_month: '2026-11', status: 'active' }
          ]))
          .mockReturnValueOnce(createSelectChain([ // 4. walletsAccounts
            { id: 'cc-nov30', name: 'Maximum', type: 'credit_card', balance: 1200, cutoff_day: 20, due_day: 30, is_active: 1 }
          ]))
          .mockReturnValueOnce(createSelectChain([ // 5. vehicles
            { id: 'veh-1', plate: '34 ABC 01' }
          ]))
          .mockReturnValueOnce(createSelectChain([])) // 6. homeMaintenanceRecords
          .mockReturnValueOnce(createSelectChain([ // 7. digitalVaultItems
            { id: 'vault-bad', title: 'Bozuk Tarih', expiry_date: 'gecersiz-tarih', type: 'passport' }
          ]))
          .mockReturnValueOnce(createSelectChain([ // 8. transactions (cc)
            { wallet_id: 'cc-nov30', amount: 1200, transaction_date: '2026-11-10', is_installment: 0, merchant: 'Market', notes: null, category_id: 'cat-1' }
          ]))
          .mockReturnValueOnce(createSelectChain([ // 9. categories
            { id: 'cat-1', type: 'expense' }
          ]))
          .mockReturnValueOnce(createSelectChain([ // 10. vehicleLegalReminders
            { id: 'leg-1', vehicle_id: 'veh-1', type: 'muayene', due_date: '2026-12-01', is_completed: 0 }
          ]));

        const res = await getTasks(new Request('http://localhost/api/tasks?view=all'));
        const json = await res.json();

        expect(res.status).toBe(200);
        const actions = json.data.crossModuleActions as any[];

        // 1) Kasım'da ödenmiş, vadesi ayın 2'si olan fatura TR 1 Aralık'ta 1 gün kalmış olarak görünmeli
        const billAction = actions.find(a => a.source_ref_id === 'bill-dec2');
        expect(billAction).toBeDefined();
        expect(billAction.due_date).toBe('2026-12-02');
        expect(billAction.subtitle).toContain('Son 1 gün');

        // 2) Son ödeme günü 30 Kasım olan kredi kartı TR 1 Aralık'ta 1 gün gecikmiş sayılmalı
        const cardAction = actions.find(a => a.source_ref_id === 'card-cc-nov30');
        expect(cardAction).toBeDefined();
        expect(cardAction.due_date).toBe('2026-11-30');
        expect(cardAction.subtitle).toContain('1 gündür gecikmede');

        // 3) Vadesi 2026-12-01 olan araç muayenesi TR 1 Aralık'ta "Son 1 gün" değil "Vadesi doldu!" olmalı
        const vehicleAction = actions.find(a => a.source_ref_id === 'leg-1');
        expect(vehicleAction).toBeDefined();
        expect(vehicleAction.subtitle).toContain('Vadesi doldu!');

        // 4) Geçersiz tarihli kasa evrakı yanlışlıkla gün=0 sayılmamalı
        expect(actions.find(a => a.source_ref_id === 'vault-bad')).toBeUndefined();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('7. Aylık Görev Takvimi & Sanal Rutin Önizleme Motoru', () => {
    it('filterTasksByDate görevleri saate ve tamamlanma durumuna göre sıralamalı, tarihsiz bitenleri Türkiye gününe eşlemelidir', () => {
      const items: TaskItem[] = [
        {
          id: 'done-timed', title: 'Sabah bitti', status: 'completed', priority: 'low', pillar: 'general',
          is_mit: 0, due_date: '2026-11-18', due_time: '08:00', recurrence: 'none', is_family_shared: 0,
          created_at: '2026-11-17T08:00:00Z', updated_at: '2026-11-18T08:00:00Z'
        },
        {
          id: 'open-untimed-mit', title: 'Saatsiz MIT', status: 'pending', priority: 'high', pillar: 'work',
          is_mit: 1, due_date: '2026-11-18', due_time: null, recurrence: 'none', is_family_shared: 0,
          created_at: '2026-11-17T08:00:00Z', updated_at: '2026-11-17T08:00:00Z'
        },
        {
          id: 'open-21', title: 'Akşam görevi', status: 'pending', priority: 'critical', pillar: 'mind',
          is_mit: 0, due_date: '2026-11-18', due_time: '21:00', recurrence: 'none', is_family_shared: 0,
          created_at: '2026-11-17T08:00:00Z', updated_at: '2026-11-17T08:00:00Z'
        },
        {
          id: 'open-09', title: 'Sabah görevi', status: 'pending', priority: 'medium', pillar: 'health',
          is_mit: 0, due_date: '2026-11-18', due_time: '09:00', recurrence: 'none', is_family_shared: 0,
          created_at: '2026-11-17T08:00:00Z', updated_at: '2026-11-17T08:00:00Z'
        },
        {
          id: 'undated-done-tr', title: 'Gece biten tarihsiz', status: 'completed', priority: 'low', pillar: 'general',
          is_mit: 0, due_date: null, completed_at: '2026-11-17T22:30:00Z', recurrence: 'none', is_family_shared: 0,
          created_at: '2026-11-17T08:00:00Z', updated_at: '2026-11-17T22:30:00Z'
        },
        {
          id: 'other-day', title: 'Başka gün', status: 'pending', priority: 'low', pillar: 'general',
          is_mit: 0, due_date: '2026-11-19', recurrence: 'none', is_family_shared: 0,
          created_at: '2026-11-17T08:00:00Z', updated_at: '2026-11-17T08:00:00Z'
        }
      ];

      const sorted = filterTasksByDate(items, '2026-11-18');
      expect(sorted.map(t => t.id)).toEqual([
        'open-09',
        'open-21',
        'open-untimed-mit',
        'done-timed',
        'undated-done-tr'
      ]);
    });

    it('projectVirtualRecurrences günlük/haftalık/aylık rutinleri öngörmeli, tamamlananlardan ve çakışanlardan kopya üretmemelidir', () => {
      const items: TaskItem[] = [
        {
          id: 'r-daily', title: 'Su iç', status: 'pending', priority: 'low', pillar: 'health',
          is_mit: 0, due_date: '2026-11-17', recurrence: 'daily', is_family_shared: 0,
          created_at: '2026-11-17T08:00:00Z', updated_at: '2026-11-17T08:00:00Z'
        },
        {
          id: 'r-daily-real-dup', title: 'Su iç', status: 'pending', priority: 'low', pillar: 'health',
          is_mit: 0, due_date: '2026-11-19', recurrence: 'daily', is_family_shared: 0,
          created_at: '2026-11-17T08:00:00Z', updated_at: '2026-11-17T08:00:00Z'
        },
        {
          id: 'r-weekly', title: 'Haftalık yedek', status: 'pending', priority: 'medium', pillar: 'work',
          is_mit: 0, due_date: '2026-11-10', recurrence: 'weekly', is_family_shared: 0,
          created_at: '2026-11-10T08:00:00Z', updated_at: '2026-11-10T08:00:00Z'
        },
        {
          id: 'r-monthly-31', title: 'Ay sonu raporu', status: 'pending', priority: 'high', pillar: 'finance',
          is_mit: 0, due_date: '2026-01-31', recurrence: 'monthly', is_family_shared: 0,
          created_at: '2026-01-31T08:00:00Z', updated_at: '2026-01-31T08:00:00Z'
        },
        {
          id: 'r-completed', title: 'Eski bitmiş rutin', status: 'completed', priority: 'low', pillar: 'general',
          is_mit: 0, due_date: '2026-11-15', recurrence: 'daily', is_family_shared: 0,
          created_at: '2026-11-15T08:00:00Z', updated_at: '2026-11-15T08:00:00Z'
        }
      ];

      // 1) Kasım penceresi (2026-11-17 .. 2026-11-24)
      const novProj = projectVirtualRecurrences(items, '2026-11-17', '2026-11-24', '2026-11-17');
      const dailyDates = novProj.filter(v => v.title === 'Su iç').map(v => v.due_date);
      expect(dailyDates).not.toContain('2026-11-17'); // gerçek görevin günü
      expect(dailyDates).not.toContain('2026-11-19'); // o günde gerçek kopya zaten var
      expect(dailyDates).toContain('2026-11-18');
      expect(dailyDates).toContain('2026-11-20');

      const weeklyDates = novProj.filter(v => v.title === 'Haftalık yedek').map(v => v.due_date);
      expect(weeklyDates).toEqual(['2026-11-17', '2026-11-24']);

      expect(novProj.filter(v => v.title === 'Eski bitmiş rutin')).toHaveLength(0);

      // 2) Aylık 31. gün sabitlemesi: Şubat 28, Mart 31 olarak korunmalı
      const febMarProj = projectVirtualRecurrences([items[3]], '2026-02-01', '2026-03-31', '2026-02-01');
      expect(febMarProj.map(v => v.due_date)).toEqual(['2026-02-28', '2026-03-31']);
    });

    it('buildTaskCalendarMonth Pazartesi hizalamasını, hücre sayaçlarını ve Sistem Köprüsü eşleşmelerini doğru üretmelidir', () => {
      // Şubat 2021 Pazartesi günü başlar ve 28 gündür -> tam 28 hücre
      const feb2021 = buildTaskCalendarMonth(2021, 1, [], [], '2021-02-15');
      expect(feb2021).toHaveLength(28);
      expect(feb2021[0].dateStr).toBe('2021-02-01');
      expect(feb2021[27].dateStr).toBe('2021-02-28');

      // Kasım 2026 Pazar günü başlar -> 6 gün taşma (26 Eki .. 6 Ara = 42 hücre)
      const tasksNov: TaskItem[] = [
        {
          id: 't-past-open', title: 'Gecikmiş', status: 'pending', priority: 'high', pillar: 'finance',
          is_mit: 0, due_date: '2026-11-15', recurrence: 'none', is_family_shared: 0,
          created_at: '2026-11-15T08:00:00Z', updated_at: '2026-11-15T08:00:00Z'
        },
        {
          id: 't-today-mit', title: 'Bugün MIT', status: 'pending', priority: 'critical', pillar: 'work',
          is_mit: 1, due_date: '2026-11-17', recurrence: 'weekly', is_family_shared: 0,
          created_at: '2026-11-17T08:00:00Z', updated_at: '2026-11-17T08:00:00Z'
        },
        {
          id: 't-today-done', title: 'Bugün bitti', status: 'completed', priority: 'low', pillar: 'health',
          is_mit: 0, due_date: '2026-11-17', recurrence: 'none', is_family_shared: 0,
          created_at: '2026-11-17T08:00:00Z', updated_at: '2026-11-17T12:00:00Z'
        }
      ];

      const nov2026 = buildTaskCalendarMonth(
        2026,
        10, // Kasım
        tasksNov,
        [{
          id: 'cm-1', title: 'Elektrik Faturası', subtitle: '500 ₺', pillar: 'finance',
          priority: 'high', due_date: '2026-11-20', source_module: 'finance', source_ref_id: 'b-1', action_url: '/budget'
        }],
        '2026-11-17'
      );

      expect(nov2026).toHaveLength(42);
      expect(nov2026[0].dateStr).toBe('2026-10-26');
      expect(nov2026[0].isCurrentMonth).toBe(false);

      const nov15 = nov2026.find(d => d.dateStr === '2026-11-15')!;
      expect(nov15.overdueCount).toBe(1);

      const nov17 = nov2026.find(d => d.dateStr === '2026-11-17')!;
      expect(nov17.isToday).toBe(true);
      expect(nov17.totalTasks).toBe(2);
      expect(nov17.pendingCount).toBe(1);
      expect(nov17.completedCount).toBe(1);
      expect(nov17.mitCount).toBe(1);

      const nov20 = nov2026.find(d => d.dateStr === '2026-11-20')!;
      expect(nov20.bridgeActions).toHaveLength(1);

      // 17 Kasım haftalık görevi 24 Kasım ve 1 Aralık'a sanal önizleme bırakmalı
      const nov24 = nov2026.find(d => d.dateStr === '2026-11-24')!;
      expect(nov24.virtualRecurrences).toHaveLength(1);
      expect(nov24.virtualRecurrences[0].title).toBe('Bugün MIT');
    });
  });

  describe('8. P1 Regresyon Doğrulamaları (MIT, Köprü, Saat Dilimi, Middleware & Çok Kanallı Entegrasyon)', () => {
    it('summarizeTodayMit & isTodayMitTask eski tarihsiz tamamlanan MIT görevlerini bugünden düşürmeli, bugün biten gecikmiş MIT görevini ise dahil etmelidir', () => {
      const todayStr = '2026-11-18';
      const list: Array<Pick<TaskItem, 'id' | 'is_mit' | 'status' | 'due_date' | 'completed_at'>> = [
        { id: 'old-undated-done', is_mit: 1, status: 'completed', due_date: null, completed_at: '2026-11-10T10:00:00Z' },
        { id: 'today-tr-night-done', is_mit: 1, status: 'completed', due_date: '2026-11-15', completed_at: '2026-11-17T22:30:00Z' }, // TR 2026-11-18 01:30
        { id: 'active-undated', is_mit: 1, status: 'pending', due_date: null, completed_at: null },
        { id: 'active-today', is_mit: 1, status: 'in_progress', due_date: todayStr, completed_at: null },
        { id: 'future-mit', is_mit: 1, status: 'pending', due_date: '2026-11-19', completed_at: null },
      ];

      expect(isTodayMitTask(list[0], todayStr)).toBe(false);
      expect(isTodayMitTask(list[1], todayStr)).toBe(true);

      const summary = summarizeTodayMit(list, todayStr);
      expect(summary.todayMitTasks.map(t => t.id)).toEqual([
        'today-tr-night-done',
        'active-undated',
        'active-today'
      ]);
      expect(summary.activeMitCount).toBe(2);
      expect(summary.completedMitCount).toBe(1);
      expect(summary.maxMit).toBe(3);
    });

    it('calculateNextRecurrenceDate tarihsiz günlük tekrarda 00:00-02:59 TR gece geçişinde bugüne değil yarına üretmelidir', () => {
      // UTC 2026-11-30 22:30 = TR 2026-12-01 01:30
      const lateNightRef = new Date('2026-11-30T22:30:00Z');
      expect(calculateNextRecurrenceDate(null, 'daily', lateNightRef)).toBe('2026-12-02');
    });

    it('generateCrossModuleActionItems önceki döngüde tamamlanmış tekrarlayan öğeleri yeni dönemde yeniden göstermelidir', () => {
      const actions = generateCrossModuleActionItems({
        bills: [
          { id: 'b-same-cycle', name: 'Su Faturası', amount: 300, due_day: 22, due_date: '2026-11-22', days_left: 2 },
          { id: 'b-new-cycle', name: 'Elektrik Faturası', amount: 650, due_day: 22, due_date: '2026-12-22', days_left: 2 }
        ],
        vehicles: [
          { id: 'leg-1', type: 'muayene', due_date: '2028-11-20', days_left: 5, plate: '34 XYZ 123' }
        ],
        existingTasks: [
          { source_module: 'finance', source_ref_id: 'b-same-cycle', status: 'completed', due_date: '2026-11-22' },
          { source_module: 'finance', source_ref_id: 'b-new-cycle', status: 'completed', due_date: '2026-11-22' },
          { source_module: 'vehicle', source_ref_id: 'leg-1', status: 'completed', due_date: '2026-11-20' }
        ],
        todayStr: '2026-12-20'
      });

      expect(actions.map(a => a.source_ref_id)).toEqual(['b-new-cycle', 'leg-1']);
    });

    it('GET /api/tasks Sistem Köprüsü yıllık (yearly) ve 3 aylık (quarterly) faturaları vade ayı dışında sızdırmamalıdır', async () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date('2026-12-01T10:00:00Z'));
        vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1', family_id: 'fam-1' } as any);

        mockSelect
          .mockReturnValueOnce(createSelectChain([])) // familyMembers
          .mockReturnValueOnce(createSelectChain([])) // tasks
          .mockReturnValueOnce(createSelectChain([ // recurringBills
            { id: 'bill-yearly-mar', name: 'Yıllık Sigorta', amount: 5000, due_day: 2, period: 'yearly', due_month: 3, last_paid_month: null, status: 'active' },
            { id: 'bill-quarterly-jan', name: '3 Aylık Aidat', amount: 1500, due_day: 2, period: 'quarterly', due_month: 1, last_paid_month: null, status: 'active' },
            { id: 'bill-yearly-dec', name: 'Aralık MTV', amount: 3000, due_day: 4, period: 'yearly', due_month: 12, last_paid_month: null, status: 'active' }
          ]))
          .mockReturnValueOnce(createSelectChain([])) // walletsAccounts
          .mockReturnValueOnce(createSelectChain([])) // vehicles
          .mockReturnValueOnce(createSelectChain([])) // homeMaintenanceRecords
          .mockReturnValueOnce(createSelectChain([])); // digitalVaultItems

        const json = await (await getTasks(new Request('http://localhost/api/tasks?view=all'))).json();
        const billRefs = (json.data.crossModuleActions as any[]).map(a => a.source_ref_id);
        expect(billRefs).not.toContain('bill-yearly-mar');
        expect(billRefs).not.toContain('bill-quarterly-jan');
        expect(billRefs).toContain('bill-yearly-dec');
      } finally {
        vi.useRealTimers();
      }
    });

    it('POST update boş başlığı ve dolu bir güne taşınan MIT görevini 400 ile reddetmelidir; create geçersiz üye ID kabul etmemelidir', async () => {
      vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1', family_id: 'fam-1' } as any);

      // 1) update boş başlık -> 400
      mockSelect.mockReturnValueOnce(createSelectChain([{
        id: 'task-u1', title: 'Eski', status: 'pending', is_mit: 0, due_date: '2026-12-05', user_id: 'user-1', family_id: 'fam-1'
      }]));
      const emptyTitleRes = await postTasks(new Request('http://localhost/api/tasks', {
        method: 'POST',
        body: JSON.stringify({ action: 'update', task_id: 'task-u1', title: '   ' })
      }));
      expect(emptyTitleRes.status).toBe(400);

      // 2) update mevcut MIT'i zaten 3 MIT olan güne taşıma -> 400
      mockSelect
        .mockReturnValueOnce(createSelectChain([{
          id: 'task-mit-move', title: 'Taşınan MIT', status: 'pending', is_mit: 1, due_date: '2026-12-10', user_id: 'user-1', family_id: 'fam-1'
        }]))
        .mockReturnValueOnce(createSelectChain([
          { id: 'm1', is_mit: 1, status: 'pending', due_date: '2026-12-05' },
          { id: 'm2', is_mit: 1, status: 'pending', due_date: '2026-12-05' },
          { id: 'm3', is_mit: 1, status: 'pending', due_date: '2026-12-05' }
        ]));
      const moveMitRes = await postTasks(new Request('http://localhost/api/tasks', {
        method: 'POST',
        body: JSON.stringify({ action: 'update', task_id: 'task-mit-move', due_date: '2026-12-05' })
      }));
      expect(moveMitRes.status).toBe(400);

      // 3) create başka haneye ait assigned_member_id -> 400
      mockSelect.mockReturnValueOnce(createSelectChain([])); // üye yok
      const badMemberRes = await postTasks(new Request('http://localhost/api/tasks', {
        method: 'POST',
        body: JSON.stringify({ action: 'create', title: 'Üye Test', assigned_member_id: 'mem-other-family' })
      }));
      expect(badMemberRes.status).toBe(400);
    });

    it('toggle_complete tamamlanmış MIT görevi dolu günde yeniden açmayı engellemeli; tekrarlayan MIT dolulukta sonraki görevi is_mit=0 türetmelidir', async () => {
      vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1', family_id: 'fam-1' } as any);

      // 1) Reopen MIT when target day already has 3 active MITs -> 400
      mockSelect
        .mockReturnValueOnce(createSelectChain([{
          id: 'done-mit', title: 'Bitmiş MIT', status: 'completed', is_mit: 1, due_date: '2026-12-01', recurrence: 'none', user_id: 'user-1', family_id: 'fam-1'
        }]))
        .mockReturnValueOnce(createSelectChain([
          { id: 'a1', is_mit: 1, status: 'pending', due_date: '2026-12-01' },
          { id: 'a2', is_mit: 1, status: 'pending', due_date: '2026-12-01' },
          { id: 'a3', is_mit: 1, status: 'pending', due_date: '2026-12-01' }
        ]));
      const reopenRes = await postTasks(new Request('http://localhost/api/tasks', {
        method: 'POST',
        body: JSON.stringify({ action: 'toggle_complete', task_id: 'done-mit' })
      }));
      expect(reopenRes.status).toBe(400);

      // 2) Complete recurring MIT when next day (2026-12-02) already has 3 MITs -> spawned next task has is_mit: 0
      mockSelect
        .mockReturnValueOnce(createSelectChain([{
          id: 'rec-mit', title: 'Günlük Odak', status: 'pending', is_mit: 1, due_date: '2026-12-01', recurrence: 'daily', subtasks_json: '[]', user_id: 'user-1', family_id: 'fam-1'
        }]))
        .mockReturnValueOnce(createSelectChain([])) // duplicate check in spawnNextRecurringTask
        .mockReturnValueOnce(createSelectChain([ // visibleTasks MIT check for 2026-12-02
          { id: 'n1', is_mit: 1, status: 'pending', due_date: '2026-12-02' },
          { id: 'n2', is_mit: 1, status: 'pending', due_date: '2026-12-02' },
          { id: 'n3', is_mit: 1, status: 'pending', due_date: '2026-12-02' }
        ]));
      mockUpdate.mockReturnValueOnce(createUpdateChain());
      const insertChain = createInsertChain();
      mockInsert.mockReturnValueOnce(insertChain);

      const completeRes = await postTasks(new Request('http://localhost/api/tasks', {
        method: 'POST',
        body: JSON.stringify({ action: 'toggle_complete', task_id: 'rec-mit' })
      }));
      expect(completeRes.status).toBe(200);
      expect(insertChain.values).toHaveBeenCalledWith(expect.objectContaining({
        due_date: '2026-12-02',
        is_mit: 0
      }));
    });

    it('import_cross_module çift tıklamada mükerrer görev oluşturmamalıdır (idempotency)', async () => {
      vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1', family_id: 'fam-1' } as any);
      mockSelect.mockReturnValueOnce(createSelectChain([
        { id: 'task-existing-bridge', status: 'pending', due_date: '2026-12-02' }
      ]));

      const res = await postTasks(new Request('http://localhost/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          action: 'import_cross_module',
          title: 'İnternet Faturasını Öde',
          due_date: '2026-12-02',
          source_module: 'finance',
          source_ref_id: 'bill-dec2'
        })
      }));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.duplicate).toBe(true);
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('middleware oturumsuz /tasks isteklerini giriş sayfasına yönlendirmelidir', () => {
      expect(middlewareConfig.matcher).toContain('/tasks/:path*');
      const req = new NextRequest('http://localhost:3000/tasks');
      const res = middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/auth/login?redirect=%2Ftasks');
    });

    it('voice-command Türkçe İ harfini, Türkiye saat dilimini ve 3 MIT limitini doğru uygulamalıdır', async () => {
      vi.useFakeTimers();
      try {
        // UTC 2026-11-30 22:30 = TR 2026-12-01 01:30
        vi.setSystemTime(new Date('2026-11-30T22:30:00Z'));
        vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1', family_id: 'fam-1' } as any);

        // 1) Parse Türkçe 'İ' ve 'yarın'
        const parseJson = await (await postVoiceCommand(new Request('http://localhost/api/voice-command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: 'Yarın için İnternet faturasını öde görevi ekle' })
        }))).json();
        expect(parseJson.actions[0].type).toBe('task');
        expect(parseJson.actions[0].details.title).toBe('İnternet faturasını öde');
        expect(parseJson.actions[0].details.due_date).toBe('2026-12-02');
        expect(parseJson.actions[0].details.pillar).toBe('finance');

        const prefixJson = await (await postVoiceCommand(new Request('http://localhost/api/voice-command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: 'Görev ekle: Muhasebeciyi ara' })
        }))).json();
        expect(prefixJson.actions[0].type).toBe('task');
        expect(prefixJson.actions[0].details.title).toBe('Muhasebeciyi ara');
        expect(prefixJson.actions[0].details.due_date).toBe('2026-12-01');

        // 2) Execute MIT task when 3 MITs already exist -> is_mit downgraded to 0
        mockSelect.mockReturnValueOnce(createSelectChain([
          { id: 'm1', is_mit: 1, status: 'pending', due_date: '2026-12-01' },
          { id: 'm2', is_mit: 1, status: 'pending', due_date: '2026-12-01' },
          { id: 'm3', is_mit: 1, status: 'pending', due_date: '2026-12-01' }
        ]));
        const insertChain = createInsertChain();
        mockInsert.mockReturnValueOnce(insertChain);

        const execJson = await (await postVoiceCommand(new Request('http://localhost/api/voice-command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'execute',
            actions: [{
              type: 'task',
              title: 'Önemli İş',
              icon: '🎯',
              details: { title: 'Önemli İş', is_mit: 1, due_date: '2026-12-01' }
            }]
          })
        }))).json();

        expect(execJson.success).toBe(true);
        expect(insertChain.values).toHaveBeenCalledWith(expect.objectContaining({ is_mit: 0 }));
        expect(execJson.executed[0]).toContain('3 MIT limiti dolu');
      } finally {
        vi.useRealTimers();
      }
    });

    it('telegram /gorev komutu 00:00-02:59 aralığında Türkiye takvim gününü yazmalıdır', async () => {
      vi.useFakeTimers();
      const prevSecret = process.env.TELEGRAM_SECRET_TOKEN;
      try {
        process.env.TELEGRAM_SECRET_TOKEN = 'test-tg-secret';
        vi.setSystemTime(new Date('2026-11-30T22:30:00Z')); // TR 2026-12-01 01:30

        mockSelect.mockReturnValueOnce(createSelectChain([{
          id: 'user-1',
          family_id: 'fam-1',
          telegram_chat_id: '123456',
          telegram_secret_token: 'test-tg-secret'
        }]));
        const insertChain = createInsertChain();
        mockInsert.mockReturnValueOnce(insertChain);

        const res = await postTelegram(new Request('http://localhost/api/telegram', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-telegram-bot-api-secret-token': 'test-tg-secret'
          },
          body: JSON.stringify({
            message: { chat: { id: 123456 }, text: '/gorev Sabah raporu gönder' }
          })
        }));

        expect(res.status).toBe(200);
        expect(insertChain.values).toHaveBeenCalledWith(expect.objectContaining({
          due_date: '2026-12-01',
          title: 'Sabah raporu gönder'
        }));
      } finally {
        if (prevSecret === undefined) delete process.env.TELEGRAM_SECRET_TOKEN;
        else process.env.TELEGRAM_SECRET_TOKEN = prevSecret;
        vi.useRealTimers();
      }
    });
  });

  describe('9. P0 Güvenlik (BOLA), Mahremiyet & Veri Temizliği Doğrulamaları', () => {
    const pgDialect = new PgDialect();

    it('5 POST mutasyonunun tamamı aile içi özel görevlerde (is_family_shared = 0) is_family_shared=1 filtrelemeli ve yetkisiz erişimde 404 dönmelidir', async () => {
      vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-2', family_id: 'fam-1' } as any);

      const payloads = [
        { action: 'toggle_complete', task_id: 'private-task-1' },
        { action: 'toggle_subtask', task_id: 'private-task-1', subtask_id: 'sub-1' },
        { action: 'toggle_mit', task_id: 'private-task-1' },
        { action: 'update', task_id: 'private-task-1', title: 'Değiştirildi' },
        { action: 'delete', task_id: 'private-task-1' },
      ];

      for (const body of payloads) {
        const selectChain = createSelectChain([]);
        mockSelect.mockReturnValueOnce(selectChain);

        const res = await postTasks(new Request('http://localhost/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }));

        expect(res.status).toBe(404);
        expect(mockUpdate).not.toHaveBeenCalled();
        expect(mockDelete).not.toHaveBeenCalled();

        const whereArg = selectChain.where.mock.calls[0]?.[0];
        const compiled = pgDialect.sqlToQuery(whereArg);
        expect(compiled.sql).toContain('"tasks"."is_family_shared" =');
        expect(compiled.params).toContain(1);
      }
    });

    it('POST update: başka bir aile üyesinin paylaştığı görevi gizlemeye (is_family_shared = 0) çalışmayı 403 ile engellemelidir', async () => {
      vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-2', family_id: 'fam-1' } as any);
      mockSelect.mockReturnValueOnce(createSelectChain([{
        id: 'shared-task-1',
        title: 'Ortak Görev',
        status: 'pending',
        is_mit: 0,
        is_family_shared: 1,
        user_id: 'user-1',
        family_id: 'fam-1'
      }]));

      const res = await postTasks(new Request('http://localhost/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', task_id: 'shared-task-1', is_family_shared: 0 })
      }));

      expect(res.status).toBe(403);
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('GET /api/tasks Sistem Köprüsü sorguları walletsAccounts, vehicles ve digitalVaultItems üzerinde is_family_shared/is_active filtresi uygulamalıdır', async () => {
      vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-2', family_id: 'fam-1' } as any);

      const chainsByTable = new Map<any, any[]>();
      mockSelect.mockImplementation(() => {
        const chain = createSelectChain([]);
        chain.from = vi.fn((tbl: any) => {
          const list = chainsByTable.get(tbl) || [];
          list.push(chain);
          chainsByTable.set(tbl, list);
          return chain;
        });
        return chain;
      });

      const res = await getTasks(new Request('http://localhost/api/tasks?view=all'));
      expect(res.status).toBe(200);

      const walletWhere = pgDialect.sqlToQuery(chainsByTable.get(walletsAccounts)![0].where.mock.calls[0][0]).sql;
      expect(walletWhere).toContain('"wallets_accounts"."is_family_shared" =');
      expect(walletWhere.toLowerCase()).toContain('"wallets_accounts"."user_id" is null');

      const vehicleWhere = pgDialect.sqlToQuery(chainsByTable.get(vehicles)![0].where.mock.calls[0][0]).sql;
      expect(vehicleWhere).toContain('"vehicles"."is_active" =');
      expect(vehicleWhere).toContain('"vehicles"."is_family_shared" =');

      const vaultWhere = pgDialect.sqlToQuery(chainsByTable.get(digitalVaultItems)![0].where.mock.calls[0][0]).sql;
      expect(vaultWhere).toContain('"digital_vault_items"."is_family_shared" =');
    });

    it('import_cross_module kişisel kasa/kart öğelerinde is_family_shared=0 korumalı ve başkasının özel kaydını 403 ile reddetmelidir', async () => {
      vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1', family_id: 'fam-1' } as any);

      // 1) Kendi kişisel kasa evrakını aktarırken istemci is_family_shared: 1 gönderse bile 0 yazılmalı
      mockSelect
        .mockReturnValueOnce(createSelectChain([{ user_id: 'user-1', family_id: 'fam-1', is_family_shared: 0 }]))
        .mockReturnValueOnce(createSelectChain([]));
      const insertVaultChain = createInsertChain();
      mockInsert.mockReturnValueOnce(insertVaultChain);

      const ownVaultRes = await postTasks(new Request('http://localhost/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          action: 'import_cross_module',
          title: 'Pasaport Yenile',
          source_module: 'vault',
          source_ref_id: 'vault-private-1',
          is_family_shared: 1
        })
      }));
      expect(ownVaultRes.status).toBe(200);
      expect(insertVaultChain.values).toHaveBeenCalledWith(expect.objectContaining({
        is_family_shared: 0
      }));

      // 2) Kendi kişisel kredi kartını aktarırken is_family_shared: 0 kalmalı
      mockSelect
        .mockReturnValueOnce(createSelectChain([{ user_id: 'user-1', family_id: 'fam-1', is_family_shared: 0 }]))
        .mockReturnValueOnce(createSelectChain([]));
      const insertCardChain = createInsertChain();
      mockInsert.mockReturnValueOnce(insertCardChain);

      const ownCardRes = await postTasks(new Request('http://localhost/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          action: 'import_cross_module',
          title: 'Özel Kart Ekstresi',
          source_module: 'finance',
          source_ref_id: 'card-cc-priv'
        })
      }));
      expect(ownCardRes.status).toBe(200);
      expect(insertCardChain.values).toHaveBeenCalledWith(expect.objectContaining({
        is_family_shared: 0
      }));

      // 3) Başka aile üyesinin kişisel kasa kaydını aktarma girişimi -> 403
      mockSelect.mockReturnValueOnce(createSelectChain([{ user_id: 'user-2', family_id: 'fam-1', is_family_shared: 0 }]));
      const otherVaultRes = await postTasks(new Request('http://localhost/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          action: 'import_cross_module',
          title: 'Gizli Evrak',
          source_module: 'vault',
          source_ref_id: 'vault-other-priv'
        })
      }));
      expect(otherVaultRes.status).toBe(403);
    });

    it('reset-user-data ve delete-account işlemleri tasks tablosunu da temizlemeli ve src/db/index.ts FK kurallarını içermelidir', async () => {
      // 1) reset-user-data personal scope -> tasks için is_family_shared=0 temizliği yapmalı
      vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-2', family_id: 'fam-1', role: 'member' } as any);
      const deletedCalls: Array<{ table: any; whereSql: string; params: any[] }> = [];
      const updatedCalls: Array<{ table: any; setVal: any }> = [];

      mockTransaction.mockImplementation(async (cb: any) => {
        const tx = {
          select: vi.fn(() => createSelectChain([{ id: 'fm-user-2' }])),
          insert: vi.fn(() => createInsertChain()),
          update: vi.fn((tbl: any) => ({
            set: vi.fn((setVal: any) => {
              updatedCalls.push({ table: tbl, setVal });
              return { where: vi.fn().mockResolvedValue(undefined) };
            })
          })),
          delete: vi.fn((tbl: any) => ({
            where: vi.fn((whereExpr: any) => {
              const compiled = pgDialect.sqlToQuery(whereExpr);
              deletedCalls.push({ table: tbl, whereSql: compiled.sql, params: compiled.params });
              return Promise.resolve({ rowCount: 1 });
            })
          }))
        };
        return cb(tx);
      });

      const resetRes = await postResetUserData(new Request('http://localhost/api/auth/reset-user-data', {
        method: 'POST',
        body: JSON.stringify({ scope: 'personal' })
      }));
      expect(resetRes.status).toBe(200);
      const taskResetDelete = deletedCalls.find(d => d.table === tasks);
      expect(taskResetDelete).toBeDefined();
      expect(taskResetDelete!.whereSql).toContain('"tasks"."is_family_shared" =');

      // 2) delete-account non-admin -> kendi görevlerini silmeli ve atanan member referansını temizlemeli
      deletedCalls.length = 0;
      updatedCalls.length = 0;
      vi.mocked(getAuthUser).mockResolvedValue({
        id: 'user-2',
        family_id: 'fam-1',
        role: 'member',
        password_hash: 'h',
        password_salt: 's'
      } as any);

      const delRes = await postDeleteAccount(new Request('http://localhost/api/auth/delete-account', {
        method: 'POST',
        body: JSON.stringify({ password: 'ValidPassword123!' })
      }));
      expect(delRes.status).toBe(200);
      expect(deletedCalls.some(d => d.table === tasks)).toBe(true);
      expect(updatedCalls.some(u => u.table === tasks && u.setVal?.assigned_member_id === null)).toBe(true);

      // 3) src/db/index.ts CREATE TABLE IF NOT EXISTS tasks FK bütünlüğü
      const dbIndexSrc = fs.readFileSync(path.resolve(__dirname, '../src/db/index.ts'), 'utf8');
      expect(dbIndexSrc).toContain('assigned_member_id TEXT REFERENCES family_members(id) ON DELETE SET NULL');
      expect(dbIndexSrc).toContain('user_id TEXT REFERENCES users(id) ON DELETE CASCADE');
      expect(dbIndexSrc).toContain('family_id TEXT REFERENCES families(id) ON DELETE CASCADE');
    });
  });

  describe('10. P2 UX, Sıralama, Filtreleme & Ana Sayfa / Çok Kanallı İyileştirmeler', () => {
    const baseTask = (overrides: Partial<TaskItem>): TaskItem => ({
      id: 't-default',
      title: 'Varsayılan Görev',
      status: 'pending',
      priority: 'medium',
      pillar: 'general',
      is_mit: 0,
      due_date: '2026-11-18',
      due_time: null,
      recurrence: 'none',
      is_family_shared: 1,
      assigned_member_id: null,
      created_at: '2026-11-18T08:00:00Z',
      updated_at: '2026-11-18T08:00:00Z',
      ...overrides
    });

    it('filterTasksByScope, filterCrossModuleActionsByScope ve computeTaskTabCounts sekme sayaçlarını filtrelerle senkron hesaplamalıdır', () => {
      const sampleTasks: TaskItem[] = [
        baseTask({ id: 't1', is_family_shared: 1, pillar: 'finance', assigned_member_id: 'm1', due_date: '2026-11-18' }),
        baseTask({ id: 't2', is_family_shared: 1, pillar: 'work', assigned_member_id: 'm2', due_date: '2026-11-20' }),
        baseTask({ id: 't3', is_family_shared: 0, pillar: 'finance', assigned_member_id: null, due_date: null }),
        baseTask({ id: 't4', is_family_shared: 1, pillar: 'finance', assigned_member_id: 'm1', status: 'completed', due_date: '2026-11-18', completed_at: '2026-11-18T10:00:00Z' }),
      ];
      const bridgeActions: CrossModuleAction[] = [
        { id: 'b1', title: 'Fatura', subtitle: '', pillar: 'finance', priority: 'high', due_date: '2026-11-18', source_module: 'finance', source_ref_id: 'bill-1', action_url: '/budget', is_family_shared: 1 },
        { id: 'b2', title: 'Özel Kasa', subtitle: '', pillar: 'general', priority: 'medium', due_date: '2026-11-19', source_module: 'vault', source_ref_id: 'v-1', action_url: '/vault', is_family_shared: 0 },
      ];

      const memberScoped = filterTasksByScope(sampleTasks, {
        filterType: 'family',
        selectedPillar: 'finance',
        selectedMember: 'm1'
      });
      expect(memberScoped.map(t => t.id)).toEqual(['t1', 't4']);

      // Kişisel kapsamda member filtresi kişisel görevleri yanlışlıkla sıfırlamamalıdır
      const personalScoped = filterTasksByScope(sampleTasks, {
        filterType: 'personal',
        selectedPillar: 'all',
        selectedMember: 'm1'
      });
      expect(personalScoped.map(t => t.id)).toEqual(['t3']);

      const bridgeFamilyFinance = filterCrossModuleActionsByScope(bridgeActions, 'family', 'finance');
      expect(bridgeFamilyFinance.map(b => b.id)).toEqual(['b1']);

      const counts = computeTaskTabCounts(memberScoped, bridgeFamilyFinance, '2026-11-18');
      expect(counts).toEqual({
        today: 2,
        upcoming: 0,
        backlog: 0,
        recurring: 0,
        bridge: 1,
        completed: 1
      });
    });

    it('sortTasksForDisplay aktif görevlerde MIT/öncelik/tarih/saat sırasını, Yaklaşan sekmesinde ise kronolojik tarihi önceliklendirmelidir', () => {
      const unsortedToday = [
        baseTask({ id: 'done-early', status: 'completed', priority: 'critical', is_mit: 1, completed_at: '2026-11-18T09:00:00Z' }),
        baseTask({ id: 'low-no-time', priority: 'low', due_date: '2026-11-18', due_time: null }),
        baseTask({ id: 'high-14', priority: 'high', due_date: '2026-11-18', due_time: '14:00' }),
        baseTask({ id: 'high-09', priority: 'high', due_date: '2026-11-18', due_time: '09:00' }),
        baseTask({ id: 'mit-med', priority: 'medium', is_mit: 1, due_date: '2026-11-18', due_time: '16:00' }),
        baseTask({ id: 'done-late', status: 'completed', completed_at: '2026-11-18T11:30:00Z' }),
      ];

      expect(sortTasksForDisplay(unsortedToday, 'today').map(t => t.id)).toEqual([
        'mit-med',
        'high-09',
        'high-14',
        'low-no-time',
        'done-late',
        'done-early'
      ]);

      const upcomingList = [
        baseTask({ id: 'next-month-crit', priority: 'critical', due_date: '2026-12-10', due_time: '08:00' }),
        baseTask({ id: 'tomorrow-low', priority: 'low', due_date: '2026-11-19', due_time: '15:00' }),
        baseTask({ id: 'tomorrow-mit', priority: 'medium', is_mit: 1, due_date: '2026-11-19', due_time: '10:00' }),
      ];
      expect(sortTasksForDisplay(upcomingList, 'upcoming').map(t => t.id)).toEqual([
        'tomorrow-mit',
        'tomorrow-low',
        'next-month-crit'
      ]);
    });

    it('formatTaskScheduleLabel ve describeMitFeedItem gecikmiş, gelecek ve tarihsiz saat bilgilerini doğru biçimlendirmelidir', () => {
      const todayStr = '2026-11-18';
      expect(formatTaskScheduleLabel({ status: 'pending', due_date: '2026-11-16', due_time: '09:30' }, todayStr))
        .toBe('🚨 2026-11-16 • 09:30 (Gecikti)');
      expect(formatTaskScheduleLabel({ status: 'pending', due_date: '2026-11-18', due_time: '14:00' }, todayStr))
        .toBe('Bugün • 14:00');
      expect(formatTaskScheduleLabel({ status: 'pending', due_date: '2026-11-22', due_time: '11:15' }, todayStr))
        .toBe('2026-11-22 • 11:15');
      expect(formatTaskScheduleLabel({ status: 'pending', due_date: null, due_time: '18:45' }, todayStr))
        .toBe('18:45');

      expect(describeMitFeedItem({ status: 'pending', priority: 'medium', due_date: '2026-11-16', due_time: '09:30' }, todayStr))
        .toEqual({
          isOverdue: true,
          level: 'critical',
          badge: 'GECİKTİ',
          subtitle: '🚨 Gecikmiş (2026-11-16) • 09:30'
        });
      expect(describeMitFeedItem({ status: 'pending', priority: 'high', due_date: '2026-11-18', due_time: null }, todayStr))
        .toEqual({
          isOverdue: false,
          level: 'warning',
          badge: 'ODAK',
          subtitle: 'Bugün tamamlanması hedeflendi'
        });
    });

    it('voice-command ve telegram P2 iyileştirmeleri: sahte MIT eşleşmesini önlemeli ve günlük bültende yalnızca bugünkü MITleri saymalıdır', async () => {
      vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1', family_id: 'fam-1', username: 'ugur' } as any);

      // "limit" içindeki "mit" yanlışlıkla MIT sayılmamalı
      const falseMitJson = await (await postVoiceCommand(new Request('http://localhost/api/voice-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Kart limit artırımı görevi ekle' })
      }))).json();
      expect(falseMitJson.actions[0].type).toBe('task');
      expect(falseMitJson.actions[0].details.is_mit).toBe(0);

      // Kolonlu odak görevi öneki alt1 tarafından yutulmamalı
      const focusColonJson = await (await postVoiceCommand(new Request('http://localhost/api/voice-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Odak görevi ekle: Bütçe raporu' })
      }))).json();
      expect(focusColonJson.actions[0].type).toBe('task');
      expect(focusColonJson.actions[0].details.title).toBe('Bütçe raporu');
      expect(focusColonJson.actions[0].details.is_mit).toBe(1);

      // Telegram get_daily_briefing gelecek tarihli MIT görevini bugünün odağı diye saymamalı
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date('2026-11-18T10:00:00Z'));
        mockSelect
          .mockReturnValueOnce(createSelectChain([{ consumed_water_ml: 1000, daily_water_target_ml: 2500 }]))
          .mockReturnValueOnce(createSelectChain([{ title: 'Deneme', current_page: 10, total_pages: 100 }]))
          .mockReturnValueOnce(createSelectChain([
            { id: 't-today-mit', is_mit: 1, status: 'pending', due_date: '2026-11-18' },
            { id: 't-future-mit', is_mit: 1, status: 'pending', due_date: '2026-12-25' }
          ]));

        const briefRes = await postTelegram(new Request('http://localhost/api/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_daily_briefing' })
        }));
        const briefJson = await briefRes.json();
        expect(briefJson.success).toBe(true);
        expect(briefJson.text).toContain('2 bekleyen (1 Günün Odağı / MIT)');
      } finally {
        vi.useRealTimers();
      }
    });

    it('TasksClient, AddTaskModal, TimeContextualFeed ve HomePage P2 UI/ergonomi kontratlarını içermelidir', () => {
      const tasksClientSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/tasks/TasksClient.tsx'), 'utf8');
      const addModalSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/modals/AddTaskModal.tsx'), 'utf8');
      const feedSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/home/TimeContextualFeed.tsx'), 'utf8');
      const homeSrc = fs.readFileSync(path.resolve(__dirname, '../src/app/page.tsx'), 'utf8');

      // Üye filtresi UI, sekme sayaçları ve sıralama bağlantıları
      expect(tasksClientSrc).toContain('Tüm Üyeler');
      expect(tasksClientSrc).toContain('tabCounts.today');
      expect(tasksClientSrc).toContain('sortTasksForDisplay');
      expect(tasksClientSrc).toContain('visibilitychange');
      expect(tasksClientSrc).toContain("minHeight: '44px'");
      expect(tasksClientSrc).toContain("minWidth: '44px'");
      expect(tasksClientSrc).toContain('scopedCrossModuleActions');
      expect(tasksClientSrc).not.toMatch(/\b(MoreVertical|AlertTriangle|Sparkles|Inbox)\b/);

      // AddTaskModal kullanılmayan Lucide importları temizlenmiş olmalı
      expect(addModalSrc).not.toMatch(/\b(Calendar|Clock|Users|Repeat|Tag|CheckCircle2)\b/);

      // Ana sayfa MIT gecikme ayrımı ve hata toastı
      expect(feedSrc).toContain('describeMitFeedItem');
      expect(homeSrc).toContain("showToast(json.error || 'Görev güncellenemedi.')");
    });
  });

  describe('11. Paket 1 — Arama, Tek/Toplu Erteleme, Sanal Rutin Somutlaştırma & Ana Sayfa Zenginleştirmesi', () => {
    const mkTask = (overrides: Partial<TaskItem>): TaskItem => ({
      id: 't-pkg1',
      title: 'Örnek',
      status: 'pending',
      priority: 'medium',
      pillar: 'general',
      is_mit: 0,
      due_date: '2026-11-18',
      due_time: null,
      recurrence: 'none',
      is_family_shared: 1,
      created_at: '2026-11-18T08:00:00Z',
      updated_at: '2026-11-18T08:00:00Z',
      ...overrides
    });

    it('filterTasksByScope, filterCrossModuleActionsByScope ve getOverdueTasks Türkçe arama ve gecikme süzmesini doğru uygulamalıdır', () => {
      const list: TaskItem[] = [
        mkTask({
          id: 't-sub',
          title: 'Vergi Hazırlığı',
          description: 'Beyanname dosyaları',
          due_date: '2026-11-16',
          subtasks: [{ id: 's1', title: 'İnteraktif makbuzu indir', is_completed: false }]
        }),
        mkTask({
          id: 't-done-old',
          title: 'Eski Tamamlanmış',
          status: 'completed',
          due_date: '2026-11-10'
        }),
        mkTask({
          id: 't-future',
          title: 'Diş Randevusu',
          due_date: '2026-11-22'
        })
      ];

      // Alt görev içinde Türkçe 'İ' harfiyle büyük/küçük duyarsız eşleşme
      const matched = filterTasksByScope(list, {
        filterType: 'all',
        selectedPillar: 'all',
        selectedMember: 'all',
        searchQuery: 'İNTERAKTİF'
      });
      expect(matched.map(t => t.id)).toEqual(['t-sub']);

      // Köprü arama
      const bridge: CrossModuleAction[] = [
        { id: 'c1', title: 'Elektrik Faturası', subtitle: 'Son 2 gün', pillar: 'finance', priority: 'critical', due_date: '2026-11-18', source_module: 'finance', source_ref_id: 'b1', action_url: '/budget', is_family_shared: 1 },
        { id: 'c2', title: 'Araç Muayene', subtitle: '34ABC12', pillar: 'vehicle_home', priority: 'high', due_date: '2026-11-25', source_module: 'vehicle', source_ref_id: 'v1', action_url: '/vehicles', is_family_shared: 1 }
      ];
      expect(filterCrossModuleActionsByScope(bridge, 'all', 'all', 'fatura').map(b => b.id)).toEqual(['c1']);

      // Yalnızca tamamlanmamış < todayStr görevler gecikmiş sayılır
      expect(getOverdueTasks(list, '2026-11-18').map(t => t.id)).toEqual(['t-sub']);
    });

    it('buildMaterializedRecurrenceDraft ve describeMitFeedItem rutin taslağını ve ana sayfa alt bilgisini doğru üretmelidir', () => {
      const vr: VirtualRecurrenceItem = {
        id: 'vr-1',
        sourceTaskId: 'parent-1',
        title: 'Haftalık Finans Kontrolü',
        pillar: 'finance',
        priority: 'high',
        recurrence: 'weekly',
        due_date: '2026-11-25',
        due_time: '10:00',
        is_mit: 1
      };
      expect(buildMaterializedRecurrenceDraft(vr)).toEqual({
        title: 'Haftalık Finans Kontrolü',
        pillar: 'finance',
        priority: 'high',
        due_date: '2026-11-25',
        due_time: '10:00',
        is_mit: 1,
        recurrence: 'none'
      });

      const enrichedFeed = describeMitFeedItem({
        status: 'pending',
        priority: 'high',
        due_date: '2026-11-16',
        due_time: '09:30',
        pillar: 'finance',
        subtasks_progress: { total: 4, completed: 2, percent: 50 }
      }, '2026-11-18');

      expect(enrichedFeed).toEqual({
        isOverdue: true,
        level: 'critical',
        badge: 'GECİKTİ',
        subtitle: '🚨 Gecikmiş (2026-11-16) • 09:30 • 💰 Finans • 2/4 Adım'
      });
    });

    it('POST /api/tasks reschedule: tekil ertelemede BOLA/MIT/takvim/durum kurallarını doğru uygulamalıdır', async () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date('2026-11-18T10:00:00Z'));
        vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1', family_id: 'fam-1' } as any);

        // 1) Geçersiz takvim tarihi (30 Şubat) -> 400
        const invalidRes = await postTasks(new Request('http://localhost/api/tasks', {
          method: 'POST',
          body: JSON.stringify({ action: 'reschedule', task_id: 't1', due_date: '2026-02-30' })
        }));
        expect(invalidRes.status).toBe(400);

        // 2) Tamamlanmış görev -> 400
        mockSelect.mockReturnValueOnce(createSelectChain([{ id: 't-done', status: 'completed', due_date: '2026-11-15', is_mit: 0 }]));
        const doneRes = await postTasks(new Request('http://localhost/api/tasks', {
          method: 'POST',
          body: JSON.stringify({ action: 'reschedule', task_id: 't-done', due_date: 'today' })
        }));
        expect(doneRes.status).toBe(400);

        // 3) Yarına ertelenen MIT görevinde yarın 3 MIT doluysa -> is_mit: 0 düşürülüp ertelenir
        mockSelect
          .mockReturnValueOnce(createSelectChain([{ id: 't-mit', status: 'pending', due_date: '2026-11-16', is_mit: 1 }]))
          .mockReturnValueOnce(createSelectChain([
            { id: 'm1', is_mit: 1, status: 'pending', due_date: '2026-11-19' },
            { id: 'm2', is_mit: 1, status: 'pending', due_date: '2026-11-19' },
            { id: 'm3', is_mit: 1, status: 'pending', due_date: '2026-11-19' }
          ]));
        const updateChain = createUpdateChain();
        mockUpdate.mockReturnValueOnce(updateChain);

        const moveRes = await postTasks(new Request('http://localhost/api/tasks', {
          method: 'POST',
          body: JSON.stringify({ action: 'reschedule', task_id: 't-mit', due_date: 'tomorrow' })
        }));
        const moveJson = await moveRes.json();
        expect(moveRes.status).toBe(200);
        expect(moveJson.data).toEqual({
          task_id: 't-mit',
          due_date: '2026-11-19',
          is_mit: 0,
          mit_downgraded: true
        });
        expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({
          due_date: '2026-11-19',
          is_mit: 0
        }));
      } finally {
        vi.useRealTimers();
      }
    });

    it('POST /api/tasks reschedule_overdue: gecikmiş görevleri öncelik sırasıyla bugüne alıp 3 MIT kotasını korumalıdır', async () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date('2026-11-18T10:00:00Z'));
        vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1', family_id: 'fam-1' } as any);

        // Bugünde 2 aktif MIT var -> yalnızca 1 MIT slotu boş!
        mockSelect.mockReturnValueOnce(createSelectChain([
          { id: 'today-mit-1', status: 'pending', is_mit: 1, priority: 'high', due_date: '2026-11-18', created_at: '2026-11-18T08:00:00Z' },
          { id: 'today-mit-2', status: 'pending', is_mit: 1, priority: 'high', due_date: '2026-11-18', created_at: '2026-11-18T08:10:00Z' },
          { id: 'ov-crit-mit', status: 'pending', is_mit: 1, priority: 'critical', due_date: '2026-11-16', created_at: '2026-11-16T08:00:00Z' },
          { id: 'ov-low-mit', status: 'pending', is_mit: 1, priority: 'low', due_date: '2026-11-15', created_at: '2026-11-15T08:00:00Z' },
          { id: 'ov-normal', status: 'pending', is_mit: 0, priority: 'medium', due_date: '2026-11-17', created_at: '2026-11-17T08:00:00Z' }
        ]));

        const keepUpdateChain = createUpdateChain();
        const downgradeUpdateChain = createUpdateChain();
        mockUpdate
          .mockReturnValueOnce(keepUpdateChain)
          .mockReturnValueOnce(downgradeUpdateChain);

        const res = await postTasks(new Request('http://localhost/api/tasks', {
          method: 'POST',
          body: JSON.stringify({ action: 'reschedule_overdue' })
        }));
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.data).toEqual({
          updated_count: 3,
          downgraded_mit_count: 1,
          target_date: '2026-11-18'
        });
        expect(keepUpdateChain.set).toHaveBeenCalledWith(expect.objectContaining({ due_date: '2026-11-18' }));
        expect(downgradeUpdateChain.set).toHaveBeenCalledWith(expect.objectContaining({ due_date: '2026-11-18', is_mit: 0 }));
      } finally {
        vi.useRealTimers();
      }
    });

    it('TasksClient ve TaskCalendarPanel Paket 1 arama, hızlı erteleme ve rutin somutlaştırma UI kontratlarını içermelidir', () => {
      const tasksClientSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/tasks/TasksClient.tsx'), 'utf8');
      const calendarPanelSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/tasks/TaskCalendarPanel.tsx'), 'utf8');

      expect(tasksClientSrc).toContain('Görev, not veya alt adım ara...');
      expect(tasksClientSrc).toContain('☀️ Bugüne Al');
      expect(tasksClientSrc).toContain('📅 Yarına Ertele');
      expect(tasksClientSrc).toContain('☀️ Tümünü Bugüne Al');
      expect(tasksClientSrc).toContain('handleMaterializeRecurrence');
      expect(calendarPanelSrc).toContain('onMaterializeRecurrence');
    });
  });

  describe('12. Paket 2 — in_progress Durumu & Kalıcı Odak Zamanlayıcısı (Pomodoro)', () => {
    it('Odak hesaplama yardımcıları süre normalizasyonu, geçen dakika sınırı, geri sayım ve in_progress sıralamasını doğru üretmelidir', () => {
      expect(normalizeFocusDurationMinutes(undefined)).toBe(25);
      expect(normalizeFocusDurationMinutes(500)).toBe(180);
      expect(normalizeFocusDurationMinutes(-5)).toBe(25);

      // 30 sn altı kazara başlatma -> 0 dk; 12m 20s -> 12 dk; gece boyu açık unutulsa bile plannedMinutes ile tavanlanır
      expect(computeFocusElapsedMinutes('2026-11-18T10:00:00Z', 25, new Date('2026-11-18T10:00:20Z'))).toBe(0);
      expect(computeFocusElapsedMinutes('2026-11-18T10:00:00Z', 25, new Date('2026-11-18T10:12:20Z'))).toBe(12);
      expect(computeFocusElapsedMinutes('2026-11-18T10:00:00Z', 25, new Date('2026-11-18T22:00:00Z'))).toBe(25);

      const countdown = computeFocusCountdown(
        {
          status: 'in_progress',
          focus_started_at: '2026-11-18T10:00:00Z',
          focus_planned_minutes: 25
        },
        new Date('2026-11-18T10:05:15Z').getTime()
      );
      expect(countdown.isRunning).toBe(true);
      expect(countdown.remainingSeconds).toBe(19 * 60 + 45);
      expect(countdown.formattedRemaining).toBe('19:45');
      expect(countdown.isFinished).toBe(false);

      expect(formatFocusDurationSummary(0)).toBeNull();
      expect(formatFocusDurationSummary(75)).toBe('1s 15dk odak');

      // in_progress görevler listede MIT üstüne pinlenmeli ve TimeContextualFeed ODAKTA dönmeli
      const sorted = sortTasksForDisplay([
        {
          id: 'mit-pending',
          title: 'Bekleyen MIT',
          status: 'pending',
          priority: 'critical',
          pillar: 'work',
          is_mit: 1,
          recurrence: 'none',
          is_family_shared: 0,
          created_at: '2026-11-18T08:00:00Z',
          updated_at: '2026-11-18T08:00:00Z'
        },
        {
          id: 'focused-now',
          title: 'Odaktaki İş',
          status: 'in_progress',
          priority: 'medium',
          pillar: 'work',
          is_mit: 0,
          recurrence: 'none',
          is_family_shared: 0,
          created_at: '2026-11-18T07:00:00Z',
          updated_at: '2026-11-18T07:00:00Z'
        }
      ], 'today');
      expect(sorted.map(t => t.id)).toEqual(['focused-now', 'mit-pending']);

      expect(describeMitFeedItem({ status: 'in_progress', priority: 'high', due_date: '2026-11-18', due_time: null }, '2026-11-18')).toEqual({
        isOverdue: false,
        level: 'warning',
        badge: 'ODAKTA',
        subtitle: '⏱️ Odak seansı aktif'
      });
    });

    it('POST /api/tasks start_focus: tamamlanmış görevde 400 dönmeli, başka aktif odağı duraklatıp yeni görevi başlatmalıdır', async () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date('2026-11-18T10:20:00Z'));
        vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1', family_id: 'fam-1' } as any);

        // 1) Tamamlanmış görevde start_focus -> 400
        mockSelect.mockReturnValueOnce(createSelectChain([{ id: 't-done', status: 'completed' }]));
        const doneRes = await postTasks(new Request('http://localhost/api/tasks', {
          method: 'POST',
          body: JSON.stringify({ action: 'start_focus', task_id: 't-done' })
        }));
        expect(doneRes.status).toBe(400);

        // 2) Önceki aktif görevin 10 dk kısmi süresini kaydedip yeni göreve 50 dk başlatma
        mockSelect
          .mockReturnValueOnce(createSelectChain([{ id: 't-new', status: 'pending', focus_planned_minutes: 25, focus_logged_minutes: 5 }]))
          .mockReturnValueOnce(createSelectChain([{
            id: 't-old-active',
            status: 'in_progress',
            focus_started_at: '2026-11-18T10:10:00Z',
            focus_planned_minutes: 25,
            focus_logged_minutes: 15
          }]));
        const pauseOtherChain = createUpdateChain();
        const startNewChain = createUpdateChain();
        mockUpdate
          .mockReturnValueOnce(pauseOtherChain)
          .mockReturnValueOnce(startNewChain);

        const startRes = await postTasks(new Request('http://localhost/api/tasks', {
          method: 'POST',
          body: JSON.stringify({ action: 'start_focus', task_id: 't-new', duration_minutes: 50 })
        }));
        const startJson = await startRes.json();

        expect(startRes.status).toBe(200);
        expect(pauseOtherChain.set).toHaveBeenCalledWith(expect.objectContaining({
          status: 'pending',
          focus_started_at: null,
          focus_logged_minutes: 25
        }));
        expect(startNewChain.set).toHaveBeenCalledWith(expect.objectContaining({
          status: 'in_progress',
          focus_started_at: '2026-11-18T10:20:00.000Z',
          focus_planned_minutes: 50,
          focus_logged_minutes: 5
        }));
        expect(startJson.data.status).toBe('in_progress');
        expect(startJson.data.focus_planned_minutes).toBe(50);
      } finally {
        vi.useRealTimers();
      }
    });

    it('POST /api/tasks pause_focus, complete_focus ve toggle_complete geçen odak süresini biriktirmeli ve tekrarlayan kopyayı sıfır odakla üretmelidir', async () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date('2026-11-18T10:25:00Z'));
        vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1', family_id: 'fam-1' } as any);

        // 1) pause_focus (+12 dk birikimi)
        mockSelect.mockReturnValueOnce(createSelectChain([{
          id: 't-focus-1',
          status: 'in_progress',
          focus_started_at: '2026-11-18T10:13:00Z',
          focus_planned_minutes: 25,
          focus_logged_minutes: 10
        }]));
        const pauseChain = createUpdateChain();
        mockUpdate.mockReturnValueOnce(pauseChain);

        const pauseRes = await postTasks(new Request('http://localhost/api/tasks', {
          method: 'POST',
          body: JSON.stringify({ action: 'pause_focus', task_id: 't-focus-1' })
        }));
        const pauseJson = await pauseRes.json();
        expect(pauseRes.status).toBe(200);
        expect(pauseJson.data).toEqual({
          task_id: 't-focus-1',
          status: 'pending',
          added_minutes: 12,
          focus_logged_minutes: 22,
          spawned_next_task: null
        });

        // 2) complete_focus + complete_task: true -> tamamlar & tekrarlayan kopyayı sıfır odakla üretir
        mockSelect
          .mockReturnValueOnce(createSelectChain([{
            id: 't-rec-focus',
            title: 'Günlük İnceleme',
            description: null,
            status: 'in_progress',
            priority: 'high',
            pillar: 'work',
            is_mit: 0,
            due_date: '2026-11-18',
            due_time: '09:00',
            recurrence: 'daily',
            subtasks_json: '[]',
            is_family_shared: 0,
            assigned_member_id: null,
            source_module: 'manual',
            source_ref_id: null,
            focus_started_at: '2026-11-18T10:00:00Z',
            focus_planned_minutes: 25,
            focus_logged_minutes: 5,
            user_id: 'user-1',
            family_id: 'fam-1'
          }]))
          .mockReturnValueOnce(createSelectChain([])); // spawn duplicate check
        const completeChain = createUpdateChain();
        mockUpdate.mockReturnValueOnce(completeChain);
        const spawnInsertChain = createInsertChain();
        mockInsert.mockReturnValueOnce(spawnInsertChain);

        const completeRes = await postTasks(new Request('http://localhost/api/tasks', {
          method: 'POST',
          body: JSON.stringify({ action: 'complete_focus', task_id: 't-rec-focus', complete_task: true })
        }));
        const completeJson = await completeRes.json();
        expect(completeRes.status).toBe(200);
        expect(completeChain.set).toHaveBeenCalledWith(expect.objectContaining({
          status: 'completed',
          focus_started_at: null,
          focus_logged_minutes: 30
        }));
        expect(spawnInsertChain.values).toHaveBeenCalledWith(expect.objectContaining({
          due_date: '2026-11-19',
          focus_started_at: null,
          focus_logged_minutes: 0
        }));
        expect(completeJson.data.spawned_next_task?.due_date).toBe('2026-11-19');

        // 3) toggle_complete in_progress görevde geçen süreyi kapatıp kaydetmeli
        mockSelect.mockReturnValueOnce(createSelectChain([{
          id: 't-toggle-focus',
          title: 'Doğrudan Tamamlanan',
          status: 'in_progress',
          recurrence: 'none',
          is_mit: 0,
          focus_started_at: '2026-11-18T10:15:00Z',
          focus_planned_minutes: 25,
          focus_logged_minutes: 5
        }]));
        const toggleUpdateChain = createUpdateChain();
        mockUpdate.mockReturnValueOnce(toggleUpdateChain);

        const toggleRes = await postTasks(new Request('http://localhost/api/tasks', {
          method: 'POST',
          body: JSON.stringify({ action: 'toggle_complete', task_id: 't-toggle-focus' })
        }));
        expect(toggleRes.status).toBe(200);
        expect(toggleUpdateChain.set).toHaveBeenCalledWith(expect.objectContaining({
          status: 'completed',
          focus_started_at: null,
          focus_logged_minutes: 15
        }));
      } finally {
        vi.useRealTimers();
      }
    });

    it('Veritabanı şeması, göç SQL ve TasksClient odak zamanlayıcı kontratlarını içermelidir', () => {
      const schemaSrc = fs.readFileSync(path.resolve(__dirname, '../src/db/schema.ts'), 'utf8');
      const dbSrc = fs.readFileSync(path.resolve(__dirname, '../src/db/index.ts'), 'utf8');
      const tasksClientSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/tasks/TasksClient.tsx'), 'utf8');

      for (const col of ['focus_started_at', 'focus_planned_minutes', 'focus_logged_minutes']) {
        expect(schemaSrc).toContain(col);
        expect(dbSrc).toContain(col);
      }

      expect(tasksClientSrc).toContain('Aktif odak seansı zamanlayıcısı');
      expect(tasksClientSrc).toContain('ALLOWED_FOCUS_DURATIONS');
      expect(tasksClientSrc).toContain('handleStartFocus');
      expect(tasksClientSrc).toContain('handlePauseFocus');
      expect(tasksClientSrc).toContain('handleCompleteFocus');
      expect(tasksClientSrc).toContain('document.title');
    });
  });

  describe('13. Paket 3 — Çift Yönlü Köprü (EventBus) & Bütünsel Yaşam Skoru (5 x 20) Entegrasyonu', () => {
    it('resolveCrossModuleFollowUp, scalePillarTo20 ve calculateTasksFocusScoreBreakdown doğru çalışmalıdır', () => {
      expect(resolveCrossModuleFollowUp({ title: 'Kart Öde', source_module: 'finance', source_ref_id: 'card-cc1' })).toEqual(
        expect.objectContaining({ sourceModule: 'finance', href: '/budget', label: '💳 Kart Ödemesini İşle' })
      );
      expect(resolveCrossModuleFollowUp({ title: 'Elektrik', source_module: 'finance', source_ref_id: 'bill-1' })).toEqual(
        expect.objectContaining({ sourceModule: 'finance', href: '/budget', label: '💸 Fatura Ödemesini İşle' })
      );
      expect(resolveCrossModuleFollowUp({ title: 'Muayene', source_module: 'vehicle', source_ref_id: 'v1' })?.href).toBe('/vehicles');
      expect(resolveCrossModuleFollowUp({ title: 'Pasaport', source_module: 'vault', source_ref_id: 'd1' })?.href).toBe('/vault');
      expect(resolveCrossModuleFollowUp({ title: 'Manuel İş', source_module: 'manual', source_ref_id: null })).toBeNull();

      expect(scalePillarTo20(25)).toBe(20);
      expect(scalePillarTo20(0)).toBe(0);
      expect(scalePillarTo20(15)).toBe(12);

      // Tamamlanmış 2 bugünkü görev (%100 MIT + günlük rutin + 30 dk Pomodoro) -> 20/20 tam odak puanı
      const fullScore = calculateTasksFocusScoreBreakdown([
        { status: 'completed', is_mit: 1, due_date: '2026-11-18', completed_at: '2026-11-18T09:00:00Z', recurrence: 'daily', focus_logged_minutes: 30 },
        { status: 'completed', is_mit: 0, due_date: '2026-11-18', completed_at: '2026-11-18T11:00:00Z', recurrence: 'none', focus_logged_minutes: 0 }
      ], '2026-11-18', '2026-11-12');
      expect(fullScore.score).toBe(20);
      expect(fullScore.max).toBe(20);
      expect(fullScore.completedToday).toBe(2);
      expect(fullScore.todayMitCompleted).toBe(1);
    });

    it('POST /api/tasks görev tamamlamada EVENTS.TASK_COMPLETED yaymalı, sessiz finans yazmadan onaylı follow_up_action dönmelidir', async () => {
      vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1', family_id: 'fam-1' } as any);

      const emittedPayloads: any[] = [];
      const unsub = eventBus.subscribe(EVENTS.TASK_COMPLETED, (payload) => {
        emittedPayloads.push(payload);
      });

      try {
        mockSelect.mockReturnValueOnce(createSelectChain([{
          id: 't-bridge-done',
          title: 'Bonus Kart Ekstresini Öde',
          status: 'pending',
          pillar: 'finance',
          is_mit: 1,
          recurrence: 'none',
          source_module: 'finance',
          source_ref_id: 'card-bonus',
          focus_logged_minutes: 15
        }]));
        mockUpdate.mockReturnValueOnce(createUpdateChain());

        const res = await postTasks(new Request('http://localhost/api/tasks', {
          method: 'POST',
          body: JSON.stringify({ action: 'toggle_complete', task_id: 't-bridge-done' })
        }));
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(mockInsert).not.toHaveBeenCalled(); // Onaysız otomatik transaction oluşturulmamalı
        expect(emittedPayloads).toHaveLength(1);
        expect(emittedPayloads[0]).toEqual(expect.objectContaining({
          taskId: 't-bridge-done',
          title: 'Bonus Kart Ekstresini Öde',
          isMit: true,
          sourceModule: 'finance',
          sourceRefId: 'card-bonus',
          focusLoggedMinutes: 15,
          userId: 'user-1'
        }));
        expect(json.data.follow_up_action).toEqual(expect.objectContaining({
          sourceModule: 'finance',
          href: '/budget',
          label: '💳 Kart Ödemesini İşle'
        }));
      } finally {
        unsub();
      }
    });

    it('GET /api/analytics 5x20 Bütünsel Yaşam Skoru içinde Odak & Görevler eksenini doğru hesaplamalıdır', async () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date('2026-11-18T10:00:00Z'));
        vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1', family_id: 'fam-1' } as any);

        // İlk 16 sorgu diğer modüller (boş dönsün), son sorgu (tasks) 20/20 odak verisi dönsün
        mockSelect.mockImplementation((..._args: any[]) => createSelectChain([]));
        const analyticsTasksChain = createSelectChain([
          {
            id: 't-a1',
            status: 'completed',
            is_mit: 1,
            due_date: '2026-11-18',
            completed_at: '2026-11-18T08:00:00Z',
            recurrence: 'daily',
            focus_logged_minutes: 25
          },
          {
            id: 't-a2',
            status: 'completed',
            is_mit: 0,
            due_date: '2026-11-18',
            completed_at: '2026-11-18T09:30:00Z',
            recurrence: 'none',
            focus_logged_minutes: 0
          }
        ]);
        // analytics/route.ts içindeki select çağrılarından sadece tasks tablosuna denk gelene tasks listesi döndür
        let selectIdx = 0;
        mockSelect.mockImplementation(() => {
          selectIdx += 1;
          // analytics/route.ts: tasks sorgusu 16. veya son select sırasında from(tasks) alır -> from yakalayalım
          const obj: any = {
            from: vi.fn((tbl: any) => (tbl === tasks ? analyticsTasksChain : createSelectChain([])))
          };
          return obj;
        });

        const res = await getAnalytics();
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.data.holisticScore.breakdown.focus).toEqual({
          score: 20,
          max: 20,
          label: 'Odak & Görevler'
        });
        expect(json.data.holisticScore.breakdown.finance.max).toBe(20);
        expect(json.data.holisticScore.total).toBe(20);
        expect(json.data.holisticScore.focusMetrics.completedToday).toBe(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it('TasksClient ve HolisticScoreCard Paket 3 5-eksenli matris ve geri-yazım kısayolu kontratlarını içermelidir', () => {
      const tasksClientSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/tasks/TasksClient.tsx'), 'utf8');
      const holisticSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/analytics/HolisticScoreCard.tsx'), 'utf8');

      expect(tasksClientSrc).toContain('Bağlı modül onay kısayolu');
      expect(tasksClientSrc).toContain('resolveCrossModuleFollowUp');
      expect(holisticSrc).toContain('5 Temel Yaşam Ekseni');
      expect(holisticSrc).toContain('Odak & Görevler');
      expect(holisticSrc).toContain('Maksimum 20 Puan / Eksen');
    });
  });
});
