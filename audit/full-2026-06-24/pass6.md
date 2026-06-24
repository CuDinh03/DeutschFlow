# PASS 6 — HẠ TẦNG / CI / DEPLOY / CẤU HÌNH (trục A/C)

> Greenfield (audit cũ chưa có INF-n). file:dòng + CONFIRMED/SUSPECTED.

---

## 1. Observability — lỗ vận hành quan trọng nhất

### INF-1 🟠 — Prometheus scrape `/actuator/prometheus` KHÔNG auth, nhưng prod yêu cầu ADMIN → scrape FAIL → không có metric backend
`docker/prometheus/prometheus.yml:21-24` job `deutschflow-backend` scrape `/actuator/prometheus` **không** block `authorization`/`basic_auth`. Nhưng `SecurityConfig.java:107-108` gate ADMIN ở mọi profile ≠ local/dev/test (`:42-43`). → prod scrape nhận 401/403 → **Prometheus không có metric backend**. **CONFIRMED (code mismatch); SUSPECTED prod chạy không profile local.** Fix: thêm credential scrape (ADMIN service account/basic_auth) hoặc expose `/actuator/prometheus` chỉ trong Docker network + permitAll path đó.

### INF-11 🟠 — Alert DB-pool-exhaustion (P0 cũ) thực tế KHÔNG fire được vì INF-1
Rule có & đúng: `docker/prometheus/alert.rules.yml:13-20` `DbPoolExhausted` on `hikaricp_connections_pending > 0`. Nhưng do INF-1, series `hikaricp_*` không tồn tại trong Prometheus prod → **rule không bao giờ đánh giá được dữ liệu thật**. → **alert quan trọng nhất (chính là sự cố P0 trước đây) đang chết trong prod.** **CONFIRMED rule tồn tại; SUSPECTED-broken phụ thuộc INF-1.** Fix: sửa INF-1 rồi verify `hikaricp_connections_pending` query được.

### INF-10 🟡 — Promtail ship full container log sang Loki, KHÔNG scrub PII/secret; Loki `auth_enabled:false`
`docker/promtail/config.yml:20-28` chỉ stage `docker: {}`, không `replace`/`drop` → dòng log in JWT/email/reset-token/API-key (vd stacktrace) lưu nguyên ở Loki (`loki/local-config.yaml:1` `auth_enabled:false`). **CONFIRMED.** Fix: thêm stage `replace` cho pattern token/email; hạn chế network Loki.

---

## 2. Edge / network exposure

### INF-2 🟠 — `/actuator/*` reachable từ internet qua nginx (không block path)
`docker/deutschflow.nginx.conf:80-81` `location / { proxy_pass …:8080 }` — **không** block `/actuator`. → `https://api.mydeutschflow.com/actuator/health` (và prometheus/metrics, tùy app-gate) public-routable. App-gate ADMIN có (mitigate worst case) nhưng defense-in-depth: actuator không nên reachable từ edge. **CONFIRMED.** Fix: `location /actuator/ { allow 127.0.0.1; deny all; }` (chừa `/actuator/health` nếu cần uptime check ngoài).

### INF-9 🟡 — Observability port publish lên host (Grafana `:3001` user `admin`, Prometheus `:9090`, Alertmanager `:9093`, Loki `:3100`)
`docker-compose.prod.yml:170-173` Grafana `:3001`, `GF_SECURITY_ADMIN_USER:-admin`. nginx không proxy 3001 → phơi nhiễm phụ thuộc EC2 security group (**không trong repo**). **SUSPECTED exposure.** Fix: bind `127.0.0.1:<port>` + truy cập qua SSH tunnel.

---

## 3. Deploy & migration ops

### INF-5 🟡 — `repair-before-migrate` default TRUE → Flyway auto-repair checksum mỗi boot prod
`application.yml:221-224` `${APP_FLYWAY_REPAIR_BEFORE_MIGRATE:true}`; Flyway chạy auto lúc boot (`:107`, không bước migrate riêng trong deploy). → migration sửa-sau-khi-apply bị **âm thầm** realign checksum thay vì fail deploy. `.env.production.example` không set var này. **CONFIRMED default.** Fix: set `APP_FLYWAY_REPAIR_BEFORE_MIGRATE=false` prod + thêm vào example. (= D-11.)

