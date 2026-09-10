# Runbook — Giám sát ngoài hộp (uptime monitor bên thứ ba)

> **Mã việc:** V-09 · **Soạn:** 2026-09-08 · **Trạng thái:** phần chuẩn bị XONG, phần đăng ký dịch vụ **chờ owner bấm**.
> **Phạm vi:** thêm MỘT lớp giám sát chạy **ngoài** con EC2 production. Không thay thế Prometheus/Grafana đang có.

---

## 1. Vì sao cần — lỗ hổng đang có thật

Toàn bộ hệ giám sát hiện chạy **trên chính con EC2 mà nó giám sát**. Bằng chứng trong repo:

| Thành phần | Nơi khai báo | Cổng publish |
|---|---|---|
| Prometheus | `docker-compose.prod.yml` — service `prometheus`, container `deutschflow-prometheus` | `127.0.0.1:9090` |
| Alertmanager | `docker-compose.prod.yml` — service `alertmanager`, container `deutschflow-alertmanager` | `127.0.0.1:9093` |
| Grafana | `docker-compose.prod.yml` — service `grafana`, container `deutschflow-grafana` | `127.0.0.1:3001` |
| Loki | `docker-compose.prod.yml` — service `loki`, container `deutschflow-loki` | `127.0.0.1:3100` |
| Promtail | `docker-compose.prod.yml` — service `promtail`, container `deutschflow-promtail` | không publish |
| node-exporter | `docker-compose.prod.yml` — `node-exporter` | không publish |

Hệ quả: **máy chết thì hệ giám sát chết theo, và không một tin nhắn nào được gửi.** Không rule nào trong
`docker/prometheus/alert.rules.yml` bắt được ca này — kể cả `BackendScrapeAbsent`, vì rule đó cũng do
chính Prometheus trên máy đó đánh giá. Các ca sập câm lặng:

- EC2 stop/terminate/hết CPU credit tới mức không lập lịch nổi container.
- Mất mạng ra Internet (SG, route table, NAT) — Alertmanager không gọi được `api.telegram.org`.
- Đĩa đầy tới mức dockerd không ghi được — `HostDiskSpaceLow` fire nhưng Alertmanager cũng đang chết đói.
- Certbot hết hạn cert: **hiện chưa có rule nào**, đã ghi rõ trong `alert.rules.yml`
  ("Cert expiry CHƯA có rule: cần blackbox exporter probe HTTPS").

---

## 2. Hiện trạng — đọc từ repo, không suy đoán

### 2.1 Rule đang có (`docker/prometheus/alert.rules.yml`)

Nhóm `deutschflow_alerts` (5 rule):

| Alert | severity | Ý nghĩa |
|---|---|---|
| `HighAiLatency` | warning | `/api/speaking*` max latency > 5s trong 1 phút |
| `DbPoolExhausted` | critical | Hikari có request chờ, hoặc active == max |
| `HighErrorRate` | critical | >5% request trả 5xx trong 5 phút |
| `BackendScrapeDown` | critical | `up{job="deutschflow-backend"} == 0` quá 2 phút |
| `BackendScrapeAbsent` | critical | `absent(up{...})` quá 5 phút — mất hẳn serie |

Nhóm `deutschflow_abuse` (8 rule): `RateLimitSurge`, `AuthEndpointFlood`, `TomcatThreadPoolSaturated`,
`SustainedHighCpu`, `HostDiskSpaceLow`, `HostMemoryPressure`, `HighJvmGcPause`, `CircuitBreakerOpen`.

**Tổng: 13 rule.** Tất cả đều cần Prometheus trên EC2 còn sống mới đánh giá được.

### 2.2 Cảnh báo đổ đi đâu

`docker/prometheus/prometheus.yml` → `alerting.alertmanagers` → `alertmanager:9093` (DNS nội mạng
`deutschflow-net`) → `docker/alertmanager/alertmanager.yml` → receiver **`telegram`**.

- Kênh đang dùng: **Telegram bot**, `send_resolved: true`, `parse_mode: HTML`.
- `repeat_interval` 1h; riêng `severity=critical` là 15m; `group_wait` 30s.
- File config **thật** chứa bot token nên **gitignored**. Trong repo chỉ có
  `docker/alertmanager/alertmanager.yml.example` (placeholder `<TELEGRAM_BOT_TOKEN>` / `<TELEGRAM_CHAT_ID>`).
- Có sẵn khối Slack đã comment sẵn trong file `.example` nếu sau này muốn đổi kênh.

⚠️ **Repo này PUBLIC.** Bot token / chat id chỉ tồn tại trên EC2. Không chép vào bất kỳ file nào trong repo,
kể cả tài liệu này.

