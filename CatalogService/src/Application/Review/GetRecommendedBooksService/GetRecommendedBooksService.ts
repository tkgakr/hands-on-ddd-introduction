import { injectable, inject } from "tsyringe";

import { BookId } from "Domain/models/Book/BookId/BookId";
import { IReviewQueryRepository } from "Domain/models/Review/IReviewQueryRepository";
import { BookRecommendationDomainService } from "Domain/services/Review/BookRecommendationDomainService/BookRecommendationDomainService";

import { GetRecommendedBooksDTO } from "./GetRecommendedBooksDTO";

export type GetRecommendedBooksCommand = {
  bookId: string;
  maxCount?: number;
};

@injectable()
export class GetRecommendedBooksService {
  private bookRecommendationService: BookRecommendationDomainService;

  constructor(
    @inject("IReviewQueryRepository")
    private reviewQueryRepository: IReviewQueryRepository,
  ) {
    this.bookRecommendationService = new BookRecommendationDomainService();
  }

  async execute(
    command: GetRecommendedBooksCommand,
  ): Promise<GetRecommendedBooksDTO> {
    const bookId = new BookId(command.bookId);
    const reviews = await this.reviewQueryRepository.findAllByBookId(bookId);

    // ドメインサービスを利用して推薦書籍を計算
    const recommendedBooks =
      this.bookRecommendationService.calculateTopRecommendedBooks(
        reviews,
        command.maxCount,
      );

    return {
      sourceBookId: bookId.value,
      recommendedBooks: recommendedBooks,
    };
  }
}