### INF-8 🟡 — Deploy healthcheck chỉ verify `/actuator/health` (8080) + Edge-TTS (5050); Python AI server (8000) không check
`deploy-backend.sh:498-499`. Nhưng prod dùng `AI_CHAT_PROVIDER=groq` và AI server (`docker-compose.ai.yml`, :8000 GPU) **không** trong `docker-compose.prod.yml` → hiện **không có :8000 để check** (moot cho Groq prod). **CONFIRMED** lo ngại đúng nhưng hiện vô hại. Liên hệ O-12: xác nhận feature `/api/ai/*` có hoạt động prod không. Fix: nếu deploy GPU server thì thêm gate :8000.

### INF-6 🟡 — `deploy-backend.sh` `git push origin main` (`:195`) + `git reset --hard origin/$BRANCH` trên EC2 (`:263`)
Push local→remote khi deploy (stale/ahead local bị propagate); reset --hard EC2 xoá drift. Dirty-tree guard (`:182-191`) + bỏ auto-commit là tốt. **CONFIRMED (known gotcha).** Fix: align local=origin trước khi chạy.

### INF-7 🟡 — `deploy-backend.sh` exit 1 ở prompt cleanup dù deploy THÀNH CÔNG
`:536` `read -r -p "Chạy cleanup…"` + `set -euo pipefail` (`:20`), không TTY → read EOF non-zero → exit 1 SAU khi đã "DEPLOY THÀNH CÔNG". Caller hiểu nhầm deploy fail. **CONFIRMED (khớp gotcha đã biết).** Fix: `if [ -t 0 ]; then read…; fi` hoặc `read … || REPLY=n`.

### INF-4 🟡 — Job CI self-hosted deploy đang tắt nhưng còn body `docker rm -f` (không blue-green, race port 8080)
`.github/workflows/backend-ci.yml:100` `if:false` (tắt) nhưng body `:113-122` `docker rm -f` + `docker run -p 8080:8080` — hard-restart downtime, mâu thuẫn blue-green của `deploy-backend.sh`. Lật `if:false` → push main hard-restart prod + race manual deploy. **CONFIRMED.** Fix: xoá job chết hoặc gọi script blue-green.

---

## 4. Container & supply-chain

### INF-3 🟠 — Image hạ tầng dùng tag `:latest` mutable (không pin digest, không Renovate)
`docker-compose.prod.yml:104,123,165` `prom/prometheus:latest`, `prom/alertmanager:latest`, `grafana/grafana:latest` (loki/promtail pin `3.0.0`). `docker compose pull` âm thầm nâng major → deploy không reproducible. **CONFIRMED.** Fix: pin version/`@sha256`.

### INF-12 ✅ — Positive (CONFIRMED)
- Container **non-root**: backend `backend/Dockerfile:33,45` (`USER app`), frontend `frontend/Dockerfile:51-59` (`USER nextjs`).
- **Không secret trong build-arg** — chỉ `NEXT_PUBLIC_*` là ARG (public by design); secret qua runtime `--env-file .env.production`.
- Không secret literal trong compose/example tracked; `.env.production`, `deutschflow-key.pem`, `google-sa.json`, `alertmanager.yml` đều untracked/gitignored.
- Healthcheck đủ (backend/frontend/postgres/redis); `mem_limit` mọi service (backend 1500m… phù hợp t3.medium 4GB).

---

## 5. CI (4 workflow)
- **Gating thật (CONFIRMED):** `gitleaks` là job security **chặn duy nhất** (`security-ci.yml:30-43`). **Semgrep SAST, `npm audit`, OWASP Dependency-Check đều `|| true`/report-only** (`:65,91,104`). Backend CI: compile+unit test chặn; **integration test chỉ chạy main-push** (`backend-ci.yml:66`). Frontend CI chặn tsc/eslint/test/i18n. Không echo secret.
- **INF (CI) 🟡** — **Không `permissions:` block** trên `backend-ci.yml`/`frontend-ci.yml`/`mobile-ci.yml` → `GITHUB_TOKEN` mặc định (read-write rộng); chỉ `security-ci.yml` scope `contents:read` (`:21-23`). Fix: thêm `permissions: contents: read`.
- **INF (CI) 🟡** — Action pin **floating major tag** (`@v4/@v2`, Dependency-Check `@main`) — không SHA-pin → rủi ro supply-chain. Fix: SHA-pin.
- Không CodeQL (dùng Semgrep report-only, định thay tới khi bật GitHub Advanced Security `security-ci.yml:10-12`).

