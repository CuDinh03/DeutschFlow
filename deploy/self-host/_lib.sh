# shellcheck shell=bash disable=SC2034  # hằng số dùng bởi script source file này
# Hàm dùng chung cho deploy-*-vm.sh (source, không chạy trực tiếp).

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
step()    { echo -e "\n${BOLD}${CYAN}▶ $*${NC}"; }

readonly DF_ROOT=/srv/deutschflow
readonly DF_REPO=$DF_ROOT/repo
readonly DF_ENV=$DF_ROOT/env
readonly DF_SECRETS=/home/deploy/secrets
readonly DF_UPSTREAMS=/etc/nginx/deutschflow-upstreams
readonly DF_NET=deutschflow-net
# Mạng riêng cho frontend gọi backend nội bộ (13/11/2026). Backend chỉ mang alias DF_API_ALIAS trên mạng
# này SAU khi đã healthy và nhận traffic (api_alias_move), nên tên nội bộ không bao giờ trỏ vào màu đang
# boot. Frontend đặt BACKEND_INTERNAL_URL=http://$DF_API_ALIAS:8080; lỗi mạng thì code tự lùi về địa chỉ
# công khai (frontend/src/lib/serverBackend.ts).
readonly DF_API_NET=deutschflow-api-net
readonly DF_API_ALIAS=deutschflow-api

# Script nằm trong repo mà bước "lấy code" lại `git reset --hard` repo ⇒ bash đang đọc dở file
# có thể đọc phải nội dung mới giữa chừng. Chạy từ bản sao trong /tmp cho chắc.
reexec_from_tmp() {
  if [ "${DF_REEXEC:-}" != 1 ]; then
    local tmpdir; tmpdir=$(mktemp -d /tmp/deutschflow-deploy.XXXXXX)
    cp "$DF_REPO/deploy/self-host/"*.sh "$tmpdir/"
    DF_REEXEC=1 exec bash "$tmpdir/$(basename "$1")" "${@:2}"
  fi
  acquire_deploy_lock "$(basename "$1")" "${@:2}"
}

# Khoá chung cho MỌI lần deploy/rollback (tay qua SSH, workflow, backend hay frontend): cả hai script
# cùng `git reset --hard` một repo và cùng đổi upstream nginx ⇒ chạy chồng là hỏng. Khoá nhả khi
# tiến trình kết thúc (kể cả bị kill). Lần chạy thứ hai từ chối ngay và in ra ai đang giữ khoá.
readonly DF_DEPLOY_LOCK=$DF_ROOT/deploy.lock
acquire_deploy_lock() {
  exec 8<>"$DF_DEPLOY_LOCK"
  if ! flock -n 8; then
    error "Đang có một lần deploy khác chạy — không chạy chồng. Người giữ khoá:"
    sed 's/^/        /' "$DF_DEPLOY_LOCK" >&2
    error "Chờ lần đó xong rồi chạy lại (kiểm: ps -eo pid,etime,args | grep '[d]eutschflow-deploy')"
    exit 75
  fi
  printf 'pid=%s  bắt đầu=%s  lệnh=%s\n' "$$" "$(date '+%F %T')" "$*" > "$DF_DEPLOY_LOCK"
}

# Cổng đang phục vụ của một upstream (df_backend → 8080|8081).
active_port() { grep -oE '127\.0\.0\.1:[0-9]+' "$DF_UPSTREAMS/$1.conf" | cut -d: -f2; }

# Ghi upstream mới + nginx -t + reload. Lỗi ⇒ trả file cũ, không reload.
switch_upstream() {
  local name=$2 port=$3 path="$DF_UPSTREAMS/$1.conf" backup
  backup=$(mktemp)
  sudo cp "$path" "$backup"
  echo "upstream $name { server 127.0.0.1:$port; }" | sudo tee "$path" >/dev/null
  if sudo nginx -t >/dev/null 2>&1; then
    sudo systemctl reload nginx
    rm -f "$backup"
  else
    sudo cp "$backup" "$path"; rm -f "$backup"
    error "nginx -t đỏ sau khi đổi $name → :$port — đã trả lại file cũ"
    sudo nginx -t || true
    return 1
  fi
}

