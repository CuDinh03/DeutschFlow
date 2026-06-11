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
```

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
