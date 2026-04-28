import { container } from "tsyringe";

import { AddReviewService } from "Application/Review/AddReviewService/AddReviewService";
import { DeleteReviewService } from "Application/Review/DeleteReviewService/DeleteReviewService";
import { EditReviewService } from "Application/Review/EditReviewService/EditReviewService";
import { BookId } from "Domain/models/Book/BookId/BookId";
import { Author } from "Domain/models/Book/Author/Author";
import { Book } from "Domain/models/Book/Book";
import { BookIdentity } from "Domain/models/Book/BookIdentity/BookIdentity";
import { Price } from "Domain/models/Book/Price/Price";
import { Title } from "Domain/models/Book/Title/Title";
import { Comment } from "Domain/models/Review/Comment/Comment";
import { Name } from "Domain/models/Review/Name/Name";
import { Rating } from "Domain/models/Review/Rating/Rating";
import { Review } from "Domain/models/Review/Review";
import { ReviewId } from "Domain/models/Review/ReviewId/ReviewId";
import { ReviewIdentity } from "Domain/models/Review/ReviewIdentity/ReviewIdentity";
import { InMemoryBookRepository } from "Infrastructure/InMemory/Book/InMemoryBookRepository";
import { InMemoryEventStoreRepository } from "Infrastructure/InMemory/EventStore/InMemoryEventStoreRepository";
import { registerTestDependencies } from "TestProgram";

import { GetRecommendedBooksDTO } from "./GetRecommendedBooksDTO";
import {
  GetRecommendedBooksCommand,
  GetRecommendedBooksService,
} from "./GetRecommendedBooksService";

