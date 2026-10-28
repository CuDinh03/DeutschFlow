#!/usr/bin/env bash
# ============================================================
# deploy-backend-vm.sh — deploy backend blue-green THẬT trên VM tự host (0 downtime).
#
#   deploy-backend-vm.sh               # lấy code nhánh hiện tại của repo VM, build, đổi màu
#   DEPLOY_BRANCH=main deploy-backend-vm.sh
#   SKIP_FETCH=1 deploy-backend-vm.sh  # build đúng cây đang có trên VM (không git fetch)
#   deploy-backend-vm.sh --rollback    # chạy image :prev ở màu kia rồi đổi traffic sang
#
# Màu: blue = deutschflow-backend (127.0.0.1:8080), green = deutschflow-backend-green (:8081).
# nginx upstream df_backend (/etc/nginx/deutschflow-upstreams/backend.conf) quyết định màu phục vụ.
# Thay cho deploy-backend.sh (EC2) — xem docs/DEPLOY_TU_HOST.md.
# ============================================================
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"
reexec_from_tmp "${BASH_SOURCE[0]}" "$@"

MODE=${1:-deploy}
ENV_FILE=$DF_ENV/backend.env
IMAGE=deutschflow-backend
PUBLIC_HEALTH=https://api.mydeutschflow.com/actuator/health
REQUIRED=(DB_HOST DB_PASSWORD REDIS_HOST S3_ENDPOINT S3_BUCKET_NAME S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY
          JWT_ALGORITHM JWT_RSA_PRIVATE_KEY JWT_RSA_PUBLIC_KEY EDGE_TTS_URL GROQ_API_KEY)
START=$(date +%s)

