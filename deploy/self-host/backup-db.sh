#!/usr/bin/env bash
# ============================================================
# backup-db.sh — dump Postgres → mã hoá age → /backup/db (giữ 14 bản) → R2 deutschflow-backup (giữ 30 ngày)
#                + nén env và khoá của máy chủ → mã hoá age → /backup/secrets (giữ 14 bản) → R2 (cùng hạn)
#
# Chạy trên VM bởi systemd timer deutschflow-backup.timer (hằng ngày). Chạy tay: bash backup-db.sh
#
# Cấu hình (ngoài repo):
#   /srv/deutschflow/env/backup.env   RCLONE_CONFIG_R2B_* (token R2 CHỈ ghi được bucket backup)
#   /srv/deutschflow/env/backup-age.pub  khoá CÔNG KHAI age — chỉ mã hoá được, không giải được.
#   Khoá BÍ MẬT age KHÔNG nằm trên VM (owner giữ) ⇒ ai chiếm được VM/bucket cũng không đọc được dump.
#
# Env và khoá (backend.env, postgres.env, khoá ký, khoá mã hoá 2FA, token…): mất đĩa mà chỉ còn
# dump DB thì không dựng lại được hệ thống. Vì vậy mỗi lần chạy cũng nén $ENV_DIR và $SECRETS_DIR,
# mã hoá bằng CÙNG khoá công khai age rồi đẩy R2.
# Khôi phục: age -d -i <khoá-bí-mật> secrets-<mốc>.tar.age | tar -xpf - -C /   (xem README.md).
#
# Xoay vòng trên R2: mặc định script tự xoá bản cũ hơn REMOTE_KEEP (cần token có quyền xoá).
# Khi đã đặt lifecycle rule trên bucket và đổi sang token CHỈ GHI, đặt REMOTE_PRUNE=0 trong
# backup.env — khi đó chiếm được VM cũng không xoá được bản off-site.
# ============================================================
set -euo pipefail
umask 077

ENV_DIR=/srv/deutschflow/env
LOCAL_DIR=/backup/db
SECRETS_DIR=/home/deploy/secrets
SECRETS_LOCAL_DIR=/backup/secrets
SECRETS_REMOTE=r2b:deutschflow-backup/secrets
LOCAL_KEEP=14
REMOTE=r2b:deutschflow-backup/db
REMOTE_KEEP=30d
PG_CONTAINER=deutschflow-postgres
DB=deutschflow
DB_USER=deutschflow_user

log() { echo "[$(date -u +%FT%TZ)] $*"; }

[ -s "$ENV_DIR/backup-age.pub" ] || { log "thiếu $ENV_DIR/backup-age.pub"; exit 1; }
set -a; . "$ENV_DIR/backup.env"; set +a
REMOTE_PRUNE=${REMOTE_PRUNE:-1}
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
# R2: xoá bản cũ hơn REMOTE_KEEP (bỏ qua khi bucket tự xoay vòng bằng lifecycle rule)
if [ "$REMOTE_PRUNE" = "1" ]; then
  rclone delete --min-age "$REMOTE_KEEP" "$REMOTE/" 2>&1 | grep -v NOTICE || true
fi

# ── Env và khoá ──────────────────────────────────────────────
# Không in tên biến hay nội dung; chỉ in tên file nén và kích thước.
mkdir -p "$SECRETS_LOCAL_DIR"
S_OUT="$SECRETS_LOCAL_DIR/secrets-$STAMP.tar.age"
S_TMP="$S_OUT.partial"
S_SRC=()
for d in "$ENV_DIR" "$SECRETS_DIR"; do
  [ -d "$d" ] && S_SRC+=("${d#/}")
done
[ "${#S_SRC[@]}" -gt 0 ] || { log "LỖI: không thấy $ENV_DIR lẫn $SECRETS_DIR"; exit 1; }
log "nén env và khoá → $S_OUT"
tar -cpf - -C / "${S_SRC[@]}" | age -R "$ENV_DIR/backup-age.pub" -o "$S_TMP"
mv "$S_TMP" "$S_OUT"
sha256sum "$S_OUT" | awk '{print $1}' > "$S_OUT.sha256"
rclone copy --s3-no-check-bucket "$S_OUT" "$SECRETS_REMOTE/"
rclone copy --s3-no-check-bucket "$S_OUT.sha256" "$SECRETS_REMOTE/"
S_REMOTE_SIZE=$(rclone size --json "$SECRETS_REMOTE/$(basename "$S_OUT")" | jq -r .bytes)
S_LOCAL_SIZE=$(stat -c %s "$S_OUT")
[ "$S_REMOTE_SIZE" = "$S_LOCAL_SIZE" ] || { log "LỖI: R2 $S_REMOTE_SIZE B ≠ local $S_LOCAL_SIZE B (env và khoá)"; exit 1; }
log "env và khoá: R2 OK ($S_REMOTE_SIZE B)"
ls -1t "$SECRETS_LOCAL_DIR"/secrets-*.tar.age 2>/dev/null | tail -n +$((LOCAL_KEEP + 1)) | while read -r f; do
  rm -f "$f" "$f.sha256"; log "xoá local cũ: $(basename "$f")"
done
if [ "$REMOTE_PRUNE" = "1" ]; then
  rclone delete --min-age "$REMOTE_KEEP" "$SECRETS_REMOTE/" 2>&1 | grep -v NOTICE || true
fi

date -u +%FT%TZ > "$LOCAL_DIR/.last-success"
log "backup hoàn tất"
