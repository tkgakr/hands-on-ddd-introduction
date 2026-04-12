export interface IDomainEventSubscriber {
  subscribe(
    topic: string,
    callback: (event: Record<string, unknown>) => void,
  ): void;
}
