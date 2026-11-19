import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { bookBookmarks, books } from '@/db/schema';
import { eq, and, or, asc } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user || !user.id) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url, 'http://localhost');
    const bookId = searchParams.get('book_id');
    if (!bookId) {
      return NextResponse.json({ success: false, error: 'book_id parametresi gereklidir.' }, { status: 400 });
    }

    const rows = await db
      .select()
      .from(bookBookmarks)
      .where(and(eq(bookBookmarks.book_id, bookId), eq(bookBookmarks.user_id, user.id)))
      .orderBy(asc(bookBookmarks.page_number));

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
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
    const familyId = user.family_id || `fam-${user.id}`;

    if (action === 'create') {
      const bookId = body.book_id;
      const pageNumber = parseInt(body.page_number, 10);
      const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : `Sayfa ${pageNumber}`;

      if (!bookId || !Number.isFinite(pageNumber) || pageNumber < 0) {
        return NextResponse.json({ success: false, error: 'Kitap ve geçerli sayfa numarası gereklidir.' }, { status: 400 });
      }

      const visibleBook = (
        await db
          .select({ id: books.id })
          .from(books)
          .where(
            and(
              eq(books.id, bookId),
              or(eq(books.user_id, user.id), and(eq(books.family_id, familyId), eq(books.is_family_shared, 1)))
            )
          )
          .limit(1)
      )[0];

      if (!visibleBook) {
        return NextResponse.json({ success: false, error: 'Kitaba erişim yetkiniz yok.' }, { status: 403 });
      }

      const id = `bm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await db.insert(bookBookmarks).values({
        id,
        book_id: bookId,
        user_id: user.id,
        page_number: pageNumber,
        title,
        note: typeof body.note === 'string' ? body.note.trim() : null,
        color: body.color || '#F59E0B',
        created_at: now,
        updated_at: now
      });

      return NextResponse.json({ success: true, message: `🔖 "${title}" (sf. ${pageNumber}) ayracı eklendi.` });
    }

    if (action === 'delete') {
      const id = body.id;
      if (!id) return NextResponse.json({ success: false, error: 'Ayraç ID gereklidir.' }, { status: 400 });
      await db.delete(bookBookmarks).where(and(eq(bookBookmarks.id, id), eq(bookBookmarks.user_id, user.id)));
      return NextResponse.json({ success: true, message: '🗑️ Ayraç silindi.' });
    }

    return NextResponse.json({ success: false, error: 'Geçersiz işlem.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
