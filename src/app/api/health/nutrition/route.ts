import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { nutritionMeals, nutritionMealItems, userHealthProfile, waterIntakeLogs } from '@/db/schema';
import { eq, desc, and, or } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { getTodayTurkeyDate } from '@/lib/date-utils';
import { learnFromSavedMeal, resolveAuthorizedMemberId, resolveOptionalHealthMemberScope } from '@/lib/nutrition-memory';
import {
  findScopedHealthProfile,
  findScopedTodayWaterLog,
  resolveProfileEffectiveMemberId,
} from '@/lib/health-water';

async function deleteUserMealSafely(mealId: string, userId: string) {
  if (!mealId || !userId) return;
  try {
    const owned = await db
      .select({ id: nutritionMeals.id })
      .from(nutritionMeals)
      .where(and(eq(nutritionMeals.id, mealId), eq(nutritionMeals.user_id, userId)))
      .limit(1);

    if (Array.isArray(owned) && owned.length > 0) {
      await db.delete(nutritionMealItems).where(eq(nutritionMealItems.meal_id, mealId));
    }
  } catch (err) {
    console.warn('Meal items cleanup notice:', err);
  }

  await db
    .delete(nutritionMeals)
    .where(and(eq(nutritionMeals.id, mealId), eq(nutritionMeals.user_id, userId)));
}

