// Singularity Life OS - Görevler & Odak Motoru (Faz 17)
import { getTodayTurkeyDate, shiftTurkeyDate, diffTurkeyCalendarDays } from './date-utils';

/**
 * UTC ISO zaman damgasını (ör. completed_at) Türkiye yerel takvim gününe çevirir.
 * Geçersiz/boş girdide null döner.
 */
export function toTurkeyDay(isoTimestamp?: string | null): string | null {
  if (!isoTimestamp) return null;
  const d = new Date(isoTimestamp);
  if (isNaN(d.getTime())) return null;
  return getTodayTurkeyDate(d);
}

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type TaskPillar = 'general' | 'finance' | 'health' | 'wellness' | 'mind' | 'vehicle_home' | 'work' | 'family';
export type TaskStatus = 'pending' | 'in_progress' | 'completed';
export type TaskRecurrence = 'none' | 'daily' | 'weekly' | 'monthly';

export interface Subtask {
  id: string;
  title: string;
  is_completed: boolean;
}

export interface TaskItem {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  pillar: TaskPillar;
  is_mit: number; // 0 or 1
  due_date?: string | null; // YYYY-MM-DD
  due_time?: string | null; // HH:mm
  recurrence: TaskRecurrence;
  subtasks_json?: string | null;
  subtasks?: Subtask[];
  subtasks_progress?: { total: number; completed: number; percent: number };
  is_family_shared: number; // 0 or 1
  assigned_member_id?: string | null;
  assigned_member_name?: string | null;
  assigned_member_avatar?: string | null;
  source_module?: string | null;
  source_ref_id?: string | null;
  completed_at?: string | null;
  user_id?: string | null;
  family_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrossModuleAction {
  id: string;
  title: string;
  subtitle: string;
  pillar: TaskPillar;
  priority: TaskPriority;
  due_date: string;
  source_module: 'finance' | 'vehicle' | 'home' | 'vault';
  source_ref_id: string;
  action_url: string;
}

export const PILLAR_CONFIGS: Record<TaskPillar, { label: string; icon: string; color: string; bg: string }> = {
  finance: { label: 'Finans', icon: '💰', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' },
  health: { label: 'Sağlık', icon: '🩺', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.12)' },
  wellness: { label: 'Wellness', icon: '✨', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.12)' },
  mind: { label: 'Zihin', icon: '📚', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.12)' },
  vehicle_home: { label: 'Araç & Ev', icon: '🚗', color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.12)' },
  work: { label: 'İş & Proje', icon: '💼', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' },
  family: { label: 'Aile & Yaşam', icon: '🏠', color: '#EC4899', bg: 'rgba(236, 72, 153, 0.12)' },
  general: { label: 'Genel', icon: '🎯', color: '#6B7280', bg: 'rgba(107, 114, 128, 0.12)' },
};

export const PRIORITY_CONFIGS: Record<TaskPriority, { label: string; color: string; bg: string; badge: string }> = {
  critical: { label: 'Kritik', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)', badge: '🔴' },
  high: { label: 'Yüksek', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', badge: '🟡' },
  medium: { label: 'Orta', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)', badge: '🔵' },
  low: { label: 'Düşük', color: '#6B7280', bg: 'rgba(107, 114, 128, 0.15)', badge: '⚪' },
};

/**
 * Subtasks JSON dizesini güvenle ayrıştırır
 */
export function parseSubtasks(jsonStr?: string | null): Subtask[] {
  if (!jsonStr || typeof jsonStr !== 'string') return [];
  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item, idx) => ({
      id: String(item.id || `sub-${idx + 1}`),
      title: String(item.title || ''),
      is_completed: Boolean(item.is_completed)
    })).filter(s => s.title.trim().length > 0);
  } catch {
    return [];
  }
}

/**
 * Alt görev tamamlama oranını hesaplar (total, completed, percent)
 */
export function calculateSubtaskProgress(subtasks: Subtask[] | string | null | undefined): {
  total: number;
  completed: number;
  percent: number;
} {
  const list = Array.isArray(subtasks) ? subtasks : parseSubtasks(subtasks);
  if (!list || list.length === 0) {
    return { total: 0, completed: 0, percent: 0 };
  }
  const total = list.length;
  const completed = list.filter(s => s.is_completed).length;
  const percent = Math.round((completed / total) * 100);
  return { total, completed, percent };
}

/**
 * Alt adım değişikliği sonrası ana görevin durum geçişini belirler.
 * - Tüm adımlar tamamlandıysa (ve en az 1 adım varsa) görev 'completed' olur.
 * - Görev tamamlanmışken herhangi bir adımın işareti kaldırılırsa görev 'pending' durumuna geri döner.
 * - Diğer durumlarda mevcut durum korunur (transition: 'none').
 */
export function resolveSubtaskDrivenStatus(
  subtasks: Subtask[],
  currentStatus: string | null | undefined
): { nextStatus: TaskStatus; transition: 'completed' | 'reopened' | 'none' } {
  const status = (currentStatus as TaskStatus) || 'pending';
  if (!Array.isArray(subtasks) || subtasks.length === 0) {
    return { nextStatus: status, transition: 'none' };
  }
  const allDone = subtasks.every(s => s.is_completed);
  if (allDone && status !== 'completed') {
    return { nextStatus: 'completed', transition: 'completed' };
  }
  if (!allDone && status === 'completed') {
    return { nextStatus: 'pending', transition: 'reopened' };
  }
  return { nextStatus: status, transition: 'none' };
}

/**
 * Tekrarlayan görevin bir sonraki vade tarihini hesaplar
 */
export function calculateNextRecurrenceDate(
  currentDueDate: string | null | undefined,
  recurrence: TaskRecurrence,
  referenceDate: Date = new Date()
): string | null {
  if (!recurrence || recurrence === 'none') return null;

  let baseDate: Date;
  if (currentDueDate && /^\d{4}-\d{2}-\d{2}$/.test(currentDueDate)) {
    const [y, m, d] = currentDueDate.split('-').map(Number);
    baseDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  } else {
    baseDate = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate(), 12, 0, 0));
  }

  if (recurrence === 'daily') {
    baseDate.setUTCDate(baseDate.getUTCDate() + 1);
  } else if (recurrence === 'weekly') {
    baseDate.setUTCDate(baseDate.getUTCDate() + 7);
  } else if (recurrence === 'monthly') {
    const curDay = baseDate.getUTCDate();
    const curMonth = baseDate.getUTCMonth();
    const curYear = baseDate.getUTCFullYear();

    const targetMonth = (curMonth + 1) % 12;
    const targetYear = curMonth === 11 ? curYear + 1 : curYear;
    const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    const clampedDay = Math.min(curDay, daysInTargetMonth);

    baseDate = new Date(Date.UTC(targetYear, targetMonth, clampedDay, 12, 0, 0));
  }

  return baseDate.toISOString().slice(0, 10);
}

