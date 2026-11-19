import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db, initDatabase } from '@/db';
import {
  okrObjectives,
  okrKeyResults,
  okrCheckIns,
  books,
  sinkingFunds,
  workoutSessions,
  tasks,
  habitLogs,
} from '@/db/schema';
import { and, desc, eq, gte, inArray, or } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { getTodayTurkeyDate, shiftTurkeyDate } from '@/lib/date-utils';

function getVisibleOkrCondition(userId: string, familyId: string) {
  return or(
    eq(okrObjectives.user_id, userId),
    and(eq(okrObjectives.family_id, familyId), eq(okrObjectives.is_family_shared, 1))
  );
}

export async function GET(req: NextRequest) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user || !user.id) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }

    const familyId = user.family_id || `fam-${user.id}`;
    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || 'all';

    const whereCond =
      period && period !== 'all'
        ? and(getVisibleOkrCondition(user.id, familyId), eq(okrObjectives.period, period))
        : getVisibleOkrCondition(user.id, familyId);

    const objectives = await db
      .select()
      .from(okrObjectives)
      .where(whereCond)
      .orderBy(desc(okrObjectives.created_at));

    const objIds = objectives.map((o) => o.id);
    const keyResults =
      objIds.length > 0
        ? await db
            .select()
            .from(okrKeyResults)
            .where(inArray(okrKeyResults.objective_id, objIds))
        : [];

    const krIds = keyResults.map((k) => k.id);
    const checkIns =
      krIds.length > 0
        ? await db
            .select()
            .from(okrCheckIns)
            .where(inArray(okrCheckIns.key_result_id, krIds))
            .orderBy(desc(okrCheckIns.created_at))
        : [];

    // Live Singularity metrics for KR auto-suggestions
    const today = getTodayTurkeyDate();
    const currentYear = today.slice(0, 4);
    const thirtyDaysAgo = shiftTurkeyDate(today, -30);
    const sevenDaysAgo = shiftTurkeyDate(today, -6);

    const liveMetrics = {
      books_year: 0,
      sinking_fund: 0,
      workouts_30d: 0,
      tasks_30d: 0,
      habits_score: 0,
    };

    try {
      const [bookRows, fundRows, workoutRows, taskRows, habitLogRows] = await Promise.all([
        db
          .select({ id: books.id, finish_date: books.finish_date })
          .from(books)
          .where(
            and(
              or(
                eq(books.user_id, user.id),
                and(eq(books.family_id, familyId), eq(books.is_family_shared, 1))
              ),
              eq(books.status, 'completed')
            )
          ),
        db
          .select({ current_amount: sinkingFunds.current_amount })
          .from(sinkingFunds)
          .where(
            or(
              eq(sinkingFunds.user_id, user.id),
              and(eq(sinkingFunds.family_id, familyId), eq(sinkingFunds.is_family_shared, 1))
            )
          ),
        db
          .select({ id: workoutSessions.id })
          .from(workoutSessions)
          .where(
            and(
              eq(workoutSessions.user_id, user.id),
              gte(workoutSessions.date, thirtyDaysAgo)
            )
          ),
        db
          .select({ id: tasks.id, completed_at: tasks.completed_at })
          .from(tasks)
          .where(
            and(
              or(
                eq(tasks.user_id, user.id),
                and(eq(tasks.family_id, familyId), eq(tasks.is_family_shared, 1))
              ),
              eq(tasks.status, 'completed')
            )
          ),
        db
          .select({ id: habitLogs.id })
          .from(habitLogs)
          .where(
            and(
              eq(habitLogs.user_id, user.id),
              gte(habitLogs.date, sevenDaysAgo)
            )
          ),
      ]);

      liveMetrics.books_year = bookRows.filter(
        (b) => !b.finish_date || b.finish_date.startsWith(currentYear)
      ).length;
      liveMetrics.sinking_fund = Math.round(
        fundRows.reduce((sum, f) => sum + (Number(f.current_amount) || 0), 0)
      );
      liveMetrics.workouts_30d = workoutRows.length;
      liveMetrics.tasks_30d = taskRows.filter(
        (t) => !t.completed_at || t.completed_at >= thirtyDaysAgo
      ).length;
      liveMetrics.habits_score = habitLogRows.length;
    } catch {
      // Non-fatal: live metrics stay at 0 if any secondary table fails
    }

    return NextResponse.json({
      success: true,
      data: {
        objectives,
        keyResults,
        checkIns,
        liveMetrics,
      },
    });
  } catch (err) {
    console.error('OKR GET error:', err);
    return NextResponse.json(
      { success: false, error: 'OKR verileri yüklenemedi.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user || !user.id) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }

    const familyId = user.family_id || `fam-${user.id}`;
    const body = await req.json();
    const action = String(body.action || '');
    const now = new Date().toISOString();

    if (action === 'create_objective') {
      const title = String(body.title || '').trim();
      if (!title) {
        return NextResponse.json({ success: false, error: 'Hedef başlığı zorunludur.' }, { status: 400 });
      }
      const isShared = body.is_family_shared ? 1 : 0;
      const newObj = {
        id: crypto.randomUUID(),
        user_id: user.id,
        family_id: isShared ? familyId : null,
        pillar_id: String(body.pillar_id || 'pillar_career'),
        period: String(body.period || '2026-Q4'),
        title,
        description: String(body.description || ''),
        status: 'in_progress',
        confidence: 'on_track',
        is_family_shared: isShared,
        created_at: now,
        updated_at: now,
      };
      await db.insert(okrObjectives).values(newObj);
      return NextResponse.json({ success: true, data: newObj });
    }

    if (action === 'update_objective') {
      const id = String(body.id || '');
      const [existing] = await db
        .select()
        .from(okrObjectives)
        .where(and(eq(okrObjectives.id, id), eq(okrObjectives.user_id, user.id)));

      if (!existing) {
        return NextResponse.json(
          { success: false, error: 'Hedef bulunamadı veya yetkiniz yok.' },
          { status: 404 }
        );
      }

      const nextShared =
        body.is_family_shared !== undefined
          ? body.is_family_shared
            ? 1
            : 0
          : existing.is_family_shared;

      const updated = {
        title: body.title !== undefined ? String(body.title).trim() || existing.title : existing.title,
        description: body.description !== undefined ? String(body.description) : existing.description,
        pillar_id: body.pillar_id !== undefined ? String(body.pillar_id) : existing.pillar_id,
        period: body.period !== undefined ? String(body.period) : existing.period,
        status: body.status !== undefined ? String(body.status) : existing.status,
        confidence: body.confidence !== undefined ? String(body.confidence) : existing.confidence,
        is_family_shared: nextShared,
        family_id: nextShared ? familyId : null,
        updated_at: now,
      };

      await db
        .update(okrObjectives)
        .set(updated)
        .where(and(eq(okrObjectives.id, id), eq(okrObjectives.user_id, user.id)));

      return NextResponse.json({ success: true, data: { ...existing, ...updated } });
    }

    if (action === 'delete_objective') {
      const id = String(body.id || '');
      const [existing] = await db
        .select({ id: okrObjectives.id })
        .from(okrObjectives)
        .where(and(eq(okrObjectives.id, id), eq(okrObjectives.user_id, user.id)));

      if (!existing) {
        return NextResponse.json(
          { success: false, error: 'Hedef bulunamadı veya silme yetkiniz yok.' },
          { status: 404 }
        );
      }

      await db
        .delete(okrObjectives)
        .where(and(eq(okrObjectives.id, id), eq(okrObjectives.user_id, user.id)));
      return NextResponse.json({ success: true });
    }

    if (action === 'create_kr') {
      const objectiveId = String(body.objective_id || '');
      const title = String(body.title || '').trim();
      if (!objectiveId || !title) {
        return NextResponse.json(
          { success: false, error: 'Hedef ve Anahtar Sonuç başlığı zorunludur.' },
          { status: 400 }
        );
      }

      const [parentObj] = await db
        .select({ id: okrObjectives.id })
        .from(okrObjectives)
        .where(and(eq(okrObjectives.id, objectiveId), eq(okrObjectives.user_id, user.id)));

      if (!parentObj) {
        return NextResponse.json(
          { success: false, error: 'Hedef bulunamadı veya yetkiniz yok.' },
          { status: 404 }
        );
      }

      const newKr = {
        id: crypto.randomUUID(),
        objective_id: objectiveId,
        user_id: user.id,
        title,
        kr_type: String(body.kr_type || 'numeric'),
        start_value: Number(body.start_value) || 0,
        target_value: Number(body.target_value) || 100,
        current_value: Number(body.current_value) || 0,
        unit: String(body.unit || 'adet'),
        weight: Math.max(0.1, Number(body.weight) || 1),
        confidence: String(body.confidence || 'on_track'),
        linked_module: body.linked_module ? String(body.linked_module) : null,
        linked_ref_id: body.linked_ref_id ? String(body.linked_ref_id) : null,
        created_at: now,
        updated_at: now,
      };

      await db.insert(okrKeyResults).values(newKr);
      return NextResponse.json({ success: true, data: newKr });
    }

    if (action === 'delete_kr') {
      const id = String(body.id || '');
      const [existing] = await db
        .select({ id: okrKeyResults.id })
        .from(okrKeyResults)
        .where(and(eq(okrKeyResults.id, id), eq(okrKeyResults.user_id, user.id)));

      if (!existing) {
        return NextResponse.json(
          { success: false, error: 'Anahtar Sonuç bulunamadı veya yetkiniz yok.' },
          { status: 404 }
        );
      }

      await db
        .delete(okrKeyResults)
        .where(and(eq(okrKeyResults.id, id), eq(okrKeyResults.user_id, user.id)));
      return NextResponse.json({ success: true });
    }

    if (action === 'record_check_in') {
      const krId = String(body.key_result_id || '');
      const [existingKr] = await db
        .select()
        .from(okrKeyResults)
        .where(and(eq(okrKeyResults.id, krId), eq(okrKeyResults.user_id, user.id)));

      if (!existingKr) {
        return NextResponse.json(
          { success: false, error: 'Anahtar Sonuç bulunamadı veya yetkiniz yok.' },
          { status: 404 }
        );
      }

      const newValue = Number(body.new_value);
      if (Number.isNaN(newValue)) {
        return NextResponse.json({ success: false, error: 'Geçerli bir değer giriniz.' }, { status: 400 });
      }

      const confidence = String(body.confidence || existingKr.confidence || 'on_track');
      const checkIn = {
        id: crypto.randomUUID(),
        key_result_id: krId,
        user_id: user.id,
        previous_value: existingKr.current_value,
        new_value: newValue,
        confidence,
        note: String(body.note || ''),
        check_in_date: getTodayTurkeyDate(),
        created_at: now,
      };

      await db.insert(okrCheckIns).values(checkIn);
      await db
        .update(okrKeyResults)
        .set({ current_value: newValue, confidence, updated_at: now })
        .where(and(eq(okrKeyResults.id, krId), eq(okrKeyResults.user_id, user.id)));

      return NextResponse.json({ success: true, data: checkIn });
    }

    return NextResponse.json({ success: false, error: 'Geçersiz işlem.' }, { status: 400 });
  } catch (err) {
    console.error('OKR POST error:', err);
    return NextResponse.json(
      { success: false, error: 'OKR işlemi başarısız oldu.' },
      { status: 500 }
    );
  }
}
