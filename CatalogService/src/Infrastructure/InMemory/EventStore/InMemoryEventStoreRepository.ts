import { Aggregate } from "Domain/shared/Aggregate";
import { DomainEvent } from "Domain/shared/DomainEvent/DomainEvent";
import { IEventStoreRepository } from "Domain/shared/DomainEvent/IEventStoreRepository";

export class InMemoryEventStoreRepository implements IEventStoreRepository {
  private events: DomainEvent[] = [];

  async find<T extends Aggregate<DomainEvent>>(
    aggregateId: string,
    aggregateType: string,
    reconstruct: (events: T["domainEvents"]) => T | null,
  ): Promise<T | null> {
    // 指定された集約IDと集約タイプに一致するイベントをフィルタリング
    const filteredEvents = this.events.filter(
      (event) =>
        event.aggregateId === aggregateId &&
        event.aggregateType === aggregateType,
    );

    if (filteredEvents.length === 0) {
      return null;
    }

    // イベントをバージョンでソート
    const sortedEvents = filteredEvents.sort((a, b) => a.version - b.version);

    // 再構築関数を使用して集約を生成
    return reconstruct(sortedEvents as T["domainEvents"]);
  }

  async findPendingEvents(): Promise<DomainEvent[]> {
    return this.events.filter((event) => event.publishedAt === null);
  }

  async store(aggregate: Aggregate<DomainEvent>): Promise<void> {
    const domainEvents = aggregate.getDomainEvents();
    for (const event of domainEvents) {
      this.events.push(event);
    }
    aggregate.clearDomainEvents();
  }

  async markAsPublished(event: DomainEvent): Promise<void> {
    const storedEvent = this.events.find((e) => e.eventId === event.eventId);
    if (storedEvent) {
      storedEvent.publish();
    }
  }
}
