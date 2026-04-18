import { inject, injectable } from "tsyringe";

import { IEventStoreRepository } from "Domain/shared/DomainEvent/IEventStoreRepository";

import { IDomainEventPublisher } from "../shared/DomainEvent/IDomainEventPublisher";

@injectable()
export class PendingEventsPublisher {
  private isRunning = false;
  private timeoutId: NodeJS.Timeout | null = null;
  private readonly POLLING_INTERVAL_MS = 5000;

  constructor(
    @inject("IEventStoreRepository")
    private eventStoreRepository: IEventStoreRepository,
    @inject("IDomainEventPublisher")
    private domainEventPublisher: IDomainEventPublisher
  ) {}

  /**
   * 定期実行を開始
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.scheduleNext();
  }

  /**
   * 定期実行を停止
   */
  stop(): void {
    this.isRunning = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  /**
   * 次の実行をスケジュール
   */
  private scheduleNext(): void {
    if (!this.isRunning) return;

    this.timeoutId = setTimeout(() => {
      this.publishPendingEvents().finally(() => {
        this.scheduleNext();
      });
    }, this.POLLING_INTERVAL_MS);
  }

  /**
   * 未発行イベントを発行
   */
  private async publishPendingEvents(): Promise<void> {
    try {
      const pendingEvents = await this.eventStoreRepository.findPendingEvents();
      if (pendingEvents.length === 0) return;

      for (const event of pendingEvents) {
        try {
          this.domainEventPublisher.publish(event);

          event.publish();
          await this.eventStoreRepository.markAsPublished(event);
        } catch (error) {
          console.error(`Failed to publish event ${event.eventId}:`, error);
          // 発行に失敗した場合 (ネットワークエラー、ブローカーダウン等)ループを即座に中断し、後続のイベントを処理しない。
          // これにより、イベントの順序性が保証される。
          // 次のインターバルで、この失敗したイベントから再試行される。
          break;
        }
      }
    } catch (error) {
      console.error("Error fetching pending events:", error);
    }
  }
}
