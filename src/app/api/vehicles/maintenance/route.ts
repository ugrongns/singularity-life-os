import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { vehicleMaintenanceRecords, vehicles } from '@/db/schema';
import { desc, eq , or } from 'drizzle-orm';
import { eventBus, EVENTS } from '@/lib/events';

export async function GET(req: Request) {
  try {
    initDatabase();
    const records = await db.select()
      .from(vehicleMaintenanceRecords)
      .orderBy(desc(vehicleMaintenanceRecords.km_at_service), desc(vehicleMaintenanceRecords.service_date));

    return NextResponse.json({ success: true, data: records });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    initDatabase();
    const body = await req.json();

    const {
      vehicle_id = 'veh-1',
      km_at_service,
      service_date,
      description,
      cost = 0,
      service_provider = 'Özel Servis',
      type = 'periyodik_bakim'
    } = body;

    const km = parseFloat(km_at_service);
    const nextServiceKm = km + 15000; // 15.000 KM kuralı
    
    // 1 Yıl sonraki servis tarihi
    const nextDate = new Date(service_date || Date.now());
    nextDate.setFullYear(nextDate.getFullYear() + 1);
    const nextServiceDate = nextDate.toISOString().split('T')[0];

    const now = new Date().toISOString();
    const recordId = `maint-${Date.now()}`;

    // Servis kaydı ekle
    await db.insert(vehicleMaintenanceRecords).values({
      id: recordId,
      vehicle_id,
      type,
      km_at_service: km,
      service_date: service_date || now.split('T')[0],
      next_service_km: nextServiceKm,
      next_service_date: nextServiceDate,
      description: description || 'Periyodik Bakım',
      cost: parseFloat(cost) || 0,
      service_provider,
      is_family_shared: 1,
      created_at: now,
      updated_at: now,
      sync_status: 'synced',
      device_id: 'mac-local'
    });

    // Aracın güncel KM'sini de güncelle (servis KM'sinden küçükse)
    const veh = (await db.select().from(vehicles).where(eq(vehicles.id, vehicle_id)))[0];
    if (veh && veh.current_km < km) {
      await db.update(vehicles).set({ current_km: km, updated_at: now }).where(eq(vehicles.id, vehicle_id));
    }

    // Event Bus yayımı
    await eventBus.emit(EVENTS.VEHICLE_MAINTENANCE_RECORDED, {
      recordId,
      vehicle_id,
      km,
      cost,
      description
    });

    return NextResponse.json({
      success: true,
      message: `Bakım defterine kaydedildi. Gelecek bakım: ${nextServiceKm.toLocaleString('tr-TR')} KM olarak kuruldu.`
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
