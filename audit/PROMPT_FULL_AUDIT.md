# PROMPT — AUDIT TOÀN HỆ THỐNG DEUTSCHFLOW

> Dán nguyên file này cho agent (Claude Code / agent đọc-được-repo) chạy tại gốc repo `DeutschFlow`.
> Mục tiêu: một bản đồ quyết định toàn hệ thống, không phải bản tóm tắt, không phải code vá.

---

## 0. VAI TRÒ & SỨ MỆNH

Bạn là **staff-level auditor** đọc toàn bộ repo DeutschFlow (backend Spring Boot, frontend Next.js, mobile Expo + iOS native, hạ tầng/CI/deploy). Nhiệm vụ: tìm chỗ **mất tiền, thủng bảo mật, vỡ khi scale, và nợ mô hình dữ liệu** — kèm bằng chứng `file:dòng`.

Bạn **chỉ đọc**. Không sửa code, không chạy migration, không commit. Sản phẩm là tài liệu Markdown.

---

## 1. QUY ƯỚC BẮT BUỘC (vi phạm = audit hỏng)

1. **Mọi nhận xét kèm `đường/dẫn/file.java:dòng`.** Không có file:dòng → không được viết ra như sự thật. Suy đoán phải nằm trong mục "CẦN XÁC MINH".
2. **Verify, đừng tin — kể cả prompt này.** Mục §4 dưới đây là bản đồ *khởi điểm*, có thể sai. Đối chiếu với code thật; ghi lại mọi điểm lệch (vd: prompt/tài liệu nói "Java 21" nhưng `backend/pom.xml` ghi `<java.version>17</java.version>` → ghi nhận lệch).
3. **Tách bạch "ĐÃ XÁC NHẬN" vs "NGHI NGỜ".** Đã xác nhận = đã đọc đúng dòng đó. Nghi ngờ = mô thức đáng ngờ chưa truy hết → cho vào "CẦN XÁC MINH THÊM".
4. **Không phán xét ở Pass 1.** Pass 1 chỉ lập bản đồ. Phán xét bắt đầu từ Pass 2.
5. **Không code vá trong audit.** Đề xuất hướng sửa bằng 1–2 câu; tuyệt đối không dán diff/patch.
6. **Mức độ:** 🔴 Nghiêm trọng / 🟠 Cao / 🟡 Trung bình / ⚪ Thấp.
7. **Công sửa:** S (giờ) / M (ngày) / L (tuần).
8. **Thời điểm sửa:** `Ngay` / `Trước scale` / `Backlog`.
9. **Tiếng Việt, súc tích, không khen đệm.** Văn phong khớp `audit/pass1.md`–`pass4.md`: đặc, kỹ thuật, thẳng. Một câu nói được thì không viết hai.
10. **Mỗi pass kết bằng "Danh sách file đã đọc để kiểm chứng".** Không liệt kê file chưa mở.
11. **Đối chiếu audit cũ.** Đọc `audit/REMEDIATION.md`. Với mỗi finding cũ, kiểm `git log`/grep xem đã fix chưa (nhiều mục đánh ✅ DONE kèm commit). **Không báo lại lỗi đã sửa như mới**; nếu fix chưa trọn → ghi "tái mở" kèm bằng chứng.
12. **Đầu ra:** ghi vào `audit/full-<YYYY-MM-DD>/passN.md` (không ghi đè pass1–4 cũ). REMEDIATION hợp nhất: `audit/full-<YYYY-MM-DD>/REMEDIATION.md`.

---

## 2. PHẠM VI

Toàn monorepo, 4 trục song song xuyên suốt mọi pass:

- **A. Bảo mật & cách ly tenant** — auth/JWT, RBAC, rò rỉ đọc-chéo tenant, secrets/config, injection, CORS/SSRF, upload, lưu token phía client.
- **B. Monetization & business logic** — token-pool/quota AI, ledger, đường LLM/TTS/STT ungated, payment webhook (Stripe/MoMo/Apple/SePay), đếm seat, mapping subscription→plan.
- **C. Scale & hiệu năng** — state in-memory, N+1, index thiếu, SUM trên mỗi request, LLM đồng bộ giữ thread, cache, sẵn-sàng-scale-ngang.
- **D. Mô hình dữ liệu & chất lượng code** — nguồn-sự-thật trùng/lệch, bảng thiếu `org_id`, over-engineering, dead code, drift migration, tính nhất quán FE/mobile.

