import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { bookQuotes, books } from '@/db/schema';
import { desc, eq, or, and } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  try {
    await initDatabase();
    const user = await getAuthUser();
    const userId = user?.id;

    if (!userId) {
      return NextResponse.json({ success: true, data: [] });
    }

    const familyId = user.family_id || `fam-${userId}`;

    const quotes = await db.select({
      id: bookQuotes.id,
      book_id: bookQuotes.book_id,
      book_title: books.title,
      author: books.author,
      page_number: bookQuotes.page_number,
      quote_text: bookQuotes.quote_text,
      reflection_note: bookQuotes.reflection_note,
      is_favorite: bookQuotes.is_favorite,
      created_at: bookQuotes.created_at
    })
    .from(bookQuotes)
    .innerJoin(books, eq(bookQuotes.book_id, books.id))
    .where(
      or(
        eq(books.user_id, userId),
        eq(books.family_id, familyId),
        eq(bookQuotes.user_id, userId),
        eq(bookQuotes.family_id, familyId)
      )
    )
    .orderBy(desc(bookQuotes.created_at));

    return NextResponse.json({ success: true, data: quotes });
  } catch (error: any) {
    console.error('Quotes API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    const body = await req.json();
    const { book_id, page_number, quote_text, reflection_note } = body;

    if (!book_id || !quote_text) {
      return NextResponse.json({ success: false, error: 'Kitap ve alıntı metni zorunludur.' }, { status: 400 });
    }

    const familyId = user.family_id || `fam-${user.id}`;

    // IDOR / Yetki Koruması: Kitap bu kullanıcıya veya ailesine mi ait?
    const targetBook = (await db.select().from(books).where(
      and(
        eq(books.id, book_id),
        or(eq(books.user_id, user.id), eq(books.family_id, familyId))
      )
    ).limit(1))[0];

    if (!targetBook) {
      return NextResponse.json({ success: false, error: 'Kitap bulunamadı veya bu işlem için yetkiniz yok.' }, { status: 403 });
    }

    const now = new Date().toISOString();
    const quoteId = `quote-${Date.now()}`;

    // user_id ve family_id alanlarını set ederek kaydet
    await db.insert(bookQuotes).values({
      id: quoteId,
      book_id,
      user_id: user.id,
      family_id: familyId,
      page_number: parseInt(page_number, 10) || null,
      quote_text,
      reflection_note,
      is_favorite: 1,
      created_at: now,
      updated_at: now
    });

    return NextResponse.json({
      success: true,
      message: 'Alıntı ve çıkarım notu kütüphane defterine eklendi! 📖',
      id: quoteId
    });
  } catch (error: any) {
    console.error('Add Quote Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Silinecek alıntı ID belirtilmedi.' }, { status: 400 });
    }

    const familyId = user.family_id || `fam-${user.id}`;
    const quote = (await db.select().from(bookQuotes).where(
      and(
        eq(bookQuotes.id, id),
        or(eq(bookQuotes.user_id, user.id), eq(bookQuotes.family_id, familyId))
      )
    ).limit(1))[0];

    if (!quote) {
      return NextResponse.json({ success: false, error: 'Alıntı bulunamadı veya silme yetkiniz yok.' }, { status: 404 });
    }

    await db.delete(bookQuotes).where(eq(bookQuotes.id, id));

    return NextResponse.json({
      success: true,
      message: '🗑️ Alıntı başarıyla silindi.'
    });
  } catch (error: any) {
    console.error('Delete Quote Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
