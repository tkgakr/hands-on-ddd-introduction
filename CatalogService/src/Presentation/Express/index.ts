import express, { json, Response } from "express";
// Reflectのポリフィルをcontainer.resolveされる前に一度読み込む必要がある
import "reflect-metadata";
import { container } from "tsyringe";

import {
  RegisterBookCommand,
  RegisterBookService,
} from "Application/Book/RegisterBookService/RegisterBookService";
import { CatalogServiceEventHandler } from "Application/DomainEventHandlers/CatalogServiceEventHandler";
import { PendingEventsPublisher } from "Application/EventStore/PendingEventsPublisher";
import {
  AddReviewCommand,
  AddReviewService,
} from "Application/Review/AddReviewService/AddReviewService";
import {
  DeleteReviewCommand,
  DeleteReviewService,
} from "Application/Review/DeleteReviewService/DeleteReviewService";
import {
  EditReviewCommand,
  EditReviewService,
} from "Application/Review/EditReviewService/EditReviewService";
import {
  GetRecommendedBooksCommand,
  GetRecommendedBooksService,
} from "Application/Review/GetRecommendedBooksService/GetRecommendedBooksService";

import "../../Program";

const app = express();
const port = 3000;

// JSON形式のリクエストボディを正しく解析するために必要
app.use(json());

const isStr = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0;
const isNum = (v: unknown): v is number => typeof v === "number" && !isNaN(v);
const invalid = (res: Response) =>
  res.status(400).json({ ok: false, message: "Invalid request" });

// 中核ユースケース: レビュー内容から推薦書籍を取得
app.get("/book/:isbn/recommendations", async (req, res) => {
  try {
    const { isbn } = req.params;
    const { maxCount } = req.query;

    if (!isStr(isbn)) return invalid(res);
    if (maxCount && isNaN(Number(maxCount))) return invalid(res);

    const getRecommendedBooksService = container.resolve(
      GetRecommendedBooksService,
    );

    const getRecommendedBooksCommand: GetRecommendedBooksCommand = {
      bookId: isbn,
      maxCount: maxCount ? Number(maxCount) : undefined,
    };

    const recommendedBooks = await getRecommendedBooksService.execute(
      getRecommendedBooksCommand,
    );

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

    const registerBookService = container.resolve(RegisterBookService);

    const registerBookCommand: RegisterBookCommand = {
      isbn,
      title,
      author,
      price,
    };
    const book = await registerBookService.execute(registerBookCommand);

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

    const addReviewService = container.resolve(AddReviewService);

    const addReviewCommand: AddReviewCommand = {
      bookId: isbn,
      name,
      rating,
      comment,
    };
    const review = await addReviewService.execute(addReviewCommand);

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
    // (桁数チェック等はドメイン層にて)
    if (name && !isStr(name)) return invalid(res);
    if (rating && !isNum(rating)) return invalid(res);
    if (comment && !isStr(comment)) return invalid(res);

    const editReviewService = container.resolve(EditReviewService);

    const editReviewCommand: EditReviewCommand = {
      reviewId,
      name,
      rating,
      comment,
    };
    const review = await editReviewService.execute(editReviewCommand);

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

    const deleteReviewService = container.resolve(DeleteReviewService);

    const deleteReviewCommand: DeleteReviewCommand = { reviewId };
    await deleteReviewService.execute(deleteReviewCommand);

    res.status(204).end();
  } catch {
    res.status(500).json({ ok: false });
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
  // サブスクライバーを登録
  container.resolve(CatalogServiceEventHandler).register();
  // 未発行イベントの発行を開始
  container.resolve(PendingEventsPublisher).start();
});