describe("GetRecommendedBooksService", () => {
  let bookRepository: InMemoryBookRepository;
  let eventStoreRepository: InMemoryEventStoreRepository;
  let addReviewService: AddReviewService;
  let editReviewService: EditReviewService;
  let deleteReviewService: DeleteReviewService;
  let getRecommendedBooksService: GetRecommendedBooksService;

  beforeEach(async () => {
    registerTestDependencies();
    bookRepository = container.resolve(InMemoryBookRepository);
    eventStoreRepository = container.resolve(InMemoryEventStoreRepository);
    addReviewService = container.resolve(AddReviewService);
    editReviewService = container.resolve(EditReviewService);
    deleteReviewService = container.resolve(DeleteReviewService);
    getRecommendedBooksService = container.resolve(GetRecommendedBooksService);
  });

  const createBook = async (bookId: string, title: string = "テスト書籍") => {
    const book = Book.create(
      new BookIdentity(
        new BookId(bookId),
        new Title(title),
        new Author("テスト著者"),
      ),
      new Price({
        amount: 3000,
        currency: "JPY",
      }),
    );

    await bookRepository.save(book);

    return book;
  };

  test("書籍IDから推薦書籍のリストを取得できる", async () => {
    const targetBookId = "9784814400737";

    // 信頼できるレビューを作成（高い評価とコメント）
    const review1 = Review.create(
      new ReviewIdentity(new ReviewId("review-1")),
      new BookId(targetBookId),
      new Name("レビュアー1"),
      new Rating(5),
      new Comment(
        "この本は素晴らしい！前提知識として『実践ドメイン駆動設計』が必要です。",
      ),
    );
    const review2 = Review.create(
      new ReviewIdentity(new ReviewId("review-2")),
      new BookId(targetBookId),
      new Name("レビュアー2"),
      new Rating(4),
      new Comment(
        "『エリック・エヴァンスのドメイン駆動設計』を先に読むことを推奨します。理解が深まります。",
      ),
    );
    const review3 = Review.create(
      new ReviewIdentity(new ReviewId("review-3")),
      new BookId(targetBookId),
      new Name("レビュアー3"),
      new Rating(5),
      new Comment(
        "『実践ドメイン駆動設計』の内容を理解してからこの本を読むと良いです。",
      ),
    );

    await eventStoreRepository.store(review1);
    await eventStoreRepository.store(review2);
    await eventStoreRepository.store(review3);

    const command: GetRecommendedBooksCommand = {
      bookId: targetBookId,
      maxCount: 1,
    };

    const result = await getRecommendedBooksService.execute(command);

    expect(result).toEqual<GetRecommendedBooksDTO>({
      sourceBookId: command.bookId,
      recommendedBooks: ["実践ドメイン駆動設計"],
    });
  });

  test("AddReviewService で投稿したレビューが推薦取得に反映される", async () => {
    const bookId = "9784798126708";
    await createBook(bookId);

    await addReviewService.execute({
      bookId,
      name: "レビュアー1",
      rating: 5,
      comment:
        "この本を読む前に『実践ドメイン駆動設計』を読むと理解しやすく、おすすめです。",
    });

    const result = await getRecommendedBooksService.execute({
      bookId,
      maxCount: 3,
    });

    expect(result).toEqual<GetRecommendedBooksDTO>({
      sourceBookId: bookId,
      recommendedBooks: ["実践ドメイン駆動設計"],
    });
  });

  test("EditReviewService でコメントを変更した後、変更後コメントに基づく推薦結果になる", async () => {
    const bookId = "9784798126708";
    await createBook(bookId);

    const addedReview = await addReviewService.execute({
      bookId,
      name: "レビュアー1",
      rating: 5,
      comment:
        "この本の前に『リファクタリング』を読むと理解が深まり、おすすめです。",
    });

    await editReviewService.execute({
      reviewId: addedReview.id,
      comment:
        "この本の前に『実践ドメイン駆動設計』を読むと理解が深まり、おすすめです。",
    });

    const result = await getRecommendedBooksService.execute({
      bookId,
      maxCount: 3,
    });

    expect(result).toEqual<GetRecommendedBooksDTO>({
      sourceBookId: bookId,
      recommendedBooks: ["実践ドメイン駆動設計"],
    });
  });

  test("EditReviewService で評価を変更した後、変更後評価に基づいて信頼度判定される", async () => {
    const bookId = "9784798126708";
    await createBook(bookId);

    const addedReview = await addReviewService.execute({
      bookId,
      name: "レビュアー1",
      rating: 2,
      comment:
        "この本の前に『実践ドメイン駆動設計』を読むと理解が深まり、おすすめです。",
    });

    const beforeEdit = await getRecommendedBooksService.execute({
      bookId,
      maxCount: 3,
    });

    expect(beforeEdit).toEqual<GetRecommendedBooksDTO>({
      sourceBookId: bookId,
      recommendedBooks: [],
    });

    await editReviewService.execute({
      reviewId: addedReview.id,
      rating: 5,
    });

    const afterEdit = await getRecommendedBooksService.execute({
      bookId,
      maxCount: 3,
    });

    expect(afterEdit).toEqual<GetRecommendedBooksDTO>({
      sourceBookId: bookId,
      recommendedBooks: ["実践ドメイン駆動設計"],
    });
  });

  test("DeleteReviewService で削除したレビューは推薦結果から消える", async () => {
    const bookId = "9784798126708";
    await createBook(bookId);

    const addedReview = await addReviewService.execute({
      bookId,
      name: "レビュアー1",
      rating: 5,
      comment:
        "この本の前に『実践ドメイン駆動設計』を読むと理解が深まり、おすすめです。",
    });

    const beforeDelete = await getRecommendedBooksService.execute({
      bookId,
      maxCount: 3,
    });

    expect(beforeDelete).toEqual<GetRecommendedBooksDTO>({
      sourceBookId: bookId,
      recommendedBooks: ["実践ドメイン駆動設計"],
    });

    await deleteReviewService.execute({
      reviewId: addedReview.id,
    });

    const afterDelete = await getRecommendedBooksService.execute({
      bookId,
      maxCount: 3,
    });

    expect(afterDelete).toEqual<GetRecommendedBooksDTO>({
      sourceBookId: bookId,
      recommendedBooks: [],
    });
  });

  test("書籍IDに対するレビューがない場合は空の配列を返す", async () => {
    const command: GetRecommendedBooksCommand = {
      bookId: "9784798126708",
    };

    const result = await getRecommendedBooksService.execute(command);

    expect(result).toEqual<GetRecommendedBooksDTO>({
      sourceBookId: command.bookId,
      recommendedBooks: [],
    });
  });
});
