jest.mock("nanoid", () => ({
  nanoid: () => "testIdWithExactLength",
}));

describe("ReviewId", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test("デフォルトの値でReviewIdを生成する", async () => {
    // setupJest.ts 経由で ReviewId が先に評価されるため、モック適用後の状態で
    // 再読込できるように各テスト内で動的 import している。
    const { ReviewId } = await import("./ReviewId");
    const reviewId = new ReviewId();
    expect(reviewId.value).toBe("testIdWithExactLength");
  });

  test("指定された値でReviewIdを生成する", async () => {
    const { ReviewId } = await import("./ReviewId");
    const value = "customId";
    const reviewId = new ReviewId(value);
    expect(reviewId.value).toBe(value);
  });

  test("最小長以下の値でReviewIdを生成するとエラーを投げる", async () => {
    const { ReviewId } = await import("./ReviewId");
    const shortValue = "";
    expect(() => new ReviewId(shortValue)).toThrowError(
      new Error(
        `ReviewIdは${ReviewId.MIN_LENGTH}文字以上、${ReviewId.MAX_LENGTH}文字以下でなければなりません。`
      )
    );
  });

  test("最大長以上の値でReviewIdを生成するとエラーを投げる", async () => {
    const { ReviewId } = await import("./ReviewId");
    const longValue = "a".repeat(ReviewId.MAX_LENGTH + 1);
    expect(() => new ReviewId(longValue)).toThrowError(
      new Error(
        `ReviewIdは${ReviewId.MIN_LENGTH}文字以上、${ReviewId.MAX_LENGTH}文字以下でなければなりません。`
      )
    );
  });
});
