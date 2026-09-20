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
    const parseNum = (val: any): number | null => {
      if (val === undefined || val === null || val === '') return null;
      if (typeof val === 'number') return isNaN(val) ? null : val;
      const cleaned = String(val).replace(',', '.').trim();
      const n = parseFloat(cleaned);
      return isNaN(n) ? null : n;
    };

    const parseIntNum = (val: any): number | null => {
      const n = parseNum(val);
      return n !== null ? Math.round(n) : null;
    };

    const {
      action = 'create',
      title,
      sport_type = 'strength',
      date,
      start_time,
      duration_minutes = 45,
      duration_seconds,
      duration_centiseconds,
      formatted_duration,
      distance_km = 0,
      distance_meters,
      distance_cm,
      formatted_distance,
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

      // Süre atomik hesaplaması (salise, saniye & formatlı metin)
      let durSec = parseNum(duration_seconds);
      let durCenti = parseIntNum(duration_centiseconds);
      let formDur = formatted_duration ? String(formatted_duration).trim() : null;

      if (!durSec && typeof duration_minutes === 'string' && duration_minutes.includes(':')) {
        formDur = duration_minutes.trim();
        const parts = formDur.split(':').map(p => parseFloat(p.replace(',', '.')));
        if (parts.length === 3) durSec = Number((parts[0] * 3600 + parts[1] * 60 + parts[2]).toFixed(2));
        else if (parts.length === 2) durSec = Number((parts[0] * 60 + parts[1]).toFixed(2));
      } else if (!durSec && duration_minutes) {
        const dMin = parseNum(duration_minutes);
        durSec = dMin ? Number((dMin * 60).toFixed(2)) : null;
      }

      if (durSec !== null && durCenti === null) {
        durCenti = Math.round(durSec * 100);
      } else if (durCenti !== null && durSec === null) {
        durSec = Number((durCenti / 100).toFixed(2));
      }

      if (!formDur && durSec !== null) {
        const hrs = Math.floor(durSec / 3600);
        const rem = durSec % 3600;
        const mins = Math.floor(rem / 60);
        const secs = rem % 60;
        const hasCentis = Math.round(secs * 100) % 100 !== 0;
        const formattedSecs = hasCentis
          ? secs.toFixed(2).padStart(5, '0')
          : String(Math.floor(secs)).padStart(2, '0');

        formDur = hrs > 0
          ? `${hrs}:${String(mins).padStart(2, '0')}:${formattedSecs}`
          : `${String(mins).padStart(2, '0')}:${formattedSecs}`;
      }

      const durMin = durSec ? Math.round(durSec / 60) : (parseIntNum(duration_minutes) ?? 45);

      // Mesafe atomik hesaplaması (cm, metre, km & formatlı metin)
      let distCm = parseNum(distance_cm);
      let distM = parseNum(distance_meters);
      let distKm = parseNum(distance_km);
      let formDist = formatted_distance ? String(formatted_distance).trim() : null;

      if (distM === null && distKm !== null && distKm > 0) {
        distM = Number((distKm * 1000).toFixed(2));
      } else if (distM !== null && (distKm === null || distKm === 0)) {
        distKm = Number((distM / 1000).toFixed(3));
      }

      if (distCm === null && distM !== null) {
        distCm = Math.round(distM * 100);
      } else if (distCm !== null && distM === null) {
        distM = Number((distCm / 100).toFixed(2));
        if (distKm === null || distKm === 0) {
          distKm = Number((distM / 1000).toFixed(3));
        }
      }

      if (!formDist && distKm !== null && distKm > 0) {
        formDist = (sport_type === 'swimming' || distKm < 1)
          ? `${distM} m`
          : `${distKm.toFixed(2).replace('.', ',')} km`;
      }

      let totalWorkoutVolume = 0;

      // Egzersizleri ve setleri işle (varsa)
      if (Array.isArray(exercises) && exercises.length > 0) {
        for (const ex of exercises) {
          const setsData = ex.sets || [];
          let exMaxWeight = 0;
          let exTotalReps = 0;

          for (const s of setsData) {
            const w = parseNum(s.weight_kg) || 0;
            const r = parseIntNum(s.reps) || 0;
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
        duration_minutes: durMin,
        duration_seconds: durSec,
        duration_centiseconds: durCenti,
        formatted_duration: formDur,
        total_volume_kg: totalWorkoutVolume,
        distance_km: distKm ?? 0,
        distance_meters: distM,
        distance_cm: distCm,
        formatted_distance: formDist,
        calories: parseNum(calories) ?? 0,
        avg_speed_kmh: parseNum(avg_speed_kmh),
        max_speed_kmh: parseNum(max_speed_kmh),
        avg_pace: avg_pace || null,
        avg_heart_rate: parseIntNum(avg_heart_rate),
        max_heart_rate: parseIntNum(max_heart_rate),
        vo2_max: parseNum(vo2_max),
        elevation_gain_m: parseNum(elevation_gain_m),
        elevation_loss_m: parseNum(elevation_loss_m),
        step_count: parseIntNum(step_count),
        cadence_spm: parseIntNum(cadence_spm),
        sweat_loss_ml: parseIntNum(sweat_loss_ml),
        swim_pool_length_m: parseIntNum(swim_pool_length_m),
        swim_total_lengths: parseIntNum(swim_total_lengths),
        swim_stroke_count: parseIntNum(swim_stroke_count),
        swim_avg_swolf: parseIntNum(swim_avg_swolf),
        swim_best_swolf: parseIntNum(swim_best_swolf),
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