export async function GET(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }
    const userId = user.id;
    const familyId = user.family_id || `fam-${userId}`;
    const today = getTodayTurkeyDate();

    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get('member_id');
    const scope = await resolveOptionalHealthMemberScope(userId, familyId, memberId);
    if (!scope.authorized) {
      return NextResponse.json({ success: false, error: 'Seçilen aile üyesine erişim yetkiniz yok.' }, { status: 403 });
    }
    const effectiveMemberId = resolveProfileEffectiveMemberId(scope);

    let profile = await findScopedHealthProfile(userId, scope);
    
    if (!profile) {
      profile = {
        id: effectiveMemberId ? `hp-${userId}-${effectiveMemberId}` : `hp-${userId}`,
        member_id: effectiveMemberId,
        daily_calorie_target: 2200,
        target_protein_g: 140,
        target_carbs_g: 180,
        target_fat_g: 65,
        daily_water_target_ml: 2500,
        consumed_water_ml: 0,
        active_fasting_protocol: '16:8',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: userId
      } as any;
    }

    let todayMeals = await db.select()
      .from(nutritionMeals)
      .where(
        and(
          eq(nutritionMeals.date, today),
          or(
            eq(nutritionMeals.user_id, userId),
            familyId ? and(eq(nutritionMeals.family_id, familyId), eq(nutritionMeals.is_family_shared, 1)) : undefined
          )
        )
      )
      .orderBy(desc(nutritionMeals.created_at));

    // Eğer belirli bir aile üyesi seçildiyse ona göre filtrele
    if (scope.memberId) {
      todayMeals = todayMeals.filter(m =>
        scope.isPrimarySelf ? (m.member_id === scope.memberId || !m.member_id) : m.member_id === scope.memberId
      );
    }

    // PostgreSQL real(float4) kaynaklı 2.5999999 artifaktlarını 1 ondalığa normalize et
    const sanitizedMeals = todayMeals.map(meal => ({
      ...meal,
      calories: Math.round(Number(meal.calories) || 0),
      protein_g: Math.round((Number(meal.protein_g) || 0) * 10) / 10,
      carbs_g: Math.round((Number(meal.carbs_g) || 0) * 10) / 10,
      fat_g: Math.round((Number(meal.fat_g) || 0) * 10) / 10
    }));

    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;

    for (const meal of sanitizedMeals) {
      totalCalories += meal.calories;
      totalProtein += meal.protein_g;
      totalCarbs += meal.carbs_g;
      totalFat += meal.fat_g;
    }

    const calTargetSummary = profile?.daily_calorie_target ?? 2200;
    const proTargetSummary = profile?.target_protein_g ?? 140;
    const carbTargetSummary = profile?.target_carbs_g ?? 180;
    const fatTargetSummary = profile?.target_fat_g ?? 65;

    const summary = {
      consumed: {
        calories: Math.round(totalCalories),
        protein_g: Math.round(totalProtein * 10) / 10,
        carbs_g: Math.round(totalCarbs * 10) / 10,
        fat_g: Math.round(totalFat * 10) / 10
      },
      targets: {
        calories: calTargetSummary,
        protein_g: proTargetSummary,
        carbs_g: carbTargetSummary,
        fat_g: fatTargetSummary
      },
      percentages: {
        calories: calTargetSummary > 0 ? Math.min(100, Math.round((totalCalories / calTargetSummary) * 100)) : 0,
        protein: proTargetSummary > 0 ? Math.min(100, Math.round((totalProtein / proTargetSummary) * 100)) : 0,
        carbs: carbTargetSummary > 0 ? Math.min(100, Math.round((totalCarbs / carbTargetSummary) * 100)) : 0,
        fat: fatTargetSummary > 0 ? Math.min(100, Math.round((totalFat / fatTargetSummary) * 100)) : 0
      }
    };

    return NextResponse.json({
      success: true,
      data: {
        summary,
        profile,
        meals: sanitizedMeals
      }
    });
  } catch (error: any) {
    console.error('Nutrition API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 });
    }

    const body = await req.json();
    const { action, ...data } = body;
    const now = new Date().toISOString();
    const today = getTodayTurkeyDate();
    const familyId = user.family_id || `fam-${user.id}`;

    // Günlük Makro ve Su Hedeflerini Güncelleme
    if (action === 'update_profile') {
      const scope = await resolveOptionalHealthMemberScope(user.id, familyId, data.member_id);
      if (!scope.authorized) {
        return NextResponse.json({ success: false, error: 'Seçilen aile üyesine erişim yetkiniz yok.' }, { status: 403 });
      }
      const effectiveMemberId = resolveProfileEffectiveMemberId(scope);
      const existing = await findScopedHealthProfile(user.id, scope);
      const toSafeTarget = (raw: any, fallback: number, minVal: number) => {
        if (raw === undefined || raw === null || raw === '') return fallback;
        const n = Number(raw);
        return Number.isFinite(n) && n >= minVal ? n : fallback;
      };
      const waterTarget = Math.min(10000, toSafeTarget(data.daily_water_target_ml, existing?.daily_water_target_ml ?? 2500, 500));
      const calTarget = toSafeTarget(data.daily_calorie_target, existing?.daily_calorie_target ?? 2200, 1);
      const proTarget = toSafeTarget(data.target_protein_g, existing?.target_protein_g ?? 140, 0);
      const carbTarget = toSafeTarget(data.target_carbs_g, existing?.target_carbs_g ?? 180, 0);
      const fatTarget = toSafeTarget(data.target_fat_g, existing?.target_fat_g ?? 65, 0);

      if (existing) {
        await db.update(userHealthProfile).set({
          daily_calorie_target: calTarget,
          target_protein_g: proTarget,
          target_carbs_g: carbTarget,
          target_fat_g: fatTarget,
          daily_water_target_ml: waterTarget,
          updated_at: now
        }).where(eq(userHealthProfile.id, existing.id));
      } else {
        await db.insert(userHealthProfile).values({
          id: effectiveMemberId ? `hp-${user.id}-${effectiveMemberId}` : `hp-${user.id}`,
          member_id: effectiveMemberId,
          daily_calorie_target: calTarget,
          target_protein_g: proTarget,
          target_carbs_g: carbTarget,
          target_fat_g: fatTarget,
          daily_water_target_ml: waterTarget,
          consumed_water_ml: 0,
          active_fasting_protocol: '16:8',
          user_id: user.id,
          family_id: familyId,
          created_at: now,
          updated_at: now
        });
      }

      // Bugünün su günlüğündeki hedefi de ilgili üye kapsamında güncelle
      const todayWaterLog = await findScopedTodayWaterLog(user.id, today, scope);
      if (todayWaterLog) {
        await db.update(waterIntakeLogs).set({ goal_ml: waterTarget, updated_at: now }).where(eq(waterIntakeLogs.id, todayWaterLog.id));
      }

      return NextResponse.json({ success: true, message: '⚙️ Günlük kalori, makro ve su hedefleriniz güncellendi!' });
    }

    // Öğün Silme
    if (action === 'delete_meal') {
      await deleteUserMealSafely(data.id, user.id);
      return NextResponse.json({ success: true, message: 'Öğün silindi.' });
    }

    // Manuel veya Otomatik Öğün Ekleme
    const name = data.name || 'Öğün';
    const meal_type = data.meal_type || 'lunch';
    const rawMultiplier = parseFloat(data.portion_multiplier);
    const multiplier = Number.isFinite(rawMultiplier) && rawMultiplier > 0 ? rawMultiplier : 1.0;

    const calories = Math.max(0, Math.round((parseFloat(data.calories ?? data.base_calories) || 0) * multiplier));
    const protein_g = Math.max(0, Math.round(((parseFloat(data.protein_g ?? data.base_protein) || 0) * multiplier) * 10) / 10);
    const carbs_g = Math.max(0, Math.round(((parseFloat(data.carbs_g ?? data.base_carbs) || 0) * multiplier) * 10) / 10);
    const fat_g = Math.max(0, Math.round(((parseFloat(data.fat_g ?? data.base_fat) || 0) * multiplier) * 10) / 10);

    const mealId = `meal-${Date.now()}`;

    // Aile üyesi sahipliğini doğrula (OWASP BOLA koruması)
    const { memberId, authorized } = await resolveAuthorizedMemberId(user.id, familyId, data.member_id);
    if (!authorized) {
      return NextResponse.json({ success: false, error: 'Seçilen aile üyesine erişim yetkiniz yok.' }, { status: 403 });
    }

    await db.insert(nutritionMeals).values({
      id: mealId,
      member_id: memberId,
      name,
      meal_type,
      calories,
      protein_g,
      carbs_g,
      fat_g,
      portion_multiplier: multiplier,
      image_url: data.image_url || null,
      date: data.date || today,
      is_verified: 1,
      is_family_shared: data.is_family_shared !== undefined ? Number(data.is_family_shared) : 0,
      created_at: now,
      updated_at: now,
      sync_status: 'synced',
      device_id: 'web-client',
      user_id: user.id,
      family_id: familyId
    });

    // Öğrenilen Besin Hafızası: Öğün kalemlerini ve 100g profillerini kalıcı kaydet
    const explicitGrams =
      data.grams !== undefined && data.grams !== null && data.grams !== '' && Number.isFinite(Number(data.grams))
        ? Number(data.grams)
        : undefined;
    try {
      await learnFromSavedMeal({
        userId: user.id,
        mealId,
        mealName: name,
        totalCalories: calories,
        totalProteinG: protein_g,
        totalCarbsG: carbs_g,
        totalFatG: fat_g,
        defaultGrams: explicitGrams,
        items: Array.isArray(data.items) ? data.items : undefined
      });
    } catch (learnErr) {
      console.warn('Nutrition memory learn notice:', learnErr);
    }

    // Event Bus üzerinden beslenme olayını bildir
    try {
      const { eventBus, EVENTS } = await import('@/lib/events');
      await eventBus.emit(EVENTS.DIET_MEAL_RECORDED, {
        mealId,
        name,
        calories,
        protein_g,
        carbs_g,
        fat_g,
        userId: user.id,
        familyId
      });
    } catch (evErr) {
      console.warn('EventBus emit notice:', evErr);
    }

    return NextResponse.json({
      success: true,
      message: `🥗 ${name} (${calories} kcal - ${protein_g}g Protein) günlük beslenmenize eklendi!`
    });
  } catch (error: any) {
    console.error('Save Meal Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Öğün ID gereklidir.' }, { status: 400 });
    }

    await deleteUserMealSafely(id, user.id);

    return NextResponse.json({
      success: true,
      message: 'Öğün kaydı silindi.'
    });
  } catch (error: any) {
    console.error('Delete Meal Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
