import { BookId } from "Domain/models/Book/BookId/BookId";
import { Comment } from "Domain/models/Review/Comment/Comment";
import { Name } from "Domain/models/Review/Name/Name";
import { Rating } from "Domain/models/Review/Rating/Rating";
import { Review } from "Domain/models/Review/Review";
import { ReviewId } from "Domain/models/Review/ReviewId/ReviewId";
import { ReviewIdentity } from "Domain/models/Review/ReviewIdentity/ReviewIdentity";
import { Aggregate } from "Domain/shared/Aggregate";
import { ConcurrencyError } from "Domain/shared/DomainEvent/ConcurrencyError";
import { DomainEvent } from "Domain/shared/DomainEvent/DomainEvent";
import pool from "../db";
import { SQLEventStoreRepository } from "../EventStore/SQLEventStoreRepository";
import { SQLClientManager } from "../SQLClientManager";
import { SQLEventSourcedReviewQueryRepository } from "./SQLEventSourcedReviewQueryRepository";

/**
 * Aggregate.addDomainEvent の version 自動採番をバイパスして version を直指定するためのテストヘルパー
 */
class TestAggregate extends Aggregate<DomainEvent> {
  constructor(events: DomainEvent[]) {
    super();
    this.domainEvents = events;
  }
}

const clientManager = new SQLClientManager();
const eventStoreRepository = new SQLEventStoreRepository(clientManager);
const reviewQueryRepository = new SQLEventSourcedReviewQueryRepository(
  clientManager,
);

