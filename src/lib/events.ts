// Singularity Modüler Monolit Internal Event Bus
import { db, initDatabase } from '@/db';
import { 
  transactions, categories, walletsAccounts, 
  vehicles, vehicleMaintenanceRecords, 
  nutritionMeals, userHealthProfile 
} from '@/db/schema';
import { eq, sql, and, gte, lte } from 'drizzle-orm';

type EventCallback<T = any> = (data: T) => void | Promise<void>;

class EventBus {
  private listeners: Map<string, EventCallback[]> = new Map();

  // Olay Dinleyici Ekleme
  subscribe<T>(event: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);

    // Unsubscribe fonksiyonu
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        this.listeners.set(event, callbacks.filter(cb => cb !== callback));
      }
    };
  }

  // Olay Yayma (Emit / Publish)
  async emit<T>(event: string, data: T): Promise<void> {
    const callbacks = this.listeners.get(event) || [];
    for (const callback of callbacks) {
      try {
        await callback(data);
      } catch (error) {
        console.error(`[EventBus] "${event}" olayı işlenirken hata oluştu:`, error);
      }
    }
  }
}

export const eventBus = new EventBus();

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
    initDatabase();
    if (!data.category_id || !data.amount) return;

    const catList = await db.select().from(categories).where(eq(categories.id, data.category_id));
    const cat = catList[0];
    if (!cat || !cat.monthly_budget_limit || cat.monthly_budget_limit <= 0) return;

    // Bu ayın toplam harcamasını hesapla
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const monthlyTxs = await db.select()
      .from(transactions)
      .where(
        and(
          eq(transactions.category_id, cat.id),
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
    initDatabase();
    if (!data.vehicle_id) return;

    const km = Number(data.km || data.km_at_service) || 0;
    if (km > 0) {
      const vehList = await db.select().from(vehicles).where(eq(vehicles.id, data.vehicle_id));
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
    initDatabase();
    const today = new Date().toISOString().split('T')[0];
    const todayMeals = await db.select().from(nutritionMeals).where(eq(nutritionMeals.date, today));
    const totalCal = todayMeals.reduce((s, m) => s + (m.calories || 0), 0);
    const totalPro = todayMeals.reduce((s, m) => s + (m.protein_g || 0), 0);

    const profile = (await db.select().from(userHealthProfile).limit(1))[0];
    const targetCal = profile?.daily_calorie_target || 2200;
    const calPercent = Math.round((totalCal / targetCal) * 100);

    console.log(`[EventBus] 🥗 Günlük beslenme güncellendi: ${totalCal}/${targetCal} kcal (%${calPercent}) - Protein: ${totalPro}g`);
  } catch (err) {
    console.error('[EventBus Error - DIET_MEAL_RECORDED]:', err);
  }
});
