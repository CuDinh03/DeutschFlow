#!/usr/bin/env bash
# ============================================================
# remote-deploy-guard.sh — forced command cho khoá SSH của workflow "Deploy production" (GitHub Actions).
#
# Khoá đó chỉ làm được đúng việc này: chạy deploy-{backend,frontend}-vm.sh từ main, rollback, hoặc kiểm trạng thái.
# Lệnh nhận qua SSH_ORIGINAL_COMMAND, đúng một dòng:
#   "<backend|frontend> <deploy|rollback|check> <sha main 40 ký tự hex>"
# Khác mẫu ⇒ từ chối. Không eval, không mở shell.
#
# Cài một lần trên VM (root), NGOÀI repo — `git reset --hard` của script deploy không đụng được, và
# user deploy không sửa được:
#   sudo install -o root -g root -m 755 /srv/deutschflow/repo/deploy/self-host/remote-deploy-guard.sh \
#        /usr/local/sbin/deutschflow-remote-deploy
# Dòng trong /home/deploy/.ssh/authorized_keys (cloudflared chuyển kết nối vào từ localhost):
#   restrict,from="127.0.0.1,::1",command="/usr/local/sbin/deutschflow-remote-deploy" ssh-ed25519 AAAA… github-actions-deploy
# Đổi file này trong repo ⇒ chạy lại lệnh install ở trên.
# Xem docs/QUY_TRINH_PHAT_HANH.md §5.0.
# ============================================================
set -euo pipefail

readonly DF_REPO=/srv/deutschflow/repo
readonly SCRIPTS=$DF_REPO/deploy/self-host
readonly UPSTREAMS=/etc/nginx/deutschflow-upstreams
readonly LOCK=/srv/deutschflow/remote-deploy.lock

log()  { logger -t deutschflow-remote-deploy -- "$*" 2>/dev/null || true; echo "[guard] $*"; }
deny() { log "TỪ CHỐI: $*"; exit 2; }

CMD=${SSH_ORIGINAL_COMMAND:-}
[[ "$CMD" =~ ^(backend|frontend)\ (deploy|rollback|check)\ ([0-9a-f]{40})$ ]] \
  || deny "lệnh không đúng mẫu '<backend|frontend> <deploy|rollback|check> <sha>'"
TARGET=${BASH_REMATCH[1]} MODE=${BASH_REMATCH[2]} SHA=${BASH_REMATCH[3]}

# Hai lần chạy từ workflow không được chồng nhau (workflow đã có concurrency; đây là lớp thứ hai).
# Deploy tay qua ssh không lấy khoá này — đừng deploy tay trong lúc workflow đang chạy.
exec 9>"$LOCK"
flock -n 9 || deny "đang có một lần deploy từ xa khác chạy"

case "$MODE" in
  check)
    log "check $TARGET"
    echo "Nhánh repo máy chủ: $(git -C "$DF_REPO" rev-parse --abbrev-ref HEAD)"
    echo "Commit repo máy chủ: $(git -C "$DF_REPO" log -1 --format='%h %s')"
    echo "main trên GitHub:    $(git -C "$DF_REPO" ls-remote origin refs/heads/main | cut -c1-8)"
    echo "Upstream $TARGET:     $(cat "$UPSTREAMS/$TARGET.conf")"
    if sudo -n nginx -t >/dev/null 2>&1; then echo "sudo không mật khẩu cho nginx: OK"
    else deny "sudo -n nginx -t lỗi — script deploy cần sudo không mật khẩu (nginx, systemctl reload)"; fi
    docker ps --format '{{.Names}}\t{{.Status}}' | grep "deutschflow-$TARGET" || deny "không thấy container $TARGET nào chạy"
    ;;
  deploy)
    # Owner duyệt workflow ở commit $SHA; main đã tiến lên thì dừng, không deploy thứ chưa được duyệt.
    # (Còn một khe vài giây giữa ls-remote và fetch trong script deploy — chấp nhận được.)
    remote=$(git -C "$DF_REPO" ls-remote origin refs/heads/main | cut -f1)
    [ "$remote" = "$SHA" ] \
      || deny "main trên GitHub là ${remote:0:8}, không phải ${SHA:0:8} đã duyệt — chạy lại workflow"
    log "deploy $TARGET @ ${SHA:0:8}"
    DEPLOY_BRANCH=main exec "$SCRIPTS/deploy-$TARGET-vm.sh"
    ;;
  rollback)
    log "rollback $TARGET (yêu cầu ở ${SHA:0:8})"
    exec "$SCRIPTS/deploy-$TARGET-vm.sh" --rollback
    ;;
esac
