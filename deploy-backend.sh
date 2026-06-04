#!/usr/bin/env bash
# ============================================================
# deploy-backend.sh — DeutschFlow Backend Deploy (Blue-Green)
#
# Luồng:
#   1. LOCAL  : preflight checks (PEM, .env, disk, git)
#   2. LOCAL  : commit + push code lên GitHub
#   3. LOCAL  : sync .env.production + google-sa.json lên EC2
#   4. EC2    : pull code, setup Edge TTS, đảm bảo Redis
#   5. EC2    : build image mới
#   6. EC2    : khởi động GREEN (port 8081), health check
#   7. EC2    : graceful stop BLUE → promote GREEN lên 8080
#   8. EC2    : cleanup images cũ, final health check + report
#
# Dùng:
#   ./deploy-backend.sh                                  # deploy 'main' (mặc định)
#   DEPLOY_BRANCH=feat/my-fix ./deploy-backend.sh        # deploy 1 branch khác (hotfix có chủ đích)
# ============================================================

set -euo pipefail

# ── Cấu hình ──────────────────────────────────────────────────
readonly PEM_KEY="/Users/dinhcu/Developer/DeutschFlow/deutschflow-key.pem"
readonly EC2_HOST="ubuntu@35.175.232.152"
readonly EC2_DIR="/home/ubuntu/DeutschFlow"
readonly LOCAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Mặc định deploy 'main'. Override khi cần ship 1 branch khác: DEPLOY_BRANCH=feat/... ./deploy-backend.sh
readonly BRANCH="${DEPLOY_BRANCH:-main}"
readonly ENV_FILE="$LOCAL_DIR/.env.production"
readonly GOOGLE_SA_JSON="$LOCAL_DIR/google-sa.json"
readonly DEPLOY_START=$(date +%s)

# ── Terminal colors ────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
step()    { echo -e "\n${BOLD}${CYAN}▶ $*${NC}"; }

# ── Trap: cleanup khi bị interrupt ────────────────────────────
trap 'echo -e "\n${RED}[INTERRUPTED]${NC} Deploy bị dừng. Kiểm tra trạng thái server thủ công." >&2' INT TERM

# ── Elapsed time helper ────────────────────────────────────────
elapsed() { echo $(( $(date +%s) - DEPLOY_START ))s; }

# ══════════════════════════════════════════════════════════════
# HEADER
# ══════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  DeutschFlow Backend Deploy  │  Blue-Green${NC}"
echo    "  Branch : $BRANCH"
echo    "  Target : $EC2_HOST"
echo    "  Started: $(date '+%Y-%m-%d %H:%M:%S')"
echo -e "${BOLD}════════════════════════════════════════════════${NC}"

# ══════════════════════════════════════════════════════════════
# PHASE 0: PREFLIGHT CHECKS
# ══════════════════════════════════════════════════════════════
step "PHASE 0: Preflight checks"

# PEM key
if [ ! -f "$PEM_KEY" ]; then
  error "PEM key không tìm thấy: $PEM_KEY"; exit 1
fi
chmod 400 "$PEM_KEY"
success "PEM key: OK"

# .env.production
if [ ! -f "$ENV_FILE" ]; then
  error ".env.production không tìm thấy: $ENV_FILE"; exit 1
fi

# Kiểm tra biến bắt buộc (JWT verifier kiểm riêng bên dưới — hỗ trợ cả HS256 lẫn RS256)
REQUIRED_VARS=(DB_HOST DB_PASSWORD GROQ_API_KEY AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY GEMINI_API_KEY UNSPLASH_ENABLED UNSPLASH_ACCESS_KEY UNSPLASH_APPLICATION_NAME UNSPLASH_TIMEOUT_MS UNSPLASH_CONNECT_TIMEOUT_MS UNSPLASH_MAX_RETRY_ATTEMPTS)
MISSING=()
for VAR in "${REQUIRED_VARS[@]}"; do
  grep -q "^${VAR}=" "$ENV_FILE" 2>/dev/null || MISSING+=("$VAR")
