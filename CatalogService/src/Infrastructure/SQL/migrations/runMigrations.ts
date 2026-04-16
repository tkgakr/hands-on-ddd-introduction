import { promises as fs } from "fs";
import path from "path";
import { PoolClient } from "pg";

import pool from "../db";

async function runMigration(client: PoolClient, fileName: string) {
  const sqlFile = path.join(__dirname, fileName);
  const sql = await fs.readFile(sqlFile, "utf8");

  await client.query(sql);
}

async function runMigrations(fileNames: string[]) {
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const fileName of fileNames) {
        await runMigration(client, fileName);
      }
      await client.query("COMMIT");
      console.log("Database migration completed successfully");
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("Migration failed:", e);
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    console.error("Error running migrations:", e);
    throw e;
  }
}

// スクリプト直接実行時にマイグレーションを実行
if (require.main === module) {
  const fileNames = process.argv.slice(2);
  if (fileNames.length === 0) {
    console.error("Please specify at least one migration file");
    process.exit(1);
  }

  runMigrations(fileNames)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export default runMigrations;
