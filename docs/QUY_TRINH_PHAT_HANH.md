# Quy trình phát hành DeutschFlow — frontend, backend, mobile, hạ tầng

> **Bắt buộc đọc hết tài liệu này trước mỗi lần merge vào `main` hoặc deploy bất cứ thứ gì lên production** (luật trong `CLAUDE.md`).
> Tài liệu nằm trong repo để không phụ thuộc trí nhớ của người hay của phiên AI nào. Khi quy trình đổi, sửa tài liệu này trong cùng PR với thay đổi đó.
>
> Repo PUBLIC: tài liệu này **không** chứa IP máy chủ, đường dẫn khoá, giá trị secret. Các chi tiết đó nằm ở tài liệu vận hành local trên máy owner (`docs/DEPLOY_TU_HOST.md`, `docs/KE_HOACH_SERVER_MAY_NHA.md` — không commit).
>
> Cập nhật lần cuối: 20/10/2026.

---

## 0. Luật cứng (đọc kể cả khi vội)

1. **Production không còn chạy trên AWS.** Frontend và backend chạy trên máy chủ tự host `deutschflow-srv` (VM Ubuntu, sau Cloudflare Tunnel). `amplify.yml`, `deploy-backend.sh`, `cleanup-deploy.sh` ở gốc repo và job "Deploy to EC2" trong `backend-ci.yml` là **di sản AWS — không dùng, không "sửa cho chạy"** (script cũ ghi đè env của máy chủ bằng env EC2 cũ ⇒ mất DB, chết mọi phiên đăng nhập).
2. **Merge vào `main` KHÔNG tự deploy.** Không còn Amplify tự build. Muốn lên web phải chạy script deploy trên máy chủ (§5, §6).
3. **Deploy production (frontend, backend, OTA mobile) chỉ khi owner ra lệnh trực tiếp** trong phiên làm việc. "Merge đi" không có nghĩa là "deploy đi" — hỏi lại nếu chưa rõ.
4. **`main` được bảo vệ**: chỉ nhận thay đổi qua Pull Request, CI phải xanh. Không push thẳng, không force-push.
5. **Biết máy chủ đang deploy từ nhánh nào trước khi làm gì** (§2). Deploy một nhánh thiếu code tự host (R2, Dockerfile, CSP) sẽ làm hỏng production.
6. **Migration Flyway chạy theo thứ tự, không cho chạy lệch** (`out-of-order: false`). Số migration phải lớn hơn mọi số đang có trên `main` **và trên mọi nhánh đang mở**; nhánh có số nhỏ hơn phải lên prod trước (§6.2).
7. **Env và secret chỉ sống trên máy chủ.** Không bao giờ chép `.env` từ máy dev lên, không commit, không in giá trị ra log hay chat.
8. **Sửa code thì cập nhật SRS cùng đợt** (`TAI_LIEU_DAC_TA_SAN_PHAM/chi-tiet/` + ca nghiệm thu, ca mới để NOT_RUN).

---

## 1. Bức tranh hạ tầng

```
Người dùng ──HTTPS──► Cloudflare (DNS, TLS, proxy)
                          │  Cloudflare Tunnel (máy chủ không mở cổng vào)
                          ▼
                   deutschflow-srv (VM Ubuntu 24.04, user `deploy`)
                   nginx 127.0.0.1:80  ── upstream blue-green ──┐
                     ├─ mydeutschflow.com      → frontend :3000 | :3001  (Next.js standalone, container)
                     └─ api.mydeutschflow.com  → backend  :8080 | :8081  (Spring Boot, container)
                   mạng docker `deutschflow-net` (mọi cổng chỉ bind 127.0.0.1):
                     deutschflow-postgres (pgvector pg16) · deutschflow-redis · deutschflow-edge-tts
                   Lưu file: Cloudflare R2 (bucket media; bucket backup cho bản sao lưu DB)
Mobile (Expo/EAS) ──► gọi api.mydeutschflow.com; bản build qua EAS → TestFlight; vá JS qua EAS Update (OTA)
GitHub ──► CI (frontend-ci, backend-ci, mobile-ci, security-ci); KHÔNG deploy.
```

