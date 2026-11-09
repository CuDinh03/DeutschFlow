#!/usr/bin/env bash
# ============================================================
# metrics-textfile.sh — ghi số đo "ngoài app" cho node-exporter (textfile collector).
#
# Chạy mỗi 5 phút bởi systemd timer deutschflow-metrics.timer (user deploy). Chạy tay: bash metrics-textfile.sh
# Đầu ra: /var/lib/node_exporter/textfile_collector/deutschflow.prom (ghi nguyên tử: .tmp → mv).
# Rule cảnh báo dùng các số này: docker/prometheus/alert.rules.yml nhóm deutschflow_selfhost.
#
#   deutschflow_textfile_last_run_timestamp_seconds   lần chạy gần nhất của script (canh script chết)
#   deutschflow_backup_last_success_timestamp_seconds  /backup/db/.last-success (backup-db.sh ghi)
#   deutschflow_ai_tokens_today                         tổng total_tokens từ 00:00 giờ VN hôm nay
#   deutschflow_ai_tokens_avg_7d                        trung bình/ngày của 7 ngày VN trước hôm nay
#   deutschflow_metrics_query_ok                        1 = truy vấn DB thành công lần này
# ============================================================
set -uo pipefail

OUT_DIR=/var/lib/node_exporter/textfile_collector
OUT="$OUT_DIR/deutschflow.prom"
PG_CONTAINER=deutschflow-postgres
DB=deutschflow
DB_USER=deutschflow_user
LAST_SUCCESS=/backup/db/.last-success

tmp=$(mktemp "$OUT_DIR/.deutschflow.prom.XXXXXX") || exit 1
trap 'rm -f "$tmp"' EXIT

{
  echo "# HELP deutschflow_textfile_last_run_timestamp_seconds Lan chay gan nhat cua metrics-textfile.sh."
  echo "# TYPE deutschflow_textfile_last_run_timestamp_seconds gauge"
  echo "deutschflow_textfile_last_run_timestamp_seconds $(date +%s)"

  if [ -s "$LAST_SUCCESS" ] && ts=$(date -d "$(cat "$LAST_SUCCESS")" +%s 2>/dev/null); then
    echo "# HELP deutschflow_backup_last_success_timestamp_seconds Thoi diem backup DB thanh cong gan nhat."
    echo "# TYPE deutschflow_backup_last_success_timestamp_seconds gauge"
    echo "deutschflow_backup_last_success_timestamp_seconds $ts"
  fi

  # Một truy vấn, hai số. Ngày tính theo giờ VN (Asia/Ho_Chi_Minh) như mọi báo cáo admin.
  sql="WITH b AS (SELECT (date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh') AS d0)
SELECT
  COALESCE((SELECT sum(total_tokens) FROM ai_token_usage_events, b WHERE created_at >= b.d0), 0),
  COALESCE((SELECT sum(total_tokens) FROM ai_token_usage_events, b
            WHERE created_at >= b.d0 - interval '7 days' AND created_at < b.d0), 0) / 7.0"
  if row=$(docker exec "$PG_CONTAINER" psql -U "$DB_USER" -d "$DB" -tAF ' ' -c "$sql" 2>/dev/null) && [ -n "$row" ]; then
    read -r today avg7 <<<"$row"
    echo "# HELP deutschflow_ai_tokens_today Tong token AI tu 00:00 gio VN hom nay."
    echo "# TYPE deutschflow_ai_tokens_today gauge"
    echo "deutschflow_ai_tokens_today $today"
    echo "# HELP deutschflow_ai_tokens_avg_7d Trung binh token AI moi ngay cua 7 ngay truoc."
    echo "# TYPE deutschflow_ai_tokens_avg_7d gauge"
    echo "deutschflow_ai_tokens_avg_7d $avg7"
    ok=1
  else
    ok=0
  fi
  echo "# HELP deutschflow_metrics_query_ok 1 neu truy van DB lan nay thanh cong."
  echo "# TYPE deutschflow_metrics_query_ok gauge"
  echo "deutschflow_metrics_query_ok $ok"
} >"$tmp"

chmod 644 "$tmp"
mv "$tmp" "$OUT"
trap - EXIT