### 2.3 Endpoint health

| Thứ | URL | Ai gọi được |
|---|---|---|
| API health | `https://api.mydeutschflow.com/actuator/health` | **công khai** — `docker/deutschflow.nginx.conf` để hở đúng location này (`location = /actuator/health`), phần `/actuator/` còn lại `deny all` |
| API metrics | `/actuator/prometheus` | chỉ Prometheus nội mạng, bearer token tĩnh (`credentials_file: /etc/prometheus/scrape-token`) |
| Web | `https://mydeutschflow.com/` | công khai, **đi qua CDN** (xem giới hạn ở §6) |

Ngữ nghĩa `/actuator/health` (`backend/src/main/resources/application.yml`):

- `show-details: when_authorized` ⇒ gọi ẩn danh chỉ nhận `{"status":"UP"}`, **không lộ chi tiết thành phần**.
- `health.mail.enabled: false` và `health.redis.enabled: false` — hai cái này **cố ý** bị loại khỏi tổng hợp,
  vì đều không chặn việc phục vụ traffic. Redis chết vẫn `UP`.
- Health = **readiness gate của blue-green** (`deploy-backend.sh` poll chính endpoint này). ⛔ Đừng đổi
  ngữ nghĩa của nó để chiều monitor.
- Endpoint có chạm DB ⇒ nginx **không** miễn rate-limit cho nó (kế thừa zone `df_api`).
  Chu kỳ 5 phút cách ngưỡng rất xa, an toàn.

---

## 3. Đăng ký uptime monitor — các bước owner bấm

Dịch vụ nào cũng được (UptimeRobot / Better Stack / Healthchecks.io / Pingdom…). Yêu cầu tối thiểu:
**probe chạy ngoài AWS us-east-1**, chu kỳ 5 phút, cảnh báo về **đúng kênh Telegram đang dùng**.

### Bước 1 — Monitor API (cái quan trọng nhất)

| Trường | Giá trị |
|---|---|
| Loại | HTTP(s) / keyword |
| URL | `https://api.mydeutschflow.com/actuator/health` |
| Chu kỳ | **5 phút** |
| Điều kiện PASS | HTTP `200` **và** body chứa `"status":"UP"` |
| Ngưỡng báo động | 2 lần lỗi liên tiếp (≈10 phút) — tránh kêu vặt vì một lần deploy |
| Timeout | 10s |
| SSL expiry alert | **BẬT** (lấp đúng lỗ hổng cert mà `alert.rules.yml` ghi là chưa có rule) |

Chọn kiểu **keyword** chứ đừng chỉ "HTTP 200": khi backend DOWN, Spring trả `503` — bắt được;
nhưng nếu sau này có ai đặt trang lỗi tùy biến trả 200 thì keyword mới cứu được.

### Bước 2 — Monitor web

| Trường | Giá trị |
|---|---|
| URL | `https://mydeutschflow.com/` |
| Chu kỳ | 5 phút |
| Điều kiện PASS | HTTP `200` |
| SSL expiry alert | BẬT |

### Bước 3 — Nối cảnh báo về Telegram (kênh đang dùng)

Tin về **cùng một chat id** với Alertmanager để mọi cảnh báo hạ tầng đổ về một chỗ — nhưng
**tạo một bot RIÊNG cho monitor ngoài**, đừng dùng lại bot của Alertmanager.

🔑 **Vì sao phải tách bot.** Webhook URL của dịch vụ bên thứ ba mang token ngay trên đường dẫn, và
URL kiểu đó bị ghi log ở nhiều chỗ ngoài tầm kiểm soát: log gửi webhook, log lỗi, màn hình cấu hình,
bản xuất cấu hình. Token Telegram rò ở đó cho phép người khác **gửi cảnh báo giả vào đúng kênh vận
hành** và đọc nội dung kênh qua `getUpdates`. Bot riêng thì rò một bên không mất bên kia, và thu hồi
được độc lập bằng `/revoke` với @BotFather.

1. Chat với **@BotFather** → `/newbot` → đặt tên kiểu `DeutschFlow Uptime` → nhận token MỚI.
2. Mời bot mới vào đúng nhóm/kênh đang nhận cảnh báo, rồi lấy `chat_id` (giống chat id Alertmanager
   đang dùng — đọc từ **EC2**: `docker/alertmanager/alertmanager.yml`, file thật, gitignored).
   ⛔ Không copy token hay chat id vào repo, vào issue, vào chat, hay vào chính tài liệu này.
