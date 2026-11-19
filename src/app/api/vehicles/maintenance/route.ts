import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { vehicleMaintenanceRecords, vehicles } from '@/db/schema';
import { desc, eq, or, and, inArray } from 'drizzle-orm';
import { eventBus, EVENTS } from '@/lib/events';
import { getAuthUser } from '@/lib/auth';
import { getTodayTurkeyDate, parseTurkeyCalendarDate } from '@/lib/date-utils';

export async function GET(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url, 'http://localhost');
    const requestedVehicleId = searchParams.get('vehicle_id');

    const familyId = user.family_id || `fam-${user.id}`;
    const userVehicles = await db.select({ id: vehicles.id }).from(vehicles).where(
      and(
        eq(vehicles.is_active, 1),
        familyId
          ? or(
              eq(vehicles.user_id, user.id),
              and(eq(vehicles.family_id, familyId), eq(vehicles.is_family_shared, 1))
            )
          : eq(vehicles.user_id, user.id)
      )
    );
    const vehicleIds = userVehicles.map(v => v.id);

    if (requestedVehicleId && !vehicleIds.includes(requestedVehicleId)) {
      return NextResponse.json(
        { success: false, error: 'Araç bulunamadı veya bu işlem için yetkiniz yok.' },
        { status: 403 }
      );
    }

    if (vehicleIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const targetIds = requestedVehicleId ? [requestedVehicleId] : vehicleIds;
    const records = await db.select()
      .from(vehicleMaintenanceRecords)
      .where(inArray(vehicleMaintenanceRecords.vehicle_id, targetIds))
      .orderBy(desc(vehicleMaintenanceRecords.km_at_service), desc(vehicleMaintenanceRecords.service_date));

    return NextResponse.json({ success: true, data: records });
  } catch (error: any) {
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

    const {
      vehicle_id,
      km_at_service,
      service_date,
      description,
      cost = 0,
      service_provider = 'Özel Servis',
      type = 'periyodik_bakim'
    } = body;

    if (!vehicle_id) {
      return NextResponse.json({ success: false, error: 'Araç ID belirtilmedi.' }, { status: 400 });
    }

    const km = Number(km_at_service);
    const numericCost = cost !== undefined && cost !== '' ? Number(cost) : 0;
    if (!Number.isFinite(km) || km < 0 || !Number.isFinite(numericCost) || numericCost < 0) {
      return NextResponse.json({ success: false, error: 'Geçerli bir servis kilometresi ve maliyet girin.' }, { status: 400 });
    }

    const familyId = user.family_id || `fam-${user.id}`;
    const veh = (await db.select().from(vehicles).where(
      and(
        eq(vehicles.id, vehicle_id),
        familyId
          ? or(
              eq(vehicles.user_id, user.id),
              and(eq(vehicles.family_id, familyId), eq(vehicles.is_family_shared, 1))
            )
          : eq(vehicles.user_id, user.id)
      )
    ).limit(1))[0];

    if (!veh) {
      return NextResponse.json({ success: false, error: 'Araç bulunamadı veya bu işlem için yetkiniz yok.' }, { status: 403 });
    }

    const nextServiceKm = km + 15000; // 15.000 KM kuralı
    
    // 1 Yıl sonraki servis tarihi
    const today = getTodayTurkeyDate();
    const effectiveServiceDate = service_date || today;
    const nextDate = parseTurkeyCalendarDate(effectiveServiceDate);
    nextDate.setFullYear(nextDate.getFullYear() + 1);
    const nextServiceDate = getTodayTurkeyDate(nextDate);

    const now = new Date().toISOString();
    const recordId = `maint-${Date.now()}`;

    // Servis kaydı ekle
    await db.insert(vehicleMaintenanceRecords).values({
      id: recordId,
      vehicle_id,
      type,
      km_at_service: km,
      service_date: effectiveServiceDate,
      next_service_km: nextServiceKm,
      next_service_date: nextServiceDate,
      description: description || 'Periyodik Bakım',
      cost: numericCost,
      service_provider,
      is_family_shared: veh.is_family_shared ?? 1,
      created_at: now,
      updated_at: now,
      sync_status: 'synced',
      device_id: 'mac-local'
    });

    // Aracın güncel KM'sini de güncelle (servis KM'sinden küçükse)
    if (veh.current_km < km) {
      await db.update(vehicles).set({ current_km: km, updated_at: now }).where(eq(vehicles.id, vehicle_id));
    }

    // Event Bus yayımı
    await eventBus.emit(EVENTS.VEHICLE_MAINTENANCE_RECORDED, {
      recordId,
      vehicle_id,
      km,
      cost: numericCost,
      description,
      userId: user.id,
      familyId
    });

    return NextResponse.json({
      success: true,
      message: `Bakım defterine kaydedildi. Gelecek bakım: ${nextServiceKm.toLocaleString('tr-TR')} KM olarak kuruldu.`
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
