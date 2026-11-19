import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import {
  tasks,
  familyMembers,
  recurringBills,
  walletsAccounts,
  vehicles,
  vehicleLegalReminders,
  homeMaintenanceRecords,
  digitalVaultItems,
  transactions,
  categories
} from '@/db/schema';
import { eq, and, or, ne, inArray, desc, sql } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import {
  TaskItem,
  TaskStatus,
  TaskRecurrence,
  Subtask,
  PILLAR_CONFIGS,
  PRIORITY_CONFIGS,
  parseSubtasks,
  calculateSubtaskProgress,
  calculateNextRecurrenceDate,
  resolveSubtaskDrivenStatus,
  summarizeTodayMit,
  validateMitConstraint,
  filterTasksByView,
  sortTasksForDisplay,
  computeFocusElapsedMinutes,
  normalizeFocusDurationMinutes,
  resolveCrossModuleFollowUp,
  CrossModuleFollowUp,
  generateCrossModuleActionItems
} from '@/lib/tasks-engine';
import { eventBus, EVENTS } from '@/lib/events';
import { getTodayTurkeyDate, shiftTurkeyDate, diffTurkeyCalendarDays, parseTurkeyCalendarDate } from '@/lib/date-utils';
import { calculateBillSchedule, calculateCreditCardSchedule } from '@/lib/bill-schedule';

type TaskRow = typeof tasks.$inferSelect;

const VALID_RECURRENCES = new Set(['none', 'daily', 'weekly', 'monthly']);

function getVisibleTasksWhere(userId: string, familyId?: string | null) {
  return familyId
    ? or(
        eq(tasks.user_id, userId),
        and(eq(tasks.family_id, familyId), eq(tasks.is_family_shared, 1))
      )
    : eq(tasks.user_id, userId);
}

async function notifyTaskCompleted(
  existing: TaskRow,
  nextLoggedMinutes: number,
  completedAt: string,
  userId: string,
  familyId?: string | null
): Promise<CrossModuleFollowUp | null> {
  await eventBus.emit(EVENTS.TASK_COMPLETED, {
    taskId: existing.id,
    title: existing.title,
    pillar: existing.pillar,
    isMit: Number(existing.is_mit) === 1,
    sourceModule: existing.source_module,
    sourceRefId: existing.source_ref_id,
    focusLoggedMinutes: nextLoggedMinutes,
    completedAt,
    userId,
    familyId
  });
  return resolveCrossModuleFollowUp(existing);
}

async function validateAssignedMemberInFamily(memberId: string | null, familyId: string): Promise<boolean> {
  if (!memberId) return true;
  const found = (await db.select({ id: familyMembers.id }).from(familyMembers).where(
    and(
      eq(familyMembers.id, memberId),
      eq(familyMembers.family_id, familyId),
      eq(familyMembers.is_active, 1)
    )
  ).limit(1))[0];
  return Boolean(found);
}

function normalizeSubtasksInput(raw: unknown): { error?: string; subtasks?: Subtask[] } {
  if (!Array.isArray(raw)) {
    return { error: 'Alt görev listesi geçerli bir dizi olmalıdır.' };
  }
  const normalized: Subtask[] = [];
  const usedIds = new Set<string>();
  for (let idx = 0; idx < raw.length; idx++) {
    const item = raw[idx];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { error: 'Alt görev öğeleri geçerli nesne formatında olmalıdır.' };
    }
    const record = item as Record<string, unknown>;
    if (typeof record.title !== 'string') {
      return { error: 'Alt görev öğelerinin başlık alanı metin olmalıdır.' };
    }
    const title = record.title.trim();
    if (!title) continue;
    const rawId = typeof record.id === 'string' ? record.id.trim() : '';
    const baseId = rawId || `sub-${idx + 1}`;
    let id = baseId;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);
    normalized.push({
      id,
      title,
      is_completed: Boolean(record.is_completed)
    });
  }
  return { subtasks: normalized };
}

function normalizeValidatedTaskFields(body: any): {
  error?: string;
  priority?: string;
  pillar?: string;
  recurrence?: string;
  dueDate?: string | null;
  dueTime?: string | null;
} {
  let priority: string | undefined;
  if (body.priority !== undefined) {
    const p = String(body.priority).trim();
    if (!(p in PRIORITY_CONFIGS)) {
      return { error: 'Geçersiz öncelik seviyesi.' };
    }
    priority = p;
  }

  let pillar: string | undefined;
  if (body.pillar !== undefined) {
    const pl = String(body.pillar).trim();
    if (!(pl in PILLAR_CONFIGS)) {
      return { error: 'Geçersiz yaşam sütunu.' };
    }
    pillar = pl;
  }

  let recurrence: string | undefined;
  if (body.recurrence !== undefined) {
    const r = String(body.recurrence).trim();
    if (!VALID_RECURRENCES.has(r)) {
      return { error: 'Geçersiz tekrarlama sıklığı.' };
    }
    recurrence = r;
  }

  let dueDate: string | null | undefined;
  if (body.due_date !== undefined) {
    const d = body.due_date ? String(body.due_date).trim() : '';
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      return { error: 'Geçersiz tarih formatı (YYYY-AA-GG bekleniyor).' };
    }
    dueDate = d || null;
  }

  let dueTime: string | null | undefined;
  if (body.due_time !== undefined) {
    const tm = body.due_time ? String(body.due_time).trim() : '';
    if (tm && !/^\d{2}:\d{2}$/.test(tm)) {
      return { error: 'Geçersiz saat formatı (SS:DD bekleniyor).' };
    }
    dueTime = tm || null;
  }

  return { priority, pillar, recurrence, dueDate, dueTime };
}

function resolveRescheduleTargetDate(rawDueDate: unknown, todayStr: string): { valid: boolean; dueDate: string | null } {
  if (rawDueDate === null) return { valid: true, dueDate: null };
  if (typeof rawDueDate !== 'string') return { valid: false, dueDate: null };
  const raw = rawDueDate.trim();
  if (!raw || raw === 'backlog') return { valid: true, dueDate: null };
  if (raw === 'today') return { valid: true, dueDate: todayStr };
  if (raw === 'tomorrow') return { valid: true, dueDate: shiftTurkeyDate(todayStr, 1) };
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw) && diffTurkeyCalendarDays(raw, raw) !== null) {
    return { valid: true, dueDate: raw };
  }
  return { valid: false, dueDate: null };
}

/**
 * Tekrarlayan görev tamamlandığında bir sonraki periyot görevini üretir.
 * Mükerrer kalkanı: aynı başlık + tekrar tipi + vade tarihine sahip bekleyen görev zaten varsa yenisi oluşturulmaz
 * (ör. son adımın işaretlenip kaldırılıp tekrar işaretlenmesi).
 */
