import {
  GetRecommendedBooksCommand,
  GetRecommendedBooksService,
} from "Application/Review/GetRecommendedBooksService/GetRecommendedBooksService";
import express, { json, Response } from "express";
import { SQLBookRepository } from "Infrastructure/SQL/Book/SQLBookRepository";
import { SQLReviewRepository } from "Infrastructure/SQL/Review/SQLReviewRepository";
import { SQLClientManager } from "Infrastructure/SQL/SQLClientManager";
import { SQLTransactionManager } from "Infrastructure/SQL/SQLTransactionManager";

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
