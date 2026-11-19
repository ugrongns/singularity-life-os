import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db, initDatabase } from '@/db';
import { timeBlocks, tasks, books, habits, users, familyMembers } from '@/db/schema';
import { and, asc, desc, eq, gte, lte, ne, or } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { diffTurkeyCalendarDays, getTodayTurkeyDate } from '@/lib/date-utils';
import {
  findNextAvailableSlot,
  getTimeBlockCategoryMeta,
  parseTimeToMinutes,
} from '@/lib/time-blocks-engine';

function isValidTurkeyDateStr(dateStr: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && diffTurkeyCalendarDays(dateStr, dateStr) !== null;
}

function getVisibleTimeBlocksCondition(userId: string, familyId: string) {
  return or(
    eq(timeBlocks.user_id, userId),
    and(eq(timeBlocks.family_id, familyId), eq(timeBlocks.is_family_shared, 1))
  );
}

function getVisibleTasksCondition(userId: string, familyId: string) {
  return or(
    eq(tasks.user_id, userId),
    and(eq(tasks.family_id, familyId), eq(tasks.is_family_shared, 1))
  );
}

function getVisibleBooksCondition(userId: string, familyId: string) {
  return or(
    eq(books.user_id, userId),
    and(eq(books.family_id, familyId), eq(books.is_family_shared, 1))
  );
}

async function verifyLinkedEntitiesOwnership(
  userId: string,
  familyId: string,
  links: {
    linked_task_id?: string | null;
    linked_book_id?: string | null;
    linked_habit_id?: string | null;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (links.linked_task_id) {
    const [task] = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.id, links.linked_task_id), getVisibleTasksCondition(userId, familyId)))
      .limit(1);
    if (!task) {
      return { ok: false, error: 'Bağlanmak istenen görev bulunamadı veya erişim yetkiniz yok.' };
    }
  }

  if (links.linked_book_id) {
    const [book] = await db
      .select({ id: books.id })
      .from(books)
      .where(and(eq(books.id, links.linked_book_id), getVisibleBooksCondition(userId, familyId)))
      .limit(1);
    if (!book) {
      return { ok: false, error: 'Bağlanmak istenen kitap bulunamadı veya erişim yetkiniz yok.' };
    }
  }

  if (links.linked_habit_id) {
    const [habit] = await db
      .select({ id: habits.id })
      .from(habits)
      .where(and(eq(habits.id, links.linked_habit_id), eq(habits.user_id, userId)))
      .limit(1);
    if (!habit) {
      return { ok: false, error: 'Bağlanmak istenen alışkanlık bulunamadı veya erişim yetkiniz yok.' };
    }
  }

  return { ok: true };
}

async function resolveQuickScheduleSlot(
  userId: string,
  familyId: string,
  date: string,
  preferredStart: string,
  preferredEnd: string,
  autoSlot: boolean
): Promise<{ start_time: string; end_time: string; shifted: boolean }> {
  if (!autoSlot) {
    return { start_time: preferredStart, end_time: preferredEnd, shifted: false };
  }
  const duration = Math.max(
    15,
    parseTimeToMinutes(preferredEnd) - parseTimeToMinutes(preferredStart)
  );
  const dayBlocks = await db
    .select({ start_time: timeBlocks.start_time, end_time: timeBlocks.end_time })
    .from(timeBlocks)
    .where(and(getVisibleTimeBlocksCondition(userId, familyId), eq(timeBlocks.date, date)));
  return findNextAvailableSlot(dayBlocks, preferredStart, duration);
}

