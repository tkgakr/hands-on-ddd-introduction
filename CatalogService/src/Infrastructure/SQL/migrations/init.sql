-- Currency列挙型の作成
DO $$
BEGIN
  CREATE TYPE "Currency" AS ENUM ('JPY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Bookテーブルの作成
CREATE TABLE IF NOT EXISTS "Book" (
  "bookId" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "author" TEXT NOT NULL,
  "priceAmount" DECIMAL(10, 2) NOT NULL,
  "priceCurrency" "Currency" NOT NULL DEFAULT 'JPY'
);