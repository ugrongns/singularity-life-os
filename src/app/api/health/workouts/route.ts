import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { workoutSessions, workoutExerciseLogs } from '@/db/schema';
import { getAuthUser } from '@/lib/auth';
import { desc, eq, and, inArray } from 'drizzle-orm';

export async function GET() {
  try {
    initDatabase();
    const user = await getAuthUser();
    const userId = user?.id;

    // Son antrenman seanslarını çek
    const sessions = userId
      ? await db.select().from(workoutSessions).where(eq(workoutSessions.user_id, userId)).orderBy(desc(workoutSessions.date), desc(workoutSessions.created_at)).limit(20)
      : await db.select().from(workoutSessions).orderBy(desc(workoutSessions.date), desc(workoutSessions.created_at)).limit(20);

    const sessionIds = sessions.map(s => s.id);

    let exerciseLogs: any[] = [];
    if (sessionIds.length > 0) {
      exerciseLogs = await db.select().from(workoutExerciseLogs).where(inArray(workoutExerciseLogs.workout_id, sessionIds));
    }

    // Seansları egzersiz loglarıyla birleştir
    const fullWorkouts = sessions.map(session => {
      const exercises = exerciseLogs
        .filter(e => e.workout_id === session.id)
        .map(e => ({
          ...e,
          sets: JSON.parse(e.sets_data || '[]')
        }));

      return {
        ...session,
        exercises
      };
    });

    return NextResponse.json({ success: true, data: fullWorkouts });
  } catch (error: any) {
    console.error('Workouts GET API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    initDatabase();
    const user = await getAuthUser();
    const body = await req.json();
    const { action = 'create', title, date, duration_minutes = 45, notes = '', exercises = [] } = body;

    const now = new Date().toISOString();

    if (action === 'create') {
      const workoutId = `wk-${Date.now()}`;
      const workoutDate = date || now.split('T')[0];

      let totalWorkoutVolume = 0;

      // Egzersizleri ve setleri işle
      for (const ex of exercises) {
        const setsData = ex.sets || [];
        let exMaxWeight = 0;
        let exTotalReps = 0;

        for (const s of setsData) {
          const w = Number(s.weight_kg) || 0;
          const r = Number(s.reps) || 0;
          if (w > exMaxWeight) exMaxWeight = w;
          exTotalReps += r;
          totalWorkoutVolume += w * r;
        }

        const exLogId = `ex-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
        await db.insert(workoutExerciseLogs).values({
          id: exLogId,
          workout_id: workoutId,
          exercise_name: ex.exercise_name || 'Egzersiz',
          category: ex.category || 'genel',
          equipment: ex.equipment || 'dumbbell',
          sets_data: JSON.stringify(setsData),
          max_weight_kg: exMaxWeight,
          total_reps: exTotalReps,
          created_at: now,
          updated_at: now,
          user_id: user?.id || null
        });
      }

      await db.insert(workoutSessions).values({
        id: workoutId,
        title: title || 'Ev Antrenmanı',
        date: workoutDate,
        start_time: now.split('T')[1]?.substring(0, 5),
        duration_minutes: Number(duration_minutes) || 45,
        total_volume_kg: totalWorkoutVolume,
        notes,
        created_at: now,
        updated_at: now,
        user_id: user?.id || null
      });

      return NextResponse.json({ success: true, message: '🏋️ Antrenman günlüğe başarıyla kaydedildi!' });
    } else if (action === 'delete') {
      const { workout_id } = body;
      if (workout_id) {
        await db.delete(workoutExerciseLogs).where(eq(workoutExerciseLogs.workout_id, workout_id));
        await db.delete(workoutSessions).where(eq(workoutSessions.id, workout_id));
        return NextResponse.json({ success: true, message: 'Antrenman kaydı silindi.' });
      }
    }

    return NextResponse.json({ success: false, error: 'Geçersiz işlem.' }, { status: 400 });
  } catch (error: any) {
    console.error('Workouts POST API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
