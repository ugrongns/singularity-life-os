import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { nutritionMeals, userHealthProfile } from '@/db/schema';
import { eq, desc, and , or } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  try {
    initDatabase();
    const user = await getAuthUser();
    const userId = user?.id;
    const today = new Date().toISOString().split('T')[0];

    let profile = userId
      ? db.select().from(userHealthProfile).where(eq(userHealthProfile.user_id, userId)).limit(1).get()
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
      ? db.select()
          .from(nutritionMeals)
          .where(and(eq(nutritionMeals.date, today), or(eq(nutritionMeals.user_id, userId), eq(nutritionMeals.is_family_shared, 1))))
          .orderBy(desc(nutritionMeals.created_at))
          .all()
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
    initDatabase();
    const body = await req.json();
    const { action, ...data } = body;
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    // Günlük Makro Hedeflerini Güncelleme
    if (action === 'update_profile') {
      const existing = db.select().from(userHealthProfile).limit(1).get();

      if (existing) {
        db.update(userHealthProfile).set({
          daily_calorie_target: Number(data.daily_calorie_target) || existing.daily_calorie_target,
          target_protein_g: Number(data.target_protein_g) || existing.target_protein_g,
          target_carbs_g: Number(data.target_carbs_g) || existing.target_carbs_g,
          target_fat_g: Number(data.target_fat_g) || existing.target_fat_g,
          updated_at: now
        }).where(eq(userHealthProfile.id, existing.id)).run();
      } else {
        db.insert(userHealthProfile).values({
          id: `hp-${Date.now()}`,
          daily_calorie_target: Number(data.daily_calorie_target) || 2200,
          target_protein_g: Number(data.target_protein_g) || 140,
          target_carbs_g: Number(data.target_carbs_g) || 180,
          target_fat_g: Number(data.target_fat_g) || 65,
          created_at: now,
          updated_at: now
        }).run();
      }

      return NextResponse.json({ success: true, message: '⚙️ Günlük kalori ve makro hedefleriniz güncellendi!' });
    }

    // Öğün Silme
    if (action === 'delete_meal') {
      db.delete(nutritionMeals).where(eq(nutritionMeals.id, data.id)).run();
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

    db.insert(nutritionMeals).values({
      id: mealId,
      member_id: 'member-ugur',
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
      is_family_shared: 1,
      created_at: now,
      updated_at: now,
      sync_status: 'synced',
      device_id: 'mac-local'
    }).run();

    return NextResponse.json({
      success: true,
      message: `🥗 ${name} (${calories} kcal - ${protein_g}g Protein) günlük beslenmenize eklendi!`
    });
  } catch (error: any) {
    console.error('Save Meal Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
