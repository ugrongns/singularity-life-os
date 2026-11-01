// Singularity Modüler Monolit Internal Event Bus
import { db, initDatabase } from '@/db';
import { 
  transactions, categories, walletsAccounts, 
  vehicles, vehicleMaintenanceRecords, 
  nutritionMeals, userHealthProfile 
} from '@/db/schema';
import { eq, sql, and, or, gte, lte, isNull } from 'drizzle-orm';
import { localYYYYMMDD } from '@/lib/bill-schedule';
import { getTodayTurkeyDate } from '@/lib/date-utils';

export type DomainEvent =
  | {
      type: 'FUEL_LOGGED';
      payload: {
        userId: string;
        vehicleId: string;
        amountTRY: number;
        liters: number;
        km: number;
        station: string;
        accountId: string;
        date: string;
        receiptImage?: string;
      };
    }
  | {
      type: 'VEHICLE_SERVICED';
      payload: {
        userId: string;
        vehicleId: string;
        serviceName: string;
        costTRY: number;
        km: number;
        accountId: string;
        installments: number;
        date: string;
      };
    }
  | {
      type: 'READING_SESSION_COMPLETED';
      payload: {
        userId: string;
        bookId: string;
        startPage: number;
        endPage: number;
        durationMinutes: number;
        wpm: number;
        date: string;
      };
    }
  | {
      type: 'FOOD_CONSUMED';
      payload: {
        userId: string;
        mealName: string;
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        consumedItems: string[];
        date: string;
      };
    }
  | {
      type: string;
      payload?: any;
    };

type EventCallback<T = any> = (data: T) => void | Promise<void>;

export class EventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private maxListeners = 50;

  // Olay Dinleyici Ekleme
  subscribe<T = any>(event: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event)!;
    if (set.size >= this.maxListeners) {
      console.warn(`[EventBus Warning] "${event}" olayı için maksimum dinleyici sınırına (${this.maxListeners}) ulaşıldı.`);
    }
    set.add(callback);

    // Unsubscribe fonksiyonu
    return () => {
      set.delete(callback);
    };
  }

  // Olay Yayma (Emit / Publish) - İzole hata yönetimi ve Promise.allSettled
  async emit<T>(event: string, data: T): Promise<void> {
    const callbacks = this.listeners.get(event);
    if (!callbacks || callbacks.size === 0) return;

    const promises = Array.from(callbacks).map(async (callback) => {
      try {
        await callback(data);
      } catch (error) {
        console.error(`[EventBus] "${event}" dinleyicisinde hata oluştu:`, error);
      }
    });

    await Promise.allSettled(promises);
  }

  // DomainEvent dispatch uyumluluğu
  async dispatch<T extends { type: string; payload?: any }>(event: T): Promise<void> {
    const handlers = this.listeners.get(event.type);
    if (!handlers || handlers.size === 0) return;

    const promises = Array.from(handlers).map(async (handler) => {
      try {
        await handler(event);
      } catch (err) {
        console.error(`[EventBus Error] Event ${event.type} işlenirken hata oluştu:`, err);
      }
    });

    await Promise.allSettled(promises);
  }

  // Dinleyici temizleme (Testler ve bellek yönetimi için)
  clear(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.size || 0;
  }
}

// Next.js hot-reload bellek sızıntısını önleyen global singleton
const globalForEvents = globalThis as unknown as { __singularity_event_bus__?: EventBus };
export const eventBus = globalForEvents.__singularity_event_bus__ ?? new EventBus();
export const domainEventBus = eventBus;
if (process.env.NODE_ENV !== 'production') globalForEvents.__singularity_event_bus__ = eventBus;

// Standart Olay Tipleri (Singularity Event Types)
export const EVENTS = {
  TRANSACTION_CREATED: 'transaction:created',
  INSTALLMENT_SCHEDULED: 'installment:scheduled',
  FUEL_RECEIPT_RECORDED: 'vehicle:fuel_recorded',
  VEHICLE_MAINTENANCE_RECORDED: 'vehicle:maintenance_recorded',
  DIET_MEAL_RECORDED: 'health:meal_recorded',
  BACKUP_REQUESTED: 'system:backup_requested',
};

// =========================================================================
// 🚀 Modüler Monolit Domain Dinleyicileri (Gerçek İş Yükü & Cross-Domain Logic)
// =========================================================================

