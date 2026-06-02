#!/usr/bin/env bash
#
# CI gate: verify the Flyway migration chain replays clean on a FROM-SCRATCH PostgreSQL.
#
# Why: the app historically grew its schema via JPA ddl-auto alongside Flyway, so several
# migrations assumed entity-created tables/columns existed. A fresh DB (CI, new dev, fresh
# prod) would then fail at boot. This script guards against that regressing again.
#
# What it does: spins a throwaway pgvector Postgres + Redis, boots the backend with Flyway
# enabled against the empty DB, asserts every migration applied and the app started, then
# tears everything down. Exits non-zero on any migration failure.
#
# Usage:  scripts/verify-fresh-migrations.sh
# Requires: docker, a JDK, the Maven wrapper (backend/mvnw).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG=df-ci-pg ; REDIS=df-ci-redis
DB=ci_deutschflow ; USER=ci ; PW=ci ; PGPORT=55432 ; REDISPORT=56379
LOG="$(mktemp -t df-ci-boot.XXXX.log)"

cleanup() { docker rm -f "$PG" "$REDIS" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "▶ starting throwaway pgvector + redis…"
docker run -d --name "$PG" -e POSTGRES_DB="$DB" -e POSTGRES_USER="$USER" -e POSTGRES_PASSWORD="$PW" \
  -p "$PGPORT:5432" pgvector/pgvector:pg16 >/dev/null
docker run -d --name "$REDIS" -p "$REDISPORT:6379" redis:7 >/dev/null
for i in $(seq 1 40); do docker exec "$PG" pg_isready -U "$USER" -d "$DB" >/dev/null 2>&1 && break; sleep 1; done
docker exec "$PG" psql -U "$USER" -d "$DB" -c "CREATE EXTENSION IF NOT EXISTS vector;" >/dev/null

echo "▶ booting backend against the empty DB (Flyway migrate)…"
# Spring CLI args override any local .env.
# ddl-auto=update: lets Hibernate add any JPA columns not yet in Flyway (should be none).
# The gate is (1) all Flyway migrations apply and (2) the app starts.
( cd "$ROOT/backend" && ./mvnw -q spring-boot:run -Dmaven.test.skip=true \
    -Dspring-boot.run.arguments="\
--spring.datasource.url=jdbc:postgresql://localhost:$PGPORT/$DB \
--spring.datasource.username=$USER --spring.datasource.password=$PW \
--spring.data.redis.host=localhost --spring.data.redis.port=$REDISPORT \
--spring.jpa.hibernate.ddl-auto=update" > "$LOG" 2>&1 ) &
APP_PID=$!

ok=""
for i in $(seq 1 90); do
  if grep -qE "Migration V[0-9]+__.* failed|APPLICATION FAILED TO START" "$LOG"; then break; fi
  if grep -qE "Started DeutschFlowApplication in" "$LOG"; then ok=1; break; fi
  sleep 3
done
kill "$APP_PID" >/dev/null 2>&1 || true
pkill -f spring-boot:run >/dev/null 2>&1 || true

if [ -n "$ok" ]; then
  applied="$(grep -oE "Successfully applied [0-9]+ migrations" "$LOG" | tail -1)"
  echo "✅ fresh-DB migration replay OK — ${applied:-migrations applied}"
  exit 0
else
  echo "❌ fresh-DB migration replay FAILED:"
  grep -nE "Migration V[0-9]+__.* failed|Message    :|Location   :|APPLICATION FAILED TO START" "$LOG" | head -10
  exit 1
fi
