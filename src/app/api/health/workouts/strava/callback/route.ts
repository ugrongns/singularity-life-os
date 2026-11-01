import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { appSettings } from '@/db/schema';
import { getStravaConfig } from '@/lib/strava';
import { getAuthUser } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    const url = new URL(req.url);
    if (!user) {
      return NextResponse.redirect(`${url.origin}/health?strava_error=unauthorized`);
    }

    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    const state = url.searchParams.get('state');

    // 1. OAuth CSRF State Kontrolü (Cookie'deki kriptografik nonce ile doğrula)
    const cookieStore = await cookies();
    const savedNonce = cookieStore.get('strava_oauth_nonce')?.value;
    cookieStore.delete('strava_oauth_nonce');

    const stateParts = (state || '').split(':');
    const stateUserId = stateParts[0];
    const stateNonce = stateParts[1];

    if (!state || !savedNonce || !stateNonce || stateNonce !== savedNonce || stateUserId !== user.id) {
      return NextResponse.redirect(`${url.origin}/health?strava_error=invalid_state`);
    }

    if (error || !code) {
      return NextResponse.redirect(`${url.origin}/health?strava_error=${error || 'no_code'}`);
    }

    const config = await getStravaConfig(user.id);
    if (!config.clientId || !config.clientSecret) {
      return NextResponse.redirect(`${url.origin}/health?strava_error=missing_credentials`);
    }

    // 2. Token takası
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

    // 3. Kullanıcıya özel token ve atlet bilgilerini kaydet (Multi-tenant izolasyonu)
    const updates = [
      { key: `strava_access_token_${user.id}`, value: tokenData.access_token },
      { key: `strava_refresh_token_${user.id}`, value: tokenData.refresh_token },
      { key: `strava_expires_at_${user.id}`, value: String(tokenData.expires_at) },
      { key: `strava_athlete_id_${user.id}`, value: String(tokenData.athlete?.id || '') },
      { key: `strava_athlete_name_${user.id}`, value: `${tokenData.athlete?.firstname || ''} ${tokenData.athlete?.lastname || ''}`.trim() }
    ];

    // Master admin ise genel ayarlara da geriye dönük uyumluluk için kaydet
    if (user.is_master_account === 1 || user.role === 'admin') {
      updates.push(
        { key: 'strava_access_token', value: tokenData.access_token },
        { key: 'strava_refresh_token', value: tokenData.refresh_token },
        { key: 'strava_expires_at', value: String(tokenData.expires_at) },
        { key: 'strava_athlete_id', value: String(tokenData.athlete?.id || '') },
        { key: 'strava_athlete_name', value: `${tokenData.athlete?.firstname || ''} ${tokenData.athlete?.lastname || ''}`.trim() }
      );
    }

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
