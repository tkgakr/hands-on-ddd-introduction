import { nanoid } from "nanoid";

export class DomainEvent<
  Type extends string = string,
  Body extends Record<string, unknown> = Record<string, unknown>,
> {
  private constructor(
    // ドメインイベントのID
    public readonly eventId: string,
    // 集約のID
    public readonly aggregateId: string,
    // 集約の種類
    public readonly aggregateType: string,
    // ドメインイベントの種類
    public readonly eventType: Type,
    // ドメインイベントの内容
    public readonly eventBody: Body,
    // ドメインイベントのバージョン
    private _version: number,
    // ドメインイベントの発生時刻
    public readonly occurredOn: Date,
    // ドメインイベントをパブリッシャーがパブリッシュした時刻
    public publishedAt: Date | null,
  ) {}

  get version(): number {
    return this._version;
  }

  static create<Type extends string, Body extends Record<string, unknown>>(
    aggregateId: string,
    aggregateType: string,
    eventType: Type,
    eventBody: Body,
  ): DomainEvent<Type, Body> {
    return new DomainEvent(
      nanoid(),
      aggregateId,
      aggregateType,
      eventType,
      eventBody,
      0,
      new Date(),
      null,
    );
  }

  static reconstruct<Type extends string, Body extends Record<string, unknown>>(
    eventId: string,
    aggregateId: string,
    aggregateType: string,
    eventType: Type,
    eventBody: Body,
    version: number,
    occurredOn: Date,
    publishedAt: Date | null,
  ): DomainEvent<Type, Body> {
    return new DomainEvent(
      eventId,
      aggregateId,
      aggregateType,
      eventType,
      eventBody,
      version,
      occurredOn,
      publishedAt,
    );
  }

  public assignVersion(version: number): void {
    if (this._version !== 0) {
      throw new Error("version は未採番のイベントにのみ設定できます");
    }
    this._version = version;
  }

  // 発行状態を更新するメソッド
  public publish(): void {
    this.publishedAt = new Date();
  }
}
