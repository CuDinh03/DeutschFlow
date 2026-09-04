# Bàn giao: Audit toàn diện + điều tra lag 02/09 — trạng thái đã chốt & gói tuần 1

> **Tài liệu TỰ ĐỨNG cho session sau — đọc file này TRƯỚC, không cần lục memory.**
> Nguồn chi tiết đầy đủ (bảng điểm 8 chiều, sơ đồ kiến trúc, 44 phát hiện, top-5 lag, nhật ký thi công):
> artifact **"Khám tổng quát DeutschFlow"** — https://claude.ai/code/artifact/38ab8deb-7db4-4023-8f53-91b616288b2b
> File này là phần THI HÀNH: cái gì đã xong, số đo baseline phải giữ, và việc kế tiếp theo thứ tự.
> Main tại thời điểm viết: `1ff5ed1d` (#470 mobile vừa vào sau chuỗi audit).

## 0. TL;DR — tối 02/09 đã làm gì

| Mảng | Trạng thái |
|---|---|
| Audit | 6 luồng phân tích + đo đạc thật (latency VN→prod, build, telemetry RDS, CloudWatch) → 44 phát hiện, top-5 giả thuyết lag |
| PR đã DEPLOY | **#467** (gói 24h: 7 job đêm ghim `zone=Asia/Ho_Chi_Minh`, `scheduling.pool.size=4`, SLO histogram + p50/p95/p99, tag rollback `:prev`, heap 65% một nguồn `${JVM_MAX_RAM_PCT:-65.0}`, hạ 5 log INFO/request) · **#468** (bearer token tĩnh cho Prometheus scrape, fail-closed; deploy tự materialize token file từ `.env.production`) · **#469** (token file chmod 644 — container prom chạy user `nobody`) |
| Observability | **SỐNG trọn chuỗi, đã nghiệm thu**: scrape `up` (targets API xác nhận) → 9 alert rules → Alertmanager → **Telegram 🔴 test nhận OK** (bot `@Deutschflow_Alerts_CuDinh_bot`; token + chat_id nằm trong `docker/alertmanager/alertmanager.yml` trên EC2 — gitignored). Stack Prometheus/Grafana/Loki/Promtail/Alertmanager trước 02/09 **TẮT HOÀN TOÀN** — owner đã bật |
| EC2 | Swap 2G active + fstab 1 entry + `vm.swappiness=10`; disk 59%; RAM available ~1,2GB với đủ backend + observability |
| Giả thuyết lag | **L1** (thuế địa lý + 100% SSR dynamic + i18n 245KB) CONFIRMED bằng đo · **L2-EC2 ĐÃ BÁC** (credit-spec `unlimited` + bình 576 luôn đầy + surplus 0) · **L2-RDS** đang chờ ảnh CloudWatch · **L3** (job đêm chạy 9–11h sáng VN) CONFIRMED + **ĐÃ SỬA #467**, chờ xác nhận trước/sau · **L4** (bão hòa theo workload: SRS/semaphore/deploy) CONFIRMED code · **L5** (cohort SW cũ + SSE reconnect + mobile không unmount) CONFIRMED code, một phần đã xử trên main |

## 1. Số đo BASELINE — giữ để so sánh trước/sau

- **Heatmap telemetry 7 ngày (giờ VN)**: bướu 10h sáng **p95 = 2.314ms / p99 = 4.232ms / 116 req** — giờ tệ nhất tuần, khớp cron UTC 03:00–03:30 (FSRS + retention). Các giờ khác p95 94–500ms. File baseline: `~/Developer/deutschflow-tools/lag-telemetry/lag-telemetry-20260902-191534.txt`.
- **Sàn mạng VN→prod** (curl 02/09): API ấm **0,47–0,52s** TTFB, lạnh 1,2–1,9s; trang SSR ấm ~0,5s, **lạnh 2,66–2,86s**; `/actuator/health` 1,0–1,2s kể cả kết nối ấm. Server-side p50 các endpoint đo được chỉ **6–33ms** → phần chậm là mạng + SSR.
- **Web build**: 100% route dynamic (ƒ), HTML ~300KB/trang (~87KB nén), First Load JS 224–405KB (stats 405, learn 360, interviews 351).
- **Bẫy đọc số**: `api_telemetry_events` chỉ phủ ~5 endpoint auth/notification — p95 endpoint khác đọc qua Prometheus histogram (đã bật ở #467): query mẫu `histogram_quantile(0.95, sum(rate(http_server_requests_seconds_bucket[5m])) by (le, uri))`.

## 2. VIỆC CHỜ DỮ LIỆU (đầu session sau: hỏi owner đã có chưa, chưa thì nhắc)

1. **Xác nhận job đêm chạy đúng đêm** (sau 03:35 VN 03/09):
   `ssh -i ~/Developer/DeutschFlow/deutschflow-key.pem ubuntu@35.175.232.152 "sudo docker logs --timestamps --since 12h deutschflow-backend 2>&1 | grep -E 'FSRS-OPT|Retention' | head"`
   → FSRS phải ở `T20:00Z` (=03:00 VN), retention `T20:30Z`. Không thấy = zone attr không ăn → điều tra.
2. **Rerun telemetry 5–7/09**: `~/Developer/deutschflow-tools/run-lag-telemetry.sh` → so dòng `gio_vn=10` với baseline. **Đạt**: 10h hết là giờ tệ nhất, p95 về mức nền; bướu dời về ~03:00 VN là ĐÚNG thiết kế. Đạt → chốt L3 vào artifact (status "CONFIRMED + FIXED + VERIFIED").
3. **Ảnh CloudWatch RDS** (owner chụp, Console → CloudWatch → Metrics → **Classic metrics** → RDS → Per-Database, khung 2 tuần, Period 1h): `FreeableMemory` (Min — **quan trọng nhất**, DB 1GB; sát đáy <100MB = ngộp RAM cache → nâng `t4g.small` như RECOVERY_CHECKLIST 2.1 khuyến nghị), `CPUUtilization` (Max), `DatabaseConnections` (Max), `CPUCreditBalance` (Min, đầy 288/hồi 12 mỗi giờ; RDS T4g mặc định cũng unlimited — kiểm Configuration).
4. **Ảnh AmplifyHosting** → `Latency` (p95 nếu có) + `Requests` + `5xxErrors`, 2 tuần → định lượng L1 server-side.
5. CloudShell AWS đang bị chặn "account verification ~2 ngày" (từ 02/09) — sau đó có thể dùng CLI thay Console.
6. Tuỳ chọn vệ sinh: token bot Telegram từng lộ trong chat/ảnh phiên 02/09 → BotFather `/revoke` rồi `sed` token mới vào `alertmanager.yml` + restart (1 phút).

## 3. GÓI TUẦN 1 — ✅ ĐÃ THI HÀNH TRỌN 02–03/09 (10 PR #473–#482, đều squash-merge)

> **Trạng thái (session 03/09 đêm):** W1=#473 · W3+W4+W5+W6=#475 · W2=#476 · W7=#482 (phần purge
> 15 dep bị cây v1 giữ chân — đi cùng Đợt 4; `components/chat` đã xoá từ trước; msw+tests/mocks đã
> dọn) · B1=#474 (owner chốt gộp 1 event/batch) · B2=#477 · B3=#478 (lưu ý: mọi entity IDENTITY
> nên batch INSERT của Hibernate chưa ăn — follow-up chuyển SEQUENCE) · B4+B5=#481 · M1+M2=#479
> (M3 SRS-offline + M4 Sentry ĐÃ XONG từ #454/build 17 — audit đọc cây WIP cũ; mobile CHƯA bắn
> OTA, đi chuyến kế) · H1-repo+H2+H3=#480 (H1 phần host + nâng stack observability: owner chạy
> `plans/2026-09-03-runbook-h1-nginx-sync-realip-sg.md`, đủ 3 bước).
> Backend đã deploy gộp sau #481; đối chiếu trước/sau bằng telemetry rerun 5–7/09 (§2.2).
> AC mới: AC-PERF-W1..W5, B1, B4, M1, M2, H1, H3 (NOT_RUN) trong acceptance-matrix local.

