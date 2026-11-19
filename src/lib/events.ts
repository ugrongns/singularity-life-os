// Singularity Modüler Monolit Internal Event Bus
import { db, initDatabase } from '@/db';
import { 
  transactions, categories, walletsAccounts, 
  vehicles, vehicleMaintenanceRecords, 
  nutritionMeals, userHealthProfile,
  habits, habitLogs
} from '@/db/schema';
import { eq, and, or, gte, lte } from 'drizzle-orm';
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
      type: 'TASK_COMPLETED';
      payload: {
        taskId: string;
        title: string;
        pillar: string;
        isMit: boolean;
        sourceModule?: string | null;
        sourceRefId?: string | null;
        focusLoggedMinutes?: number;
        completedAt: string;
        userId: string;
        familyId?: string | null;
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
  TASK_COMPLETED: 'task:completed',
  READING_SESSION_COMPLETED: 'library:reading_session_completed',
  WORKOUT_COMPLETED: 'health:workout_completed',
  WATER_GOAL_REACHED: 'health:water_goal_reached',
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

    const catList = familyId
      ? await db.select().from(categories).where(
          and(
            eq(categories.id, data.category_id),
            eq(categories.family_id, familyId)
          )
        )
      : [];
    const cat = catList[0];
    if (!cat || !cat.monthly_budget_limit || cat.monthly_budget_limit <= 0) return;

    // Bu ayın toplam harcamasını hesapla (Europe/Istanbul takvim ayı)
    const todayTr = getTodayTurkeyDate();
    const ym = todayTr.slice(0, 7);
    const [yNum, mNum] = ym.split('-').map(Number);
    const lastDay = new Date(Date.UTC(yNum, mNum, 0)).getUTCDate();
    const startOfMonth = `${ym}-01`;
    const endOfMonth = `${ym}-${String(lastDay).padStart(2, '0')}`;

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

// 4. Görev Tamamlandığında: Çift Yönlü Sistem Köprüsü Takibi & Odak Özeti (Onaysız mali/bakım yazımı yapmaz)
eventBus.subscribe(EVENTS.TASK_COMPLETED, async (data: any) => {
  try {
    const title = String(data?.title || '').trim();
    if (!title) return;
    const sourceMod = data?.sourceModule || data?.source_module || 'manual';
    const focusMins = Number(data?.focusLoggedMinutes ?? data?.focus_logged_minutes ?? 0) || 0;
    const focusSuffix = focusMins > 0 ? ` (${focusMins} dk odak)` : '';
    const bridgeSuffix = sourceMod && sourceMod !== 'manual' ? ` • Köprü Kaynağı: ${sourceMod}` : '';
    console.log(`[EventBus] 🎯 Görev tamamlandı: "${title}"${focusSuffix}${bridgeSuffix}`);
  } catch (err) {
    console.error('[EventBus Error - TASK_COMPLETED]:', err);
  }
});

// 5. Alışkanlık Otomasyonu: Okuma, Antrenman veya Su Hedefi tamamlandığında bağlı alışkanlıkları işaretle
async function autoCompleteLinkedHabits(
  userId: string | undefined,
  linkedModule: 'reading' | 'workout' | 'water',
  dateStr?: string
) {
  if (!userId) return;
  try {
    await initDatabase();
    const targetDate = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : getTodayTurkeyDate();
    const linkedHabits = await db
      .select()
      .from(habits)
      .where(and(eq(habits.user_id, userId), eq(habits.linked_module, linkedModule), eq(habits.is_archived, 0)));

    if (!Array.isArray(linkedHabits) || linkedHabits.length === 0) return;
    const now = new Date().toISOString();

    for (const h of linkedHabits) {
      if (!h || h.linked_module !== linkedModule) continue;
      const existing = (
        await db
          .select()
          .from(habitLogs)
          .where(and(eq(habitLogs.habit_id, h.id), eq(habitLogs.date, targetDate)))
          .limit(1)
      )[0];

      if (existing) {
        if (existing.is_completed !== 1) {
          await db
            .update(habitLogs)
            .set({ is_completed: 1, value: h.target_value, updated_at: now })
            .where(eq(habitLogs.id, existing.id));
        }
      } else {
        await db.insert(habitLogs).values({
          id: `hlog-auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          habit_id: h.id,
          user_id: userId,
          date: targetDate,
          value: h.target_value,
          is_completed: 1,
          created_at: now,
          updated_at: now
        });
      }
    }
  } catch (err) {
    console.error(`[EventBus Error - Habit AutoComplete ${linkedModule}]:`, err);
  }
}

eventBus.subscribe(EVENTS.READING_SESSION_COMPLETED, async (data: any) => {
  await autoCompleteLinkedHabits(data?.userId || data?.user_id, 'reading', data?.date);
});

eventBus.subscribe(EVENTS.WORKOUT_COMPLETED, async (data: any) => {
  await autoCompleteLinkedHabits(data?.userId || data?.user_id, 'workout', data?.date);
});

eventBus.subscribe(EVENTS.WATER_GOAL_REACHED, async (data: any) => {
  await autoCompleteLinkedHabits(data?.userId || data?.user_id, 'water', data?.date);
});
