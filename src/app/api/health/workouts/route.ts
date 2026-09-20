import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { workoutSessions, workoutExerciseLogs } from '@/db/schema';
import { getAuthUser } from '@/lib/auth';
import { desc, eq, and, inArray } from 'drizzle-orm';

export async function GET() {
  try {
    await initDatabase();
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
    await initDatabase();
    const user = await getAuthUser();
    const body = await req.json();
    const {
      action = 'create',
      title,
      sport_type = 'strength',
      date,
      start_time,
      duration_minutes = 45,
      distance_km = 0,
      calories = 0,
      avg_speed_kmh,
      max_speed_kmh,
      avg_pace,
      avg_heart_rate,
      max_heart_rate,
      vo2_max,
      elevation_gain_m,
      elevation_loss_m,
      step_count,
      cadence_spm,
      sweat_loss_ml,
      swim_pool_length_m,
      swim_total_lengths,
      swim_stroke_count,
      swim_avg_swolf,
      swim_best_swolf,
      swim_style,
      heart_rate_zones,
      splits_data,
      running_dynamics,
      source = 'manual',
      notes = '',
      exercises = []
    } = body;

    const now = new Date().toISOString();

    if (action === 'create') {
      const workoutId = `wk-${Date.now()}`;
      const workoutDate = date || now.split('T')[0];

      let totalWorkoutVolume = 0;

      // Egzersizleri ve setleri işle (varsa)
      if (Array.isArray(exercises) && exercises.length > 0) {
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
      }

      await db.insert(workoutSessions).values({
        id: workoutId,
        title: title || (sport_type === 'cycling' ? 'Bisiklet Antrenmanı' : sport_type === 'running' ? 'Koşu' : sport_type === 'walking' ? 'Yürüyüş' : sport_type === 'swimming' ? 'Yüzme' : 'Antrenman'),
        sport_type,
        date: workoutDate,
        start_time: start_time || now.split('T')[1]?.substring(0, 5),
        duration_minutes: Number(duration_minutes) || 45,
        total_volume_kg: totalWorkoutVolume,
        distance_km: Number(distance_km) || 0,
        calories: Number(calories) || 0,
        avg_speed_kmh: avg_speed_kmh ? Number(avg_speed_kmh) : null,
        max_speed_kmh: max_speed_kmh ? Number(max_speed_kmh) : null,
        avg_pace: avg_pace || null,
        avg_heart_rate: avg_heart_rate ? Number(avg_heart_rate) : null,
        max_heart_rate: max_heart_rate ? Number(max_heart_rate) : null,
        vo2_max: vo2_max ? Number(vo2_max) : null,
        elevation_gain_m: elevation_gain_m ? Number(elevation_gain_m) : null,
        elevation_loss_m: elevation_loss_m ? Number(elevation_loss_m) : null,
        step_count: step_count ? Number(step_count) : null,
        cadence_spm: cadence_spm ? Number(cadence_spm) : null,
        sweat_loss_ml: sweat_loss_ml ? Number(sweat_loss_ml) : null,
        swim_pool_length_m: swim_pool_length_m ? Number(swim_pool_length_m) : null,
        swim_total_lengths: swim_total_lengths ? Number(swim_total_lengths) : null,
        swim_stroke_count: swim_stroke_count ? Number(swim_stroke_count) : null,
        swim_avg_swolf: swim_avg_swolf ? Number(swim_avg_swolf) : null,
        swim_best_swolf: swim_best_swolf ? Number(swim_best_swolf) : null,
        swim_style: swim_style || null,
        heart_rate_zones: typeof heart_rate_zones === 'object' ? JSON.stringify(heart_rate_zones) : (heart_rate_zones || null),
        splits_data: typeof splits_data === 'object' ? JSON.stringify(splits_data) : (splits_data || null),
        running_dynamics: typeof running_dynamics === 'object' ? JSON.stringify(running_dynamics) : (running_dynamics || null),
        source,
        notes,
        created_at: now,
        updated_at: now,
        user_id: user?.id || null
      });

      return NextResponse.json({
        success: true,
        message: '🏅 Antrenman günlüğe başarıyla kaydedildi!',
        sweat_loss_ml: sweat_loss_ml ? Number(sweat_loss_ml) : undefined
      });
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
