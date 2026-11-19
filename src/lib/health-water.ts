import { and, eq, isNull, or } from 'drizzle-orm';
import { db } from '@/db';
import { userHealthProfile, waterIntakeLogs } from '@/db/schema';
import { getTodayTurkeyDate } from '@/lib/date-utils';
import type { HealthMemberScope } from '@/lib/nutrition-memory';

const DEFAULT_SCOPE: HealthMemberScope = {
  authorized: true,
  memberId: null,
  isPrimarySelf: true,
};

/**
 * Liste/oturum sorgularında seçili aile üyesine göre üye filtresi üretir.
 * - `memberId === null`: "Tümü" seçili, filtre uygulanmaz (`undefined`)
 * - `isPrimarySelf === true`: Hesap sahibinin kendi kayıtları (`member_id = id` veya `member_id IS NULL`)
 * - `isPrimarySelf === false`: Yalnızca seçili diğer aile üyesinin kayıtları
 */
export function buildHealthMemberFilter(column: any, scope: HealthMemberScope) {
  if (!scope.memberId) return undefined;
  if (scope.isPrimarySelf) {
    return or(eq(column, scope.memberId), isNull(column));
  }
  return eq(column, scope.memberId);
}

/**
 * Profil ve günlük su kayıtları gibi tekil kayıtlarda hesap sahibi ("Tümü" veya kendi hapı) ile
 * diğer aile üyelerinin satırlarını ayırır.
 */
export function resolveProfileEffectiveMemberId(scope: HealthMemberScope = DEFAULT_SCOPE): string | null {
  return scope.memberId && !scope.isPrimarySelf ? scope.memberId : null;
}

export function buildHealthProfileWhere(userId: string, scope: HealthMemberScope = DEFAULT_SCOPE) {
  const effectiveMemberId = resolveProfileEffectiveMemberId(scope);
  if (effectiveMemberId) {
    return and(eq(userHealthProfile.user_id, userId), eq(userHealthProfile.member_id, effectiveMemberId));
  }
  return and(eq(userHealthProfile.user_id, userId), isNull(userHealthProfile.member_id));
}

export function buildWaterLogWhere(userId: string, date: string, scope: HealthMemberScope = DEFAULT_SCOPE) {
  const effectiveMemberId = resolveProfileEffectiveMemberId(scope);
  if (effectiveMemberId) {
    return and(
      eq(waterIntakeLogs.date, date),
      eq(waterIntakeLogs.user_id, userId),
      eq(waterIntakeLogs.member_id, effectiveMemberId)
    );
  }
  return and(
    eq(waterIntakeLogs.date, date),
    eq(waterIntakeLogs.user_id, userId),
    isNull(waterIntakeLogs.member_id)
  );
}

export async function findScopedHealthProfile(userId: string, scope: HealthMemberScope = DEFAULT_SCOPE) {
  const rows = await db
    .select()
    .from(userHealthProfile)
    .where(buildHealthProfileWhere(userId, scope))
    .limit(1);
  return rows[0] || null;
}

export async function findScopedTodayWaterLog(
  userId: string,
  today: string,
  scope: HealthMemberScope = DEFAULT_SCOPE
) {
  const rows = await db
    .select()
    .from(waterIntakeLogs)
    .where(buildWaterLogWhere(userId, today, scope))
    .limit(1);
  return rows[0] || null;
}

/**
 * `/api/health/water`, `/api/telegram` ve `/api/voice-command` kanallarında
 * günlük `waterIntakeLogs` ve `userHealthProfile.consumed_water_ml` alanlarını eşzamanlı günceller.
 */
