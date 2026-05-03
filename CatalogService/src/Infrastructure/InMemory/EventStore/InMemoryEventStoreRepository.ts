import { Aggregate } from "Domain/shared/Aggregate";
import { ConcurrencyError } from "Domain/shared/DomainEvent/ConcurrencyError";
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

  async store(
    aggregate: Aggregate<DomainEvent>,
    expectedVersion?: number,
  ): Promise<void> {
    const domainEvents = aggregate.getDomainEvents();
    if (domainEvents.length === 0) {
      aggregate.clearDomainEvents();
      return;
    }

    const firstEvent = domainEvents[0]!;
    const isSingleStream = domainEvents.every(
      (event) =>
        event.aggregateId === firstEvent.aggregateId &&
        event.aggregateType === firstEvent.aggregateType,
    );
    if (!isSingleStream) {
      throw new Error(
        "一度の append で複数 aggregate のイベントは保存できません",
      );
    }

    const resolvedExpectedVersion = expectedVersion ?? firstEvent.version - 1;
    const currentVersion = this.events
      .filter(
        (event) =>
          event.aggregateId === firstEvent.aggregateId &&
          event.aggregateType === firstEvent.aggregateType,
      )
      .reduce((maxVersion, event) => Math.max(maxVersion, event.version), 0);

    if (currentVersion !== resolvedExpectedVersion) {
      throw new ConcurrencyError(
        firstEvent.aggregateId,
        firstEvent.aggregateType,
        resolvedExpectedVersion,
        currentVersion,
      );
    }

    for (let index = 0; index < domainEvents.length; index++) {
      const event = domainEvents[index]!;
      const expectedEventVersion = resolvedExpectedVersion + index + 1;
      if (event.version !== expectedEventVersion) {
        throw new Error(
          `append するイベントの version が連続していません: expected=${expectedEventVersion} actual=${event.version}`,
        );
      }
    }

    for (const event of domainEvents) {
      const isDuplicateVersion = this.events.some(
        (storedEvent) =>
          storedEvent.aggregateId === event.aggregateId &&
          storedEvent.aggregateType === event.aggregateType &&
          storedEvent.version === event.version,
      );

      if (isDuplicateVersion) {
        throw new Error("同一 aggregate の version が重複しています");
      }

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
