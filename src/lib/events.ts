// Singularity Modüler Monolit Internal Event Bus
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
  RENT_COLLECTED: 'realestate:rent_collected',
  DIVIDEND_RECORDED: 'investment:dividend_recorded',
  DIET_MEAL_RECORDED: 'health:meal_recorded',
  BACKUP_REQUESTED: 'system:backup_requested',
};

// Modüler Monolit Domain Dinleyicileri (Core Subscribers)
eventBus.subscribe(EVENTS.TRANSACTION_CREATED, async (data: any) => {
  try {
    console.log(`[EventBus] 💳 İşlem kaydedildi: ${data.merchant || 'Harcama'} (${data.amount} TL) - Cüzdan: ${data.wallet_id}`);
  } catch (err) {
    console.error('[EventBus Error - TRANSACTION_CREATED]:', err);
  }
});

eventBus.subscribe(EVENTS.VEHICLE_MAINTENANCE_RECORDED, async (data: any) => {
  try {
    console.log(`[EventBus] 🚗 Araç bakımı işlendi: Araç ID ${data.vehicle_id}, KM: ${data.km}, Maliyet: ${data.cost} TL`);
  } catch (err) {
    console.error('[EventBus Error - VEHICLE_MAINTENANCE_RECORDED]:', err);
  }
});

eventBus.subscribe(EVENTS.RENT_COLLECTED, async (data: any) => {
  try {
    console.log(`[EventBus] 🏠 Kira tahsil edildi: Mülk ${data.property_id}, Tutar: ${data.amount} TL, Cüzdan: ${data.wallet_id}`);
  } catch (err) {
    console.error('[EventBus Error - RENT_COLLECTED]:', err);
  }
});

eventBus.subscribe(EVENTS.DIVIDEND_RECORDED, async (data: any) => {
  try {
    console.log(`[EventBus] 📈 Temettü işlendi: Varlık ${data.asset_id}, Tutar: ${data.total_amount} TL, Tür: ${data.treatment_type}`);
  } catch (err) {
    console.error('[EventBus Error - DIVIDEND_RECORDED]:', err);
  }
});

eventBus.subscribe(EVENTS.DIET_MEAL_RECORDED, async (data: any) => {
  try {
    console.log(`[EventBus] 🥗 Öğün günlüğü güncellendi: ${data.name || 'Öğün'} (${data.calories || 0} kcal)`);
  } catch (err) {
    console.error('[EventBus Error - DIET_MEAL_RECORDED]:', err);
  }
});