| Thành phần | Ở đâu | Ghi chú |
|---|---|---|
| Repo trên máy chủ | `/srv/deutschflow/repo` (clone nông) | Script deploy tự `fetch` + `reset --hard` về nhánh deploy |
| Script deploy | `deploy/self-host/` (trên nhánh tự host, §2) | Xem `deploy/self-host/README.md` |
| Env backend | `/srv/deutschflow/env/backend.env` | Nguồn chân lý nằm trên máy chủ |
| Build args frontend | `/srv/deutschflow/env/frontend-build.env` + JWT public key | Nhúng lúc build |
| Secret | `/home/deploy/secrets/` | Không bao giờ rời máy chủ (trừ bản sao khoá backup owner tự cất) |
| Upstream nginx hiện hành | `/etc/nginx/deutschflow-upstreams/*.conf` | Cho biết màu nào đang phục vụ |
| Backup DB | `/backup/db` (14 bản) + R2 (30 ngày), timer 03:00 giờ VN | Mã hoá `age`, §8.3 |

Kết nối SSH, IP, đường dẫn khoá: xem tài liệu vận hành local (`docs/DEPLOY_TU_HOST.md` §1, §7). Nên đặt alias `Host deutschflow-srv` trong `~/.ssh/config` để lệnh trong tài liệu này dùng thẳng `ssh deutschflow-srv`.

---

## 2. Nhánh nào đang được deploy — KIỂM TRƯỚC MỖI LẦN

| | Hiện tại (20/10/2026) | Sau khi PR tự host được merge |
|---|---|---|
| Nguồn code của máy chủ | nhánh **`feat/tu-host-r2`** (chưa merge vào `main`) | `main` |
| Lệnh deploy | `deploy/self-host/deploy-*-vm.sh` (mặc định nhánh hiện tại của repo trên máy chủ) | `DEPLOY_BRANCH=main deploy/self-host/deploy-*-vm.sh` |

Kiểm nhanh trên máy chủ: `git -C /srv/deutschflow/repo rev-parse --abbrev-ref HEAD` và `git -C /srv/deutschflow/repo log -1 --oneline`.

**Hệ quả khi máy chủ còn theo `feat/tu-host-r2`:** mọi thứ merge vào `main` chỉ lên web sau khi được gộp vào `feat/tu-host-r2` (hoặc sau khi PR tự host merge và chuyển sang deploy `main`). Gộp `main` vào `feat/tu-host-r2` phải xử lý xung đột ở máy dev, chạy test + build, rồi mới push — không gộp trên máy chủ.

> Việc nên làm sớm: merge PR của `feat/tu-host-r2` vào `main`, đổi repo máy chủ sang `main`, xoá `amplify.yml` + hai script EC2 + job deploy EC2. Khi xong, sửa bảng trên và §0.1.

---

## 3. Vòng đời một thay đổi

```
nhánh feature ──► PR vào main ──► CI xanh + tự kiểm (§4) ──► merge
     ──► (nếu máy chủ chưa theo main: gộp vào nhánh deploy, §2)
     ──► owner ra lệnh deploy ──► chạy script (§5/§6) ──► kiểm sau deploy (§9) ──► ghi nhận (§11)
```

- **Đặt tên nhánh**: `feat/…`, `fix/…`, `docs/…`. PR xếp chồng được (base là nhánh feature khác); khi PR nền merge thì đổi base của PR trên về `main`.
- **Mỗi PR một mục đích** (frontend riêng, backend riêng nếu deploy độc lập được). PR backend có migration ghi rõ số migration và phụ thuộc vào PR nào.
- **Commit**: tiếng Việt, kiểu `feat(phạm vi): …`. Không commit credential, không commit thay đổi `.gitignore` của owner nếu không được bảo.

---

## 4. Checklist trước khi merge vào `main`

