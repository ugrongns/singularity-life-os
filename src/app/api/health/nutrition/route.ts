import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { nutritionMeals, userHealthProfile, waterIntakeLogs } from '@/db/schema';
import { eq, desc, and , or } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  try {
    await initDatabase();
    const user = await getAuthUser();
    const userId = user?.id;
    const familyId = user?.family_id || (userId ? `fam-${userId}` : null);
    const today = new Date().toISOString().split('T')[0];

    let profile = userId
      ? (await db.select().from(userHealthProfile).where(eq(userHealthProfile.user_id, userId)).limit(1))[0]
      : null;
    
    if (!profile) {
      profile = {
        id: `hp-${userId || 'guest'}`,
        daily_calorie_target: 2200,
        target_protein_g: 140,
        target_carbs_g: 180,
        target_fat_g: 65,
        daily_water_target_ml: 2500,
        consumed_water_ml: 0,
        active_fasting_protocol: '16:8',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: userId || null
      } as any;
    }

    const todayMeals = userId
      ? await db.select()
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
          .orderBy(desc(nutritionMeals.created_at))
      : [];

    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;

    for (const meal of todayMeals) {
      totalCalories += meal.calories;
      totalProtein += meal.protein_g;
      totalCarbs += meal.carbs_g;
      totalFat += meal.fat_g;
    }

    const summary = {
      consumed: {
        calories: Math.round(totalCalories),
        protein_g: Math.round(totalProtein),
        carbs_g: Math.round(totalCarbs),
        fat_g: Math.round(totalFat)
      },
      targets: {
        calories: profile?.daily_calorie_target || 2200,
        protein_g: profile?.target_protein_g || 140,
        carbs_g: profile?.target_carbs_g || 180,
        fat_g: profile?.target_fat_g || 65
      },
      percentages: {
        calories: Math.min(100, Math.round((totalCalories / (profile?.daily_calorie_target || 2200)) * 100)),
        protein: Math.min(100, Math.round((totalProtein / (profile?.target_protein_g || 140)) * 100)),
        carbs: Math.min(100, Math.round((totalCarbs / (profile?.target_carbs_g || 180)) * 100)),
        fat: Math.min(100, Math.round((totalFat / (profile?.target_fat_g || 65)) * 100))
      }
    };

    return NextResponse.json({
      success: true,
      data: {
        summary,
        profile,
        meals: todayMeals
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
    const today = now.split('T')[0];
    const familyId = user.family_id || `fam-${user.id}`;

    // Günlük Makro ve Su Hedeflerini Güncelleme
    if (action === 'update_profile') {
      const existing = (await db.select().from(userHealthProfile).where(eq(userHealthProfile.user_id, user.id)).limit(1))[0];
      const waterTarget = data.daily_water_target_ml !== undefined ? Number(data.daily_water_target_ml) : existing?.daily_water_target_ml || 2500;

      if (existing) {
        await db.update(userHealthProfile).set({
          daily_calorie_target: Number(data.daily_calorie_target) || existing.daily_calorie_target,
          target_protein_g: Number(data.target_protein_g) || existing.target_protein_g,
          target_carbs_g: Number(data.target_carbs_g) || existing.target_carbs_g,
          target_fat_g: Number(data.target_fat_g) || existing.target_fat_g,
          daily_water_target_ml: waterTarget,
          updated_at: now
        }).where(eq(userHealthProfile.id, existing.id));
      } else {
        await db.insert(userHealthProfile).values({
          id: `hp-${user.id}`,
          daily_calorie_target: Number(data.daily_calorie_target) || 2200,
          target_protein_g: Number(data.target_protein_g) || 140,
          target_carbs_g: Number(data.target_carbs_g) || 180,
          target_fat_g: Number(data.target_fat_g) || 65,
          daily_water_target_ml: waterTarget,
          consumed_water_ml: 0,
          active_fasting_protocol: '16:8',
          user_id: user.id,
          family_id: familyId,
          created_at: now,
          updated_at: now
        });
      }

      // Bugünün su günlüğündeki hedefi de güncelle
      const todayWaterLog = (await db.select().from(waterIntakeLogs).where(and(eq(waterIntakeLogs.date, today), eq(waterIntakeLogs.user_id, user.id))).limit(1))[0];
      if (todayWaterLog) {
        await db.update(waterIntakeLogs).set({ goal_ml: waterTarget, updated_at: now }).where(eq(waterIntakeLogs.id, todayWaterLog.id));
      }

      return NextResponse.json({ success: true, message: '⚙️ Günlük kalori, makro ve su hedefleriniz güncellendi!' });
    }

    // Öğün Silme
    if (action === 'delete_meal') {
      await db.delete(nutritionMeals).where(and(eq(nutritionMeals.id, data.id), eq(nutritionMeals.user_id, user.id)));
      return NextResponse.json({ success: true, message: 'Öğün silindi.' });
    }

    // Manuel veya Otomatik Öğün Ekleme
    const name = data.name || 'Öğün';
    const meal_type = data.meal_type || 'lunch';
    const multiplier = parseFloat(data.portion_multiplier) || 1.0;
    
    const calories = Math.round((parseFloat(data.calories || data.base_calories) || 0) * multiplier);
    const protein_g = Math.round((parseFloat(data.protein_g || data.base_protein) || 0) * multiplier);
    const carbs_g = Math.round((parseFloat(data.carbs_g || data.base_carbs) || 0) * multiplier);
    const fat_g = Math.round((parseFloat(data.fat_g || data.base_fat) || 0) * multiplier);

    const mealId = `meal-${Date.now()}`;

    await db.insert(nutritionMeals).values({
      id: mealId,
      member_id: user.id || 'member-default',
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
        userId: user.id
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
