# Kế hoạch làm nốt mảng Speaking — P2 (2026-07-25)

**Nguồn:** `BAO_CAO_AUDIT_SPEAKING_2026-07-24.md` (38 finding) · `plans/2026-07-25-ke-hoach-tiep-theo.md` (khung ưu tiên chung)
**Trạng thái đầu vào (verify bằng `gh pr list` + `git rev-parse` lúc lập kế hoạch, không lấy theo doc):**

| Hạng mục | Sự thật 25/07 |
|---|---|
| `origin/main` | `aad2498a` |
| Stack Speaking | **6 PR đều còn OPEN**: #252 → #257 → #258 → #259 → #260 → #261 (báo cáo §0.5 ghi "5 PR" và plan 25/07 ghi "3 PR" — cả hai đã lỗi thời) |
| Đã có bản vá | 23/38 finding — **toàn bộ CRITICAL + HIGH**, nhưng **chưa dòng nào tới user** vì chưa merge |
| Còn hở trong code | **15 finding P2** (MEDIUM/LOW) + 3 lỗ §7.1 interview chưa được đánh mã |
| `wiremock` trong `backend/pom.xml` | **không có** — R-B9 phải thêm dependency test trước |
| `mobile/lib/observability.ts` | **đã có** `captureException` (dòng 57) — R-M6 chỉ là gọi vào các catch, không phải dựng module |

---

## 0. Quyết định khung: đừng chồng thêm PR lên stack

Stack đang sâu **6 tầng**. Mỗi PR P2 mới stacked lên #261 làm tầng 7, 8… và mọi rebase khi #252 đổi sẽ dội xuống toàn bộ. Đây đã là rủi ro số 1 trong plan 25/07 (*"PR xanh nằm chờ merge — nút thắt số 1"*).

> **Nguyên tắc:** không mở PR P2 nào trước khi stack 6 PR về `main`. Mọi batch dưới đây **cắt nhánh từ `main` sau merge**, độc lập nhau, merge được theo bất kỳ thứ tự nào.

**Việc chỉ owner làm được — đường găng, chặn toàn bộ kế hoạch này:**

```bash
gh pr merge 252 --merge --admin && gh pr merge 257 --merge --admin && \
gh pr merge 258 --merge --admin && gh pr merge 259 --merge --admin && \
gh pr merge 260 --merge --admin && gh pr merge 261 --merge --admin
```