---

## 6. Resilience / TLS / backup
- **Single-node (CONFIRMED):** 1 EC2 (`deploy-backend.sh:24`), blue-green = same-host port swap 8081→8080; **không** node 2 / ALB / ASG trong repo. → kết hợp S-7 (no ShedLock): scale-out chưa khả thi an toàn.
- **TLS split (CONFIRMED):** Amplify terminate TLS cho Next.js FE; nginx+certbot/Let's Encrypt cho `api.mydeutschflow.com` trên EC2 (`deutschflow.nginx.conf:11,26-28,68-69`). Không ALB.
- **DB backup: SUSPECTED** dựa RDS automated snapshot (DB là RDS per `docker-compose.prod.yml:3`, `.env.production.example:8`) nhưng **không config snapshot/PITR/retention nào trong repo** → không kiểm chứng được.

---

## 7. Hạ tầng KHÔNG có trong repo (gap rõ ràng)
- **Không IaC** (0 Terraform/CloudFormation/CDK/Ansible) — EC2/RDS/security-group/Amplify/S3/CloudFront/DNS đều click-ops, không-as-code.
- **Không định nghĩa EC2 security-group/firewall** → không đánh giá được phơi nhiễm port (3000/3001/8080/9090/9093/3100/5050/6379) theo inbound rule. (ảnh hưởng INF-9.)
- **Không RDS backup/snapshot/PITR/Multi-AZ** as-code.
- **Không CodeQL** (Semgrep report-only thay thế).

---

## Bảng điểm Pass 6
| ID | Mức | Vấn đề | file:dòng |
|---|---|---|---|
| INF-1 | 🟠 | Prometheus scrape actuator không auth ↔ prod ADMIN-gate → không metric | prometheus.yml:21-24; SecurityConfig.java:107 |
| INF-11 | 🟠 | Alert DB-pool (P0) chết vì INF-1 | alert.rules.yml:13-20 |
| INF-2 | 🟠 | /actuator reachable từ internet (nginx không block) | deutschflow.nginx.conf:80-81 |
| INF-3 | 🟠 | Image hạ tầng `:latest` không pin | docker-compose.prod.yml:104,123,165 |
| INF-10 | 🟡 | Promtail không scrub PII/secret; Loki no-auth | promtail/config.yml:20-28 |
| INF-5 | 🟡 | repair-before-migrate default true | application.yml:221-224 |
| INF-9 | 🟡 | Observability port phơi host (Grafana admin) | docker-compose.prod.yml:170-173 |
| INF-6 | 🟡 | deploy git push + reset --hard | deploy-backend.sh:195,263 |
| INF-7 | 🟡 | deploy exit1 ở cleanup prompt dù success | deploy-backend.sh:536 |
| INF-4 | 🟡 | CI deploy job chết còn hard-restart body | backend-ci.yml:100-122 |
| INF-CI-perm | 🟡 | Thiếu `permissions:` block 3 workflow | backend/frontend/mobile-ci.yml |
| INF-CI-pin | 🟡 | Action không SHA-pin | .github/workflows/* |
| INF-8 | 🟡 | Healthcheck bỏ qua :8000 (moot Groq prod) | deploy-backend.sh:498 |
| INF-12 | ✅ | non-root, no build-arg secret, mem_limit, gitignore | Dockerfile; compose |

**Tóm tắt Pass 6**: Cơ bản container tốt (non-root, secret runtime, mem_limit). Nhưng **alerting hậu-P0 gần như không fire trong prod (INF-1+INF-11)** — phải verify trước khi tin. Actuator phơi edge (INF-2), image `:latest` (INF-3), log không scrub (INF-10). CI: chỉ gitleaks chặn, SAST/deps report-only; thiếu `permissions:` + SHA-pin. **Không IaC, không backup as-code, single-node** — kết hợp S-7 chặn scale-out.
