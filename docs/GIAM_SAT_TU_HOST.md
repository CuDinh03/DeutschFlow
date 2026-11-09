# Giám sát VM tự host — "Không mù" (Giai đoạn 0)

> Soạn 09/11/2026 · áp cho VM `deutschflow-srv`. Thay cho phần giám sát viết theo EC2 trong
> `docs/UPTIME_MONITOR_RUNBOOK.md` §2 (EC2 đã bỏ).

## 1. Có gì, báo đi đâu

Có ba lớp giám sát.

**Lớp 1 — Prometheus trên VM** (`deploy/self-host/monitoring.compose.yml`, ~600 MB trần RAM)
- Prometheus scrape:
  - backend cả hai màu blue-green: `deutschflow-backend`, `deutschflow-backend-green`;
  - node-exporter (CPU, RAM, đĩa của VM);
  - số đo textfile.
- Rule: `docker/prometheus/alert.rules.yml`. Gồm 13 rule cũ, cộng nhóm `deutschflow_selfhost`: `BackupStale`, `AiTokensSpike`, `SpeakingAiFailures`, `DeutschflowTextfileStale`.
- Alertmanager gửi cảnh báo về Telegram.
- Không chạy Grafana, Loki, Promtail. VM thiếu RAM, và Grafana trùng cổng 3001 với frontend-green.

**Lớp 2 — báo trực tiếp từ systemd**
- Backup thất bại → `OnFailure=deutschflow-alert@%n.service` → `telegram-alert.sh`.
- Lớp này vẫn báo được khi Prometheus đã chết.

**Lớp 3 — uptime monitor bên ngoài**
- Dùng UptimeRobot hoặc Better Stack. Đây là lớp duy nhất biết khi cả VM chết, mất điện hay mất mạng nhà.
- Đăng ký theo `docs/UPTIME_MONITOR_RUNBOOK.md` §3. Hai URL cần theo dõi:
  - `https://api.mydeutschflow.com/actuator/health`
  - trang chủ

Số đo textfile do `metrics-textfile.sh` ghi mỗi 5 phút (timer `deutschflow-metrics.timer`):
- thời điểm backup thành công cuối;
- token AI hôm nay và trung bình 7 ngày (theo giờ VN).

## 2. Việc owner làm (một lần)

**Tạo bot Telegram**
1. Nhắn `@BotFather` → `/newbot` → lấy token.
2. Nhắn cho bot mới một câu bất kỳ. Lấy chat id bằng `@userinfobot`, hoặc mở `https://api.telegram.org/bot<TOKEN>/getUpdates` và tìm `chat.id`.

**Ghi token lên VM** (SSH vào VM, user `deploy`). Token không đi qua chat hay repo.
```bash
read -rs -p "Token bot: " T && printf '%s' "$T" > /home/deploy/secrets/telegram_bot_token && unset T && chmod 644 /home/deploy/secrets/telegram_bot_token && echo OK
```
```bash
echo 'TELEGRAM_CHAT_ID=<chat id>' > /srv/deutschflow/env/telegram.env
```

**Cài lại để bật Telegram, rồi bắn thử**
```bash
bash /srv/deutschflow/repo/deploy/self-host/install-monitoring.sh
```
```bash
bash /srv/deutschflow/repo/deploy/self-host/install-monitoring.sh --test-alert
```

**Đăng ký uptime monitor bên ngoài** theo runbook.

## 3. Cài và cập nhật

Trên VM, sau khi code đã ở `/srv/deutschflow/repo`:
```bash
bash /srv/deutschflow/repo/deploy/self-host/install-monitoring.sh
```

Script chạy lại bao nhiêu lần cũng được. Nó làm các việc sau:
- Tạo thư mục textfile.
- Lo token scrape:
  - sinh token nếu chưa có;
  - thêm `PROMETHEUS_SCRAPE_TOKEN` vào `backend.env`, kèm bản sao lưu `.bak`;
  - token này có hiệu lực từ lần deploy backend kế tiếp; tới lúc đó target backend báo 401.
- Sinh `alertmanager.yml`. Chưa có bot thì dùng receiver rỗng.
- Cài các unit systemd.
- `docker compose up -d`, nạp lại config.
- In tình trạng.

Xem tình trạng:
```bash
bash /srv/deutschflow/repo/deploy/self-host/install-monitoring.sh --status
```

Sửa rule hay `prometheus.yml`: pull code rồi chạy lại script. Script tự gọi `/-/reload`.

## 4. Gỡ

```bash
docker compose -p deutschflow-monitoring -f /srv/deutschflow/repo/deploy/self-host/monitoring.compose.yml down
```
```bash
sudo systemctl disable --now deutschflow-metrics.timer
```
`OnFailure` của backup tự im khi chưa có token Telegram, vì `telegram-alert.sh` thoát 0.

## 5. Ngưỡng cần owner chốt sau

`AiTokensSpike` hiện kêu khi token AI trong ngày vượt cả hai mức:
- trên 300k token;
- và gấp 3 lần trung bình 7 ngày.

Mức dùng tháng 11/2026 khoảng 10–35k token/ngày. Khi owner có trần ngân sách AI theo ngày, đổi rule này sang con số đó.

## 6. RAM

Đo trước khi bật giám sát: VM có 5,8 GB, còn trống 3,6 GB. Blue-green backend cần thêm 2,2 GB trong lúc deploy.

Sau khi bật, kiểm `free -m` trong lúc deploy backend. Nếu RAM trống dưới 500 MB, hạ `mem_limit` của Prometheus hoặc rút retention.