done
if [ ${#MISSING[@]} -gt 0 ]; then
  error ".env.production thiếu biến: ${MISSING[*]}"; exit 1
fi

# JWT verifier (S18): chấp nhận HS256 (JWT_SECRET) HOẶC RS256 (algorithm=RS256 + cặp RSA key).
# Dùng "=." để yêu cầu value KHÔNG rỗng.
JWT_ALG_VAL=$(grep "^JWT_ALGORITHM=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2-)
if grep -q "^JWT_SECRET=." "$ENV_FILE" 2>/dev/null; then
  success ".env.production: JWT = HS256 (JWT_SECRET set)"
elif [ "$JWT_ALG_VAL" = "RS256" ] \
     && grep -q "^JWT_RSA_PRIVATE_KEY=." "$ENV_FILE" 2>/dev/null \
     && grep -q "^JWT_RSA_PUBLIC_KEY=." "$ENV_FILE" 2>/dev/null; then
  success ".env.production: JWT = RS256 (private+public set, JWT_SECRET removed)"
else
  error ".env.production: thiếu cấu hình JWT — cần JWT_SECRET (HS256),"
  error "  HOẶC JWT_ALGORITHM=RS256 + JWT_RSA_PRIVATE_KEY + JWT_RSA_PUBLIC_KEY (RS256)."
  exit 1
fi
success ".env.production: đầy đủ (${#REQUIRED_VARS[@]} biến core + JWT verifier)"

# Google SA JSON
if [ -f "$GOOGLE_SA_JSON" ]; then
  success "Google SA credentials: tìm thấy"
  HAS_GOOGLE_SA=true
else
  warn "Google SA credentials: không tìm thấy → sẽ fallback sang POI"
  HAS_GOOGLE_SA=false
fi

# Git branch
cd "$LOCAL_DIR"
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  error "Đang ở branch '$CURRENT_BRANCH' nhưng deploy target là '$BRANCH'."
  error "→ Checkout '$BRANCH', hoặc deploy branch hiện tại: DEPLOY_BRANCH='$CURRENT_BRANCH' $0"
  exit 1
fi
success "Git branch: $CURRENT_BRANCH"
if [ "$BRANCH" != "main" ]; then
  warn "Deploy branch KHÔNG phải 'main' (đang deploy '$BRANCH') — chỉ dùng cho hotfix/feature có chủ đích."
fi

# SSH connectivity test + diagnostics
SSH_HOST="${EC2_HOST#*@}"
SSH_USER="${EC2_HOST%@*}"
SSH_PORT="${SSH_PORT:-22}"
SSH_COMMON_OPTS=(-i "$PEM_KEY" -p "$SSH_PORT" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10 -o BatchMode=yes)

ssh_diagnose_failure() {
  local host="$1"
  local key="$2"
  local port="$3"
  echo ""
  warn "=== SSH diagnostics ==="
  warn "Target: ${SSH_USER}@${host}:${port}"
  if [ -f "$key" ]; then
    ls -l "$key" 2>/dev/null || true
    if command -v stat >/dev/null 2>&1; then
      stat -f "PEM perms: %Sp (%OLp)" "$key" 2>/dev/null || true
    fi
  fi
  warn "Local SSH config (resolved):"
  ssh -G -i "$key" -p "$port" "$host" 2>/dev/null | awk 'BEGIN{count=0} {print; count++} count>=25{exit}' || true
  warn "Network checks:"
  if command -v nc >/dev/null 2>&1; then
    if nc -vz -w 5 "$host" "$port" >/tmp/deutschflow-ssh-nc.log 2>&1; then
      success "TCP connect to ${host}:${port}: OK"
    else
      warn "TCP connect failed (${host}:${port})"
      cat /tmp/deutschflow-ssh-nc.log 2>/dev/null || true
    fi
  else
    warn "nc not available locally; skip TCP probe"
  fi
  warn "SSH handshake preview (first 120 debug lines):"
  local debug_log
  debug_log=$(mktemp /tmp/deutschflow-ssh-debug.XXXXXX)
  ssh -vvv "${SSH_COMMON_OPTS[@]}" "$SSH_USER@$host" "echo ok" >"$debug_log" 2>&1 || true
  sed -n '1,120p' "$debug_log" 2>/dev/null || true
  rm -f "$debug_log" 2>/dev/null || true
  warn "Likely causes: key mismatch/permissions, EC2 security group inbound rule, instance stopped, wrong public IP/DNS, or local network blocking port 22."
}

if ! ssh "${SSH_COMMON_OPTS[@]}" "$EC2_HOST" "echo ok" &>/dev/null; then
  error "Không kết nối được EC2: $EC2_HOST"
  ssh_diagnose_failure "$SSH_HOST" "$PEM_KEY" "$SSH_PORT"
  exit 1
fi
success "EC2 connectivity: OK"

# ══════════════════════════════════════════════════════════════
# PHASE 1: LOCAL — Commit + Push
# ══════════════════════════════════════════════════════════════
step "PHASE 1: Commit & Push"

if [ -n "$(git status --porcelain)" ]; then
  info "Có thay đổi chưa commit, đang commit..."
  git add -A
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
  git commit -m "deploy: auto-commit $TIMESTAMP" --no-verify
  success "Committed"
else
  info "Working tree sạch, không cần commit"
fi

info "Pushing lên GitHub ($BRANCH)..."
if ! git push origin "$BRANCH"; then
  error "Push thất bại. Kiểm tra remote conflicts."; exit 1
fi
success "Pushed lên GitHub → $(git rev-parse --short HEAD)"

# ══════════════════════════════════════════════════════════════
# PHASE 2: Sync files lên EC2
# ══════════════════════════════════════════════════════════════
step "PHASE 2: Sync files lên EC2"

SCP_OPTS=(-i "$PEM_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=15)

scp "${SCP_OPTS[@]}" "$ENV_FILE" "$EC2_HOST:$EC2_DIR/.env.production"
success ".env.production synced"

if [ "$HAS_GOOGLE_SA" = true ]; then
  scp "${SCP_OPTS[@]}" "$GOOGLE_SA_JSON" "$EC2_HOST:/home/ubuntu/google-sa.json"
  success "google-sa.json synced"
fi

# ══════════════════════════════════════════════════════════════
# PHASE 3–8: EC2 — Pull + Build + Blue-Green Deploy
# ══════════════════════════════════════════════════════════════
step "PHASE 3-8: EC2 Deploy"

# Truyền biến HAS_GOOGLE_SA vào heredoc qua env
export HAS_GOOGLE_SA

ssh -i "$PEM_KEY" \
    -o StrictHostKeyChecking=no \
    -o ConnectTimeout=15 \
    -o ServerAliveInterval=20 \
    -o ServerAliveCountMax=6 \
    "$EC2_HOST" bash -s -- "$HAS_GOOGLE_SA" "$BRANCH" << 'ENDSSH'
set -euo pipefail
HAS_GOOGLE_SA="${1:-false}"
DEPLOY_BRANCH="${2:-main}"

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }

EC2_DIR="/home/ubuntu/DeutschFlow"
ENV_FILE="$EC2_DIR/.env.production"

# ── [1/6] Disk space check ────────────────────────────────────
echo ""
info "[1/6] Kiểm tra disk space..."
DISK_PCT=$(df / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')
if [ "$DISK_PCT" -gt 90 ]; then
  warn "Disk ${DISK_PCT}% — dọn dẹp Docker trước khi build..."
  sudo docker system prune -f --volumes 2>/dev/null || true
elif [ "$DISK_PCT" -gt 80 ]; then
  warn "Disk ${DISK_PCT}% — dọn images cũ..."
  sudo docker image prune -f 2>/dev/null || true
fi
DISK_INFO=$(df -h / | awk 'NR==2 {print $3 "/" $2 " (" $5 ")"}')
success "Disk: $DISK_INFO"

# ── [2/6] Pull code ───────────────────────────────────────────
echo ""
info "[2/6] Pull code từ GitHub (branch: $DEPLOY_BRANCH)..."
cd "$EC2_DIR"
git fetch origin "$DEPLOY_BRANCH" --quiet
git checkout "$DEPLOY_BRANCH" --quiet 2>/dev/null || git checkout -b "$DEPLOY_BRANCH" "origin/$DEPLOY_BRANCH" --quiet
git reset --hard "origin/$DEPLOY_BRANCH" --quiet
COMMIT=$(git log --oneline -1)
success "$COMMIT"

# ── [3/6] Edge TTS sidecar ────────────────────────────────────
echo ""
info "[3/6] Kiểm tra Edge TTS sidecar..."
VENV_DIR="/home/ubuntu/edge-tts-venv"

if [ ! -x "$VENV_DIR/bin/python" ]; then
  info "  Tạo Python venv..."
  PY_VER=$(python3 -c 'import sys; print(f"{sys.version_info[0]}.{sys.version_info[1]}")' 2>/dev/null || echo "3")
  sudo apt-get install -y -qq python3-venv "python${PY_VER}-venv" 2>/dev/null || \
    sudo apt-get install -y -qq python3-venv 2>/dev/null || true
  python3 -m venv "$VENV_DIR"
fi

"$VENV_DIR/bin/pip" install -q -r "$EC2_DIR/backend/edge-tts-sidecar/requirements.txt"

EDGE_HEALTH=$(curl -sf http://localhost:5050/health 2>/dev/null || echo "")
if ! echo "$EDGE_HEALTH" | grep -q '"ok"'; then
  info "  Khởi động lại Edge TTS..."
  pkill -f "edge-tts-sidecar/server.py" 2>/dev/null || true
  sleep 1
  nohup "$VENV_DIR/bin/python" "$EC2_DIR/backend/edge-tts-sidecar/server.py" \
    > /home/ubuntu/edge-tts.log 2>&1 &
  sleep 4
  EDGE_HEALTH=$(curl -sf http://localhost:5050/health 2>/dev/null || echo "")
fi

if echo "$EDGE_HEALTH" | grep -q '"ok"'; then
  success "  Edge TTS sẵn sàng"
else
  warn "  Edge TTS chưa sẵn sàng (backend sẽ tự retry)"
fi

# ── [4/6] Redis ───────────────────────────────────────────────
echo ""
info "[4/6] Kiểm tra Redis..."

# User-defined network → DNS theo TÊN container, bền khi reboot/restart (IP container có thể đổi,
# nhưng tên 'deutschflow-redis' luôn resolve đúng). Tạo idempotent.
sudo docker network create deutschflow-net >/dev/null 2>&1 && info "  Tạo network deutschflow-net" || true

if ! sudo docker ps --format '{{.Names}}' | grep -q "^deutschflow-redis$"; then
  info "  Khởi động Redis container..."
  sudo docker rm -f deutschflow-redis 2>/dev/null || true
  sudo docker run -d \
    --name deutschflow-redis \
    --network deutschflow-net \
    --restart unless-stopped \
    --memory="256m" \
    -p 127.0.0.1:6379:6379 \
    redis:7-alpine redis-server --appendonly yes
  sleep 3
  success "  Redis đã khởi động"
else
  success "  Redis đang chạy"
fi

# Gắn Redis vào deutschflow-net (no-op nếu đã ở đó; xử lý cả Redis container cũ vốn ở default bridge).
sudo docker network connect deutschflow-net deutschflow-redis 2>/dev/null \
  && info "  Đã gắn Redis vào deutschflow-net" || true
success "  Redis host: deutschflow-redis (DNS qua deutschflow-net — bền khi reboot)"

# ── [5/6] Build Docker image ──────────────────────────────────
echo ""
info "[5/6] Build Docker image mới..."
BUILD_START=$(date +%s)
BUILD_LOG="/tmp/deutschflow-backend-build.log"
rm -f "$BUILD_LOG"

if sudo docker build -t deutschflow-backend:new "$EC2_DIR/backend" 2>&1 | tee "$BUILD_LOG"; then
  BUILD_TIME=$(( $(date +%s) - BUILD_START ))
  success "  Image built trong ${BUILD_TIME}s"
else
  BUILD_TIME=$(( $(date +%s) - BUILD_START ))
  error "Docker build thất bại sau ${BUILD_TIME}s"
  echo ""
  warn "=== Docker build log (200 dòng cuối) ==="
  tail -n 200 "$BUILD_LOG" 2>/dev/null || cat "$BUILD_LOG" 2>/dev/null || true
  echo ""
  warn "=== Docker images gần đây ==="
  sudo docker images --format 'table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.CreatedSince}}\t{{.Size}}' | head -n 20
  exit 1
fi

# ── [6/6] Blue-Green Deploy ───────────────────────────────────
echo ""
info "[6/6] Blue-Green Deploy..."

# Chuẩn bị docker run args dưới dạng array (tránh word-split khi mount rỗng)
DOCKER_ARGS=(
  --env-file "$ENV_FILE"
  -e EDGE_TTS_URL=http://172.17.0.1:5050
  -e "REDIS_HOST=deutschflow-redis"
  -e REDIS_PORT=6379
  --memory="1500m"
)
if [ "$HAS_GOOGLE_SA" = "true" ] && [ -f /home/ubuntu/google-sa.json ]; then
  DOCKER_ARGS+=(-v /home/ubuntu/google-sa.json:/run/secrets/google-sa.json:ro)
  info "  Google SA credentials: mounted"
else
  info "  Google SA credentials: not mounted (POI fallback)"
fi

# Khởi động GREEN
sudo docker rm -f deutschflow-backend-green 2>/dev/null || true
sudo docker run -d \
  --name deutschflow-backend-green \
  "${DOCKER_ARGS[@]}" \
  -p 8081:8080 \
  deutschflow-backend:new

# Gắn GREEN vào deutschflow-net để resolve DNS 'deutschflow-redis'. Default bridge vẫn là primary
# (gateway 172.17.0.1) → EDGE_TTS không đổi. Lettuce nối Redis lazy nên kịp trước health-check.
sudo docker network connect deutschflow-net deutschflow-backend-green 2>/dev/null || true

# Health check GREEN (tối đa 3 phút)
info "  Chờ GREEN healthy (tối đa 180s)..."
GREEN_HEALTHY=false
for i in $(seq 1 36); do
  sleep 5
  STATUS=$(curl -sf http://localhost:8081/actuator/health 2>/dev/null || echo "")
  if echo "$STATUS" | grep -q '"UP"'; then
    GREEN_HEALTHY=true
    success "  GREEN healthy sau $((i * 5))s"
    break
  fi
  if ! sudo docker ps --format '{{.Names}}' | grep -q "^deutschflow-backend-green$"; then
    error "  GREEN container đã crash!"
    break
  fi
  echo "    Chờ... ($((i * 5))s / 180s)"
done

if [ "$GREEN_HEALTHY" = false ]; then
  error "GREEN không healthy! Rollback — BLUE vẫn đang chạy."
  echo ""
  warn "=== GREEN logs (50 dòng cuối) ==="
  sudo docker logs deutschflow-backend-green --tail 50 2>/dev/null || true
  sudo docker rm -f deutschflow-backend-green 2>/dev/null || true
  sudo docker rmi deutschflow-backend:new 2>/dev/null || true
  exit 1
fi

# Warm-up DB connection pool: gửi vài requests thực lên GREEN trước khi promote.
# Tránh race condition "User not found" khi container vừa boot nhưng connection pool chưa ready.
info "  Warm-up DB connection pool (10s)..."
for w in 1 2 3 4 5; do
  sleep 2
  # Gọi /actuator/health lần nữa — mỗi lần trigger HikariCP check connection
  WU=$(curl -sf http://localhost:8081/actuator/health 2>/dev/null || echo "")
  if echo "$WU" | grep -q '"UP"'; then
    echo "    Warm-up ${w}/5 OK"
  else
    warn "    Warm-up ${w}/5 chưa UP — chờ thêm..."
  fi
done
success "  Warm-up xong — DB connection pool đã sẵn sàng"

# Force-remove a container by name; fail deploy if it still exists.
docker_force_remove() {
  local name="$1"
  if ! sudo docker ps -a --format '{{.Names}}' | grep -qx "$name"; then
    return 0
  fi
  sudo docker update --restart=no "$name" 2>/dev/null || true
  sudo docker stop --timeout=30 "$name" 2>/dev/null || true
  if ! sudo docker rm -f "$name"; then
    error "  Không xóa được container: $name"
    return 1
  fi
  if sudo docker ps -a --format '{{.Names}}' | grep -qx "$name"; then
    error "  Container $name vẫn còn sau docker rm -f"
    return 1
  fi
  return 0
}

# Graceful stop BLUE (must free name before promote)
info "  Graceful stop BLUE (timeout 30s)..."
if ! docker_force_remove deutschflow-backend; then
  error "BLUE chưa được gỡ — giữ GREEN trên :8081, hủy promote."
  exit 1
fi
success "  BLUE đã dừng và gỡ"

# Promote GREEN → port 8080
if ! docker_force_remove deutschflow-backend-green; then
  error "GREEN chưa được gỡ — kiểm tra thủ công trên EC2."
  exit 1
fi

if ! sudo docker run -d \
  --name deutschflow-backend \
  "${DOCKER_ARGS[@]}" \
  -p 8080:8080 \
  --restart unless-stopped \
  deutschflow-backend:new; then
  error "Không khởi động được deutschflow-backend trên :8080"
  sudo docker ps -a --filter name=deutschflow-backend --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' || true
  exit 1
fi

# Gắn container production vào deutschflow-net (Redis DNS). Default bridge vẫn primary → EDGE_TTS giữ nguyên.
sudo docker network connect deutschflow-net deutschflow-backend 2>/dev/null || true

# Tag + cleanup
sudo docker tag deutschflow-backend:new deutschflow-backend:latest 2>/dev/null || true
sudo docker rmi deutschflow-backend:new 2>/dev/null || true
sudo docker image prune -f 2>/dev/null || true

# Final health check (tối đa 90s)
info "  Chờ backend healthy trên port 8080 (tối đa 90s)..."
FINAL_HEALTH=""
for i in $(seq 1 18); do
  sleep 5
  FINAL_HEALTH=$(curl -sf http://localhost:8080/actuator/health 2>/dev/null || echo "")
  if echo "$FINAL_HEALTH" | grep -q '"UP"'; then
    success "  Backend healthy sau $((i * 5))s"
    break
  fi
  echo "    Chờ... ($((i * 5))s / 90s)"
done

# ── Final Report ──────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════"
echo "  FINAL HEALTH CHECK"
echo "════════════════════════════════════════════════"

EDGE_FINAL=$(curl -sf http://localhost:5050/health 2>/dev/null || echo '{"status":"unavailable"}')
REDIS_PING=$(sudo docker exec deutschflow-redis redis-cli ping 2>/dev/null || echo "FAIL")
DISK_FINAL=$(df -h / | awk 'NR==2 {print $3 "/" $2 " (" $5 ")"}')
CONTAINER_MEM=$(sudo docker stats deutschflow-backend --no-stream --format "{{.MemUsage}}" 2>/dev/null || echo "N/A")

echo "  Backend : $FINAL_HEALTH"
echo "  Edge TTS: $EDGE_FINAL"
echo "  Redis   : $REDIS_PING"
echo "  Memory  : $CONTAINER_MEM"
echo "  Disk    : $DISK_FINAL"
echo ""

if echo "$FINAL_HEALTH" | grep -q '"UP"'; then
  echo "════════════════════════════════════════════════"
  echo -e "  \033[0;32mDEPLOY THÀNH CÔNG! ✓\033[0m"
  echo "  API: https://api.mydeutschflow.com"
  echo "  Commit: $(git -C /home/ubuntu/DeutschFlow log --oneline -1)"
  echo "════════════════════════════════════════════════"
else
  echo "════════════════════════════════════════════════"
  echo -e "  \033[0;31mDEPLOY THẤT BẠI! Backend không healthy.\033[0m"
  echo "════════════════════════════════════════════════"
  echo ""
  echo "=== Backend logs (50 dòng cuối) ==="
  sudo docker logs deutschflow-backend --tail 50 2>/dev/null || true
  exit 1
fi
ENDSSH

# ── Local summary ─────────────────────────────────────────────
TOTAL=$(elapsed)
echo ""
echo -e "${BOLD}════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Deploy pipeline hoàn tất! (${TOTAL})${NC}"
echo    "  Commit : $(git rev-parse --short HEAD)"
echo    "  Time   : $(date '+%Y-%m-%d %H:%M:%S')"
echo -e "${BOLD}════════════════════════════════════════════════${NC}"
echo ""
read -r -p "Chạy cleanup sau deploy không? [y/N] " CLEANUP_REPLY
case "${CLEANUP_REPLY:-}" in
  y|Y|yes|YES)
    echo ""
    echo -e "${BOLD}▶ Chạy cleanup-deploy.sh${NC}"
    if [ -f "$LOCAL_DIR/cleanup-deploy.sh" ]; then
      bash "$LOCAL_DIR/cleanup-deploy.sh" all --force
    else
      echo -e "${YELLOW}[WARN]${NC}  Không tìm thấy cleanup-deploy.sh ở $LOCAL_DIR"
    fi
    ;;
  *)
    echo "Cleanup bị bỏ qua."
    ;;
esac
