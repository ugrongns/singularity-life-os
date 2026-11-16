import { NextResponse } from 'next/server';
import { initDatabase } from '@/db';
import { getAuthUser } from '@/lib/auth';
import { resolveMealTextWithMemory, searchNutritionMemory } from '@/lib/nutrition-memory';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health/nutrition/lookup?q=...&limit=8
 * Kullanıcının geçmiş kayıtlarından ve öğrenilen besin hafızasından
 * %100 sıfır AI kotasıyla anlık öneriler döner.
 */
export async function GET(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = (searchParams.get('q') || '').trim();
    const limitParam = Number(searchParams.get('limit')) || 8;
    const limit = Math.min(20, Math.max(1, limitParam));
    const familyId = user.family_id || `fam-${user.id}`;

    const suggestions = await searchNutritionMemory({
      userId: user.id,
      familyId,
      query,
      limit
    });

    return NextResponse.json({
      success: true,
      data: {
        suggestions,
        quotaUsed: false
      }
    });
  } catch (error: any) {
    console.error('Nutrition Memory Lookup GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/health/nutrition/lookup
 * Girilen öğün metnini önce geçmiş ve öğrenilen besin hafızasından çözer;
 * yalnızca sistemde ilk kez görülen yeni kalemler için Gemini AI'a gider.
 */
export async function POST(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (!text) {
      return NextResponse.json({ success: false, error: 'Lütfen analiz edilecek yemek veya besin adını girin.' }, { status: 400 });
    }
    if (text.length > 500) {
      return NextResponse.json(
        { success: false, error: 'Tek seferde en fazla 500 karakterlik öğün metni analiz edilebilir.' },
        { status: 400 }
      );
    }

    const familyId = user.family_id || `fam-${user.id}`;
    const result = await resolveMealTextWithMemory({
      userId: user.id,
      familyId,
      text
    });

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Nutrition Memory Lookup POST Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