> ### ⚠️ Sự cố merge 25/07 16:28 — đọc trước khi merge bất kỳ stack nào
>
> Lô merge chạy `gh pr merge` cho cả 6 PR **nhưng không xoá nhánh base**, nên GitHub **không retarget** các PR xếp chồng: mỗi PR merge vào đúng base branch của nó, **không vào `main`**. Kết quả: cả 6 PR hiện `MERGED` trên GitHub nhưng main **chỉ có #252** (squash `177a19cc`). GitHub UI nói sai; deploy lúc đó chỉ ra P0.
>
> Không mất gì — nhánh còn sống, `fix/speaking-p2-integrity` chứa trọn chuỗi. Khôi phục bằng **[PR #263](https://github.com/CuDinh03/DeutschFlow/pull/263)** (merge nhánh đó vào main, giải 7 conflict do #252 vào dạng squash).
>
> **Quy tắc từ nay cho PR xếp chồng — chọn 1 trong 2:**
> 1. Merge kèm `--delete-branch` từng bước, để GitHub retarget PR kế tiếp về `main` trước khi merge nó; **hoặc**
> 2. Merge **một lần từ tip** của stack vào main (1 PR gộp), bỏ qua các PR trung gian.
>
> Luôn `git log origin/main` xác nhận commit thật sự vào main sau mỗi lô — **đừng tin nhãn MERGED**.

> **Dùng `--merge`, KHÔNG `--squash`** (bản đầu của kế hoạch này ghi `--squash` — sai với stack). Squash tạo commit mới có nội dung khác commit gốc, nên PR kế tiếp sau khi GitHub retarget về `main` sẽ mang theo diff đã nằm sẵn trên main ⇒ dễ conflict giả. Merge-commit giữ nguyên ancestry: mỗi PR thấy base của nó đã ở trong main. Lịch sử repo cũng đang dùng merge-commit (`Merge pull request #256 from …`).
>
> **Đã dry-run 26/07** bằng `git merge-tree` — cả 6 mắt xích **sạch conflict**, và diff gộp của cả stack merge thẳng vào `main` cũng sạch. (GitHub API trả `UNKNOWN` cho mergeable là trạng thái đang-tính lười, không phải dấu hiệu conflict.)

Sau đó: deploy backend (`deploy-backend.sh`, verify env EC2 **không** pin `GROQ_SEMAPHORE_ACQUIRE_SEC=90`) · Amplify tự build FE · **build TestFlight 14** (fix mobile P0/P1/MB-3 chỉ tới user qua build mới — OTA chết vì fingerprint lệch).

---

## 1. Cửa sổ thời gian

Plan 25/07 chốt: *"Không làm gì khác trước pitch 31/07 ngoài Ưu tiên A."* Kế hoạch này **tôn trọng ràng buộc đó**:

| Mốc | Speaking P2 làm gì |
|---|---|
| 25–31/07 (trước pitch) | **Chỉ A1**: merge stack + deploy + TestFlight 14. Không mở batch P2 nào. |
| 01–08/08 (sau pitch) | SP-A, SP-B, SP-F chạy — batch nền, không đụng UX đang demo |
| Cùng đợt đã lên lịch | SP-C/D/E xen vào; **CLEAN → đợt xoá v1** (`plans/2026-07-14-xoa-sach-v1-web.md`) · **i18n → đợt i18n riêng** (nhánh #248 đang mở) |

Không finding nào còn ở mức CRITICAL/HIGH ⇒ **không có gì trong P2 xứng đáng chen trước pitch.**

---

## 2. Sáu batch — nội dung, DoD, ước lượng

### SP-A — Test lớp resilience (R-B9 + §7.6) — ✅ XONG 26/07, [PR #264](https://github.com/CuDinh03/DeutschFlow/pull/264)

**Đã làm:** +27 test — `GroqChatClientResilienceTest` 9 (hợp đồng R-B1 đo bằng số request thật: 3 attempt, backoff 2+4s có thật, tổng <20s, breaker OPEN không gọi upstream, semaphore 15s, json-mode guard) · `SpeakingAiHelpersServiceUnitTest` 12 (R-B3 cả 6 endpoint, thay 1 case `assertNotNull`) · `GroqWhisperClientErrorTest` 6 · web `chatStreamError.test.ts` 6 (R-B2↔R-W5).

**Công cụ:** chọn **JDK `HttpServer`** thay WireMock/MockWebServer — repo không có dependency nào trong số đó, HttpServer có sẵn nên build offline vẫn chạy. Phải thêm constructor package-private nhận `baseUrl` cho 2 client (production vẫn dùng hằng số cũ).

**🔴 Lỗi thật do SP-A phát hiện:** #252 dọn câu chữ lộ vendor ở `GroqChatClient` nhưng **bỏ sót `GroqWhisperClient`** — 16 chỗ vẫn ném `"Whisper transcription failed: HTTP 500"`, `"Whisper verbose error: {message upstream}"`, `"Groq API key is not configured."` thẳng vào `detail` 503 ⇒ hiện lên UI. Đã vá: mọi lỗi STT mang `AiErrorCode` + câu tiếng Việt trung tính, thêm mã `STT_FAILED` (catalog §8.3 có, enum chưa có).

**Mobile:** error-path đã được phủ sẵn bởi `apiMessage.test.ts` (12 case, #252) + `speakingChatTurns.test.ts` (#259) — không viết trùng.

*Kiểm chứng: backend 1622/1622 · frontend tsc + vitest 415/415 + i18n guard.*

<details><summary>Kế hoạch gốc (đã thực hiện)</summary>

Vùng trắng này là nơi **cả hai outage 17/07 và 23/07 nằm gọn**. Ưu tiên cao nhất trong P2 dù sev chỉ MEDIUM.

**Quyết định kỹ thuật cần chốt trước khi code:** `GroqChatClient` dùng `WebClient` (reactive) ⇒ khuyến nghị **`okhttp3 MockWebServer`** (nhẹ, có sẵn hệ sinh thái Spring, điều khiển được delay/chunk cho test read-timeout và stream) thay vì kéo WireMock standalone vào `pom.xml`. Nếu chọn WireMock thì phải thêm dependency `wiremock-standalone` scope test.

| Test | Chốt hành vi gì |
|---|---|
| `GroqChatClientTimeoutTest` | connect 5s / read 15s; 3 attempt backoff 2+4s; **deadline tổng ~20s** (hợp đồng PR #252 — hồi quy R-B1) |
| `GroqChatClientBreakerTest` | breaker `groqChat` OPEN sau ngưỡng → fail-fast, `Retry-After` 30s |
| `GroqStreamErrorTest` | lỗi giữa SSE → phát event `{"event":"error","code":…}` rồi complete sạch, **không** `completeWithError` (hồi quy R-B2) |
| `GlobalExceptionHandlerAiTest` (mở rộng) | `AiServiceException` → 503 + `extensions.code` + `retryAfterSeconds`; **assert `detail` không chứa "Groq"/"Whisper"/"XTTS"** (chốt §8.2) |
| `SpeakingAiHelpersTest`, `WeeklySpeakingTest`, `PhonemeTest` | các catch từng nuốt lỗi (R-B3) nay để `AiServiceException` nổi lên → 503, không phải 500/400 |
| `WhisperErrorTest` | STT lỗi → `STT_FAILED` 503, không 500 |
| `promptContainsJson` guard | mọi call ép `response_format=json_object` phải có chữ "json" trong prompt (tiền lệ bug #94) |
| Web `SpeakingChatExperience.error.test.tsx` | trạng thái `error` **có đường về idle**, nút Gửi lại thật, draft không mất (hồi quy R-W1) |
| Mobile `speakingApi.error.test.ts` | 503 / timeout / turn mồ côi / double-tap → đúng câu tiếng Việt + đúng status outbox |

**DoD:** `./mvnw test` xanh · `npm test` (frontend) xanh · `npm test` (mobile) xanh · mỗi test mới fail được khi revert bản vá tương ứng (chứng minh nó thật sự chốt hành vi, không phải test rỗng).

</details>

---

### SP-B — Observability (R-M6 + alert backend) · ~0.5 ngày

- **Mobile:** gọi `captureException` (module đã có sẵn, `observability.ts:57`) trong mọi catch AI: `speaking.tsx` (start/turn/transcribe/report/resume), `weekly-speaking.tsx`, `api.ts:63-69`. Kèm tag `{surface, httpStatus, aiCode}` để đếm được theo mã lỗi. Bỏ điều kiện `__DEV__` cho log lỗi API.
- **Backend:** metric `SpeakingMetrics` + counter theo `AiErrorCode`; **alert khi 503-rate vượt ngưỡng** — đêm 23/07 không ai biết cho tới khi user chụp ảnh gửi.

**DoD:** ép 1 lỗi 503 giả trên staging → thấy event trong Sentry với đúng tag; dashboard/alert 503-rate có ngưỡng cụ thể ghi vào runbook `plans/2026-06-20-deploy-ops-runbook.md`.

---

### SP-C — Web UX + a11y (R-W8, R-W10, §9 A11y) · ~0.5 ngày

- **R-W8** `useSpeakingRecorderMic.ts:47-72,96-100` — sequence-guard cho transcript về muộn (giữ `requestId`, bỏ kết quả cũ) + huỷ promise/`AbortController` khi unmount. Đây chính là hiện tượng "text cũ quay lại ô nhập" ở ảnh ④.
- **R-W10 (a)** `live/page.tsx:11-20` — `history: null` stale khiến nút "Xem lịch sử" ẩn oan dù trang v2 history **đã tồn tại và i18n đủ**.
- **R-W10 (b)** phân biệt "chưa có dữ liệu" vs "tải hỏng": `history/page.tsx:187,198` và `WeeklyChallengeCard.tsx:52-58` đang catch → `[]` ⇒ weekly 500 hiện "không có đề tuần này". Lỗi tải phải ra error-state có nút Thử lại.
- **A11y:** `aria-live="polite"` cho stream status, `role="dialog"` + focus-trap cho popup kết thúc, `aria-pressed` cho toggle TTS.

**DoD:** vitest cho sequence-guard mic (transcript cũ về sau không ghi đè) + 2 test empty-vs-error state; axe/manual check 3 điểm a11y.

---

### SP-D — Đuôi mobile + idempotency backend — ✅ XONG 26/07 (nhánh `feat/speaking-mb-d`, chờ PR sau adversarial-review)

Scout inline + workflow 5-reader (understand) map backend quota/idempotency, schema, mobile finish/resume, R-M10, cách compose với reconcile #259 — TRƯỚC khi code. Rồi adversarial-review workflow (4 chiều × verify) trước khi mở PR.

- **R-M5 (backend)** ✅ — `SpeakingChatIdempotencyService`: cache Redis theo `(userId, sessionId, clientTurnId)`, TTL 15'. **Chọn REPLAY** response đã cache thay vì rebuild từ DB (response 18 field, nhiều field `adaptive`/`suggestions`/`similarityScore`/`interviewHintKey` **không persist** → rebuild trả bản thiếu). `@Nullable StringRedisTemplate` như `SessionTurnGuard` → Redis vắng thì no-op sạch, rơi về reconcile #259. `chat()` lookup **trước** turn-guard & **trước** `prepareSpeakingChatTurn` (với org-pool là reservation THẬT) nên replay không đụng LLM/quota/reservation; `remember()` chỉ chạy **sau** finalize TX commit.
- **R-M5 (client)** ✅ — mobile gửi `turn.id` làm `clientTurnId` (retryTurn tái dùng đúng id → khoá trùng tự nhiên). `newTurnId()` thêm **launch-nonce**: counter cũ reset về 0 khi reload → lượt mới sau reload lại mint `t-1`, trùng khoá còn trong TTL → server replay **NHẦM** — nonce chặn đụng khoá qua reload.
- **R-M7** ✅ — `finishSession` tách 2 pha: `endSession` phải xong mới `clearActiveSession` + summary; lỗi end → giữ phiên (resume được). Backend `PATCH /end` idempotent với phiên đã ENDED nên đường auto-finish CLOSING_FAREWELL vẫn đúng.
- **+ De-risk** ✅ — `awardSessionComplete` trước KHÔNG dedup theo phiên → end 2 lần (auto-close rồi tap Kết thúc, **hoặc** retry của R-M7) cộng +30 XP mỗi lần. Thêm `existsByUserIdAndEventTypeAndRefSessionId` + guard dưới advisory-lock. Bug có sẵn, reachable không cần R-M7.
- **R-M10** ✅ — `assignments/[id].tsx` alert message-as-title → `Alert.alert(title, message)`; xoá `startInterview` (0 caller) + `experienceForDifficulty` (mồ côi theo sau).

**Kiểm chứng:** backend 1636/1636 (+9 test idempotency/XP) · mobile jest 319/319 · tsc sạch. **Device-QA cần người:** ngắt mạng lúc Kết thúc → còn resume được; gửi trùng khoá → 1 lần trừ quota.

> Ghi chú R-M10(a): reader-workflow phát hiện báo cáo §112 + plan này vẫn liệt alert-title là "mở" — đã đóng trong batch này; audit `BAO_CAO...:112` nên cập nhật khi rà lại.

---

### SP-E — Weekly Speaking (§7.2) · ~0.5 ngày

- Tách LLM khỏi `@Transactional` (`WeeklySpeakingService.java:118`) — mô hình 3 pha như các luồng speaking chính đã làm; hiện đang ghim DB connection suốt call LLM (kiểu lỗi từng làm cạn pool).
- **Đường nộp lại bản ghi âm** khi submit fail (`weekly-speaking.tsx:243`) — hiện fail là mất trắng bản ghi, phải ghi lại từ đầu. Vi phạm trực tiếp nguyên tắc §8.1.4 *"draft/bản ghi âm là tài sản của user"*.
- Web: bỏ fallback render raw JSON rubric trong `<pre>` (`client-page.tsx:231-235`).

**DoD:** submit weekly khi LLM chết → có nút "Nộp lại" dùng đúng file đã ghi; không còn `<pre>` JSON trên UI.

---

### SP-F — lỗ interview §7.1 **chưa được đánh mã finding** — ✅ XONG 25/07, [PR #262](https://github.com/CuDinh03/DeutschFlow/pull/262)

Báo cáo mô tả 3 lỗi này trong §7.1 nhưng **không cấp mã R-** và **không đưa vào checklist §9** ⇒ chúng sẽ rơi khỏi lưới nếu chỉ làm theo §0.5. Khi đọc code phát hiện thêm lỗ thứ 4 — lỗ **nặng nhất** trong nhóm.

| Lỗ | Vị trí | Hệ quả | Đã làm |
|---|---|---|---|
| Câu trả lời **rỗng vẫn được 3.0 điểm** | `InterviewPhaseEvaluationService:78` | im lặng = 30% điểm phase | ✅ → 0.0 + điểm yếu "Chưa trả lời câu hỏi". Phase 2 câu có 1 lượt trống: 4.00 → 2.50 |
| 🆕 **khoá `starPresent` không tồn tại** | `InterviewPhaseEvaluationService:85`, `deriveStrengths`, `InterviewReportService:205` | record phát ra `missingStar` ⇒ thưởng STAR **chưa bao giờ chạy**, điểm mạnh STAR **chưa bao giờ hiện**, và phủ định khoá luôn-vắng ⇒ drill STAR khuyến nghị cho **MỌI** ứng viên | ✅ dùng đúng `missingStar`, chỉ trong `STAR_SOFT`; dạng **trừ** thay vì thưởng (tránh đếm hai lần với `concreteExample`) |
| `weightsJson` lưu nhưng **không tác động gì** | `:42,53` | admin chỉnh rubric tưởng có tác dụng — không | ✅ **không bịa mapping cờ→tiêu chí**; thay vào đó `snapshotForPhase` đưa rubric phase vào prompt (fallback OVERALL) ⇒ admin sửa phase rubric đổi thật cách AI hỏi. `weightsJson` ghi rõ là dấu vết provenance |
| `addressed_question` default `true` | `AiResponseParser:269` | (báo cáo ghi "lệch nhẹ dễ dãi") | ✅ → `false`. **Thực tế tác động = 0**: field hiện chưa có consumer nào đọc — chỉ `phaseGoalMet` được dùng |

*Kiểm chứng: backend **1587/1587** xanh. Test mới: `InterviewPhaseEvaluationServiceTest` 8 case (service này trước đó **không có test nào**) + `InterviewRubricSnapshotTest` 3 case + 2 case report + 1 case parser. Mọi test đều phân biệt được (revert bản vá → đỏ).*

**QA cần người thật sau deploy:** điểm phiên MỚI sẽ thấp hơn ở 2 trường hợp (có lượt bỏ trống; lượt STAR_SOFT thiếu STAR) — đúng ý đồ, nhưng nên chạy 1 phiên interview thật để xem thang mới có hợp lý về cảm nhận. Không backfill điểm cũ.

---

### Gộp vào đợt đã có — không mở batch riêng

| Việc | Gộp vào | Nội dung |
|---|---|---|
| **CLEAN** (R-W9) | `plans/2026-07-14-xoa-sach-v1-web.md` | xoá 16 component + 2 hook dead-code (danh sách §7.5) · thay neon `#22D3EE/#38BDF8/#818CF8/#A78BFA` + `#FBBF24` (contrast yếu trên nền giấy) bằng token `--ga-*` · cây v1 `/app/speaking`, `/app/student/{speaking-history,weekly-speaking,interviews}` |
| **i18n** (R-W4, R-M8) | đợt i18n riêng (nhánh #248 đang mở) | web: wire 273 key × 3 locale **đã có sẵn** vào `SessionSummary`/`CompanionSelect`/counters/verdicts; bỏ `getErrorSnippet(…,'vi')` ghim cứng + date `'vi-VN'`. mobile: khởi tạo hệ i18n, **namespace lỗi §8.3 làm namespace đầu tiên** |

---

## 3. Thứ tự thi công đề xuất

```
[owner] merge 6 PR → deploy BE → TestFlight 14        ← chặn tất cả, làm trước pitch
        │
        ├─ SP-A test resilience      (nền, giá trị cao nhất — làm trước)
        ├─ SP-B observability        (đo được rồi mới biết sửa còn thiếu gì)
        ├─ SP-F interview 3 lỗ       (độc lập, backend-only)
        ├─ SP-D mobile + idempotency (cần TestFlight 15 để tới user)
        ├─ SP-C web UX + a11y
        └─ SP-E weekly
                │
        đợt xoá v1 ← CLEAN          đợt i18n ← R-W4/R-M8
```

Mỗi batch = 1 PR cắt từ `main`, độc lập. **≤2 luồng song song** (ràng buộc solo-capacity của plan 25/07). Tổng ~4 ngày dev thuần, trải trên 2 tuần đầu tháng 8.

---

## 4. Việc chỉ owner làm được

1. **Merge 6 PR đúng thứ tự** `#252 → #257 → #258 → #259 → #260 → #261` (classifier chặn agent chạy `gh pr merge`) — **chặn 100% kế hoạch này**.
2. **Deploy backend** + verify env EC2 không pin `GROQ_SEMAPHORE_ACQUIRE_SEC=90`.
3. **Build TestFlight 14** — không có build mới thì mọi fix mobile P0/P1/MB-3 nằm im.
4. **OPS-1** — soi log EC2 khung 23:38 đêm 23/07 (lệnh §2.3 của báo cáo, hook chặn agent chạy `ssh`) để chốt nguyên nhân gốc. *Ghi chú: sau khi #252 deploy thì R-B1 đã bịt đường khuếch đại — OPS-1 nay chỉ còn giá trị xác nhận chẩn đoán, không còn chặn việc sửa.*
5. **QA browser authenticated** (agent không có credential prod, mật khẩu demo rotate ngoài repo từ V233): GR-1 (phiên COMMUNICATION ≥3 lượt → End → điểm **/10** thật, không phải 68/100 bịa) + MB-3 (ngắt mạng → bubble failed → Gửi lại).
6. **Chốt lựa chọn MockWebServer vs WireMock** cho SP-A (khuyến nghị MockWebServer).

---

## 5. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| **Stack 6 PR nằm thêm** — mỗi ngày trôi là 23 finding CRITICAL/HIGH tiếp tục không tới user, và rebase ngày càng đắt | Merge trước pitch; tuyệt đối không stacked thêm PR P2 |
| Bundle-drift tái diễn: sửa mobile nhưng không build | Mỗi batch đụng mobile phải ghi rõ "cần TestFlight N+1" ngay trong PR body |
| SP-A phình to thành refactor | Khoá phạm vi: **chỉ thêm test**, không sửa production code trừ khi test phát hiện lỗi thật (ghi thành finding mới) |
| P2 chen vào cửa sổ pitch | Kế hoạch này khoá cứng: trước 31/07 chỉ có A1 |
| `weightsJson` (SP-F) đổi công thức làm điểm cũ lệch | Chỉ áp cho phiên mới; không backfill; ghi rõ trong PR |

---

## 6. Nghiệm thu đóng mảng Speaking

- [ ] 6 PR merged + deployed + TestFlight 14 ra user
- [ ] 15 finding P2 + 3 lỗ §7.1 đều có bản vá **hoặc** quyết định "không làm, lý do X" ghi thành văn
- [ ] `grep -riE "groq|whisper|xtts"` trong `detail`/copy hiển thị người dùng = **0 kết quả**
- [ ] Không màn speaking nào còn số điểm sinh phía client
- [ ] Test resilience: revert bất kỳ bản vá P0 nào → có ít nhất 1 test đỏ
- [ ] Alert 503-rate có ngưỡng, có người nhận, ghi trong runbook
