import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { bookQuotes, books } from '@/db/schema';
import { desc, eq , or } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  try {
    initDatabase();
    const user = await getAuthUser();
    const userId = user?.id;

    if (!userId) {
      return NextResponse.json({ success: true, data: [] });
    }

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
    .where(or(eq(books.user_id, userId), eq(books.is_family_shared, 1)))
    .orderBy(desc(bookQuotes.created_at));

    return NextResponse.json({ success: true, data: quotes });
  } catch (error: any) {
    console.error('Quotes API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    initDatabase();
    const body = await req.json();
    const { book_id, page_number, quote_text, reflection_note } = body;

    if (!book_id || !quote_text) {
      return NextResponse.json({ success: false, error: 'Kitap ve alıntı metni zorunludur.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const quoteId = `quote-${Date.now()}`;

    await db.insert(bookQuotes).values({
      id: quoteId,
      book_id,
      page_number: parseInt(page_number, 10) || null,
      quote_text,
      reflection_note,
      is_favorite: 1,
      created_at: now,
      updated_at: now
    });

    return NextResponse.json({
      success: true,
      message: 'Alıntı ve çıkarım notu kütüphane defterine eklendi! 📖'
    });
  } catch (error: any) {
    console.error('Add Quote Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
