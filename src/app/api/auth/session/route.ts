import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { users, authSessions } from '@/db/schema';
import { eq, gt , or } from 'drizzle-orm';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    initDatabase();
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('singularity_session')?.value;

    const allUsers = await db.select().from(users).all();
    const isInitialized = allUsers.length > 0;

    if (!sessionToken) {
      return NextResponse.json({
        success: true,
        data: {
          is_initialized: isInitialized,
          is_authenticated: false,
          user: null,
          users_count: allUsers.length
        }
      });
    }

    const now = new Date().toISOString();
    const session = await db.select().from(authSessions)
      .where(eq(authSessions.token, sessionToken))
      .limit(1)
      .get();

    if (!session || session.expires_at < now) {
      return NextResponse.json({
        success: true,
        data: {
          is_initialized: isInitialized,
          is_authenticated: false,
          user: null,
          users_count: allUsers.length
        }
      });
    }

    const user = await db.select().from(users).where(eq(users.id, session.user_id)).limit(1).get();
    if (!user) {
      return NextResponse.json({
        success: true,
        data: {
          is_initialized: isInitialized,
          is_authenticated: false,
          user: null
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        is_initialized: true,
        is_authenticated: true,
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          avatar_emoji: user.avatar_emoji,
          is_master_account: user.is_master_account === 1
        }
      }
    });
  } catch (error: any) {
    console.error('Auth Session Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