3. Trong dịch vụ monitor, tạo *alert contact* kiểu **Webhook** (POST hoặc GET đều được):
   - URL: `https://api.telegram.org/bot<TOKEN_BOT_MONITOR>/sendMessage`
   - Tham số: `chat_id=<CHAT_ID>`, `text=` chuỗi mẫu của dịch vụ (thường có biến kiểu
     `*monitorFriendlyName* is *alertTypeFriendlyName*`).
   - Nếu sau này nghi token rò: `/revoke` ở @BotFather, dán token mới vào dịch vụ. Alertmanager
     **không bị ảnh hưởng** vì nó dùng bot khác.
4. Nếu dịch vụ có sẵn tích hợp Telegram thì dùng thẳng, khỏi webhook — vẫn dùng bot riêng.
5. Bật thêm **email** làm kênh dự phòng: nếu sự cố là "mất Internet ra ngoài" thì Telegram của
   Alertmanager câm, nhưng monitor bên ngoài vẫn gửi được — hai đường độc lập mới có giá trị.
6. Đặt "alert khi khôi phục" (resolved) = BẬT, khớp `send_resolved: true` của Alertmanager.

### Bước 4 — Ghi lại

Điền vào bảng nghiệm thu §5 (ai đăng ký, dịch vụ nào, ngày giờ, độ trễ đo được). **Không điền số phỏng đoán.**

---

## 4. Tự kiểm: cảnh báo có THẬT SỰ gửi được không

Monitor đăng ký xong mà chưa từng nổ thì chưa biết nó có gửi được không. Bắt buộc làm một lần
ngay sau khi đăng ký, và làm lại mỗi khi đổi kênh/đổi token.

### T1 — Kiểm kênh bằng monitor TẠM (an toàn, không đụng prod) ✅ nên dùng

1. Tạo monitor **tạm** tên `TEMP-alert-test`, chu kỳ 5 phút, URL:
   `https://api.mydeutschflow.com/actuator/khong-ton-tai-de-test`
   → nginx `deny all` cho `/actuator/` ngoài `health` ⇒ chắc chắn **không** 200.
2. Gắn đúng alert contact Telegram ở Bước 3.
3. Chờ tối đa 2 chu kỳ (~10 phút). **Phải** nhận được tin nhắn Telegram.
4. Ghi lại: giờ tạo monitor → giờ nhận tin = **độ trễ thực đo**. Đây là con số đưa vào §5.
5. **Hoàn nguyên:** XOÁ monitor `TEMP-alert-test`. Kiểm lại danh sách monitor còn đúng 2 cái thật.

> Không nhận được tin? Soi theo thứ tự: alert contact đã gắn vào monitor chưa → webhook có bị dịch vụ
> đánh dấu lỗi không (thường có log gửi) → gọi tay `curl` tới `sendMessage` từ máy cá nhân xem bot/chat
> id còn sống không (bot bị kick khỏi group là mất kênh mà không báo).

### T2 — Kiểm chính monitor thật (chỉ khi T1 đã đạt)

Rủi ro hơn vì đụng vào monitor đang chạy — **chỉ làm trong giờ hành chính, có người ngồi canh.**

1. Sửa monitor API: đổi keyword `"status":"UP"` thành `"status":"KHONG-CO-CHUOI-NAY"`.
2. Chờ tới ngưỡng báo động (2 lần lỗi ≈ 10 phút) → phải nhận cảnh báo DOWN.
3. **Hoàn nguyên NGAY:** trả keyword về `"status":"UP"`.
4. Chờ tới khi nhận được tin "resolved". **Chưa thấy resolved thì chưa được coi là đã hoàn nguyên xong** —
   dừng ở đây là để lại monitor có thể đang ở trạng thái sai.

### T3 — Kiểm nhánh Alertmanager (đường trong máy) — độc lập với T1/T2

Đường Prometheus → Alertmanager → Telegram là **kênh khác**, phải kiểm riêng. Trên EC2:

```bash
# Bắn một alert giả thẳng vào Alertmanager, tự hết hạn sau 5 phút (không cần sửa rule nào).
curl -s -XPOST http://127.0.0.1:9093/api/v2/alerts -H 'Content-Type: application/json' -d '[{
  "labels":{"alertname":"TEST_KENH_CANH_BAO","severity":"warning"},
  "annotations":{"summary":"Kiem kenh Telegram","description":"Alert gia — tu het han sau 5 phut."},
  "endsAt":"'"$(date -u -d '+5 min' +%Y-%m-%dT%H:%M:%SZ)"'"
}]'
```

Phải nhận tin Telegram trong ~30s (`group_wait: 30s`). Không cần hoàn nguyên gì: `endsAt` tự dọn,
và sau đó sẽ có tin "resolved". **Không** sửa `alert.rules.yml` để test — sửa rule là đụng vào
đường phục vụ thật và rất dễ quên hoàn nguyên.

