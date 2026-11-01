import { NextResponse } from 'next/server';
import { getStravaConfig } from '@/lib/strava';
import { getAuthUser } from '@/lib/auth';
import crypto from 'crypto';

export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }

    const config = await getStravaConfig(user.id);
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

    // Kriptografik rastgele OAuth state nonce ve kullanıcı ID bağlama
    const nonce = crypto.randomBytes(16).toString('hex');
    const state = `${user.id}:${nonce}`;
    const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=${config.clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&approval_prompt=auto&scope=${scope}&state=${encodeURIComponent(state)}`;

    const res = NextResponse.redirect(stravaAuthUrl);
    res.cookies.set('strava_oauth_nonce', nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 600 // 10 dakika geçerli
    });
    return res;
  } catch (error: any) {
    console.error('Strava Auth Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