async function spawnNextRecurringTask(
  existing: TaskRow,
  userId: string,
  familyId: string,
  nowISO: string
): Promise<{ id: string; due_date: string } | null> {
  if (!existing.recurrence || existing.recurrence === 'none') return null;
  const nextDueDate = calculateNextRecurrenceDate(existing.due_date, existing.recurrence as TaskRecurrence);
  if (!nextDueDate) return null;

  const ownerId = existing.user_id || userId;
  const visibilityScope = existing.is_family_shared === 1
    ? getVisibleTasksWhere(ownerId, familyId)
    : eq(tasks.user_id, ownerId);

  const duplicate = (await db.select({ id: tasks.id }).from(tasks).where(
    and(
      eq(tasks.title, existing.title),
      eq(tasks.recurrence, existing.recurrence),
      eq(tasks.due_date, nextDueDate),
      eq(tasks.status, 'pending'),
      visibilityScope
    )
  ).limit(1))[0];
  if (duplicate) return { id: duplicate.id, due_date: nextDueDate };

  let nextIsMit = existing.is_mit;
  if (Number(existing.is_mit) === 1) {
    const visibleTasks = await db.select({
      id: tasks.id,
      is_mit: tasks.is_mit,
      status: tasks.status,
      due_date: tasks.due_date
    }).from(tasks).where(getVisibleTasksWhere(ownerId, familyId));

    const mitCheck = validateMitConstraint(visibleTasks, nextDueDate);
    if (!mitCheck.allowed) {
      nextIsMit = 0;
    }
  }

  const nextTaskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  // Alt görevleri sıfırla
  const freshSubtasks = parseSubtasks(existing.subtasks_json).map(s => ({ ...s, is_completed: false }));

  await db.insert(tasks).values({
    id: nextTaskId,
    title: existing.title,
    description: existing.description,
    status: 'pending',
    priority: existing.priority,
    pillar: existing.pillar,
    is_mit: nextIsMit,
    due_date: nextDueDate,
    due_time: existing.due_time,
    recurrence: existing.recurrence,
    subtasks_json: JSON.stringify(freshSubtasks),
    is_family_shared: existing.is_family_shared,
    assigned_member_id: existing.assigned_member_id,
    source_module: existing.source_module,
    source_ref_id: existing.source_ref_id,
    completed_at: null,
    focus_started_at: null,
    focus_planned_minutes: existing.focus_planned_minutes ?? 25,
    focus_logged_minutes: 0,
    user_id: ownerId,
    family_id: familyId,
    created_at: nowISO,
    updated_at: nowISO
  });
  return { id: nextTaskId, due_date: nextDueDate };
}

