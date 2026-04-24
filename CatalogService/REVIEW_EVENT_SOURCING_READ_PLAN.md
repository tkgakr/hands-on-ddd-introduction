# Review 集約のイベントソーシング読取り対応計画

## 目的

書籍の範囲では、Review 集約の書き込みは Event テーブルへの append に寄せたが、読取りがまだ Review テーブル前提で残っている。

この計画では、学習用プロジェクトとしてイベントソーシングの流れを明確にするため、まずは **読み取り専用インターフェースを切り、実装はイベント再生で行う** 方針を採用し、実装の続きを行う。

将来的に CQRS の Read model を追加する場合も、同じ読み取り専用インターフェースの実装差し替えで移行できる形にする。

## 採用方針

### 方針

`IReviewRepository` を Review 集約の永続化口として使い続けるのではなく、推薦取得などの読取り用途には読み取り専用の Query Repository を導入する。

最初の実装は Event テーブルから Review 関連イベントを取得し、Review 集約を再構築して返す。

```ts
interface IReviewQueryRepository {
  findAllByBookId(bookId: BookId): Promise<Review[]>;
}
```

### このプロジェクトでの理由

- Review の読取り用途は現状 `GetRecommendedBooksService` が中心である。
- 推薦計算は `Review.isTrustworthy()` と `Review.extractRecommendedBooks()` に依存しており、ドメインモデルを再構築して使う方が自然である。
- CQRS Read model を先に作ると、projector、冪等性、projection 遅延、整合性方針まで必要になり、学習対象が広がりすぎる。
- Query Repository を挟めば、後から CQRS Read model 実装へ差し替えやすい。

## 完了条件

- `GetRecommendedBooksService` が Review テーブルではなく、イベントから再構築された Review を使う。
- レビュー投稿後、推薦取得 API が同じ Review を参照できる。
- 編集後のレビュー内容が推薦取得に反映される。
- 削除済みレビューは推薦取得から除外される。
- SQL の読取りで `Review.create()` を使って未保存イベントを生成する経路がなくなる。
- イベント再生順が安定している。
- TypeScript の型チェックと Jest テストが通る。

## 対応ステップ

## Step 1: 読み取り専用インターフェースを追加する

### 目的

アプリケーションサービスが `IReviewRepository` に依存している状態を解消し、書き込み系 Repository と読み取り系 Query Repository を分ける。

### 実装方針

- `Domain/models/Review/IReviewQueryRepository.ts` を追加する。
- メソッドはまず `findAllByBookId(bookId: BookId): Promise<Review[]>` のみにする。
- `GetRecommendedBooksService` の依存を `IReviewRepository` から `IReviewQueryRepository` に変更する。
- DI 登録に `"IReviewQueryRepository"` を追加する。

### テストリスト

- [ ] `GetRecommendedBooksService` が `IReviewQueryRepository` から取得したレビューを使って推薦書籍を返す。
- [ ] `GetRecommendedBooksService` が `IReviewRepository` ではなく `IReviewQueryRepository` に依存していることが分かる。
- [ ] `IReviewQueryRepository` が空配列を返した場合、推薦書籍は空配列になる。

### 実装のヒント

- 既存の `GetRecommendedBooksService.test.ts` を `InMemoryReviewQueryRepository` または簡易 fake で通す。
- テスト内で private property を覗く形はできればやめ、DI コンテナまたは明示的な fake で依存を差し替える。
- `IReviewRepository` の読み取り用途が残っていないか `rg "IReviewRepository|findAllByBookId"` で確認する。

## Step 2: イベントストアに Review 読取り用クエリを追加する

### 目的

指定された bookId に紐づく Review 集約を、Event テーブルから探して再構築できるようにする。

### 実装方針

学習用として、最初は次の単純な流れでよい。

1. `ReviewCreated` かつ `eventBody.bookId = 指定 bookId` のイベントを取得する。
2. 取得した `aggregateId` ごとに Review の全イベントを読み込む。
3. `Review.reconstruct(events)` で集約を再構築する。
4. `ReviewDeleted` 済みで `null` になったものは除外する。

SQL 実装では JSONB 条件を使う。

```sql
WHERE "aggregateType" = 'Review'
  AND "eventType" = 'ReviewCreated'
  AND "eventBody"->>'bookId' = $1
```

### テストリスト

- [ ] `ReviewCreated` イベントだけがある場合、指定 bookId の Review が返る。
- [ ] 別 bookId の Review は返らない。
- [ ] 複数 Review が同じ bookId にある場合、すべて返る。
- [ ] `ReviewNameUpdated` が反映された最新の名前で返る。
- [ ] `ReviewRatingUpdated` が反映された最新の評価で返る。
- [ ] `ReviewCommentEdited` が反映された最新のコメントで返る。
- [ ] `ReviewDeleted` まで含む Review は返らない。

