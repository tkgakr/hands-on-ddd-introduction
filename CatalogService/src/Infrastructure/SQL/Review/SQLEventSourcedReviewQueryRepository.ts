import { injectable } from "tsyringe";

import { BookId } from "Domain/models/Book/BookId/BookId";
import { IReviewQueryRepository } from "Domain/models/Review/IReviewQueryRepository";
import { Review } from "Domain/models/Review/Review";
import { reconstructReviewDomainEvent } from "Domain/shared/DomainEvent/Review/ReviewDomainEventFactory";
import { SQLClientManager } from "../SQLClientManager";
import { DomainEvent } from "Domain/shared/DomainEvent/DomainEvent";

@injectable()
export class SQLEventSourcedReviewQueryRepository implements IReviewQueryRepository {
  constructor(private clientManager: SQLClientManager) {}

  async findAllByBookId(bookId: BookId): Promise<Review[]> {
    return await this.clientManager.withClient(async (client) => {
      // 指定された本のレビューをEventStoreから取得する
      // 更新・削除には、bookId が含まれないため、作成イベントからaggregateIdを取得して絞り込む
      const query = `
        SELECT
          "eventId",
          "aggregateId",
          "aggregateType",
          "eventType",
          "eventBody",
          "occurredOn",
          "publishedAt"
        FROM "Event"
        WHERE "aggregateType" = 'Review'
          AND "aggregateId" IN (
            SELECT "aggregateId"
            FROM "Event"
            WHERE "aggregateType" = 'Review'
              AND "eventType" = 'ReviewCreated'
              AND "eventBody"->>'bookId' = $1
          )
        ORDER BY "occurredOn" ASC
      `;
      const result = await client.query(query, [bookId.value]);

      if (result.rows.length === 0) {
        return [];
      }

      const domainEvents = result.rows.map((row) =>
        DomainEvent.reconstruct(
          row.eventId,
          row.aggregateId,
          row.aggregateType,
          row.eventType,
          row.eventBody,
          row.occurredOn,
          row.publishedAt,
        ),
      );

      // ReviewId ごとにイベントをグループ化
      const reviewGroups = domainEvents.reduce((acc, event) => {
        if (!acc[event.aggregateId]) {
          acc[event.aggregateId] = [];
        }
        acc[event.aggregateId].push(event);
        return acc;
      }, {} as Record<string, DomainEvent[]>);
      // グループ化されたイベントからReviewオブジェクトを再構築
      const reviews: Review[] = [];
      for (const [_, events] of Object.entries(reviewGroups)) {
        const reviewEvents = events.map(reconstructReviewDomainEvent);
        const review = Review.reconstruct(reviewEvents);
        if (review) {
          reviews.push(review);
        }
      }
      
      return reviews;
    });
  }
}
