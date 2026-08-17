import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { smartScaleLogs, biometrics } from '@/db/schema';
import { getAuthUser } from '@/lib/auth';
import { desc } from 'drizzle-orm';

export async function GET() {
  try {
    initDatabase();
    const logs = await db.select().from(smartScaleLogs).orderBy(desc(smartScaleLogs.measurement_date));
    return NextResponse.json({ success: true, data: logs });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    initDatabase();
    const user = await getAuthUser();
    const body = await req.json();

    const now = new Date().toISOString();
    const logId = `scale-${Date.now()}`;
    const todayStr = now.split('T')[0];
    let measurementDate = body.measurement_date || todayStr;
    // Eğer tarih 2026 yılından eskiyse veya geçersizse bugünün tarihini atayalım
    if (!measurementDate || measurementDate.startsWith('2025') || measurementDate.startsWith('2024')) {
      measurementDate = todayStr;
    }

    const weightKg = Number(body.weight_kg) || 0;
    const bodyFatPercent = body.body_fat_percent ? Number(body.body_fat_percent) : null;

    await db.insert(smartScaleLogs).values({
      id: logId,
      user_id: user?.id || null,
      measurement_date: measurementDate,
      weight_kg: weightKg,
      bmi: body.bmi ? Number(body.bmi) : null,
      body_fat_percent: bodyFatPercent,
      body_fat_mass_kg: body.body_fat_mass_kg ? Number(body.body_fat_mass_kg) : null,
      skeletal_muscle_percent: body.skeletal_muscle_percent ? Number(body.skeletal_muscle_percent) : null,
      skeletal_muscle_mass_kg: body.skeletal_muscle_mass_kg ? Number(body.skeletal_muscle_mass_kg) : null,
      muscle_percent: body.muscle_percent ? Number(body.muscle_percent) : null,
      muscle_mass_kg: body.muscle_mass_kg ? Number(body.muscle_mass_kg) : null,
      water_percent: body.water_percent ? Number(body.water_percent) : null,
      water_mass_kg: body.water_mass_kg ? Number(body.water_mass_kg) : null,
      visceral_fat_rating: body.visceral_fat_rating ? Number(body.visceral_fat_rating) : null,
      bone_mass_kg: body.bone_mass_kg ? Number(body.bone_mass_kg) : null,
      bmr_calories: body.bmr_calories ? Number(body.bmr_calories) : null,
      protein_percent: body.protein_percent ? Number(body.protein_percent) : null,
      obesity_degree_percent: body.obesity_degree_percent ? Number(body.obesity_degree_percent) : null,
      metabolic_age: body.metabolic_age ? Number(body.metabolic_age) : null,
      fat_free_mass_kg: body.fat_free_mass_kg ? Number(body.fat_free_mass_kg) : null,
      actual_age: body.actual_age ? Number(body.actual_age) : null,
      height_cm: body.height_cm ? Number(body.height_cm) : null,
      notes: body.notes || null,
      created_at: now,
      updated_at: now
    });

    // Genel biometrics tablosuna da kaydet
    if (weightKg > 0) {
      try {
        await db.insert(biometrics).values({
          id: `bio-${Date.now()}`,
          date: measurementDate,
          weight_kg: weightKg,
          body_fat_percent: bodyFatPercent,
          notes: 'Akıllı tartı taraması ile eklendi',
          created_at: now,
          updated_at: now
        });
      } catch (bioErr) {
        console.warn('Biometrics sync notice:', bioErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: '⚖️ Akıllı tartı ölçümü başarıyla kaydedildi!',
      data: { id: logId }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
