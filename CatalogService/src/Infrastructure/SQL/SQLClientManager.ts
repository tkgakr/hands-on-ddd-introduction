import { AsyncLocalStorage } from "async_hooks";
import { PoolClient } from "pg";

import pool from "./db";

export class SQLClientManager {
  // コンテキスト（現在の接続）を保持するストレージ
  private asyncLocalStorage = new AsyncLocalStorage<PoolClient>();

  /**
   * 現在のコンテキストにあるクライアントを取得する
   */
  getClient(): PoolClient | undefined {
    return this.asyncLocalStorage.getStore();
  }

  /**
   * トランザクションマネージャー用
   * 指定されたクライアントをコンテキストにセットして callback を実行する
   */
  runWithClient<T>(client: PoolClient, callback: () => Promise<T>): Promise<T> {
    return this.asyncLocalStorage.run(client, callback);
  }

  /**
   * プールから新しい接続を直接取得する（TransactionManager用）
   */
  async getConnection(): Promise<PoolClient> {
    return await pool.connect();
  }

  /**
   * リポジトリ用
   * トランザクション中ならその接続を、そうでなければ一時的な接続を使用してSQLを実行する
   */
  async withClient<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    // 1. 既にトランザクション内（コンテキストあり）なら、それを使う
    const existingClient = this.getClient();
    if (existingClient) {
      return await callback(existingClient);
    }

    // 2. コンテキストがないなら、一時的な接続を取得・実行・解放する
    const client = await this.getConnection();
    try {
      return await callback(client);
    } finally {
      client.release();
    }
  }
}