/**
 * Günün 3 Odağı (MIT) kalkanı: Bir gün için en fazla 3 aktif MIT olabilir.
 */
export function validateMitConstraint(
  existingTasks: Array<{ id: string; is_mit?: number | null; status?: string | null; due_date?: string | null }>,
  targetDueDate?: string | null,
  targetTaskId?: string
): { allowed: boolean; activeMitCount: number; maxMit: number } {
  const maxMit = 3;
  const normalizedTargetDate = targetDueDate || getTodayTurkeyDate();

  const activeMits = existingTasks.filter(t => {
    if (targetTaskId && t.id === targetTaskId) return false;
    const isMit = Number(t.is_mit) === 1;
    const isNotDone = t.status !== 'completed';
    const matchesDate = !t.due_date || t.due_date === normalizedTargetDate;
    return isMit && isNotDone && matchesDate;
  });

  const activeMitCount = activeMits.length;
  return {
    allowed: activeMitCount < maxMit,
    activeMitCount,
    maxMit
  };
}

/**
 * Görevleri görünüme (Tab) göre filtreler
 */
export function filterTasksByView(tasks: TaskItem[], view: string, todayStr: string): TaskItem[] {
  switch (view) {
    case 'today':
      return tasks.filter(t => {
        if (t.status === 'completed') {
          return t.due_date === todayStr || toTurkeyDay(t.completed_at) === todayStr;
        }
        // Tamamlanmamış: Vadesi bugün olanlar, vadesi geçmişler VEYA tarihsiz MIT'ler.
        // Gelecek tarihli MIT'ler bugüne sızmaz; 'upcoming' sekmesinde kalır.
        if (t.due_date) return t.due_date <= todayStr;
        return t.is_mit === 1;
      });

    case 'upcoming':
      return tasks.filter(t => {
        if (t.status === 'completed') return false;
        return t.due_date && t.due_date > todayStr;
      });

    case 'backlog':
      return tasks.filter(t => {
        if (t.status === 'completed') return false;
        return !t.due_date || t.due_date.trim() === '';
      });

    case 'recurring':
      return tasks.filter(t => {
        return t.recurrence && t.recurrence !== 'none';
      });

    case 'completed':
      return tasks.filter(t => t.status === 'completed');

    case 'all':
    default:
      return tasks;
  }
}

