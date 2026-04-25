import { injectable } from "tsyringe";

import { BookId } from "Domain/models/Book/BookId/BookId";
import { IReviewQueryRepository } from "Domain/models/Review/IReviewQueryRepository";
import { Review } from "Domain/models/Review/Review";
import { SQLClientManager } from "../SQLClientManager";

@injectable()
export class SQLEventSourcedReviewQueryRepository implements IReviewQueryRepository {
  constructor(private clientManager: SQLClientManager) {}

  async findAllByBookId(_bookId: BookId): Promise<Review[]> {
    return await this.clientManager.withClient(async (_client) => {
      // TODO: 実装
      return [];
    });
  }
}
