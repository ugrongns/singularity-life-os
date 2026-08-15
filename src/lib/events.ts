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