/**
 * Diğer modüllerden (Finans, Araç, Ev, Dijital Kasa) gelen yaklaşan ve geciken
 * bildirimleri otomatik olarak Görev Köprüsü aksiyonlarına çevirir.
 */
export function generateCrossModuleActionItems(options: {
  bills?: Array<{ id: string; name: string; amount: number; due_day: number; due_date?: string; days_left?: number }>;
  creditCards?: Array<{ id: string; name: string; balance: number; closed_statement_debt?: number; overdue_amount?: number; days_until_due?: number; next_due_date?: string; is_overdue?: boolean; days_overdue?: number }>;
  vehicles?: Array<{ id: string; type: string; due_date: string; days_left?: number; plate?: string }>;
  homeMaintenance?: Array<{ id: string; title: string; next_due_date: string; days_left?: number; status?: string }>;
  vaultItems?: Array<{ id: string; title: string; expiry_date?: string; days_left?: number; type?: string }>;
  existingTasks?: Array<{ source_module?: string | null; source_ref_id?: string | null }>;
  todayStr?: string;
}): CrossModuleAction[] {
  const actions: CrossModuleAction[] = [];
  const existingSet = new Set(
    (options.existingTasks || [])
      .filter(t => t.source_module && t.source_ref_id)
      .map(t => `${t.source_module}:${t.source_ref_id}`)
  );

  const todayStr = options.todayStr || getTodayTurkeyDate();

  // 1. Faturalar & Abonelikler (Kalan gün <= 5 veya gecikmiş)
  for (const b of options.bills || []) {
    const key = `finance:${b.id}`;
    if (existingSet.has(key)) continue;

    const daysLeft = b.days_left ?? 0;
    if (daysLeft <= 5) {
      actions.push({
        id: `cm-bill-${b.id}`,
        title: `${b.name} Faturasını Öde`,
        subtitle: `${Number(b.amount || 0).toLocaleString('tr-TR')} ₺ ${daysLeft <= 0 ? '(🚨 Gecikmede / Bugün)' : `(⏳ Son ${daysLeft} gün)`}`,
        pillar: 'finance',
        priority: daysLeft <= 2 ? 'critical' : 'high',
        due_date: b.due_date || todayStr,
        source_module: 'finance',
        source_ref_id: b.id,
        action_url: '/budget'
      });
    }
  }

  // 2. Kredi Kartı Ekstreleri (Gecikmiş veya kesilmiş ekstre borcu <= 5 gün içinde)
  for (const c of options.creditCards || []) {
    const key = `finance:card-${c.id}`;
    if (existingSet.has(key)) continue;

    const isOverdue = Boolean(c.is_overdue);
    const daysUntilDue = c.days_until_due ?? 0;
    const statementAmount = isOverdue
      ? (typeof c.overdue_amount === 'number' && c.overdue_amount > 0 ? c.overdue_amount : c.balance)
      : (typeof c.closed_statement_debt === 'number' ? c.closed_statement_debt : c.balance);

    if (isOverdue || (statementAmount > 0 && daysUntilDue <= 5)) {
      actions.push({
        id: `cm-card-${c.id}`,
        title: `${c.name} Kredi Kartı Ekstresini Öde`,
        subtitle: `${Number(statementAmount || 0).toLocaleString('tr-TR')} ₺ ${isOverdue ? `(🚨 ${c.days_overdue || 1} gündür gecikmede)` : `(⏳ Son ${daysUntilDue} gün)`}`,
        pillar: 'finance',
        priority: 'critical',
        due_date: c.next_due_date || todayStr,
        source_module: 'finance',
        source_ref_id: `card-${c.id}`,
        action_url: '/budget'
      });
    }
  }

  // 3. Araç Yasal Hatırlatıcılar (Muayene / Sigorta / Kasko <= 14 gün)
  for (const v of options.vehicles || []) {
    const key = `vehicle:${v.id}`;
    if (existingSet.has(key)) continue;

    const daysLeft = v.days_left ?? 0;
    if (daysLeft <= 14) {
      const typeLabel = v.type === 'muayene' ? 'TÜVTÜRK Muayenesi Yaptır' : v.type === 'kasko' ? 'Kasko Yenilemesi Yap' : 'Trafik Sigortası Yenile';
      actions.push({
        id: `cm-vehicle-${v.id}`,
        title: `${typeLabel} ${v.plate ? `(${v.plate})` : ''}`,
        subtitle: daysLeft <= 0 ? '🚨 Vadesi doldu!' : `⏳ Son ${daysLeft} gün kaldı`,
        pillar: 'vehicle_home',
        priority: daysLeft <= 3 ? 'critical' : 'high',
        due_date: v.due_date || todayStr,
        source_module: 'vehicle',
        source_ref_id: v.id,
        action_url: '/vehicles'
      });
    }
  }

  // 4. Ev Bakım Uyarıları (Durum warning veya <= 14 gün)
  for (const h of options.homeMaintenance || []) {
    const key = `home:${h.id}`;
    if (existingSet.has(key)) continue;

    const daysLeft = h.days_left ?? 0;
    if (h.status === 'warning' || daysLeft <= 14) {
      actions.push({
        id: `cm-home-${h.id}`,
        title: `${h.title} Bakımını Tamamla`,
        subtitle: daysLeft <= 0 ? '🚨 Vadesi geçti!' : `⏳ Son ${daysLeft} gün`,
        pillar: 'vehicle_home',
        priority: daysLeft <= 3 ? 'critical' : 'medium',
        due_date: h.next_due_date || todayStr,
        source_module: 'home',
        source_ref_id: h.id,
        action_url: '/vehicles'
      });
    }
  }

  // 5. Dijital Kasa Evrak Bitişleri (<= 14 gün)
  for (const doc of options.vaultItems || []) {
    const key = `vault:${doc.id}`;
    if (existingSet.has(key)) continue;

    const daysLeft = doc.days_left ?? 0;
    if (daysLeft <= 14 && doc.expiry_date) {
      actions.push({
        id: `cm-vault-${doc.id}`,
        title: `${doc.title} Evrakını Yenile`,
        subtitle: daysLeft <= 0 ? '🚨 Süresi doldu!' : `⏳ Son ${daysLeft} gün kaldı`,
        pillar: 'general',
        priority: daysLeft <= 3 ? 'critical' : 'medium',
        due_date: doc.expiry_date,
        source_module: 'vault',
        source_ref_id: doc.id,
        action_url: '/vault'
      });
    }
  }

  return actions;
}

