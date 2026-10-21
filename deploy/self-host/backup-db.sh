#!/usr/bin/env bash
# ============================================================
# backup-db.sh — dump Postgres → mã hoá age → /backup/db (giữ 14 bản) → R2 deutschflow-backup (giữ 30 ngày)
#
# Chạy trên VM bởi systemd timer deutschflow-backup.timer (hằng ngày). Chạy tay: bash backup-db.sh
#
# Cấu hình (ngoài repo):
#   /srv/deutschflow/env/backup.env   RCLONE_CONFIG_R2B_* (token R2 CHỈ ghi được bucket backup)
#   /srv/deutschflow/env/backup-age.pub  khoá CÔNG KHAI age — chỉ mã hoá được, không giải được.
#   Khoá BÍ MẬT age KHÔNG nằm trên VM (owner giữ) ⇒ ai chiếm được VM/bucket cũng không đọc được dump.
# ============================================================
set -euo pipefail
umask 077

ENV_DIR=/srv/deutschflow/env
LOCAL_DIR=/backup/db
LOCAL_KEEP=14
REMOTE=r2b:deutschflow-backup/db
REMOTE_KEEP=30d
PG_CONTAINER=deutschflow-postgres
DB=deutschflow
DB_USER=deutschflow_user

log() { echo "[$(date -u +%FT%TZ)] $*"; }

[ -s "$ENV_DIR/backup-age.pub" ] || { log "thiếu $ENV_DIR/backup-age.pub"; exit 1; }
set -a; . "$ENV_DIR/backup.env"; set +a
mkdir -p "$LOCAL_DIR"

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT="$LOCAL_DIR/deutschflow-$STAMP.dump.age"
TMP="$OUT.partial"

log "dump $DB → $OUT"
# pipefail: pg_dump lỗi giữa chừng ⇒ cả pipe đỏ ⇒ không để lại file hỏng mang tên hợp lệ
docker exec "$PG_CONTAINER" pg_dump -U "$DB_USER" -d "$DB" -Fc -Z 6 \
  | age -R "$ENV_DIR/backup-age.pub" -o "$TMP"
mv "$TMP" "$OUT"
SIZE=$(du -h "$OUT" | cut -f1)
sha256sum "$OUT" | awk '{print $1}' > "$OUT.sha256"
log "xong: $SIZE"

log "đẩy lên $REMOTE"
rclone copy --s3-no-check-bucket "$OUT" "$REMOTE/"
rclone copy --s3-no-check-bucket "$OUT.sha256" "$REMOTE/"
# Kiểm lại: kích thước trên R2 phải khớp bản local
REMOTE_SIZE=$(rclone size --json "$REMOTE/$(basename "$OUT")" | jq -r .bytes)
LOCAL_SIZE=$(stat -c %s "$OUT")
[ "$REMOTE_SIZE" = "$LOCAL_SIZE" ] || { log "LỖI: R2 $REMOTE_SIZE B ≠ local $LOCAL_SIZE B"; exit 1; }
log "R2 OK ($REMOTE_SIZE B)"

# Giữ LOCAL_KEEP bản mới nhất ở local
ls -1t "$LOCAL_DIR"/deutschflow-*.dump.age 2>/dev/null | tail -n +$((LOCAL_KEEP + 1)) | while read -r f; do
  rm -f "$f" "$f.sha256"; log "xoá local cũ: $(basename "$f")"
done
# R2: xoá bản cũ hơn REMOTE_KEEP
rclone delete --min-age "$REMOTE_KEEP" "$REMOTE/" 2>&1 | grep -v NOTICE || true

date -u +%FT%TZ > "$LOCAL_DIR/.last-success"
log "backup hoàn tất"
