import { inject, injectable } from "tsyringe";

import { IDomainEventSubscriber } from "Application/shared/DomainEvent/IDomainEventSubscriber";

@injectable()
export class CatalogServiceEventHandler {
  constructor(
    @inject("IDomainEventSubscriber")
    private subscriber: IDomainEventSubscriber,
  ) {}

  register() {
    this.subscriber.subscribe(
      "CatalogService",
      (event: Record<string, unknown>) => {
        this.handleDomainEvent(event);
      },
    );
  }

  private handleDomainEvent(event: Record<string, unknown>) {
    // イベントタイプに応じた処理の実装例
    switch (event.eventType) {
      case "ReviewCreated": {
        const body = event.eventBody as {
          reviewId: string;
          bookId: string;
          name: string;
          rating: number;
          comment?: string;
        };
        console.log(
          `新しいレビューが作成されました。レビューID: ${event.aggregateId}, 書籍ID: ${body.bookId}`,
        );

        // 例：レビュー投稿者にポイントを付与
        break;
      }
      // 他のイベントタイプに対する処理もここに追加可能
    }
  }
}
