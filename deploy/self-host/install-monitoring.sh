#!/usr/bin/env bash
# ============================================================
# install-monitoring.sh — cài/cập nhật giám sát nhẹ trên VM tự host. Chạy lại bao nhiêu lần cũng được.
#
#   bash deploy/self-host/install-monitoring.sh               # cài/cập nhật
#   bash deploy/self-host/install-monitoring.sh --test-alert  # bắn 1 cảnh báo thử (Alertmanager + Telegram trực tiếp)
#   bash deploy/self-host/install-monitoring.sh --status      # in tình trạng target + alert đang nổ
#
# Chạy bằng user deploy (có sudo) từ /srv/deutschflow/repo. Không in giá trị bí mật nào.
# Xem docs/GIAM_SAT_TU_HOST.md.
# ============================================================
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"

REPO=/srv/deutschflow/repo
SECRETS=/home/deploy/secrets
ENV_DIR=/srv/deutschflow/env
TEXTFILE_DIR=/var/lib/node_exporter/textfile_collector
COMPOSE=(docker compose -p deutschflow-monitoring -f "$REPO/deploy/self-host/monitoring.compose.yml")
SCRAPE_TOKEN_FILE=$SECRETS/prometheus_scrape_token
TG_TOKEN_FILE=$SECRETS/telegram_bot_token
TG_ENV=$ENV_DIR/telegram.env
AM_CONFIG=$ENV_DIR/alertmanager.yml

status() {
  step "Target Prometheus"
  curl -fsS 127.0.0.1:9090/api/v1/targets \
    | jq -r '.data.activeTargets[] | "\(.labels.job)\t\(.labels.instance)\t\(.health)\t\(.lastError)"' || warn "Prometheus chưa trả lời"
  step "Alert đang nổ"
  curl -fsS 127.0.0.1:9090/api/v1/alerts | jq -r '.data.alerts[] | "\(.labels.alertname)\t\(.state)"' || true
  step "Số đo textfile"
  grep -v '^#' "$TEXTFILE_DIR/deutschflow.prom" 2>/dev/null || warn "chưa có $TEXTFILE_DIR/deutschflow.prom"
  step "RAM"
  free -m | head -2
  docker stats --no-stream --format '{{.Name}}\t{{.MemUsage}}' deutschflow-prometheus deutschflow-alertmanager deutschflow-node-exporter 2>/dev/null || true
}

test_alert() {
  step "Cảnh báo thử qua Alertmanager"
  local now ends
  now=$(date -u +%FT%TZ); ends=$(date -u -d '+5 min' +%FT%TZ)
  curl -fsS -X POST -H 'Content-Type: application/json' 127.0.0.1:9093/api/v2/alerts -d "[{
    \"labels\": {\"alertname\": \"DeutschflowTestAlert\", \"severity\": \"warning\"},
    \"annotations\": {\"summary\": \"Cảnh báo THỬ — bỏ qua\", \"description\": \"Bắn tay bằng install-monitoring.sh --test-alert lúc $now.\"},
    \"startsAt\": \"$now\", \"endsAt\": \"$ends\"}]" >/dev/null && success "đã gửi vào Alertmanager (tin Telegram tới sau ~30s)"
  step "Cảnh báo thử Telegram trực tiếp (đường OnFailure)"
  "$REPO/deploy/self-host/telegram-alert.sh" "🧪 Thử đường báo trực tiếp từ $(hostname)" "Bỏ qua tin này."
}

case "${1:-install}" in
  --status) status; exit 0 ;;
  --test-alert) test_alert; exit 0 ;;
  install) ;;
  *) error "tham số lạ: $1"; exit 1 ;;
esac

step "Thư mục textfile collector"
sudo install -d -o deploy -g deploy -m 755 "$TEXTFILE_DIR"
success "$TEXTFILE_DIR"

