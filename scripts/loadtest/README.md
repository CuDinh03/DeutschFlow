# Load / Stress testing — DeutschFlow

k6 scripts để đo năng lực chịu tải. **Chạy trên STAGING giống production**, không phải prod đang phục vụ người thật.

## Cài đặt
```bash
brew install k6   # macOS
```

## Thứ tự chạy
```bash
export BASE=https://staging.mydeutschflow.com
export TOKEN=<một JWT hợp lệ của user test>   # lấy từ /api/auth/login

# 1) Sanity + tải nhẹ. Phải xanh trước khi đi tiếp.
k6 run scripts/loadtest/baseline.js

# 2) STRESS — ramp dần để tìm điểm gãy.
k6 run scripts/loadtest/ramp.js

# 3) SPIKE — sốc tải đột ngột, xem có hồi phục không.
k6 run scripts/loadtest/spike.js

# 4) Kịch bản thực tế — đi đúng đường của user thật:
k6 run --env LOADTEST_PASSWORD=<pw> scripts/loadtest/login-storm.js   # KHÔNG cần TOKEN
k6 run scripts/loadtest/dashboard-mix.js
k6 run scripts/loadtest/mock-exam-start.js   # tuỳ chọn EXAM_ID=<id> CEFR=B1
```

## Kịch bản thực tế (đo đúng đường user, không chỉ 1 endpoint đọc)
| Script | Mô phỏng | Đánh vào | Tín hiệu cần soi |
|--------|----------|----------|------------------|
| `login-storm.js` | Cả lớp đăng nhập đầu giờ | `POST /api/auth/login` | **bcrypt CPU** (~100–200ms/lần, serial) + rate limiter Redis. `login_5xx > 0` = **regression ERR-74C** (Redis-down → 500), phải = 0. `login_429` cao là OK (limiter làm đúng việc). |
| `dashboard-mix.js` | Mở Home sau login | `/api/student/dashboard` + `/api/srs/count` + `/api/notifications/unread-count` (batch song song, đúng như `app/(student)/index.tsx`) | `hikaricp_connections_pending` — dashboard là call nhiều query nhất, bão hoà pool trước tiên. |
| `mock-exam-start.js` | Cả lớp bấm "bắt đầu thi thử" cùng lúc (B2B đắt nhất) | `POST /api/mock-exams/{id}/start` (find-attempt + INSERT + đọc đề + strip đáp án) | RDS write IOPS + `hikaricp_pending`. 1 TOKEN → `/start` idempotent (đo chi phí đọc/strip); muốn tạo attempt thật theo từng học viên thì chạy bằng nhiều account (xem `scripts/load-test/`). |

## Theo dõi SONG SONG khi chạy (quan trọng hơn cả số k6)
- **DB pool:** `hikaricp_connections_active`, `hikaricp_connections_pending` (qua `/actuator/prometheus`, token ADMIN, hoặc Grafana).
- **Latency:** `http_server_requests_seconds` p95/p99.
- **Lỗi:** tỉ lệ 5xx.
- **RDS:** CurrentConnections vs max_connections, CPUUtilization, FreeableMemory.
- **JVM:** heap, GC pause.

## Đọc kết quả
- `hikaricp_connections_pending > 0` kéo dài + p95 leo về ~5s = **đã chạm trần DB pool (max 20)**. Đây là điểm gãy số một được dự đoán.
- 5xx tăng vọt khi spike = cascade do timeout (xem `docs/PROD_LOAD_SCALABILITY_REVIEW_2026-06-12.md` mục 3).
- Sau spike mà p95 **không** trở lại baseline = có rò rỉ (connection/thread) — chạy thêm soak (giữ tải vừa 30–60 phút).

## Lưu ý an toàn
- Đừng chạy `ramp`/`spike` lên production thật. Đường `/api/words?cefr=A1` chạm DB → đủ để bão hòa pool.
- Khi backend đang 503 (sự cố pool/RDS), **không** chạy stress — sẽ làm nặng thêm và số liệu vô nghĩa.
- Chỉnh endpoint trong script sang đường thực tế bạn muốn đo (dashboard, SRS-due, mock-exam…).
