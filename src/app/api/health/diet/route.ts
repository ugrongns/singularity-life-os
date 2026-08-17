import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { dietMealOptions, nutritionMeals } from '@/db/schema';
import { getAuthUser } from '@/lib/auth';
import { desc } from 'drizzle-orm';

export async function GET() {
  try {
    initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });

    const options = await db.select().from(dietMealOptions);
    const parsedOptions = (options).map((opt: any) => ({
      ...opt,
      checklist: JSON.parse(opt.items_checklist || '[]')
    }));

    return NextResponse.json({
      success: true,
      data: parsedOptions
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });

    const body = await req.json();
    const { option_id, custom_title, calories, protein_g, carbs_g, fat_g, notes } = body;

    const now = new Date().toISOString();
    const today = now.split('T')[0];

    await db.insert(nutritionMeals).values({
      id: `meal-${Date.now()}`,
      member_id: user.id,
      name: custom_title || 'Diyetisyen Menüsü Öğünü',
      meal_type: 'breakfast',
      calories: parseFloat(calories) || 380,
      protein_g: parseFloat(protein_g) || 20,
      carbs_g: parseFloat(carbs_g) || 35,
      fat_g: parseFloat(fat_g) || 15,
      portion_multiplier: 1.0,
      date: today,
      is_verified: 1,
      is_family_shared: 0,
      created_at: now,
      updated_at: now
    });

    return NextResponse.json({
      success: true,
      message: `📋 "${custom_title}" diyetisyen menüsünden seçilerek beslenmenize işlendi!`
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