export interface VirtualRecurrenceItem {
  id: string;
  sourceTaskId: string;
  title: string;
  pillar: TaskPillar;
  priority: TaskPriority;
  recurrence: TaskRecurrence;
  due_date: string;
  due_time?: string | null;
  is_mit: number;
}

export interface TaskCalendarDay {
  dateStr: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  totalTasks: number;
  pendingCount: number;
  completedCount: number;
  mitCount: number;
  overdueCount: number;
  bridgeActions: CrossModuleAction[];
  virtualRecurrences: VirtualRecurrenceItem[];
}

/**
 * Görevin takvimde yerleşeceği YYYY-MM-DD gününü döndürür.
 * Vade tarihi varsa onu, tarihsiz ama tamamlanmışsa Türkiye saatine göre tamamlanma gününü baz alır.
 */
export function getTaskCalendarDay(task: Pick<TaskItem, 'due_date' | 'status' | 'completed_at'>): string | null {
  if (task.due_date && /^\d{4}-\d{2}-\d{2}$/.test(task.due_date)) {
    return task.due_date;
  }
  if (task.status === 'completed') {
    return toTurkeyDay(task.completed_at);
  }
  return null;
}

/**
 * Seçili günün görevlerini filtreler ve saat sırasına (tamamlananlar en altta) dizer.
 */