### (kế hoạch gốc giữ nguyên bên dưới để đối chiếu)

Nguyên tắc chung: mỗi cụm 1 PR từ worktree `origin/main`; KHÔNG gộp cụm khác domain; backend đổi hành vi = thêm/sửa test đi kèm.

### 3.1 Web — cảm nhận tức thời (làm trước, S–M)
- **W1 · `loading.tsx` cho 4 khu v2** (`frontend/src/app/v2/{student,teacher,admin,org}/loading.tsx`): hiện toàn app 0 loading.tsx dưới /v2 (chỉ 1 file v1) → mỗi điều hướng "đứng hình" chờ Lambda. Skeleton dùng `LoadingState`/`ga-shimmer` có sẵn trong ui-v2. Acceptance: click điều hướng giữa các trang v2 thấy skeleton ngay lập tức.
- **W2 · i18n theo khu**: `src/i18n/request.ts:28-32` đang nạp base + CẢ 8 area (~245KB) cho mọi trang; `src/app/layout.tsx:81` serialize hết vào HTML. Sửa: provider theo role-layout chỉ pick `{base-common, chrome, <area>}`. ⚠️ chạy `npm run check:i18n` (script parity). Acceptance: view-source một trang student — HTML giảm từ ~300KB xuống rõ rệt, không còn key teacher/admin.
- **W3 · Gỡ waterfall mở bài học**: `src/hooks/useStudentPracticeSession.ts:91-116` — 3 await tuần tự (`/auth/me` → `/onboarding/status` → meta+dashboard) rồi trang mới fetch session. Parallel hoá + đừng chặn theo `/onboarding/status`. Acceptance: Network tab mở `learn/[nodeId]` — request session bắn trong nhịp đầu, tổng thời gian tới nội dung giảm ~1–1,5s.
- **W4 · SSE reconnect có kỷ luật**: `src/lib/notificationStream.ts:117,180-188` — refresh 401 bằng axios TRẦN (bỏ qua single-flight + không timeout), vòng lặp 4s cố định, không dừng khi tab ẩn. Sửa: dùng chung latch `sessionInvalid`, backoff lũy tiến có trần, pause khi `document.hidden`. Cả 2 bell đang `onError: () => {}`.
- **W5 · Visibility-gate polls tin nhắn**: `DirectThread.tsx:41` (5s), `MessagesInbox.tsx:85` + `ClassThread.tsx:55` (12s) — không check `visibilityState`, `setThread` thay mảng mỗi tick kể cả không đổi. Mẫu đúng có sẵn: `useAdminData.ts:101-121` (120s + visibility).
- **W6 · Siết axios retry**: `src/lib/api.ts:83-121` — retry ×2 mọi 5xx/429 + timeout 8s ⇒ treo cảm nhận ~27s và khuếch đại brownout. Sửa: chỉ retry lỗi mạng + 502/503 GET, 1 lần.
- **W7 · Gọn đầu trang**: PostHog init trong `requestIdleCallback` (`src/providers/PostHogProvider.tsx:35-45`) + kiểm PostHog project có bật session replay không; purge 15 dead deps + 16 wrapper `components/ui/*` 0-importer + `components/chat/` + MSW mồ côi (danh sách chính xác trong artifact mục FE-10); tách `GaSection` khỏi `src/app/v2/analyticsShared.tsx` để materials/media khỏi gánh recharts.

