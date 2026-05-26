#!/usr/bin/env bash
# ============================================================
# cleanup-deploy.sh — DeutschFlow Post-Deploy Cleanup
#
# Dùng:
#   ./cleanup-deploy.sh            # Interactive — chọn từng phần
#   ./cleanup-deploy.sh all        # Dọn tất cả (local + EC2)
#   ./cleanup-deploy.sh local      # Chỉ local
#   ./cleanup-deploy.sh ec2        # Chỉ EC2
#   ./cleanup-deploy.sh all --force  # Không hỏi xác nhận
#
# ============================================================

set -euo pipefail

# ── Cấu hình ──────────────────────────────────────────────────
readonly PEM_KEY="/Users/dinhcu/Developer/DeutschFlow/deutschflow-key.pem"
readonly EC2_HOST="ubuntu@35.175.232.152"
readonly LOCAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Args ───────────────────────────────────────────────────────
MODE="${1:-interactive}"   # all | local | ec2 | interactive
FORCE="${2:-}"             # --force

# ── Terminal colors ────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
step()    { echo -e "\n${BOLD}${CYAN}▶ $*${NC}"; }

# ── Confirm helper ─────────────────────────────────────────────
confirm() {
  [ "$FORCE" = "--force" ] && return 0
  local msg="$1"
  read -r -p "$msg [y/N] " reply
  case "${reply:-}" in y|Y|yes|YES) return 0 ;; esac
  return 1
}

# ══════════════════════════════════════════════════════════════
# HEADER
# ══════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  DeutschFlow — Post-Deploy Cleanup${NC}"
echo    "  Mode   : $MODE"
echo    "  Started: $(date '+%Y-%m-%d %H:%M:%S')"
echo -e "${BOLD}════════════════════════════════════════════════${NC}"

# ══════════════════════════════════════════════════════════════
# LOCAL CLEANUP
# ══════════════════════════════════════════════════════════════
cleanup_local() {
  step "LOCAL Cleanup"

  # 1. Frontend build artifacts
  if confirm "  Xóa frontend/.next (build cache)?"; then
    if [ -d "$LOCAL_DIR/frontend/.next" ]; then
      rm -rf "$LOCAL_DIR/frontend/.next"
      success "  frontend/.next đã xóa"
    else
      info "  frontend/.next không tồn tại, bỏ qua"
    fi
  fi

  # 2. Frontend node_modules (nặng, tái cài bằng npm ci)
  if confirm "  Xóa frontend/node_modules?"; then
    if [ -d "$LOCAL_DIR/frontend/node_modules" ]; then
      rm -rf "$LOCAL_DIR/frontend/node_modules"
      success "  frontend/node_modules đã xóa"
    else
      info "  frontend/node_modules không tồn tại, bỏ qua"
    fi
  fi

  # 3. Test artifacts
  if confirm "  Xóa test artifacts (playwright-report, test-results)?"; then
    rm -rf "$LOCAL_DIR/frontend/playwright-report" \
           "$LOCAL_DIR/frontend/test-results" \
           "$LOCAL_DIR/frontend/coverage" 2>/dev/null || true
    success "  Test artifacts đã xóa"
  fi

  # 4. Tmp / log files local
  if confirm "  Xóa temp files (/tmp/deutschflow-*)"; then
    rm -f /tmp/deutschflow-*.log /tmp/deutschflow-ssh-*.log 2>/dev/null || true
    success "  Temp files đã xóa"
  fi

  # 5. Backend Maven target (nếu build local)
  if confirm "  Xóa backend/target (Maven build cache)?"; then
    if [ -d "$LOCAL_DIR/backend/target" ]; then
      rm -rf "$LOCAL_DIR/backend/target"
      success "  backend/target đã xóa"
    else
      info "  backend/target không tồn tại, bỏ qua"
    fi
  fi

  success "Local cleanup xong"
}

