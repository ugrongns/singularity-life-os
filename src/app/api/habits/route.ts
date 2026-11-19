import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { habits, habitLogs } from '@/db/schema';
import { eq, and, gte, asc } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { getTodayTurkeyDate, shiftTurkeyDate } from '@/lib/date-utils';
import { computeHabitStats, computeHabitSummaryAndBadges, HabitItem, HabitLogItem } from '@/lib/habits-engine';

export async function GET(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user || !user.id) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url, 'http://localhost');
    const todayTr = getTodayTurkeyDate();
    const selectedDate = searchParams.get('date') || todayTr;
    const sinceDate = shiftTurkeyDate(todayTr, -120);

    const [userHabits, recentLogs] = await Promise.all([
      db.select().from(habits).where(eq(habits.user_id, user.id)).orderBy(asc(habits.sort_order), asc(habits.created_at)),
      db.select().from(habitLogs).where(and(eq(habitLogs.user_id, user.id), gte(habitLogs.date, sinceDate)))
    ]);

    const typedHabits = userHabits as HabitItem[];
    const typedLogs = recentLogs as HabitLogItem[];

    const statsByHabit: Record<string, ReturnType<typeof computeHabitStats>> = {};
    const selectedDateLogs: Record<string, HabitLogItem> = {};

    for (const h of typedHabits) {
      statsByHabit[h.id] = computeHabitStats(h, typedLogs, todayTr);
    }
    for (const log of typedLogs) {
      if (log.date === selectedDate) {
        selectedDateLogs[log.habit_id] = log;
      }
    }

    const { healthScore, badges } = computeHabitSummaryAndBadges(typedHabits, statsByHabit);

    return NextResponse.json({
      success: true,
      data: {
        selectedDate,
        todayTr,
        habits: typedHabits,
        statsByHabit,
        selectedDateLogs,
        healthScore,
        badges
      }
    });
  } catch (error: any) {
    console.error('Habits GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user || !user.id) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }

    const body = await req.json();
    const { action = 'create' } = body;
    const now = new Date().toISOString();
    const todayTr = getTodayTurkeyDate();
    const familyId = user.family_id || `fam-${user.id}`;

    if (action === 'create') {
      const cleanTitle = typeof body.title === 'string' ? body.title.trim() : '';
      if (!cleanTitle) {
        return NextResponse.json({ success: false, error: 'Alışkanlık adı zorunludur.' }, { status: 400 });
      }
      const targetType = ['boolean', 'numeric', 'timer'].includes(body.target_type) ? body.target_type : 'boolean';
      const targetValue = targetType === 'boolean' ? 1 : Math.max(1, Number(body.target_value) || 1);
      const frequencyType = ['daily', 'specific_days', 'flexible_weekly'].includes(body.frequency_type) ? body.frequency_type : 'daily';
      const weeklyTarget = Math.max(1, Math.min(7, parseInt(body.weekly_target_count, 10) || (frequencyType === 'flexible_weekly' ? 3 : 7)));
      const timeOfDay = ['morning', 'afternoon', 'evening', 'all_day'].includes(body.time_of_day) ? body.time_of_day : 'all_day';
      const linkedModule = ['reading', 'workout', 'water'].includes(body.linked_module) ? body.linked_module : null;
      const daysJson = Array.isArray(body.frequency_days) ? JSON.stringify(body.frequency_days) : '[]';

      const id = `hab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await db.insert(habits).values({
        id,
        user_id: user.id,
        family_id: familyId,
        title: cleanTitle,
        description: typeof body.description === 'string' ? body.description.trim() : '',
        category: typeof body.category === 'string' && body.category.trim() ? body.category.trim() : 'Sağlık & Beden',
        color: body.color || '#10B981',
        icon: body.icon || 'check',
        target_type: targetType,
        target_value: targetValue,
        unit_label: typeof body.unit_label === 'string' && body.unit_label.trim() ? body.unit_label.trim() : (targetType === 'timer' ? 'dk' : 'kez'),
        frequency_type: frequencyType,
        frequency_days_json: daysJson,
        weekly_target_count: weeklyTarget,
        time_of_day: timeOfDay,
        linked_module: linkedModule,
        is_archived: 0,
        sort_order: 0,
        created_at: now,
        updated_at: now
      });

      return NextResponse.json({ success: true, message: `🔁 "${cleanTitle}" alışkanlığı oluşturuldu!` });
    }

    const habitId = body.habit_id || body.id;
    if (!habitId || typeof habitId !== 'string') {
      return NextResponse.json({ success: false, error: 'Alışkanlık ID gereklidir.' }, { status: 400 });
    }

    // OWASP BOLA: Yalnızca kendi alışkanlığına müdahale edebilir
    const targetHabit = (
      await db.select().from(habits).where(and(eq(habits.id, habitId), eq(habits.user_id, user.id))).limit(1)
    )[0];

    if (!targetHabit) {
      return NextResponse.json({ success: false, error: 'Alışkanlık bulunamadı veya yetkiniz yok.' }, { status: 404 });
    }

    if (action === 'toggle_log' || action === 'increment_log') {
      const targetDate = typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : todayTr;
      const existingLog = (
        await db.select().from(habitLogs).where(and(eq(habitLogs.habit_id, habitId), eq(habitLogs.date, targetDate))).limit(1)
      )[0];

      if (action === 'toggle_log') {
        const nextCompleted = existingLog && existingLog.is_completed === 1 ? 0 : 1;
        const nextValue = nextCompleted === 1 ? targetHabit.target_value : 0;

        if (existingLog) {
          await db
            .update(habitLogs)
            .set({ is_completed: nextCompleted, value: nextValue, updated_at: now })
            .where(eq(habitLogs.id, existingLog.id));
        } else {
          await db.insert(habitLogs).values({
            id: `hlog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            habit_id: habitId,
            user_id: user.id,
            date: targetDate,
            value: nextValue,
            is_completed: nextCompleted,
            created_at: now,
            updated_at: now
          });
        }

        return NextResponse.json({
          success: true,
          message: nextCompleted === 1 ? `✅ "${targetHabit.title}" tamamlandı!` : `↩️ "${targetHabit.title}" geri alındı.`
        });
      }

      // increment_log
      const delta = Number(body.delta ?? 1);
      const currVal = existingLog ? Number(existingLog.value || 0) : 0;
      const nextVal = Math.max(0, Math.round((currVal + delta) * 100) / 100);
      const nextCompleted = nextVal >= targetHabit.target_value ? 1 : 0;

      if (existingLog) {
        await db
          .update(habitLogs)
          .set({ value: nextVal, is_completed: nextCompleted, updated_at: now })
          .where(eq(habitLogs.id, existingLog.id));
      } else {
        await db.insert(habitLogs).values({
          id: `hlog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          habit_id: habitId,
          user_id: user.id,
          date: targetDate,
          value: nextVal,
          is_completed: nextCompleted,
          created_at: now,
          updated_at: now
        });
      }

      return NextResponse.json({
        success: true,
        message: nextCompleted === 1
          ? `🎯 "${targetHabit.title}" günlük hedefine ulaştı!`
          : `📈 "${targetHabit.title}": ${nextVal} / ${targetHabit.target_value} ${targetHabit.unit_label}`
      });
    }

    if (action === 'archive') {
      const nextArchived = targetHabit.is_archived === 1 ? 0 : 1;
      await db.update(habits).set({ is_archived: nextArchived, updated_at: now }).where(eq(habits.id, habitId));
      return NextResponse.json({
        success: true,
        message: nextArchived === 1 ? '📦 Alışkanlık arşivlendi.' : '✅ Alışkanlık tekrar aktifleştirildi.'
      });
    }

    if (action === 'update') {
      const cleanTitle = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : targetHabit.title;
      await db
        .update(habits)
        .set({
          title: cleanTitle,
          description: body.description !== undefined ? String(body.description) : targetHabit.description,
          category: body.category || targetHabit.category,
          color: body.color || targetHabit.color,
          icon: body.icon || targetHabit.icon,
          target_type: body.target_type || targetHabit.target_type,
          target_value: body.target_value !== undefined ? Math.max(1, Number(body.target_value) || 1) : targetHabit.target_value,
          unit_label: body.unit_label || targetHabit.unit_label,
          frequency_type: body.frequency_type || targetHabit.frequency_type,
          frequency_days_json: Array.isArray(body.frequency_days) ? JSON.stringify(body.frequency_days) : targetHabit.frequency_days_json,
          weekly_target_count: body.weekly_target_count !== undefined ? Math.max(1, Math.min(7, Number(body.weekly_target_count) || 3)) : targetHabit.weekly_target_count,
          time_of_day: body.time_of_day || targetHabit.time_of_day,
          linked_module: body.linked_module !== undefined ? (body.linked_module || null) : targetHabit.linked_module,
          updated_at: now
        })
        .where(eq(habits.id, habitId));

      return NextResponse.json({ success: true, message: `✅ "${cleanTitle}" güncellendi.` });
    }

    if (action === 'delete') {
      await db.delete(habitLogs).where(eq(habitLogs.habit_id, habitId));
      await db.delete(habits).where(eq(habits.id, habitId));
      return NextResponse.json({ success: true, message: '🗑️ Alışkanlık silindi.' });
    }

    return NextResponse.json({ success: false, error: 'Geçersiz işlem.' }, { status: 400 });
  } catch (error: any) {
    console.error('Habits POST Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