### 実装のヒント

- `InMemoryEventStoreRepository` または新しい `InMemoryReviewQueryRepository` で上記を最小実装する。
- SQL のクエリ実装は、単体テストしやすい範囲で `SQLEventSourcedReviewQueryRepository` として分離する。
- `eventType` 文字列の重複が気になる場合だけ、Review イベント型や factory 側から参照しやすい定数化を検討する。
- ただし学習用なので、過剰な抽象化は避ける。

## Step 3: GetRecommendedBooksService をイベント再生ベースに接続する

### 目的

レビュー投稿、編集、削除の結果が推薦取得に反映されるようにする。

### 実装方針

- `GetRecommendedBooksService` は `IReviewQueryRepository.findAllByBookId()` から Review を取得する。
- 本番 DI では `"IReviewQueryRepository"` に `SQLEventSourcedReviewQueryRepository` を登録する。
- テスト DI では `"IReviewQueryRepository"` にイベント再生できるインメモリ実装を登録する。

### テストリスト

- [ ] `AddReviewService` でレビュー投稿した後、`GetRecommendedBooksService` で推薦書籍が返る。
- [ ] `EditReviewService` でコメントを変更した後、推薦結果が変更後コメントに基づく。
- [ ] `EditReviewService` で評価を変更した後、信頼度判定が変更後評価に基づく。
- [ ] `DeleteReviewService` で削除したレビューは推薦結果から消える。
- [ ] 対象 bookId にレビューが存在しない場合、推薦書籍は空配列になる。

### 実装のヒント

- アプリケーションサービスの結合テストをインメモリイベントストアで通す。
- 既存の `InMemoryReviewRepository` をテストから外せるなら外す。
- `TestProgram.ts` の DI 登録を、書き込み用と読み取り用で明確に分ける。

## Step 4: SQLReviewRepository の責務を整理する

### 目的

SQL の読取りで `Review.create()` が呼ばれ、未保存イベントが生成される危険をなくす。

### 実装方針

以下のどちらかを選ぶ。

### 推奨: SQLReviewRepository を Review 集約用途から外す

- `GetRecommendedBooksService` が使わなくなったら、`SQLReviewRepository` を DI から外す。
- 使われなくなった `save/update/delete/findById/findAllByBookId` は削除候補にする。
- すぐ削除しない場合も、コメントで legacy repository であることを明示する。

### 代替: Read model 専用に改名する

- `SQLReviewRepository` を `SQLReviewReadModelRepository` のように改名する。
- 返す型は `Review` ではなく DTO にする。
- `Review.create()` は使わない。

### テストリスト

- [ ] SQL 行から Review を読むだけで `getDomainEvents()` が増えない。
- [ ] `SQLReviewRepository.toDomain()` を使う実運用経路がなくなる。
- [ ] `Review.create()` は新規 Review 作成時だけ使われる。
- [ ] 推薦取得が `SQLReviewRepository.findAllByBookId()` に依存していない。

### 実装のヒント

- 推奨方針で repository を外す場合、1つ目のテストは削除ではなく「不要になった危険経路の確認」として一時的に使う。
- `rg "SQLReviewRepository|Review.create"` で危険な読取り変換が残っていないことを確認する。
- `IReviewRepository` が不要なら削除する。
- 教材として残すなら、イベントソーシング移行前の repository であることを README かコメントに残す。

## Step 5: イベント順序を安定させる

### 目的

イベント再生順が `occurredOn` だけに依存している状態を解消する。

### 実装方針

- Event テーブルに stream version を追加する。
- 同一 aggregate stream 内で version が単調増加するようにする。
- 再生時は `ORDER BY "version" ASC` にする。

例:

```sql
ALTER TABLE "Event" ADD COLUMN "version" INTEGER;
CREATE UNIQUE INDEX "Event_aggregate_version_idx"
  ON "Event"("aggregateId", "aggregateType", "version");
```

既存データがある場合は、`aggregateId + aggregateType` ごとに `occurredOn` 順で version を埋める migration が必要になる。

### テストリスト

- [ ] 同一 aggregate に複数イベントを保存すると version が 1, 2, 3 と増える。
- [ ] 再構築は `occurredOn` ではなく version 順で行われる。
- [ ] 同一 version の重複 append はエラーになる。
- [ ] `ReviewNameUpdated` と `ReviewDeleted` が同時刻でも、version 順により削除済みとして扱われる。

### 実装のヒント

- InMemory 実装でも version を持つ形に合わせる。
- SQL 実装では unique index で重複を防ぐ。
- `DomainEvent` に version を持たせるか、永続化レイヤだけの概念にするかを決める。
- 学習用には `DomainEvent` に `version` を持たせた方が流れを追いやすい。

