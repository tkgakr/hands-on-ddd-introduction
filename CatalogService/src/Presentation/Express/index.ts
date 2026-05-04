// Reflectのポリフィルをcontainer.resolveされる前に一度読み込む必要がある
import "reflect-metadata";
import { container } from "tsyringe";

import { CatalogServiceEventHandler } from "Application/DomainEventHandlers/CatalogServiceEventHandler";
import { PendingEventsPublisher } from "Application/EventStore/PendingEventsPublisher";

import "../../Program";
import app from "./app";

const port = 3000;

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
  // サブスクライバーを登録
  container.resolve(CatalogServiceEventHandler).register();
  // 未発行イベントの発行を開始
  container.resolve(PendingEventsPublisher).start();
});
