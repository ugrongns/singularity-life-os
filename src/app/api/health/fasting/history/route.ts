import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { fastingSessions } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { calculateFastingHistoryAnalytics, RawFastingSession } from '@/lib/fasting-analytics';

export async function GET(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get('member_id');

    // OWASP BOLA: Sadece oturum açmış kullanıcının (user_id) kayıtları çekilir
    const conditions = [
      eq(fastingSessions.user_id, user.id),
      eq(fastingSessions.is_active, 0)
    ];

    if (memberId) {
      conditions.push(eq(fastingSessions.member_id, memberId));
    }

    const rawSessions = await db.select()
      .from(fastingSessions)
      .where(and(...conditions))
      .orderBy(desc(fastingSessions.created_at))
      .limit(100);

    const summary = calculateFastingHistoryAnalytics(rawSessions as RawFastingSession[]);

    return NextResponse.json({
      success: true,
      data: summary
    });
  } catch (error: any) {
    console.error('Fasting History API Error:', error);
    return NextResponse.json({ success: false, error: error.message ?? 'Geçmiş analitiği alınamadı.' }, { status: 500 });
  }
}