---

## 3. CÁCH LÀM VIỆC

- Được phép **fan-out theo module/đường dẫn** (đọc song song nhiều file) để tăng độ phủ; nhưng mọi kết luận phải quy về `file:dòng` cụ thể.
- Truy luồng bằng **ví dụ cụ thể** (1 request thật, đi từ client → controller → service → repo → DB → bên thứ ba), không nói chung chung.
- Khi gặp số/giả định (timeout, pool size, TTL, quota) → trích đúng dòng cấu hình, không phỏng đoán.
- Liệt kê **toàn bộ** call-site cho hạng mục rủi ro tiền (mọi nơi gọi LLM/TTS/STT), không lấy mẫu.

---

## 4. BẢN ĐỒ KHỞI ĐIỂM (PHẢI tự xác minh lại)

| Tầng | Stack (cần verify) | Vị trí |
|---|---|---|
| Backend | Java 17 + Spring Boot 3, Maven; Security/JWT, JPA + JDBC, WebFlux, AOP, WebSocket, Resilience4j, Caffeine, Flyway, Actuator/Micrometer/Prometheus, Sentry | `backend/src/main/java/com/deutschflow/` (~31 module domain) |
| AI/LLM | AWS Bedrock + Groq; TTS (`edge-tts-sidecar`), STT/Whisper; RAG pgvector | `ai/`, `speaking/`, `common/quota/` |
| Payment | Stripe, MoMo, Apple, SePay webhook | `payment/` |
| DB | PostgreSQL, Flyway — **~237 migration** | `backend/src/main/resources/db/migration/` |
| Frontend | Next.js (App Router), Radix UI, Tailwind, Zustand/contexts, i18n, Sentry, PWA, Playwright + Vitest | `frontend/src/` (`app/`, `components/`, `stores/`, `middleware.ts`) |
| Mobile | Expo / React Native (`app.json`, `eas.json`) + iOS native | `mobile/`, `ios/DeutschFlow.xcodeproj` |
| Hạ tầng | Docker + docker-compose.prod, AWS Amplify (`amplify.yml`), nginx, observability (Prometheus/Grafana/Loki/Promtail/Alertmanager), postgres-init | `docker/`, `amplify.yml`, `deploy-backend.sh`, `cleanup-deploy.sh` |
| CI | 4 workflow: frontend / backend / security / mobile | `.github/workflows/` |

Module backend đáng chú ý cho trục B/A: `common/quota`, `common/security`, `organization`, `payment`, `speaking`, `ai`, `admin`, `teacher`, `user`. Mỗi domain theo `controller → service → repository → entity`; không có shared service ngang trừ `common/`.

---

## 5. CÁC PASS

> Giữ số pass khớp `audit/` cũ (1–4) rồi mở rộng (5–6). Mỗi pass = 1 file. Mỗi finding có ID ổn định (vd `P-12`, `T-6`, `S-7`, `D-5`, `FE-3`, `INF-2`) để REMEDIATION truy vết.

### PASS 1 — BẢN ĐỒ KIẾN TRÚC (chỉ lập bản đồ, KHÔNG phán xét)
`→ pass1.md`

Trả lời:
1. Các module/layer chính + trách nhiệm (bảng), cả BE, FE, mobile, infra.
2. Luồng một HTTP request đi qua những lớp nào (security filter chain, tenant context, quota gate) — vẽ cho 1 endpoint AI tốn tiền.
3. Tenant được phân biệt & truyền thế nào (nguồn `org_id`, JWT claim, guard).
4. Token-pool: liệt kê **chính xác file + hàm + dòng** của mọi chốt (assert/guard/ledger).
5. Mapping subscription → plan code.
6. Mâu thuẫn cấu trúc & chỗ KHÔNG CHẮC (đánh M1, M2… như pass1 cũ) — chỉ nêu, chưa chấm điểm.
7. Danh sách file đã đọc.

### PASS 2 — TRACE LUỒNG NGHIỆP VỤ & DÒNG TIỀN (trục B)
`→ pass2.md`

