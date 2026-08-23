/**
 * Singularity Life OS — Internal Event Bus
 * Çapraz modül veri senkronizasyonu için tip güvenli, hata toleranslı olay omurgası.
 * (Dual-Ledger Ingestion: Yakıt fişi -> Araç defteri + Bütçe harcaması vb.)
 */

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
    };

type EventHandler<T extends DomainEvent> = (event: T) => Promise<void> | void;

class EventBus {
  private handlers: Map<string, EventHandler<any>[]> = new Map();

  /**
   * Olay dinleyicisi kaydet
   */
  subscribe<T extends DomainEvent>(eventType: T['type'], handler: EventHandler<T>): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);

    // Unsubscribe callback
    return () => {
      const list = this.handlers.get(eventType);
      if (list) {
        this.handlers.set(eventType, list.filter(h => h !== handler));
      }
    };
  }

  /**
   * Olay yayınla (Tüm dinleyicileri izole hata yönetimiyle tetikle)
   */
  async dispatch<T extends DomainEvent>(event: T): Promise<void> {
    const list = this.handlers.get(event.type) || [];
    const promises = list.map(async handler => {
      try {
        await handler(event);
      } catch (err) {
        console.error(`[EventBus Error] Event ${event.type} işlenirken hata oluştu:`, err);
      }
    });
    await Promise.allSettled(promises);
  }
}

// Global Singleton Event Bus Instance
export const domainEventBus = new EventBus();
