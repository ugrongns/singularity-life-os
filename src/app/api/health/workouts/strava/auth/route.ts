import { NextResponse } from 'next/server';
import { getStravaConfig } from '@/lib/strava';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }

    const config = await getStravaConfig();
    if (!config.clientId) {
      return NextResponse.json({
        success: false,
        error: 'Strava Client ID ayarlanmamış. Lütfen Ayarlar bölümünden veya .env.local dosyasından STRAVA_CLIENT_ID tanımlayın.'
      }, { status: 400 });
    }

    const url = new URL(req.url);
    const origin = url.origin;
    const redirectUri = `${origin}/api/health/workouts/strava/callback`;
    const scope = 'read,activity:read_all';

    const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=${config.clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&approval_prompt=auto&scope=${scope}`;

    return NextResponse.redirect(stravaAuthUrl);
  } catch (error: any) {
    console.error('Strava Auth Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
