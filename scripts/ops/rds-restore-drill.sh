#!/usr/bin/env bash
# rds-restore-drill.sh — DIỄN TẬP khôi phục RDS sang instance TẠM và đo RTO/RPO (PR-A8 / BF-05).
#
# KHÔNG đụng instance production: chỉ ĐỌC nguồn, TẠO instance mới (restore) và — khi được yêu cầu — XOÁ
# đúng instance tạm đó. Instance tạm có thể giữ lại một ngày làm staging để bắn k6 (quyết định Q5).
#
# Cần: aws CLI (owner), jq; psql nếu dùng --verify-psql (PGPASSWORD trong env, không ghi vào file).
# Dùng:
#   scripts/ops/rds-restore-drill.sh --source deutschflow-prod --target deutschflow-drill-20260907 --pitr
#   scripts/ops/rds-restore-drill.sh --source deutschflow-prod --target deutschflow-drill-20260907 --snapshot
#   scripts/ops/rds-restore-drill.sh --target deutschflow-drill-20260907 --verify-psql --db-user postgres --db-name deutschflow
#   scripts/ops/rds-restore-drill.sh --target deutschflow-drill-20260907 --cleanup [--yes]
# Mỗi bước in mốc thời gian; RTO = từ lúc gọi restore tới lúc app/psql đọc được; RPO = now − điểm khôi phục.
set -euo pipefail

need() { command -v "$1" >/dev/null 2>&1 || { echo "Thiếu lệnh: $1" >&2; exit 1; }; }
need aws; need jq

REGION="${AWS_REGION:-$(aws configure get region 2>/dev/null || true)}"
SOURCE="${RDS_INSTANCE_ID:-}"; TARGET=""; MODE=""; VERIFY=0; CLEANUP=0; YES=0; DB_USER="${DB_USER:-postgres}"; DB_NAME="${DB_NAME:-deutschflow}"; CLASS=""
while [ $# -gt 0 ]; do
  case "$1" in
    --source) SOURCE="$2"; shift 2;;
    --target) TARGET="$2"; shift 2;;
    --pitr) MODE=pitr; shift;;
    --snapshot) MODE=snapshot; shift;;
    --class) CLASS="$2"; shift 2;;
    --verify-psql) VERIFY=1; shift;;
    --db-user) DB_USER="$2"; shift 2;;
    --db-name) DB_NAME="$2"; shift 2;;
    --cleanup) CLEANUP=1; shift;;
    --yes) YES=1; shift;;
    *) echo "Tham số lạ: $1" >&2; exit 1;;
  esac
done
[ -n "$REGION" ] || { echo "Chưa có vùng AWS: đặt AWS_REGION=..." >&2; exit 1; }
[ -n "$TARGET" ] || { echo "Cần --target <id instance tạm> (vd deutschflow-drill-$(date +%Y%m%d))" >&2; exit 1; }
case "$TARGET" in *drill*) ;; *) echo "Tên --target phải chứa 'drill' để không nhầm với production." >&2; exit 1;; esac
now_utc() { date -u +%Y-%m-%dT%H:%M:%SZ; }

# Đổi mốc thời gian ISO-8601 sang epoch, chạy được trên cả BSD date (macOS) lẫn GNU date (Linux).
#
# Bẫy đã trả giá: bản trước cắt phần lẻ giây bằng `${point%%.*}` rồi nối "Z". AWS trả
# LatestRestorableTime/SnapshotCreateTime dạng `2026-09-07T05:00:00+00:00`; khi mốc rơi đúng giây
# tròn thì KHÔNG có dấu chấm nào để cắt, chuỗi thành `...05:00:00+00:00Z` — BSD date parse hỏng, rơi
# xuống nhánh `date -u -d` vốn là cú pháp GNU KHÔNG tồn tại trên macOS, hàm trả rỗng, và phép
# $(( )) ngay sau đó làm shell báo lỗi biểu thức rồi DỪNG script. Điểm đau: dừng SAU khi instance
# khôi phục đã tạo xong và đang tính phí, nên người chạy mất luôn dòng nhắc `--cleanup`.
#
# Nay chuẩn hoá trước: bỏ phần lẻ giây và mọi hậu tố múi giờ (Z hoặc ±HH:MM), rồi thử BSD trước,
# GNU sau. Mọi mốc AWS trả về đều là UTC nên bỏ hậu tố không làm lệch kết quả.
epoch() {
  local raw="$1" norm
  norm=$(printf '%s' "$raw" | sed -E 's/\.[0-9]+//; s/(Z|[+-][0-9]{2}:?[0-9]{2})$//')
  date -u -j -f "%Y-%m-%dT%H:%M:%S" "$norm" +%s 2>/dev/null \
    || date -u -d "${norm}Z" +%s 2>/dev/null \
    || { echo "Không đọc được mốc thời gian: $raw" >&2; return 1; }
}

if [ "$CLEANUP" -eq 1 ]; then
  echo "[$(now_utc)] XOÁ instance tạm $TARGET (skip final snapshot, xoá automated backups của NÓ)."
  aws rds describe-db-instances --region "$REGION" --db-instance-identifier "$TARGET" --query 'DBInstances[0].TagList' --output json | grep -q '"restore-drill"' \
    || { echo "Instance $TARGET không mang tag purpose=restore-drill — từ chối xoá." >&2; exit 1; }
  if [ "$YES" -ne 1 ]; then read -r -p "Gõ đúng tên instance để xác nhận xoá: " ans; [ "$ans" = "$TARGET" ] || { echo "Huỷ."; exit 1; }; fi
  aws rds delete-db-instance --region "$REGION" --db-instance-identifier "$TARGET" --skip-final-snapshot --delete-automated-backups >/dev/null
  echo "[$(now_utc)] Đã gửi lệnh xoá. Theo dõi: aws rds describe-db-instances --db-instance-identifier $TARGET"
  exit 0
