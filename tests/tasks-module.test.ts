import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getTasks, POST as postTasks } from '../src/app/api/tasks/route';
import { getAuthUser } from '../src/lib/auth';
import {
  parseSubtasks,
  calculateSubtaskProgress,
  calculateNextRecurrenceDate,
  resolveSubtaskDrivenStatus,
  toTurkeyDay,
  validateMitConstraint,
  filterTasksByView,
  generateCrossModuleActionItems,
  TaskItem,
  Subtask
} from '../src/lib/tasks-engine';
import { diffTurkeyCalendarDays, parseTurkeyCalendarDate } from '../src/lib/date-utils';

// Mock DB and Auth
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock('@/db', () => ({
  db: {
    select: (...args: any[]) => mockSelect(...args),
    insert: (...args: any[]) => mockInsert(...args),
    update: (...args: any[]) => mockUpdate(...args),
    delete: (...args: any[]) => mockDelete(...args)
  },
  initDatabase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
}));

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
});
