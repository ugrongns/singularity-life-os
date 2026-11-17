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
import { eq, and, or, inArray, desc, sql } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import {
  TaskItem,
  TaskRecurrence,
  parseSubtasks,
  calculateSubtaskProgress,
  calculateNextRecurrenceDate,
  validateMitConstraint,
  filterTasksByView,
  generateCrossModuleActionItems
} from '@/lib/tasks-engine';
import { calculateCreditCardSchedule, localYYYYMMDD } from '@/lib/bill-schedule';

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
    const todayStr = localYYYYMMDD(today);

    const { searchParams } = new URL(req.url);
    const view = searchParams.get('view') || 'all';
    const filter = searchParams.get('filter') || 'all'; // 'all', 'personal', 'family'
    const pillarParam = searchParams.get('pillar');
    const memberParam = searchParams.get('member_id');

    // 1. Aile Üyelerini Haritala (Avatar ve İsim Eşleştirmesi için)
    const membersList = await db.select().from(familyMembers).where(eq(familyMembers.family_id, familyId));
    const membersMap = new Map(membersList.map(m => [m.id, { name: m.name, avatar: m.avatar || '👤' }]));

    // 2. Görevleri Çek (OWASP BOLA)
    const rawTasks = await db.select().from(tasks).where(
      familyId
        ? or(
            eq(tasks.user_id, userId),
            and(eq(tasks.family_id, familyId), eq(tasks.is_family_shared, 1))
          )
        : eq(tasks.user_id, userId)
    ).orderBy(desc(tasks.is_mit), desc(tasks.created_at));

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

    // 5. Günlük MIT Özeti Hesapla
    const activeMitCount = enrichedTasks.filter(t => {
      return t.is_mit === 1 && t.status !== 'completed' && (!t.due_date || t.due_date === todayStr);
    }).length;

    const completedMitCount = enrichedTasks.filter(t => {
      const isTodayDone = t.completed_at && t.completed_at.slice(0, 10) === todayStr;
      return t.is_mit === 1 && t.status === 'completed' && isTodayDone;
    }).length;

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
              ? or(eq(walletsAccounts.user_id, userId), eq(walletsAccounts.family_id, familyId))
              : eq(walletsAccounts.user_id, userId)
          )
        ),
        db.select().from(vehicles).where(
          familyId
            ? or(eq(vehicles.user_id, userId), eq(vehicles.family_id, familyId))
            : eq(vehicles.user_id, userId)
        ),
        db.select().from(homeMaintenanceRecords).where(
          familyId
            ? or(eq(homeMaintenanceRecords.user_id, userId), eq(homeMaintenanceRecords.family_id, familyId))
            : eq(homeMaintenanceRecords.user_id, userId)
        ),
        db.select().from(digitalVaultItems).where(
          familyId
            ? or(eq(digitalVaultItems.user_id, userId), eq(digitalVaultItems.family_id, familyId))
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
            db.select({ id: categories.id, type: categories.type })
              .from(categories)
              .where(
                familyId
                  ? or(eq(categories.family_id, familyId), sql`${categories.family_id} IS NULL`, eq(categories.family_id, ''))
                  : or(sql`${categories.family_id} IS NULL`, eq(categories.family_id, ''))
              )
          ])
        : [[], []];

      const taskCategoryTypeMap = new Map(taskCategories.map(c => [c.id, c.type]));

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
        const sched = calculateCreditCardSchedule(acc, txsForCard, today);
        return {
          id: acc.id,
          name: acc.name,
          balance: acc.balance || 0,
          closed_statement_debt: sched.closed_statement_debt,
          overdue_amount: sched.overdue_amount,
          days_until_due: sched.days_until_due,
          next_due_date: sched.is_overdue ? sched.last_due_date : sched.next_due_date,
          is_overdue: sched.is_overdue,
          days_overdue: sched.days_overdue
        };
      });

      // Fatura Tarih Kontrolü
      const curYear = today.getFullYear();
      const curMonth = today.getMonth();
      const currentMonthStr = `${curYear}-${String(curMonth + 1).padStart(2, '0')}`;
      const parsedBills = billsData
        .filter(b => b.last_paid_month !== currentMonthStr)
        .map(b => {
          const maxDays = new Date(curYear, curMonth + 1, 0).getDate();
          const dueDayClamped = Math.min(b.due_day || 1, maxDays);
          const billDue = new Date(curYear, curMonth, dueDayClamped);
          const daysLeft = Math.ceil((billDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          return {
            id: b.id,
            name: b.name,
            amount: b.amount || 0,
            due_day: b.due_day,
            due_date: localYYYYMMDD(billDue),
            days_left: daysLeft
          };
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
      const parsedVehicles = legals.map(l => {
        const d = new Date(l.due_date);
        const daysLeft = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        const matchedV = vehiclesData.find(v => v.id === l.vehicle_id);
        return {
          id: l.id,
          type: l.type,
          due_date: l.due_date,
          days_left: daysLeft,
          plate: matchedV?.plate
        };
      });

      // Ev Bakımları
      const parsedHome = homeMaintData.map(h => {
        const d = new Date(h.next_due_date);
        const daysLeft = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return {
          id: h.id,
          title: h.title,
          next_due_date: h.next_due_date,
          days_left: daysLeft,
          status: h.status
        };
      });

      // Kasa Evrakları
      const parsedVault = vaultData.filter(v => Boolean(v.expiry_date)).map(v => {
        const d = new Date(v.expiry_date!);
        const daysLeft = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return {
          id: v.id,
          title: v.title,
          expiry_date: v.expiry_date || undefined,
          days_left: daysLeft,
          type: v.type
        };
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
          maxMit: 3
        },
        crossModuleActions,
        members: membersList.map(m => ({ id: m.id, name: m.name, avatar: m.avatar || '👤' }))
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

      const isMit = body.is_mit ? 1 : 0;
      const dueDate = body.due_date ? String(body.due_date).trim() : null;

      // MIT Kalkanı: Aynı günde en fazla 3 aktif odak görevi olabilir
      if (isMit === 1) {
        const existingTasks = await db.select({
          id: tasks.id,
          is_mit: tasks.is_mit,
          status: tasks.status,
          due_date: tasks.due_date
        }).from(tasks).where(eq(tasks.user_id, userId));

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

      await db.insert(tasks).values({
        id: taskId,
        title,
        description: body.description ? String(body.description).trim() : null,
        status: body.status || 'pending',
        priority: body.priority || 'medium',
        pillar: body.pillar || 'general',
        is_mit: isMit,
        due_date: dueDate,
        due_time: body.due_time ? String(body.due_time).trim() : null,
        recurrence: body.recurrence || 'none',
        subtasks_json: subtasksJson,
        is_family_shared: body.is_family_shared ? 1 : 0,
        assigned_member_id: body.assigned_member_id || null,
        source_module: body.source_module || 'manual',
        source_ref_id: body.source_ref_id || null,
        completed_at: null,
        user_id: userId,
        family_id: familyId,
        created_at: nowISO,
        updated_at: nowISO
      });

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
          familyId
            ? or(eq(tasks.user_id, userId), eq(tasks.family_id, familyId))
            : eq(tasks.user_id, userId)
        )
      ).limit(1))[0];

      if (!existing) {
        return NextResponse.json({ success: false, error: 'Görev bulunamadı veya yetkisiz erişim.' }, { status: 404 });
      }

      const isCompleted = existing.status === 'completed';
      const nextStatus = isCompleted ? 'pending' : 'completed';
      const completedAt = isCompleted ? null : nowISO;

      await db.update(tasks).set({
        status: nextStatus,
        completed_at: completedAt,
        updated_at: nowISO
      }).where(eq(tasks.id, taskId));

      // Tekrarlayan Görev Döngüsü: Eğer görev tamamlandıysa ve recurrence varsa bir sonraki periyot görevini otomatik üret
      let spawnedNextTask: any = null;
      if (!isCompleted && existing.recurrence && existing.recurrence !== 'none') {
        const nextDueDate = calculateNextRecurrenceDate(existing.due_date, existing.recurrence as TaskRecurrence);
        if (nextDueDate) {
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
            is_mit: existing.is_mit,
            due_date: nextDueDate,
            due_time: existing.due_time,
            recurrence: existing.recurrence,
            subtasks_json: JSON.stringify(freshSubtasks),
            is_family_shared: existing.is_family_shared,
            assigned_member_id: existing.assigned_member_id,
            source_module: existing.source_module,
            source_ref_id: existing.source_ref_id,
            completed_at: null,
            user_id: userId,
            family_id: familyId,
            created_at: nowISO,
            updated_at: nowISO
          });
          spawnedNextTask = { id: nextTaskId, due_date: nextDueDate };
        }
      }

      return NextResponse.json({
        success: true,
        message: isCompleted ? 'Görev yapılmadı olarak işaretlendi.' : 'Tebrikler! Görev tamamlandı 🎉',
        data: {
          task_id: taskId,
          status: nextStatus,
          spawned_next_task: spawnedNextTask
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
          familyId
            ? or(eq(tasks.user_id, userId), eq(tasks.family_id, familyId))
            : eq(tasks.user_id, userId)
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

      await db.update(tasks).set({
        subtasks_json: JSON.stringify(updatedSubtasks),
        updated_at: nowISO
      }).where(eq(tasks.id, taskId));

      return NextResponse.json({
        success: true,
        data: {
          task_id: taskId,
          subtasks: updatedSubtasks,
          progress: calculateSubtaskProgress(updatedSubtasks)
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
          familyId
            ? or(eq(tasks.user_id, userId), eq(tasks.family_id, familyId))
            : eq(tasks.user_id, userId)
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
        }).from(tasks).where(eq(tasks.user_id, userId));

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
      }).where(eq(tasks.id, taskId));

      return NextResponse.json({
        success: true,
        message: nextMit === 1 ? '🔥 Günün odak görevi (MIT) olarak eklendi!' : 'Odak görevi işareti kaldırıldı.',
        data: { task_id: taskId, is_mit: nextMit }
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
          familyId
            ? or(eq(tasks.user_id, userId), eq(tasks.family_id, familyId))
            : eq(tasks.user_id, userId)
        )
      ).limit(1))[0];

      if (!existing) {
        return NextResponse.json({ success: false, error: 'Görev bulunamadı.' }, { status: 404 });
      }

      const updateData: Record<string, any> = {
        updated_at: nowISO
      };

      if (body.title !== undefined) updateData.title = String(body.title).trim();
      if (body.description !== undefined) updateData.description = body.description ? String(body.description).trim() : null;
      if (body.priority !== undefined) updateData.priority = body.priority;
      if (body.pillar !== undefined) updateData.pillar = body.pillar;
      if (body.due_date !== undefined) updateData.due_date = body.due_date || null;
      if (body.due_time !== undefined) updateData.due_time = body.due_time || null;
      if (body.recurrence !== undefined) updateData.recurrence = body.recurrence;
      if (body.is_family_shared !== undefined) updateData.is_family_shared = body.is_family_shared ? 1 : 0;
      if (body.assigned_member_id !== undefined) updateData.assigned_member_id = body.assigned_member_id || null;
      if (body.subtasks !== undefined) updateData.subtasks_json = JSON.stringify(body.subtasks);

      if (body.is_mit !== undefined) {
        const nextMit = body.is_mit ? 1 : 0;
        if (nextMit === 1 && existing.is_mit !== 1) {
          const allUserTasks = await db.select({
            id: tasks.id,
            is_mit: tasks.is_mit,
            status: tasks.status,
            due_date: tasks.due_date
          }).from(tasks).where(eq(tasks.user_id, userId));

          const mitCheck = validateMitConstraint(allUserTasks, body.due_date ?? existing.due_date, taskId);
          if (!mitCheck.allowed) {
            return NextResponse.json({
              success: false,
              error: 'Günde en fazla 3 odak görevi (MIT) belirleyebilirsiniz.'
            }, { status: 400 });
          }
        }
        updateData.is_mit = nextMit;
      }

      await db.update(tasks).set(updateData).where(eq(tasks.id, taskId));

      return NextResponse.json({
        success: true,
        message: 'Görev güncellendi.',
        data: { task_id: taskId }
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

      const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      await db.insert(tasks).values({
        id: taskId,
        title,
        description: body.subtitle || null,
        status: 'pending',
        priority: body.priority || 'high',
        pillar: body.pillar || 'general',
        is_mit: body.is_mit ? 1 : 0,
        due_date: body.due_date || localYYYYMMDD(new Date()),
        due_time: null,
        recurrence: 'none',
        subtasks_json: '[]',
        is_family_shared: 1, // Sistem aksiyonları haneyi ilgilendirir
        assigned_member_id: null,
        source_module: body.source_module || 'manual',
        source_ref_id: body.source_ref_id || null,
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

      await db.delete(tasks).where(
        and(
          eq(tasks.id, taskId),
          familyId
            ? or(eq(tasks.user_id, userId), eq(tasks.family_id, familyId))
            : eq(tasks.user_id, userId)
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