Trace end-to-end (FE → BE → DB → bên thứ ba), mỗi luồng nêu "dữ liệu biến đổi gì" + điểm yếu:
- **L1 — Đăng nhập + resolve role + áp quyền** (rate-limit, password, trial provisioning, revoke session cũ, refresh-token reuse).
- **L2 — Student tiêu thụ token** (1 chat turn AI Speaking): thứ tự check-quota → gọi LLM → ghi ledger/trừ token; phân tích **race check-then-debit**; có pre-check không, có atomic không.
- **L3 — Tính tiền theo chu kỳ + đếm seat**: tạo invoice, đếm seat (UI vs gate), webhook thanh toán, thêm/bớt student giữa chu kỳ.
- **L4 — Admin tạo org + cấp seat + gán role** (upsertMember, roster bulk import, seat-limit race).
- **L5 — Payment webhook** từng cổng (Stripe/MoMo/Apple/SePay): xác thực chữ ký, idempotency, replay, double-credit.

Kết: bảng điểm yếu theo mức độ.

### PASS 3 — BẢO MẬT & CÁCH LY TENANT (trục A) + TOKEN-POOL ENFORCEMENT (trục B)
`→ pass3.md`

**Phần A — Tenant isolation:**
- Cơ chế cách ly thực tế (đọc từ code, không tin tài liệu).
- Tenant lấy từ **token hay input người dùng**? (mọi endpoint nhận `orgId` từ path/body là nghi vấn IDOR).
- Có lỗ hổng cross-tenant đọc/ghi không? Re-verify ownership ở service-layer có nhất quán?
- Role model: số role khai báo vs thực thi; over-privilege (vd finance/accountant).

**Phần B — Token-pool:**
- Bảng **MỌI** call-site LLM/TTS/STT + trạng thái chốt (có/không pre-check, có/không ledger).
- Profit leak: org-pool có "mù" với đường ungated không?
- Token có thể tiêu quá hạn (race/không khóa/clamp nuốt overage)?

**Phần C — Bảo mật chung:** secrets/config (`.env*`, key, có lộ trong log/repo/CI không — lưu ý `.gitignore` đã chặn `.env*`/`*.pem`/`*.key`, xác minh không có ngoại lệ tracked), SQL/JPQL injection, SSRF (jsoup/webflux outbound), CORS, upload S3, JWT (alg/exp/refresh rotation), rate-limit, secret trong client bundle.

### PASS 4 — SCALE, HIỆU NĂNG & MÔ HÌNH DỮ LIỆU (trục C + D)
`→ pass4.md`

1. **Over-engineered** — lớp thừa không tạo giá trị (đánh `O-n`).
2. **Vỡ khi scale** — state in-memory (SSE ticket, session/turn guard), SUM không index chạy mỗi request, ghi DB trong hot-path, `loadUserByUsername` không cache, LLM đồng bộ giữ thread Tomcat (đánh `S-n`, kèm "đúng cho N center, sai cho M").
3. **Mô hình dữ liệu sai** — bảng nghiệp vụ thiếu `org_id`, hai nguồn sự thật tenant (`users.org_id` vs `org_members`), invoice seat tĩnh tách rời membership, drift `db/migration` (~237 file: migration mồ côi, sửa bảng đã đổi, index thiếu) (đánh `D-n`).
4. **Nợ kỹ thuật lớn nhất + chi phí nếu hoãn.**

### PASS 5 — FRONTEND & MOBILE (trục A/C/D phía client)
`→ pass5.md`

- **Route guard & auth**: `frontend/src/middleware.ts` + route group `(auth)`/`admin`/`org`/`teacher`/`student` — chặn server-side hay chỉ client? Role check bypass được không?
- **Lưu token**: localStorage vs httpOnly cookie; XSS exposure; refresh flow.
- **State**: stores/contexts — nguồn-sự-thật trùng, cache lệch server.
- **Xử lý lỗi & tiền**: FE có hiển thị/giả định quota khác BE? Double-submit thanh toán?
- **Hiệu năng**: bundle nặng (Radix/framer-motion/xyflow), client-render khối lớn, ảnh, PWA cache.
- **i18n** (`messages/`, `i18n/`): key thiếu/cứng chuỗi.
- **Mobile**: lưu token (SecureStore?), pin/cert, `eas.json` profile lộ secret, deep-link; iOS native (`ios/`) Info.plist/entitlements/ATS.
- **Test**: Playwright/Vitest phủ luồng tiền/auth tới đâu.

### PASS 6 — HẠ TẦNG / CI / DEPLOY / CẤU HÌNH (trục A/C)
`→ pass6.md`

