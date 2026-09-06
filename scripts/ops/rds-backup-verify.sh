#!/usr/bin/env bash
# rds-backup-verify.sh — KIỂM (chỉ đọc) cấu hình sao lưu RDS + versioning S3 cho DeutschFlow (PR-A8 / BF-05).
#
# Vì sao: 6 checklist DR trong repo chưa tick từ 03/07/2026; chưa ai xác nhận RDS automated backup
# đang bật hay retention là bao nhiêu. Script này KHÔNG sửa gì — chỉ in hiện trạng và gợi ý lệnh sửa.
#
# Cần: aws CLI đã đăng nhập bằng quyền của owner (rds:Describe*, s3:GetBucketVersioning), jq.
# Dùng:  AWS_REGION=us-east-1 scripts/ops/rds-backup-verify.sh            # tự dò mọi instance postgres
#        RDS_INSTANCE_ID=deutschflow-prod scripts/ops/rds-backup-verify.sh # chỉ một instance
#        S3_BUCKETS=bucket-a,bucket-b scripts/ops/rds-backup-verify.sh     # kiểm versioning các bucket này
# Thoát 0 = đạt ngưỡng tối thiểu (retention ≥ 7, DeletionProtection bật); 2 = có mục chưa đạt (đã in lệnh sửa).
set -euo pipefail

need() { command -v "$1" >/dev/null 2>&1 || { echo "Thiếu lệnh: $1" >&2; exit 1; }; }
need aws; need jq

REGION="${AWS_REGION:-$(aws configure get region 2>/dev/null || true)}"
[ -n "$REGION" ] || { echo "Chưa có vùng AWS: đặt AWS_REGION=... (vd us-east-1)" >&2; exit 1; }
MIN_RETENTION="${MIN_RETENTION_DAYS:-7}"
status=0

echo "== RDS ($REGION) =="
if [ -n "${RDS_INSTANCE_ID:-}" ]; then
  ids=("$RDS_INSTANCE_ID")
else
  mapfile -t ids < <(aws rds describe-db-instances --region "$REGION" \
    --query "DBInstances[?starts_with(Engine,'postgres')].DBInstanceIdentifier" --output text | tr '\t' '\n' | sed '/^$/d')
fi
[ "${#ids[@]}" -gt 0 ] || { echo "Không thấy instance PostgreSQL nào trong $REGION" >&2; exit 1; }

for id in "${ids[@]}"; do
  inst=$(aws rds describe-db-instances --region "$REGION" --db-instance-identifier "$id" --query 'DBInstances[0]' --output json)
  ret=$(jq -r '.BackupRetentionPeriod' <<<"$inst")
  win=$(jq -r '.PreferredBackupWindow' <<<"$inst")
  del=$(jq -r '.DeletionProtection' <<<"$inst")
  maz=$(jq -r '.MultiAZ' <<<"$inst")
  enc=$(jq -r '.StorageEncrypted' <<<"$inst")
  lrt=$(jq -r '.LatestRestorableTime // "n/a"' <<<"$inst")
  cls=$(jq -r '.DBInstanceClass' <<<"$inst")
  ver=$(jq -r '.EngineVersion' <<<"$inst")
  snap=$(aws rds describe-db-snapshots --region "$REGION" --db-instance-identifier "$id" --snapshot-type automated \
    --query 'sort_by(DBSnapshots,&SnapshotCreateTime)[-1].[DBSnapshotIdentifier,SnapshotCreateTime]' --output text 2>/dev/null || echo "none")
  printf '%s  class=%s  pg=%s\n' "$id" "$cls" "$ver"
  printf '  BackupRetentionPeriod = %s ngày (ngưỡng ≥ %s)\n' "$ret" "$MIN_RETENTION"
  printf '  PreferredBackupWindow = %s (UTC)\n' "$win"
  printf '  LatestRestorableTime  = %s  ← RPO hiện tại ≈ now − giá trị này (PITR)\n' "$lrt"
  printf '  Snapshot tự động mới nhất = %s\n' "$snap"
  printf '  DeletionProtection=%s  MultiAZ=%s  StorageEncrypted=%s\n' "$del" "$maz" "$enc"
  if [ "$ret" -lt "$MIN_RETENTION" ]; then
    status=2
    echo "  ✗ Retention dưới ngưỡng. Lệnh sửa (owner chạy, áp ngay, không restart):"
    echo "    aws rds modify-db-instance --region $REGION --db-instance-identifier $id --backup-retention-period $MIN_RETENTION --apply-immediately"
  fi
  if [ "$del" != "true" ]; then
    status=2
    echo "  ✗ DeletionProtection đang tắt. Lệnh sửa:"
    echo "    aws rds modify-db-instance --region $REGION --db-instance-identifier $id --deletion-protection --apply-immediately"
  fi
  [ "$maz" = "true" ] || echo "  ! MultiAZ tắt — chấp nhận được cho pilot nhỏ, ghi vào runbook là SPOF."
done

echo
echo "== S3 versioning (tệp học liệu / bài nộp) =="
if [ -n "${S3_BUCKETS:-}" ]; then
  IFS=',' read -r -a buckets <<<"$S3_BUCKETS"
else
  mapfile -t buckets < <(aws s3api list-buckets --query "Buckets[?contains(Name,'deutschflow')].Name" --output text | tr '\t' '\n' | sed '/^$/d')
fi
if [ "${#buckets[@]}" -eq 0 ]; then
  echo "(không thấy bucket nào tên chứa 'deutschflow' — đặt S3_BUCKETS=... để kiểm đích danh)"
fi
for b in "${buckets[@]}"; do
  v=$(aws s3api get-bucket-versioning --bucket "$b" --query 'Status' --output text 2>/dev/null || echo "ERR")
  lc=$(aws s3api get-bucket-lifecycle-configuration --bucket "$b" --query 'length(Rules)' --output text 2>/dev/null || echo "0")
  printf '%s  Versioning=%s  LifecycleRules=%s\n' "$b" "$v" "$lc"
  if [ "$v" != "Enabled" ]; then
    status=2
    echo "  ✗ Chưa bật versioning → xoá/ghi đè nhầm bài nộp là mất. Lệnh sửa:"
    echo "    aws s3api put-bucket-versioning --bucket $b --versioning-configuration Status=Enabled"
  fi
done

echo
if [ "$status" -eq 0 ]; then echo "KẾT LUẬN: đạt ngưỡng tối thiểu. Ghi ngày + output này vào plans/2026-09-07-runbook-restore-drill.md §Kết quả."; else echo "KẾT LUẬN: CÓ mục chưa đạt (xem ✗ ở trên). Sửa rồi chạy lại."; fi
exit "$status"
