#!/usr/bin/env bash
# ============================================================
# restore-db.sh — giải mã + restore một bản backup vào Postgres.
#
#   restore-db.sh <file.dump.age> <age-identity-file> [--into-scratch | --into-prod]
#
#   --into-scratch (mặc định): dựng container pgvector tạm, restore vào đó, đếm bảng/dòng rồi XOÁ.
#                              Dùng để diễn tập restore định kỳ — không đụng prod.
#   --into-prod              : restore ĐÈ lên DB deutschflow đang chạy. Phải dừng backend trước.
#                              Hỏi xác nhận bằng cách gõ tên DB.
#
# age-identity-file = khoá BÍ MẬT age (owner giữ, không nằm trên VM). Chép tạm lên VM khi cần,
# xoá ngay sau đó (shred -u).
# ============================================================
set -euo pipefail

FILE=${1:?file .dump.age}
IDENTITY=${2:?file khoá bí mật age}
MODE=${3:---into-scratch}
IMAGE=pgvector/pgvector:pg16

decrypt() { age -d -i "$IDENTITY" "$FILE"; }

if [ -f "$FILE.sha256" ]; then
  [ "$(sha256sum "$FILE" | awk '{print $1}')" = "$(cat "$FILE.sha256")" ] || { echo "sha256 KHÔNG khớp"; exit 1; }
  echo "sha256 khớp"
fi

case "$MODE" in
  --into-scratch)
    NAME=deutschflow-restore-test
    docker rm -f "$NAME" >/dev/null 2>&1 || true
    docker run -d --name "$NAME" -e POSTGRES_PASSWORD=scratch -e POSTGRES_DB=deutschflow \
      -e POSTGRES_USER=deutschflow_user "$IMAGE" >/dev/null
    trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT
    for _ in $(seq 1 30); do docker exec "$NAME" pg_isready -U deutschflow_user -d deutschflow >/dev/null 2>&1 && break; sleep 2; done
    sleep 2
    decrypt | docker exec -i "$NAME" pg_restore -U deutschflow_user -d deutschflow --no-owner --exit-on-error
    docker exec "$NAME" psql -U deutschflow_user -d deutschflow -tAc \
      "select 'tables='||count(*) from information_schema.tables where table_schema='public'"
    docker exec "$NAME" psql -U deutschflow_user -d deutschflow -tAc \
      "select 'flyway='||max(version::int) from flyway_schema_history where version is not null"
    docker exec "$NAME" psql -U deutschflow_user -d deutschflow -tAc \
      "select 'users='||(select count(*) from users)||' words='||(select count(*) from words)"
    echo "restore diễn tập OK — container tạm sẽ bị xoá"
    ;;
  --into-prod)
    if docker ps --format '{{.Names}}' | grep -qE '^deutschflow-backend(-green)?$'; then
      echo "Backend đang chạy — dừng trước: docker stop deutschflow-backend deutschflow-backend-green"; exit 1
    fi
    read -r -p "Restore ĐÈ lên DB production. Gõ 'deutschflow' để tiếp tục: " ok
    [ "$ok" = "deutschflow" ] || { echo "huỷ"; exit 1; }
    decrypt | docker exec -i deutschflow-postgres pg_restore -U deutschflow_user -d deutschflow \
      --clean --if-exists --no-owner --exit-on-error
    echo "restore prod xong — khởi động lại backend"
    ;;
  *) echo "mode: --into-scratch | --into-prod"; exit 1 ;;
esac
