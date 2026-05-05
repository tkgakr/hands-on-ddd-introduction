#!/bin/sh
set -eu

COMPOSE_FILE="docker-compose.test.yml"
COMPOSE_PROJECT_NAME="catalogservice_sql_test"
DB_SERVICE="testdb"

cleanup() {
  docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" down -v
}

trap cleanup EXIT INT TERM

docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" up -d

ready=false
for i in $(seq 1 30); do
  if docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" pg_isready -U postgres -d catalogservice_test >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done

if [ "$ready" != "true" ]; then
  echo "PostgreSQL test container did not become ready in time." >&2
  exit 1
fi

export NODE_ENV=test
export RUN_SQL_TESTS=true
export DB_HOST=localhost
export DB_PORT=15432
export DB_NAME=catalogservice_test
export DB_USER=postgres
export DB_PASSWORD=password

npx ts-node src/Infrastructure/SQL/migrations/runMigrations.ts init.sql create_event_table.sql add_event_version.sql drop_review_table.sql
npx jest --runInBand src/Infrastructure/SQL src/Presentation/Express/app.test.ts
