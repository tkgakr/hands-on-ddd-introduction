import pool from "Infrastructure/SQL/db";

const assertTestDatabase = (): void => {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("SQL test database reset requires NODE_ENV=test.");
  }

  if (!process.env.DB_NAME?.endsWith("_test")) {
    throw new Error(
      "SQL test database reset requires DB_NAME to end with _test.",
    );
  }
};

export const resetSQLTestDatabase = async (): Promise<void> => {
  assertTestDatabase();

  await pool.query('TRUNCATE TABLE "Event", "Book" RESTART IDENTITY CASCADE');
};

export const closeSQLTestDatabase = async (): Promise<void> => {
  await pool.end();
};
