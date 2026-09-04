#!/usr/bin/env bash
#
# CI gate: verify the Flyway migration chain replays clean on a FROM-SCRATCH PostgreSQL.
#
# Why: the app historically grew its schema via JPA ddl-auto alongside Flyway, so several
# migrations assumed entity-created tables/columns existed. A fresh DB (CI, new dev, fresh
# prod) would then fail at boot. This script guards against that regressing again.
#
# What it does: spins a throwaway pgvector Postgres + Redis, boots the backend with Flyway
# enabled against the empty DB and ddl-auto=validate, asserts every migration applied and
# the app started, then tears everything down. Exits non-zero on any migration failure or
# on Hibernate schema-validation mismatch (entity needs a table/column Flyway never created).
#
# Usage:  scripts/verify-fresh-migrations.sh
# Requires: docker, a JDK, the Maven wrapper (backend/mvnw). Script tự ép UTC — chạy được ở mọi múi giờ.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG=df-ci-pg ; REDIS=df-ci-redis
DB=ci_deutschflow ; USER=ci ; PW=ci ; PGPORT=55432 ; REDISPORT=56379
LOG="$(mktemp -t df-ci-boot.XXXX.log)"

cleanup() { docker rm -f "$PG" "$REDIS" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "▶ starting throwaway pgvector + redis…"
docker run -d --name "$PG" -e POSTGRES_DB="$DB" -e POSTGRES_USER="$USER" -e POSTGRES_PASSWORD="$PW" \
  -e TZ=UTC -e PGTZ=UTC -p "$PGPORT:5432" pgvector/pgvector:pg16 >/dev/null
docker run -d --name "$REDIS" -p "$REDISPORT:6379" redis:7 >/dev/null
for i in $(seq 1 40); do docker exec "$PG" pg_isready -U "$USER" -d "$DB" >/dev/null 2>&1 && break; sleep 1; done
docker exec "$PG" psql -U "$USER" -d "$DB" -c "CREATE EXTENSION IF NOT EXISTS vector;" >/dev/null

echo "▶ booting backend against the empty DB (Flyway migrate)…"
# Spring CLI args override any local .env.
# ddl-auto=validate: Hibernate must NOT mutate schema. Flyway alone has to produce every
# table/column the entities map, or boot fails. (`update` would silently patch any gap,
# so a green run proved nothing about the migration chain itself.)
# The gate is (1) all Flyway migrations apply and (2) the app starts under validate.
# TZ=UTC là BẮT BUỘC, không phải cho đẹp: pgjdbc gửi timezone mặc định của JVM lên làm
# session TimeZone của kết nối, và V199 có guard tự huỷ nếu session không phải UTC. Không ép
# thì gate ĐỎ GIẢ trên mọi máy lệch UTC (máy dev VN: 'got "Asia/Ho_Chi_Minh"'), tức là nó chỉ
# từng xanh được trên runner Ubuntu — một cổng không ai chạy nổi tại chỗ thì không phải cổng.
#
# JWT_SECRET: JwtService ném IllegalStateException ngay trong constructor khi algorithm=HS256 mà
# secret rỗng, và bean đó được tạo TRƯỚC EntityManagerFactory. Thiếu nó thì context chết sớm hơn
# bước Hibernate validate — nghĩa là gate báo "FAILED" nhưng chưa hề kiểm tra được điều nó hứa
# kiểm tra. Sinh ngẫu nhiên mỗi lần chạy: đây là DB dùng một lần, không có gì để ký thật, và
# hằng số hardcode sẽ vừa vô nghĩa vừa làm secret-scan nổi còi.
( cd "$ROOT/backend" && TZ=UTC JWT_SECRET="$(openssl rand -base64 48)" \
    ./mvnw -q spring-boot:run -Dmaven.test.skip=true \
    -Dspring-boot.run.arguments="\
--spring.datasource.url=jdbc:postgresql://localhost:$PGPORT/$DB \
--spring.datasource.username=$USER --spring.datasource.password=$PW \
--spring.data.redis.host=localhost --spring.data.redis.port=$REDISPORT \
--spring.jpa.hibernate.ddl-auto=validate" > "$LOG" 2>&1 ) &
APP_PID=$!

# Mốc thành công là "Initialized JPA EntityManagerFactory", KHÔNG phải "Started
# DeutschFlowApplication": Hibernate chạy ddl-auto=validate TRONG lúc dựng EntityManagerFactory,
# nên tới được dòng đó nghĩa là mọi bảng/cột entity cần đều đã do Flyway tạo ra — đúng thứ gate
# này sinh ra để bảo vệ. Đòi app start HẲN thì lại đòi cả rổ secret production không liên quan gì
# tới schema (S3 bucket/key, AI key…), và gate sẽ đỏ vì lý do không phải lỗi migration.
ok=""
for i in $(seq 1 90); do
  if grep -qE "Migration V[0-9]+__.* failed|Schema-validation:|APPLICATION FAILED TO START" "$LOG"; then break; fi
  if grep -qE "Initialized JPA EntityManagerFactory|Started DeutschFlowApplication in" "$LOG"; then ok=1; break; fi
  sleep 3
done
kill "$APP_PID" >/dev/null 2>&1 || true
# Scoped cleanup: match this run's unique throwaway datasource, never someone else's spring-boot:run.
pkill -f "localhost:$PGPORT/$DB" >/dev/null 2>&1 || true

if [ -n "$ok" ]; then
  applied="$(grep -oE "Successfully applied [0-9]+ migrations" "$LOG" | tail -1)"
  version="$(grep -oE "now at version v[0-9]+" "$LOG" | tail -1)"
  echo "✅ fresh-DB migration replay OK — ${applied:-migrations applied} ${version:-} (Hibernate ddl-auto=validate pass)"
  exit 0
else
  echo "❌ fresh-DB migration replay FAILED:"
  grep -nE "Migration V[0-9]+__.* failed|Schema-validation:|Message    :|Location   :|APPLICATION FAILED TO START" "$LOG" | head -10
  exit 1
fi
