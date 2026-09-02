# Runbook H1 — đồng bộ nginx + real_ip Cloudflare + khoá SG (owner chạy tay)

> Sinh từ gói tuần 1 audit lag 02/09 (§3.4 H1). Claude bị hook chặn ssh/sudo nên phần trên EC2
> owner chạy — mỗi bước có lệnh dán-là-chạy và cách kiểm chứng. Làm THEO THỨ TỰ.
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

## Nếu hỏng — rollback

- Bước 1: `sudo cp` bản backup (làm backup trước nếu muốn: `sudo cp /etc/nginx/sites-available/deutschflow /tmp/nginx-backup-$(date +%s)`) rồi `sudo nginx -t && sudo systemctl reload nginx`.
- Bước 2: thêm lại rule 443 `0.0.0.0/0` trong Console (1 phút, không downtime).
