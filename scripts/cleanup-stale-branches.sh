#!/usr/bin/env bash
# Dọn nhánh local stale — AN TOÀN.
# - Chỉ xoá nhánh ĐÃ MERGED vào main bằng `git branch -d` (git tự từ chối nếu còn commit chưa merged).
# - TỰ BẢO VỆ: main, nhánh đang checkout, 7 nhánh đang có PR mở, và feat/teacher-schedule-pha1.
# - KHÔNG đụng remote. KHÔNG force-delete. Nhánh squash-merged chỉ được LIỆT KÊ để bạn tự quyết.
# Chạy: bash scripts/cleanup-stale-branches.sh
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

# --- Gỡ stale index.lock (thủ phạm khiến mọi git ghi-ref thất bại) ---
# An toàn nếu KHÔNG có tiến trình git nào đang chạy. Kiểm tra trước:
if [ -f .git/index.lock ]; then
  if pgrep -x git >/dev/null 2>&1; then
    echo "⚠ Có tiến trình git đang chạy — đóng nó rồi chạy lại. Không gỡ lock."; exit 1
  fi
  echo "Gỡ stale .git/index.lock (không có git nào đang chạy)…"
  rm -f .git/index.lock || { echo "Không gỡ được lock — gỡ tay: rm -f .git/index.lock"; exit 1; }
fi

# Nhánh PHẢI GIỮ (7 PR mở tính tới 23/06/2026 + Pha 1 + main)
KEEP=(
  main
  feat/teacher-schedule-pha1            # Pha 1 lịch dạy (chưa merge)
  feat/admin-org-dto-fields             # PR #145
  feat/native-openapi-typing            # PR #129
  fix/m5-org-freetier-pool-unlimited    # PR #126
  feat/student-coin-currency            # PR #124
  feat/greeting-xtts-voice              # PR #122
  fix/persona-greeting-voice            # PR #121
  fix/xtts-fallback-when-unreachable    # PR #120
)
is_keep() { local b="$1"; for k in "${KEEP[@]}"; do [ "$b" = "$k" ] && return 0; done; return 1; }

cur=$(git rev-parse --abbrev-ref HEAD)
echo "Nhánh hiện tại: $cur"
echo

echo "==== TẦNG 1: xoá nhánh ĐÃ MERGED vào main (an toàn) ===="
deleted=0
while IFS= read -r b; do
  b="${b#\* }"; b="$(echo "$b" | xargs)"
  [ -z "$b" ] && continue
  is_keep "$b" && { echo "  · giữ (keep-list): $b"; continue; }
  [ "$b" = "$cur" ] && { echo "  · giữ (đang checkout): $b"; continue; }
  err=$(git branch -d "$b" 2>&1) && { echo "  ✓ xoá: $b"; deleted=$((deleted+1)); } || echo "  ✗ $b → $err"
done < <(git branch --merged main --format='%(refname:short)')
echo "→ Đã xoá $deleted nhánh đã-merged."
echo

echo "==== TẦNG 2 (CHỈ LIỆT KÊ — bạn tự quyết): nhánh CHƯA merged & KHÔNG có PR mở ===="
echo "   (có thể là squash-merged cũ HOẶC việc dang dở — KIỂM TRA trước khi xoá -D)"
while IFS= read -r b; do
  b="$(echo "$b" | xargs)"; [ -z "$b" ] && continue
  is_keep "$b" && continue
  ahead=$(git rev-list --count "main..$b" 2>/dev/null || echo "?")
  date=$(git log -1 --format=%cd --date=short "$b" 2>/dev/null || echo "?")
  printf "   %-46s ahead=%-4s last=%s\n" "$b" "$ahead" "$date"
done < <(git branch --no-merged main --format='%(refname:short)')
echo
echo "Gợi ý xoá 1 nhánh squash-merged sau khi đã xác minh (git diff main...<b> không còn gì đáng giữ):"
echo "   git branch -D <branch>"
echo
echo "Dọn tham chiếu remote đã xoá trên GitHub (an toàn, không xoá nhánh remote thật):"
echo "   git fetch --prune"