export function filterTasksByDate(tasks: TaskItem[], dateStr: string): TaskItem[] {
  return tasks
    .filter(t => getTaskCalendarDay(t) === dateStr)
    .sort((a, b) => {
      const aDone = a.status === 'completed' ? 1 : 0;
      const bDone = b.status === 'completed' ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;

      const aTime = a.due_time?.trim() || '';
      const bTime = b.due_time?.trim() || '';
      if (aTime && bTime && aTime !== bTime) return aTime.localeCompare(bTime);
      if (aTime && !bTime) return -1;
      if (!aTime && bTime) return 1;

      return (b.is_mit ?? 0) - (a.is_mit ?? 0);
    });
}

function getDaysInUtcMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Tamamlanmamış tekrarlayan görevlerden, görünen takvim penceresi için
 * gelecek sanal tekrar tarihlerini O(1) atlamayla üretir.
 */
export function projectVirtualRecurrences(
  tasks: TaskItem[],
  rangeStartStr: string,
  rangeEndStr: string,
  todayStr: string
): VirtualRecurrenceItem[] {
  if (!rangeStartStr || !rangeEndStr || rangeStartStr > rangeEndStr) return [];

  const existingKeys = new Set<string>();
  for (const t of tasks) {
    if (t.due_date && /^\d{4}-\d{2}-\d{2}$/.test(t.due_date)) {
      existingKeys.add(`${t.due_date}|${t.title.trim().toLowerCase()}|${t.recurrence}`);
    }
  }

  const emittedKeys = new Set<string>();
  const results: VirtualRecurrenceItem[] = [];

  const pushIfNew = (task: TaskItem, dateStr: string) => {
    const key = `${dateStr}|${task.title.trim().toLowerCase()}|${task.recurrence}`;
    if (existingKeys.has(key) || emittedKeys.has(key)) return;
    emittedKeys.add(key);
    results.push({
      id: `vrec-${task.id}-${dateStr}`,
      sourceTaskId: task.id,
      title: task.title,
      pillar: task.pillar,
      priority: task.priority,
      recurrence: task.recurrence,
      due_date: dateStr,
      due_time: task.due_time,
      is_mit: task.is_mit
    });
  };

  for (const task of tasks) {
    if (task.status === 'completed') continue;
    if (!task.recurrence || task.recurrence === 'none') continue;
    if (!task.due_date || !/^\d{4}-\d{2}-\d{2}$/.test(task.due_date)) continue;

    const afterAnchor = shiftTurkeyDate(task.due_date, 1);
    let minDateStr = afterAnchor > todayStr ? afterAnchor : todayStr;
    if (rangeStartStr > minDateStr) minDateStr = rangeStartStr;
    if (minDateStr > rangeEndStr) continue;

    if (task.recurrence === 'daily') {
      let cursor = minDateStr;
      while (cursor <= rangeEndStr) {
        pushIfNew(task, cursor);
        cursor = shiftTurkeyDate(cursor, 1);
      }
    } else if (task.recurrence === 'weekly') {
      const diff = diffTurkeyCalendarDays(minDateStr, task.due_date);
      if (diff === null) continue;
      const stepDays = Math.max(7, Math.ceil(diff / 7) * 7);
      let cursor = shiftTurkeyDate(task.due_date, stepDays);
      while (cursor <= rangeEndStr) {
        pushIfNew(task, cursor);
        cursor = shiftTurkeyDate(cursor, 7);
      }
    } else if (task.recurrence === 'monthly') {
      const anchorDay = Number(task.due_date.slice(8, 10));
      let curYear = Number(minDateStr.slice(0, 4));
      let curMonth = Number(minDateStr.slice(5, 7)) - 1;
      const endYear = Number(rangeEndStr.slice(0, 4));
      const endMonth = Number(rangeEndStr.slice(5, 7)) - 1;

      while (curYear < endYear || (curYear === endYear && curMonth <= endMonth)) {
        const clampedDay = Math.min(anchorDay, getDaysInUtcMonth(curYear, curMonth));
        const candidate = `${curYear}-${String(curMonth + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
        if (candidate >= minDateStr && candidate <= rangeEndStr) {
          pushIfNew(task, candidate);
        }
        curMonth += 1;
        if (curMonth > 11) {
          curMonth = 0;
          curYear += 1;
        }
      }
    }
  }

  return results;
}

/**
 * Verilen yıl ve ay (0-11) için Pazartesi başlangıçlı aylık takvim ızgarasını üretir.
 */
export function buildTaskCalendarMonth(
  year: number,
  monthIndex: number,
  tasks: TaskItem[],
  crossModuleActions: CrossModuleAction[],
  todayStr: string
): TaskCalendarDay[] {
  const monthPrefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  const firstDayStr = `${monthPrefix}-01`;
  const firstUtc = new Date(Date.UTC(year, monthIndex, 1, 12, 0, 0));
  const leadingOffset = (firstUtc.getUTCDay() + 6) % 7; // Pazartesi = 0, Pazar = 6
  const daysInMonth = getDaysInUtcMonth(year, monthIndex);
  const totalCells = Math.ceil((leadingOffset + daysInMonth) / 7) * 7;

  const gridStartStr = shiftTurkeyDate(firstDayStr, -leadingOffset);
  const gridEndStr = shiftTurkeyDate(firstDayStr, totalCells - leadingOffset - 1);

  const tasksByDay = new Map<string, TaskItem[]>();
  for (const t of tasks) {
    const dayKey = getTaskCalendarDay(t);
    if (!dayKey || dayKey < gridStartStr || dayKey > gridEndStr) continue;
    const list = tasksByDay.get(dayKey) || [];
    list.push(t);
    tasksByDay.set(dayKey, list);
  }

  const bridgeByDay = new Map<string, CrossModuleAction[]>();
  for (const action of crossModuleActions) {
    if (!action.due_date || action.due_date < gridStartStr || action.due_date > gridEndStr) continue;
    const list = bridgeByDay.get(action.due_date) || [];
    list.push(action);
    bridgeByDay.set(action.due_date, list);
  }

  const virtualByDay = new Map<string, VirtualRecurrenceItem[]>();
  for (const vr of projectVirtualRecurrences(tasks, gridStartStr, gridEndStr, todayStr)) {
    const list = virtualByDay.get(vr.due_date) || [];
    list.push(vr);
    virtualByDay.set(vr.due_date, list);
  }

  const grid: TaskCalendarDay[] = [];
  for (let i = 0; i < totalCells; i++) {
    const dateStr = shiftTurkeyDate(gridStartStr, i);
    const dayTasks = tasksByDay.get(dateStr) || [];
    let pendingCount = 0;
    let completedCount = 0;
    let mitCount = 0;

    for (const t of dayTasks) {
      if (t.status === 'completed') {
        completedCount += 1;
      } else {
        pendingCount += 1;
        if (t.is_mit === 1) mitCount += 1;
      }
    }

    grid.push({
      dateStr,
      dayNumber: Number(dateStr.slice(8, 10)),
      isCurrentMonth: dateStr.slice(0, 7) === monthPrefix,
      isToday: dateStr === todayStr,
      totalTasks: dayTasks.length,
      pendingCount,
      completedCount,
      mitCount,
      overdueCount: dateStr < todayStr ? pendingCount : 0,
      bridgeActions: bridgeByDay.get(dateStr) || [],
      virtualRecurrences: virtualByDay.get(dateStr) || []
    });
  }

  return grid;
}
