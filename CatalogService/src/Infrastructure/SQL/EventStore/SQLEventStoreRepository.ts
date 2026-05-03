import { injectable } from "tsyringe";

import { Aggregate } from "Domain/shared/Aggregate";
import { ConcurrencyError } from "Domain/shared/DomainEvent/ConcurrencyError";
import { DomainEvent } from "Domain/shared/DomainEvent/DomainEvent";
import { IEventStoreRepository } from "Domain/shared/DomainEvent/IEventStoreRepository";
import { PoolClient } from "pg";

import { SQLClientManager } from "../SQLClientManager";

@injectable()
export class SQLEventStoreRepository implements IEventStoreRepository {
  constructor(private clientManager: SQLClientManager) {}

  async find<T extends Aggregate<DomainEvent>>(
    aggregateId: string,
    aggregateType: string,
    reconstruct: (events: T["domainEvents"]) => T | null,
  ): Promise<T | null> {
    return await this.clientManager.withClient(async (client) => {
      // 指定された集約に関連する全てのイベントをバージョン順で取得
      const query = `
        SELECT
          "eventId",
          "aggregateId",
          "aggregateType",
          "eventType",
          "eventBody",
          "version",
          "occurredOn",
          "publishedAt"
        FROM "Event"
        WHERE "aggregateId" = $1 AND "aggregateType" = $2
        ORDER BY "version" ASC
      `;

      const result = await client.query(query, [aggregateId, aggregateType]);

      if (result.rows.length === 0) {
        return null;
      }

      const domainEvents = result.rows.map((row) =>
        DomainEvent.reconstruct(
          row.eventId,
          row.aggregateId,
          row.aggregateType,
          row.eventType,
          row.eventBody,
          row.version,
          row.occurredOn,
          row.publishedAt,
        ),
      );

      // 再構築関数を使用して集約を生成
      return reconstruct(domainEvents);
    });
  }

  async findPendingEvents(): Promise<DomainEvent[]> {
    return await this.clientManager.withClient(async (client) => {
      const query = `
        SELECT
          "eventId",
          "aggregateId",
          "aggregateType",
          "eventType",
          "eventBody",
          "version",
          "occurredOn",
          "publishedAt"
        FROM "Event"
        WHERE "publishedAt" IS NULL
        ORDER BY "occurredOn" ASC
      `;

      const result = await client.query(query);

      return result.rows.map((row) =>
        DomainEvent.reconstruct(
          row.eventId,
          row.aggregateId,
          row.aggregateType,
          row.eventType,
          row.eventBody,
          row.version,
          row.occurredOn,
          row.publishedAt,
        ),
      );
    });
  }

  async store(
    aggregate: Aggregate<DomainEvent>,
    expectedVersion?: number,
  ): Promise<void> {
    const events = aggregate.getDomainEvents();
    if (events.length === 0) {
      aggregate.clearDomainEvents();
      return;
    }

    const append = async (client: PoolClient): Promise<void> => {
      const firstEvent = events[0]!;
      const isSingleStream = events.every(
        (event) =>
          event.aggregateId === firstEvent.aggregateId &&
          event.aggregateType === firstEvent.aggregateType,
      );
      if (!isSingleStream) {
        throw new Error(
          "一度の append で複数 aggregate のイベントは保存できません",
        );
      }

      const resolvedExpectedVersion = expectedVersion ?? firstEvent.version - 1;

      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
        [firstEvent.aggregateId, firstEvent.aggregateType],
      );

      const currentVersionResult = await client.query(
        `
          SELECT COALESCE(MAX("version"), 0)::int AS "version"
          FROM "Event"
          WHERE "aggregateId" = $1 AND "aggregateType" = $2
        `,
        [firstEvent.aggregateId, firstEvent.aggregateType],
      );
      const currentVersion = currentVersionResult.rows[0].version;

      if (currentVersion !== resolvedExpectedVersion) {
        throw new ConcurrencyError(
          firstEvent.aggregateId,
          firstEvent.aggregateType,
          resolvedExpectedVersion,
          currentVersion,
        );
      }

      for (let index = 0; index < events.length; index++) {
        const event = events[index]!;
        const expectedEventVersion = resolvedExpectedVersion + index + 1;
        if (event.version !== expectedEventVersion) {
          throw new Error(
            `append するイベントの version が連続していません: expected=${expectedEventVersion} actual=${event.version}`,
          );
        }
      }

      for (const event of events) {
        const query = `
          INSERT INTO "Event" (
            "eventId",
            "aggregateId",
            "aggregateType",
            "eventType",
            "eventBody",
            "version",
            "occurredOn",
            "publishedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `;

        const values = [
          event.eventId,
          event.aggregateId,
          event.aggregateType,
          event.eventType,
          JSON.stringify(event.eventBody),
          event.version,
          event.occurredOn,
          event.publishedAt,
        ];

        await client.query(query, values);
      }
    };

    const existingClient = this.clientManager.getClient();
    if (existingClient) {
      await append(existingClient);
      aggregate.clearDomainEvents();
      return;
    }

    const client = await this.clientManager.getConnection();
    try {
      await client.query("BEGIN");
      await append(client);
      await client.query("COMMIT");
      aggregate.clearDomainEvents();
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async markAsPublished(event: DomainEvent): Promise<void> {
    await this.clientManager.withClient(async (client) => {
      const query = `
        UPDATE "Event"
        SET "publishedAt" = $1
        WHERE "eventId" = $2
      `;

      const values = [event.publishedAt, event.eventId];

      await client.query(query, values);
    });
  }
}
