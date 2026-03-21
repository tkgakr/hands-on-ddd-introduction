import { ITransactionManager } from 'Application/shared/ITransactionManager';

import { SQLClientManager } from './SQLClientManager';

export class SQLTransactionManager implements ITransactionManager {
  constructor(private readonly clientManager: SQLClientManager) {}

  async begin<T>(callback: () => Promise<T>): Promise<T> {
    const existingClient = this.clientManager.getClient();
    if (existingClient) {
      return await callback();
    }

    const client = await this.clientManager.getConnection();
    try {
      // クライアントをコンテキストにセットしてコールバックを実行
      return await this.clientManager.runWithClient(client, async () => {
        try {
          // トランザクション開始
          await client.query("BEGIN");

          const result = await callback();

          // トランザクションをコミット
          await client.query("COMMIT");
          return result;
        } catch (error) {
          // エラー時はロールバック
          await client.query("ROLLBACK");
          throw error;
        }
      });
    } finally {
      // スコープを抜けたら確実にリリース
      client.release();
    }
  }
}
