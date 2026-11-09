# Quy trình phát hành DeutschFlow — frontend, backend, mobile, hạ tầng

> **Bắt buộc đọc hết tài liệu này trước mỗi lần merge vào `main` hoặc deploy bất cứ thứ gì lên production** (luật trong `CLAUDE.md`).
> Tài liệu nằm trong repo để không phụ thuộc trí nhớ của người hay của phiên AI nào. Khi quy trình đổi, sửa tài liệu này trong cùng PR với thay đổi đó.
>
> Repo PRIVATE từ 08/11/2026 (từng public, có thể còn bản sao cũ; có thể public lại): tài liệu này vẫn **không** chứa IP máy chủ, đường dẫn khoá, giá trị secret. Các chi tiết đó nằm ở tài liệu vận hành local trên máy owner (`docs/DEPLOY_TU_HOST.md`, `docs/KE_HOACH_SERVER_MAY_NHA.md` — không commit).
>
> Cập nhật lần cuối: 08/11/2026 (repo private: máy chủ lấy code bằng deploy key chỉ đọc, §8.5).

---

## 0. Luật cứng (đọc kể cả khi vội)

1. **Production không còn chạy trên AWS.** Frontend và backend chạy trên máy chủ tự host `deutschflow-srv` (VM Ubuntu, sau Cloudflare Tunnel). `amplify.yml` và job "Deploy to EC2" trong `backend-ci.yml` đã gỡ. `deploy-backend.sh`, `cleanup-deploy.sh` ở gốc repo là **di sản AWS — đã chặn bằng `exit 1`, không dùng, không "sửa cho chạy"** (script cũ ghi đè env của máy chủ bằng env EC2 cũ ⇒ mất DB, chết mọi phiên đăng nhập).
2. **Merge vào `main` KHÔNG tự deploy.** Không còn Amplify tự build. Muốn lên web phải chạy script deploy trên máy chủ (§5, §6), trực tiếp qua SSH hoặc qua workflow "Deploy production" chạy tay, owner duyệt từng lần (§5.0).
3. **Deploy production (frontend, backend, OTA mobile) chỉ khi owner ra lệnh trực tiếp** trong phiên làm việc. "Merge đi" không có nghĩa là "deploy đi" — hỏi lại nếu chưa rõ.
4. **`main` được bảo vệ**: chỉ nhận thay đổi qua Pull Request, CI phải xanh. Không push thẳng, không force-push. Repo private trên gói GitHub miễn phí thì GitHub **không** áp luật bảo vệ nhánh (cần GitHub Pro): khi đó luật này chỉ còn do hook máy dev và kỷ luật giữ — vẫn làm đúng, không vì GitHub không chặn mà merge khi CI chưa xanh.
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
GitHub ──► CI (frontend-ci, backend-ci, mobile-ci, security-ci); KHÔNG tự deploy.
GitHub Actions "Deploy production" (chạy tay + owner duyệt) ──► Cloudflare Access SSH ──► forced command trên máy chủ (§5.0)
```

| Thành phần | Ở đâu | Ghi chú |
|---|---|---|
| Repo trên máy chủ | `/srv/deutschflow/repo` (clone nông) | Script deploy tự `fetch` + `reset --hard` về nhánh deploy. Remote `origin` = `git@github.com:…` qua deploy key chỉ đọc (§8.5) |
| Script deploy | `deploy/self-host/` | Xem `deploy/self-host/README.md` |
| Env backend | `/srv/deutschflow/env/backend.env` | Nguồn chân lý nằm trên máy chủ |
| Build args frontend | `/srv/deutschflow/env/frontend-build.env` + JWT public key | Nhúng lúc build |
| Secret | `/home/deploy/secrets/` | Không bao giờ rời máy chủ (trừ bản sao khoá backup owner tự cất) |
| Upstream nginx hiện hành | `/etc/nginx/deutschflow-upstreams/*.conf` | Cho biết màu nào đang phục vụ |
| Backup DB | `/backup/db` (14 bản) + R2 (30 ngày), timer 03:00 giờ VN | Mã hoá `age`, §8.3 |

Kết nối SSH, IP, đường dẫn khoá: xem tài liệu vận hành local (`docs/DEPLOY_TU_HOST.md` §1, §7). Nên đặt alias `Host deutschflow-srv` trong `~/.ssh/config` để lệnh trong tài liệu này dùng thẳng `ssh deutschflow-srv`.

---

## 2. Nhánh nào đang được deploy — KIỂM TRƯỚC MỖI LẦN

Code tự host (`feat/tu-host-r2`) đã vào `main` qua PR `chore/tu-host-r2-vao-main`. **Nguồn code của máy chủ là `main`.**

| | Lệnh |
|---|---|
| Lần deploy **đầu tiên** sau khi PR tự host merge (repo máy chủ còn đứng ở `feat/tu-host-r2`) | `DEPLOY_BRANCH=main deploy/self-host/deploy-*-vm.sh` — `fetch_code` chạy `checkout -B main`, repo máy chủ chuyển hẳn sang `main` |
| Các lần sau | `deploy/self-host/deploy-*-vm.sh` (mặc định nhánh hiện tại = `main`) |

Kiểm nhanh trên máy chủ: `git -C /srv/deutschflow/repo rev-parse --abbrev-ref HEAD` (phải là `main`) và `git -C /srv/deutschflow/repo log -1 --oneline`.

**Không deploy từ nhánh khác `main`** trừ khi owner ra lệnh rõ (ví dụ thử một nhánh); deploy xong nhánh thử thì lần sau phải `DEPLOY_BRANCH=main` để quay về. `feat/tu-host-r2` không còn dùng.

---

## 3. Vòng đời một thay đổi

```
nhánh feature ──► PR vào main ──► CI xanh + tự kiểm (§4) ──► merge
     ──► (nếu máy chủ chưa theo main: gộp vào nhánh deploy, §2)
     ──► owner ra lệnh deploy ──► chạy script (§5/§6) hoặc workflow (§5.0) ──► kiểm sau deploy (§9) ──► ghi nhận (§11)
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
- [ ] Không có token/mã một lần trong URL gửi tới analytics (PostHog) hay ở lại thanh địa chỉ sau khi trang đọc xong (QLT-20).
- [ ] Trang công khai mới có title riêng; không số liệu hard-code (số học viên, số đề, điểm sao), không giá gạch, không đếm ngược (QLT-19).

**Frontend** (`frontend/`)
- [ ] `npm run lint`, `npx tsc --noEmit`, `npm run check:design-tokens` (sửa `src/app/v2`, `src/components/ui-v2`, `src/components/landing-v2` thì bắt buộc), `npx vitest run`, `npm run build` — đạt. Lỗi sẵn có trên Windows (`noRelativeApiFetch.test.ts`, `designTokenLint.test.ts`) ghi rõ trong PR.
- [ ] Trang công khai: chụp kiểm 1440px và 390px trên bản build, không cuộn ngang; đối chiếu sổ lời hứa (không hứa điều chưa chạy).
- [ ] Đổi `src/middleware.ts` hoặc `next.config.mjs`: chạy test middleware/CSP (`middlewareCsp*.test.ts`, `publicLocale.test.ts`) — đây là nơi hay xung đột với nhánh tự host.

**Backend** (`backend/`)
- [ ] `./mvnw test` đạt (CI chạy compile, unit, integration).
- [ ] Endpoint GET mới không ghi DB và không gọi AI (QLT-21). Buộc phải ghi khi đọc thì thêm vào `SupportSessionRequestPolicy` hoặc bỏ qua bước ghi khi `SupportSessionContextHolder.isActive()` — nếu không, Phiên hỗ trợ chỉ đọc của admin sẽ 403 ở trang đó.
- [ ] Migration mới: số lớn hơn mọi migration trên `main` **và mọi nhánh đang mở** — kiểm bằng `git ls-tree -r --name-only origin/<nhánh> backend/src/main/resources/db/migration | sort -V | tail -3` cho từng nhánh liên quan.
- [ ] Migration tương thích ngược (màu cũ vẫn chạy được trên schema mới trong lúc blue-green, §6.2).
- [ ] Chạy được trên DB trắng: `scripts/verify-fresh-migrations.sh` (cần Docker) hoặc CI integration xanh.

**Mobile** (`mobile/`)
- [ ] `mobile-ci` xanh; nếu job "Fingerprint" cảnh báo đổi runtime ⇒ thay đổi này **không** đi bằng OTA được, cần build native mới (§7).

---

## 5.0 Deploy từ xa bằng workflow "Deploy production"

Dùng khi không ngồi ở máy có khoá SSH (ví dụ đang ở ngoài, chỉ có điện thoại). Merge vẫn **không** tự deploy (§0.2). Workflow chỉ là một đường khác để chạy đúng hai script ở §5, §6, và vẫn chỉ chạy khi owner ra lệnh (§0.3).

**Chạy**
- Điện thoại: app GitHub → repo → Actions → **Deploy production** → Run workflow (nhánh `main`), chọn `target` và `mode`. Sau đó vào lần chạy đó → **Review deployments** → Approve.
- Máy có `gh`: `gh workflow run deploy-production.yml -R CuDinh03/DeutschFlow -f target=both -f mode=deploy`. Owner vẫn phải bấm duyệt.
- Lần đầu sau khi cài, và sau khi đổi bất cứ gì ở phần cài đặt: chạy `mode=check` trước.

| `mode` | Làm gì |
|---|---|
| `deploy` | `DEPLOY_BRANCH=main deploy-*-vm.sh`. `both` = backend xong mới tới frontend, backend đỏ thì dừng. Từ chối nếu `main` đã có commit mới sau lúc bấm chạy (không deploy thứ chưa được duyệt) |
| `check` | Kiểm kết nối, nhánh + commit repo máy chủ, upstream đang phục vụ, `sudo -n nginx -t`, container. Không đổi gì |
| `rollback` | `deploy-*-vm.sh --rollback`, từng phần một (§10) |

Workflow tự chạy phần `curl` của §9. Phần kiểm bằng mắt của §9 vẫn làm tay, rồi ghi nhận §11.

**Các lớp chặn**
1. Chỉ `workflow_dispatch`, chỉ từ `main`. Environment `production` bắt owner duyệt **từng lần chạy**.
2. Cloudflare Access đứng trước hostname SSH: chỉ service token của workflow qua được.
3. Khoá SSH riêng của workflow: `restrict`, `from="127.0.0.1,::1"` (cloudflared đưa kết nối vào từ localhost), forced command `deploy/self-host/remote-deploy-guard.sh`. Khoá này chỉ chạy được ba lệnh trên, không có shell.
4. Host key máy chủ được ghim (`StrictHostKeyChecking yes`).

Coi **log Actions là công khai** (repo từng public và có thể public lại; người có quyền đọc repo đều xem được). Script deploy chỉ in tên biến, không in giá trị. Không thêm `set -x`, `env`, `cat *.env` vào script deploy hay workflow.

**Thu hồi khẩn**: xoá dòng khoá trong `authorized_keys` **hoặc** revoke service token trên Cloudflare. Một trong hai là đủ chặn.

### Cài đặt một lần (owner, cần ngồi ở máy có SSH)

Máy chủ (user có sudo):
1. Tạo cặp khoá **riêng** cho workflow, không dùng lại khoá cá nhân: `ssh-keygen -t ed25519 -N '' -C github-actions-deploy -f /tmp/gha_deploy`.
2. Cài guard ra ngoài repo (sau khi PR này đã vào `main` và repo máy chủ đã lấy code mới):
   `sudo install -o root -g root -m 755 /srv/deutschflow/repo/deploy/self-host/remote-deploy-guard.sh /usr/local/sbin/deutschflow-remote-deploy`.
   Mỗi lần file này đổi trong repo ⇒ chạy lại lệnh install.
3. Thêm một dòng vào `/home/deploy/.ssh/authorized_keys`:
   `restrict,from="127.0.0.1,::1",command="/usr/local/sbin/deutschflow-remote-deploy" ` + nội dung `/tmp/gha_deploy.pub`.
4. Dòng known_hosts cho workflow: `echo "deutschflow-srv $(cut -d' ' -f1,2 /etc/ssh/ssh_host_ed25519_key.pub)"`.
5. Kiểm hai điều kiện script cần khi chạy không có terminal: `sudo -u deploy sudo -n nginx -t` phải qua, không hỏi mật khẩu. User `deploy` phải ghi được `/srv/deutschflow/remote-deploy.lock`.

Cloudflare (dashboard Zero Trust):

6. Tunnel của máy chủ → thêm Public hostname, ví dụ `ssh.mydeutschflow.com` → Service `ssh://localhost:22`. Nếu tunnel cấu hình bằng file trên máy chủ thì thêm ingress tương ứng rồi restart `cloudflared`.
7. Access → Service Auth → tạo service token `github-actions-deploy`. Client ID và Secret chỉ hiện một lần. Đặt thời hạn và ghi ngày hết hạn vào lịch.
8. Access → Applications → Self-hosted cho đúng hostname ở bước 6. Policy đặt Action **Service Auth**, Include: service token ở bước 7. Muốn tự SSH bằng email thì thêm một policy Allow riêng cho email owner.

GitHub (Settings → Environments):

9. Tạo environment `production`: **Required reviewers** = owner; **Deployment branches** = chỉ `main`.
10. Environment secrets (không phải repo secrets):
    - `DEPLOY_SSH_KEY`: nội dung `/tmp/gha_deploy`
    - `DEPLOY_SSH_KNOWN_HOSTS`: dòng in ra ở bước 4
    - `DEPLOY_SSH_HOSTNAME`: hostname ở bước 6
    - `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`: lấy ở bước 7

    Xong thì `shred -u /tmp/gha_deploy /tmp/gha_deploy.pub`.
11. Chạy workflow với `mode=check`, `target=backend` rồi `target=frontend`. Cả hai xanh thì mới dùng `deploy`.

---

## 5. Deploy frontend

Chỉ khi owner ra lệnh. Trên máy chủ, user `deploy` (hoặc từ xa: §5.0):

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

Chỉ khi owner ra lệnh. Trên máy chủ (hoặc từ xa: §5.0):

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

### 8.5 Máy chủ lấy code từ repo private (deploy key)
Từ 08/11/2026 repo private ⇒ clone HTTPS không có thông tin đăng nhập trên máy chủ không `fetch` được (`could not read
Username for 'https://github.com'`; script dừng ở "Lấy code", production không bị đụng). Cách đang dùng:

- Khoá riêng `~/.ssh/github_deploy` của user `deploy` (ed25519, chỉ nằm trên máy chủ). Khoá công khai thêm ở GitHub →
  repo → Settings → **Deploy keys**, tên `deutschflow-srv (chi doc, deploy)`, **không** cho ghi.
- `~/.ssh/config` của `deploy`: `Host github.com` → `IdentityFile ~/.ssh/github_deploy`, `IdentitiesOnly yes`,
  `UserKnownHostsFile ~/.ssh/github_known_hosts`, `StrictHostKeyChecking yes`. `github_known_hosts` lấy từ
  `https://api.github.com/meta` (`ssh_keys`), không nhận khoá bừa. GitHub đổi khoá máy chủ thì lấy lại file này.
- `git -C /srv/deutschflow/repo remote set-url origin git@github.com:CuDinh03/DeutschFlow.git`. Kiểm:
  `git -C /srv/deutschflow/repo fetch --depth 1 origin main`.
- Workflow "Deploy production" (§5.0) chạy script dưới user `deploy` nên dùng chung cách này.
- **Thu hồi**: xoá deploy key ở GitHub (có hiệu lực ngay). Lộ máy chủ ⇒ xoá key, tạo cặp mới, thêm lại.
- **Dự phòng** khi máy chủ không ra được GitHub: ở máy dev `git bundle create f <commit máy chủ đang có>..origin/main`, gửi
  lên qua lệnh SSH (stdin) rồi `git fetch /tmp/f refs/remotes/origin/main:refs/remotes/origin/main && git reset --hard
  origin/main` trong repo máy chủ, deploy với `SKIP_FETCH=1`. Repo máy chủ là clone nông: bundle cần các commit nền có sẵn
  (`git bundle verify` báo).
- Repo private trên gói miễn phí: Actions có hạn mức phút mỗi tháng, luật bảo vệ nhánh không được áp (§0.4).

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
