import {
  RegisterBookCommand,
  RegisterBookService,
} from "Application/Book/RegisterBookService/RegisterBookService";
import {
  AddReviewCommand,
  AddReviewService,
} from "Application/Review/AddReviewService/AddReviewService";
import {
  GetRecommendedBooksCommand,
  GetRecommendedBooksService,
} from "Application/Review/GetRecommendedBooksService/GetRecommendedBooksService";
import express, { json, Response } from "express";
import { SQLBookRepository } from "Infrastructure/SQL/Book/SQLBookRepository";
import { SQLReviewRepository } from "Infrastructure/SQL/Review/SQLReviewRepository";
import { SQLClientManager } from "Infrastructure/SQL/SQLClientManager";
import { SQLTransactionManager } from "Infrastructure/SQL/SQLTransactionManager";
import {
  EditReviewCommand,
  EditReviewService,
} from "Application/Review/EditReviewService/EditReviewService";
import {
  DeleteReviewCommand,
  DeleteReviewService,
} from "Application/Review/DeleteReviewService/DeleteReviewService";

const app = express();
const port = 3000;

app.use(json());

const clientManager = new SQLClientManager();
const transactionManager = new SQLTransactionManager(clientManager);
const bookRepository = new SQLBookRepository(clientManager);
const reviewRepository = new SQLReviewRepository(clientManager);

const isStr = (v: any): v is string => typeof v === "string" && v.length > 0;
const isNum = (v: any): v is number => typeof v === "number" && !isNaN(v);
const invalid = (res: Response) =>
  res.status(400).json({ ok: false, message: "Invalid request" });

// 中核ユースケース: レビュー内容から推薦書籍を取得
app.get("/book/:isbn/recommendations", async (req, res) => {
  try {
    const { isbn } = req.params;
    const { maxCount } = req.query;

    if (!isStr(isbn)) return invalid(res);
    if (maxCount && isNaN(Number(maxCount))) return invalid(res);

    const service = new GetRecommendedBooksService(reviewRepository);
    const command: GetRecommendedBooksCommand = {
      bookId: isbn,
      maxCount: maxCount ? Number(maxCount) : undefined,
    };

    const recommendedBooks = await service.execute(command);
    res.status(200).json({ ok: true, recommendedBooks });
  } catch {
    res.status(500).json({ ok: false });
  }
});

// 書籍登録
app.post("/book", async (req, res) => {
  try {
    const { isbn, title, author, price } = req.body;

    if (!isStr(isbn) || !isStr(title) || !isStr(author) || !isNum(price)) {
      return invalid(res);
    }

    const service = new RegisterBookService(bookRepository, transactionManager);
    const command: RegisterBookCommand = { isbn, title, author, price };
    const book = await service.execute(command);

    res.status(201).json({ ok: true, book });
  } catch {
    res.status(500).json({ ok: false });
  }
});

// レビュー投稿
app.post("/book/:isbn/review", async (req, res) => {
  try {
    const { isbn } = req.params;
    const { name, rating, comment } = req.body;

    if (!isStr(isbn) || !isStr(name) || !isNum(rating)) return invalid(res);
    // 空文字はOK, 数値, 真偽値, オブジェクト, 配列は NG
    if (comment && !isStr(comment)) return invalid(res);

    const service = new AddReviewService(
      reviewRepository,
      bookRepository,
      transactionManager,
    );
    const command: AddReviewCommand = { bookId: isbn, name, rating, comment };
    const review = await service.execute(command);

    res.status(201).json({ ok: true, review });
  } catch {
    res.status(500).json({ ok: false });
  }
});

// レビュー編集
app.put("/review/:reviewId", async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { name, rating, comment } = req.body;

    if (!isStr(reviewId)) return invalid(res);
    // ここでチェックしているのは文字列として正しいかだけで、空文字でも通る。
    // (桁数チェックはドメイン層にて)
    if (name && !isStr(name)) return invalid(res);
    if (rating && !isNum(rating)) return invalid(res);
    if (comment && !isStr(comment)) return invalid(res);

    const service = new EditReviewService(reviewRepository, transactionManager);
    const command: EditReviewCommand = { reviewId, name, rating, comment };
    const review = await service.execute(command);

    res.status(200).json({ ok: true, review });
  } catch {
    res.status(500).json({ ok: false });
  }
});

// レビュー削除
app.delete("/review/:reviewId", async (req, res) => {
  try {
    const { reviewId } = req.params;
    if (!isStr(reviewId)) return invalid(res);

    const service = new DeleteReviewService(
      reviewRepository,
      transactionManager,
    );
    const command: DeleteReviewCommand = { reviewId };
    await service.execute(command);

    res.status(204).end();
  } catch {
    res.status(500).json({ ok: false });
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