# ── Preflight ─────────────────────────────────────────────────
step "Preflight"
[ -f "$ENV_FILE" ] || { error "thiếu $ENV_FILE"; exit 1; }
missing=()
for v in "${REQUIRED[@]}"; do grep -qE "^${v}=." "$ENV_FILE" || missing+=("$v"); done
[ ${#missing[@]} -eq 0 ] || { error "backend.env thiếu/rỗng: ${missing[*]}"; exit 1; }
if grep -qE '^AWS_' "$ENV_FILE"; then error "backend.env còn biến AWS_* — dự án đã bỏ AWS"; exit 1; fi
if grep -q FIRSTBOOT_PLACEHOLDER "$ENV_FILE"; then error "backend.env còn khoá R2 giả"; exit 1; fi
if grep -qE '^JWT_ALGORITHM=RS256' "$ENV_FILE" && grep -qE '^(JWT_SECRET|JWT_SECRET_PREVIOUS)=.' "$ENV_FILE"; then
  warn "backend.env còn JWT_SECRET* dù ký RS256 — backend đã bỏ qua khi verify; gỡ khỏi backend.env và env frontend"
fi
if grep -qE '^(GOETHE_AUTO_IMPORT_ON_STARTUP|GOETHE_OFFICIAL_WORDLIST_AUTO_IMPORT|CEFR_CURATED_AUTO_IMPORT_STARTUP)=true' "$ENV_FILE"; then
  warn "cờ auto-import đang true — mỗi lần boot sẽ import lại (spike CPU)"
fi
success "backend.env: đủ ${#REQUIRED[@]} biến bắt buộc, 0 AWS_*"
docker exec deutschflow-postgres pg_isready -U deutschflow_user -d deutschflow >/dev/null || { error "Postgres chưa sẵn sàng"; exit 1; }
[ "$(docker exec deutschflow-redis redis-cli ping 2>/dev/null)" = PONG ] || { error "Redis không PONG"; exit 1; }
success "Postgres + Redis OK"
disk_guard

ACTIVE_PORT=$(active_port backend)
if [ "$ACTIVE_PORT" = 8080 ]; then OLD=deutschflow-backend; NEW=deutschflow-backend-green; NEW_PORT=8081
else OLD=deutschflow-backend-green; NEW=deutschflow-backend; NEW_PORT=8080; fi
info "Đang phục vụ: $OLD (:$ACTIVE_PORT) → màu mới: $NEW (:$NEW_PORT)"

# ── Code + build ──────────────────────────────────────────────
if [ "$MODE" = --rollback ]; then
  docker image inspect "$IMAGE:prev" >/dev/null 2>&1 || { error "không có $IMAGE:prev để rollback"; exit 1; }
  RUN_IMAGE=$IMAGE:prev
  step "Rollback → $RUN_IMAGE"
else
  BRANCH=${DEPLOY_BRANCH:-$(current_branch)}
  if [ "${SKIP_FETCH:-}" = 1 ]; then
    warn "SKIP_FETCH=1 — build cây hiện có, không lấy code mới"
  else
    step "Lấy code ($BRANCH)"
    fetch_code "$BRANCH"
  fi
  SHA=$(git -C "$DF_REPO" rev-parse --short HEAD)
  success "$(git -C "$DF_REPO" log --oneline -1)"

  step "Build $IMAGE:$SHA"
  BUILD_LOG=/tmp/deutschflow-backend-build.log
  if ! docker build -t "$IMAGE:$SHA" -t "$IMAGE:new" "$DF_REPO/backend" >"$BUILD_LOG" 2>&1; then
    error "build thất bại — 200 dòng cuối:"; tail -n 200 "$BUILD_LOG"; exit 1
  fi
  success "build xong ($(( $(date +%s) - START ))s)"
  RUN_IMAGE=$IMAGE:$SHA

  # Edge TTS: chỉ build lại khi thư mục sidecar đổi (so tree hash với label của image)
  TREE=$(git -C "$DF_REPO" rev-parse HEAD:backend/edge-tts-sidecar)
  if [ "$(docker image inspect -f '{{index .Config.Labels "df.tree"}}' deutschflow-edge-tts:latest 2>/dev/null)" != "$TREE" ]; then
    step "Edge TTS đổi — build lại"
    docker build -q --label "df.tree=$TREE" -t deutschflow-edge-tts:latest "$DF_REPO/backend/edge-tts-sidecar" >/dev/null
    remove_container deutschflow-edge-tts 5
    docker run -d --name deutschflow-edge-tts --restart unless-stopped --network "$DF_NET" --memory 256m deutschflow-edge-tts:latest >/dev/null
    success "Edge TTS đã thay"
  fi
fi

# ── Chạy màu mới ──────────────────────────────────────────────
step "Khởi động $NEW (:$NEW_PORT)"
RUN_ARGS=(--network "$DF_NET" --restart unless-stopped --memory 2200m
          -e JAVA_TOOL_OPTIONS=-XX:MaxRAMPercentage=65.0 --env-file "$ENV_FILE")
if [ -f "$DF_SECRETS/google-sa.json" ]; then
  RUN_ARGS+=(-v "$DF_SECRETS/google-sa.json:/run/secrets/google-sa.json:ro")
fi
remove_container "$NEW" 5
docker run -d --name "$NEW" "${RUN_ARGS[@]}" -p "127.0.0.1:$NEW_PORT:8080" "$RUN_IMAGE" >/dev/null
BOOT=$(date +%s)

info "Chờ $NEW healthy (tối đa 300s)..."
if ! wait_http "http://127.0.0.1:$NEW_PORT/actuator/health" '"UP"' 300; then
  error "$NEW không UP — $OLD VẪN phục vụ, prod không bị đụng."
  curl -s "http://127.0.0.1:$NEW_PORT/actuator/health" || true; echo
  docker logs "$NEW" --tail 300 2>&1 || true
  remove_container "$NEW" 5
  [ "$MODE" != --rollback ] && docker rmi "$IMAGE:new" >/dev/null 2>&1 || true
  exit 1
fi
success "$NEW healthy sau $(( $(date +%s) - BOOT ))s boot"
for w in 1 2 3 4 5; do sleep 2; curl -sf "http://127.0.0.1:$NEW_PORT/actuator/health" >/dev/null || warn "warm-up $w/5 chưa UP"; done
success "warm-up xong"

# ── Đổi traffic ───────────────────────────────────────────────
step "Đổi nginx df_backend → :$NEW_PORT"
switch_upstream backend df_backend "$NEW_PORT" || { remove_container "$NEW" 5; exit 1; }
if ! wait_http "$PUBLIC_HEALTH" '"UP"' 60; then
  warn "health công khai chưa UP qua tunnel — trả traffic về $OLD"
  switch_upstream backend df_backend "$ACTIVE_PORT"
  remove_container "$NEW" 5
  exit 1
fi
success "traffic đã ở $NEW — $PUBLIC_HEALTH UP"

# ── Xả màu cũ ─────────────────────────────────────────────────
if container_running "$OLD"; then
  info "Xả $OLD (30s cho request/SSE đang mở rồi stop)..."
  sleep 30
  remove_container "$OLD" 30 && success "$OLD đã gỡ" || warn "$OLD chưa gỡ được — traffic đã ở $NEW, gỡ tay sau"
fi

# ── Tag ───────────────────────────────────────────────────────
if [ "$MODE" != --rollback ]; then
  docker image inspect "$IMAGE:latest" >/dev/null 2>&1 && docker tag "$IMAGE:latest" "$IMAGE:prev"
  docker tag "$RUN_IMAGE" "$IMAGE:latest"
  docker rmi "$IMAGE:new" >/dev/null 2>&1 || true
else
  # rollback: :prev đang chạy thành :latest, bản lỗi giữ dưới tag :<sha> của nó
  docker tag "$IMAGE:prev" "$IMAGE:latest"
fi

# Prometheus (nếu có): nạp lại config
docker kill -s HUP deutschflow-prometheus >/dev/null 2>&1 && info "Prometheus SIGHUP" || true

bash "$(dirname "${BASH_SOURCE[0]}")/cleanup-vm.sh" --quiet || warn "cleanup lỗi (không ảnh hưởng deploy)"

step "Kết quả"
echo "  Màu phục vụ : $NEW (:$NEW_PORT)"
echo "  Image       : $(docker inspect -f '{{.Config.Image}}' "$NEW")"
echo "  Commit      : $(git -C "$DF_REPO" log --oneline -1)"
echo "  RAM         : $(docker stats "$NEW" --no-stream --format '{{.MemUsage}}')"
echo "  Edge TTS    : $(docker exec "$NEW" curl -s -m 3 http://deutschflow-edge-tts:5050/health 2>/dev/null || echo unavailable)"
echo "  Disk        : $(df -h / | awk 'NR==2 {print $3 "/" $2 " (" $5 ")"}')"
echo "  Thời gian   : $(( $(date +%s) - START ))s"
success "DEPLOY BACKEND THÀNH CÔNG"