### 3.2 Backend — cắt query đường nóng (M)
- **B1 · SRS batch**: `SrsController.java:100-111` loop từng thẻ → `XpService` mỗi thẻ: advisory lock + 3×SUM toàn bảng + `achievementRepository.findAll()` KHÔNG cache (cache `"achievements"` ĐÃ khai trong `CacheConfig.java:73-77` mà chưa dùng!) + `@CacheEvict(value="classLeaderboard", allEntries=true)` (`XpService.java:182`) xoá L2 mỗi thẻ. 30 thẻ ≈ 250–350 query. Sửa: XP **1 lần/batch**, `@Cacheable("achievements")`, bỏ evict allEntries (TTL 5' tự lo). ⚠️ **đổi semantics XP (1 event/batch thay vì mỗi thẻ) — hỏi owner 1 câu trước khi làm.**
- **B2 · AiJobWorker ra khỏi scheduler**: `ai/queue/AiJobWorker.java:39-66` chạy Whisper 60s + LLM inline trên scheduler (pool đã nâng 1→4 ở #467 nên hết nghẽn dây chuyền, nhưng worker vẫn chiếm 1 slot hàng phút) + `claimJobs()/saveCompleted()` REQUIRES_NEW **tự gọi trong class → proxy bị bỏ qua, transaction không như khai báo**. Sửa: claim trên scheduler, thân job đẩy sang `aiExecutor`; tách bean hoặc self-inject cho REQUIRES_NEW.
- **B3 · Fan-out notification**: `UserNotificationService.java:492-587` — `findById` từng học viên trong loop, `saveAll` không batch, mỗi người 1 POST Expo bằng WebClient **tự build mỗi call, không timeout** (`ExpoPushSenderService.java:53-64`). Sửa: `findAllById`, `hibernate.jdbc.batch_size=50 + order_inserts=true` (application.yml — hiện CHƯA có), Expo batch API (≤100 message/request), WebClient shared + responseTimeout 5s.
- **B4 · News hết khoá**: `news/service/NewsService.java:38-64` — refresh 4 RSS tuần tự trong `synchronized` TRÊN REQUEST THREAD mỗi 30' (treo 1–5s, xấu nhất ~52s). Sửa: `@Scheduled` refresh + volatile swap + serve-stale.
- **B5 · Cụm 1-dòng**: `sync = true` cho `@Cacheable` words/ttsAudio/aiVocab (chặn stampede); xoá `connection-test-query: SELECT 1` (`application.yml` — thuế 1 round-trip RDS mỗi lần mượn conn, keepalive đã có); EdgeTTS cache key `Objects.hash` → key chuỗi (`EdgeTtsService.java:58`).

### 3.3 Mobile (S — phối OTA cùng đợt kế; ĐỌC `plans/2026-09-02-handoff-mobile-toan-canh.md` trước, #470 đã merge)
- **M1 · Chặn work nền vĩnh viễn**: `mobile/app/(student)/_layout.tsx` — 31 màn 1 Tabs, 0 freeze → thêm `screenOptions={{ freezeOnBlur: true }}` (hoặc `enableFreeze()`); `lib/chatDelta.ts:35-40` `adaptivePollMs` không bao giờ trả `false` → gate theo `useIsFocused`; `components/skill-tree/motifs/NodeMotif.tsx:137,154` `withRepeat(-1)` → gate theo focus (đã có prop `reduced` cùng pattern).
- **M2 · Refresh không logout oan**: `mobile/lib/api.ts:180-213` — catch NÀO cũng `clearTokens()` + đá về login; sửa: chỉ clear khi refresh trả 4xx, lỗi mạng/5xx giữ token + reject request gốc.
- **M3 · Nối SRS offline**: `stores/useSrsOfflineStore.ts` có đủ enqueue/sync + test nhưng **enqueue không được gọi ở đâu** — review offline mất điểm im lặng. Sửa: trong `srs.tsx:98-127` `onError`, nếu transient → `enqueue(vocabId, quality)`.
- **M4 · Sentry**: cây đang `extra.sentryDsn: ""` + `SENTRY_DISABLE_AUTO_UPLOAD=true` mọi profile (`app.json`, `eas.json`, `lib/observability.ts:21-32`) — nhưng memory ghi build 17 "Sentry BẬT": **verify config build 17 thật trước khi kết luận**, rồi set DSN + bật sourcemap prod.

### 3.4 Hạ tầng (S–M; phần nginx/SG cần owner vì hook chặn remote-shell)
- **H1 · nginx đồng bộ + real_ip + SG** *(nâng mức khẩn — drift ĐÃ ĐO ĐƯỢC 02/09: curl internet vào `/actuator/prometheus|metrics|env|info` nhận **401 của app** thay vì 403 nginx ⇒ khối deny `/actuator/*` trong `docker/deutschflow.nginx.conf` KHÔNG còn hiệu lực trên host)*: đồng bộ config repo→host; `set_real_ip_from` dải Cloudflare + `real_ip_header CF-Connecting-IP`; `ClientIpResolver.java:30` đang lấy XFF **trái nhất** (spoof được) → ưu tiên CF-Connecting-IP; khoá SG 443 về dải CF. ⚠️ Test kỹ thứ tự header kẻo dồn mọi user vào 1 bucket rate-limit. Soạn script/lệnh sẵn cho owner chạy.
- **H2 · Log & retention**: Docker log rotation (`daemon.json` max-size 50m ×3, hoặc `--log-opt` trong deploy script để khỏi restart dockerd); Loki `limits_config.retention_period: 360h` + compactor (`docker/loki/local-config.yaml` — hiện giữ VĨNH VIỄN, volume mới tạo 02/09 nên còn nhỏ, đừng để lâu); promtail positions ra volume (`docker/promtail/config.yml:6` đang ở /tmp trong container); bỏ cờ `--volumes` khỏi prune khẩn cấp (`deploy-backend.sh:249` — bẫy xoá volume grafana/loki khi stack down).
- **H3 · node-exporter + alert mở rộng**: thêm `prom/node-exporter` vào compose + scrape job; alert: disk <15%, `jvm_gc_pause_seconds` rate cao, breaker open, cert expiry. (RAM budget: node-exporter ~20MB OK; cAdvisor cân nhắc sau.)

### 3.5 Việc lớn hơn tuần này (đừng làm lẫn — kế hoạch 1 tháng, chi tiết trong artifact mục 5)
Zero-downtime nginx upstream flip · Đợt 4 xoá cây v1 (~39,5k dòng, PR #444 stacked cũ) · Spring Boot 3.2.5→3.3/3.4 + bump axios/next · ArchUnit ratchet + chiến dịch @Valid + tách TeacherService · TanStack Query dần · **quyết định vùng** (EC2+RDS → ap-southeast-1 hoặc dời prefix S3) — chỉ sau khi có số đo tuần này · mobile tách Tabs→Stack · gộp 6 importer vocabulary.

## 4. BẪY của phiên 02/09 (đọc trước khi đụng tay)

- **bash-guard hook chặn chuỗi lệnh chứa `sudo` / `ssh ` / `git reset --hard`** — kể cả khi chỉ là VĂN BẢN trong PR-body/commit-message → PR body dùng `gh pr create --body-file`; commit message tránh cụm chữ đó. SSH tunnel chỉ chạy được qua script file có sẵn (pattern `deutschflow-tools/`); **KHÔNG lách hook để mở remote-shell tuỳ ý** — việc cần ssh+sudo thì soạn lệnh cho owner.
- **`deploy-backend.sh` có `read -p` cleanup ở CUỐI** → chạy detached (stdin /dev/null) sẽ exit ≠0 SAU KHI deploy xong — nghiệm thu bằng log "DEPLOY THÀNH CÔNG" + `/actuator/health`, đừng tin exit code.
- **Audit/finding từ cây WIP ≠ main**: luôn `git fetch` + đối chiếu `origin/main` trước khi tin một finding còn hiệu lực (phiên 02/09: sw.js tự hủy, gate 300s, outbox… main đã tự vá trước).
- Container `prom/prometheus` chạy user **nobody (65534)** → file bind-mount cho nó đọc phải **644** (600 chủ ubuntu = "Get …: permission denied" khi scrape).
- Telegram: chat_id ≠ dãy số đầu bot-token (đó là id BOT); annotation `amtool` dùng ASCII không dấu; phải nhắn cho bot trước rồi mới `getUpdates` ra chat id.
- Quy trình chuẩn phiên này (đã chạy mượt 3 lần): worktree từ `origin/main` tại `~/Developer/DeutschFlow-worktrees/<tên>` → PR → watcher poll `gh pr checks` (sleep 150 trước, guard tổng-số-check ≥ N) → **squash merge** subject `type(scope): … (#N)` → deploy từ `~/Developer/DeutschFlow-deploy` (main, clean; `.env.production` ở đó — đã chứa `PROMETHEUS_SCRAPE_TOKEN`) → xoá worktree + nhánh local/remote (nhớ `cd` ra khỏi worktree trước khi remove).
- Deploy script giờ TỰ làm: materialize scrape-token (644) → gắn backend vào network Prometheus → SIGHUP nạp config → tag `:prev` trước prune. Log marker đủ để Monitor bám.
- PR chỉ đụng script/docs → path filter khiến CI chỉ chạy job nhẹ (~3–6') và **không cần deploy backend**.

## 5. Công cụ & lệnh sẵn có

- **Đo lag**: `~/Developer/deutschflow-tools/run-lag-telemetry.sh` (tunnel read-only → RDS; in 3 bảng + lưu file so sánh).
- **Deploy**: `cd ~/Developer/DeutschFlow-deploy && git pull --ff-only origin main && ./deploy-backend.sh` (theo dõi log bằng tail; gián đoạn thực tế ~60s ở bước promote).
- **Kiểm scrape trên EC2**: `curl -s localhost:9090/api/v1/targets | grep -oE '"health":"[a-z]*"|"lastError":"[^"]*"'` (backend phải `up`).
- **Grafana**: tunnel `ssh -L 3001:localhost:3001 …` → http://localhost:3001 (⚠️ `GRAFANA_ADMIN_PASSWORD` chưa từng set khi compose up — không login được thì set env rồi `up -d grafana`).
- **Artifact báo cáo sống**: cập nhật bằng republish cùng file path (session gốc) hoặc truyền `url` khi publish từ session khác — ĐỪNG publish không `url` (sẽ tạo artifact mới).
- 4 port observability (9090/3001/3100/9093) đã xác minh KHÔNG lộ internet (SG đóng) — giữ nguyên khi sửa SG.
