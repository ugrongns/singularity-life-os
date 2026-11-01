/**
 * @deprecated ATIL DOSYA TEMİZLENDİ: Tüm domain ve monolit event bus omurgası @/lib/events altında konsolide edilmiştir.
 * Geriye dönük uyumluluk için @/lib/events re-export edilmektedir.
 */
export { domainEventBus, eventBus, EVENTS, EventBus } from './events';
export type { DomainEvent } from './events';
