import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { vehicles, vehicleMaintenanceRecords, vehicleFuelLogs, vehicleLegalReminders, walletsAccounts, transactions } from '@/db/schema';
import { desc, eq, lte, and , or } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  try {
    initDatabase();
    const user = await getAuthUser();
    const userId = user?.id;

    const allVehicles = userId
      ? await db.select().from(vehicles).where(and(eq(vehicles.is_active, 1), or(eq(vehicles.user_id, userId), eq(vehicles.is_family_shared, 1))))
      : [];
    const wallets = await db.select().from(walletsAccounts).where(eq(walletsAccounts.is_active, 1));

    if (allVehicles.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          vehicle: null,
          vehicles: [],
          maintenance: null,
          recentFuels: [],
          legalReminders: [],
          consumption: { avgLitersPer100Km: 0, avgCostPerKm: 0 }
        }
      });
    }

    const activeVehicles = allVehicles;
    const primaryVehicle = activeVehicles[0];
    const currentKm = primaryVehicle.current_km;

    // Güncel KM'den küçük veya eşit en son tamamlanan periyodik bakım
    const lastCompletedService = await db.select()
      .from(vehicleMaintenanceRecords)
      .where(
        and(
          eq(vehicleMaintenanceRecords.vehicle_id, primaryVehicle.id),
          lte(vehicleMaintenanceRecords.km_at_service, currentKm)
        )
      )
      .orderBy(desc(vehicleMaintenanceRecords.km_at_service))
      .limit(1).then((r: any) => r[0]);

    // Bakım Döngüsü Başlangıç ve Bitiş KM Hesabı (15.000 KM Kuralı)
    let cycleStartKm = lastCompletedService ? lastCompletedService.km_at_service : Math.floor(currentKm / 15000) * 15000;
    let nextServiceKm = lastCompletedService?.next_service_km || (cycleStartKm + 15000);

    if (nextServiceKm <= currentKm) {
      cycleStartKm = Math.floor(currentKm / 15000) * 15000;
      nextServiceKm = cycleStartKm + 15000;
    }

    const cycleTotalDistance = Math.max(1000, nextServiceKm - cycleStartKm);
    const drivenInCycle = Math.max(0, currentKm - cycleStartKm);
    const remainingKm = Math.max(0, nextServiceKm - currentKm);
    const kmProgressPercentage = Math.max(0, Math.min(100, Math.round((drivenInCycle / cycleTotalDistance) * 100)));

    // Yakıt Kayıtları
    const recentFuels = await db.select()
      .from(vehicleFuelLogs)
      .where(eq(vehicleFuelLogs.vehicle_id, primaryVehicle.id))
      .orderBy(desc(vehicleFuelLogs.fuel_date))
      .limit(10);

    // Servis Kayıtları
    const maintenanceHistory = await db.select()
      .from(vehicleMaintenanceRecords)
      .where(eq(vehicleMaintenanceRecords.vehicle_id, primaryVehicle.id))
      .orderBy(desc(vehicleMaintenanceRecords.service_date));

    // Yasal Hatırlatıcılar
    let legalReminders = await db.select()
      .from(vehicleLegalReminders)
      .where(eq(vehicleLegalReminders.vehicle_id, primaryVehicle.id));

    // Eğer henüz yasal hatırlatıcı tanımlanmamışsa TÜVTÜRK & MTV takvimini otomatik üret ve kaydet
    if (legalReminders.length === 0) {
      try {
        const { generateAutoLegalReminders } = await import('@/lib/vehicle-legal');
        const autoReminders = generateAutoLegalReminders(primaryVehicle.id, primaryVehicle.year || 2022);
        for (const rem of autoReminders) {
          await db.insert(vehicleLegalReminders).values({
            id: rem.id,
            vehicle_id: rem.vehicle_id,
            type: rem.type,
            due_date: rem.due_date,
            policy_no: rem.policy_no,
            cost_estimate: rem.cost_estimate,
            is_completed: rem.is_completed,
            created_at: rem.created_at,
            updated_at: rem.updated_at
          });
        }
        legalReminders = await db.select()
          .from(vehicleLegalReminders)
          .where(eq(vehicleLegalReminders.vehicle_id, primaryVehicle.id));
      } catch (autoErr) {
        console.warn('Auto legal reminder generation notice:', autoErr);
      }
    }

    // Yakıt Tüketimi Hesabı (Ardışık mantıklı KM aralıklarının ortalaması)
    let avgConsumptionLiters = 0;
    let avgCostPerKm = 0;

    if (recentFuels.length >= 2) {
      const sortedFuels = [...recentFuels].sort((a, b) => a.km - b.km);
      let totalValidKm = 0;
      let totalValidLiters = 0;
      let totalValidCost = 0;

      for (let i = 1; i < sortedFuels.length; i++) {
        const prev = sortedFuels[i - 1];
        const curr = sortedFuels[i];
        const dist = curr.km - prev.km;

        // Mantıklı depo aralığı (50 KM ile 1.500 KM arası ardışık dolumlar)
        if (dist >= 50 && dist <= 1500) {
          totalValidKm += dist;
          totalValidLiters += curr.liters;
          totalValidCost += curr.total_amount;
        }
      }

      if (totalValidKm > 0) {
        avgConsumptionLiters = Math.round((totalValidLiters / totalValidKm) * 100 * 10) / 10;
        avgCostPerKm = Math.round((totalValidCost / totalValidKm) * 100) / 100;
      }
    }

    // Geçerli ardışık kayıt yoksa varsayılan değer
    if (avgConsumptionLiters <= 0) {
      avgConsumptionLiters = 6.2;
      avgCostPerKm = 2.76;
    }

    return NextResponse.json({
      success: true,
      data: {
        vehicles: activeVehicles,
        vehicle: primaryVehicle,
        wallets,
        maintenance: {
          lastService: lastCompletedService,
          cycleStartKm,
          nextServiceKm,
          remainingKm,
          kmProgressPercentage,
          nextServiceDate: lastCompletedService?.next_service_date || '2027-03-15'
        },
        recentFuels,
        maintenanceHistory,
        legalReminders,
        consumption: {
          avgLitersPer100Km: avgConsumptionLiters,
          avgCostPerKm: avgCostPerKm
        }
      }
    });
  } catch (error: any) {
    console.error('Vehicles API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    const body = await req.json();
    const { action, ...data } = body;
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    // Yeni Araç Ekleme
    if (action === 'add_vehicle') {
      const vehicleId = `veh-${Date.now()}`;
      await db.insert(vehicles).values({
        id: vehicleId,
        plate: (data.plate || '').toUpperCase().replace(/\s/g, ''),
        make: data.make || 'Bilinmiyor',
        model: data.model || 'Bilinmiyor',
        year: parseInt(data.year) || new Date().getFullYear(),
        current_km: parseFloat(data.current_km) || 0,
        fuel_type: data.fuel_type || 'Benzin',
        color: data.color || '#3B82F6',
        is_family_shared: 1,
        is_active: 1,
        created_at: now,
        updated_at: now,
        sync_status: 'synced',
        device_id: 'web-client',
        user_id: user.id
      } as any);

      return NextResponse.json({
        success: true,
        message: `🚗 ${data.make} ${data.model} (${(data.plate || '').toUpperCase()}) garajınıza eklendi!`,
        vehicle_id: vehicleId
      });
    }

    // KM Güncelleme
    if (action === 'update_km' || (!action && data.vehicle_id && data.current_km)) {
      const vehicleId = data.vehicle_id;
      const newKm = parseFloat(data.current_km);

      await db.update(vehicles)
        .set({ current_km: newKm, updated_at: now })
        .where(eq(vehicles.id, vehicleId))
        ;

      return NextResponse.json({ success: true, message: `🚗 Araç kilometresi ${newKm.toLocaleString('tr-TR')} KM olarak güncellendi.` });
    }

    // Yakıt Alım Kaydı Ekleme
    if (action === 'add_fuel') {
      const fuelId = `fuel-${Date.now()}`;
      const vehicleId = data.vehicle_id;
      const km = parseFloat(data.km);
      const liters = parseFloat(data.liters);
      const pricePerLiter = parseFloat(data.price_per_liter);
      const totalAmount = parseFloat(data.total_amount) || (liters * pricePerLiter);
      const fuelStation = data.fuel_station || 'Opet';
      const walletId = data.wallet_id;

      await db.insert(vehicleFuelLogs).values({
        id: fuelId,
        vehicle_id: vehicleId,
        km,
        fuel_station: fuelStation,
        liters,
        price_per_liter: pricePerLiter,
        total_amount: totalAmount,
        fuel_date: data.fuel_date || today,
        created_at: now,
        updated_at: now
      });

      // Araç KM güncelle
      const veh = (await db.select().from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1))[0];
      if (veh && km > veh.current_km) {
        await db.update(vehicles).set({ current_km: km, updated_at: now }).where(eq(vehicles.id, vehicleId));
      }

      // Cüzdandan düş & harcama kaydet
      if (walletId) {
        const wallet = (await db.select().from(walletsAccounts).where(eq(walletsAccounts.id, walletId)).limit(1))[0];
        if (wallet) {
          await db.update(walletsAccounts).set({
            balance: (wallet.balance || 0) - totalAmount,
            updated_at: now
          }).where(eq(walletsAccounts.id, walletId));

          await db.insert(transactions).values({
            id: `tx-fuel-${Date.now()}`,
            wallet_id: walletId,
            merchant: `${fuelStation} - Yakıt Alımı`,
            amount: totalAmount,
            currency: 'TRY',
            transaction_date: data.fuel_date || today,
            notes: `Yakıt alımı: ${liters} Litre @ ${pricePerLiter} TL/L (${km} KM)`,
            is_verified: 1,
            created_at: now,
            updated_at: now
          });
        }
      }

      return NextResponse.json({ success: true, message: `⛽ ₺${totalAmount} tutarındaki yakıt alımı kaydedildi!` });
    }

    // Servis Bakım Kaydı Ekleme
    if (action === 'add_service') {
      const serviceId = `srv-${Date.now()}`;
      const vehicleId = data.vehicle_id;
      const km = parseFloat(data.km_at_service);
      const cost = parseFloat(data.cost) || 0;
      const nextKm = km + 15000;

      await db.insert(vehicleMaintenanceRecords).values({
        id: serviceId,
        vehicle_id: vehicleId,
        type: data.type || 'periyodik_bakim',
        km_at_service: km,
        service_date: data.service_date || today,
        next_service_km: nextKm,
        next_service_date: data.next_service_date || '2027-03-15',
        description: data.description || 'Periyodik Yağ & Filtre Değişimi',
        cost,
        service_provider: data.service_provider || 'Yetkili Servis',
        created_at: now,
        updated_at: now
      });

      // Araç KM güncelle
      const veh = (await db.select().from(vehicles).where(eq(vehicles.id, vehicleId)))[0];
      if (veh && km > veh.current_km) {
        await db.update(vehicles).set({ current_km: km, updated_at: now }).where(eq(vehicles.id, vehicleId));
      }

      // Cüzdandan düş
      if (data.wallet_id && cost > 0) {
        const wallet = (await db.select().from(walletsAccounts).where(eq(walletsAccounts.id, data.wallet_id)))[0];
        if (wallet) {
          await db.update(walletsAccounts).set({ balance: (wallet.balance || 0) - cost, updated_at: now }).where(eq(walletsAccounts.id, data.wallet_id));
          await db.insert(transactions).values({
            id: `tx-srv-${Date.now()}`,
            wallet_id: data.wallet_id,
            merchant: `${data.service_provider || 'Oto Servis'} Bakımı`,
            amount: cost,
            currency: 'TRY',
            transaction_date: data.service_date || today,
            notes: `Araç Servis Bakımı: ${data.description}`,
            is_verified: 1,
            created_at: now,
            updated_at: now
          });
        }
      }

      return NextResponse.json({ success: true, message: `🔧 Araç servis bakımı kaydedildi!` });
    }

    // Yasal Hatırlatıcı Ekleme/Güncelleme
    if (action === 'add_legal') {
      const id = `leg-${Date.now()}`;
      await db.insert(vehicleLegalReminders).values({
        id,
        vehicle_id: data.vehicle_id,
        type: data.type,
        due_date: data.due_date,
        policy_no: data.policy_no || '',
        cost_estimate: parseFloat(data.cost_estimate) || 0,
        is_completed: 0,
        created_at: now,
        updated_at: now
      });

      return NextResponse.json({ success: true, message: '🛡️ Yasal hatırlatıcı güncellendi.' });
    }

    // Yasal Hatırlatıcıları Otomatik Üret (TÜVTÜRK & MTV)
    if (action === 'auto_generate_legal' && data.vehicle_id) {
      const veh = (await db.select().from(vehicles).where(eq(vehicles.id, data.vehicle_id)))[0];
      if (!veh) return NextResponse.json({ success: false, error: 'Araç bulunamadı.' }, { status: 404 });

      const { generateAutoLegalReminders } = await import('@/lib/vehicle-legal');
      const generated = generateAutoLegalReminders(veh.id, veh.year || 2022);
      for (const rem of generated) {
        await db.insert(vehicleLegalReminders).values({
          id: rem.id,
          vehicle_id: rem.vehicle_id,
          type: rem.type,
          due_date: rem.due_date,
          policy_no: rem.policy_no,
          cost_estimate: rem.cost_estimate,
          is_completed: rem.is_completed,
          created_at: rem.created_at,
          updated_at: rem.updated_at
        });
      }

      return NextResponse.json({
        success: true,
        message: '🏛️ TÜVTÜRK Muayene ve MTV taksit takvimi aracınıza otomatik tanımlandı!',
        count: generated.length
      });
    }

    return NextResponse.json({ success: false, error: 'Bilinmeyen işlem' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
