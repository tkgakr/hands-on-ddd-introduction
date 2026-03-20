import { BookId } from "Domain/models/Book/BookId/BookId";
import { Comment } from "Domain/models/Review/Comment/Comment";
import { IReviewRepository } from "Domain/models/Review/IReviewRepository";
import { Name } from "Domain/models/Review/Name/Name";
import { Rating } from "Domain/models/Review/Rating/Rating";
import { Review } from "Domain/models/Review/Review";
import { ReviewId } from "Domain/models/Review/ReviewId/ReviewId";
import { ReviewIdentity } from "Domain/models/Review/ReviewIdentity/ReviewIdentity";

import pool from "../db";

export class SQLReviewRepository implements IReviewRepository {
  // データベースの行からドメインオブジェクトへの変換
  private toDomain(row: any): Review {
    // コメントはnull/undefinedの場合があるので対応
    const comment = row.comment ? new Comment(row.comment) : undefined;

    return Review.reconstruct(
      new ReviewIdentity(new ReviewId(row.reviewId)),
      new BookId(row.bookId),
      new Name(row.name),
      new Rating(row.rating),
      comment,
    );
  }

  async save(review: Review): Promise<void> {
    const client = await pool.connect();
    try {
      const query = `
        INSERT INTO "Review" (
          "reviewId",
          "bookId",
          "name",
          "rating",
          "comment"
        ) VALUES ($1, $2, $3, $4, $5)
      `;

      const values = [
        review.reviewId.value,
        review.bookId.value,
        review.name.value,
        review.rating.value,
        review.comment?.value, // nullableなのでオプショナルチェーンを使用
      ];

      await client.query(query, values);
    } finally {
      client.release();
    }
  }

  async update(review: Review): Promise<void> {
    const client = await pool.connect();
    try {
      const query = `
        UPDATE "Review"
        SET "bookId" = $2,
            "name" = $3,
            "rating" = $4,
            "comment" = $5
        WHERE "reviewId" = $1
      `;

      const values = [
        review.reviewId.value,
        review.bookId.value,
        review.name.value,
        review.rating.value,
        review.comment?.value, // nullableなのでオプショナルチェーンを使用
      ];

      const result = await client.query(query, values);

      // 更新対象がない場合はエラー
      if (result.rowCount === 0) {
        throw new Error(
          `ID ${review.reviewId.value} のレビューが見つかりません`,
        );
      }
    } finally {
      client.release();
    }
  }

  async delete(reviewId: ReviewId): Promise<void> {
    const client = await pool.connect();
    try {
      const query = `
        DELETE FROM "Review"
        WHERE "reviewId" = $1
      `;

      await client.query(query, [reviewId.value]);
    } finally {
      client.release();
    }
  }

  async findById(reviewId: ReviewId): Promise<Review | null> {
    const client = await pool.connect();
    try {
      const query = `
        SELECT * FROM "Review"
        WHERE "reviewId" = $1
      `;

      const result = await client.query(query, [reviewId.value]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.toDomain(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async findAllByBookId(bookId: BookId): Promise<Review[]> {
    const client = await pool.connect();
    try {
      const query = `
        SELECT * FROM "Review"
        WHERE "bookId" = $1
      `;

      const result = await client.query(query, [bookId.value]);

      return result.rows.map((row) => this.toDomain(row));
    } finally {
      client.release();
    }
  }
}
