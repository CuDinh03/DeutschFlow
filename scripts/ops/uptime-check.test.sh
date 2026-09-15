#!/usr/bin/env bash
# uptime-check.test.sh — test cho classify_probe() trong uptime-check.sh (V-09).
#
# Không gọi mạng: nạp uptime-check.sh ở chế độ thư viện (UPTIME_CHECK_LIB=1) rồi bắn các cặp
# (mã HTTP, body) vào hàm thuần. Chạy:  bash scripts/ops/uptime-check.test.sh
# Thoát 0 = tất cả xanh · 1 = có ca đỏ.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UPTIME_CHECK_LIB=1 . "$HERE/uptime-check.sh"

pass=0; fail=0

# expect_rc <mã mong đợi> <nhãn ca> <http_code> <body> <expect_code> [expect_sub]
expect_rc() {
  local want="$1" name="$2"; shift 2
  local out rc
  out=$(classify_probe "$@"); rc=$?
  if [ "$rc" -eq "$want" ]; then
    pass=$((pass+1)); echo "  ok   $name"
  else
    fail=$((fail+1)); echo "  ĐỎ   $name — mong rc=$want, nhận rc=$rc ($out)"
  fi
}

# expect_msg <chuỗi phải có trong lý do> <nhãn ca> <http_code> <body> <expect_code> [expect_sub]
expect_msg() {
  local want="$1" name="$2"; shift 2
  local out
  out=$(classify_probe "$@")
  if [ "${out#*"$want"}" != "$out" ]; then
    pass=$((pass+1)); echo "  ok   $name"
  else
    fail=$((fail+1)); echo "  ĐỎ   $name — lý do không chứa '$want', nhận: $out"
  fi
}

echo "== classify_probe =="

# Ca sống: đúng mã + đúng keyword.
expect_rc 0 "200 + có status UP  → đạt" \
  200 '{"status":"UP"}' 200 '"status":"UP"'
expect_rc 0 "200 không cần keyword (monitor web) → đạt" \
  200 '<!doctype html><html>…</html>' 200

# Ca backend chết: Spring trả 503 khi health DOWN.
expect_rc 2 "503 health DOWN → không đạt" \
  503 '{"status":"DOWN"}' 200 '"status":"UP"'

# Ca cả máy biến mất — chính là ca mà Prometheus trên EC2 KHÔNG bao giờ bắt được.
expect_rc 2 "000 không kết nối được → không đạt" \
  000 '' 200 '"status":"UP"'
expect_msg "KHÔNG KẾT NỐI ĐƯỢC" "000 nói rõ là mất kết nối, không phải sai mã" \
  000 '' 200 '"status":"UP"'
expect_rc 2 "mã rỗng → không đạt (curl lỗi sớm)" \
  '' '' 200 '"status":"UP"'

# Ca nguy hiểm nhất: trang lỗi/CDN trả 200 nhưng nội dung sai ⇒ chỉ dựa vào mã HTTP là mù.
expect_rc 2 "200 nhưng thiếu keyword → không đạt" \
  200 '{"status":"DOWN"}' 200 '"status":"UP"'
expect_msg "THIẾU CHUỖI MONG ĐỢI" "200 thiếu keyword phải nói đúng lý do" \
  200 'trang bao tri' 200 '"status":"UP"'

# Nhận nhầm mã khác 200.
expect_rc 2 "404 (endpoint bị nginx deny) → không đạt" \
  404 'nginx' 200 '"status":"UP"'
expect_msg "SAI MÃ HTTP" "301 phải báo sai mã, không báo thiếu keyword" \
  301 '' 200 '"status":"UP"'

# Keyword là khớp CHUỖI CON, không phải khớp cả body.
expect_rc 0 "keyword nằm giữa body dài → đạt" \
  200 '{"groups":["liveness"],"status":"UP","x":1}' 200 '"status":"UP"'

echo
echo "pass=$pass fail=$fail"
[ "$fail" -eq 0 ] || exit 1
