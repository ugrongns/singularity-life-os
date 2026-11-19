import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import * as schema from '../src/db/schema';

const {
  mockGetAuthUser,
  mockSelect,
  mockInsert,
  mockUpdate,
  mockDelete,
  mockTransaction,
} = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getAuthUser: mockGetAuthUser,
}));

vi.mock('@/db', () => ({
  initDatabase: vi.fn().mockResolvedValue(undefined),
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

import { GET as getVehicles, POST as postVehicles } from '../src/app/api/vehicles/route';
import { GET as getVehicleMaintenance, POST as postVehicleMaintenance } from '../src/app/api/vehicles/maintenance/route';
import { GET as getHomeOperations, POST as postHomeOperations } from '../src/app/api/home-operations/route';
import { GET as getNotifications } from '../src/app/api/notifications/route';
import { calculateVehicleMaintenanceCycle, calculateFuelConsumption } from '../src/lib/vehicle-legal';
import { eventBus, EVENTS } from '../src/lib/events';
import { getTodayTurkeyDate, shiftTurkeyDate } from '../src/lib/date-utils';

function createSelectChain(rows: unknown[] = []) {
  const chain: Record<string, any> = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => Promise.resolve(rows));
  chain.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(rows).then(onFulfilled, onRejected);
  return chain;
}

function createInsertChain(recorded: any[]) {
  return {
    values: vi.fn((vals: any) => {
      recorded.push(vals);
      const ret: Record<string, any> = {
        onConflictDoNothing: () => Promise.resolve(Array.isArray(vals) ? vals : [vals]),
        then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
          Promise.resolve(Array.isArray(vals) ? vals : [vals]).then(onFulfilled, onRejected),
      };
      return ret;
    }),
  };
}

function createUpdateChain(recorded: any[]) {
  const chain: Record<string, any> = {
    set: vi.fn((vals: any) => {
      recorded.push(vals);
      return chain;
    }),
    where: vi.fn(() => Promise.resolve([])),
  };
  return chain;
}

function createDeleteChain(recorded: any[]) {
  return {
    where: vi.fn((expr: any) => {
      recorded.push(expr);
      return Promise.resolve([]);
    }),
  };
}

describe('🚗 Araç ve Ev Operasyonları (/vehicles) Denetim Testleri', () => {
  const pgDialect = new PgDialect();

  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockImplementation(async (cb: any) => {
      const tx = {
        select: (...args: unknown[]) => mockSelect(...args),
        insert: (...args: unknown[]) => mockInsert(...args),
        update: (...args: unknown[]) => mockUpdate(...args),
        delete: (...args: unknown[]) => mockDelete(...args),
      };
      return cb(tx);
    });
  });

  describe('1. Yetki ve Aile İzolasyonu (Auth & BOLA Kalkanları)', () => {
    it('GET /api/vehicles ve GET /api/home-operations oturumsuz isteklerde 401 dönmelidir', async () => {
      mockGetAuthUser.mockResolvedValue(null);

      const vehRes = await getVehicles(new Request('http://localhost/api/vehicles'));
      expect(vehRes.status).toBe(401);

      const homeRes = await getHomeOperations();
      expect(homeRes.status).toBe(401);
    });

    it('GET /api/vehicles ve GET /api/vehicles/maintenance yetkisiz vehicle_id parametresinde 403 dönmeli ve özel cüzdanları filtrelemelidir', async () => {
      mockGetAuthUser.mockResolvedValue({ id: 'usr-1', family_id: 'fam-1' });

      const vehSelectChain = createSelectChain([{ id: 'veh-own', current_km: 30000, is_family_shared: 1 }]);
      const walletSelectChain = createSelectChain([]);
      mockSelect
        .mockReturnValueOnce(vehSelectChain)
        .mockReturnValueOnce(walletSelectChain);

      const res = await getVehicles(new Request('http://localhost/api/vehicles?vehicle_id=veh-foreign'));
      expect(res.status).toBe(403);

      const vehWhereSql = pgDialect.sqlToQuery(vehSelectChain.where.mock.calls[0][0]).sql;
      expect(vehWhereSql).toContain('"vehicles"."is_family_shared" =');

      const walletWhereSql = pgDialect.sqlToQuery(walletSelectChain.where.mock.calls[0][0]).sql;
      expect(walletWhereSql).toContain('"wallets_accounts"."is_family_shared" =');

      mockSelect.mockReturnValueOnce(createSelectChain([{ id: 'veh-own' }]));
      const maintRes = await getVehicleMaintenance(
        new Request('http://localhost/api/vehicles/maintenance?vehicle_id=veh-foreign')
      );
      expect(maintRes.status).toBe(403);
    });

    it('POST /api/vehicles add_fuel ve add_service aynı ailedeki başka üyenin özel (is_family_shared=0) cüzdanını 403 ile reddetmelidir', async () => {
      mockGetAuthUser.mockResolvedValue({ id: 'usr-1', family_id: 'fam-1' });

      // 1. select: vehicle (authorized)
      // 2. select: wallet (private wallet of usr-2 in same family -> filtered out or rejected)
      mockSelect
        .mockReturnValueOnce(createSelectChain([{ id: 'veh-1', current_km: 40000, user_id: 'usr-1', family_id: 'fam-1', is_family_shared: 1 }]))
        .mockReturnValueOnce(createSelectChain([{ id: 'wal-private-usr2', user_id: 'usr-2', family_id: 'fam-1', is_family_shared: 0, is_active: 1, balance: 5000 }]));

      const fuelRes = await postVehicles(new Request('http://localhost/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_fuel',
          vehicle_id: 'veh-1',
          km: 40200,
          liters: 40,
          price_per_liter: 45,
          wallet_id: 'wal-private-usr2',
        }),
      }));
      expect(fuelRes.status).toBe(403);
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('POST /api/home-operations reset_filter ve delete_appliance başka aileye ait kayıtlarda 403 dönmelidir', async () => {
      mockGetAuthUser.mockResolvedValue({ id: 'usr-1', family_id: 'fam-1' });

      mockSelect.mockReturnValueOnce(createSelectChain([]));
      const resetRes = await postHomeOperations(new Request('http://localhost/api/home-operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_filter', record_id: 'hm-foreign', months: 6 }),
      }));
      expect(resetRes.status).toBe(403);

      mockSelect.mockReturnValueOnce(createSelectChain([]));
      const delRes = await postHomeOperations(new Request('http://localhost/api/home-operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_appliance', id: 'app-foreign' }),
      }));
      expect(delRes.status).toBe(403);
    });
  });

  describe('2. KM ve Tarih Eşik Hesapları', () => {
    it('calculateVehicleMaintenanceCycle gecikmiş bakımda döngüyü sonraki 15.000 KM dilimine sıfırlamamalı ve ara onarımları periyodik bakımdan ayırmalıdır', () => {
      const records = [
        { id: 'srv-2', type: 'aku_degisim', km_at_service: 24000, next_service_km: 39000, service_date: '2026-10-01' },
        { id: 'srv-1', type: 'periyodik_bakim', km_at_service: 10000, next_service_km: 25000, service_date: '2026-01-15' },
      ];

      // Araç 25.500 KM'de (25.000 KM periyodik bakım hedefini 500 KM aşmış durumda)
      const overdueCycle = calculateVehicleMaintenanceCycle(25500, records);
      expect(overdueCycle.cycleStartKm).toBe(10000);
      expect(overdueCycle.nextServiceKm).toBe(25000);
      expect(overdueCycle.remainingKm).toBe(0);
      expect(overdueCycle.overdueKm).toBe(500);
      expect(overdueCycle.isOverdue).toBe(true);
      expect(overdueCycle.kmProgressPercentage).toBe(100);

      // Araç 22.000 KM'deyken 24.000 veya 21.000 KM'deki akü değişimi 10.000 -> 25.000 periyodik döngüsünü bozmamalı
      const activeCycle = calculateVehicleMaintenanceCycle(22000, [
        { id: 'srv-bat', type: 'aku_degisim', km_at_service: 21000, next_service_km: 36000 },
        { id: 'srv-per', type: 'periyodik_bakim', km_at_service: 10000, next_service_km: 25000 },
      ]);
      expect(activeCycle.cycleStartKm).toBe(10000);
      expect(activeCycle.nextServiceKm).toBe(25000);
      expect(activeCycle.remainingKm).toBe(3000);
      expect(activeCycle.isOverdue).toBe(false);
      expect(activeCycle.kmProgressPercentage).toBe(80);
    });

    it('POST /api/vehicles update_legal_dates modalın gönderdiği sigorta_policy ve kasko_policy numaralarını kaydetmelidir', async () => {
      mockGetAuthUser.mockResolvedValue({ id: 'usr-1', family_id: 'fam-1' });

      const updates: any[] = [];
      mockSelect
        .mockReturnValueOnce(createSelectChain([{ id: 'veh-1' }])) // vehicle ownership
        .mockReturnValueOnce(createSelectChain([{ id: 'leg-1', type: 'muayene', policy_no: '' }]))
        .mockReturnValueOnce(createSelectChain([{ id: 'leg-2', type: 'sigorta', policy_no: 'OLD-1' }]))
        .mockReturnValueOnce(createSelectChain([{ id: 'leg-3', type: 'kasko', policy_no: 'OLD-2' }]));
      mockUpdate.mockImplementation(() => createUpdateChain(updates));

      const res = await postVehicles(new Request('http://localhost/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_legal_dates',
          vehicle_id: 'veh-1',
          muayene_date: '2027-05-15',
          sigorta_date: '2027-06-20',
          sigorta_policy: 'POL-SIG-999',
          kasko_date: '2027-07-10',
          kasko_policy: 'POL-KAS-888',
        }),
      }));

      expect(res.status).toBe(200);
      expect(updates).toHaveLength(3);
      expect(updates[1].policy_no).toBe('POL-SIG-999');
      expect(updates[2].policy_no).toBe('POL-KAS-888');
    });

    it('GET /api/home-operations ve GET /api/notifications TR takvim gününe göre eşikleri ve garanti durumunu doğru hesaplamalıdır', async () => {
      mockGetAuthUser.mockResolvedValue({ id: 'usr-1', family_id: 'fam-1' });
      const todayTr = getTodayTurkeyDate();
      const in5Days = shiftTurkeyDate(todayTr, 5);
      const in20Days = shiftTurkeyDate(todayTr, 20);

      mockSelect
        .mockReturnValueOnce(createSelectChain([
          { id: 'hm-1', title: 'Su Arıtma Filtresi', next_due_date: in5Days, status: 'ok' },
          { id: 'hm-2', title: 'Kombi Bakımı', next_due_date: in20Days, status: 'ok' },
        ]))
        .mockReturnValueOnce(createSelectChain([
          { id: 'app-today', name: 'Buzdolabı', warranty_expiry_date: todayTr },
        ]))
        .mockReturnValueOnce(createSelectChain([
          { id: 'wal-1', name: 'Ana Hesap', balance: 5000, is_active: 1 },
        ]));

      const homeRes = await getHomeOperations();
      const homeJson = await homeRes.json();
      expect(homeRes.status).toBe(200);
      expect(homeJson.data.wallets).toHaveLength(1);
      expect(homeJson.data.maintenanceRecords[0].days_left).toBe(5);
      expect(homeJson.data.maintenanceRecords[0].status).toBe('urgent');
      expect(homeJson.data.maintenanceRecords[1].days_left).toBe(20);
      expect(homeJson.data.maintenanceRecords[1].status).toBe('warning');
      // Garanti bitiş gününde (0 gün kala) garanti hâlâ aktif olmalıdır
      expect(homeJson.data.appliances[0].days_left_warranty).toBe(0);
      expect(homeJson.data.appliances[0].is_warranty_active).toBe(true);

      // GET /api/notifications DB'de status='ok' olsa dahi 30 gün altındaki ev bakımını ve MTV taksitini döndürmelidir
      mockSelect
        .mockReturnValueOnce(createSelectChain([])) // vault
        .mockReturnValueOnce(createSelectChain([])) // importantDates
        .mockReturnValueOnce(createSelectChain([{ id: 'veh-1' }])) // vehicles
        .mockReturnValueOnce(createSelectChain([{ id: 'leg-mtv', vehicle_id: 'veh-1', type: 'mtv_2', due_date: in5Days, is_completed: 0 }])) // legalReminders
        .mockReturnValueOnce(createSelectChain([{ id: 'hm-1', title: 'Su Arıtma Filtresi', next_due_date: in5Days, status: 'ok' }])) // homeMaintenanceRecords
        .mockReturnValueOnce(createSelectChain([])) // walletsAccounts
        .mockReturnValueOnce(createSelectChain([])); // recurringBills

      const notifRes = await getNotifications();
      const notifJson = await notifRes.json();
      expect(notifRes.status).toBe(200);
      const mtvNotif = notifJson.data.notifications.find((n: any) => n.id === 'vehicle-leg-mtv');
      expect(mtvNotif?.title).toContain('MTV 2. Taksit');
      const homeNotif = notifJson.data.notifications.find((n: any) => n.id === 'home-hm-1');
      expect(homeNotif).toBeDefined();
      expect(homeNotif.priority).toBe('critical');
    });
  });

  describe('3. EventBus ve Bütçe Yansıması (cat-ulasim-<familyId>)', () => {
    it('POST /api/vehicles add_fuel ve add_service işlemleri cat-ulasim-<familyId> kategorisiyle bütçeye işlenmeli ve EventBus olaylarını yayınlamalıdır', async () => {
      mockGetAuthUser.mockResolvedValue({ id: 'usr-1', family_id: 'fam-1' });
      const emitSpy = vi.spyOn(eventBus, 'emit');

      const inserted: any[] = [];
      const updated: any[] = [];
      mockInsert.mockImplementation(() => createInsertChain(inserted));
      mockUpdate.mockImplementation(() => createUpdateChain(updated));

      // 1) add_fuel
      mockSelect
        .mockReturnValueOnce(createSelectChain([{ id: 'veh-1', current_km: 50000, user_id: 'usr-1', family_id: 'fam-1', is_family_shared: 1 }]))
        .mockReturnValueOnce(createSelectChain([{ id: 'wal-1', name: 'Ana Hesap', type: 'checking', balance: 5000, currency: 'TRY', user_id: 'usr-1', family_id: 'fam-1', is_family_shared: 1, is_active: 1 }]));

      const fuelRes = await postVehicles(new Request('http://localhost/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_fuel',
          vehicle_id: 'veh-1',
          km: 50450,
          liters: 35,
          price_per_liter: 40,
          total_amount: 1400,
          fuel_station: 'Opet',
          wallet_id: 'wal-1',
        }),
      }));
      expect(fuelRes.status).toBe(200);

      const fuelTx = inserted.find(row => !Array.isArray(row) && typeof row?.id === 'string' && row.id.startsWith('tx-fuel-'));
      expect(fuelTx).toBeDefined();
      expect(fuelTx.category_id).toBe('cat-ulasim-fam-1');
      expect(fuelTx.amount).toBe(1400);

      expect(emitSpy).toHaveBeenCalledWith(
        EVENTS.FUEL_RECEIPT_RECORDED,
        expect.objectContaining({ vehicle_id: 'veh-1', total_amount: 1400, userId: 'usr-1', familyId: 'fam-1' })
      );
      expect(emitSpy).toHaveBeenCalledWith(
        EVENTS.TRANSACTION_CREATED,
        expect.objectContaining({ category_id: 'cat-ulasim-fam-1', amount: 1400, userId: 'usr-1', familyId: 'fam-1' })
      );

      // 2) add_service (KMH hesabıyla eksi bakiyeye inebilmeli ve VEHICLE_MAINTENANCE_RECORDED + TRANSACTION_CREATED yayınlamalı)
      mockSelect
        .mockReturnValueOnce(createSelectChain([{ id: 'veh-1', current_km: 50450, user_id: 'usr-1', family_id: 'fam-1', is_family_shared: 1 }]))
        .mockReturnValueOnce(createSelectChain([{ id: 'wal-kmh', name: 'Ek Hesap', type: 'kmh', balance: 1000, overdraft_limit: 5000, currency: 'TRY', user_id: 'usr-1', family_id: 'fam-1', is_family_shared: 1, is_active: 1 }]));

      const srvRes = await postVehicles(new Request('http://localhost/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_service',
          vehicle_id: 'veh-1',
          km_at_service: 50500,
          type: 'periyodik_bakim',
          description: '15.000 KM Bakımı',
          cost: 3500,
          service_provider: 'Yetkili Servis',
          service_date: '2026-11-19',
          wallet_id: 'wal-kmh',
        }),
      }));
      expect(srvRes.status).toBe(200);

      // Atomik db.transaction çağrılmış olmalı ve cüzdan bakiyesi SQL ifadesiyle güncellenmiş olmalı
      expect(mockTransaction).toHaveBeenCalledTimes(2);
      expect(updated.some(u => u && typeof u.balance === 'object')).toBe(true);

      const srvRecord = inserted.find(row => !Array.isArray(row) && typeof row?.id === 'string' && row.id.startsWith('srv-'));
      expect(srvRecord?.next_service_date).toBe('2027-11-19');

      const srvTx = inserted.find(row => !Array.isArray(row) && typeof row?.id === 'string' && row.id.startsWith('tx-srv-'));
      expect(srvTx?.category_id).toBe('cat-ulasim-fam-1');

      expect(emitSpy).toHaveBeenCalledWith(
        EVENTS.VEHICLE_MAINTENANCE_RECORDED,
        expect.objectContaining({ vehicle_id: 'veh-1', km: 50500, cost: 3500, userId: 'usr-1', familyId: 'fam-1' })
      );

      emitSpy.mockRestore();
    });

    it('POST /api/home-operations reset_filter cüzdan ve tutar verildiğinde atomik transaction ile cat-kira-<familyId> gideri oluşturmalı ve EventBus yayını yapmalıdır', async () => {
      mockGetAuthUser.mockResolvedValue({ id: 'usr-1', family_id: 'fam-1' });
      const emitSpy = vi.spyOn(eventBus, 'emit');

      const inserted: any[] = [];
      const updated: any[] = [];
      mockInsert.mockImplementation(() => createInsertChain(inserted));
      mockUpdate.mockImplementation(() => createUpdateChain(updated));

      mockSelect
        .mockReturnValueOnce(createSelectChain([{ id: 'hm-1', title: 'Su Arıtma Filtresi', interval_months: 6, user_id: 'usr-1', family_id: 'fam-1' }]))
        .mockReturnValueOnce(createSelectChain([{ id: 'wal-1', name: 'Vadesiz', type: 'checking', balance: 2000, currency: 'TRY', user_id: 'usr-1', family_id: 'fam-1', is_family_shared: 1, is_active: 1 }]));

      const res = await postHomeOperations(new Request('http://localhost/api/home-operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset_filter',
          record_id: 'hm-1',
          months: 6,
          wallet_id: 'wal-1',
          cost: 450,
        }),
      }));

      expect(res.status).toBe(200);
      expect(mockTransaction).toHaveBeenCalledTimes(1);

      const homeTx = inserted.find(row => !Array.isArray(row) && typeof row?.id === 'string' && row.id.startsWith('tx-home-'));
      expect(homeTx).toBeDefined();
      expect(homeTx.category_id).toBe('cat-kira-fam-1');
      expect(homeTx.amount).toBe(450);

      expect(emitSpy).toHaveBeenCalledWith(
        EVENTS.TRANSACTION_CREATED,
        expect.objectContaining({ category_id: 'cat-kira-fam-1', amount: 450, userId: 'usr-1', familyId: 'fam-1' })
      );

      emitSpy.mockRestore();
    });

    it('calculateFuelConsumption parçalı dolumları (is_full_tank=0) bir sonraki tam depoya kadar biriktirerek L/100km hesaplamalıdır', () => {
      // 10.000 KM (Tam depo - başlangıç) -> 10.250 KM (Parçalı 15L) -> 10.600 KM (Tam depo 33L)
      // Toplam mesafe = 600 KM, toplam yakıt = 15 + 33 = 48 L -> 48 / 600 * 100 = 8.0 L/100km
      const result = calculateFuelConsumption([
        { km: 10000, liters: 40, total_amount: 1600, is_full_tank: 1, fuel_date: '2026-11-01' },
        { km: 10250, liters: 15, total_amount: 600, is_full_tank: 0, fuel_date: '2026-11-08' },
        { km: 10600, liters: 33, total_amount: 1320, is_full_tank: 1, fuel_date: '2026-11-15' },
      ]);

      expect(result.avgLitersPer100Km).toBe(8);
      expect(result.avgCostPerKm).toBe(3.2); // (600 + 1320) / 600 = 3.20 TL/km
    });
  });
});
