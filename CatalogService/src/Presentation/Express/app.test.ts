import request from "supertest";

import { registerTestDependencies } from "TestProgram";

import app from "./app";

describe("Express API", () => {
  beforeEach(() => {
    registerTestDependencies();
  });

  test("レビュー投稿後、推薦取得で投稿内容由来の推薦が返る", async () => {
    const isbn = "9784814400737";

    await request(app)
      .post("/book")
      .send({
        isbn,
        title: "ドメイン駆動設計を始めよう",
        author: "Vlad Khononov",
        price: 3960,
      })
      .expect(201);

    await request(app)
      .post(`/book/${isbn}/review`)
      .send({
        name: "山田太郎",
        rating: 5,
        comment:
          "素晴らしい本でした。『実践ドメイン駆動設計』を先に読むことを推奨します。",
      })
      .expect(201);

    await request(app)
      .get(`/book/${isbn}/recommendations`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          ok: true,
          recommendedBooks: {
            sourceBookId: isbn,
            recommendedBooks: ["実践ドメイン駆動設計"],
          },
        });
      });
  });
});
