import { BookId } from "Domain/models/Book/BookId/BookId";
import { IReviewQueryRepository } from "Domain/models/Review/IReviewQueryRepository";
import { Review } from "Domain/models/Review/Review";

export class InMemoryEventSourcedReviewQueryRepository implements IReviewQueryRepository {
  async findAllByBookId(_bookId: BookId): Promise<Review[]> {
    const bookReviews: Review[] = [];
    // TODO: 実装
    return bookReviews;
  }
}
