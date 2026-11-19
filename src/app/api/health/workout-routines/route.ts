import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { workoutRoutines } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user || !user.id) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }
    const rows = await db
      .select()
      .from(workoutRoutines)
      .where(eq(workoutRoutines.user_id, user.id))
      .orderBy(desc(workoutRoutines.created_at));

    const parsed = rows.map(r => ({
      ...r,
      exercises: (() => {
        try {
          return JSON.parse(r.exercises_json || '[]');
        } catch {
          return [];
        }
      })()
    }));

    return NextResponse.json({ success: true, data: parsed });
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

    if (action === 'create') {
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      if (!title) {
        return NextResponse.json({ success: false, error: 'Rutin şablonu adı zorunludur.' }, { status: 400 });
      }
      const exercises = Array.isArray(body.exercises) ? body.exercises : [];
      if (exercises.length === 0) {
        return NextResponse.json({ success: false, error: 'En az bir egzersiz eklenmelidir.' }, { status: 400 });
      }

      const id = `wr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await db.insert(workoutRoutines).values({
        id,
        user_id: user.id,
        title,
        sport_type: body.sport_type || 'strength',
        exercises_json: JSON.stringify(exercises),
        created_at: now,
        updated_at: now
      });

      return NextResponse.json({ success: true, message: `💾 "${title}" antrenman şablonu kaydedildi!` });
    }

    if (action === 'delete') {
      const id = body.id;
      if (!id) return NextResponse.json({ success: false, error: 'Şablon ID gereklidir.' }, { status: 400 });
      await db.delete(workoutRoutines).where(and(eq(workoutRoutines.id, id), eq(workoutRoutines.user_id, user.id)));
      return NextResponse.json({ success: true, message: '🗑️ Antrenman şablonu silindi.' });
    }

    return NextResponse.json({ success: false, error: 'Geçersiz işlem.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
