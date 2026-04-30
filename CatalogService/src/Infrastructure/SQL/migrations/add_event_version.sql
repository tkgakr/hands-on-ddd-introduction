ALTER TABLE "Event"
ADD COLUMN IF NOT EXISTS "version" INTEGER;

WITH ordered_events AS (
  SELECT
    "eventId",
    ROW_NUMBER() OVER (
      PARTITION BY "aggregateId", "aggregateType"
      ORDER BY "occurredOn" ASC, "eventId" ASC
    ) AS "version"
  FROM "Event"
)
UPDATE "Event"
SET "version" = ordered_events."version"
FROM ordered_events
WHERE "Event"."eventId" = ordered_events."eventId"
  -- version が NULL または、再計算結果と異なる場合のみ更新
  AND "Event"."version" IS DISTINCT FROM ordered_events."version";

ALTER TABLE "Event"
ALTER COLUMN "version" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Event_aggregate_version_idx"
  ON "Event"("aggregateId", "aggregateType", "version");
