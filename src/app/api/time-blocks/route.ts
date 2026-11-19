import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db, initDatabase } from '@/db';
import { timeBlocks, tasks, books, habits } from '@/db/schema';
import { and, asc, desc, eq, gte, lte, ne, or } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { getTodayTurkeyDate } from '@/lib/date-utils';
import { getTimeBlockCategoryMeta, parseTimeToMinutes } from '@/lib/time-blocks-engine';

function getVisibleTimeBlocksCondition(userId: string, familyId: string) {
  return or(
    eq(timeBlocks.user_id, userId),
    and(eq(timeBlocks.family_id, familyId), eq(timeBlocks.is_family_shared, 1))
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
    const today = getTodayTurkeyDate();
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from') || today;
    const to = searchParams.get('to') || from;

    const [blockRows, pendingTasks, activeBooks, activeHabits] = await Promise.all([
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
            or(
              eq(tasks.user_id, user.id),
              and(eq(tasks.family_id, familyId), eq(tasks.is_family_shared, 1))
            ),
            ne(tasks.status, 'done')
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
            or(
              eq(books.user_id, user.id),
              and(eq(books.family_id, familyId), eq(books.is_family_shared, 1))
            ),
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
    ]);

    return NextResponse.json({
      success: true,
      data: {
        blocks: blockRows,
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
      const startMin = parseTimeToMinutes(startTime);
      const endMin = parseTimeToMinutes(endTime);
      if (startMin < 0 || endMin <= startMin) {
        return NextResponse.json(
          { success: false, error: 'Bitiş saati başlangıç saatinden sonra olmalıdır.' },
          { status: 400 }
        );
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
        linked_task_id: body.linked_task_id ? String(body.linked_task_id) : null,
        linked_book_id: body.linked_book_id ? String(body.linked_book_id) : null,
        linked_habit_id: body.linked_habit_id ? String(body.linked_habit_id) : null,
        notes: body.notes ? String(body.notes) : null,
        created_at: now,
        updated_at: now,
      };

      await db.insert(timeBlocks).values(newBlock);
      return NextResponse.json({ success: true, data: newBlock });
    }

    if (action === 'update') {
      const id = String(body.id || '');
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

      const nextStart = body.start_time !== undefined ? String(body.start_time) : existing.start_time;
      const nextEnd = body.end_time !== undefined ? String(body.end_time) : existing.end_time;
      const startMin = parseTimeToMinutes(nextStart);
      const endMin = parseTimeToMinutes(nextEnd);
      if (startMin < 0 || endMin <= startMin) {
        return NextResponse.json(
          { success: false, error: 'Geçersiz saat aralığı.' },
          { status: 400 }
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
        category: body.category !== undefined ? String(body.category) : existing.category,
        date: body.date !== undefined ? String(body.date) : existing.date,
        start_time: nextStart,
        end_time: nextEnd,
        color: body.color !== undefined ? String(body.color) : existing.color,
        is_family_shared: nextShared,
        family_id: nextShared ? familyId : null,
        notes: body.notes !== undefined ? (body.notes ? String(body.notes) : null) : existing.notes,
        updated_at: now,
      };

      await db
        .update(timeBlocks)
        .set(updated)
        .where(and(eq(timeBlocks.id, id), eq(timeBlocks.user_id, user.id)));

      return NextResponse.json({ success: true, data: { ...existing, ...updated } });
    }

    if (action === 'toggle_complete') {
      const id = String(body.id || '');
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
        .where(eq(timeBlocks.id, id));

      return NextResponse.json({
        success: true,
        data: { ...existing, is_completed: nextCompleted, updated_at: now },
      });
    }

    if (action === 'delete') {
      const id = String(body.id || '');
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
      const taskId = String(body.task_id || '');
      const date = String(body.date || getTodayTurkeyDate());
      const startTime = String(body.start_time || '09:00');
      const endTime = String(body.end_time || '10:00');

      const [task] = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.id, taskId),
            or(
              eq(tasks.user_id, user.id),
              and(eq(tasks.family_id, familyId), eq(tasks.is_family_shared, 1))
            )
          )
        );

      if (!task) {
        return NextResponse.json({ success: false, error: 'Görev bulunamadı.' }, { status: 404 });
      }

      const newBlock = {
        id: crypto.randomUUID(),
        user_id: user.id,
        family_id: null,
        title: task.title,
        category: 'deep_work',
        date,
        start_time: startTime,
        end_time: endTime,
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
      return NextResponse.json({ success: true, data: newBlock });
    }

    if (action === 'schedule_from_book') {
      const bookId = String(body.book_id || '');
      const date = String(body.date || getTodayTurkeyDate());
      const startTime = String(body.start_time || '21:00');
      const endTime = String(body.end_time || '21:45');

      const [book] = await db
        .select()
        .from(books)
        .where(
          and(
            eq(books.id, bookId),
            or(
              eq(books.user_id, user.id),
              and(eq(books.family_id, familyId), eq(books.is_family_shared, 1))
            )
          )
        );

      if (!book) {
        return NextResponse.json({ success: false, error: 'Kitap bulunamadı.' }, { status: 404 });
      }

      const newBlock = {
        id: crypto.randomUUID(),
        user_id: user.id,
        family_id: null,
        title: `Okuma: ${book.title}`,
        category: 'reading',
        date,
        start_time: startTime,
        end_time: endTime,
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
      return NextResponse.json({ success: true, data: newBlock });
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