## Step 6: append 時の競合制御を追加する

### 目的

同じ Review を同時編集した場合に、想定しないイベント列が混ざることを防ぐ。

### 実装方針

- 集約が「読み込まれた時点の version」を保持する。
- `eventStoreRepository.store(aggregate)` ではなく、期待 version を使う append にする。
- SQL では transaction 内で現在の最大 version を確認し、期待値と一致する場合のみ INSERT する。

候補:

```ts
store(aggregate: Aggregate<DomainEvent>, expectedVersion: number): Promise<void>;
```

または Aggregate に version を持たせる。

```ts
aggregate.version
aggregate.getDomainEvents()
```

### テストリスト

- [ ] version 1 の Review を2回読み込み、片方を保存した後、もう片方の保存は競合エラーになる。
- [ ] 新規 Review は expectedVersion 0 で保存できる。
- [ ] 既存 Review の更新は現在 version と expectedVersion が一致する場合だけ保存できる。
- [ ] 削除済み Review に対する追加更新はできない。
- [ ] SQL transaction 内でも競合時に一方だけが成功する。

### 実装のヒント

- InMemoryEventStoreRepository で競合検知を実装してから SQL 実装へ進む。
- エラー型を `ConcurrencyError` のように明示するか検討する。
- アプリケーションサービス側で競合エラーをどう扱うかは、この段階では再 throw でよい。

## Step 7: API レベルの動作確認を追加する

### 目的

実際のユースケースとして、投稿、推薦取得、編集、削除がイベントソーシング読取りでつながっていることを確認する。

### テストリスト

- [ ] 書籍登録後、レビュー投稿し、推薦取得で投稿内容由来の推薦が返る。
- [ ] レビュー編集後、推薦取得が編集後コメントを反映する。
- [ ] レビュー削除後、推薦取得から該当レビューの推薦が消える。
- [ ] SQL 実装でレビュー投稿後に推薦取得へ反映される。
- [ ] SQL 実装でレビュー編集後に推薦取得へ反映される。
- [ ] SQL 実装でレビュー削除後に推薦取得から除外される。

### 実装のヒント

- まずはアプリケーションサービス結合テストで通す。
- 余力があれば Express endpoint のテストを追加する。
- API の catch がすべて 500 を返しているため、必要なら後続タスクで 400/404/409 を分ける。
- この計画の主目的ではないため、同時に広げすぎない。

## 実装順序の推奨

1. `IReviewQueryRepository` を追加する。
2. `GetRecommendedBooksService` の依存を `IReviewQueryRepository` に変える。
3. インメモリのイベント再生 Query Repository を作る。
4. 投稿後に推薦取得できる結合テストを追加する。
5. SQL のイベント再生 Query Repository を作る。
6. `SQLReviewRepository.toDomain()` 経路を外す。
7. Event に version を追加する。
8. append 時の expectedVersion 競合制御を追加する。
9. 削除、編集、同時更新のテストを足す。
10. README に Review 集約のイベントソーシング構成を追記する。

## 手作業実装時のチェックリスト

- `GetRecommendedBooksService` は `IReviewRepository` に依存していない。
- `Program.ts` に `"IReviewQueryRepository"` の登録がある。
- `TestProgram.ts` に `"IReviewQueryRepository"` の登録がある。
- `Review` テーブルを読まなくても推薦取得が動く。
- `SQLReviewRepository.toDomain()` が実運用経路から外れている。
- `Review.create()` は新規作成時だけ使われている。
- `Review.reconstruct()` 後の `getDomainEvents()` は空である。
- `ReviewDeleted` 後の replay は `null` を返し、query result から除外される。
- Event replay は version 順である。
- append 競合時に検知できる。

## 実行コマンド

```bash
cd CatalogService
npx tsc --noEmit
npx jest --runInBand
```

SQL integration test を確認する場合:

```bash
cd CatalogService
docker compose up -d
npx jest --runInBand src/Infrastructure/SQL
```

## 後続で CQRS Read model に移行する条件

以下のいずれかが出てきたら、CQRS Read model を追加する価値がある。

- Review 数が増え、毎回イベント再生する推薦取得が遅くなった。
- Review 一覧、検索、集計など、集約再構築より SQL の方が自然な読取りが増えた。
- projection 遅延や eventually consistent な読取りを教材として扱いたくなった。
- 複数 bounded context へイベントを配信し、購読側の read model を育てる構成に進みたくなった。

その場合も `IReviewQueryRepository` は維持し、実装だけを `EventSourcedReviewQueryRepository` から `SQLReviewReadModelRepository` に差し替える。