export async function GET(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 });
    }

    const userId = user.id;
    const familyId = user.family_id || `fam-${userId}`;
    const today = new Date();
    const todayStr = getTodayTurkeyDate(today); // Vercel UTC çalışır; görev günü Europe/Istanbul'a göre belirlenir

    const { searchParams } = new URL(req.url);
    const view = searchParams.get('view') || 'all';
    const filter = searchParams.get('filter') || 'all'; // 'all', 'personal', 'family'
    const pillarParam = searchParams.get('pillar');
    const memberParam = searchParams.get('member_id');

    // 1. Aile Üyelerini Haritala (Avatar ve İsim Eşleştirmesi için; tarihsel görevlerde pasif üyelerin adı korunur)
    const membersList = await db.select().from(familyMembers).where(eq(familyMembers.family_id, familyId));
    const membersMap = new Map(membersList.map(m => [m.id, { name: m.name, avatar: m.avatar || '👤' }]));
    const activeMembers = membersList.filter(m => Number(m.is_active ?? 1) === 1);

    // 2. Görevleri Çek (OWASP BOLA)
    const rawTasks = await db.select().from(tasks)
      .where(getVisibleTasksWhere(userId, familyId))
      .orderBy(desc(tasks.is_mit), desc(tasks.created_at));

    // 3. Görevleri Zenginleştir
    const enrichedTasks: TaskItem[] = rawTasks.map(t => {
      const subtasks = parseSubtasks(t.subtasks_json);
      const subtasks_progress = calculateSubtaskProgress(subtasks);
      const memberInfo = t.assigned_member_id ? membersMap.get(t.assigned_member_id) : null;

      return {
        id: t.id,
        title: t.title,
        description: t.description,
        status: (t.status as any) || 'pending',
        priority: (t.priority as any) || 'medium',
        pillar: (t.pillar as any) || 'general',
        is_mit: t.is_mit ?? 0,
        due_date: t.due_date,
        due_time: t.due_time,
        recurrence: (t.recurrence as any) || 'none',
        subtasks_json: t.subtasks_json,
        subtasks,
        subtasks_progress,
        is_family_shared: t.is_family_shared ?? 0,
        assigned_member_id: t.assigned_member_id,
        assigned_member_name: memberInfo?.name || null,
        assigned_member_avatar: memberInfo?.avatar || null,
        source_module: t.source_module,
        source_ref_id: t.source_ref_id,
        completed_at: t.completed_at,
        focus_started_at: t.focus_started_at || null,
        focus_planned_minutes: t.focus_planned_minutes ?? 25,
        focus_logged_minutes: t.focus_logged_minutes ?? 0,
        user_id: t.user_id,
        family_id: t.family_id,
        created_at: t.created_at,
        updated_at: t.updated_at
      };
    });

    // 4. Görünüm ve Filtreleri Uygula
    let filteredList = filterTasksByView(enrichedTasks, view, todayStr);

    if (filter === 'personal') {
      filteredList = filteredList.filter(t => t.is_family_shared === 0);
    } else if (filter === 'family') {
      filteredList = filteredList.filter(t => t.is_family_shared === 1);
    }

    if (pillarParam && pillarParam !== 'all') {
      filteredList = filteredList.filter(t => t.pillar === pillarParam);
    }

    if (memberParam && memberParam !== 'all') {
      filteredList = filteredList.filter(t => t.assigned_member_id === memberParam);
    }

    // 5. Günlük MIT Özeti Hesapla (Tek kaynak: tasks-engine)
    const { activeMitCount, completedMitCount, maxMit } = summarizeTodayMit(enrichedTasks, todayStr);

    // 6. Modüller Arası Aksiyon Köprüsü (Cross-Module Action Bridge)
    let crossModuleActions: any[] = [];
    try {
      const [billsData, accountsData, vehiclesData, homeMaintData, vaultData] = await Promise.all([
        db.select().from(recurringBills).where(
          and(
            eq(recurringBills.status, 'active'),
            familyId
              ? or(eq(recurringBills.user_id, userId), eq(recurringBills.family_id, familyId))
              : eq(recurringBills.user_id, userId)
          )
        ),
        db.select().from(walletsAccounts).where(
          and(
            eq(walletsAccounts.is_active, 1),
            familyId
              ? or(
                  eq(walletsAccounts.user_id, userId),
                  and(eq(walletsAccounts.family_id, familyId), eq(walletsAccounts.is_family_shared, 1)),
                  and(eq(walletsAccounts.family_id, familyId), sql`${walletsAccounts.user_id} IS NULL`)
                )
              : eq(walletsAccounts.user_id, userId)
          )
        ),
        db.select().from(vehicles).where(
          and(
            eq(vehicles.is_active, 1),
            familyId
              ? or(
                  eq(vehicles.user_id, userId),
                  and(eq(vehicles.family_id, familyId), eq(vehicles.is_family_shared, 1))
                )
              : eq(vehicles.user_id, userId)
          )
        ),
        db.select().from(homeMaintenanceRecords).where(
          familyId
            ? or(eq(homeMaintenanceRecords.user_id, userId), eq(homeMaintenanceRecords.family_id, familyId))
            : eq(homeMaintenanceRecords.user_id, userId)
        ),
        db.select().from(digitalVaultItems).where(
          familyId
            ? or(
                eq(digitalVaultItems.user_id, userId),
                and(eq(digitalVaultItems.family_id, familyId), eq(digitalVaultItems.is_family_shared, 1))
              )
            : eq(digitalVaultItems.user_id, userId)
        )
      ]);

      // Kredi Kartı Ekstre Kontrolü
      const ccAccounts = accountsData.filter(a => a.type === 'credit_card' && (a.balance || 0) > 0 && a.due_day);
      const ccIds = ccAccounts.map(a => a.id);
      const [cardTxs, taskCategories] = ccIds.length > 0
        ? await Promise.all([
            db.select({
              wallet_id: transactions.wallet_id,
              amount: transactions.amount,
              transaction_date: transactions.transaction_date,
              is_installment: transactions.is_installment,
              merchant: transactions.merchant,
              notes: transactions.notes,
              category_id: transactions.category_id
            }).from(transactions).where(inArray(transactions.wallet_id, ccIds)),
            familyId
              ? db.select({ id: categories.id, type: categories.type })
                  .from(categories)
                  .where(eq(categories.family_id, familyId))
              : Promise.resolve([])
          ])
        : [[], []];

      const taskCategoryTypeMap = new Map(taskCategories.map(c => [c.id, c.type]));

      const turkeyToday = parseTurkeyCalendarDate(todayStr);

      const parsedCC = ccAccounts.map(acc => {
        const txsForCard = cardTxs
          .filter(t => t.wallet_id === acc.id)
          .map(t => ({
            amount: t.amount,
            transaction_date: t.transaction_date,
            is_installment: t.is_installment,
            merchant: t.merchant,
            notes: t.notes,
            categoryType: t.category_id ? taskCategoryTypeMap.get(t.category_id) || null : null
          }));
        const sched = calculateCreditCardSchedule(acc, txsForCard, turkeyToday);
        return {
          id: acc.id,
          name: acc.name,
          balance: acc.balance || 0,
          closed_statement_debt: sched.closed_statement_debt,
          overdue_amount: sched.overdue_amount,
          days_until_due: sched.days_until_due,
          next_due_date: sched.is_overdue ? sched.last_due_date : sched.next_due_date,
          is_overdue: sched.is_overdue,
          days_overdue: sched.days_overdue,
          is_family_shared: acc.is_family_shared ?? 0
        };
      });

      // Fatura Tarih Kontrolü (monthly/quarterly/yearly periyotlarına göre Türkiye takvim günü)
      const parsedBills = billsData.flatMap(b => {
        const sched = calculateBillSchedule(b, turkeyToday);
        const dueMonth = sched.next_due_date.slice(0, 7);
        if (b.last_paid_month && b.last_paid_month >= dueMonth) {
          return [];
        }
        return [{
          id: b.id,
          name: b.name,
          amount: b.amount || 0,
          due_day: b.due_day,
          due_date: sched.next_due_date,
          days_left: sched.days_left
        }];
      });

      // Araç Yasal Hatırlatıcılar
      const vIds = vehiclesData.map(v => v.id);
      const legals = vIds.length > 0
        ? await db.select().from(vehicleLegalReminders).where(
            and(
              eq(vehicleLegalReminders.is_completed, 0),
              inArray(vehicleLegalReminders.vehicle_id, vIds)
            )
          )
        : [];
      const parsedVehicles = legals.flatMap(l => {
        const daysLeft = diffTurkeyCalendarDays(l.due_date, todayStr);
        if (daysLeft === null) return [];
        const matchedV = vehiclesData.find(v => v.id === l.vehicle_id);
        return [{
          id: l.id,
          type: l.type,
          due_date: l.due_date,
          days_left: daysLeft,
          plate: matchedV?.plate,
          is_family_shared: matchedV?.is_family_shared ?? 1
        }];
      });

      // Ev Bakımları
      const parsedHome = homeMaintData.flatMap(h => {
        const daysLeft = diffTurkeyCalendarDays(h.next_due_date, todayStr);
        if (daysLeft === null && h.status !== 'warning') return [];
        return [{
          id: h.id,
          title: h.title,
          next_due_date: h.next_due_date,
          days_left: daysLeft ?? 0,
          status: h.status
        }];
      });

      // Kasa Evrakları
      const parsedVault = vaultData.flatMap(v => {
        if (!v.expiry_date) return [];
        const daysLeft = diffTurkeyCalendarDays(v.expiry_date, todayStr);
        if (daysLeft === null) return [];
        return [{
          id: v.id,
          title: v.title,
          expiry_date: v.expiry_date,
          days_left: daysLeft,
          type: v.type,
          is_family_shared: v.is_family_shared ?? 0
        }];
      });

      crossModuleActions = generateCrossModuleActionItems({
        bills: parsedBills,
        creditCards: parsedCC,
        vehicles: parsedVehicles,
        homeMaintenance: parsedHome,
        vaultItems: parsedVault,
        existingTasks: rawTasks,
        todayStr
      });
    } catch (cmErr) {
      console.warn('Cross-module bridge generation notice:', cmErr);
    }

    return NextResponse.json({
      success: true,
      data: {
        tasks: filteredList,
        totalCount: enrichedTasks.length,
        mitSummary: {
          activeMitCount,
          completedMitCount,
          maxMit
        },
        crossModuleActions,
        members: activeMembers.map(m => ({ id: m.id, name: m.name, avatar: m.avatar || '👤' }))
      }
    });
  } catch (error: any) {
    console.error('Tasks GET error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Görevler alınamadı.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 });
    }

    const userId = user.id;
    const familyId = user.family_id || `fam-${userId}`;
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'create';
    const nowISO = new Date().toISOString();

    // ==========================================
    // 1. GÖREV OLUŞTURMA (action: create)
    // ==========================================
    if (action === 'create') {
      const title = String(body.title || '').trim();
      if (!title) {
        return NextResponse.json({ success: false, error: 'Görev başlığı boş bırakılamaz.' }, { status: 400 });
      }

      const validated = normalizeValidatedTaskFields(body);
      if (validated.error) {
        return NextResponse.json({ success: false, error: validated.error }, { status: 400 });
      }

      const assignedMemberId = body.assigned_member_id ? String(body.assigned_member_id).trim() : null;
      if (!(await validateAssignedMemberInFamily(assignedMemberId, familyId))) {
        return NextResponse.json({ success: false, error: 'Seçilen aile üyesi bu hanede bulunamadı.' }, { status: 400 });
      }

      const isMit = body.is_mit ? 1 : 0;
      const dueDate = validated.dueDate ?? null;

      // MIT Kalkanı: Aynı günde en fazla 3 aktif odak görevi olabilir
      if (isMit === 1) {
        const existingTasks = await db.select({
          id: tasks.id,
          is_mit: tasks.is_mit,
          status: tasks.status,
          due_date: tasks.due_date
        }).from(tasks).where(getVisibleTasksWhere(userId, familyId));

        const mitCheck = validateMitConstraint(existingTasks, dueDate);
        if (!mitCheck.allowed) {
          return NextResponse.json({
            success: false,
            error: 'Günde en fazla 3 odak görevi (MIT) belirleyebilirsiniz. Lütfen mevcut bir odak görevini tamamlayın veya kaldırın.'
          }, { status: 400 });
        }
      }

      const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const subtasksJson = Array.isArray(body.subtasks)
        ? JSON.stringify(body.subtasks)
        : (body.subtasks_json || '[]');
      const initialStatus = body.status === 'in_progress' || body.status === 'completed' ? body.status : 'pending';
      const initialCompletedAt = initialStatus === 'completed' ? nowISO : null;
      const initialFocusStartedAt = initialStatus === 'in_progress' ? nowISO : null;
      const initialPlannedMinutes = normalizeFocusDurationMinutes(
        body.focus_planned_minutes ?? body.duration_minutes ?? 25
      );

      // Yeni görev doğrudan odakta (in_progress) başlatılıyorsa diğer açık odakları kısmi süresiyle beklemeye al
      if (initialStatus === 'in_progress') {
        const nowDate = new Date(nowISO);
        const otherRunningQuery = db.select().from(tasks).where(
          and(
            getVisibleTasksWhere(userId, familyId),
            eq(tasks.status, 'in_progress')
          )
        );
        const otherRunningTasks = (await otherRunningQuery) || [];
        for (const other of otherRunningTasks) {
          const added = computeFocusElapsedMinutes(other.focus_started_at, other.focus_planned_minutes, nowDate);
          await db.update(tasks).set({
            status: 'pending',
            focus_started_at: null,
            focus_logged_minutes: (other.focus_logged_minutes ?? 0) + added,
            updated_at: nowISO
          }).where(eq(tasks.id, other.id));
        }
      }

      const newTaskValues = {
        id: taskId,
        title,
        description: body.description ? String(body.description).trim() : null,
        status: initialStatus,
        priority: validated.priority || 'medium',
        pillar: validated.pillar || 'general',
        is_mit: isMit,
        due_date: dueDate,
        due_time: validated.dueTime ?? null,
        recurrence: validated.recurrence || 'none',
        subtasks_json: subtasksJson,
        is_family_shared: body.is_family_shared ? 1 : 0,
        assigned_member_id: assignedMemberId,
        source_module: body.source_module || 'manual',
        source_ref_id: body.source_ref_id || null,
        completed_at: initialCompletedAt,
        focus_started_at: initialFocusStartedAt,
        focus_planned_minutes: initialPlannedMinutes,
        focus_logged_minutes: 0,
        user_id: userId,
        family_id: familyId,
        created_at: nowISO,
        updated_at: nowISO
      };

      await db.insert(tasks).values(newTaskValues);

      if (initialStatus === 'completed') {
        await notifyTaskCompleted(newTaskValues as unknown as TaskRow, 0, nowISO, userId, familyId);
      }

      return NextResponse.json({
        success: true,
        message: 'Görev başarıyla oluşturuldu.',
        data: { id: taskId }
      });
    }

    // ==========================================
    // 2. GÖREV TAMAMLAMA DURUMU (action: toggle_complete)
    // ==========================================
    if (action === 'toggle_complete') {
      const taskId = String(body.task_id || '').trim();
      if (!taskId) {
        return NextResponse.json({ success: false, error: 'Görev ID girilmedi.' }, { status: 400 });
      }

      const existing = (await db.select().from(tasks).where(
        and(
          eq(tasks.id, taskId),
          getVisibleTasksWhere(userId, familyId)
        )
      ).limit(1))[0];

      if (!existing) {
        return NextResponse.json({ success: false, error: 'Görev bulunamadı veya yetkisiz erişim.' }, { status: 404 });
      }

      const isCompleted = existing.status === 'completed';
      const nextStatus = isCompleted ? 'pending' : 'completed';
      const completedAt = isCompleted ? null : nowISO;
      const nowDate = new Date(nowISO);
      const focusSettlement = !isCompleted && existing.focus_started_at
        ? {
            focus_started_at: null,
            focus_logged_minutes:
              (existing.focus_logged_minutes ?? 0) +
              computeFocusElapsedMinutes(existing.focus_started_at, existing.focus_planned_minutes, nowDate)
          }
        : {};

      const todayStr = getTodayTurkeyDate(nowDate);
      let nextDueDate = existing.due_date;
      if (isCompleted && body.due_date !== undefined) {
        const parsedDate = resolveRescheduleTargetDate(body.due_date, todayStr);
        if (!parsedDate.valid) {
          return NextResponse.json({ success: false, error: 'Geçersiz hedef erteleme tarihi.' }, { status: 400 });
        }
        nextDueDate = parsedDate.dueDate;
      }

      if (isCompleted && Number(existing.is_mit) === 1) {
        const visibleTasks = await db.select({
          id: tasks.id,
          is_mit: tasks.is_mit,
          status: tasks.status,
          due_date: tasks.due_date
        }).from(tasks).where(getVisibleTasksWhere(userId, familyId));

        const mitCheck = validateMitConstraint(visibleTasks, nextDueDate, taskId);
        if (!mitCheck.allowed) {
          return NextResponse.json({
            success: false,
            error: 'Bu gün için 3 aktif odak görevi (MIT) zaten dolu. Görevi yeniden açmadan önce bir odağı tamamlayın veya çıkarın.'
          }, { status: 400 });
        }
      }

      await db.update(tasks).set({
        status: nextStatus,
        completed_at: completedAt,
        ...(isCompleted && body.due_date !== undefined ? { due_date: nextDueDate } : {}),
        ...focusSettlement,
        updated_at: nowISO
      }).where(and(eq(tasks.id, taskId), getVisibleTasksWhere(userId, familyId)));

      // Tekrarlayan Görev Döngüsü: Eğer görev tamamlandıysa ve recurrence varsa bir sonraki periyot görevini otomatik üret
      const spawnedNextTask = !isCompleted
        ? await spawnNextRecurringTask(existing, userId, familyId, nowISO)
        : null;
      const followUpAction = !isCompleted
        ? await notifyTaskCompleted(
            existing,
            focusSettlement.focus_logged_minutes ?? (existing.focus_logged_minutes ?? 0),
            nowISO,
            userId,
            familyId
          )
        : null;

      return NextResponse.json({
        success: true,
        message: isCompleted ? 'Görev yapılmadı olarak işaretlendi.' : 'Tebrikler! Görev tamamlandı 🎉',
        data: {
          task_id: taskId,
          status: nextStatus,
          spawned_next_task: spawnedNextTask,
          ...(followUpAction ? { follow_up_action: followUpAction } : {})
        }
      });
    }

    // ==========================================
    // 3. ALT GÖREV DÜZENLEME (action: toggle_subtask)
    // ==========================================
    if (action === 'toggle_subtask') {
      const taskId = String(body.task_id || '').trim();
      const subtaskId = String(body.subtask_id || '').trim();

      const existing = (await db.select().from(tasks).where(
        and(
          eq(tasks.id, taskId),
          getVisibleTasksWhere(userId, familyId)
        )
      ).limit(1))[0];

      if (!existing) {
        return NextResponse.json({ success: false, error: 'Görev bulunamadı.' }, { status: 404 });
      }

      const subtasks = parseSubtasks(existing.subtasks_json);
      const updatedSubtasks = subtasks.map(s => {
        if (s.id === subtaskId) {
          return { ...s, is_completed: !s.is_completed };
        }
        return s;
      });

      // Adım → Görev senkronu: tüm adımlar bitince görev tamamlanır, bir adım geri alınınca görev yeniden açılır
      const { nextStatus, transition } = resolveSubtaskDrivenStatus(updatedSubtasks, existing.status);

      if (transition === 'reopened' && Number(existing.is_mit) === 1) {
        const visibleTasks = await db.select({
          id: tasks.id,
          is_mit: tasks.is_mit,
          status: tasks.status,
          due_date: tasks.due_date
        }).from(tasks).where(getVisibleTasksWhere(userId, familyId));

        const mitCheck = validateMitConstraint(visibleTasks, existing.due_date, taskId);
        if (!mitCheck.allowed) {
          return NextResponse.json({
            success: false,
            error: 'Bu gün için 3 aktif odak görevi (MIT) zaten dolu. Adımı geri almadan önce bir odağı tamamlayın veya çıkarın.'
          }, { status: 400 });
        }
      }

      const subtaskFocusSettlement = transition === 'completed' && existing.focus_started_at
        ? {
            focus_started_at: null,
            focus_logged_minutes:
              (existing.focus_logged_minutes ?? 0) +
              computeFocusElapsedMinutes(existing.focus_started_at, existing.focus_planned_minutes, new Date(nowISO))
          }
        : {};

      await db.update(tasks).set({
        subtasks_json: JSON.stringify(updatedSubtasks),
        ...(transition !== 'none'
          ? { status: nextStatus, completed_at: transition === 'completed' ? nowISO : null }
          : {}),
        ...subtaskFocusSettlement,
        updated_at: nowISO
      }).where(and(eq(tasks.id, taskId), getVisibleTasksWhere(userId, familyId)));

      const spawnedNextTask = transition === 'completed'
        ? await spawnNextRecurringTask(existing, userId, familyId, nowISO)
        : null;
      const followUpAction = transition === 'completed'
        ? await notifyTaskCompleted(
            existing,
            subtaskFocusSettlement.focus_logged_minutes ?? (existing.focus_logged_minutes ?? 0),
            nowISO,
            userId,
            familyId
          )
        : null;

      return NextResponse.json({
        success: true,
        message: transition === 'completed'
          ? 'Tüm adımlar tamamlandı, görev kapandı 🎉'
          : transition === 'reopened'
            ? 'Adım geri alındı, görev yeniden açıldı.'
            : undefined,
        data: {
          task_id: taskId,
          subtasks: updatedSubtasks,
          progress: calculateSubtaskProgress(updatedSubtasks),
          task_status: nextStatus,
          transition,
          spawned_next_task: spawnedNextTask,
          ...(followUpAction ? { follow_up_action: followUpAction } : {})
        }
      });
    }

    // ==========================================
    // 4. MIT AÇ/KAPAT (action: toggle_mit)
    // ==========================================
    if (action === 'toggle_mit') {
      const taskId = String(body.task_id || '').trim();

      const existing = (await db.select().from(tasks).where(
        and(
          eq(tasks.id, taskId),
          getVisibleTasksWhere(userId, familyId)
        )
      ).limit(1))[0];

      if (!existing) {
        return NextResponse.json({ success: false, error: 'Görev bulunamadı.' }, { status: 404 });
      }

      const nextMit = existing.is_mit === 1 ? 0 : 1;

      if (nextMit === 1) {
        const allUserTasks = await db.select({
          id: tasks.id,
          is_mit: tasks.is_mit,
          status: tasks.status,
          due_date: tasks.due_date
        }).from(tasks).where(getVisibleTasksWhere(userId, familyId));

        const mitCheck = validateMitConstraint(allUserTasks, existing.due_date, taskId);
        if (!mitCheck.allowed) {
          return NextResponse.json({
            success: false,
            error: 'Günde en fazla 3 odak görevi (MIT) belirleyebilirsiniz.'
          }, { status: 400 });
        }
      }

      await db.update(tasks).set({
        is_mit: nextMit,
        updated_at: nowISO
      }).where(and(eq(tasks.id, taskId), getVisibleTasksWhere(userId, familyId)));

      return NextResponse.json({
        success: true,
        message: nextMit === 1 ? '🔥 Günün odak görevi (MIT) olarak eklendi!' : 'Odak görevi işareti kaldırıldı.',
        data: { task_id: taskId, is_mit: nextMit }
      });
    }

    // ==========================================
    // 4.5 TEKLİ & TOPLU HIZLI ERTELEME (reschedule / reschedule_overdue)
    // ==========================================
    if (action === 'reschedule') {
      const taskId = String(body.task_id || '').trim();
      if (!taskId) {
        return NextResponse.json({ success: false, error: 'Görev ID girilmedi.' }, { status: 400 });
      }

      const todayStr = getTodayTurkeyDate();
      const parsedTarget = resolveRescheduleTargetDate(body.due_date, todayStr);
      if (!parsedTarget.valid) {
        return NextResponse.json({ success: false, error: 'Geçersiz hedef erteleme tarihi.' }, { status: 400 });
      }
      const targetDueDate = parsedTarget.dueDate;

      const existing = (await db.select().from(tasks).where(
        and(
          eq(tasks.id, taskId),
          getVisibleTasksWhere(userId, familyId)
        )
      ).limit(1))[0];

      if (!existing) {
        return NextResponse.json({ success: false, error: 'Görev bulunamadı.' }, { status: 404 });
      }

      if (existing.status === 'completed') {
        return NextResponse.json({ success: false, error: 'Tamamlanmış görev ertelenemez.' }, { status: 400 });
      }

      let nextIsMit = Number(existing.is_mit) === 1 ? 1 : 0;
      let mitDowngraded = false;

      if (nextIsMit === 1 && targetDueDate !== existing.due_date) {
        const visibleTasks = await db.select({
          id: tasks.id,
          is_mit: tasks.is_mit,
          status: tasks.status,
          due_date: tasks.due_date
        }).from(tasks).where(getVisibleTasksWhere(userId, familyId));

        const mitCheck = validateMitConstraint(visibleTasks, targetDueDate, taskId);
        if (!mitCheck.allowed) {
          nextIsMit = 0;
          mitDowngraded = true;
        }
      }

      await db.update(tasks).set({
        due_date: targetDueDate,
        is_mit: nextIsMit,
        updated_at: nowISO
      }).where(and(eq(tasks.id, taskId), getVisibleTasksWhere(userId, familyId)));

      const baseMsg = targetDueDate === null
        ? '📥 Görev backlog (tarihsiz) listesine alındı.'
        : targetDueDate === todayStr
          ? '☀️ Görev bugüne alındı.'
          : targetDueDate === shiftTurkeyDate(todayStr, 1)
            ? '📅 Görev yarına ertelendi.'
            : `📅 Görev ${targetDueDate} tarihine taşındı.`;

      return NextResponse.json({
        success: true,
        message: mitDowngraded
          ? `${baseMsg} (Hedef günde 3 MIT kotası dolu olduğu için odak işareti kaldırıldı.)`
          : baseMsg,
        data: {
          task_id: taskId,
          due_date: targetDueDate,
          is_mit: nextIsMit,
          mit_downgraded: mitDowngraded
        }
      });
    }

    if (action === 'reschedule_overdue') {
      const todayStr = getTodayTurkeyDate();
      const parsedTarget = body.target_date !== undefined
        ? resolveRescheduleTargetDate(body.target_date, todayStr)
        : { valid: true, dueDate: todayStr };
      const targetDate = parsedTarget.valid ? parsedTarget.dueDate : null;

      if (!targetDate) {
        return NextResponse.json({ success: false, error: 'Geçersiz hedef erteleme tarihi.' }, { status: 400 });
      }

      const visibleTasks = await db.select().from(tasks).where(getVisibleTasksWhere(userId, familyId));
      const requestedIds = Array.isArray(body.task_ids)
        ? new Set(body.task_ids.map((id: unknown) => String(id || '').trim()).filter(Boolean))
        : null;

      const overdueCandidates = visibleTasks.filter(t => {
        if (t.status === 'completed' || !t.due_date || t.due_date >= todayStr) return false;
        if (requestedIds && !requestedIds.has(t.id)) return false;
        return true;
      });

      if (overdueCandidates.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'Ertelenecek gecikmiş görev bulunamadı.',
          data: { updated_count: 0, downgraded_mit_count: 0, target_date: targetDate }
        });
      }

      const candidateIdSet = new Set(overdueCandidates.map(t => t.id));
      const existingTargetMitCount = visibleTasks.filter(t =>
        !candidateIdSet.has(t.id)
        && t.status !== 'completed'
        && Number(t.is_mit) === 1
        && (!t.due_date || t.due_date === targetDate)
      ).length;

      let remainingMitSlots = Math.max(0, 3 - existingTargetMitCount);
      const sortedCandidates = sortTasksForDisplay(overdueCandidates as any[], 'today');
      const keepMitIds: string[] = [];
      const downgradeMitIds: string[] = [];

      for (const cand of sortedCandidates) {
        if (Number(cand.is_mit) === 1) {
          if (remainingMitSlots > 0) {
            keepMitIds.push(cand.id);
            remainingMitSlots -= 1;
          } else {
            downgradeMitIds.push(cand.id);
          }
        } else {
          keepMitIds.push(cand.id);
        }
      }

      if (keepMitIds.length > 0) {
        await db.update(tasks).set({
          due_date: targetDate,
          updated_at: nowISO
        }).where(and(inArray(tasks.id, keepMitIds), getVisibleTasksWhere(userId, familyId)));
      }

      if (downgradeMitIds.length > 0) {
        await db.update(tasks).set({
          due_date: targetDate,
          is_mit: 0,
          updated_at: nowISO
        }).where(and(inArray(tasks.id, downgradeMitIds), getVisibleTasksWhere(userId, familyId)));
      }

      return NextResponse.json({
        success: true,
        message: downgradeMitIds.length > 0
          ? `☀️ ${overdueCandidates.length} gecikmiş görev bugüne alındı (${downgradeMitIds.length} görevde MIT kotası nedeniyle odak kaldırıldı).`
          : `☀️ ${overdueCandidates.length} gecikmiş görev bugüne alındı!`,
        data: {
          updated_count: overdueCandidates.length,
          downgraded_mit_count: downgradeMitIds.length,
          target_date: targetDate
        }
      });
    }

    // ==========================================
    // 4.6 ODAK ZAMANLAYICISI / POMODORO (start_focus / pause_focus / complete_focus)
    // ==========================================
    if (action === 'start_focus') {
      const taskId = String(body.task_id || '').trim();
      if (!taskId) {
        return NextResponse.json({ success: false, error: 'Görev ID girilmedi.' }, { status: 400 });
      }

      const existing = (await db.select().from(tasks).where(
        and(
          eq(tasks.id, taskId),
          getVisibleTasksWhere(userId, familyId)
        )
      ).limit(1))[0];

      if (!existing) {
        return NextResponse.json({ success: false, error: 'Görev bulunamadı.' }, { status: 404 });
      }

      if (existing.status === 'completed' && !body.reopen_if_completed) {
        return NextResponse.json({ success: false, error: 'Tamamlanmış görevde odak sayacı başlatılamaz.' }, { status: 400 });
      }

      if (existing.status === 'completed' && Number(existing.is_mit) === 1) {
        const visibleTasks = await db.select({
          id: tasks.id,
          is_mit: tasks.is_mit,
          status: tasks.status,
          due_date: tasks.due_date
        }).from(tasks).where(getVisibleTasksWhere(userId, familyId));

        const mitCheck = validateMitConstraint(visibleTasks, existing.due_date, taskId);
        if (!mitCheck.allowed) {
          return NextResponse.json({
            success: false,
            error: 'Bu gün için 3 aktif odak görevi (MIT) zaten dolu. Görevi yeniden açmadan önce bir odağı tamamlayın veya çıkarın.'
          }, { status: 400 });
        }
      }

      const plannedMinutes = normalizeFocusDurationMinutes(
        body.duration_minutes ?? existing.focus_planned_minutes ?? 25
      );
      const nowDate = new Date(nowISO);

      // Görünür diğer in_progress görevi varsa kısmi süresini kaydedip beklemeye al (aynı anda tek aktif sayaç)
      const otherRunningTasks = await db.select().from(tasks).where(
        and(
          getVisibleTasksWhere(userId, familyId),
          eq(tasks.status, 'in_progress'),
          ne(tasks.id, taskId)
        )
      );

      for (const other of otherRunningTasks) {
        const added = computeFocusElapsedMinutes(other.focus_started_at, other.focus_planned_minutes, nowDate);
        await db.update(tasks).set({
          status: 'pending',
          focus_started_at: null,
          focus_logged_minutes: (other.focus_logged_minutes ?? 0) + added,
          updated_at: nowISO
        }).where(eq(tasks.id, other.id));
      }

      // Aynı görev zaten odaktaysa önceki kısmi süreyi biriktirip yeniden başlat
      const currentSelfAdded = existing.status === 'in_progress'
        ? computeFocusElapsedMinutes(existing.focus_started_at, existing.focus_planned_minutes, nowDate)
        : 0;
      const nextSelfLogged = (existing.focus_logged_minutes ?? 0) + currentSelfAdded;

      await db.update(tasks).set({
        status: 'in_progress',
        ...(existing.status === 'completed' ? { completed_at: null } : {}),
        focus_started_at: nowISO,
        focus_planned_minutes: plannedMinutes,
        focus_logged_minutes: nextSelfLogged,
        updated_at: nowISO
      }).where(and(eq(tasks.id, taskId), getVisibleTasksWhere(userId, familyId)));

      return NextResponse.json({
        success: true,
        message: `⏱️ ${plannedMinutes} dakikalık odak seansı başladı!`,
        data: {
          task_id: taskId,
          status: 'in_progress',
          focus_started_at: nowISO,
          focus_planned_minutes: plannedMinutes,
          focus_logged_minutes: nextSelfLogged
        }
      });
    }

    if (action === 'pause_focus' || action === 'complete_focus') {
      const taskId = String(body.task_id || '').trim();
      if (!taskId) {
        return NextResponse.json({ success: false, error: 'Görev ID girilmedi.' }, { status: 400 });
      }

      const existing = (await db.select().from(tasks).where(
        and(
          eq(tasks.id, taskId),
          getVisibleTasksWhere(userId, familyId)
        )
      ).limit(1))[0];

      if (!existing) {
        return NextResponse.json({ success: false, error: 'Görev bulunamadı.' }, { status: 404 });
      }

      const addedMinutes = computeFocusElapsedMinutes(
        existing.focus_started_at,
        existing.focus_planned_minutes,
        new Date(nowISO)
      );
      const nextLoggedMinutes = (existing.focus_logged_minutes ?? 0) + addedMinutes;
      const shouldCompleteTask = action === 'complete_focus' && Boolean(body.complete_task);
      const nextStatus = existing.status === 'completed' || shouldCompleteTask ? 'completed' : 'pending';

      const todayStr = getTodayTurkeyDate();
      let nextDueDate = existing.due_date;
      let nextIsMit = Number(existing.is_mit) === 1 ? 1 : 0;
      if (action === 'pause_focus' && body.due_date !== undefined) {
        const parsedTarget = resolveRescheduleTargetDate(body.due_date, todayStr);
        if (!parsedTarget.valid) {
          return NextResponse.json({ success: false, error: 'Geçersiz hedef erteleme tarihi.' }, { status: 400 });
        }
        nextDueDate = parsedTarget.dueDate;
        if (nextIsMit === 1 && nextDueDate !== existing.due_date) {
          const visibleTasks = await db.select({
            id: tasks.id,
            is_mit: tasks.is_mit,
            status: tasks.status,
            due_date: tasks.due_date
          }).from(tasks).where(getVisibleTasksWhere(userId, familyId));

          const mitCheck = validateMitConstraint(visibleTasks, nextDueDate, taskId);
          if (!mitCheck.allowed) {
            nextIsMit = 0;
          }
        }
      }

      await db.update(tasks).set({
        status: nextStatus,
        ...(shouldCompleteTask && existing.status !== 'completed' ? { completed_at: nowISO } : {}),
        ...(action === 'pause_focus' && body.due_date !== undefined
          ? { due_date: nextDueDate, is_mit: nextIsMit }
          : {}),
        focus_started_at: null,
        focus_logged_minutes: nextLoggedMinutes,
        updated_at: nowISO
      }).where(and(eq(tasks.id, taskId), getVisibleTasksWhere(userId, familyId)));

      const spawnedNextTask = shouldCompleteTask && existing.status !== 'completed'
        ? await spawnNextRecurringTask(existing, userId, familyId, nowISO)
        : null;
      const followUpAction = shouldCompleteTask && existing.status !== 'completed'
        ? await notifyTaskCompleted(existing, nextLoggedMinutes, nowISO, userId, familyId)
        : null;

      let message = '⏸️ Odak sayacı duraklatıldı.';
      if (shouldCompleteTask) {
        message = addedMinutes > 0
          ? `🎉 Görev ve +${addedMinutes} dk odak seansı tamamlandı!`
          : '🎉 Görev tamamlandı!';
      } else if (action === 'complete_focus') {
        message = addedMinutes > 0
          ? `✅ Odak seansı kaydedildi (+${addedMinutes} dk).`
          : '✅ Odak seansı kapatıldı.';
      } else if (addedMinutes > 0) {
        message = `⏸️ Odak duraklatıldı (+${addedMinutes} dk kaydedildi).`;
      }

      return NextResponse.json({
        success: true,
        message,
        data: {
          task_id: taskId,
          status: nextStatus,
          added_minutes: addedMinutes,
          focus_logged_minutes: nextLoggedMinutes,
          spawned_next_task: spawnedNextTask,
          ...(followUpAction ? { follow_up_action: followUpAction } : {})
        }
      });
    }

    // ==========================================
    // 5. GÖREV GÜNCELLEME (action: update)
    // ==========================================
    if (action === 'update') {
      const taskId = String(body.task_id || '').trim();
      const existing = (await db.select().from(tasks).where(
        and(
          eq(tasks.id, taskId),
          getVisibleTasksWhere(userId, familyId)
        )
      ).limit(1))[0];

      if (!existing) {
        return NextResponse.json({ success: false, error: 'Görev bulunamadı.' }, { status: 404 });
      }

      const validated = normalizeValidatedTaskFields(body);
      if (validated.error) {
        return NextResponse.json({ success: false, error: validated.error }, { status: 400 });
      }

      const updateData: Record<string, any> = {
        updated_at: nowISO
      };

      if (body.title !== undefined) {
        const trimmedTitle = String(body.title).trim();
        if (!trimmedTitle) {
          return NextResponse.json({ success: false, error: 'Görev başlığı boş bırakılamaz.' }, { status: 400 });
        }
        updateData.title = trimmedTitle;
      }
      if (body.description !== undefined) updateData.description = body.description ? String(body.description).trim() : null;
      if (validated.priority !== undefined) updateData.priority = validated.priority;
      if (validated.pillar !== undefined) updateData.pillar = validated.pillar;
      if (validated.dueDate !== undefined) updateData.due_date = validated.dueDate;
      if (validated.dueTime !== undefined) updateData.due_time = validated.dueTime;
      if (validated.recurrence !== undefined) updateData.recurrence = validated.recurrence;
      if (body.is_family_shared !== undefined) {
        const nextShared = body.is_family_shared ? 1 : 0;
        if (nextShared === 0 && existing.user_id && existing.user_id !== userId) {
          return NextResponse.json({
            success: false,
            error: 'Başka bir aile üyesinin paylaştığı görevi gizleyemezsiniz.'
          }, { status: 403 });
        }
        updateData.is_family_shared = nextShared;
      }
      if (body.assigned_member_id !== undefined) {
        const assignedMemberId = body.assigned_member_id ? String(body.assigned_member_id).trim() : null;
        if (assignedMemberId !== existing.assigned_member_id && !(await validateAssignedMemberInFamily(assignedMemberId, familyId))) {
          return NextResponse.json({ success: false, error: 'Seçilen aile üyesi bu hanede bulunamadı.' }, { status: 400 });
        }
        updateData.assigned_member_id = assignedMemberId;
      }

      let normalizedSubtasks: Subtask[] | undefined;
      let subtaskTransition: 'completed' | 'reopened' | 'none' = 'none';
      let nextStatus: TaskStatus = (existing.status as TaskStatus) || 'pending';

      if (body.subtasks !== undefined) {
        const parsedSubtasks = normalizeSubtasksInput(body.subtasks);
        if (parsedSubtasks.error || !parsedSubtasks.subtasks) {
          return NextResponse.json({ success: false, error: parsedSubtasks.error || 'Geçersiz alt görev listesi.' }, { status: 400 });
        }
        normalizedSubtasks = parsedSubtasks.subtasks;
        updateData.subtasks_json = JSON.stringify(normalizedSubtasks);

        const resolved = resolveSubtaskDrivenStatus(normalizedSubtasks, existing.status);
        nextStatus = resolved.nextStatus;
        subtaskTransition = resolved.transition;

        if (subtaskTransition === 'completed') {
          updateData.status = 'completed';
          updateData.completed_at = nowISO;
          if (existing.focus_started_at) {
            updateData.focus_started_at = null;
            updateData.focus_logged_minutes =
              (existing.focus_logged_minutes ?? 0) +
              computeFocusElapsedMinutes(existing.focus_started_at, existing.focus_planned_minutes, new Date(nowISO));
          }
        } else if (subtaskTransition === 'reopened') {
          updateData.status = 'pending';
          updateData.completed_at = null;
        }
      }

      const effectiveIsMit = body.is_mit !== undefined ? (body.is_mit ? 1 : 0) : Number(existing.is_mit);
      const effectiveDueDate = validated.dueDate !== undefined ? validated.dueDate : existing.due_date;
      const shouldCheckMit = effectiveIsMit === 1 && nextStatus !== 'completed' && (
        existing.status === 'completed' ||
        Number(existing.is_mit) !== 1 ||
        (validated.dueDate !== undefined && validated.dueDate !== existing.due_date)
      );

      if (shouldCheckMit) {
        const allUserTasks = await db.select({
          id: tasks.id,
          is_mit: tasks.is_mit,
          status: tasks.status,
          due_date: tasks.due_date
        }).from(tasks).where(getVisibleTasksWhere(userId, familyId));

        const mitCheck = validateMitConstraint(allUserTasks, effectiveDueDate, taskId);
        if (!mitCheck.allowed) {
          return NextResponse.json({
            success: false,
            error: subtaskTransition === 'reopened'
              ? 'Bu gün için 3 aktif odak görevi (MIT) zaten dolu. Görevi yeniden açmadan önce bir odağı tamamlayın veya çıkarın.'
              : 'Günde en fazla 3 odak görevi (MIT) belirleyebilirsiniz.'
          }, { status: 400 });
        }
      }
      if (body.is_mit !== undefined) {
        updateData.is_mit = effectiveIsMit;
      }

      await db.update(tasks).set(updateData).where(and(eq(tasks.id, taskId), getVisibleTasksWhere(userId, familyId)));

      const updatedTaskRow: TaskRow = { ...existing, ...updateData } as TaskRow;
      const spawnedNextTask = subtaskTransition === 'completed'
        ? await spawnNextRecurringTask(updatedTaskRow, userId, familyId, nowISO)
        : null;
      const followUpAction = subtaskTransition === 'completed'
        ? await notifyTaskCompleted(
            updatedTaskRow,
            updateData.focus_logged_minutes ?? (existing.focus_logged_minutes ?? 0),
            nowISO,
            userId,
            familyId
          )
        : null;

      let message = 'Görev güncellendi.';
      if (subtaskTransition === 'completed') {
        message = 'Tüm adımlar tamamlandı, görev kapandı 🎉';
      } else if (subtaskTransition === 'reopened') {
        message = 'Adım geri alındı, görev yeniden açıldı.';
      }

      return NextResponse.json({
        success: true,
        message,
        data: {
          task_id: taskId,
          status: nextStatus,
          transition: subtaskTransition,
          ...(normalizedSubtasks !== undefined
            ? {
                subtasks: normalizedSubtasks,
                progress: calculateSubtaskProgress(normalizedSubtasks)
              }
            : {}),
          ...(spawnedNextTask ? { spawned_next_task: spawnedNextTask } : {}),
          ...(followUpAction ? { follow_up_action: followUpAction } : {})
        }
      });
    }

    // ==========================================
    // 6. SİSTEM KÖPRÜSÜNDEN GÖREV İÇE AKTARMA (action: import_cross_module)
    // ==========================================
    if (action === 'import_cross_module') {
      const title = String(body.title || '').trim();
      if (!title) {
        return NextResponse.json({ success: false, error: 'Başlık gereklidir.' }, { status: 400 });
      }

      const targetDueDate = body.due_date ? String(body.due_date).trim() : getTodayTurkeyDate();
      const sourceModule = body.source_module ? String(body.source_module).trim() : 'manual';
      const sourceRefId = body.source_ref_id ? String(body.source_ref_id).trim() : null;

      // Kaynak mahremiyet ve sahiplik doğrulaması (kişisel kasa/kart/fatura/araç/ev kayıtları aile dışına sızmamalı)
      let resolvedFamilyShared = body.is_family_shared !== undefined ? (body.is_family_shared ? 1 : 0) : 1;
      if (sourceModule === 'vault' && sourceRefId) {
        const vaultRow = (await db.select({
          user_id: digitalVaultItems.user_id,
          family_id: digitalVaultItems.family_id,
          is_family_shared: digitalVaultItems.is_family_shared
        }).from(digitalVaultItems).where(eq(digitalVaultItems.id, sourceRefId)).limit(1))[0];
        if (vaultRow) {
          const canAccess = vaultRow.user_id === userId || (vaultRow.family_id === familyId && vaultRow.is_family_shared === 1);
          if (!canAccess) {
            return NextResponse.json({ success: false, error: 'Bu kaynağa erişim yetkiniz yok.' }, { status: 403 });
          }
          resolvedFamilyShared = vaultRow.is_family_shared === 1 ? 1 : 0;
        } else {
          resolvedFamilyShared = 0;
        }
      } else if (sourceModule === 'finance' && sourceRefId?.startsWith('card-')) {
        const cardId = sourceRefId.slice(5);
        const cardRow = (await db.select({
          user_id: walletsAccounts.user_id,
          family_id: walletsAccounts.family_id,
          is_family_shared: walletsAccounts.is_family_shared
        }).from(walletsAccounts).where(eq(walletsAccounts.id, cardId)).limit(1))[0];
        if (cardRow) {
          const canAccess =
            cardRow.user_id === userId ||
            (Boolean(cardRow.family_id) && cardRow.family_id === familyId && (!cardRow.user_id || cardRow.is_family_shared === 1));
          if (!canAccess) {
            return NextResponse.json({ success: false, error: 'Bu kaynağa erişim yetkiniz yok.' }, { status: 403 });
          }
          resolvedFamilyShared = (cardRow.is_family_shared === 1 || !cardRow.user_id) ? 1 : 0;
        } else {
          resolvedFamilyShared = 0;
        }
      } else if (sourceModule === 'finance' && sourceRefId) {
        const billRow = (await db.select({
          user_id: recurringBills.user_id,
          family_id: recurringBills.family_id
        }).from(recurringBills).where(eq(recurringBills.id, sourceRefId)).limit(1))[0];
        if (billRow) {
          const canAccess = billRow.user_id === userId || (Boolean(billRow.family_id) && billRow.family_id === familyId);
          if (!canAccess) {
            return NextResponse.json({ success: false, error: 'Bu kaynağa erişim yetkiniz yok.' }, { status: 403 });
          }
          resolvedFamilyShared = 1;
        }
      } else if (sourceModule === 'home' && sourceRefId) {
        const homeRow = (await db.select({
          user_id: homeMaintenanceRecords.user_id,
          family_id: homeMaintenanceRecords.family_id
        }).from(homeMaintenanceRecords).where(eq(homeMaintenanceRecords.id, sourceRefId)).limit(1))[0];
        if (homeRow) {
          const canAccess = homeRow.user_id === userId || (Boolean(homeRow.family_id) && homeRow.family_id === familyId);
          if (!canAccess) {
            return NextResponse.json({ success: false, error: 'Bu kaynağa erişim yetkiniz yok.' }, { status: 403 });
          }
          resolvedFamilyShared = 1;
        }
      } else if (sourceModule === 'vehicle' && sourceRefId) {
        const vehRow = (await db.select({
          user_id: vehicles.user_id,
          family_id: vehicles.family_id,
          is_family_shared: vehicles.is_family_shared
        })
          .from(vehicleLegalReminders)
          .leftJoin(vehicles, eq(vehicleLegalReminders.vehicle_id, vehicles.id))
          .where(eq(vehicleLegalReminders.id, sourceRefId))
          .limit(1))[0];
        if (vehRow && (vehRow.user_id || vehRow.family_id)) {
          const canAccess = vehRow.user_id === userId || (vehRow.family_id === familyId && vehRow.is_family_shared === 1);
          if (!canAccess) {
            return NextResponse.json({ success: false, error: 'Bu kaynağa erişim yetkiniz yok.' }, { status: 403 });
          }
          resolvedFamilyShared = vehRow.is_family_shared === 1 ? 1 : 0;
        }
      }

      if (sourceRefId) {
        const existingBridgeTasks = await db.select({
          id: tasks.id,
          status: tasks.status,
          due_date: tasks.due_date
        }).from(tasks).where(
          and(
            eq(tasks.source_module, sourceModule),
            eq(tasks.source_ref_id, sourceRefId),
            getVisibleTasksWhere(userId, familyId)
          )
        );

        const duplicateMatch = existingBridgeTasks.find(
          t => t.status !== 'completed' || !t.due_date || t.due_date === targetDueDate
        );
        if (duplicateMatch) {
          return NextResponse.json({
            success: true,
            message: 'Bu sistem uyarısı zaten görevlerinizde mevcut.',
            data: { id: duplicateMatch.id, duplicate: true }
          });
        }
      }

      const isMit = body.is_mit ? 1 : 0;
      if (isMit === 1) {
        const visibleTasks = await db.select({
          id: tasks.id,
          is_mit: tasks.is_mit,
          status: tasks.status,
          due_date: tasks.due_date
        }).from(tasks).where(getVisibleTasksWhere(userId, familyId));

        const mitCheck = validateMitConstraint(visibleTasks, targetDueDate);
        if (!mitCheck.allowed) {
          return NextResponse.json({
            success: false,
            error: 'Günde en fazla 3 odak görevi (MIT) belirleyebilirsiniz.'
          }, { status: 400 });
        }
      }

      const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      await db.insert(tasks).values({
        id: taskId,
        title,
        description: body.subtitle || null,
        status: 'pending',
        priority: body.priority && (String(body.priority) in PRIORITY_CONFIGS) ? body.priority : 'high',
        pillar: body.pillar && (String(body.pillar) in PILLAR_CONFIGS) ? body.pillar : 'general',
        is_mit: isMit,
        due_date: targetDueDate,
        due_time: null,
        recurrence: 'none',
        subtasks_json: '[]',
        is_family_shared: resolvedFamilyShared,
        assigned_member_id: null,
        source_module: sourceModule,
        source_ref_id: sourceRefId,
        completed_at: null,
        user_id: userId,
        family_id: familyId,
        created_at: nowISO,
        updated_at: nowISO
      });

      return NextResponse.json({
        success: true,
        message: 'Sistem uyarısı başarıyla yapılacak görevlere aktarıldı!',
        data: { id: taskId }
      });
    }

    // ==========================================
    // 7. GÖREV SİLME (action: delete)
    // ==========================================
    if (action === 'delete') {
      const taskId = String(body.task_id || '').trim();
      if (!taskId) {
        return NextResponse.json({ success: false, error: 'Görev ID girilmedi.' }, { status: 400 });
      }

      const existing = (await db.select({ id: tasks.id }).from(tasks).where(
        and(
          eq(tasks.id, taskId),
          getVisibleTasksWhere(userId, familyId)
        )
      ).limit(1))[0];

      if (!existing) {
        return NextResponse.json({ success: false, error: 'Görev bulunamadı veya yetkisiz erişim.' }, { status: 404 });
      }

      await db.delete(tasks).where(
        and(
          eq(tasks.id, taskId),
          getVisibleTasksWhere(userId, familyId)
        )
      );

      return NextResponse.json({
        success: true,
        message: 'Görev silindi.'
      });
    }

    return NextResponse.json({ success: false, error: 'Bilinmeyen aksiyon.' }, { status: 400 });
  } catch (error: any) {
    console.error('Tasks POST error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Görev işlemi sırasında hata oluştu.' }, { status: 500 });
  }
}
