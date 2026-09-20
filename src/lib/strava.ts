import { db, initDatabase } from '@/db';
import { appSettings, workoutSessions } from '@/db/schema';
import { eq } from 'drizzle-orm';

export interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  athleteId?: string;
}

/**
 * Veritabanından veya ortam değişkenlerinden Strava ayarlarını çeker.
 */
export async function getStravaConfig() {
  await initDatabase();
  const settings = await db.select().from(appSettings);
  const settingsMap: Record<string, string> = {};
  settings.forEach(s => {
    settingsMap[s.key] = s.value;
  });

  const clientId = settingsMap['strava_client_id'] || process.env.STRAVA_CLIENT_ID || '';
  const clientSecret = settingsMap['strava_client_secret'] || process.env.STRAVA_CLIENT_SECRET || '';
  const accessToken = settingsMap['strava_access_token'] || '';
  const refreshToken = settingsMap['strava_refresh_token'] || '';
  const expiresAt = Number(settingsMap['strava_expires_at'] || '0');
  const athleteId = settingsMap['strava_athlete_id'] || '';

  return {
    clientId,
    clientSecret,
    accessToken,
    refreshToken,
    expiresAt,
    athleteId,
    isConnected: !!(accessToken && refreshToken)
  };
}

/**
 * Strava Token yenileme (Refresh Token Flow)
 */
export async function getValidStravaAccessToken(): Promise<string | null> {
  const config = await getStravaConfig();
  if (!config.refreshToken || !config.clientId || !config.clientSecret) {
    return null;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  // Eğer token geçerliyse mevcut olanı dön
  if (config.accessToken && config.expiresAt > nowSeconds + 60) {
    return config.accessToken;
  }

  // Token süresi dolmuşsa yenile
  try {
    const res = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: config.refreshToken
      })
    });

    if (!res.ok) {
      console.error('Strava token refresh failed:', await res.text());
      return null;
    }

    const data = await res.json();
    const now = new Date().toISOString();

    await db.insert(appSettings).values({
      key: 'strava_access_token',
      value: data.access_token,
      updated_at: now
    }).onConflictDoUpdate({
      target: appSettings.key,
      set: { value: data.access_token, updated_at: now }
    });

    await db.insert(appSettings).values({
      key: 'strava_refresh_token',
      value: data.refresh_token,
      updated_at: now
    }).onConflictDoUpdate({
      target: appSettings.key,
      set: { value: data.refresh_token, updated_at: now }
    });

    await db.insert(appSettings).values({
      key: 'strava_expires_at',
      value: String(data.expires_at),
      updated_at: now
    }).onConflictDoUpdate({
      target: appSettings.key,
      set: { value: String(data.expires_at), updated_at: now }
    });

    return data.access_token;
  } catch (err) {
    console.error('Strava refresh error:', err);
    return null;
  }
}

/**
 * Strava Aktivitesini Singularity WorkoutSessions modeline dönüştürür.
 */
export function mapStravaActivityToWorkout(act: any, userId?: string | null) {
  const typeMap: Record<string, string> = {
    'Run': 'running',
    'Ride': 'cycling',
    'VirtualRide': 'cycling',
    'Walk': 'walking',
    'Hike': 'walking',
    'Swim': 'swimming',
    'WeightTraining': 'strength',
    'Workout': 'hiit'
  };

  const sportType = typeMap[act.sport_type || act.type] || 'other';
  const durationMinutes = Math.round((act.moving_time || act.elapsed_time || 0) / 60);
  const distanceKm = Number(((act.distance || 0) / 1000).toFixed(2));
  const avgSpeedKmh = act.average_speed ? Number((act.average_speed * 3.6).toFixed(1)) : undefined;
  const maxSpeedKmh = act.max_speed ? Number((act.max_speed * 3.6).toFixed(1)) : undefined;

  let avgPace: string | undefined = undefined;
  if (sportType === 'running' || sportType === 'walking') {
    if (act.average_speed && act.average_speed > 0) {
      const paceSec = 1000 / act.average_speed;
      const m = Math.floor(paceSec / 60);
      const s = Math.round(paceSec % 60);
      avgPace = `${String(m).padStart(2, '0')}'${String(s).padStart(2, '0')}" /km`;
    }
  } else if (sportType === 'swimming') {
    if (act.average_speed && act.average_speed > 0) {
      const pace100Sec = 100 / act.average_speed;
      const m = Math.floor(pace100Sec / 60);
      const s = Math.round(pace100Sec % 60);
      avgPace = `${String(m).padStart(2, '0')}'${String(s).padStart(2, '0')}" /100 m`;
    }
  }

  const startDate = act.start_date_local || act.start_date || new Date().toISOString();
  const dateStr = startDate.split('T')[0];
  const startTimeStr = startDate.split('T')[1]?.substring(0, 5);

  const now = new Date().toISOString();

  return {
    id: `wk-strava-${act.id}`,
    title: act.name || `${sportType.toUpperCase()} Antrenmanı`,
    sport_type: sportType,
    date: dateStr,
    start_time: startTimeStr,
    duration_minutes: durationMinutes,
    distance_km: distanceKm,
    calories: act.calories ? Math.round(act.calories) : 0,
    avg_speed_kmh: avgSpeedKmh,
    max_speed_kmh: maxSpeedKmh,
    avg_pace: avgPace,
    avg_heart_rate: act.average_heartrate ? Math.round(act.average_heartrate) : undefined,
    max_heart_rate: act.max_heartrate ? Math.round(act.max_heartrate) : undefined,
    elevation_gain_m: act.total_elevation_gain ? Math.round(act.total_elevation_gain) : undefined,
    cadence_spm: act.average_cadence ? Math.round(act.average_cadence * (sportType === 'running' ? 2 : 1)) : undefined,
    map_polyline: act.map?.summary_polyline || undefined,
    source: 'strava',
    external_id: `strava-${act.id}`,
    notes: act.description || `Strava üzerinden senkronize edildi. (Kudos: ${act.kudos_count || 0})`,
    created_at: now,
    updated_at: now,
    user_id: userId || null
  };
}
