import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { dietMealOptions, nutritionMeals } from '@/db/schema';
import { getAuthUser } from '@/lib/auth';
import { eq, asc } from 'drizzle-orm';

export async function GET() {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });

    const options = await db.select().from(dietMealOptions).orderBy(asc(dietMealOptions.option_number));
    const parsedOptions = options.map((opt: any) => {
      let checklist: string[] = [];
      try {
        checklist = JSON.parse(opt.items_checklist || '[]');
      } catch {
        checklist = opt.items_checklist ? [opt.items_checklist] : [];
      }
      return {
        ...opt,
        checklist
      };
    });

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
    await initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });

    const body = await req.json();

    // 1. Yeni Diyet Menüsü Şablonu Ekleme İşlemi
    if (body.action === 'create') {
      const { title, meal_type, description, checklist, calories, protein_g, carbs_g, fat_g, option_number } = body;
      if (!title) {
        return NextResponse.json({ success: false, error: 'Öğün başlığı zorunludur.' }, { status: 400 });
      }

      const now = new Date().toISOString();
      const newOptionId = `diet-opt-${Date.now()}`;
      const itemsJson = JSON.stringify(Array.isArray(checklist) ? checklist : []);

      await db.insert(dietMealOptions).values({
        id: newOptionId,
        meal_type: meal_type || 'breakfast',
        option_number: Number(option_number) || 1,
        title: title.trim(),
        description: description?.trim() || '',
        items_checklist: itemsJson,
        calories: parseFloat(calories) || 0,
        protein_g: parseFloat(protein_g) || 0,
        carbs_g: parseFloat(carbs_g) || 0,
        fat_g: parseFloat(fat_g) || 0,
        created_at: now,
        updated_at: now
      });

      return NextResponse.json({
        success: true,
        message: '✅ Yeni diyet menüsü başarıyla kaydedildi!',
        id: newOptionId
      });
    }

    // 2. Mevcut Menüyü Günlük Beslenmeye / Makrolara İşleme İşlemi (Varsayılan)
    const { custom_title, calories, protein_g, carbs_g, fat_g } = body;

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

export async function PUT(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });

    const body = await req.json();
    const { id, title, meal_type, description, checklist, calories, protein_g, carbs_g, fat_g, option_number } = body;

    if (!id || !title) {
      return NextResponse.json({ success: false, error: 'Menü ID ve başlık zorunludur.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const itemsJson = JSON.stringify(Array.isArray(checklist) ? checklist : []);

    await db.update(dietMealOptions)
      .set({
        title: title.trim(),
        meal_type: meal_type || 'breakfast',
        option_number: Number(option_number) || 1,
        description: description?.trim() || '',
        items_checklist: itemsJson,
        calories: parseFloat(calories) || 0,
        protein_g: parseFloat(protein_g) || 0,
        carbs_g: parseFloat(carbs_g) || 0,
        fat_g: parseFloat(fat_g) || 0,
        updated_at: now
      })
      .where(eq(dietMealOptions.id, id));

    return NextResponse.json({
      success: true,
      message: '✅ Diyet menüsü başarıyla güncellendi!'
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Silinecek menü ID belirtilmedi.' }, { status: 400 });
    }

    await db.delete(dietMealOptions).where(eq(dietMealOptions.id, id));

    return NextResponse.json({
      success: true,
      message: '🗑️ Diyet menüsü silindi.'
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
