import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { authSessions } from '@/db/schema';
import { eq , or } from 'drizzle-orm';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    initDatabase();
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('singularity_session')?.value;

    if (sessionToken) {
      db.delete(authSessions).where(eq(authSessions.token, sessionToken));
    }

    cookieStore.delete('singularity_session');

    return NextResponse.json({
      success: true,
      message: 'Oturum kapatıldı, kilit ekranına yönlendiriliyorsunuz.'
    });
  } catch (error: any) {
    console.error('Logout API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