fi

if [ -n "$MODE" ]; then
  [ -n "$SOURCE" ] || { echo "Cần --source <id production>" >&2; exit 1; }
  src=$(aws rds describe-db-instances --region "$REGION" --db-instance-identifier "$SOURCE" --query 'DBInstances[0]' --output json)
  cls="${CLASS:-$(jq -r '.DBInstanceClass' <<<"$src")}"
  subnet=$(jq -r '.DBSubnetGroup.DBSubnetGroupName' <<<"$src")
  sgs=$(jq -r '[.VpcSecurityGroups[].VpcSecurityGroupId] | join(" ")' <<<"$src")
  T0=$(now_utc)
  if [ "$MODE" = pitr ]; then
    point=$(jq -r '.LatestRestorableTime' <<<"$src")
    echo "[$T0] PITR: khôi phục $SOURCE → $TARGET tại LatestRestorableTime=$point (class=$cls, subnet=$subnet, sg=$sgs)"
    # shellcheck disable=SC2086
    aws rds restore-db-instance-to-point-in-time --region "$REGION" \
      --source-db-instance-identifier "$SOURCE" --target-db-instance-identifier "$TARGET" \
      --use-latest-restorable-time --db-instance-class "$cls" --no-multi-az --no-publicly-accessible \
      --db-subnet-group-name "$subnet" --vpc-security-group-ids $sgs \
      --tags Key=purpose,Value=restore-drill Key=source,Value="$SOURCE" >/dev/null
  else
    read -r snap point < <(aws rds describe-db-snapshots --region "$REGION" --db-instance-identifier "$SOURCE" --snapshot-type automated \
      --query 'sort_by(DBSnapshots,&SnapshotCreateTime)[-1].[DBSnapshotIdentifier,SnapshotCreateTime]' --output text)
    [ -n "$snap" ] && [ "$snap" != "None" ] || { echo "Không có snapshot tự động nào cho $SOURCE — retention đang tắt? Chạy rds-backup-verify.sh trước." >&2; exit 1; }
    echo "[$T0] SNAPSHOT: khôi phục $snap (tạo lúc $point) → $TARGET"
    # shellcheck disable=SC2086
    aws rds restore-db-instance-from-db-snapshot --region "$REGION" \
      --db-instance-identifier "$TARGET" --db-snapshot-identifier "$snap" \
      --db-instance-class "$cls" --no-multi-az --no-publicly-accessible \
      --db-subnet-group-name "$subnet" --vpc-security-group-ids $sgs \
      --tags Key=purpose,Value=restore-drill Key=source,Value="$SOURCE" >/dev/null
  fi
  echo "[$(now_utc)] Đang chờ $TARGET available (thường 5–15 phút)…"
  aws rds wait db-instance-available --region "$REGION" --db-instance-identifier "$TARGET"
  T1=$(now_utc)
  ep=$(aws rds describe-db-instances --region "$REGION" --db-instance-identifier "$TARGET" --query 'DBInstances[0].Endpoint.Address' --output text)
  rto_prov=$(( $(epoch "$T1") - $(epoch "$T0") ))
  # Không để lỗi đọc mốc làm dừng script SAU khi instance đã tạo xong: báo "?" rồi vẫn in bước kế.
  point_epoch=$(epoch "$point" || echo "")
  if [ -n "$point_epoch" ]; then rpo=$(( $(epoch "$T0") - point_epoch )); else rpo="?"; fi
  echo "[$T1] $TARGET AVAILABLE. endpoint=$ep"
  echo "RTO_provision_seconds=$rto_prov  RPO_seconds=$rpo  (điểm khôi phục: $point)"
  echo "Bước kế: chạy lại với --target $TARGET --verify-psql (cần PGPASSWORD) để đo RTO tới lúc đọc được dữ liệu."
fi

if [ "$VERIFY" -eq 1 ]; then
  need psql
  [ -n "${PGPASSWORD:-}" ] || { echo "Đặt PGPASSWORD trong env (mật khẩu master của RDS, không ghi vào file)." >&2; exit 1; }
  ep=$(aws rds describe-db-instances --region "$REGION" --db-instance-identifier "$TARGET" --query 'DBInstances[0].Endpoint.Address' --output text)
  T2=$(now_utc)
  echo "[$T2] Đối soát dữ liệu trên $ep (chỉ SELECT):"
  psql "host=$ep port=5432 dbname=$DB_NAME user=$DB_USER sslmode=require" -v ON_ERROR_STOP=1 -tA <<'SQL'
SELECT 'flyway_max_version=' || max(version) FROM flyway_schema_history WHERE success;
SELECT 'users=' || count(*) FROM users;
SELECT 'organizations=' || count(*) FROM organizations;
SELECT 'classes=' || count(*) FROM classes;
SELECT 'class_assignments=' || count(*) FROM class_assignments;
SELECT 'student_assignments=' || count(*) FROM student_assignments;
SELECT 'org_invoices=' || count(*) FROM org_invoices;
SELECT 'latest_student_assignment_at=' || coalesce(max(created_at)::text,'n/a') FROM student_assignments;
SQL
  echo "[$(now_utc)] Đọc được. Ghi RTO_total = (mốc này − mốc T0 của lần restore) và các count vào runbook."
  echo "Muốn boot backend vào đây (staging k6): DB_HOST=$ep DB_PORT=5432 DB_NAME=$DB_NAME DB_USERNAME=$DB_USER DB_PASSWORD=... + env còn lại theo memory/README; JPA ddl-auto=validate phải xanh."
fi
