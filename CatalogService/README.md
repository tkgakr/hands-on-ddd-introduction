# CatalogService

## ローカル開発環境

### データベースの起動

```bash
docker compose up -d
```

### Webサーバ(Express)の起動

```bash
npx ts-node src/Presentation/Express/index.ts
```

### APIのテスト

[requests.http](requests.http) に各エンドポイントのリクエスト例をまとめています。

VS Code の [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) 拡張をインストールすると、ファイル内の `Send Request` リンクからリクエストを直接送信できます。