**Chung**
- [ ] Đã đọc §0 và §2 của tài liệu này.
- [ ] CI xanh trên PR: `security-ci` (gitleaks, Semgrep, npm audit, OWASP) + CI của phần bị đổi. Check "skipped" chỉ hợp lệ khi phần đó không đổi.
- [ ] Diff chỉ chứa đúng phạm vi PR (không lẫn file của việc khác, không lẫn `.env*`, không lẫn file lớn).
- [ ] SRS đã cập nhật (luật §0.8).

**Frontend** (`frontend/`)
- [ ] `npm run lint`, `npx tsc --noEmit`, `npm run check:design-tokens` (sửa `src/app/v2`, `src/components/ui-v2`, `src/components/landing-v2` thì bắt buộc), `npx vitest run`, `npm run build` — đạt. Lỗi sẵn có trên Windows (`noRelativeApiFetch.test.ts`, `designTokenLint.test.ts`) ghi rõ trong PR.
- [ ] Trang công khai: chụp kiểm 1440px và 390px trên bản build, không cuộn ngang; đối chiếu sổ lời hứa (không hứa điều chưa chạy).
- [ ] Đổi `src/middleware.ts` hoặc `next.config.mjs`: chạy test middleware/CSP (`middlewareCsp*.test.ts`, `publicLocale.test.ts`) — đây là nơi hay xung đột với nhánh tự host.

**Backend** (`backend/`)
- [ ] `./mvnw test` đạt (CI chạy compile, unit, integration).
- [ ] Migration mới: số lớn hơn mọi migration trên `main` **và mọi nhánh đang mở** — kiểm bằng `git ls-tree -r --name-only origin/<nhánh> backend/src/main/resources/db/migration | sort -V | tail -3` cho từng nhánh liên quan.
- [ ] Migration tương thích ngược (màu cũ vẫn chạy được trên schema mới trong lúc blue-green, §6.2).
- [ ] Chạy được trên DB trắng: `scripts/verify-fresh-migrations.sh` (cần Docker) hoặc CI integration xanh.

**Mobile** (`mobile/`)
- [ ] `mobile-ci` xanh; nếu job "Fingerprint" cảnh báo đổi runtime ⇒ thay đổi này **không** đi bằng OTA được, cần build native mới (§7).

---

## 5. Deploy frontend

Chỉ khi owner ra lệnh. Trên máy chủ, user `deploy`:

```bash
ssh deutschflow-srv
cd /srv/deutschflow/repo
deploy/self-host/deploy-frontend-vm.sh                 # nhánh hiện tại của repo máy chủ (§2)
# sau khi máy chủ theo main:
DEPLOY_BRANCH=main deploy/self-host/deploy-frontend-vm.sh
```

Script làm: kiểm `frontend-build.env` đủ biến → `fetch` + `reset --hard` → `docker build` (Next.js standalone, ~1,5–2 GB RAM, vài phút) với build args từ máy chủ + JWT public key → chạy màu kia (3000 ↔ 3001) → kiểm trang `/v2/login/` = 200 và **cổng vai trò middleware bật** → đổi upstream nginx → gỡ màu cũ → tag `:prev`/`:latest`.

Điều phải nhớ:
- `JWT_RSA_PUBLIC_KEY` và `CSP_ENFORCE` **nhúng lúc build**. Thiếu public key ⇒ middleware không chặn được `/v2/admin/` (script đã kiểm). **Xoay cặp khoá JWT ⇒ phải build lại frontend cùng lúc restart backend.**
- `next.config.mjs` phải giữ `output: 'standalone'` (Dockerfile chép `.next/standalone`).
- Trang công khai `force-dynamic` + ngôn ngữ theo URL (`/`, `/en/`, `/de/`) do middleware rewrite — kiểm cả ba sau deploy.
- Rollback: `deploy/self-host/deploy-frontend-vm.sh --rollback` (chạy `:prev` ở màu kia).

---

## 6. Deploy backend

