import request from "supertest";

import {
  closeSQLTestDatabase,
  resetSQLTestDatabase,
} from "TestSupport/SQLTestDatabase";
import { registerSQLTestDependencies } from "TestSupport/SQLTestProgram";

import app from "./app";

const describeSQL =
  process.env.RUN_SQL_TESTS === "true" ? describe : describe.skip;

describeSQL("Express API", () => {
  const book = {
    isbn: "9784814400737",
    title: "ドメイン駆動設計を始めよう",
    author: "Vlad Khononov",
    price: 3960,
  };

  beforeEach(async () => {
    registerSQLTestDependencies();
    await resetSQLTestDatabase();
  });

  afterAll(async () => {
    await closeSQLTestDatabase();
  });

  test("レビュー投稿後、推薦取得で投稿内容由来の推薦が返る", async () => {
    await request(app).post("/book").send(book).expect(201);

    await request(app)
      .post(`/book/${book.isbn}/review`)
      .send({
        name: "山田太郎",
        rating: 5,
        comment:
          "素晴らしい本でした。『実践ドメイン駆動設計』を先に読むことを推奨します。",
      })
      .expect(201);

    await request(app)
      .get(`/book/${book.isbn}/recommendations`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          ok: true,
          recommendedBooks: {
            sourceBookId: book.isbn,
            recommendedBooks: ["実践ドメイン駆動設計"],
          },
        });
      });
  });

  test("レビュー編集後、推薦取得が編集後コメントを反映する", async () => {
    await request(app).post("/book").send(book).expect(201);

    const addReviewResponse = await request(app)
      .post(`/book/${book.isbn}/review`)
      .send({
        name: "山田太郎",
        rating: 5,
        comment:
          "素晴らしい本でした。『実践ドメイン駆動設計』を先に読むことを推奨します。",
      })
      .expect(201);

    const reviewId = addReviewResponse.body.review.id;

    await request(app)
      .put(`/review/${reviewId}`)
      .send({
        comment:
          "素晴らしい本でした。『エリック・エヴァンスのドメイン駆動設計』を先に読むことを推奨します。",
      })
      .expect(200);

    await request(app)
      .get(`/book/${book.isbn}/recommendations`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          ok: true,
          recommendedBooks: {
            sourceBookId: book.isbn,
            recommendedBooks: ["エリック・エヴァンスのドメイン駆動設計"],
          },
        });
      });
  });

  test("レビュー削除後、推薦取得から該当レビューの推薦が消える", async () => {
    await request(app).post("/book").send(book).expect(201);

    const addReviewResponse = await request(app)
      .post(`/book/${book.isbn}/review`)
      .send({
        name: "山田太郎",
        rating: 5,
        comment:
          "素晴らしい本でした。『実践ドメイン駆動設計』を先に読むことを推奨します。",
      })
      .expect(201);

    const reviewId = addReviewResponse.body.review.id;

    await request(app).delete(`/review/${reviewId}`).expect(204);

    await request(app)
      .get(`/book/${book.isbn}/recommendations`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          ok: true,
          recommendedBooks: {
            sourceBookId: book.isbn,
            recommendedBooks: [],
          },
        });
      });
  });
});
