import { NextResponse } from 'next/server';
import { db, initDatabase } from '@/db';
import { vehicles, vehicleMaintenanceRecords, vehicleFuelLogs, vehicleLegalReminders, walletsAccounts, transactions } from '@/db/schema';
import { desc, eq, and, or, sql } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { eventBus, EVENTS } from '@/lib/events';
import { getTodayTurkeyDate, diffTurkeyCalendarDays, parseTurkeyCalendarDate } from '@/lib/date-utils';
import { ensureFamilyCategories, getFamilySeedCategoryId } from '@/lib/budget-categories';
import { calculateVehicleMaintenanceCycle, calculateFuelConsumption, generateAutoLegalReminders, isPeriodicMaintenanceType } from '@/lib/vehicle-legal';

function getVisibleVehiclesWhere(userId: string, familyId?: string | null) {
  return and(
    eq(vehicles.is_active, 1),
    familyId
      ? or(
          eq(vehicles.user_id, userId),
          and(eq(vehicles.family_id, familyId), eq(vehicles.is_family_shared, 1))
        )
      : eq(vehicles.user_id, userId)
  );
}

function getAuthorizedVehicleWhere(vehicleId: string, userId: string, familyId?: string | null) {
  return and(
    eq(vehicles.id, vehicleId),
    familyId
      ? or(
          eq(vehicles.user_id, userId),
          and(eq(vehicles.family_id, familyId), eq(vehicles.is_family_shared, 1))
        )
      : eq(vehicles.user_id, userId)
  );
}

function getVisibleWalletsWhere(userId: string, familyId?: string | null) {
  return and(
    eq(walletsAccounts.is_active, 1),
    familyId
      ? or(
          eq(walletsAccounts.user_id, userId),
          and(eq(walletsAccounts.family_id, familyId), eq(walletsAccounts.is_family_shared, 1)),
          and(eq(walletsAccounts.family_id, familyId), sql`${walletsAccounts.user_id} IS NULL`)
        )
      : eq(walletsAccounts.user_id, userId)
  );
}

function isWalletAccessibleByUser(wallet: any, userId: string, familyId?: string | null): boolean {
  if (!wallet || wallet.is_active === 0) return false;
  if (wallet.user_id === userId) return true;
  const isSameFamily = wallet.family_id ? Boolean(familyId && wallet.family_id === familyId) : false;
  return isSameFamily && (wallet.is_family_shared === 1 || !wallet.user_id);
}

function validateWalletSpendLimit(wallet: any, amount: number): { ok: boolean; error?: string; newBalance: number } {
  const currentBalance = Number(wallet.balance) || 0;
  if (wallet.type === 'credit_card') {
    const creditLimit = Number(wallet.credit_limit) || 0;
    if (creditLimit > 0) {
      const avail = Math.max(0, creditLimit - currentBalance);
      if (amount > avail) {
        return {
          ok: false,
          error: `Kredi Kartı Limiti Aşıldı! ${wallet.name} kartınızın kullanılabilir limiti sadece ${avail.toLocaleString('tr-TR')} ₺'dir.`,
          newBalance: currentBalance,
        };
      }
    }
    return { ok: true, newBalance: currentBalance + amount };
  }

  if (wallet.type === 'kmh') {
    const overdraftLimit = Number(wallet.overdraft_limit) || 0;
    const avail = currentBalance + overdraftLimit;
    if (amount > avail) {
      return {
        ok: false,
        error: `KMH (Ek Hesap) Limiti Aşıldı! ${wallet.name} hesabınızın kullanılabilir toplam limiti ${avail.toLocaleString('tr-TR')} ₺'dir.`,
        newBalance: currentBalance,
      };
    }
    return { ok: true, newBalance: currentBalance - amount };
  }

  if (amount > currentBalance) {
    return {
      ok: false,
      error: `Yetersiz Bakiye! ${wallet.name} hesabınızda sadece ${currentBalance.toLocaleString('tr-TR')} ₺ bakiye bulunmaktadır.`,
      newBalance: currentBalance,
    };
  }
  return { ok: true, newBalance: currentBalance - amount };
}

