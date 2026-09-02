# Runbook H1 — đồng bộ nginx + real_ip Cloudflare + khoá SG (owner chạy tay)

> ## ✅ TRẠNG THÁI 03/09 ĐÊM — bước ① và ③ ĐÃ THI HÀNH (owner uỷ quyền, chạy qua script
> `~/Developer/deutschflow-tools/run-h1-apply.sh` + `run-h1-fix-loki.sh`); CHỈ CÒN bước ② (SG, Console).
>
> Thực tế host KHÁC giả định của bản đầu runbook — ghi lại để khỏi lạc lần sau:
> - Site thật là **`/etc/nginx/sites-available/deutschflow-api`** (chỉ API; frontend do Amplify,
>   không có block mydeutschflow.com). KHÔNG tồn tại file `sites-available/deutschflow`.
> - **real_ip CF ĐÃ CÓ trên host từ 24/08** (`/etc/nginx/conf.d/cloudflare-realip.conf` — 22 dải +
>   `CF-Connecting-IP`; rate-limit zones ở `conf.d/deutschflow-ratelimit.conf`). #480 thực chất là
>   repo đuổi kịp host; file `docker/deutschflow.nginx.conf` trong repo là bản MÔ TẢ không khớp
>   cấu trúc host — đừng bao giờ cp đè nguyên file (đè là mất dòng certbot + trùng zone → nginx -t đỏ).
> - Drift 401 thật = host THIẾU block chặn `/actuator/` → đã CHÈN 2 location (health hở chủ đích +
>   deny all) vào `deutschflow-api`, backup tại `/tmp/deutschflow-api-backup-1788368806`, nginx -t
>   pass, reload xong. **Đã nghiệm thu từ internet: prometheus/metrics/env/info = 403, health = 200.**
> - Bước ③: node-exporter Up + target `up`; 4 rule mới nạp; promtail positions volume mới; loki ăn
>   retention 15 ngày + compactor chạy. ⚠️ Sự cố kèm fix: bản đầu config retention làm **loki
>   crash-loop** (limits_config xuất hiện → Loki 3.0 validate `allow_structured_metadata` default
>   true, kỵ schema v11/boltdb-shipper) — đã thêm `allow_structured_metadata: false` trên host +
>   repo (PR loki-fix). Nâng schema v13+tsdb là việc riêng sau này.
> - Certbot `renew --dry-run` PASS (lúc cổng 80 còn mở) — chưa chứng minh cho trạng thái ĐÃ khoá 80,
>   nên bước ② khuyến nghị **chỉ khoá 443, giữ 80 mở** (80 chỉ 301 redirect — rủi ro thấp).
>
> Sinh từ gói tuần 1 audit lag 02/09 (§3.4 H1). Bản gốc bên dưới giữ nguyên làm ngữ cảnh; phần
> còn hiệu lực duy nhất là **Bước 2** (đã cập nhật khuyến nghị 443-only ở trên).
> EC2: `ubuntu@35.175.232.152`, key `~/Developer/DeutschFlow/deutschflow-key.pem`.

## Vì sao khẩn

1. **Drift ĐÃ ĐO ĐƯỢC 02/09**: `curl` từ internet vào `/actuator/prometheus|metrics|env|info`
   nhận **401 của app** thay vì **403 của nginx** ⇒ khối `deny /actuator/*` trong
   `docker/deutschflow.nginx.conf` (repo) KHÔNG còn hiệu lực trên host — file
   `/etc/nginx/sites-available/deutschflow` trên EC2 là bản cũ.
2. **Cloudflare đứng trước nginx từ 24/08** mà nginx chưa có `set_real_ip_from` ⇒ mọi
   rate-limit (`$binary_remote_addr`) đang khoá theo IP **edge của CF** — cả cohort chung vài
   xô, nghẽn oan giờ đông. PR gói tuần 1 đã thêm khối real_ip CF vào file conf trong repo
   (chỉ tin `CF-Connecting-IP` khi kết nối đến từ dải IP CF — không spoof được).
   `ClientIpResolver` backend GIỮ NGUYÊN có chủ đích: sau real_ip, entry phải-nhất của XFF
   chính là IP thật.

## Bước 1 — Sync config repo → host + reload (làm TRƯỚC, độc lập với SG)

```bash
ssh -i ~/Developer/DeutschFlow/deutschflow-key.pem ubuntu@35.175.232.152
```

Trên EC2 (repo tại `/home/ubuntu/DeutschFlow` — deploy script luôn `git reset --hard origin/main`
nên sau khi PR gói tuần 1 merge + deploy, file trong repo trên host đã là bản mới):

```bash
cd /home/ubuntu/DeutschFlow && git log --oneline -1   # phải thấy commit ops/h23 (gói tuần 1)
sudo diff /etc/nginx/sites-available/deutschflow docker/deutschflow.nginx.conf; echo "diff-exit=$?"
```