export async function syncDailyWaterIntake(params: {
  userId: string;
  familyId: string;
  amountMl?: number | null;
  reset?: boolean;
  defaultAddMl?: number;
  scope?: HealthMemberScope;
  nowDate?: Date;
}): Promise<{ consumedMl: number; targetMl: number; addedMl: number }> {
  const nowDate = params.nowDate ?? new Date();
  const now = nowDate.toISOString();
  const today = getTodayTurkeyDate(nowDate);
  const scope = params.scope ?? DEFAULT_SCOPE;
  const effectiveMemberId = resolveProfileEffectiveMemberId(scope);
  const defaultAdd = params.defaultAddMl ?? 250;

  const profile = await findScopedHealthProfile(params.userId, scope);
  const todayLog = await findScopedTodayWaterLog(params.userId, today, scope);

  const currentConsumed = todayLog ? todayLog.amount_ml : 0;
  const rawAmount = params.amountMl === undefined || params.amountMl === null ? defaultAdd : Number(params.amountMl);
  const safeAdded = Number.isFinite(rawAmount) ? Math.max(0, Math.round(rawAmount)) : defaultAdd;
  const current = params.reset ? 0 : currentConsumed + safeAdded;
  const target = profile?.daily_water_target_ml || todayLog?.goal_ml || 2500;

  if (profile?.id) {
    await db
      .update(userHealthProfile)
      .set({ consumed_water_ml: current, updated_at: now })
      .where(eq(userHealthProfile.id, profile.id));
  } else {
    await db.insert(userHealthProfile).values({
      id: effectiveMemberId ? `hp-${params.userId}-${effectiveMemberId}` : `hp-${params.userId}`,
      member_id: effectiveMemberId,
      daily_calorie_target: 2200,
      target_protein_g: 140,
      target_carbs_g: 180,
      target_fat_g: 65,
      daily_water_target_ml: target,
      consumed_water_ml: current,
      active_fasting_protocol: '16:8',
      user_id: params.userId,
      family_id: params.familyId,
      created_at: now,
      updated_at: now,
    });
  }

  if (todayLog?.id) {
    await db
      .update(waterIntakeLogs)
      .set({ amount_ml: current, goal_ml: target, updated_at: now })
      .where(eq(waterIntakeLogs.id, todayLog.id));
  } else {
    await db.insert(waterIntakeLogs).values({
      id: `water-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: today,
      amount_ml: current,
      goal_ml: target,
      member_id: effectiveMemberId,
      user_id: params.userId,
      family_id: params.familyId,
      created_at: now,
      updated_at: now,
    });
  }

  return { consumedMl: current, targetMl: target, addedMl: params.reset ? 0 : safeAdded };
}

/**
 * Günlük su hedefini üye bazında (`500..10000 ml`) günceller ve bugünün su günlüğü hedefiyle eşitler.
 */
export async function updateScopedWaterTarget(params: {
  userId: string;
  familyId: string;
  targetMl: number;
  scope?: HealthMemberScope;
  nowDate?: Date;
}): Promise<number> {
  const nowDate = params.nowDate ?? new Date();
  const now = nowDate.toISOString();
  const today = getTodayTurkeyDate(nowDate);
  const scope = params.scope ?? DEFAULT_SCOPE;
  const effectiveMemberId = resolveProfileEffectiveMemberId(scope);
  const newTarget = Math.max(500, Math.min(10000, Number(params.targetMl) || 2500));

  const profile = await findScopedHealthProfile(params.userId, scope);
  const todayLog = await findScopedTodayWaterLog(params.userId, today, scope);

  if (profile?.id) {
    await db
      .update(userHealthProfile)
      .set({ daily_water_target_ml: newTarget, updated_at: now })
      .where(eq(userHealthProfile.id, profile.id));
  } else {
    await db.insert(userHealthProfile).values({
      id: effectiveMemberId ? `hp-${params.userId}-${effectiveMemberId}` : `hp-${params.userId}`,
      member_id: effectiveMemberId,
      daily_calorie_target: 2200,
      target_protein_g: 140,
      target_carbs_g: 180,
      target_fat_g: 65,
      daily_water_target_ml: newTarget,
      consumed_water_ml: 0,
      active_fasting_protocol: '16:8',
      user_id: params.userId,
      family_id: params.familyId,
      created_at: now,
      updated_at: now,
    });
  }

  if (todayLog?.id) {
    await db
      .update(waterIntakeLogs)
      .set({ goal_ml: newTarget, updated_at: now })
      .where(eq(waterIntakeLogs.id, todayLog.id));
  } else {
    await db.insert(waterIntakeLogs).values({
      id: `water-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: today,
      amount_ml: 0,
      goal_ml: newTarget,
      member_id: effectiveMemberId,
      user_id: params.userId,
      family_id: params.familyId,
      created_at: now,
      updated_at: now,
    });
  }

  return newTarget;
}