export async function GET(req: NextRequest) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user || !user.id) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }

    const familyId = user.family_id || `fam-${user.id}`;
    const today = getTodayTurkeyDate();
    const { searchParams } = new URL(req.url);
    const rawFrom = (searchParams.get('from') || '').trim();
    const rawTo = (searchParams.get('to') || '').trim();
    const from = isValidTurkeyDateStr(rawFrom) ? rawFrom : today;
    const to = isValidTurkeyDateStr(rawTo) ? rawTo : from;

    const [blockRows, pendingTasks, activeBooks, activeHabits, familyUserRows, familyMemberRows] =
      await Promise.all([
        db
          .select()
          .from(timeBlocks)
          .where(
            and(
              getVisibleTimeBlocksCondition(user.id, familyId),
              gte(timeBlocks.date, from),
              lte(timeBlocks.date, to)
            )
          )
          .orderBy(asc(timeBlocks.date), asc(timeBlocks.start_time)),
        db
          .select({
            id: tasks.id,
            title: tasks.title,
            priority: tasks.priority,
            due_date: tasks.due_date,
          })
          .from(tasks)
          .where(
            and(
              getVisibleTasksCondition(user.id, familyId),
              ne(tasks.status, 'completed')
            )
          )
          .orderBy(desc(tasks.updated_at))
          .limit(40),
        db
          .select({
            id: books.id,
            title: books.title,
            author: books.author,
            current_page: books.current_page,
            total_pages: books.total_pages,
          })
          .from(books)
          .where(
            and(
              getVisibleBooksCondition(user.id, familyId),
              eq(books.status, 'reading')
            )
          )
          .limit(20),
        db
          .select({
            id: habits.id,
            title: habits.title,
            icon: habits.icon,
            color: habits.color,
          })
          .from(habits)
          .where(and(eq(habits.user_id, user.id), eq(habits.is_archived, 0)))
          .limit(25),
        db
          .select({
            id: users.id,
            full_name: users.full_name,
            username: users.username,
            avatar_emoji: users.avatar_emoji,
          })
          .from(users)
          .where(or(eq(users.family_id, familyId), eq(users.id, user.id))),
        db
          .select({
            user_id: familyMembers.user_id,
            name: familyMembers.name,
            avatar: familyMembers.avatar,
          })
          .from(familyMembers)
          .where(eq(familyMembers.family_id, familyId)),
      ]);

    const ownerMap = new Map<string, { name: string; avatar: string }>();
    for (const u of familyUserRows ?? []) {
      const displayName = (u.full_name || u.username || '').trim();
      if (u.id && displayName) {
        ownerMap.set(u.id, { name: displayName, avatar: u.avatar_emoji || '👤' });
      }
    }
    for (const m of familyMemberRows ?? []) {
      if (m.user_id && m.name && !ownerMap.has(m.user_id)) {
        ownerMap.set(m.user_id, { name: m.name, avatar: m.avatar || '👤' });
      }
    }
    if (!ownerMap.has(user.id)) {
      const fallbackName = (user.full_name || user.username || '').trim();
      if (fallbackName) {
        ownerMap.set(user.id, { name: fallbackName, avatar: user.avatar_emoji || '👤' });
      }
    }

    const enrichedBlocks = (blockRows ?? []).map((b) => {
      const owner = ownerMap.get(b.user_id);
      return {
        ...b,
        owner_name: owner?.name || null,
        owner_avatar: owner?.avatar || null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        blocks: enrichedBlocks,
        unscheduledTasks: pendingTasks,
        activeBooks,
        activeHabits,
      },
    });
  } catch (err) {
    console.error('TimeBlocks GET error:', err);
    return NextResponse.json(
      { success: false, error: 'Zaman blokları yüklenemedi.' },
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
    const action = String(body.action || 'create');
    const now = new Date().toISOString();

    if (action === 'create') {
      const title = String(body.title || '').trim();
      const date = String(body.date || getTodayTurkeyDate()).trim();
      const startTime = String(body.start_time || '09:00').trim();
      const endTime = String(body.end_time || '10:00').trim();
      const category = String(body.category || 'deep_work').trim();

      if (!title) {
        return NextResponse.json({ success: false, error: 'Başlık zorunludur.' }, { status: 400 });
      }
      if (!isValidTurkeyDateStr(date)) {
        return NextResponse.json(
          { success: false, error: 'Geçersiz tarih formatı (YYYY-AA-GG bekleniyor).' },
          { status: 400 }
        );
      }
      const startMin = parseTimeToMinutes(startTime);
      const endMin = parseTimeToMinutes(endTime);
      if (startMin < 0 || endMin <= startMin) {
        return NextResponse.json(
          { success: false, error: 'Bitiş saati başlangıç saatinden sonra olmalıdır.' },
          { status: 400 }
        );
      }

      const linkedTaskId = body.linked_task_id ? String(body.linked_task_id).trim() : null;
      const linkedBookId = body.linked_book_id ? String(body.linked_book_id).trim() : null;
      const linkedHabitId = body.linked_habit_id ? String(body.linked_habit_id).trim() : null;

      const linkCheck = await verifyLinkedEntitiesOwnership(user.id, familyId, {
        linked_task_id: linkedTaskId,
        linked_book_id: linkedBookId,
        linked_habit_id: linkedHabitId,
      });
      if (!linkCheck.ok) {
        return NextResponse.json({ success: false, error: linkCheck.error }, { status: 403 });
      }

      const meta = getTimeBlockCategoryMeta(category);
      const isShared = body.is_family_shared ? 1 : 0;
      const newBlock = {
        id: crypto.randomUUID(),
        user_id: user.id,
        family_id: isShared ? familyId : null,
        title,
        category: meta.id,
        date,
        start_time: startTime,
        end_time: endTime,
        color: String(body.color || meta.color),
        is_completed: 0,
        is_family_shared: isShared,
        linked_task_id: linkedTaskId,
        linked_book_id: linkedBookId,
        linked_habit_id: linkedHabitId,
        notes: body.notes ? String(body.notes) : null,
        created_at: now,
        updated_at: now,
      };

      await db.insert(timeBlocks).values(newBlock);
      return NextResponse.json({ success: true, data: newBlock });
    }

    if (action === 'update') {
      const id = String(body.id || '').trim();
      if (!id) {
        return NextResponse.json({ success: false, error: 'Blok ID zorunludur.' }, { status: 400 });
      }

      const [existing] = await db
        .select()
        .from(timeBlocks)
        .where(and(eq(timeBlocks.id, id), eq(timeBlocks.user_id, user.id)));

      if (!existing) {
        return NextResponse.json(
          { success: false, error: 'Blok bulunamadı veya düzenleme yetkiniz yok.' },
          { status: 404 }
        );
      }

      const nextDate = body.date !== undefined ? String(body.date).trim() : existing.date;
      if (!isValidTurkeyDateStr(nextDate)) {
        return NextResponse.json(
          { success: false, error: 'Geçersiz tarih formatı (YYYY-AA-GG bekleniyor).' },
          { status: 400 }
        );
      }

      const nextStart =
        body.start_time !== undefined ? String(body.start_time).trim() : existing.start_time;
      const nextEnd =
        body.end_time !== undefined ? String(body.end_time).trim() : existing.end_time;
      const startMin = parseTimeToMinutes(nextStart);
      const endMin = parseTimeToMinutes(nextEnd);
      if (startMin < 0 || endMin <= startMin) {
        return NextResponse.json(
          { success: false, error: 'Geçersiz saat aralığı.' },
          { status: 400 }
        );
      }

      const nextLinkedTaskId =
        body.linked_task_id !== undefined
          ? body.linked_task_id
            ? String(body.linked_task_id).trim()
            : null
          : existing.linked_task_id;
      const nextLinkedBookId =
        body.linked_book_id !== undefined
          ? body.linked_book_id
            ? String(body.linked_book_id).trim()
            : null
          : existing.linked_book_id;
      const nextLinkedHabitId =
        body.linked_habit_id !== undefined
          ? body.linked_habit_id
            ? String(body.linked_habit_id).trim()
            : null
          : existing.linked_habit_id;

      const linksToVerify: {
        linked_task_id?: string | null;
        linked_book_id?: string | null;
        linked_habit_id?: string | null;
      } = {};
      if (body.linked_task_id !== undefined && nextLinkedTaskId !== existing.linked_task_id) {
        linksToVerify.linked_task_id = nextLinkedTaskId;
      }
      if (body.linked_book_id !== undefined && nextLinkedBookId !== existing.linked_book_id) {
        linksToVerify.linked_book_id = nextLinkedBookId;
      }
      if (body.linked_habit_id !== undefined && nextLinkedHabitId !== existing.linked_habit_id) {
        linksToVerify.linked_habit_id = nextLinkedHabitId;
      }

      const linkCheck = await verifyLinkedEntitiesOwnership(user.id, familyId, linksToVerify);
      if (!linkCheck.ok) {
        return NextResponse.json({ success: false, error: linkCheck.error }, { status: 403 });
      }

      const nextShared =
        body.is_family_shared !== undefined
          ? body.is_family_shared
            ? 1
            : 0
          : existing.is_family_shared;

      const nextCatMeta =
        body.category !== undefined
          ? getTimeBlockCategoryMeta(String(body.category))
          : getTimeBlockCategoryMeta(existing.category);

      const updated = {
        title:
          body.title !== undefined
            ? String(body.title).trim() || existing.title
            : existing.title,
        category: nextCatMeta.id,
        date: nextDate,
        start_time: nextStart,
        end_time: nextEnd,
        color:
          body.color !== undefined
            ? String(body.color)
            : body.category !== undefined
            ? nextCatMeta.color
            : existing.color,
        is_family_shared: nextShared,
        family_id: nextShared ? familyId : null,
        linked_task_id: nextLinkedTaskId,
        linked_book_id: nextLinkedBookId,
        linked_habit_id: nextLinkedHabitId,
        notes:
          body.notes !== undefined
            ? body.notes
              ? String(body.notes)
              : null
            : existing.notes,
        updated_at: now,
      };

      await db
        .update(timeBlocks)
        .set(updated)
        .where(and(eq(timeBlocks.id, id), eq(timeBlocks.user_id, user.id)));

      return NextResponse.json({ success: true, data: { ...existing, ...updated } });
    }

    if (action === 'toggle_complete') {
      const id = String(body.id || '').trim();
      if (!id) {
        return NextResponse.json({ success: false, error: 'Blok ID zorunludur.' }, { status: 400 });
      }

      const [existing] = await db
        .select()
        .from(timeBlocks)
        .where(and(eq(timeBlocks.id, id), getVisibleTimeBlocksCondition(user.id, familyId)));

      if (!existing) {
        return NextResponse.json({ success: false, error: 'Blok bulunamadı.' }, { status: 404 });
      }

      const nextCompleted = existing.is_completed === 1 ? 0 : 1;
      await db
        .update(timeBlocks)
        .set({ is_completed: nextCompleted, updated_at: now })
        .where(and(eq(timeBlocks.id, id), getVisibleTimeBlocksCondition(user.id, familyId)));

      return NextResponse.json({
        success: true,
        data: { ...existing, is_completed: nextCompleted, updated_at: now },
      });
    }

    if (action === 'delete') {
      const id = String(body.id || '').trim();
      if (!id) {
        return NextResponse.json({ success: false, error: 'Blok ID zorunludur.' }, { status: 400 });
      }

      const [existing] = await db
        .select({ id: timeBlocks.id })
        .from(timeBlocks)
        .where(and(eq(timeBlocks.id, id), eq(timeBlocks.user_id, user.id)));

      if (!existing) {
        return NextResponse.json(
          { success: false, error: 'Blok bulunamadı veya silme yetkiniz yok.' },
          { status: 404 }
        );
      }

      await db
        .delete(timeBlocks)
        .where(and(eq(timeBlocks.id, id), eq(timeBlocks.user_id, user.id)));

      return NextResponse.json({ success: true });
    }

    if (action === 'schedule_from_task') {
      const taskId = String(body.task_id || '').trim();
      const date = String(body.date || getTodayTurkeyDate()).trim();
      const startTime = String(body.start_time || '10:00').trim();
      const endTime = String(body.end_time || '11:00').trim();
      const autoSlot = body.auto_slot !== false;

      if (!taskId) {
        return NextResponse.json({ success: false, error: 'Görev ID zorunludur.' }, { status: 400 });
      }
      if (!isValidTurkeyDateStr(date)) {
        return NextResponse.json({ success: false, error: 'Geçersiz tarih formatı.' }, { status: 400 });
      }
      const startMin = parseTimeToMinutes(startTime);
      const endMin = parseTimeToMinutes(endTime);
      if (startMin < 0 || endMin <= startMin) {
        return NextResponse.json(
          { success: false, error: 'Bitiş saati başlangıç saatinden sonra olmalıdır.' },
          { status: 400 }
        );
      }

      const [task] = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, taskId), getVisibleTasksCondition(user.id, familyId)));

      if (!task) {
        return NextResponse.json({ success: false, error: 'Görev bulunamadı.' }, { status: 404 });
      }

      const slot = await resolveQuickScheduleSlot(
        user.id,
        familyId,
        date,
        startTime,
        endTime,
        autoSlot
      );

      const newBlock = {
        id: crypto.randomUUID(),
        user_id: user.id,
        family_id: null,
        title: task.title,
        category: 'deep_work',
        date,
        start_time: slot.start_time,
        end_time: slot.end_time,
        color: '#3B82F6',
        is_completed: 0,
        is_family_shared: 0,
        linked_task_id: task.id,
        linked_book_id: null,
        linked_habit_id: null,
        notes: null,
        created_at: now,
        updated_at: now,
      };

      await db.insert(timeBlocks).values(newBlock);
      return NextResponse.json({ success: true, data: newBlock, shifted: slot.shifted });
    }

    if (action === 'schedule_from_book') {
      const bookId = String(body.book_id || '').trim();
      const date = String(body.date || getTodayTurkeyDate()).trim();
      const startTime = String(body.start_time || '21:00').trim();
      const endTime = String(body.end_time || '21:45').trim();
      const autoSlot = body.auto_slot !== false;

      if (!bookId) {
        return NextResponse.json({ success: false, error: 'Kitap ID zorunludur.' }, { status: 400 });
      }
      if (!isValidTurkeyDateStr(date)) {
        return NextResponse.json({ success: false, error: 'Geçersiz tarih formatı.' }, { status: 400 });
      }
      const startMin = parseTimeToMinutes(startTime);
      const endMin = parseTimeToMinutes(endTime);
      if (startMin < 0 || endMin <= startMin) {
        return NextResponse.json(
          { success: false, error: 'Bitiş saati başlangıç saatinden sonra olmalıdır.' },
          { status: 400 }
        );
      }

      const [book] = await db
        .select()
        .from(books)
        .where(and(eq(books.id, bookId), getVisibleBooksCondition(user.id, familyId)));

      if (!book) {
        return NextResponse.json({ success: false, error: 'Kitap bulunamadı.' }, { status: 404 });
      }

      const slot = await resolveQuickScheduleSlot(
        user.id,
        familyId,
        date,
        startTime,
        endTime,
        autoSlot
      );

      const newBlock = {
        id: crypto.randomUUID(),
        user_id: user.id,
        family_id: null,
        title: `Okuma: ${book.title}`,
        category: 'reading',
        date,
        start_time: slot.start_time,
        end_time: slot.end_time,
        color: '#F59E0B',
        is_completed: 0,
        is_family_shared: 0,
        linked_task_id: null,
        linked_book_id: book.id,
        linked_habit_id: null,
        notes: book.author ? `Yazar: ${book.author}` : null,
        created_at: now,
        updated_at: now,
      };

      await db.insert(timeBlocks).values(newBlock);
      return NextResponse.json({ success: true, data: newBlock, shifted: slot.shifted });
    }

    if (action === 'schedule_from_habit') {
      const habitId = String(body.habit_id || '').trim();
      const date = String(body.date || getTodayTurkeyDate()).trim();
      const startTime = String(body.start_time || '08:00').trim();
      const endTime = String(body.end_time || '08:30').trim();
      const autoSlot = body.auto_slot !== false;

      if (!habitId) {
        return NextResponse.json(
          { success: false, error: 'Alışkanlık ID zorunludur.' },
          { status: 400 }
        );
      }
      if (!isValidTurkeyDateStr(date)) {
        return NextResponse.json({ success: false, error: 'Geçersiz tarih formatı.' }, { status: 400 });
      }
      const startMin = parseTimeToMinutes(startTime);
      const endMin = parseTimeToMinutes(endTime);
      if (startMin < 0 || endMin <= startMin) {
        return NextResponse.json(
          { success: false, error: 'Bitiş saati başlangıç saatinden sonra olmalıdır.' },
          { status: 400 }
        );
      }

      const [habit] = await db
        .select()
        .from(habits)
        .where(and(eq(habits.id, habitId), eq(habits.user_id, user.id)));

      if (!habit) {
        return NextResponse.json(
          { success: false, error: 'Alışkanlık bulunamadı.' },
          { status: 404 }
        );
      }

      const slot = await resolveQuickScheduleSlot(
        user.id,
        familyId,
        date,
        startTime,
        endTime,
        autoSlot
      );

      const newBlock = {
        id: crypto.randomUUID(),
        user_id: user.id,
        family_id: null,
        title: `Rutin: ${habit.title}`,
        category: 'personal',
        date,
        start_time: slot.start_time,
        end_time: slot.end_time,
        color: habit.color || '#06B6D4',
        is_completed: 0,
        is_family_shared: 0,
        linked_task_id: null,
        linked_book_id: null,
        linked_habit_id: habit.id,
        notes: null,
        created_at: now,
        updated_at: now,
      };

      await db.insert(timeBlocks).values(newBlock);
      return NextResponse.json({ success: true, data: newBlock, shifted: slot.shifted });
    }

    return NextResponse.json({ success: false, error: 'Geçersiz işlem.' }, { status: 400 });
  } catch (err) {
    console.error('TimeBlocks POST error:', err);
    return NextResponse.json(
      { success: false, error: 'Zaman bloğu işlemi başarısız oldu.' },
      { status: 500 }
    );
  }
}
