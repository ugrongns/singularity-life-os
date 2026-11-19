import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { notes, noteFolders, books, tasks, sinkingFunds } from '@/db/schema';
import { eq, and, or, desc, asc } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

function getVisibleNotesCondition(userId: string, familyId: string) {
  return or(
    eq(notes.user_id, userId),
    and(eq(notes.family_id, familyId), eq(notes.is_family_shared, 1))
  );
}

export async function GET() {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user || !user.id) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }
    const familyId = user.family_id || `fam-${user.id}`;

    const [noteRows, folderRows, bookRows, taskRows, fundRows] = await Promise.all([
      db
        .select()
        .from(notes)
        .where(getVisibleNotesCondition(user.id, familyId))
        .orderBy(desc(notes.is_pinned), desc(notes.updated_at)),
      db
        .select()
        .from(noteFolders)
        .where(eq(noteFolders.user_id, user.id))
        .orderBy(asc(noteFolders.name)),
      db
        .select({ id: books.id, title: books.title })
        .from(books)
        .where(or(eq(books.user_id, user.id), and(eq(books.family_id, familyId), eq(books.is_family_shared, 1))))
        .limit(100),
      db
        .select({ id: tasks.id, title: tasks.title })
        .from(tasks)
        .where(or(eq(tasks.user_id, user.id), and(eq(tasks.family_id, familyId), eq(tasks.is_family_shared, 1))))
        .limit(100),
      db
        .select({ id: sinkingFunds.id, name: sinkingFunds.name })
        .from(sinkingFunds)
        .where(or(eq(sinkingFunds.user_id, user.id), and(eq(sinkingFunds.family_id, familyId), eq(sinkingFunds.is_family_shared, 1))))
        .limit(50)
    ]);

    return NextResponse.json({
      success: true,
      data: {
        notes: noteRows,
        folders: folderRows,
        linkableBooks: bookRows,
        linkableTasks: taskRows,
        linkableFunds: fundRows
      }
    });
  } catch (error: any) {
    console.error('Notes GET Error:', error);
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
    const { action = 'create_note' } = body;
    const now = new Date().toISOString();
    const familyId = user.family_id || `fam-${user.id}`;

    if (action === 'create_folder') {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name) return NextResponse.json({ success: false, error: 'Klasör adı zorunludur.' }, { status: 400 });
      const id = `nf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await db.insert(noteFolders).values({
        id,
        user_id: user.id,
        family_id: familyId,
        name,
        icon: body.icon || '📁',
        color: body.color || '#6366F1',
        created_at: now,
        updated_at: now
      });
      return NextResponse.json({ success: true, id, message: `📁 "${name}" klasörü oluşturuldu.` });
    }

    if (action === 'delete_folder') {
      const folderId = body.folder_id || body.id;
      if (!folderId) return NextResponse.json({ success: false, error: 'Klasör ID gereklidir.' }, { status: 400 });
      await db.delete(noteFolders).where(and(eq(noteFolders.id, folderId), eq(noteFolders.user_id, user.id)));
      return NextResponse.json({ success: true, message: '🗑️ Klasör silindi (notlar korundu).' });
    }

    if (action === 'create_note' || action === 'import_from_quote') {
      const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : 'Başlıksız Not';
      const content = typeof body.content === 'string' ? body.content : '';
      const tags = Array.isArray(body.tags) ? body.tags.map((t: any) => String(t).trim()).filter(Boolean) : [];
      const id = `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      await db.insert(notes).values({
        id,
        user_id: user.id,
        family_id: familyId,
        folder_id: body.folder_id || null,
        title,
        content,
        tags_json: JSON.stringify(tags),
        is_pinned: body.is_pinned ? 1 : 0,
        is_archived: 0,
        is_family_shared: body.is_family_shared === 1 ? 1 : 0,
        linked_book_id: body.linked_book_id || null,
        linked_task_id: body.linked_task_id || null,
        linked_sinking_fund_id: body.linked_sinking_fund_id || null,
        created_at: now,
        updated_at: now
      });

      return NextResponse.json({
        success: true,
        id,
        message: action === 'import_from_quote' ? '📝 Alıntı İkinci Beyin notlarına aktarıldı!' : '📝 Not kaydedildi!'
      });
    }

    const noteId = body.id || body.note_id;
    if (!noteId || typeof noteId !== 'string') {
      return NextResponse.json({ success: false, error: 'Not ID gereklidir.' }, { status: 400 });
    }

    const targetNote = (
      await db
        .select()
        .from(notes)
        .where(and(eq(notes.id, noteId), getVisibleNotesCondition(user.id, familyId)))
        .limit(1)
    )[0];

    if (!targetNote) {
      return NextResponse.json({ success: false, error: 'Not bulunamadı veya yetkiniz yok.' }, { status: 404 });
    }

    if (action === 'toggle_pin') {
      const nextPin = targetNote.is_pinned === 1 ? 0 : 1;
      await db.update(notes).set({ is_pinned: nextPin, updated_at: now }).where(eq(notes.id, noteId));
      return NextResponse.json({ success: true, message: nextPin === 1 ? '📌 Not sabitlendi.' : '📌 Sabitleme kaldırıldı.' });
    }

    if (action === 'toggle_archive') {
      const nextArch = targetNote.is_archived === 1 ? 0 : 1;
      await db.update(notes).set({ is_archived: nextArch, updated_at: now }).where(eq(notes.id, noteId));
      return NextResponse.json({ success: true, message: nextArch === 1 ? '📦 Not arşivlendi.' : '✅ Not arşivden çıkarıldı.' });
    }

    if (action === 'update_note') {
      const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : targetNote.title;
      const content = typeof body.content === 'string' ? body.content : targetNote.content;
      const tagsJson = Array.isArray(body.tags)
        ? JSON.stringify(body.tags.map((t: any) => String(t).trim()).filter(Boolean))
        : targetNote.tags_json;

      await db
        .update(notes)
        .set({
          title,
          content,
          tags_json: tagsJson,
          folder_id: body.folder_id !== undefined ? (body.folder_id || null) : targetNote.folder_id,
          is_family_shared: body.is_family_shared !== undefined ? (body.is_family_shared ? 1 : 0) : targetNote.is_family_shared,
          linked_book_id: body.linked_book_id !== undefined ? (body.linked_book_id || null) : targetNote.linked_book_id,
          linked_task_id: body.linked_task_id !== undefined ? (body.linked_task_id || null) : targetNote.linked_task_id,
          linked_sinking_fund_id: body.linked_sinking_fund_id !== undefined ? (body.linked_sinking_fund_id || null) : targetNote.linked_sinking_fund_id,
          updated_at: now
        })
        .where(eq(notes.id, noteId));

      return NextResponse.json({ success: true, message: '✅ Not güncellendi.' });
    }

    if (action === 'delete_note') {
      if (targetNote.user_id !== user.id && user.role !== 'admin' && user.is_master_account !== 1) {
        return NextResponse.json({ success: false, error: 'Bu notu silme yetkiniz yok.' }, { status: 403 });
      }
      await db.delete(notes).where(eq(notes.id, noteId));
      return NextResponse.json({ success: true, message: '🗑️ Not silindi.' });
    }

    return NextResponse.json({ success: false, error: 'Geçersiz işlem.' }, { status: 400 });
  } catch (error: any) {
    console.error('Notes POST Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
