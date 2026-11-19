import { NextResponse } from 'next/server';
import { initDatabase } from '@/db';
import { getAuthUser } from '@/lib/auth';
import { getTodayTurkeyDate } from '@/lib/date-utils';
import { resolveOptionalHealthMemberScope } from '@/lib/nutrition-memory';
import {
  findScopedHealthProfile,
  findScopedTodayWaterLog,
  syncDailyWaterIntake,
  updateScopedWaterTarget,
} from '@/lib/health-water';

export async function GET(): Promise<NextResponse>;
export async function GET(req: Request): Promise<NextResponse>;
export async function GET(req?: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });

    const today = getTodayTurkeyDate();
    const familyId = user.family_id || `fam-${user.id}`;
    const rawMemberId = req ? new URL(req.url).searchParams.get('member_id') : null;
    const scope = await resolveOptionalHealthMemberScope(user.id, familyId, rawMemberId);
    if (!scope.authorized) {
      return NextResponse.json({ success: false, error: 'Seçilen aile üyesine erişim yetkiniz yok.' }, { status: 403 });
    }

    const profile = await findScopedHealthProfile(user.id, scope);
    const todayLog = await findScopedTodayWaterLog(user.id, today, scope);

    const target = todayLog?.goal_ml || profile?.daily_water_target_ml || 2500;
    // Yeni gün için kayıt yoksa dünün tüketimi devretmemeli, 0 ml kabul edilmeli
    const consumed = todayLog ? todayLog.amount_ml : 0;
    const percentage = target > 0 ? Math.min(100, Math.round((consumed / target) * 100)) : 0;

    return NextResponse.json({
      success: true,
      data: {
        target_ml: target,
        consumed_ml: consumed,
        remaining_ml: Math.max(0, target - consumed),
        percentage
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
    if (!user) return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });

    const body = await req.json();
    const { action, target_ml, amount_ml = 250, reset = false, member_id } = body;
    const urlMemberId = new URL(req.url).searchParams.get('member_id');
    const familyId = user.family_id || `fam-${user.id}`;
    const scope = await resolveOptionalHealthMemberScope(user.id, familyId, member_id ?? urlMemberId);
    if (!scope.authorized) {
      return NextResponse.json({ success: false, error: 'Seçilen aile üyesine erişim yetkiniz yok.' }, { status: 403 });
    }

    // 🎯 HEDEF BELİRLEME (SET WATER GOAL)
    if (action === 'set_target' || (target_ml !== undefined && action !== 'log_water')) {
      const newTarget = await updateScopedWaterTarget({
        userId: user.id,
        familyId,
        targetMl: target_ml,
        scope,
      });

      return NextResponse.json({
        success: true,
        message: `🎯 Günlük su içme hedefiniz ${newTarget} ml olarak güncellendi!`,
        target_ml: newTarget
      });
    }

    // 💧 SU İÇME KAYDI (Ortak yardımcı ile daily log + profile senkron)
    const { consumedMl, targetMl, addedMl } = await syncDailyWaterIntake({
      userId: user.id,
      familyId,
      amountMl: amount_ml,
      reset: Boolean(reset),
      defaultAddMl: 250,
      scope,
    });

    return NextResponse.json({
      success: true,
      message: reset ? '💧 Günlük su sayacı sıfırlandı.' : `💧 +${addedMl} ml su kaydedildi! Toplam: ${consumedMl} ml`,
      consumed_ml: consumedMl,
      target_ml: targetMl
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
