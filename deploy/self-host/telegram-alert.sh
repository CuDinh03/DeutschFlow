#!/usr/bin/env bash
# ============================================================
# telegram-alert.sh — gửi một tin Telegram TRỰC TIẾP (không qua Prometheus/Alertmanager).
#
# Dùng cho sự cố mà hệ giám sát có thể không thấy, chủ yếu: unit systemd thất bại
# (OnFailure=deutschflow-alert@%n.service — xem deploy/self-host/systemd/).
#
#   telegram-alert.sh "<tiêu đề>" ["<nội dung>"]
#   telegram-alert.sh --unit <tên-unit>       # gửi kèm 15 dòng journal cuối của unit đó
#
# Bí mật ngoài repo:
#   /home/deploy/secrets/telegram_bot_token   token bot (owner tạo qua @BotFather), quyền 600
#   /srv/deutschflow/env/telegram.env         TELEGRAM_CHAT_ID=<số> (không phải bí mật)
# Thiếu một trong hai ⇒ in cảnh báo ra journal và thoát 0 (không làm unit gọi nó đỏ theo).
# ============================================================
set -uo pipefail

TOKEN_FILE=/home/deploy/secrets/telegram_bot_token
CHAT_ENV=/srv/deutschflow/env/telegram.env

if [ ! -s "$TOKEN_FILE" ] || [ ! -s "$CHAT_ENV" ]; then
  echo "telegram-alert: chưa cấu hình ($TOKEN_FILE hoặc $CHAT_ENV) — bỏ qua" >&2
  exit 0
fi
# shellcheck disable=SC1090
. "$CHAT_ENV"
[ -n "${TELEGRAM_CHAT_ID:-}" ] || { echo "telegram-alert: thiếu TELEGRAM_CHAT_ID" >&2; exit 0; }

host=$(hostname)
if [ "${1:-}" = "--unit" ]; then
  unit=${2:?thiếu tên unit}
  title="🔴 $unit thất bại trên $host"
  body=$(journalctl -u "$unit" -n 15 --no-pager -o cat 2>/dev/null | tail -c 3000)
else
  title=${1:?thiếu tiêu đề}
  body=${2:-}
fi

text=$(printf '%s\n%s\n%s' "$title" "$(date -u +%FT%TZ)" "$body")

# Token đọc từ file và đưa vào URL qua curl --config trên stdin ⇒ không lộ trong `ps`.
curl -sS --max-time 15 -o /dev/null -w '%{http_code}' \
  --config - \
  --data-urlencode "chat_id=$TELEGRAM_CHAT_ID" \
  --data-urlencode "text=$text" \
  --data-urlencode "disable_web_page_preview=true" <<EOF | grep -q '^200$' || { echo "telegram-alert: gửi thất bại" >&2; exit 1; }
url = "https://api.telegram.org/bot$(tr -d '\n\r ' <"$TOKEN_FILE")/sendMessage"
EOF
echo "telegram-alert: đã gửi"