### T4 — Kiểm nhanh từ máy cá nhân trước khi đăng ký

`scripts/ops/uptime-check.sh` gọi đúng hai URL mà monitor sẽ gọi, kiểm đúng hai điều kiện PASS ở §3.
Chạy nó trước để chắc endpoint hành xử như mong đợi, khỏi mất công đổ lỗi cho dịch vụ monitor:

```bash
scripts/ops/uptime-check.sh                    # dùng URL công khai mặc định
API_HEALTH_URL=... WEB_URL=... scripts/ops/uptime-check.sh   # trỏ chỗ khác (staging)
# thoát 0 = cả hai đạt · 2 = có mục không đạt · 1 = lỗi dùng sai/thiếu curl
```

---

## 5. Bảng nghiệm thu

| Mã | Ca | Trạng thái | Ghi chú |
|---|---|---|---|
| AC-MON-01 | Monitor API `https://api.mydeutschflow.com/actuator/health` tồn tại, chu kỳ 5 phút, keyword `"status":"UP"` | **NOT_RUN** | cần owner đăng ký |
| AC-MON-02 | Monitor web `https://mydeutschflow.com/` tồn tại, chu kỳ 5 phút | **NOT_RUN** | cần owner đăng ký |
| AC-MON-03 | T1 — monitor tạm nổ và **nhận được** tin Telegram; đã xoá monitor tạm | **NOT_RUN** | ghi độ trễ thực đo (phút) |
| AC-MON-04 | T3 — alert giả bắn vào Alertmanager tới được Telegram | **NOT_RUN** | ghi độ trễ thực đo (giây) |
| AC-MON-05 | Cảnh báo SSL expiry đã bật cho cả hai monitor | **NOT_RUN** | lấp lỗ cert chưa có rule |
| AC-MON-06 | Kênh email dự phòng đã bật và đã nhận được ít nhất 1 tin | **NOT_RUN** | |
| AC-MON-07 | `scripts/ops/uptime-check.sh` chạy trên prod → thoát 0 | **NOT_RUN** | chưa chạy trên máy có mạng ra prod |

**Chưa có số liệu vận hành nào được đo cho V-09 tính tới 2026-09-08.** Ô nào chưa đo thì để NOT_RUN,
đừng điền ước lượng.

---

## 6. Giới hạn đã biết — đọc trước khi tin vào màu xanh

1. **Monitor web KHÔNG chứng minh EC2 còn sống.** `docker/deutschflow.nginx.conf` ghi rõ: DNS của
   `mydeutschflow.com` đang trỏ vào CDN, khối nginx cho web "gần như không nhận lưu lượng thật".
   ⇒ EC2 có thể chết trong khi monitor web vẫn xanh. **Chỉ AC-MON-01 (API) mới thật sự chạm EC2 + DB.**
2. **`UP` không có nghĩa là mọi thứ ổn.** Redis và mail bị loại khỏi tổng hợp health (§2.3) — cả hai
   chết vẫn `UP`. Redis chết chỉ lộ qua log WARN của rate-limiter và Prometheus.
3. **Chu kỳ 5 phút = phát hiện chậm nhất ~10 phút** với ngưỡng 2 lần lỗi. Đây là đánh đổi có chủ ý:
   1 phút sẽ kêu oan mỗi lần blue-green promote.
4. **Monitor ngoài không thay được Prometheus.** Nó chỉ trả lời đúng một câu: *"máy còn trả lời không?"*
   Vì sao chậm, pool cạn ở đâu, breaker nào mở — vẫn phải hỏi Grafana.
5. **Chưa có error tracking backend (Sentry)** — nằm ngoài phạm vi V-09, xem `docs/BACKLOG_CHECKLIST.md` P1-16.

---

## 7. Liên quan

- `docker/prometheus/prometheus.yml` · `docker/prometheus/alert.rules.yml` — scrape + 13 rule.
- `docker/alertmanager/alertmanager.yml.example` — mẫu config kênh Telegram (file thật gitignored).
- `docker/deutschflow.nginx.conf` — chỗ để hở `/actuator/health` và `deny all` phần còn lại.
- `docker-compose.prod.yml` — nơi chứng minh cả hệ giám sát nằm trên chính EC2 được giám sát.
- `scripts/ops/uptime-check.sh` — kiểm tay hai endpoint trước/sau khi đăng ký.
- `scripts/ops/rds-backup-verify.sh`, `scripts/ops/rds-restore-drill.sh` — mảng khôi phục dữ liệu (khác việc).
- `docs/BACKLOG_CHECKLIST.md` P1-16 — mục observability tổng.