step "Token scrape Prometheus ↔ backend"
install -d -m 700 "$SECRETS"
if [ ! -s "$SCRAPE_TOKEN_FILE" ]; then
  (umask 077; openssl rand -hex 32 | tr -d '\n' >"$SCRAPE_TOKEN_FILE")
  success "sinh token mới vào $SCRAPE_TOKEN_FILE"
fi
chmod 644 "$SCRAPE_TOKEN_FILE"   # container Prometheus chạy user nobody phải đọc được; thư mục cha vẫn 700
if grep -qE '^PROMETHEUS_SCRAPE_TOKEN=.' "$ENV_DIR/backend.env"; then
  if [ "$(grep -E '^PROMETHEUS_SCRAPE_TOKEN=' "$ENV_DIR/backend.env" | tail -1 | cut -d= -f2-)" = "$(cat "$SCRAPE_TOKEN_FILE")" ]; then
    success "backend.env đã khớp token"
  else
    warn "backend.env có PROMETHEUS_SCRAPE_TOKEN KHÁC file token — sửa tay cho khớp rồi deploy lại backend"
  fi
else
  cp -p "$ENV_DIR/backend.env" "$ENV_DIR/backend.env.bak-$(date +%F-%H%M)"
  printf '\nPROMETHEUS_SCRAPE_TOKEN=%s\n' "$(cat "$SCRAPE_TOKEN_FILE")" >>"$ENV_DIR/backend.env"
  warn "đã thêm PROMETHEUS_SCRAPE_TOKEN vào backend.env — có hiệu lực ở LẦN DEPLOY BACKEND KẾ TIẾP (tới lúc đó target backend báo 401)"
fi

step "Cấu hình Alertmanager"
[ -e "$TG_TOKEN_FILE" ] || (umask 077; : >"$TG_TOKEN_FILE")
chmod 644 "$TG_TOKEN_FILE"
chat_id=""
[ -s "$TG_ENV" ] && chat_id=$(. "$TG_ENV"; echo "${TELEGRAM_CHAT_ID:-}")
if [ -s "$TG_TOKEN_FILE" ] && [[ "$chat_id" =~ ^-?[0-9]+$ ]]; then
  sed "s/__TELEGRAM_CHAT_ID__/$chat_id/" "$REPO/docker/alertmanager/alertmanager.yml.example" >"$AM_CONFIG.tmp"
  success "Telegram: bật"
else
  # Chưa có bot ⇒ receiver rỗng: alert vẫn hiện ở 127.0.0.1:9093 nhưng không gửi đi đâu.
  cat >"$AM_CONFIG.tmp" <<'EOF'
# Sinh bởi install-monitoring.sh khi CHƯA cấu hình Telegram (thiếu token bot hoặc TELEGRAM_CHAT_ID).
route:
  receiver: 'none'
receivers:
  - name: 'none'
EOF
  warn "Telegram: CHƯA cấu hình — cảnh báo chỉ hiện ở Alertmanager. Xem docs/GIAM_SAT_TU_HOST.md §2"
fi
chmod 644 "$AM_CONFIG.tmp"; mv "$AM_CONFIG.tmp" "$AM_CONFIG"

step "Unit systemd"
for u in deutschflow-metrics.service deutschflow-metrics.timer deutschflow-alert@.service deutschflow-backup.service deutschflow-backup.timer; do
  sudo install -m 644 "$REPO/deploy/self-host/systemd/$u" "/etc/systemd/system/$u"
done
sudo systemctl daemon-reload
sudo systemctl enable --now deutschflow-metrics.timer >/dev/null
sudo systemctl start deutschflow-metrics.service
success "deutschflow-metrics.timer chạy; backup có OnFailure"

step "Container giám sát"
"${COMPOSE[@]}" up -d
sleep 5
curl -fsS -X POST 127.0.0.1:9090/-/reload >/dev/null && success "Prometheus nạp lại config"
docker kill -s HUP deutschflow-alertmanager >/dev/null && success "Alertmanager nạp lại config"

status
