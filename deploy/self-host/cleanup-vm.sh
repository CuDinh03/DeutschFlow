#!/usr/bin/env bash
# ============================================================
# cleanup-vm.sh — dọn Docker AN TOÀN sau deploy (thay cleanup-deploy.sh của EC2).
#
#   cleanup-vm.sh            # in chi tiết
#   cleanup-vm.sh --quiet    # deploy-*-vm.sh gọi cuối luồng
#
# Khác bản cũ (xem docs/DEPLOY_TU_HOST.md §4):
#   • GIỮ :latest, :prev và KEEP_SHA tag commit mới nhất của mỗi image ⇒ luôn còn đường rollback.
#   • builder prune chỉ cache > 7 ngày (giữ layer npm ci / mvn go-offline cho build sau).
#   • chỉ gỡ container màu cũ đã exited của backend/frontend — không đụng container khác.
#   • KHÔNG prune volume (dữ liệu Postgres/Redis/observability).
# ============================================================
set -euo pipefail
QUIET=${1:-}
KEEP_SHA=3
say() { [ "$QUIET" = --quiet ] || echo "$*"; }

for repo in deutschflow-backend deutschflow-frontend deutschflow-edge-tts; do
  in_use=$(docker ps -a --format '{{.Image}}' | sort -u)
  # tag dạng sha (7+ hex), mới nhất trước; bỏ KEEP_SHA cái đầu
  docker images "$repo" --format '{{.Tag}} {{.CreatedAt}}' \
    | awk '$1 ~ /^[0-9a-f]{7,}(-[a-z0-9]+)?$/' | sort -k2,3r | awk '{print $1}' \
    | tail -n +$((KEEP_SHA + 1)) | while read -r tag; do
        if grep -qx "$repo:$tag" <<<"$in_use"; then continue; fi
        docker rmi "$repo:$tag" >/dev/null 2>&1 && say "xoá image $repo:$tag" || true
      done
done

for name in deutschflow-backend deutschflow-backend-green deutschflow-frontend deutschflow-frontend-green; do
  st=$(docker inspect -f '{{.State.Status}}' "$name" 2>/dev/null || true)
  if [ "$st" = exited ] || [ "$st" = created ]; then docker rm "$name" >/dev/null && say "gỡ container dừng: $name"; fi
done

docker image prune -f >/dev/null
docker builder prune -f --filter until=168h >/dev/null 2>&1 || true
find /tmp -maxdepth 1 \( -name 'deutschflow-*-build.log' -o -name 'deutschflow-deploy.*' \) -mtime +7 -exec rm -rf {} + 2>/dev/null || true
say "Disk: $(df -h / | awk 'NR==2 {print $3 "/" $2 " (" $5 ")"}')"