### 6.1 Lệnh

Chỉ khi owner ra lệnh. Trên máy chủ:

```bash
cd /srv/deutschflow/repo
deploy/self-host/deploy-backend-vm.sh                  # 0 downtime, blue-green 8080 ↔ 8081
DEPLOY_BRANCH=main deploy/self-host/deploy-backend-vm.sh   # sau khi máy chủ theo main
deploy/self-host/deploy-backend-vm.sh --rollback       # quay về :prev
```

Script: preflight (`backend.env` đủ biến, không còn `AWS_*`/placeholder, disk < 90 %, Postgres `pg_isready`, Redis `PONG`) → build image tag theo commit → chạy màu kia → health 300 s + warm-up → đổi upstream nginx → kiểm `https://api.mydeutschflow.com/actuator/health` = UP → xả màu cũ sau 30 s → tag `:prev`/`:latest` → dọn an toàn.

### 6.2 Migration (Flyway)

- Màu mới chạy migration **trước** khi nhận traffic, màu cũ vẫn phục vụ ⇒ migration phải **tương thích ngược**: thêm cột nullable/có mặc định, thêm bảng; **không** đổi tên/xoá cột đang dùng trong cùng một lần (tách 2 lần deploy).
- Migration lỗi ⇒ màu mới không UP ⇒ script dừng, prod không bị đụng. Nhưng migration đã chạy một phần thì **không tự lùi**: đọc log, sửa bằng migration mới; nếu dữ liệu hỏng thì restore (§8.3).
- `out-of-order: false`: nhánh mang số migration nhỏ hơn phải lên prod **trước**. Bài học 19/10/2026: hai nhánh cùng dùng V333 — phải đổi số trước khi merge. Ghi phụ thuộc trong mô tả PR (ví dụ "V334 — cần PR #700 (V333) lên trước").
- Trước khi deploy migration lớn: chạy backup tay (`deploy/self-host/backup-db.sh`) và xác nhận `/backup/db/.last-success` mới.

### 6.3 Edge TTS
Chỉ khi `backend/edge-tts-sidecar/` đổi: build lại container `deutschflow-edge-tts` (lệnh ở `docs/DEPLOY_TU_HOST.md` §3.4), kiểm health từ trong container backend.

---

## 7. Mobile (Expo / EAS)

Runbook đầy đủ: `mobile/DEPLOYMENT.md` (local). Tóm tắt luật:

| Thay đổi | Cách phát hành | Ai ra lệnh |
|---|---|---|
| Chỉ JS/TS/asset trong `app/`, `components/`, `lib/` | **OTA**: `npx eas-cli@latest update --channel production --message "…"` từ cây sạch, đúng commit | Owner |
| Đụng native: deps trong `package.json`, `app.json`, `eas.json`, quyền, SDK, icon, splash | **Build native mới**: `eas build` → `eas submit --platform ios --latest` → TestFlight | Owner |

- Policy `runtimeVersion: fingerprint`: OTA chỉ tới bản build có fingerprint trùng. Sau mỗi lần publish kiểm `npx eas-cli@latest update:list --branch production` — `runtimeVersion` phải trùng build đích.
- Không thêm `.fingerprintignore` giữa vòng đời một build.
- Mobile gọi `api.mydeutschflow.com`: thay đổi API phá tương thích phải deploy backend theo kiểu tương thích ngược, vì bản app cũ còn trên máy người dùng.

---

## 8. Hạ tầng

### 8.1 Env và secret
- Sửa env backend: sửa `/srv/deutschflow/env/backend.env` trên máy chủ rồi deploy lại backend. Sửa build args frontend: `frontend-build.env` rồi deploy lại frontend.
- Không ghi giá trị secret vào repo, log, PR, chat. Preflight chỉ in **tên** biến.

