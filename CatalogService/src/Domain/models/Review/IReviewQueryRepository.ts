import { BookId } from "../Book/BookId/BookId";
import { Review } from "./Review";

export interface IReviewQueryRepository {
  findAllByBookId(bookId: BookId): Promise<Review[]>;
}
