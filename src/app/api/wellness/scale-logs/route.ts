import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { smartScaleLogs, biometrics } from '@/db/schema';
import { getAuthUser } from '@/lib/auth';
import { desc, eq, and, or, like } from 'drizzle-orm';
import { getTodayTurkeyDate } from '@/lib/date-utils';
import { resolveOptionalHealthMemberScope } from '@/lib/nutrition-memory';
import { buildHealthMemberFilter } from '@/lib/health-water';

function parseOptionalNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const cleaned = typeof val === 'string' ? val.replace(',', '.').trim() : val;
  if (cleaned === '') return null;
  const num = Number(cleaned);
  return Number.isFinite(num) && !Number.isNaN(num) ? num : null;
}

function parseOptionalInteger(val: unknown): number | null {
  const num = parseOptionalNumber(val);
  return num !== null ? Math.round(num) : null;
}

function normalizeScaleMeasurementDate(rawInput: unknown, fallbackToday: string): string {
  if (typeof rawInput !== 'string') return fallbackToday;
  const trimmed = rawInput.trim();
  if (!trimmed) return fallbackToday;
  const normalizedForParse = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(trimmed)
    ? trimmed.replace(' ', 'T')
    : trimmed;
  if (Number.isNaN(Date.parse(normalizedForParse))) {
    return fallbackToday;
  }
  return trimmed;
}