export async function GET(req: Request) {
  try {
    await initDatabase();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    }
    const userId = user.id;

    const { searchParams } = new URL(req.url, 'http://localhost');
    const requestedVehicleId = searchParams.get('vehicle_id');
    const todayTr = getTodayTurkeyDate();

    const familyId = user.family_id || `fam-${userId}`;
    const allVehicles = await db.select().from(vehicles).where(getVisibleVehiclesWhere(userId, familyId));
    const wallets = await db.select().from(walletsAccounts).where(getVisibleWalletsWhere(userId, familyId));

    if (requestedVehicleId && !allVehicles.some(v => v.id === requestedVehicleId)) {
      return NextResponse.json(
        { success: false, error: 'Araç bulunamadı veya bu işlem için yetkiniz yok.' },
        { status: 403 }
      );
    }

    if (allVehicles.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          vehicle: null,
          vehicles: [],
          maintenance: null,
          recentFuels: [],
          legalReminders: [],
          wallets,
          consumption: { avgLitersPer100Km: 0, avgCostPerKm: 0 }
        }
      });
    }

    const activeVehicles = allVehicles;
    const primaryVehicle = (requestedVehicleId ? activeVehicles.find(v => v.id === requestedVehicleId) : null) || activeVehicles[0];
    const currentKm = Number(primaryVehicle.current_km) || 0;

    // Servis Kayıtları
    const maintenanceHistory = await db.select()
      .from(vehicleMaintenanceRecords)
      .where(eq(vehicleMaintenanceRecords.vehicle_id, primaryVehicle.id))
      .orderBy(desc(vehicleMaintenanceRecords.service_date), desc(vehicleMaintenanceRecords.km_at_service));

    // Periyodik Bakım Döngüsü Hesabı (15.000 KM Kuralı — Gecikmiş bakımda döngüyü gizlice sıfırlamaz)
    const maintenanceSummary = calculateVehicleMaintenanceCycle(currentKm, maintenanceHistory);

    // Yakıt Kayıtları (Tüketim hassasiyeti için son 30 dolum üzerinden hesapla, UI için son 10 kaydı döndür)
    const allRecentFuels = await db.select()
      .from(vehicleFuelLogs)
      .where(eq(vehicleFuelLogs.vehicle_id, primaryVehicle.id))
      .orderBy(desc(vehicleFuelLogs.fuel_date), desc(vehicleFuelLogs.km))
      .limit(30);
    const recentFuels = allRecentFuels.slice(0, 10);

    // Yasal Hatırlatıcılar
    let legalReminders = await db.select()
      .from(vehicleLegalReminders)
      .where(eq(vehicleLegalReminders.vehicle_id, primaryVehicle.id));

    // Eğer henüz yasal hatırlatıcı tanımlanmamışsa takvimi bellek içinde hesapla (GET rotasında db.insert yan etkisini önle)
    if (legalReminders.length === 0) {
      try {
        legalReminders = generateAutoLegalReminders(primaryVehicle.id, primaryVehicle.year || 2022) as any;
      } catch (autoErr) {
        console.warn('Auto legal reminder generation notice:', autoErr);
      }
    }

    const enrichedLegalReminders = legalReminders.map((rem: any) => ({
      ...rem,
      days_left: diffTurkeyCalendarDays(rem.due_date, todayTr)
    }));

    // Parçalı dolum destekli yakıt tüketimi ve birim maliyet hesabı
    const { avgLitersPer100Km: avgConsumptionLiters, avgCostPerKm } = calculateFuelConsumption(allRecentFuels);

    return NextResponse.json({
      success: true,
      data: {
        vehicles: activeVehicles,
        vehicle: primaryVehicle,
        wallets,
        maintenance: maintenanceSummary,
        recentFuels,
        maintenanceHistory,
        legalReminders: enrichedLegalReminders,
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
    await initDatabase();
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 401 });
    const body = await req.json();
    const { action, ...data } = body;
    const now = new Date().toISOString();
    const today = getTodayTurkeyDate();
    const familyId = user.family_id || `fam-${user.id}`;

    // Yeni Araç Ekleme
    if (action === 'add_vehicle') {
      const parsedKm = data.current_km !== undefined && data.current_km !== '' ? Number(data.current_km) : 0;
      if (!Number.isFinite(parsedKm) || parsedKm < 0) {
        return NextResponse.json({ success: false, error: 'Geçerli bir kilometre değeri girin.' }, { status: 400 });
      }
      const vehicleId = `veh-${Date.now()}`;
      const isFamilyShared = data.is_family_shared === 0 ? 0 : 1;
      await db.insert(vehicles).values({
        id: vehicleId,
        plate: (data.plate || '').toUpperCase().replace(/\s/g, ''),
        make: data.make || 'Bilinmiyor',
        model: data.model || 'Bilinmiyor',
        year: parseInt(data.year, 10) || Number(today.slice(0, 4)),
        current_km: parsedKm,
        fuel_type: data.fuel_type || 'Benzin',
        color: data.color || '#3B82F6',
        is_family_shared: isFamilyShared,
        is_active: 1,
        created_at: now,
        updated_at: now,
        sync_status: 'synced',
        device_id: 'web-client',
        user_id: user.id,
        family_id: familyId
      } as any);

      // Otomatik veya özel yasal hatırlatıcıları (Muayene, MTV, Sigorta) oluştur
      try {
        const autoReminders = generateAutoLegalReminders(vehicleId, parseInt(data.year, 10) || Number(today.slice(0, 4)));
        const sigortaPolicyInput = data.sigorta_policy_no ?? data.sigorta_policy;
        const kaskoPolicyInput = data.kasko_policy_no ?? data.kasko_policy;

        for (const rem of autoReminders) {
          let dueDate = rem.due_date;
          let policyNo = rem.policy_no || '';
          if (rem.type === 'muayene' && data.muayene_date) dueDate = data.muayene_date;
          if (rem.type === 'sigorta' && data.sigorta_date) {
            dueDate = data.sigorta_date;
            if (sigortaPolicyInput) policyNo = String(sigortaPolicyInput).trim();
          }
          if (rem.type === 'kasko' && data.kasko_date) {
            dueDate = data.kasko_date;
            if (kaskoPolicyInput) policyNo = String(kaskoPolicyInput).trim();
          }

          await db.insert(vehicleLegalReminders).values({
            id: rem.id,
            vehicle_id: rem.vehicle_id,
            type: rem.type,
            due_date: dueDate,
            policy_no: policyNo,
            cost_estimate: rem.cost_estimate,
            is_completed: rem.is_completed,
            created_at: rem.created_at,
            updated_at: rem.updated_at
          });
        }
      } catch (e) {
        console.warn('Auto legal reminder error on add_vehicle:', e);
      }

      return NextResponse.json({
        success: true,
        message: `🚗 ${data.make} ${data.model} (${(data.plate || '').toUpperCase()}) garajınıza eklendi!`,
        vehicle_id: vehicleId
      });
    }

    // KM Güncelleme
    if (action === 'update_km' || (!action && data.vehicle_id && data.current_km !== undefined)) {
      const vehicleId = data.vehicle_id;
      const newKm = Number(data.current_km);
      if (!Number.isFinite(newKm) || newKm < 0) {
        return NextResponse.json({ success: false, error: 'Geçerli bir kilometre değeri girin.' }, { status: 400 });
      }

      // Güvenlik: Araç bu kullanıcıya veya paylaşımlı ailesine mi ait? (IDOR Koruması)
      const targetVeh = (await db.select({ id: vehicles.id }).from(vehicles).where(
        getAuthorizedVehicleWhere(vehicleId, user.id, familyId)
      ).limit(1))[0];

      if (!targetVeh) {
        return NextResponse.json({ success: false, error: 'Araç bulunamadı veya bu işlem için yetkiniz yok.' }, { status: 403 });
      }

      await db.update(vehicles)
        .set({ current_km: newKm, updated_at: now })
        .where(eq(vehicles.id, vehicleId));

      return NextResponse.json({ success: true, message: `🚗 Araç kilometresi ${newKm.toLocaleString('tr-TR')} KM olarak güncellendi.` });
    }

    // Yakıt Alım Kaydı Ekleme
    if (action === 'add_fuel') {
      const fuelId = `fuel-${Date.now()}`;
      const vehicleId = data.vehicle_id;
      const km = Number(data.km);
      const liters = Number(data.liters);
      const pricePerLiter = Number(data.price_per_liter);
      const rawTotal = data.total_amount !== undefined && data.total_amount !== '' ? Number(data.total_amount) : Math.round(liters * pricePerLiter * 100) / 100;
      const totalAmount = Number.isFinite(rawTotal) && rawTotal > 0 ? rawTotal : Math.round(liters * pricePerLiter * 100) / 100;
      const fuelStation = data.fuel_station || 'Akaryakıt İstasyonu';
      const walletId = data.wallet_id;
      const fuelDate = data.fuel_date || today;

      if (!Number.isFinite(km) || km < 0 || !Number.isFinite(liters) || liters <= 0 || !Number.isFinite(pricePerLiter) || pricePerLiter <= 0 || !Number.isFinite(totalAmount) || totalAmount <= 0) {
        return NextResponse.json({ success: false, error: 'Lütfen geçerli KM, litre ve birim fiyat bilgisi girin.' }, { status: 400 });
      }

      // Güvenlik: Araç bu kullanıcıya veya paylaşımlı ailesine mi ait?
      const veh = (await db.select().from(vehicles).where(
        getAuthorizedVehicleWhere(vehicleId, user.id, familyId)
      ).limit(1))[0];
      if (!veh) {
        return NextResponse.json({ success: false, error: 'Araç bulunamadı veya bu işlem için yetkiniz yok.' }, { status: 403 });
      }

      const isFullTank = data.is_full_tank === 0 || data.is_full_tank === false ? 0 : 1;

      // Cüzdan seçilmişse kayıttan önce cüzdan sahipliğini (özel cüzdan BOLA dahil) ve limit/bakiyeyi doğrula
      let authorizedWallet: any = null;
      if (walletId) {
        const walletCandidate = (await db.select().from(walletsAccounts).where(
          and(
            eq(walletsAccounts.id, walletId),
            getVisibleWalletsWhere(user.id, familyId)
          )
        ).limit(1))[0];

        if (!isWalletAccessibleByUser(walletCandidate, user.id, familyId)) {
          return NextResponse.json({ success: false, error: 'Seçilen cüzdan bulunamadı veya bu işlem için yetkiniz yok.' }, { status: 403 });
        }

        const limitCheck = validateWalletSpendLimit(walletCandidate, totalAmount);
        if (!limitCheck.ok) {
          return NextResponse.json({ success: false, error: limitCheck.error }, { status: 400 });
        }
        authorizedWallet = walletCandidate;
      }

      let createdTxId: string | null = null;
      let resolvedCategoryId: string | null = null;

      await db.transaction(async (tx) => {
        await tx.insert(vehicleFuelLogs).values({
          id: fuelId,
          vehicle_id: vehicleId,
          km,
          fuel_station: fuelStation,
          liters,
          price_per_liter: pricePerLiter,
          total_amount: totalAmount,
          fuel_date: fuelDate,
          is_full_tank: isFullTank,
          created_at: now,
          updated_at: now
        });

        // Araç KM güncelle
        if (km > veh.current_km) {
          await tx.update(vehicles).set({ current_km: km, updated_at: now }).where(eq(vehicles.id, vehicleId));
        }

        // Cüzdandan atomik düş & Ulaşım/Yakıt bütçe kategorisine harcama kaydet
        if (authorizedWallet) {
          resolvedCategoryId = getFamilySeedCategoryId('cat-ulasim', familyId);
          await ensureFamilyCategories(familyId, tx);

          const isCreditCard = authorizedWallet.type === 'credit_card';
          await tx.update(walletsAccounts).set({
            balance: isCreditCard
              ? sql`${walletsAccounts.balance} + ${totalAmount}`
              : sql`${walletsAccounts.balance} - ${totalAmount}`,
            updated_at: now
          }).where(eq(walletsAccounts.id, walletId));

          createdTxId = `tx-fuel-${Date.now()}`;
          await tx.insert(transactions).values({
            id: createdTxId,
            wallet_id: walletId,
            category_id: resolvedCategoryId,
            user_id: user.id,
            family_id: familyId,
            merchant: `${fuelStation} - Yakıt Alımı`,
            amount: totalAmount,
            currency: authorizedWallet.currency || 'TRY',
            transaction_date: fuelDate,
            notes: `Yakıt alımı: ${liters} Litre @ ${pricePerLiter} TL/L (${km} KM)${isFullTank === 0 ? ' [Parçalı Dolum]' : ''}`,
            is_verified: 1,
            is_family_shared: veh.is_family_shared ?? 1,
            created_at: now,
            updated_at: now,
            sync_status: 'synced',
            device_id: 'web-client'
          });
        }
      });

      await eventBus.emit(EVENTS.FUEL_RECEIPT_RECORDED, {
        fuelId,
        vehicle_id: vehicleId,
        km,
        liters,
        price_per_liter: pricePerLiter,
        total_amount: totalAmount,
        fuel_station: fuelStation,
        fuel_date: fuelDate,
        userId: user.id,
        familyId
      });

      if (createdTxId && resolvedCategoryId) {
        await eventBus.emit(EVENTS.TRANSACTION_CREATED, {
          transactionId: createdTxId,
          wallet_id: walletId,
          category_id: resolvedCategoryId,
          amount: totalAmount,
          merchant: `${fuelStation} - Yakıt Alımı`,
          user_id: user.id,
          userId: user.id,
          family_id: familyId,
          familyId
        });
      }

      return NextResponse.json({ success: true, message: `⛽ ₺${totalAmount.toLocaleString('tr-TR')} tutarındaki yakıt alımı kaydedildi!` });
    }

    // Servis Bakım Kaydı Ekleme
    if (action === 'add_service') {
      const serviceId = `srv-${Date.now()}`;
      const vehicleId = data.vehicle_id;
      const km = Number(data.km_at_service);
      const cost = data.cost !== undefined && data.cost !== '' ? Number(data.cost) : 0;
      const serviceType = data.type || 'periyodik_bakim';
      const serviceDate = data.service_date || today;
      const serviceProvider = data.service_provider || 'Yetkili Servis';
      const serviceDescription = data.description || 'Periyodik Yağ & Filtre Değişimi';

      if (!Number.isFinite(km) || km < 0 || !Number.isFinite(cost) || cost < 0) {
        return NextResponse.json({ success: false, error: 'Lütfen geçerli servis kilometresi ve tutar girin.' }, { status: 400 });
      }

      const nextKm = km + 15000;
      let nextServiceDate = data.next_service_date || null;
      if (!nextServiceDate && isPeriodicMaintenanceType(serviceType)) {
        const baseServiceDate = parseTurkeyCalendarDate(serviceDate);
        baseServiceDate.setFullYear(baseServiceDate.getFullYear() + 1);
        nextServiceDate = getTodayTurkeyDate(baseServiceDate);
      }

      // Güvenlik: Araç bu kullanıcıya veya paylaşımlı ailesine mi ait?
      const veh = (await db.select().from(vehicles).where(
        getAuthorizedVehicleWhere(vehicleId, user.id, familyId)
      ).limit(1))[0];
      if (!veh) {
        return NextResponse.json({ success: false, error: 'Araç bulunamadı veya bu işlem için yetkiniz yok.' }, { status: 403 });
      }

      // Cüzdan seçilmişse kayıttan önce cüzdan sahipliğini (özel cüzdan BOLA dahil) ve limit/bakiyeyi doğrula
      let authorizedWallet: any = null;
      if (data.wallet_id && cost > 0) {
        const walletCandidate = (await db.select().from(walletsAccounts).where(
          and(
            eq(walletsAccounts.id, data.wallet_id),
            getVisibleWalletsWhere(user.id, familyId)
          )
        ).limit(1))[0];

        if (!isWalletAccessibleByUser(walletCandidate, user.id, familyId)) {
          return NextResponse.json({ success: false, error: 'Seçilen cüzdan bulunamadı veya bu işlem için yetkiniz yok.' }, { status: 403 });
        }

        const limitCheck = validateWalletSpendLimit(walletCandidate, cost);
        if (!limitCheck.ok) {
          return NextResponse.json({ success: false, error: limitCheck.error }, { status: 400 });
        }
        authorizedWallet = walletCandidate;
      }

      let createdTxId: string | null = null;
      let resolvedCategoryId: string | null = null;

      await db.transaction(async (tx) => {
        await tx.insert(vehicleMaintenanceRecords).values({
          id: serviceId,
          vehicle_id: vehicleId,
          type: serviceType,
          km_at_service: km,
          service_date: serviceDate,
          next_service_km: nextKm,
          next_service_date: nextServiceDate,
          description: serviceDescription,
          cost,
          service_provider: serviceProvider,
          created_at: now,
          updated_at: now
        });

        // Araç KM güncelle
        if (km > veh.current_km) {
          await tx.update(vehicles).set({ current_km: km, updated_at: now }).where(eq(vehicles.id, vehicleId));
        }

        // Cüzdandan atomik düş & Ulaşım/Yakıt bütçe kategorisine harcama kaydet
        if (authorizedWallet && cost > 0) {
          resolvedCategoryId = getFamilySeedCategoryId('cat-ulasim', familyId);
          await ensureFamilyCategories(familyId, tx);

          const isCreditCard = authorizedWallet.type === 'credit_card';
          await tx.update(walletsAccounts).set({
            balance: isCreditCard
              ? sql`${walletsAccounts.balance} + ${cost}`
              : sql`${walletsAccounts.balance} - ${cost}`,
            updated_at: now
          }).where(eq(walletsAccounts.id, data.wallet_id));

          createdTxId = `tx-srv-${Date.now()}`;
          await tx.insert(transactions).values({
            id: createdTxId,
            wallet_id: data.wallet_id,
            category_id: resolvedCategoryId,
            user_id: user.id,
            family_id: familyId,
            merchant: `${serviceProvider} Bakımı`,
            amount: cost,
            currency: authorizedWallet.currency || 'TRY',
            transaction_date: serviceDate,
            notes: `Araç Servis Bakımı: ${serviceDescription}`,
            is_verified: 1,
            is_family_shared: veh.is_family_shared ?? 1,
            created_at: now,
            updated_at: now,
            sync_status: 'synced',
            device_id: 'web-client'
          });
        }
      });

      await eventBus.emit(EVENTS.VEHICLE_MAINTENANCE_RECORDED, {
        recordId: serviceId,
        vehicle_id: vehicleId,
        km,
        cost,
        description: serviceDescription,
        userId: user.id,
        familyId
      });

      if (createdTxId && resolvedCategoryId) {
        await eventBus.emit(EVENTS.TRANSACTION_CREATED, {
          transactionId: createdTxId,
          wallet_id: data.wallet_id,
          category_id: resolvedCategoryId,
          amount: cost,
          merchant: `${serviceProvider} Bakımı`,
          user_id: user.id,
          userId: user.id,
          family_id: familyId,
          familyId
        });
      }

      return NextResponse.json({ success: true, message: `🔧 Araç servis bakımı kaydedildi!` });
    }

    // Yasal Hatırlatıcı Ekleme/Güncelleme
    if (action === 'add_legal') {
      const vehicleId = data.vehicle_id;
      if (!vehicleId) return NextResponse.json({ success: false, error: 'Araç ID belirtilmelidir.' }, { status: 400 });
      const targetVeh = (await db.select({ id: vehicles.id }).from(vehicles).where(
        getAuthorizedVehicleWhere(vehicleId, user.id, familyId)
      ).limit(1))[0];
      if (!targetVeh) {
        return NextResponse.json({ success: false, error: 'Araç bulunamadı veya bu işlem için yetkiniz yok.' }, { status: 403 });
      }

      const id = `leg-${Date.now()}`;
      await db.insert(vehicleLegalReminders).values({
        id,
        vehicle_id: vehicleId,
        type: data.type,
        due_date: data.due_date,
        policy_no: data.policy_no || data.policy || '',
        cost_estimate: parseFloat(data.cost_estimate) || 0,
        is_completed: 0,
        created_at: now,
        updated_at: now
      });

      return NextResponse.json({ success: true, message: '🛡️ Yasal hatırlatıcı güncellendi.' });
    }

    // Yasal Hatırlatıcıları Toplu Güncelleme (Muayene, Sigorta, Kasko)
    if (action === 'update_legal_dates' && data.vehicle_id) {
      const vehicleId = data.vehicle_id;
      const targetVeh = (await db.select({ id: vehicles.id }).from(vehicles).where(
        getAuthorizedVehicleWhere(vehicleId, user.id, familyId)
      ).limit(1))[0];
      if (!targetVeh) {
        return NextResponse.json({ success: false, error: 'Araç bulunamadı veya bu işlem için yetkiniz yok.' }, { status: 403 });
      }

      const { muayene_date, sigorta_date, kasko_date } = data;
      const sigortaPolicyInput = data.sigorta_policy_no !== undefined ? data.sigorta_policy_no : data.sigorta_policy;
      const kaskoPolicyInput = data.kasko_policy_no !== undefined ? data.kasko_policy_no : data.kasko_policy;

      const itemsToUpdate = [
        { type: 'muayene', due_date: muayene_date, policy_no: undefined as string | null | undefined, cost_estimate: 1820 },
        { type: 'sigorta', due_date: sigorta_date, policy_no: sigortaPolicyInput, cost_estimate: 4500 },
        { type: 'kasko', due_date: kasko_date, policy_no: kaskoPolicyInput, cost_estimate: 12000 }
      ];

      for (const item of itemsToUpdate) {
        if (!item.due_date) continue;

        const existing = (await db.select()
          .from(vehicleLegalReminders)
          .where(and(eq(vehicleLegalReminders.vehicle_id, vehicleId), eq(vehicleLegalReminders.type, item.type)))
          .limit(1))[0];

        const resolvedPolicyNo = item.policy_no !== undefined
          ? String(item.policy_no ?? '').trim()
          : (existing?.policy_no || '');

        if (existing) {
          await db.update(vehicleLegalReminders)
            .set({
              due_date: item.due_date,
              policy_no: resolvedPolicyNo,
              updated_at: now
            })
            .where(eq(vehicleLegalReminders.id, existing.id));
        } else {
          await db.insert(vehicleLegalReminders).values({
            id: `leg-${item.type}-${Date.now()}`,
            vehicle_id: vehicleId,
            type: item.type,
            due_date: item.due_date,
            policy_no: resolvedPolicyNo,
            cost_estimate: item.cost_estimate,
            is_completed: 0,
            created_at: now,
            updated_at: now
          });
        }
      }

      return NextResponse.json({
        success: true,
        message: '🛡️ Araç muayene ve sigorta tarihleri başarıyla güncellendi!'
      });
    }

    // Yasal Hatırlatıcıları Otomatik Üret (TÜVTÜRK & MTV)
    if (action === 'auto_generate_legal' && data.vehicle_id) {
      const veh = (await db.select().from(vehicles).where(
        getAuthorizedVehicleWhere(data.vehicle_id, user.id, familyId)
      ).limit(1))[0];
      if (!veh) return NextResponse.json({ success: false, error: 'Araç bulunamadı veya bu işlem için yetkiniz yok.' }, { status: 403 });

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