# Chờ URL đạt kỳ vọng, tối đa $3 giây. expect = mã 3 chữ số ⇒ so mã HTTP; khác ⇒ body phải chứa chuỗi.
# $4 (tuỳ chọn) = Host header (gọi thẳng cổng container mà vẫn đi đúng nhánh host của app).
wait_http() {
  local url=$1 expect=$2 timeout=$3 host=${4:-} i out
  local hdr=(); [ -n "$host" ] && hdr=(-H "Host: $host")
  for ((i = 0; i < timeout; i += 5)); do
    if [[ "$expect" =~ ^[0-9]{3}$ ]]; then out=$(curl -s -m 15 "${hdr[@]}" -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || true)
    else out=$(curl -s -m 15 "${hdr[@]}" "$url" 2>/dev/null || true); fi
    if [[ "$out" == *"$expect"* ]]; then return 0; fi
    sleep 5
  done
  return 1
}

container_running() { docker ps --format '{{.Names}}' | grep -qx "$1"; }

remove_container() {  # gỡ an toàn: tắt restart policy, stop có timeout, rm
  local name=$1
  docker ps -a --format '{{.Names}}' | grep -qx "$name" || return 0
  docker update --restart=no "$name" >/dev/null 2>&1 || true
  docker stop --timeout "${2:-30}" "$name" >/dev/null 2>&1 || true
  docker rm -f "$name" >/dev/null
}

# Lấy code nhánh $1 (repo clone nông).
fetch_code() {
  local branch=$1
  git -C "$DF_REPO" fetch --depth 1 origin "$branch" --quiet
  git -C "$DF_REPO" checkout -q -B "$branch" FETCH_HEAD
  git -C "$DF_REPO" reset -q --hard FETCH_HEAD
  # umask 077 lúc clone từng làm file 600 ⇒ COPY trong Dockerfile không đọc được với user thường
  chmod -R go+rX "$DF_REPO"
}

current_branch() { git -C "$DF_REPO" rev-parse --abbrev-ref HEAD; }

ensure_api_net() {
  docker network inspect "$DF_API_NET" >/dev/null 2>&1 || docker network create "$DF_API_NET" >/dev/null
}

# api_alias_move NEW [OLD]: gắn alias nội bộ cho NEW trước, rồi mới tháo OLD — không có lúc nào thiếu tên.
# Lỗi ở đây không làm hỏng deploy (frontend vẫn lùi về địa chỉ công khai), chỉ cảnh báo.
api_alias_move() {
  local new=$1 old=${2:-}
  ensure_api_net || { warn "không tạo được $DF_API_NET — frontend sẽ gọi backend qua địa chỉ công khai"; return 0; }
  if ! docker inspect -f '{{json .NetworkSettings.Networks}}' "$new" 2>/dev/null | grep -q "\"$DF_API_NET\""; then
    docker network connect --alias "$DF_API_ALIAS" "$DF_API_NET" "$new"       || { warn "không gắn được $DF_API_ALIAS cho $new"; return 0; }
  fi
  if [ -n "$old" ] && container_running "$old"; then
    docker network disconnect "$DF_API_NET" "$old" >/dev/null 2>&1 || true
  fi
  success "$DF_API_ALIAS (mạng $DF_API_NET) → $new"
}

# Nối container frontend vào mạng nội bộ để gọi được $DF_API_ALIAS (không cần alias).
api_net_join() {
  ensure_api_net && docker network connect "$DF_API_NET" "$1" 2>/dev/null     || warn "$1 chưa vào được $DF_API_NET — sẽ gọi backend qua địa chỉ công khai"
}

disk_guard() {
  local pct; pct=$(df / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')
  if [ "$pct" -gt 90 ]; then
    warn "Disk ${pct}% — prune image/build cache (KHÔNG prune volume)"
    docker image prune -f >/dev/null; docker builder prune -f --filter until=168h >/dev/null
  fi
  success "Disk: $(df -h / | awk 'NR==2 {print $3 "/" $2 " (" $5 ")"}')"
}