### 8.2 nginx, Cloudflare Tunnel
- nginx chỉ nghe `127.0.0.1:80`; site cấu hình bằng `deploy/self-host/install-nginx.sh` (`deutschflow.nginx.conf`). Đổi cấu hình: `nginx -t` rồi `systemctl reload nginx` (reload êm, request đang chạy vẫn xong).
- Máy chủ không mở cổng vào Internet; mọi đường vào qua Cloudflare Tunnel. Header `Server: cloudflare` trên production là bình thường.

### 8.3 Backup và restore
- Tự chạy 03:00 giờ VN: `systemctl list-timers deutschflow-backup.timer`; bản mới nhất ghi ở `/backup/db/.last-success`.
- Diễn tập restore hằng tháng vào container tạm: `deploy/self-host/restore-db.sh <file> <khoá-age> --into-scratch`. Restore đè prod (`--into-prod`) chỉ khi owner ra lệnh.
- Khoá bí mật `age` phải có ít nhất một bản ngoài máy dev và ngoài máy chủ (owner tự cất).

### 8.4 Dọn dẹp, tài nguyên
- `deploy/self-host/cleanup-vm.sh`: giữ `:latest`, `:prev`, 3 tag commit gần nhất; không đụng volume. **Không** dùng `docker system prune --volumes`.
- Hai JVM cùng chạy lúc blue-green ≈ 2 × 1,1 GB; build frontend ≈ 1,5–2 GB. Không deploy frontend và backend **cùng lúc** nếu RAM trống dưới ~4 GB.

---

## 9. Kiểm tra sau deploy

```bash
curl -s https://api.mydeutschflow.com/actuator/health          # {"status":"UP"}
curl -s -o /dev/null -w "%{http_code}\n" https://mydeutschflow.com/          # 200
curl -s -o /dev/null -w "%{http_code}\n" https://mydeutschflow.com/en/       # 200
curl -s -o /dev/null -w "%{http_code}\n" https://mydeutschflow.com/v2/login/ # 200
```
- Mở trang chủ và trang vừa đổi trên máy tính và điện thoại; đăng nhập thử một tài khoản học viên; một phiên luyện nói ngắn nếu backend đổi phần speaking.
- Endpoint công khai mới (nếu có) trả đúng, không cần token.
- Trên máy chủ: `docker ps` (màu mới chạy, màu cũ đã gỡ), `cat /etc/nginx/deutschflow-upstreams/*.conf`, `free -h`, `df -h`.

---

## 10. Sự cố và rollback

| Triệu chứng | Làm ngay |
|---|---|
| Web lỗi/trắng sau deploy frontend | `deploy/self-host/deploy-frontend-vm.sh --rollback` |
| API lỗi sau deploy backend, migration không đổi schema | `deploy/self-host/deploy-backend-vm.sh --rollback` (trong ~30 s đầu chỉ cần đổi upstream lại) |
| API lỗi do migration | Không rollback image mù quáng (image cũ có thể không chạy trên schema mới). Đọc log, viết migration sửa, deploy lại; dữ liệu hỏng thì restore (§8.3) — có lệnh owner |
| Web không đổi sau merge | Bình thường: merge không deploy (§0.2). Kiểm nhánh deploy (§2) rồi chạy script khi owner ra lệnh |
| Script dừng ở preflight | Đọc tên biến bị báo thiếu, sửa env **trên máy chủ**; không chép env từ máy dev |
| Cổng vai trò middleware tắt | Thiếu JWT public key lúc build — kiểm `~/secrets/jwt_public.pem`, deploy lại frontend |

Khi không chắc: dừng, báo owner, không thử "sửa cho chạy" trên production.

---

## 11. Ghi nhận sau mỗi lần phát hành

- Mô tả PR: phạm vi, kết quả kiểm tra, migration + phụ thuộc, có cần deploy gì.
- Sau deploy: ghi commit đã lên, màu đang chạy, kết quả §9 vào handoff mới nhất trong `plans/` (local) hoặc nhật ký vận hành của owner.
- Quy trình, hạ tầng hay nhánh deploy thay đổi ⇒ sửa tài liệu này (§2, §0) trong cùng PR.
