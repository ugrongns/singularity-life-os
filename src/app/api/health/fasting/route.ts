import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { fastingSessions } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { resolveOptionalHealthMemberScope } from '@/lib/nutrition-memory';
import { buildHealthMemberFilter } from '@/lib/health-water';

export async function GET(): Promise<NextResponse>;
export async function GET(req: Request): Promise<NextResponse>;
export async function GET(req?: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }
    const userId = user.id;
    const familyId = user.family_id || `fam-${userId}`;
    const rawMemberId = req ? new URL(req.url).searchParams.get('member_id') : null;
    const scope = await resolveOptionalHealthMemberScope(userId, familyId, rawMemberId);
    if (!scope.authorized) {
      return NextResponse.json({ success: false, error: 'Seçilen aile üyesine erişim yetkiniz yok.' }, { status: 403 });
    }

    const memberCondition = buildHealthMemberFilter(fastingSessions.member_id, scope);
    const activeConditions = memberCondition
      ? and(eq(fastingSessions.is_active, 1), eq(fastingSessions.user_id, userId), memberCondition)
      : and(eq(fastingSessions.is_active, 1), eq(fastingSessions.user_id, userId));

    let activeSession = (await db.select()
      .from(fastingSessions)
      .where(activeConditions)
      .orderBy(desc(fastingSessions.created_at))
      .limit(1))[0];

    const now = Date.now();

    // 1. Zombi Seans Kalkanı: Hedef bitişin üzerinden 48 saat geçmiş veya toplam 7 günü aşmış terk edilmiş seansları kapat
    if (activeSession) {
      const startTime = new Date(activeSession.start_time).getTime();
      const targetTime = new Date(activeSession.target_end_time).getTime();
      const elapsedHours = (now - startTime) / (1000 * 60 * 60);

      if (elapsedHours > 168 || (now - targetTime > 48 * 3600 * 1000)) {
        await db.update(fastingSessions)
          .set({
            is_active: 0,
            actual_end_time: activeSession.target_end_time || new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .where(and(eq(fastingSessions.id, activeSession.id), eq(fastingSessions.user_id, userId)));
        activeSession = null as any;
      }
    }

    // 2. Geçmiş Seansları (History) Çek
    const pastConditions = memberCondition
      ? and(eq(fastingSessions.is_active, 0), eq(fastingSessions.user_id, userId), memberCondition)
      : and(eq(fastingSessions.is_active, 0), eq(fastingSessions.user_id, userId));

    const pastSessions = await db.select()
      .from(fastingSessions)
      .where(pastConditions)
      .orderBy(desc(fastingSessions.created_at))
      .limit(10);

    if (!activeSession) {
      return NextResponse.json({
        success: true,
        data: {
          isActive: false,
          protocol: '16:8',
          history: pastSessions
        }
      });
    }

    const startTime = new Date(activeSession.start_time).getTime();
    const targetTime = new Date(activeSession.target_end_time).getTime();

    const elapsedMs = Math.max(0, now - startTime);
    const totalDurationMs = Math.max(1000, targetTime - startTime);
    const remainingMs = Math.max(0, targetTime - now);

    const elapsedHours = Math.floor(elapsedMs / (1000 * 60 * 60));
    const elapsedMinutes = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));

    const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
    const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

    const progressPercent = Math.min(100, Math.round((elapsedMs / totalDurationMs) * 100));

    // Biyolojik Faz Tespiti
    let currentPhase = 'Kan Şekeri Düşüşü';
    let phaseColor = '#3B82F6';
    let phaseDescription = 'Vücut sindirimi tamamlıyor, insülin seviyeleri dengeleniyor.';

    if (elapsedHours >= 72) {
      currentPhase = '🛡️ 72 Saat: Bağışıklık Sistemi Yenilenmesi';
      phaseColor = '#EC4899';
      phaseDescription = 'Eski akyuvarlar (bağışıklık hücreleri) tamamen geridönüştürüldü, yeni kök hücre tabanlı bağışıklık sistemi oluşuyor.';
    } else if (elapsedHours >= 48) {
      currentPhase = '👑 48 Saat: Kök Hücre & Büyüme Hormonu Zirvesi';
      phaseColor = '#8B5CF6';
      phaseDescription = 'Büyüme hormonu (HGH) %500 arttı; hücresel yaşlanmaya karşı kök hücre aktivasyonu maksimum seviyede.';
    } else if (elapsedHours >= 36) {
      currentPhase = '🧬 36 Saat: Derin Otofaji & Derin Hücresel Temizlik';
      phaseColor = '#6366F1';
      phaseDescription = 'Hücre içi çöp, katlanmamış proteinler ve disfonksiyonel organeller %300 hızla temizleniyor.';
    } else if (elapsedHours >= 24) {
      currentPhase = '🔥 24 Saat: Tam Otofaji & Glikojen Sıfırlaması';
      phaseColor = '#F59E0B';
      phaseDescription = 'Karaciğer glikojen depoları tamamen boşaldı, otofajik süreç aktif olarak hasarlı proteinleri dönüştürüyor.';
    } else if (elapsedHours >= 18) {
      currentPhase = '🧬 Otofaji Başlangıcı';
      phaseColor = '#8B5CF6';
      phaseDescription = 'Eski ve hasarlı hücreler temizleniyor, hücresel gençleşme devrede.';
    } else if (elapsedHours >= 12) {
      currentPhase = '🔥 Ketozis & Yüksek Yağ Yakımı';
      phaseColor = '#F59E0B';
      phaseDescription = 'Glikojen depoları tükendi; vücut birincil enerji olarak yağ yakıyor.';
    } else if (elapsedHours >= 4) {
      currentPhase = '⚡ Yağ Yakımına Geçiş';
      phaseColor = '#10B981';
      phaseDescription = 'İnsülin düştü, yağ asitleri serbest bırakılıyor.';
    }

    return NextResponse.json({
      success: true,
      data: {
        isActive: true,
        protocol: activeSession.protocol,
        startTime: activeSession.start_time,
        targetEndTime: activeSession.target_end_time,
        elapsedText: `${elapsedHours} sa ${elapsedMinutes} dk`,
        remainingText: remainingMs > 0 ? `${remainingHours} sa ${remainingMinutes} dk` : 'Hedefe Ulaşıldı! 🏆',
        progressPercent,
        currentPhase,
        phaseColor,
        phaseDescription,
        history: pastSessions
      }
    });
  } catch (error: any) {
    console.error('Fasting API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }
    const body = await req.json();
    const { action, protocol = '16:8', member_id } = body;
    const urlMemberId = new URL(req.url).searchParams.get('member_id');

    const now = new Date();
    const nowISO = now.toISOString();
    const familyId = user.family_id || `fam-${user.id}`;
    const scope = await resolveOptionalHealthMemberScope(user.id, familyId, member_id ?? urlMemberId);
    if (!scope.authorized) {
      return NextResponse.json({ success: false, error: 'Seçilen aile üyesine erişim yetkiniz yok.' }, { status: 403 });
    }

    const memberCondition = buildHealthMemberFilter(fastingSessions.member_id, scope);
    const activeCloseWhere = memberCondition
      ? and(eq(fastingSessions.is_active, 1), eq(fastingSessions.user_id, user.id), memberCondition)
      : and(eq(fastingSessions.is_active, 1), eq(fastingSessions.user_id, user.id));

    if (action === 'start') {
      // Önceki tüm aktif seansları yalnızca ilgili üye/kapsam için kapat
      await db.update(fastingSessions)
        .set({ is_active: 0, actual_end_time: nowISO, updated_at: nowISO })
        .where(activeCloseWhere);

      let hours = 16;
      if (protocol === '12:12') hours = 12;
      else if (protocol === '14:10') hours = 14;
      else if (protocol === '16:8') hours = 16;
      else if (protocol === '18:6') hours = 18;
      else if (protocol === '20:4') hours = 20;
      else if (protocol === 'OMAD' || protocol === '23:1') hours = 23;
      else if (protocol === '24h' || protocol === '24 Saat Otofaji') hours = 24;
      else if (protocol === '36h' || protocol === '36 Saat Derin Otofaji') hours = 36;
      else if (protocol === '48h' || protocol === '48 Saat Kök Hücre') hours = 48;
      else if (protocol === '72h' || protocol === '72 Saat Bağışıklık Sıfırlama') hours = 72;
      else if (typeof protocol === 'number') hours = protocol;

      hours = Number.isFinite(Number(hours)) ? Math.max(1, Math.min(168, Number(hours))) : 16;

      const targetDate = new Date(now.getTime() + (hours * 60 * 60 * 1000));

      await db.insert(fastingSessions).values({
        id: `fast-${Date.now()}`,
        member_id: scope.memberId,
        protocol: typeof protocol === 'string' ? protocol : `${hours}h`,
        start_time: nowISO,
        target_end_time: targetDate.toISOString(),
        is_active: 1,
        created_at: nowISO,
        updated_at: nowISO,
        user_id: user.id,
        family_id: familyId
      });

      return NextResponse.json({ success: true, message: `${protocol} Oruç seansı başlatıldı! ⏳` });
    } else if (action === 'end') {
      await db.update(fastingSessions)
        .set({ is_active: 0, actual_end_time: nowISO, updated_at: nowISO })
        .where(activeCloseWhere);

      return NextResponse.json({ success: true, message: 'Oruç seansı tamamlandı ve günlüğe kaydedildi. 🥗' });
    } else if (action === 'cancel') {
      await db.update(fastingSessions)
        .set({ is_active: 0, actual_end_time: null, notes: 'cancelled', updated_at: nowISO })
        .where(activeCloseWhere);

      return NextResponse.json({ success: true, message: 'Oruç seansı iptal edildi.' });
    }

    return NextResponse.json({ success: false, error: 'Geçersiz işlem.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
