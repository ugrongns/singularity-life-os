import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { appSettings } from '@/db/schema';
import { getStravaConfig } from '@/lib/strava';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error || !code) {
      return NextResponse.redirect(`${url.origin}/health?strava_error=${error || 'no_code'}`);
    }

    const config = await getStravaConfig();
    if (!config.clientId || !config.clientSecret) {
      return NextResponse.redirect(`${url.origin}/health?strava_error=missing_credentials`);
    }

    // Token takası
    const tokenRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        grant_type: 'authorization_code'
      })
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('Strava token exchange error:', errText);
      return NextResponse.redirect(`${url.origin}/health?strava_error=exchange_failed`);
    }

    const tokenData = await tokenRes.json();
    await initDatabase();
    const now = new Date().toISOString();

    // Token ve atlet bilgilerini kaydet
    const updates = [
      { key: 'strava_access_token', value: tokenData.access_token },
      { key: 'strava_refresh_token', value: tokenData.refresh_token },
      { key: 'strava_expires_at', value: String(tokenData.expires_at) },
      { key: 'strava_athlete_id', value: String(tokenData.athlete?.id || '') },
      { key: 'strava_athlete_name', value: `${tokenData.athlete?.firstname || ''} ${tokenData.athlete?.lastname || ''}`.trim() }
    ];

    for (const u of updates) {
      await db.insert(appSettings).values({
        key: u.key,
        value: u.value,
        updated_at: now
      }).onConflictDoUpdate({
        target: appSettings.key,
        set: { value: u.value, updated_at: now }
      });
    }

    return NextResponse.redirect(`${url.origin}/health?strava=connected`);
  } catch (error: any) {
    console.error('Strava Callback Error:', error);
    return NextResponse.redirect(new URL('/health?strava_error=exception', req.url));
  }
}
