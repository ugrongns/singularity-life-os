import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { workoutSessions } from '@/db/schema';
import { getValidStravaAccessToken, mapStravaActivityToWorkout, getStravaConfig } from '@/lib/strava';
import { getAuthUser } from '@/lib/auth';
import { eq, inArray, and } from 'drizzle-orm';

export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }

    const config = await getStravaConfig(user.id);
    return NextResponse.json({
      success: true,
      data: {
        isConnected: config.isConnected,
        athleteId: config.athleteId,
        hasClientId: !!config.clientId
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }

    const accessToken = await getValidStravaAccessToken(user.id);
    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'Strava bağlı değil veya oturum süresi dolmuş. Lütfen önce Strava ile bağlanın.'
      }, { status: 400 });
    }

    const { searchParams } = new URL(req.url, 'http://localhost');
    const body = await req.json().catch(() => ({}));
    const page = Math.max(1, parseInt(searchParams.get('page') || body.page || '1', 10));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('per_page') || body.per_page || '30', 10)));

    // Strava aktivitelerini sayfalama desteğiyle çek (Bulgu 19)
    const stravaRes = await fetch(`https://www.strava.com/api/v3/athlete/activities?page=${page}&per_page=${perPage}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!stravaRes.ok) {
      console.warn(`[Strava Sync] HTTP ${stravaRes.status} received from Strava API`);
      return NextResponse.json({ success: false, error: 'Strava aktiviteleri alınamadı. Lütfen daha sonra tekrar deneyin.' }, { status: 502 });
    }

    const activities: any[] = await stravaRes.json();
    if (!Array.isArray(activities) || activities.length === 0) {
      return NextResponse.json({ success: true, message: 'Senkronize edilecek yeni Strava aktivitesi bulunamadı.', importedCount: 0 });
    }

    // Mevcut external_id'leri kontrol et
    const externalIds = activities.map(a => `strava-${a.id}`);
    const existingWorkouts = await db
      .select({ external_id: workoutSessions.external_id })
      .from(workoutSessions)
      .where(
        and(
          inArray(workoutSessions.external_id, externalIds),
          eq(workoutSessions.user_id, user.id)
        )
      );

    const existingIdSet = new Set(existingWorkouts.map(w => w.external_id));

    let importedCount = 0;
    for (const act of activities) {
      const extId = `strava-${act.id}`;
      if (existingIdSet.has(extId)) continue;

      const workoutData = mapStravaActivityToWorkout(act, user.id);
      await db.insert(workoutSessions).values(workoutData);
      importedCount++;
    }

    return NextResponse.json({
      success: true,
      message: importedCount > 0
        ? `🚴 ${importedCount} adet yeni Strava antrenmanı başarıyla senkronize edildi!`
        : 'Tüm Strava antrenmanlarınız zaten güncel.',
      importedCount
    });
  } catch (error: any) {
    console.error('Strava Sync Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