- **Docker/compose**: `docker-compose.prod.yml`, Dockerfile BE/FE — chạy root? secret qua ENV/build-arg lộ trong layer? healthcheck? resource limit?
- **Amplify/deploy**: `amplify.yml`, `deploy-backend.sh`, `cleanup-deploy.sh` — secret hardcode, lệnh nguy hiểm, rollback.
- **Quản lý env**: `.env.production(.example)` — phân loại secret/non-secret, lệch giữa example và thực.
- **Migration ops**: Flyway baseline/repair, có chạy auto lúc deploy? thứ tự version, `migration-local` vs `migration`.
- **CI** (4 workflow): `security-ci` quét gì (SAST/deps/secret-scan)? có gate fail không? quyền token CI, pin action theo SHA?
- **Observability**: Prometheus/Grafana/Loki/Alertmanager/nginx — endpoint `/actuator` lộ ra ngoài? log dính PII/secret/JWT? có alert cho cạn-pool/lỗi-thanh-toán không?
- **Resilience hạ tầng**: single node? backup DB? TLS chấm dứt ở đâu?

### REMEDIATION — HỢP NHẤT
`→ REMEDIATION.md`

1. **Tình trạng dự án** — 1 đoạn thẳng thắn: an toàn ở quy mô nào, vỡ ở đâu trước (tiền hay hiệu năng), ngưỡng center.
2. **Bảng ưu tiên tổng** — cột: `ID | Vấn đề | Loại (Khắc phục/Nâng cấp) | Mức độ | Công | File:dòng | Thời điểm`. Sắp: Nghiêm trọng→Thấp; cùng mức, công nhỏ trước. Giữ alias ID từ các pass để truy vết. Đánh dấu mục đã ✅ DONE từ audit cũ.
3. **Khắc phục** (đang hỏng/rủi ro) — nhóm theo mức độ, mỗi mục: triệu chứng → vì sao nguy → hướng sửa 1–2 câu (không code).
4. **Nâng cấp** (chạy được nhưng nên cải thiện).
5. **Lộ trình** — Đợt 1 (chặn rò rỉ, làm TRƯỚC khi nhận thêm center) / Đợt 2 (trước khi scale) / Đợt 3 (backlog).
6. **Cần xác minh thêm** — mọi nghi ngờ chưa truy hết.
7. **Phương pháp & độ tin cậy** — đã đọc bao nhiêu file, chỗ nào suy luận, độ tự tin từng trục.

---

## 6. KỶ LUẬT BẰNG CHỨNG — CHỐNG ẢO GIÁC

- Không bịa tên file/hàm/dòng. Chưa mở thì không trích.
- Số liệu (pool size, timeout, TTL, quota, version) phải khớp đúng dòng config.
- Trục B: phải **enumerate hết** call-site LLM/TTS/STT rồi mới kết luận "ungated", không suy từ mẫu.
- Phân biệt rõ "có thể xảy ra" (lý thuyết) vs "đang xảy ra" (có đường code dẫn tới).
- Nếu hai nguồn mâu thuẫn (tài liệu vs code, pass cũ vs hiện tại) → tin code, ghi rõ điểm lệch.
- Finding trùng audit cũ: tái dùng ID cũ, đừng tạo trùng.

## 7. ĐỊNH NGHĨA XONG (mỗi pass đạt mới qua pass sau)

- Pass 1: bản đồ đủ 4 tầng + token-pool có file:dòng + danh sách file đã đọc.
- Pass 2: ≥5 luồng trace end-to-end, mỗi luồng có phân tích race/idempotency.
- Pass 3: bảng call-site AI đầy đủ + kết luận tenant isolation có/không lỗ + mục bảo mật chung.
- Pass 4: phân loại O/S/D, mỗi mục mức độ + công + file:dòng.
- Pass 5: route guard, lưu token, FE/mobile/iOS, test coverage luồng tiền.
- Pass 6: Docker/CI/deploy/observability/migration ops, secret hygiene kết luận.
- REMEDIATION: bảng ưu tiên + lộ trình 3 đợt + đối chiếu DONE với audit cũ + ghi độ tin cậy.

> Bắt đầu từ Pass 1. Đọc trước `audit/REMEDIATION.md` và `audit/pass1.md`–`pass4.md` để kế thừa ID và không lặp việc.
