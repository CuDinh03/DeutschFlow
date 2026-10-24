#!/usr/bin/env bash
# Cài/cập nhật site nginx DeutschFlow trên VM. Idempotent; KHÔNG đổi màu đang phục vụ.
set -euo pipefail
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
UP=/etc/nginx/deutschflow-upstreams

sudo mkdir -p "$UP"
# Chỉ tạo upstream mặc định khi chưa có — file hiện hành là trạng thái blue/green, không ghi đè.
[ -f "$UP/backend.conf" ]  || echo 'upstream df_backend { server 127.0.0.1:8080; }'  | sudo tee "$UP/backend.conf"  >/dev/null
[ -f "$UP/frontend.conf" ] || echo 'upstream df_frontend { server 127.0.0.1:3000; }' | sudo tee "$UP/frontend.conf" >/dev/null

sudo install -m 644 "$HERE/deutschflow.nginx.conf" /etc/nginx/sites-available/deutschflow
sudo ln -sf /etc/nginx/sites-available/deutschflow /etc/nginx/sites-enabled/deutschflow
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
echo "nginx OK — backend: $(cat "$UP/backend.conf")"
echo "           frontend: $(cat "$UP/frontend.conf")"
