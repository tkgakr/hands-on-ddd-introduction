# CatalogService

## ローカル開発環境

### データベースの起動

```bash
docker compose up -d
```

`docker compose up` 実行時には、PostgreSQL の起動完了後に `src/Infrastructure/SQL/migrations/` 配下の起動対象 migration が自動で実行されます。

初回起動時は migration 用コンテナ内で依存関係のインストールも行うため、完了まで少し時間がかかる場合があります。

### ソースのビルド

```bash
npx tsc --noEmit
```

### テストの実行

通常のテストは、PostgreSQL を起動せずに実行できます。SQL 統合テストはスキップされます。

```bash
npm test
```

PostgreSQL 実装を使う SQL 統合テストは、テスト専用 DB コンテナを自動で起動して実行します。

```bash
npm run test:sql
```

このコマンドは `docker-compose.test.yml` を使い、`catalogservice_test` データベースを `localhost:15432` で起動します。migration 実行後に `src/Infrastructure/SQL` と `src/Presentation/Express/app.test.ts` を実行し、終了時にテスト用コンテナと volume を削除します。

テスト用 DB のリセット処理には安全弁があり、`NODE_ENV=test` かつ `DB_NAME` が `_test` で終わる場合にのみ `TRUNCATE` を実行します。既存のローカル開発用 DB (`localdb`) は対象外です。

### Webサーバ(Express)の起動

```bash
npx ts-node src/Presentation/Express/index.ts
```

### データベースの停止（ボリュームごと削除）

```bash
docker compose down -v
```

データを保持したまま停止する場合は `-v` を付けずに `docker compose down` を実行してください。

### APIのテスト

[requests.http](requests.http) に各エンドポイントのリクエスト例をまとめています。

VS Code の [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) 拡張をインストールすると、ファイル内の `Send Request` リンクからリクエストを直接送信できます。