// 1. Harcama Oluştuğunda: Bütçe Limiti Kontrolü & Kategori Tavan Uyarısı
eventBus.subscribe(EVENTS.TRANSACTION_CREATED, async (data: any) => {
  try {
    await initDatabase();
    if (!data.category_id || !data.amount) return;
    const userId = data.user_id || data.userId;
    const familyId = data.family_id || data.familyId;
    if (!userId && !familyId) return;

    const catList = await db.select().from(categories).where(
      and(
        eq(categories.id, data.category_id),
        familyId ? or(eq(categories.family_id, familyId), isNull(categories.family_id)) : isNull(categories.family_id)
      )
    );
    const cat = catList[0];
    if (!cat || !cat.monthly_budget_limit || cat.monthly_budget_limit <= 0) return;

    // Bu ayın toplam harcamasını hesapla
    const now = new Date();
    const startOfMonth = localYYYYMMDD(new Date(now.getFullYear(), now.getMonth(), 1));
    const endOfMonth = localYYYYMMDD(new Date(now.getFullYear(), now.getMonth() + 1, 0));

    const userFilter = familyId
      ? (userId ? or(eq(transactions.family_id, familyId), eq(transactions.user_id, userId)) : eq(transactions.family_id, familyId))
      : eq(transactions.user_id, userId!);

    const monthlyTxs = await db.select()
      .from(transactions)
      .where(
        and(
          eq(transactions.category_id, cat.id),
          userFilter,
          gte(transactions.transaction_date, startOfMonth),
          lte(transactions.transaction_date, endOfMonth)
        )
      );

    const totalSpentThisMonth = monthlyTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const limit = cat.monthly_budget_limit;
    const usagePercent = Math.round((totalSpentThisMonth / limit) * 100);

    if (totalSpentThisMonth > limit) {
      console.warn(`[EventBus ALARM] 🚨 ${cat.name} kategorisinde bütçe aşıldı! Harcanan: ${totalSpentThisMonth.toLocaleString('tr-TR')} ₺ / Limit: ${limit.toLocaleString('tr-TR')} ₺ (%${usagePercent})`);
    } else if (usagePercent >= 85) {
      console.info(`[EventBus UYARI] ⚠️ ${cat.name} bütçesi dolmak üzere: %${usagePercent} kullanıldı (${totalSpentThisMonth.toLocaleString('tr-TR')} ₺ / ${limit.toLocaleString('tr-TR')} ₺)`);
    }
  } catch (err) {
    console.error('[EventBus Error - TRANSACTION_CREATED]:', err);
  }
});

// 2. Araç Bakımı Yapıldığında: Kilometre Senkronizasyonu & Servis Döngüsü
eventBus.subscribe(EVENTS.VEHICLE_MAINTENANCE_RECORDED, async (data: any) => {
  try {
    await initDatabase();
    if (!data.vehicle_id) return;
    const userId = data.user_id || data.userId;
    const familyId = data.family_id || data.familyId;

    const km = Number(data.km || data.km_at_service) || 0;
    if (km > 0) {
      const vehFilter = familyId
        ? (userId ? or(eq(vehicles.family_id, familyId), eq(vehicles.user_id, userId)) : eq(vehicles.family_id, familyId))
        : (userId ? eq(vehicles.user_id, userId) : undefined);

      const condition = and(
        eq(vehicles.id, data.vehicle_id),
        vehFilter
      );

      const vehList = await db.select().from(vehicles).where(condition);
      const veh = vehList[0];
      if (veh && km > veh.current_km) {
        await db.update(vehicles)
          .set({ current_km: km, updated_at: new Date().toISOString() })
          .where(eq(vehicles.id, data.vehicle_id));
        console.log(`[EventBus] 🚗 Araç KM güncellendi: ${veh.plate} (${veh.current_km} ➔ ${km} KM)`);
      }
    }
  } catch (err) {
    console.error('[EventBus Error - VEHICLE_MAINTENANCE_RECORDED]:', err);
  }
});

// 3. Beslenme Öğünü Kaydedildiğinde: Günlük Kalori & Makro Hedef Takibi
eventBus.subscribe(EVENTS.DIET_MEAL_RECORDED, async (data: any) => {
  try {
    await initDatabase();
    const userId = data.user_id || data.userId;
    const familyId = data.family_id || data.familyId;
    if (!userId && !familyId) return;

    const today = getTodayTurkeyDate();
    const mealFilter = familyId
      ? (userId ? or(eq(nutritionMeals.family_id, familyId), eq(nutritionMeals.user_id, userId)) : eq(nutritionMeals.family_id, familyId))
      : eq(nutritionMeals.user_id, userId!);

    const todayMeals = await db.select().from(nutritionMeals).where(
      and(
        eq(nutritionMeals.date, today),
        mealFilter
      )
    );
    const totalCal = todayMeals.reduce((s, m) => s + (m.calories || 0), 0);
    const totalPro = todayMeals.reduce((s, m) => s + (m.protein_g || 0), 0);

    const profileFilter = familyId
      ? (userId ? or(eq(userHealthProfile.family_id, familyId), eq(userHealthProfile.user_id, userId)) : eq(userHealthProfile.family_id, familyId))
      : eq(userHealthProfile.user_id, userId!);

    const profile = (await db.select().from(userHealthProfile).where(profileFilter).limit(1))[0];
    const targetCal = profile?.daily_calorie_target || 2200;
    const calPercent = Math.round((totalCal / targetCal) * 100);

    console.log(`[EventBus] 🥗 Günlük beslenme güncellendi: ${totalCal}/${targetCal} kcal (%${calPercent}) - Protein: ${totalPro}g`);
  } catch (err) {
    console.error('[EventBus Error - DIET_MEAL_RECORDED]:', err);
  }
});
