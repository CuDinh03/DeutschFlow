#!/usr/bin/env bash
# uptime-check.sh — KIỂM (chỉ đọc) hai endpoint mà uptime monitor bên ngoài sẽ gọi (V-09).
#
# Vì sao: Prometheus + Alertmanager đều chạy TRÊN chính con EC2 mà chúng giám sát ⇒ máy chết là
# giám sát chết theo, không ai được báo. Runbook docs/UPTIME_MONITOR_RUNBOOK.md mô tả cách đăng ký
# monitor bên thứ ba; script này chạy đúng hai phép kiểm mà monitor đó sẽ chạy, để biết endpoint có
# hành xử như mong đợi TRƯỚC khi đi đổ lỗi cho dịch vụ monitor.
#
# KHÔNG sửa gì, KHÔNG cần credential. URL mặc định là địa chỉ công khai (đã có trong
# docker/deutschflow.nginx.conf). Repo PUBLIC — đừng thêm token/endpoint nội bộ vào file này.
#
# Dùng:  scripts/ops/uptime-check.sh
#        API_HEALTH_URL=https://.../actuator/health WEB_URL=https://.../ scripts/ops/uptime-check.sh
#        TIMEOUT=20 scripts/ops/uptime-check.sh
# Thoát: 0 = cả hai đạt · 2 = có mục không đạt · 1 = dùng sai / thiếu curl.
set -uo pipefail

API_HEALTH_URL="${API_HEALTH_URL:-https://api.mydeutschflow.com/actuator/health}"
WEB_URL="${WEB_URL:-https://mydeutschflow.com/}"
TIMEOUT="${TIMEOUT:-10}"

# Chuỗi mà /actuator/health trả về cho người gọi ẨN DANH. show-details=when_authorized nên body chỉ
# có đúng field status — đừng kỳ vọng chi tiết thành phần ở đây.
API_EXPECT_BODY='"status":"UP"'

# classify_probe <http_code> <body> <expect_code> [expect_substring]
# Hàm THUẦN: không gọi mạng, không đọc biến toàn cục — để test được (uptime-check.test.sh).
# In một dòng lý do ra stdout; thoát 0 nếu đạt, 2 nếu không.
classify_probe() {
  local code="$1" body="$2" expect_code="$3" expect_sub="${4:-}"

  if [ "$code" = "000" ] || [ -z "$code" ]; then
    echo "KHÔNG KẾT NỐI ĐƯỢC (curl không nhận được phản hồi — DNS, mạng, TLS, hoặc host đang chết)"
    return 2
  fi
  if [ "$code" != "$expect_code" ]; then
    echo "SAI MÃ HTTP: nhận $code, mong đợi $expect_code"
    return 2
  fi
  if [ -n "$expect_sub" ] && [ "${body#*"$expect_sub"}" = "$body" ]; then
    echo "THIẾU CHUỖI MONG ĐỢI: body không chứa $expect_sub"
    return 2
  fi
  echo "đạt (HTTP $code${expect_sub:+, có $expect_sub})"
  return 0
}

# Chạy dưới dạng thư viện (cho test) thì dừng ở đây, không gọi mạng.
if [ "${UPTIME_CHECK_LIB:-0}" = "1" ]; then
  return 0 2>/dev/null || exit 0
fi

command -v curl >/dev/null 2>&1 || { echo "Thiếu lệnh: curl" >&2; exit 1; }

status=0

# probe <nhãn> <url> <expect_code> [expect_substring]
probe() {
  local label="$1" url="$2" expect_code="$3" expect_sub="${4:-}"
  local body code reason rc

  # -w gắn mã HTTP vào CUỐI body; curl lỗi (DNS/TLS/timeout) thì không in gì ⇒ ép về 000.
  body=$(curl -sS -L --max-time "$TIMEOUT" -w '%{http_code}' "$url" 2>/dev/null) || body="${body:-}000"
  code="${body: -3}"
  body="${body:0:${#body}-3}"

  reason=$(classify_probe "$code" "$body" "$expect_code" "$expect_sub"); rc=$?
  if [ "$rc" -eq 0 ]; then
    echo "  OK   $label — $reason"
  else
    echo "  LỖI  $label — $reason"
    status=2
  fi
}

echo "== Kiểm endpoint uptime (timeout ${TIMEOUT}s) =="
probe "API health  $API_HEALTH_URL" "$API_HEALTH_URL" 200 "$API_EXPECT_BODY"
probe "Web         $WEB_URL"        "$WEB_URL"        200

echo
if [ "$status" -eq 0 ]; then
  echo "Cả hai endpoint hành xử đúng như monitor sẽ kỳ vọng."
  echo "Bước tiếp: đăng ký monitor theo docs/UPTIME_MONITOR_RUNBOOK.md §3, rồi tự kiểm kênh theo §4."
else
  echo "Có mục KHÔNG đạt — đăng ký monitor bây giờ thì nó sẽ kêu ngay."
  echo "Xem docs/UPTIME_MONITOR_RUNBOOK.md §2.3 (ngữ nghĩa health) và §6 (giới hạn đã biết)."
fi
exit "$status"