# ══════════════════════════════════════════════════════════════
# EC2 CLEANUP
# ══════════════════════════════════════════════════════════════
cleanup_ec2() {
  step "EC2 Cleanup"

  # SSH check
  SSH_OPTS=(-i "$PEM_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=10 -o BatchMode=yes)
  if ! ssh "${SSH_OPTS[@]}" "$EC2_HOST" "echo ok" &>/dev/null; then
    warn "Không kết nối được EC2 ($EC2_HOST) — bỏ qua EC2 cleanup"
    return 0
  fi
  success "EC2 kết nối OK"

  if ! confirm "  Chạy cleanup trên EC2?"; then
    info "EC2 cleanup bị bỏ qua"
    return 0
  fi

  ssh "${SSH_OPTS[@]}" \
      -o ServerAliveInterval=20 \
      -o ServerAliveCountMax=3 \
      "$EC2_HOST" bash -s << 'ENDSSH'
set -euo pipefail
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }

EC2_DIR="/home/ubuntu/DeutschFlow"

# 1. Docker images dangling
echo ""
info "[1/5] Xóa Docker images dangling..."
DANGLING=$(sudo docker images -f "dangling=true" -q 2>/dev/null || echo "")
if [ -n "$DANGLING" ]; then
  sudo docker rmi $DANGLING 2>/dev/null && success "  Đã xóa $(echo "$DANGLING" | wc -l) dangling images" || warn "  Một số images không xóa được (đang dùng)"
else
  success "  Không có dangling images"
fi

# 2. Docker images deutschflow cũ (giữ :latest)
echo ""
info "[2/5] Xóa Docker images deutschflow cũ (không phải :latest)..."
OLD_IMGS=$(sudo docker images "deutschflow-backend" --format "{{.ID}} {{.Tag}}" 2>/dev/null \
  | grep -v "latest" | awk '{print $1}' || echo "")
if [ -n "$OLD_IMGS" ]; then
  echo "$OLD_IMGS" | xargs sudo docker rmi 2>/dev/null && success "  Đã xóa images cũ" || warn "  Một số images không xóa được"
else
  success "  Không có images cũ"
fi

# 3. Docker build cache
echo ""
info "[3/5] Xóa Docker build cache..."
sudo docker builder prune -f 2>/dev/null && success "  Build cache đã xóa" || warn "  Không xóa được build cache"

# 4. Stopped containers (loại trừ các container đang chạy)
echo ""
info "[4/5] Xóa stopped containers..."
STOPPED=$(sudo docker ps -a -f status=exited -f status=created -q 2>/dev/null || echo "")
if [ -n "$STOPPED" ]; then
  sudo docker rm $STOPPED 2>/dev/null && success "  Đã xóa $(echo "$STOPPED" | wc -l) containers cũ" || warn "  Một số containers không xóa được"
else
  success "  Không có stopped containers"
fi

# 5. Log files EC2
echo ""
info "[5/5] Xóa log files tạm..."
rm -f /tmp/deutschflow-*.log /tmp/deutschflow-ssh-*.log 2>/dev/null || true
# Giữ edge-tts.log nhưng truncate nếu > 50MB
EDGELOG="/home/ubuntu/edge-tts.log"
if [ -f "$EDGELOG" ]; then
  SIZE_MB=$(du -m "$EDGELOG" 2>/dev/null | awk '{print $1}')
  if [ "${SIZE_MB:-0}" -gt 50 ]; then
    tail -n 1000 "$EDGELOG" > /tmp/edge-tts-trim.log && mv /tmp/edge-tts-trim.log "$EDGELOG"
    success "  edge-tts.log trimmed (${SIZE_MB}MB → giữ 1000 dòng cuối)"
  else
    success "  edge-tts.log OK (${SIZE_MB}MB)"
  fi
fi

# Disk sau cleanup
DISK_AFTER=$(df -h / | awk 'NR==2 {print $3 "/" $2 " (" $5 ")"}')
echo ""
echo "  Disk sau cleanup: $DISK_AFTER"
echo -e "  ${GREEN}EC2 cleanup xong ✓${NC}"
ENDSSH

  success "EC2 cleanup hoàn tất"
}

# ══════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════
case "$MODE" in
  all)
    cleanup_local
    cleanup_ec2
    ;;
  local)
    cleanup_local
    ;;
  ec2)
    cleanup_ec2
    ;;
  interactive)
    echo ""
    echo "Chọn phạm vi cleanup:"
    echo "  1) Local + EC2"
    echo "  2) Chỉ Local"
    echo "  3) Chỉ EC2"
    echo "  4) Hủy"
    read -r -p "Lựa chọn [1-4]: " CHOICE
    case "${CHOICE:-4}" in
      1) cleanup_local; cleanup_ec2 ;;
      2) cleanup_local ;;
      3) cleanup_ec2 ;;
      *) info "Đã hủy."; exit 0 ;;
    esac
    ;;
  *)
    echo "Usage: $0 [all|local|ec2] [--force]"
    exit 1
    ;;
esac

echo ""
echo -e "${BOLD}════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Cleanup hoàn tất! $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo -e "${BOLD}════════════════════════════════════════════════${NC}"
echo ""