describe("SQLEventSourcedReviewQueryRepository", () => {
  const targetBookId = new BookId("9784798126708");
  const otherBookId = new BookId("9780132350884");

  beforeEach(async () => {
    await pool.query("BEGIN");
    await pool.query('DELETE FROM "Event"');
    await pool.query("COMMIT");
  });

  afterAll(async () => {
    await pool.end();
  });

  const createSampleReview = (
    reviewId: string,
    bookId: BookId = targetBookId,
    name: string = "テストユーザー",
    rating: number = 5,
    commentText?: string,
  ): Review => {
    const comment = commentText ? new Comment(commentText) : undefined;

    return Review.create(
      new ReviewIdentity(new ReviewId(reviewId)),
      bookId,
      new Name(name),
      new Rating(rating),
      comment,
    );
  };

  const createStoredReviewEvent = (
    eventId: string,
    aggregateId: string,
    eventType: string,
    eventBody: Record<string, unknown>,
    version: number,
    occurredOn: Date,
  ): DomainEvent => {
    return DomainEvent.reconstruct(
      eventId,
      aggregateId,
      "Review",
      eventType,
      eventBody,
      version,
      occurredOn,
      null,
    );
  };

  const insertStoredReviewEvents = async (
    events: DomainEvent[],
  ): Promise<void> => {
    for (const event of events) {
      await pool.query(
        `
          INSERT INTO "Event" (
            "eventId",
            "aggregateId",
            "aggregateType",
            "eventType",
            "eventBody",
            "version",
            "occurredOn",
            "publishedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          event.eventId,
          event.aggregateId,
          event.aggregateType,
          event.eventType,
          JSON.stringify(event.eventBody),
          event.version,
          event.occurredOn,
          event.publishedAt,
        ],
      );
    }
  };

  const wait = async (): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 2));
  };

  describe("findAllByBookId", () => {
    test("ReviewCreated イベントだけがある場合、指定 bookId の Review が返る", async () => {
      const review = createSampleReview(
        "review-1",
        targetBookId,
        "山田太郎",
        5,
        "とても良い本でした。",
      );

      await eventStoreRepository.store(review);

      const reviews = await reviewQueryRepository.findAllByBookId(targetBookId);

      expect(reviews).toHaveLength(1);
      expect(reviews[0]?.reviewId.value).toBe("review-1");
      expect(reviews[0]?.bookId.equals(targetBookId)).toBeTruthy();
      expect(reviews[0]?.name.value).toBe("山田太郎");
      expect(reviews[0]?.rating.value).toBe(5);
      expect(reviews[0]?.comment?.value).toBe("とても良い本でした。");
    });

    test("別 bookId の Review は返らない", async () => {
      const targetReview = createSampleReview("review-1", targetBookId);
      const otherReview = createSampleReview("review-2", otherBookId);

      await eventStoreRepository.store(targetReview);
      await eventStoreRepository.store(otherReview);

      const reviews = await reviewQueryRepository.findAllByBookId(targetBookId);

      expect(reviews).toHaveLength(1);
      expect(reviews[0]?.reviewId.value).toBe("review-1");
      expect(reviews[0]?.bookId.equals(targetBookId)).toBeTruthy();
    });

    test("複数 Review が同じ bookId にある場合、すべて返る", async () => {
      const review1 = createSampleReview("review-1", targetBookId, "山田太郎");
      const review2 = createSampleReview("review-2", targetBookId, "佐藤花子");
      const review3 = createSampleReview("review-3", targetBookId, "鈴木一郎");

      await eventStoreRepository.store(review1);
      await eventStoreRepository.store(review2);
      await eventStoreRepository.store(review3);

      const reviews = await reviewQueryRepository.findAllByBookId(targetBookId);
      const reviewIds = reviews
        .map((review) => review.reviewId.value)
        .sort((a, b) => a.localeCompare(b));

      expect(reviews).toHaveLength(3);
      expect(reviewIds).toEqual(["review-1", "review-2", "review-3"]);
    });

    test("ReviewNameUpdated が反映された最新の名前で返る", async () => {
      const review = createSampleReview(
        "review-1",
        targetBookId,
        "更新前の名前",
      );

      await eventStoreRepository.store(review);
      // 実行順序を保証するためwait(TODO: STEP5 で対応)
      await wait();
      review.updateName(new Name("更新後の名前"));
      await eventStoreRepository.store(review);

      const reviews = await reviewQueryRepository.findAllByBookId(targetBookId);

      expect(reviews).toHaveLength(1);
      expect(reviews[0]?.name.value).toBe("更新後の名前");
    });

    test("ReviewRatingUpdated が反映された最新の評価で返る", async () => {
      const review = createSampleReview(
        "review-1",
        targetBookId,
        "山田太郎",
        2,
      );

      await eventStoreRepository.store(review);
      // 実行順序を保証するためwait(TODO: STEP5 で対応)
      await wait();
      review.updateRating(new Rating(5));
      await eventStoreRepository.store(review);

      const reviews = await reviewQueryRepository.findAllByBookId(targetBookId);

      expect(reviews).toHaveLength(1);
      expect(reviews[0]?.rating.value).toBe(5);
    });

    test("ReviewCommentEdited が反映された最新のコメントで返る", async () => {
      const review = createSampleReview(
        "review-1",
        targetBookId,
        "山田太郎",
        5,
        "編集前コメント",
      );

      await eventStoreRepository.store(review);
      // 実行順序を保証するためwait(TODO: STEP5 で対応)
      await wait();
      review.editComment(new Comment("編集後コメント"));
      await eventStoreRepository.store(review);

      const reviews = await reviewQueryRepository.findAllByBookId(targetBookId);

      expect(reviews).toHaveLength(1);
      expect(reviews[0]?.comment?.value).toBe("編集後コメント");
    });

    test("再構築は occurredOn ではなく version 順で行われる", async () => {
      const aggregateId = "review-1";
      await insertStoredReviewEvents([
        createStoredReviewEvent(
          "review-1-v2",
          aggregateId,
          "ReviewNameUpdated",
          {
            name: "更新後の名前",
          },
          2,
          new Date("2024-01-01T00:00:00.000Z"),
        ),
        createStoredReviewEvent(
          "review-1-v1",
          aggregateId,
          "ReviewCreated",
          {
            reviewId: aggregateId,
            bookId: targetBookId.value,
            name: "更新前の名前",
            rating: 5,
            comment: "初期コメント",
          },
          1,
          new Date("2024-01-02T00:00:00.000Z"),
        ),
      ]);

      const reviews = await reviewQueryRepository.findAllByBookId(targetBookId);

      expect(reviews).toHaveLength(1);
      expect(reviews[0]?.name.value).toBe("更新後の名前");
    });

    test("ReviewDeleted まで含む Review は返らない", async () => {
      const deletedReview = createSampleReview("review-1", targetBookId);
      const activeReview = createSampleReview("review-2", targetBookId);

      await eventStoreRepository.store(deletedReview);
      // 実行順序を保証するためwait(TODO: STEP5 で対応)
      await wait();
      deletedReview.delete();
      await eventStoreRepository.store(deletedReview);
      await eventStoreRepository.store(activeReview);

      const reviews = await reviewQueryRepository.findAllByBookId(targetBookId);

      expect(reviews).toHaveLength(1);
      expect(reviews[0]?.reviewId.value).toBe("review-2");
    });

    test("ReviewNameUpdated と ReviewDeleted が同時刻でも version 順により削除済みとして扱われる", async () => {
      const sameOccurredOn = new Date("2024-01-01T00:00:00.000Z");
      const deletedAggregateId = "review-1";
      const activeAggregateId = "review-2";

      await insertStoredReviewEvents([
        createStoredReviewEvent(
          "review-1-v3",
          deletedAggregateId,
          "ReviewDeleted",
          {},
          3,
          sameOccurredOn,
        ),
        createStoredReviewEvent(
          "review-1-v2",
          deletedAggregateId,
          "ReviewNameUpdated",
          {
            name: "更新後の名前",
          },
          2,
          sameOccurredOn,
        ),
        createStoredReviewEvent(
          "review-1-v1",
          deletedAggregateId,
          "ReviewCreated",
          {
            reviewId: deletedAggregateId,
            bookId: targetBookId.value,
            name: "元の名前",
            rating: 5,
          },
          1,
          sameOccurredOn,
        ),
        createStoredReviewEvent(
          "review-2-v1",
          activeAggregateId,
          "ReviewCreated",
          {
            reviewId: activeAggregateId,
            bookId: targetBookId.value,
            name: "残るレビュー",
            rating: 4,
          },
          1,
          sameOccurredOn,
        ),
      ]);

      const reviews = await reviewQueryRepository.findAllByBookId(targetBookId);

      expect(reviews).toHaveLength(1);
      expect(reviews[0]?.reviewId.value).toBe(activeAggregateId);
    });
  });

  describe("store", () => {
    test("同一 version の重複 append はエラーになる", async () => {
      const aggregateId = "review-1";
      const originalReview = createSampleReview(aggregateId, targetBookId);
      const duplicateVersionEvent = createStoredReviewEvent(
        "review-1-duplicate-v1",
        aggregateId,
        "ReviewNameUpdated",
        {
          name: "重複 version のイベント",
        },
        1,
        new Date("2024-01-03T00:00:00.000Z"),
      );

      await eventStoreRepository.store(originalReview);

      await expect(
        eventStoreRepository.store(new TestAggregate([duplicateVersionEvent])),
      ).rejects.toBeInstanceOf(ConcurrencyError);
    });

    test("version 1 の Review を2回読み込み、片方を保存した後、もう片方の保存は競合エラーになる", async () => {
      const aggregateId = "review-1";
      const review = createSampleReview(aggregateId, targetBookId);

      await eventStoreRepository.store(review, 0);

      const firstLoadedReview = await eventStoreRepository.find(
        aggregateId,
        "Review",
        Review.reconstruct,
      );
      const secondLoadedReview = await eventStoreRepository.find(
        aggregateId,
        "Review",
        Review.reconstruct,
      );

      expect(firstLoadedReview).not.toBeNull();
      expect(secondLoadedReview).not.toBeNull();

      const firstExpectedVersion = firstLoadedReview!.version;
      firstLoadedReview!.updateName(new Name("先に保存された名前"));
      await eventStoreRepository.store(
        firstLoadedReview!,
        firstExpectedVersion,
      );

      const secondExpectedVersion = secondLoadedReview!.version;
      secondLoadedReview!.updateRating(new Rating(1));

      await expect(
        eventStoreRepository.store(secondLoadedReview!, secondExpectedVersion),
      ).rejects.toBeInstanceOf(ConcurrencyError);
    });

    test("新規 Review は expectedVersion 0 で保存できる", async () => {
      const review = createSampleReview("review-1", targetBookId);

      await eventStoreRepository.store(review, 0);

      const storedReview = await eventStoreRepository.find(
        "review-1",
        "Review",
        Review.reconstruct,
      );
      expect(storedReview?.version).toBe(1);
    });

    test("既存 Review の更新は現在 version と expectedVersion が一致する場合だけ保存できる", async () => {
      const aggregateId = "review-1";
      const review = createSampleReview(aggregateId, targetBookId);

      await eventStoreRepository.store(review, 0);

      const loadedReview = await eventStoreRepository.find(
        aggregateId,
        "Review",
        Review.reconstruct,
      );
      expect(loadedReview).not.toBeNull();

      const expectedVersion = loadedReview!.version;
      loadedReview!.updateName(new Name("更新後の名前"));

      await eventStoreRepository.store(loadedReview!, expectedVersion);

      const updatedReview = await eventStoreRepository.find(
        aggregateId,
        "Review",
        Review.reconstruct,
      );
      expect(updatedReview?.version).toBe(2);
      expect(updatedReview?.name.value).toBe("更新後の名前");
    });

    test("SQL transaction 内でも競合時に一方だけが成功する", async () => {
      const aggregateId = "review-1";
      const review = createSampleReview(aggregateId, targetBookId);

      await eventStoreRepository.store(review, 0);

      const firstLoadedReview = await eventStoreRepository.find(
        aggregateId,
        "Review",
        Review.reconstruct,
      );
      const secondLoadedReview = await eventStoreRepository.find(
        aggregateId,
        "Review",
        Review.reconstruct,
      );

      expect(firstLoadedReview).not.toBeNull();
      expect(secondLoadedReview).not.toBeNull();

      const expectedVersion = 1;
      firstLoadedReview!.updateName(new Name("並行更新1"));
      secondLoadedReview!.updateRating(new Rating(2));

      const results = await Promise.allSettled([
        eventStoreRepository.store(firstLoadedReview!, expectedVersion),
        eventStoreRepository.store(secondLoadedReview!, expectedVersion),
      ]);

      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        results.filter((result) => result.status === "rejected"),
      ).toHaveLength(1);

      const storedReview = await eventStoreRepository.find(
        aggregateId,
        "Review",
        Review.reconstruct,
      );
      expect(storedReview?.version).toBe(2);
    });
  });
});
