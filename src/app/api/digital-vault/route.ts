import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { digitalVaultItems, importantDates, petRecords } from '@/db/schema';
import { desc, eq , or , and } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  try {
    await initDatabase();
    const user = await getAuthUser();
    const userId = user?.id;

    const today = new Date();
    const familyId = user?.family_id || (userId ? `fam-${userId}` : null);
    const vaultItems = userId
      ? await db.select().from(digitalVaultItems).where(
          familyId
            ? and(eq(digitalVaultItems.family_id, familyId), or(eq(digitalVaultItems.user_id, userId), eq(digitalVaultItems.is_family_shared, 1)))
            : eq(digitalVaultItems.user_id, userId)
        ).orderBy(desc(digitalVaultItems.created_at))
      : [];
    const dates = userId ? await db.select().from(importantDates).where(familyId ? eq(importantDates.family_id, familyId) : eq(importantDates.user_id, userId)) : [];
    const pets = userId ? await db.select().from(petRecords).where(familyId ? eq(petRecords.family_id, familyId) : eq(petRecords.user_id, userId)) : [];

    // Yaklaşan bitiş uyarıları ve Vize (6 ay) uyarısı hesapla
    const vaultWithAlerts = (vaultItems).map((item: any) => {
      let daysLeft: number | null = null;
      let alertLevel: 'ok' | 'warning' | 'critical' = 'ok';
      let visaWarning = false;

      if (item.expiry_date) {
        const expDate = new Date(item.expiry_date);
        daysLeft = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const threshold = item.remind_days_before || 30;
        
        if (daysLeft <= 0) {
          alertLevel = 'critical';
        } else if (daysLeft <= threshold) {
          alertLevel = 'warning';
        }

        // Pasaport için 6 Ay (180 gün) Vize Uyarısı
        if (item.type === 'passport' && daysLeft <= 180 && daysLeft > 0) {
          visaWarning = true;
        }
      }

      return {
        ...item,
        days_left: daysLeft,
        alert_level: alertLevel,
        visa_warning: visaWarning
      };
    });

    // Önemli günler — bu yıl veya gelecek yıl için gün farkı
    const datesWithCountdown = (dates).map((d: any) => {
      const parts = d.event_date.split('-');
      const mm = parseInt(parts[0] || '1', 10);
      const dd = parseInt(parts[1] || '1', 10);
      
      const thisYear = new Date(today.getFullYear(), mm - 1, dd);
      let eventDate = thisYear;
      if (thisYear < today) {
        eventDate = new Date(today.getFullYear() + 1, mm - 1, dd);
      }
      const daysLeft = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return { ...d, days_left: daysLeft, next_date: eventDate.toISOString().split('T')[0] };
    }).sort((a, b) => a.days_left - b.days_left);

    return NextResponse.json({
      success: true,
      data: {
        vaultItems: vaultWithAlerts,
        importantDates: datesWithCountdown,
        pets
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 });
    }

    const body = await request.json();
    const { section, ...data } = body;
    const now = new Date().toISOString();
    const id = data.id || `${section}-${Date.now()}`;

    const familyId = user.family_id || `fam-${user.id}`;

    if (section === 'vault') {
      await db.insert(digitalVaultItems).values({
        id,
        title: data.title,
        type: data.type || 'other',
        owner: data.owner || user.full_name || 'Kullanıcı',
        issuer: data.issuer || null,
        issue_date: data.issue_date || null,
        expiry_date: data.expiry_date || null,
        remind_days_before: parseInt(data.remind_days_before) || 30,
        document_number: data.document_number || null,
        document_image_url: data.document_image_url || null,
        notes: data.notes || null,
        is_family_shared: data.is_family_shared !== undefined ? Number(data.is_family_shared) : 0,
        user_id: user.id,
        family_id: familyId,
        created_at: now,
        updated_at: now
      });
    } else if (section === 'date') {
      await db.insert(importantDates).values({
        id,
        title: data.title,
        person_name: data.person_name,
        event_type: data.event_type || 'birthday',
        event_date: data.event_date,
        remind_days_before: parseInt(data.remind_days_before) || 7,
        gift_ideas: data.gift_ideas || null,
        notes: data.notes || null,
        user_id: user.id,
        family_id: familyId,
        created_at: now,
        updated_at: now
      });
    } else if (section === 'pet') {
      await db.insert(petRecords).values({
        id,
        name: data.name,
        species: data.species || 'Kedi',
        breed: data.breed || null,
        birth_date: data.birth_date || null,
        chip_no: data.chip_no || null,
        vaccinations: data.vaccinations || null,
        vet_name: data.vet_name || null,
        vet_phone: data.vet_phone || null,
        vet_next_date: data.vet_next_date || null,
        notes: data.notes || null,
        user_id: user.id,
        family_id: familyId,
        created_at: now,
        updated_at: now
      });
    }

    return NextResponse.json({ success: true, id, message: 'Kayıt eklendi!' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 });
    }

    const body = await request.json();
    const { section, id, ...data } = body;
    const now = new Date().toISOString();
    const familyId = user.family_id || `fam-${user.id}`;

    if (!id) return NextResponse.json({ success: false, error: 'ID gerekli' }, { status: 400 });

    if (section === 'vault') {
      await db.update(digitalVaultItems).set({
        title: data.title,
        type: data.type,
        owner: data.owner,
        issuer: data.issuer,
        issue_date: data.issue_date,
        expiry_date: data.expiry_date,
        remind_days_before: parseInt(data.remind_days_before) || 30,
        document_number: data.document_number,
        document_image_url: data.document_image_url,
        notes: data.notes,
        is_family_shared: data.is_family_shared !== undefined ? Number(data.is_family_shared) : undefined,
        updated_at: now
      }).where(
        and(
          eq(digitalVaultItems.id, id),
          user.is_master_account === 1
            ? eq(digitalVaultItems.family_id, familyId)
            : or(eq(digitalVaultItems.user_id, user.id), and(eq(digitalVaultItems.family_id, familyId), eq(digitalVaultItems.is_family_shared, 1)))
        )
      );
    } else if (section === 'date') {
      await db.update(importantDates).set({
        title: data.title,
        person_name: data.person_name,
        event_type: data.event_type,
        event_date: data.event_date,
        remind_days_before: parseInt(data.remind_days_before) || 7,
        gift_ideas: data.gift_ideas,
        notes: data.notes,
        updated_at: now
      }).where(
        and(
          eq(importantDates.id, id),
          user.is_master_account === 1 ? eq(importantDates.family_id, familyId) : eq(importantDates.user_id, user.id)
        )
      );
    } else if (section === 'pet') {
      await db.update(petRecords).set({
        name: data.name,
        species: data.species,
        breed: data.breed,
        birth_date: data.birth_date,
        chip_no: data.chip_no,
        vaccinations: data.vaccinations,
        vet_name: data.vet_name,
        vet_phone: data.vet_phone,
        vet_next_date: data.vet_next_date,
        notes: data.notes,
        updated_at: now
      }).where(
        and(
          eq(petRecords.id, id),
          user.is_master_account === 1 ? eq(petRecords.family_id, familyId) : eq(petRecords.user_id, user.id)
        )
      );
    }

    return NextResponse.json({ success: true, message: 'Güncellendi!' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const section = searchParams.get('section');
    if (!id) return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
    const familyId = user.family_id || `fam-${user.id}`;

    if (section === 'vault') {
      await db.delete(digitalVaultItems).where(
        and(
          eq(digitalVaultItems.id, id),
          user.is_master_account === 1 ? eq(digitalVaultItems.family_id, familyId) : eq(digitalVaultItems.user_id, user.id)
        )
      );
    } else if (section === 'date') {
      await db.delete(importantDates).where(
        and(
          eq(importantDates.id, id),
          user.is_master_account === 1 ? eq(importantDates.family_id, familyId) : eq(importantDates.user_id, user.id)
        )
      );
    } else if (section === 'pet') {
      await db.delete(petRecords).where(
        and(
          eq(petRecords.id, id),
          user.is_master_account === 1 ? eq(petRecords.family_id, familyId) : eq(petRecords.user_id, user.id)
        )
      );
    }

    return NextResponse.json({ success: true, message: 'Silindi!' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