export async function GET(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const checkDate = searchParams.get('check_date');
    const rawMemberId = searchParams.get('member_id');
    const familyId = user.family_id || `fam-${user.id}`;
    const scope = await resolveOptionalHealthMemberScope(user.id, familyId, rawMemberId);
    if (!scope.authorized) {
      return NextResponse.json({ success: false, error: 'Seçilen aile üyesine erişim yetkiniz yok.' }, { status: 403 });
    }

    const memberCondition = buildHealthMemberFilter(smartScaleLogs.member_id, scope);

    // Duplicate kontrol modu: belirli bir tarihteki (saatli kayıtlar dahil) kayıt sayısını döndür
    if (checkDate) {
      const cleanDay = checkDate.trim().slice(0, 10);
      const dateMatch = /^\d{4}-\d{2}-\d{2}$/.test(cleanDay)
        ? or(eq(smartScaleLogs.measurement_date, cleanDay), like(smartScaleLogs.measurement_date, `${cleanDay}%`))
        : eq(smartScaleLogs.measurement_date, checkDate.trim());
      const existing = await db.select().from(smartScaleLogs)
        .where(and(dateMatch, eq(smartScaleLogs.user_id, user.id), memberCondition));
      return NextResponse.json({ exists: existing.length > 0, count: existing.length, date: checkDate });
    }

    const logs = await db.select().from(smartScaleLogs)
      .where(and(eq(smartScaleLogs.user_id, user.id), memberCondition))
      .orderBy(desc(smartScaleLogs.measurement_date));
    return NextResponse.json({ success: true, data: logs });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Tartı verileri alınamadı.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    const body = await req.json();

    const now = new Date().toISOString();
    const logId = `scale-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const todayStr = getTodayTurkeyDate();
    const familyId = user.family_id || `fam-${user.id}`;
    const urlMemberId = req.url ? new URL(req.url).searchParams.get('member_id') : null;
    const scope = await resolveOptionalHealthMemberScope(user.id, familyId, body.member_id ?? urlMemberId);
    if (!scope.authorized) {
      return NextResponse.json({ success: false, error: 'Seçilen aile üyesine erişim yetkiniz yok.' }, { status: 403 });
    }

    // Geçerli tarih/saat kontrolü (Saat bilgisi varsa measurement_datetime öncelikli korunur)
    const measurementDate = normalizeScaleMeasurementDate(
      body.measurement_datetime || body.measurement_date,
      todayStr
    );

    // Ağırlık doğrulama: Pozitif ve makul aralıkta geçerli bir sayı olmalı
    const weightKg = parseOptionalNumber(body.weight_kg);
    if (weightKg === null || weightKg <= 0 || weightKg > 500) {
      return NextResponse.json({
        success: false,
        error: 'Geçersiz ağırlık değeri. Ağırlık 0\'dan büyük (en fazla 500 kg) pozitif bir sayı olmalıdır.'
      }, { status: 400 });
    }

    const bodyFatPercent = parseOptionalNumber(body.body_fat_percent);

    await db.insert(smartScaleLogs).values({
      id: logId,
      member_id: scope.memberId,
      user_id: user.id,
      family_id: familyId,
      measurement_date: measurementDate,
      weight_kg: weightKg,
      bmi: parseOptionalNumber(body.bmi),
      body_fat_percent: bodyFatPercent,
      body_fat_mass_kg: parseOptionalNumber(body.body_fat_mass_kg),
      skeletal_muscle_percent: parseOptionalNumber(body.skeletal_muscle_percent),
      skeletal_muscle_mass_kg: parseOptionalNumber(body.skeletal_muscle_mass_kg),
      muscle_percent: parseOptionalNumber(body.muscle_percent),
      muscle_mass_kg: parseOptionalNumber(body.muscle_mass_kg),
      water_percent: parseOptionalNumber(body.water_percent),
      water_mass_kg: parseOptionalNumber(body.water_mass_kg),
      visceral_fat_rating: parseOptionalNumber(body.visceral_fat_rating),
      bone_mass_kg: parseOptionalNumber(body.bone_mass_kg),
      bmr_calories: parseOptionalNumber(body.bmr_calories),
      protein_percent: parseOptionalNumber(body.protein_percent),
      obesity_degree_percent: parseOptionalNumber(body.obesity_degree_percent),
      metabolic_age: parseOptionalNumber(body.metabolic_age),
      fat_free_mass_kg: parseOptionalNumber(body.fat_free_mass_kg),
      actual_age: parseOptionalInteger(body.actual_age),
      height_cm: parseOptionalInteger(body.height_cm),
      notes: typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null,
      created_at: now,
      updated_at: now
    });

    // Genel biometrics tablosuna da kaydet
    try {
      await db.insert(biometrics).values({
        id: `bio-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        member_id: scope.memberId,
        user_id: user.id,
        family_id: familyId,
        date: measurementDate.slice(0, 10),
        weight_kg: weightKg,
        body_fat_percent: bodyFatPercent,
        notes: 'Akıllı tartı taraması ile eklendi',
        created_at: now,
        updated_at: now
      });
    } catch (bioErr) {
      console.warn('Biometrics sync notice:', bioErr);
    }

    return NextResponse.json({
      success: true,
      message: '⚖️ Akıllı tartı ölçümü başarıyla kaydedildi!',
      data: { id: logId }
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Ölçüm kaydedilemedi.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
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
    let targetId = searchParams.get('id')?.trim() || '';
    if (!targetId) {
      const body = await req.json().catch(() => ({}));
      if (typeof body?.id === 'string') {
        targetId = body.id.trim();
      }
    }

    if (!targetId) {
      return NextResponse.json({ success: false, error: 'Silinecek ölçüm ID gereklidir.' }, { status: 400 });
    }

    const existingRows = await db.select().from(smartScaleLogs)
      .where(and(eq(smartScaleLogs.id, targetId), eq(smartScaleLogs.user_id, user.id)))
      .limit(1);
    const target = existingRows[0];

    if (!target) {
      return NextResponse.json({ success: false, error: 'Ölçüm kaydı bulunamadı veya bu işlem için yetkiniz yok.' }, { status: 403 });
    }

    await db.delete(smartScaleLogs)
      .where(and(eq(smartScaleLogs.id, targetId), eq(smartScaleLogs.user_id, user.id)));

    // Tarama sırasında biometrics tablosuna eşzamanlı eklenen tekil satırı da temizle
    try {
      const matchedBios = await db.select().from(biometrics).where(
        and(
          eq(biometrics.user_id, user.id),
          eq(biometrics.date, target.measurement_date.slice(0, 10)),
          eq(biometrics.weight_kg, target.weight_kg),
          eq(biometrics.notes, 'Akıllı tartı taraması ile eklendi')
        )
      ).limit(1);

      if (matchedBios[0]) {
        await db.delete(biometrics).where(and(eq(biometrics.id, matchedBios[0].id), eq(biometrics.user_id, user.id)));
      }
    } catch (bioErr) {
      console.warn('Biometrics cleanup notice:', bioErr);
    }

    return NextResponse.json({
      success: true,
      message: '🗑️ Akıllı tartı ölçümü silindi!'
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Ölçüm silinemedi.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
