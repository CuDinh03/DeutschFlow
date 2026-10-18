#!/usr/bin/env bash
# ============================================================
# deploy-frontend-vm.sh — build + deploy frontend Next.js blue-green trên VM (thay Amplify).
#
#   deploy-frontend-vm.sh               # nhánh hiện tại của repo VM
#   DEPLOY_BRANCH=main deploy-frontend-vm.sh
#   SKIP_FETCH=1 deploy-frontend-vm.sh
#   deploy-frontend-vm.sh --rollback    # chạy :prev ở màu kia
#
# Màu: blue = deutschflow-frontend (:3000), green = deutschflow-frontend-green (:3001).
# Build args lấy từ /srv/deutschflow/env/frontend-build.env (NEXT_PUBLIC_*, CSP_ENFORCE)
# + JWT_RSA_PUBLIC_KEY từ ~/secrets/jwt_public.pem — NHÚNG lúc build (next.config `env`).
# ⇒ Xoay cặp JWT thì phải chạy lại script này cùng lúc với restart backend.
# ============================================================
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"
reexec_from_tmp "${BASH_SOURCE[0]}" "$@"

MODE=${1:-deploy}
IMAGE=deutschflow-frontend
BUILD_ENV=$DF_ENV/frontend-build.env
REQUIRED=(NEXT_PUBLIC_BACKEND_URL NEXT_PUBLIC_MEDIA_ORIGINS)
START=$(date +%s)

step "Preflight"
[ -f "$BUILD_ENV" ] || { error "thiếu $BUILD_ENV"; exit 1; }
for v in "${REQUIRED[@]}"; do grep -qE "^${v}=." "$BUILD_ENV" || { error "frontend-build.env thiếu $v"; exit 1; }; done
[ -s "$DF_SECRETS/jwt_public.pem" ] || { error "thiếu jwt_public.pem"; exit 1; }
success "frontend-build.env OK"
disk_guard

ACTIVE_PORT=$(active_port frontend)
if [ "$ACTIVE_PORT" = 3000 ]; then OLD=deutschflow-frontend; NEW=deutschflow-frontend-green; NEW_PORT=3001
else OLD=deutschflow-frontend-green; NEW=deutschflow-frontend; NEW_PORT=3000; fi
info "Đang phục vụ: $OLD (:$ACTIVE_PORT) → màu mới: $NEW (:$NEW_PORT)"

if [ "$MODE" = --rollback ]; then
  docker image inspect "$IMAGE:prev" >/dev/null 2>&1 || { error "không có $IMAGE:prev"; exit 1; }
  RUN_IMAGE=$IMAGE:prev
  step "Rollback → $RUN_IMAGE"
else
  BRANCH=${DEPLOY_BRANCH:-$(current_branch)}
  if [ "${SKIP_FETCH:-}" = 1 ]; then warn "SKIP_FETCH=1 — build cây hiện có"
  else step "Lấy code ($BRANCH)"; fetch_code "$BRANCH"; fi
  SHA=$(git -C "$DF_REPO" rev-parse --short HEAD)
  success "$(git -C "$DF_REPO" log --oneline -1)"

  step "Build $IMAGE:$SHA (next build ~1,5–2 GB RAM trong vài phút)"
  ARGS=()
  while IFS= read -r line; do
    [[ "$line" =~ ^(NEXT_PUBLIC_[A-Z0-9_]+|CSP_ENFORCE)=.* ]] && ARGS+=(--build-arg "$line")
  done < "$BUILD_ENV"
  ARGS+=(--build-arg "JWT_RSA_PUBLIC_KEY=$(awk '{printf "%s\\n", $0}' "$DF_SECRETS/jwt_public.pem")")
  BUILD_LOG=/tmp/deutschflow-frontend-build.log
  if ! docker build "${ARGS[@]}" -t "$IMAGE:$SHA" -t "$IMAGE:new" "$DF_REPO/frontend" >"$BUILD_LOG" 2>&1; then
    error "build thất bại — 200 dòng cuối:"; tail -n 200 "$BUILD_LOG"; exit 1
  fi
  success "build xong ($(( $(date +%s) - START ))s)"
  RUN_IMAGE=$IMAGE:new
fi

step "Khởi động $NEW (:$NEW_PORT)"
remove_container "$NEW" 5
docker run -d --name "$NEW" --restart unless-stopped --network "$DF_NET" --memory 512m \
  -p "127.0.0.1:$NEW_PORT:3000" "$RUN_IMAGE" >/dev/null
if ! wait_http "http://127.0.0.1:$NEW_PORT/v2/login/" 200 120 mydeutschflow.com; then
  error "$NEW không trả 200 cho /v2/login/ — $OLD VẪN phục vụ."
  docker logs "$NEW" --tail 100 2>&1 || true
  remove_container "$NEW" 5
  exit 1
fi
# Cổng vai trò middleware phải bật (thiếu JWT public key lúc build ⇒ /v2/admin/ lọt qua)
code=$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: mydeutschflow.com' "http://127.0.0.1:$NEW_PORT/v2/admin/")
if [ "$code" != 307 ]; then
  error "/v2/admin/ chưa đăng nhập trả $code (cần 307) — cổng vai trò tắt? Không đổi traffic."
  remove_container "$NEW" 5; exit 1
fi
success "$NEW OK (/v2/login/ 200, /v2/admin/ → 307)"

step "Đổi nginx df_frontend → :$NEW_PORT"
switch_upstream frontend df_frontend "$NEW_PORT" || { remove_container "$NEW" 5; exit 1; }
if ! wait_http https://mydeutschflow.com/v2/login/ 200 60; then
  warn "https://mydeutschflow.com/v2/login/ chưa 200 qua tunnel — trả traffic về $OLD"
  switch_upstream frontend df_frontend "$ACTIVE_PORT"; remove_container "$NEW" 5; exit 1
fi
success "traffic đã ở $NEW — https://mydeutschflow.com 200"

if container_running "$OLD"; then sleep 5; remove_container "$OLD" 10 && success "$OLD đã gỡ" || warn "$OLD chưa gỡ được"; fi

if [ "$RUN_IMAGE" = "$IMAGE:new" ]; then
  docker image inspect "$IMAGE:latest" >/dev/null 2>&1 && docker tag "$IMAGE:latest" "$IMAGE:prev"
  docker tag "$IMAGE:new" "$IMAGE:latest"; docker rmi "$IMAGE:new" >/dev/null 2>&1 || true
else
  docker tag "$IMAGE:prev" "$IMAGE:latest"
fi

bash "$(dirname "${BASH_SOURCE[0]}")/cleanup-vm.sh" --quiet || warn "cleanup lỗi (không ảnh hưởng deploy)"
success "DEPLOY FRONTEND THÀNH CÔNG — $NEW (:$NEW_PORT), $(( $(date +%s) - START ))s"
