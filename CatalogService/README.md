# CatalogService

## ローカル開発環境

### データベースの起動

```bash
docker compose up -d
```

`docker compose up` 実行時には、PostgreSQL の起動完了後に migration が自動で実行されます。

初回起動時は migration 用コンテナ内で依存関係のインストールも行うため、完了まで少し時間がかかる場合があります。

### ソースのビルド

```bash
npx tsc --noEmit
```

### テストの実行

```bash
npx jest
```

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
