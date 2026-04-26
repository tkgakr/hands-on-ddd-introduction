import { BookId } from "Domain/models/Book/BookId/BookId";
import { Comment } from "Domain/models/Review/Comment/Comment";
import { Name } from "Domain/models/Review/Name/Name";
import { Rating } from "Domain/models/Review/Rating/Rating";
import { Review } from "Domain/models/Review/Review";
import { ReviewId } from "Domain/models/Review/ReviewId/ReviewId";
import { ReviewIdentity } from "Domain/models/Review/ReviewIdentity/ReviewIdentity";
import pool from "../db";
import { SQLEventStoreRepository } from "../EventStore/SQLEventStoreRepository";
import { SQLClientManager } from "../SQLClientManager";
import { SQLEventSourcedReviewQueryRepository } from "./SQLEventSourcedReviewQueryRepository";

const clientManager = new SQLClientManager();
const eventStoreRepository = new SQLEventStoreRepository(clientManager);
const reviewQueryRepository = new SQLEventSourcedReviewQueryRepository(clientManager);

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
      const review = createSampleReview("review-1", targetBookId, "更新前の名前");

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
      const review = createSampleReview("review-1", targetBookId, "山田太郎", 2);

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
  });
});