Đọc lướt diff cho yên tâm (đặc biệt: host có sửa tay gì chưa từng vào repo không — nếu CÓ thì
dừng, chép phần đó vào repo trước). Rồi:

```bash
sudo cp docker/deutschflow.nginx.conf /etc/nginx/sites-available/deutschflow
sudo nginx -t && sudo systemctl reload nginx
```

`nginx -t` đỏ = KHÔNG reload, gửi output cho Claude.

### Kiểm chứng bước 1 (chạy từ máy dev, không cần ssh)

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://mydeutschflow.com/actuator/prometheus
```

- **403** = nginx chặn — drift đã hết (trước là 401 của app).
- Web + app vẫn chạy: mở https://mydeutschflow.com, login, gọi thử 1 API.

Kiểm real_ip ăn (trên EC2): `sudo tail -5 /var/log/nginx/access.log` — cột IP đầu dòng phải là
IP dân cư/di động THẬT (ví dụ IP nhà bạn), **không còn** là IP Cloudflare (104.x/172.6x/162.15x…).

## Bước 2 — Khoá SG 443/80 về dải Cloudflare (Console, vì CloudShell đang bị khoá ~2 ngày)

EC2 Console → Security Groups → SG của instance → Edit inbound rules:

- **443**: xoá rule `0.0.0.0/0`, thêm 15 rule IPv4 (mỗi dải một rule) + nếu SG có IPv6 thì 7 dải v6:
  `173.245.48.0/20, 103.21.244.0/22, 103.22.200.0/22, 103.31.4.0/22, 141.101.64.0/18,
  108.162.192.0/18, 190.93.240.0/20, 188.114.96.0/20, 197.234.240.0/22, 198.41.128.0/17,
  162.158.0.0/15, 104.16.0.0/13, 104.24.0.0/14, 172.64.0.0/13, 131.0.72.0/22`
  (v6: `2400:cb00::/32, 2606:4700::/32, 2803:f800::/32, 2405:b500::/32, 2405:8100::/32,
  2a06:98c0::/29, 2c0f:f248::/32`) — nguồn: https://www.cloudflare.com/ips/
- **80**: ⚠️ ĐỪNG khoá vội — certbot renew dùng HTTP-01 qua port 80. Khoá 80 về CF chỉ sau khi
  chạy thử `sudo certbot renew --dry-run` trên EC2 mà vẫn PASS (CF proxy /.well-known được).
  Dry-run fail thì để 80 mở 0.0.0.0/0 (chỉ redirect 301, rủi ro thấp).
- **GIỮ NGUYÊN**: rule :22 (whitelist IP dev), mọi rule khác không đụng. 4 cổng observability
  (9090/3001/3100/9093) vốn không có rule inbound — giữ vậy.

### Kiểm chứng bước 2

```bash
curl -s -o /dev/null -w "qua-CF: %{http_code}\n" https://mydeutschflow.com/actuator/health
curl -s -m 8 -o /dev/null -w "thang-IP: %{http_code}\n" https://35.175.232.152/ -k || echo "thang-IP: TIMEOUT (đúng kỳ vọng)"
```

Qua CF phải **200/401 như cũ**; gõ thẳng IP phải **timeout** (SG chặn).
Cuối cùng chạy lại lệnh deploy quen thuộc một lần để chắc pipeline không phụ thuộc đường thẳng-IP
nào: `cd ~/Developer/DeutschFlow-deploy && git pull --ff-only origin main && ./deploy-backend.sh`.

## Bước 3 — Nâng stack observability (H2+H3, MỘT lần, sau deploy đầu tiên có #480)

Trên EC2 (config mới đã tự đến qua deploy — script `git reset --hard origin/main`):

```bash
cd /home/ubuntu/DeutschFlow && sudo docker compose -f docker-compose.prod.yml up -d node-exporter loki promtail
```

(loki + promtail cần restart để ăn retention 15 ngày + positions volume mới; node-exporter là
service hoàn toàn mới, ~20MB RAM.)

Kiểm chứng: `curl -s localhost:9090/api/v1/targets | grep -oE '"health":"[a-z]*"'` phải thêm một
target `up` (node-exporter — Prometheus tự nạp scrape job mới khi restart hoặc SIGHUP; deploy
script đã SIGHUP mỗi chuyến); Prometheus http://localhost:9090/rules (qua tunnel) thấy 4 rule mới
HostDiskSpaceLow / HostMemoryPressure / HighJvmGcPause / CircuitBreakerOpen.

## Nếu hỏng — rollback

- Bước 1: `sudo cp` bản backup (làm backup trước nếu muốn: `sudo cp /etc/nginx/sites-available/deutschflow /tmp/nginx-backup-$(date +%s)`) rồi `sudo nginx -t && sudo systemctl reload nginx`.
- Bước 2: thêm lại rule 443 `0.0.0.0/0` trong Console (1 phút, không downtime).
