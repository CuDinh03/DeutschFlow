# CHECKLIST THI CÔNG: KHUNG AI TIER + ROUTE MODEL

**Ngày tạo:** 2026-08-07 · **Kế hoạch gốc:** `plans/2026-08-07-ke-hoach-khung-ai-tier.md` · **Trạng thái:** ĐÃ DUYỆT 07/08 — P1+P2 xong; **09/08 ĐÃ FLIP NHÀ CUNG CẤP GROQ → FIREWORKS** (xem section FW bên dưới)

## 📊 DASHBOARD TRẠNG THÁI

| Phase | Nội dung | Trạng thái | PR | Deploy |
|---|---|---|---|---|
| P0 | Owner: keys + env | ✅ **ĐÓNG TOÀN BỘ 09/08** — P0.1/P0.4/P0.5 giải bằng flip FW; P0.2/P0.3 huỷ theo quyết định bỏ OpenRouter | — | — |
| P1 | Khung tier (A) + ledger/giá (E) | ✅ **MERGED** `dffd88c1` | [#306](https://github.com/CuDinh03/DeutschFlow/pull/306) | ✅ `2ba00e72` 08/08 15:36, UP 55s |
| P2 | Route luồng (B) + khoá giáo án | ✅ **MERGED** `6c2db328` (#307) + `2ba00e72` (#308); nghiệm thu 08/08 xong P2.V1/V2 + B3.4/B3.5, lòi mis-route thứ 6 (B1.8, PR riêng) | #307 #308 | ✅ `2ba00e72` (cùng đợt) |
| **FW** | **Flip provider → Fireworks** (STT portable + env + vá tier chấm) | 🔄 #310 MERGED `346959f4`, env đã flip, QA Fireworks ✅, **FW.7 đã vá (#311)**; còn FW.1/2b/3/4/5 phía owner | [#310](https://github.com/CuDinh03/DeutschFlow/pull/310) · [#311](https://github.com/CuDinh03/DeutschFlow/pull/311) `4c34c29c` | 🔄 owner deploy 09/08 — **3 PR chờ cùng chuyến: #309 + #310 + #311** |
| P3 | Calibration (F1) + flip model | 🔄 **F2.4 + F1.1 MERGED** (`7e9adc85`, chưa deploy): script contract-test (8/8 tier đạt trên Fireworks thật) + harness đo được "mất nhận xét"/cost/ngân sách. 🔴 **Đo lòi ra: CẢ 3 ứng viên F1 không chạy nổi ở ngân sách token hiện tại** ⇒ flip KHÔNG còn là "sửa 1 dòng env"; phát sinh F1.0 + tiền đề F3.4. CÒN: F1.2–F1.5 (cần DB prod + deploy). Số đo: `BAO_CAO_CONTRACT_TEST_TIER_2026-08-09.md` | #312 #313 #314 #316 ✅ MERGED | ⬜ chờ FW.1 |
| P4 | Verify errors (C) + chat PAID (G) + STT (D) | 🔄 **G1.4 ĐÃ ĐO**: TTFT stream 120b trung vị **1,29s** (4/12 lượt vượt 1,5s, max 1,88s) vs 20b **0,83s** (0/12) ⇒ điều kiện #10 đạt theo TRUNG VỊ, 👤 owner chốt ship G hay giữ PAID=FREE. C + D còn nguyên | — | — |
| P5 | Regen cây học tập (H) | ⬜ CHƯA | — | — |

**Quyết định đã chốt 07/08:** (1) tách GRADING_EXAM/GRADING_DAILY ✅ · (2) shadow 1 tuần verify errors ✅ · (3) fail-open đánh dấu `unverified` ✅ · (4) PAID degrade về 20b ✅ · (5) ngưỡng WER 1% giữ nguyên ✅

**Quyết định 09/08:** (6) **bỏ OpenRouter** — Fireworks là nhà cung cấp duy nhất; mọi bước flip qua OpenRouter ở P3/P4 huỷ, đường lên Haiku/Sonnet đóng lại ✅ · **(7)–(13) chốt 09/08 chiều** (chi tiết `BAO_CAO_LUA_CHON_MODEL_FIREWORKS_2026-08-09.md` + mục ĐIỂM CẦN OWNER QUYẾT trong ke-hoach): (7) chấm = hướng 3, F1 với V4 Flash/Qwen 3.7 Plus/K2.6 ✅ · (8) ERROR_VERIFY = DeepSeek V4 Flash ✅ · (9) CONTENT = K2.6 ngay, regen P5 = K3, verifier = V4 Flash ✅ · (10) CHAT_PAID = 120b điều kiện TTFT stream <1,5s ✅ · (11) STT đo D1.3 rồi quyết ✅ · (12) BATCH → Batch API −50% ticket riêng sau FW sạch ✅ · (13) placement chưa tách, chờ F1 ✅

**Quyết định 09/08 TỐI (#14–#17) — owner chốt sau khi đọc số đo contract-test:**

| # | Chốt | Thay cho |
|---|---|---|
| 14 | **F1 chỉ đo `deepseek-v4-flash` @3000 tok** vs 120b baseline. **BỎ** `qwen3p7-plus` (cũng cần 3000 tok mà đắt 4× ở đầu output: $1.60 vs $0.28) và **BỎ** `kimi-k2p6` cho tầng chấm (27–43s/bài + biên an toàn 2% ⇒ không dùng được). V4 Flash là ứng viên duy nhất vừa mới hơn vừa RẺ hơn 120b | thu hẹp #7 |
| 15 | **CONTENT tách làm 2 đường**: đường sinh-khi-unlock (học viên đang chờ) **giữ 20b**; K2.6 chỉ dùng cho **sinh TRƯỚC theo lô** + regen P5. Không flip `AI_LLM_TIER_CONTENT_MODEL` sang K2.6 trên đường realtime | sửa #9 |
| 16 | **CHAT_PAID: đo lại TTFT từ EC2 rồi mới chốt** — số 1,29s đo từ máy owner nên gồm cả RTT xuyên Thái Bình Dương; EC2 prod (us-east-1) cùng vùng với Fireworks (us-virginia-1) nên thực tế nhanh hơn. 👤 owner chạy (agent bị hook chặn ssh) | hoãn #10 |
| 17 | **Ledger đọc `cached_tokens` LÀM NGAY, PR riêng** — thêm cột `cached_prompt_tokens` vào `ai_token_usage_events` + migration; COGS chat đang khai vống ~3× vì cache hit ~99% | mới |

**Số đo 09/08 tối (contract-test, `BAO_CAO_CONTRACT_TEST_TIER_2026-08-09.md`) — đụng vào 3 quyết định đã chốt:**
- 🔴 **(7) sai giả định "flip = 1 dòng env"**: ở ngân sách token thật của GRADING_EXAM (800 tok), `deepseek-v4-flash` hỏng 3/4 lượt, `qwen3p7-plus` 4/4, `kimi-k2p6` 4/4 (RỖNG). Bỏ `reasoning_effort` không cứu được — 3 model này dài dòng gấp 4–10× 120b. Muốn flip thì **phải nới max_tokens ở mọi call site chấm** (F1.0 mới).
- 🔴 **(9) CONTENT = K2.6 "flip ngay" sẽ làm hỏng cây học tập**: 2 call site `SkillTreeService:1107,1248` chỉ có 1024 tok ⇒ K2.6 trả **RỖNG 3/3**, im lặng. Ở 4096 tok thì chạy được nhưng **32–41s/node**. Phải nới ngân sách + tính lại latency trước F3.4.
- ⚠️ **(12) lời hơn dự tính**: docs Fireworks ghi Batch API *"billed at 50% of serverless pricing"* ⇒ **−50%**, không phải −40%.

Ký hiệu: ⬜ chưa làm · 🔄 đang làm · ✅ xong · ⛔ chặn (ghi lý do) · 👤 việc của owner

---

## FW — FLIP NHÀ CUNG CẤP GROQ → FIREWORKS (09/08/2026)

**Lý do:** owner kẹt truy cập billing Groq → không nâng được Dev tier, trần FREE 8K TPM bóp toàn hệ (~3–5 lượt nói/phút). Fireworks postpaid self-serve, serve đúng gpt-oss-20b/120b + Whisper, bench 08/08 đạt (TTFT ~0,4s ấm, JSON 9 field chuẩn, whisper-turbo transcript 100%, prompt cache tự động 1150/1151). Chi tiết bench + gotcha: memory `project_fireworks_provider_eval_2026_08_08.md`, runbook trong body [#310](https://github.com/CuDinh03/DeutschFlow/pull/310).

**Đã làm:**
- [x] FW.a [#310](https://github.com/CuDinh03/DeutschFlow/pull/310) MERGED `346959f4`: `GROQ_WHISPER_BASE_URL` qua env + cờ `GROQ_WHISPER_PROMPT_ENABLED` (🔴 Fireworks NUỐT prompt trùng audio — không tắt là học viên đọc ĐÚNG bị chấm 0 phát âm) + fallback `avg_logprob` từ `words[].probability` + Lombok 1.18.36 (JDK 21.0.11 giết ≤1.18.34 im lặng khi build nguội).
- [x] FW.b `.env.production` (DeutschFlow-deploy) flip xong: 7 dòng Fireworks (key + base-url chat/whisper + model slug `accounts/fireworks/models/...` + `whisper-v3-turbo` + prompt=false), 3 dòng Groq cũ giữ dạng `#[GROQ-CŨ]#` để rollback 5 phút. Backup: `.env.production.bak-groq-2026-08-09`. Key live-test HTTP 200 (09/08).
- [x] FW.c **Bug lòi khi soi tier**: yml 6/8 tier gương `${GROQ_MODEL}`/`${GROQ_GRADING_MODEL}` (flip ăn theo), nhưng `batch` + `error-verify` HARDCODE slug Groq — `batch` có caller thật (vocab tagging B4.1) ⇒ sau flip sẽ 404 âm thầm. Đã vá bằng env: `AI_LLM_TIER_BATCH_MODEL` + `AI_LLM_TIER_ERROR_VERIFY_MODEL` trỏ slug Fireworks (thêm vào `.env.production` 09/08).

**Còn mở:**
- [ ] 👤 FW.1 Deploy `./deploy-backend.sh` — nay gom **#309 + #310 + #311 + #312 + #313 + #314 + #315 + #316**. Soi SHA `[2/6] Pull code` = **`7e9adc85`** (KHÔNG còn là `4c34c29c`) (không còn là `346959f4`; worktree deploy nhớ `git merge --ff-only origin/main` trước, xem sự cố push non-fast-forward 09/08).
- [x] FW.2a **QA phía Fireworks — XONG 09/08** (script `scratchpad/qa_fw.py`, `rate_test.py`; chạy bằng ĐÚNG key/URL/model đọc từ `.env.production`):
  - ✅ **Chấm phát âm đọc đúng câu mẫu = 100/100** (chạy trọn thuật toán `PronunciationScorerService`: 9/9 CORRECT, avg_logprob −0,0047 suy từ `words[].probability` đúng như code #310). Bẫy nuốt prompt KHÔNG còn cửa nào chạm tới.
  - ✅ Chat nói 20b + `json_object` + `reasoning_effort=low`: 1,66s, JSON 9 field hợp lệ, bắt đúng lỗi `habe→bin` + giải thích tiếng Việt chuẩn.
  - ✅ Whisper `whisper-v3-turbo` @ host `audio-turbo`: transcript đúng 100%, 1,4–3,2s.
  - 🔴 **Chấm bài 120b hỏng ~10–20%** → xem FW.7 (bug mới, chặn nghiệm thu).
  - ⚠️ **Đính chính bẫy nuốt prompt** (đo lại 3×3 lượt, chặt hơn tuyên bố cũ ở #310): CHỈ nuốt khi audio còn nội dung SAU đoạn khớp prompt — audio 3 câu + prompt câu đầu ⇒ mất câu đầu **3/3 lượt, tất định**; audio 1 câu + prompt đúng câu đó ⇒ **KHÔNG nuốt 3/3**. Nghĩa là ca chấm phát âm 1 câu vốn an toàn, ca đọc đoạn nhiều câu thì sập. Cờ `PROMPT_ENABLED=false` vẫn là lựa chọn đúng (và test hồi quy vẫn có giá trị), nhưng mức nghiêm trọng ghi ở PR #310 rộng hơn thực đo — ghi lại cho đúng.
- [ ] 👤 FW.2b QA phía PROD (chỉ owner làm được — cần tài khoản thật): 1 lượt nói + 1 bài chấm + 1 bài phát âm trên app; soi dashboard Fireworks thấy spend nhích; ledger ghi model `accounts/fireworks/...`. ⚠️ **Chưa xác nhận được prod đã chạy code+env mới hay chưa** — `/actuator/info` trả 401 nên không đọc build info từ ngoài; health chỉ `{"status":"UP"}`.
- [ ] 👤 FW.3 Bật **Auto Reload** trên Fireworks (đang OFF, prepaid $6) — min $2 / nạp $10; không bật là credit cạn → Suspended → Speaking sập giữa giờ. + Đặt Usage alert ~$15/tháng.
- [ ] 👤 FW.4 **Revoke key Groq cũ** trên console.groq.com nếu còn vào được (key `gsk_...` đã lộ trong ảnh chụp màn hình gửi qua chat 09/08 — coi như compromised; hiện không còn dùng nhưng vẫn sống).
- [x] ✅ FW.5 yml default của tier `batch`/`error-verify` chain qua `${GROQ_GRADING_MODEL}`/`${GROQ_MODEL}` — nhất quán 8/8 ([PR #312](https://github.com/CuDinh03/DeutschFlow/pull/312)). ⇒ 2 env vá tay `AI_LLM_TIER_BATCH_MODEL` + `AI_LLM_TIER_ERROR_VERIFY_MODEL` trong `.env.production` giờ là DƯ, xoá được sau khi deploy (không xoá cũng vô hại).
- [x] ✅ **FW.7 (phát hiện khi QA FW.2a, ĐÃ VÁ) — chấm bài Schreiben hỏng ~10% trên Fireworks.**
  **Đo được:** `GradingService:364` gọi `chatCompletion(..., 0.3, 800)`. 120b là reasoning model, token "nghĩ" tính chung vào `max_tokens` ⇒ 10 lượt song song: **8/10 OK (temp 0,3), 9/10 OK (temp 0,35)**, lượt hỏng đụng trần 800 tok, JSON cụt giữa chừng. Thêm `reasoning_effort=low` ⇒ **10/10 OK, out chỉ 308–427 tok** (biên an toàn rộng). Đối chứng: `ConversationEval` 1000 tok và `InterviewEval` 2200 tok đều 10/10 (một lượt chạm 904 tok — 1000 cũng đang sát). Model nói 20b KHÔNG có effort ⇒ **0/10, content RỖNG hoàn toàn** (đúng lý do PR #272 đặt effort=low cho chat).
  **Hậu quả người dùng — ĐÍNH CHÍNH sau khi viết test (âm thầm hơn tưởng ban đầu):** KHÔNG phải `GRADING_FAILED` ồn ào như tôi ghi lúc đầu. `AiGradeResultParser.parseScore` có regex fallback `SCORE_FALLBACK` nên vẫn **móc được điểm** từ chuỗi cụt (`"score": 68` nằm đầu JSON), trong khi `parseFeedback` không còn object để đọc ⇒ trả `NO_FEEDBACK`. Kết quả: bài được lưu **AI_GRADED với con điểm trần trụi, MẤT sạch nhận xét + criteria + confidence**. Học viên nhận điểm không kèm lời giải thích nào — hỏng lặng, khó phát hiện qua log. Khoá bằng test `gradeGermanEssay_truncatedJsonKeepsScoreButLosesFeedback`.
  **Vì sao lòi ra sau flip:** `reasoning_effort` chỉ áp khi `defaultModel.equals(model)` ([GroqChatClient:357](backend/src/main/java/com/deutschflow/speaking/ai/GroqChatClient.java:357)) nên model CHẤM chưa bao giờ được áp; Fireworks mặc định "nghĩ" nhiều hơn Groq ⇒ cùng cấu hình 800 tok, Groq lọt còn Fireworks cụt. Gốc rễ: **`GradingService` là luồng chấm DUY NHẤT còn dùng đường cũ `chatCompletion(model, ...)`, không đi qua tier** — P2/B-series bỏ sót (B1.1–B1.8 chỉ gom luồng speaking/exam).
  **✅ ĐÃ VÁ — [PR #311](https://github.com/CuDinh03/DeutschFlow/pull/311) MERGED `4c34c29c`** (CI đủ Compile+Unit+IT+gitleaks+Semgrep xanh; ⚠️ CHƯA deploy):
  - [x] FW.7.1 Route `GradingService.gradeGermanEssay` sang `spec(GRADING_EXAM)` — đây là luồng chấm CUỐI CÙNG còn ngoài khung tier, đóng nốt B-series.
  - [x] FW.7.2 yml: `reasoning-effort: low` cho `grading-exam` + `grading-daily`, env-overridable (`AI_LLM_TIER_GRADING_*_EFFORT`) để model không-reasoning sau này chỉ cần đặt rỗng.
  - [x] FW.7.3 `GRADING_MAX_TOKENS` 800 → 1500 làm đai an toàn thứ hai.
  - [x] FW.7.4 `TierSpec.withModel()` — giữ khả năng so sánh model của `/api/admin/grading-eval` nhưng ép mọi model chạy dưới cùng bộ knob của tầng.
  - [x] FW.7.5 Test: 8 case ở `GradingServiceModelTest` (tier đúng + có effort + budget ≥1500 + override giữ knob + JSON cụt mất nhận xét + 3 case cũ), `GradingServiceGuardTest` chuyển sang hợp đồng tier. Full suite **1783/0**.
  - [x] FW.7.6 Nghiệm thu trên Fireworks thật (n=20 mỗi cấu hình): **trước vá 19/20 · sau vá 20/20**. Cộng dồn 40 lượt/cấu hình: trước vá 4 hỏng (~10%), sau vá 0.
- [ ] FW.6 Theo dõi 24–48h: 429/latency trên log + cost/ngày theo tier (ledger); Fireworks postpaid không trần TPM kiểu Groq FREE nên kỳ vọng 429 ≈ 0. Cân nhắc nâng `GROQ_MAX_CONCURRENT_CHAT=8`/`GROQ_MAX_CONCURRENT_WHISPER=6` (đang 5/4 theo cỡ Groq FREE) — làm RIÊNG sau khi FW.2 sạch để không nhiễu chẩn đoán.

**Rollback:** mở `.env.production`, xoá block Fireworks + 2 env tier, bỏ `#[GROQ-CŨ]# `, chạy lại deploy. (Groq FREE vẫn dùng được tới khi nào; nhớ 16/08 Groq khai tử llama-3.3 — không ảnh hưởng gpt-oss.)

---

## P0 — TIỀN ĐỀ (OWNER) — làm được ngay, song song mọi thứ

- [x] P0.1 ~~Kiểm env llama-3.3 (Groq khai tử 16/08)~~ — **ĐÓNG do flip FW 09/08**: env prod giờ trỏ slug Fireworks (`accounts/fireworks/models/...`), lịch khai tử Groq không còn chạm prod. Chỉ sống lại nếu rollback về Groq (khi đó kiểm lại).
- [x] ~~P0.2 Tạo tài khoản + key OpenRouter~~ — **HUỶ 09/08 (quyết định owner: bỏ OpenRouter, đã chuyển Fireworks).** Không mở tài khoản, không nạp credit.
- [x] ~~P0.3 Xác nhận 5 model trên OpenRouter~~ — **HUỶ cùng P0.2.** Thay bằng: giá Fireworks đã xác nhận 08/08 (20b $0.07/$0.30 · 120b $0.15/$0.60, cached input $0.015 · whisper-v3-turbo $0.0009/phút · batch −50%).
- [x] P0.4 ~~Giá Groq Whisper~~ — **THAY bằng giá Fireworks (flip FW)**: `whisper-v3-turbo` serverless **$0.0009/phút audio** (= $0.000015/giây, nguồn: fireworks.ai/blog/audio-transcription-launch, tra 08/08/2026) → E.4 dùng số này.
- [x] P0.5 ~~Nâng Groq Dev tier~~ — **ĐÓNG bằng lời giải khác**: kẹt billing Groq vô hạn → chuyển hẳn Fireworks postpaid (section FW). Trần 8K TPM hết áp dụng.

---

## P1 — KHUNG TIER (Khu vực A) + LEDGER/GIÁ (Khu vực E) — zero behavior change

### A. Khung tier

**A1. `LlmProperties` + binding**
- [x] A1.1 Tạo `ai/tier/LlmProperties.java` (đặt ở package trung lập `com.deutschflow.ai.tier` vì teacher/curriculum cùng dùng) — prefix `app.ai.llm`: `baseUrl` (default `https://api.groq.com/openai/v1`), `apiKey` (default rỗng → fallback `app.ai.groq.api-key`), `tiers: Map<String, TierSpec>`.
- [x] A1.2 `TierSpec` record: `model` (bắt buộc), `baseUrl` (optional override), `providerOrder` (list, optional), `requireParameters` (bool, default false), `reasoningEffort` (optional), `sort` (optional: price/throughput), `sessionSticky` (bool, default false).
- [x] A1.3 Đăng ký `@EnableConfigurationProperties` trong `GroqAiConfiguration` (hoặc config class mới `LlmTierConfiguration`).
- [x] A1.4 Khai block `app.ai.llm` trong `application.yml` với **8 tier trỏ đúng model HIỆN TẠI** (chat-free=20b, chat-paid=20b tạm, error-verify=chưa dùng, grading-exam=120b, grading-daily=120b, explain=120b*, content=120b*, batch=120b*) — (*) các tier này P2 mới có caller, khai sẵn để P2 chỉ đổi call site. Mọi giá trị env-overridable: `AI_LLM_TIER_<TÊN>_MODEL`, v.v.
- [x] A1.5 Comment tiếng Việt trong yml giải thích từng tier + quy ước flip (theo phong cách comment hiện có của file).

**A2. Tier enum + resolver**
- [x] A2.1 Tạo enum `LlmTier` (`CHAT_FREE, CHAT_PAID, ERROR_VERIFY, GRADING_EXAM, GRADING_DAILY, EXPLAIN, CONTENT, BATCH`).
- [x] A2.2 Tạo `LlmTierResolver` bean: `spec(LlmTier)` trả `TierSpec`; validate lúc khởi động — tier thiếu `model` → fail-fast với message rõ; log bảng tier khi start (`INFO` một dòng/tier).
- [x] A2.3 Unit test: default yml đủ 8 tier; env override 1 tier ăn đúng; thiếu model fail-fast.

**A3. Tổng quát hoá `GroqChatClient`** (giữ tên class + breaker `groqChat`)
- [x] A3.1 Constructor production đọc `baseUrl`/`apiKey` từ `LlmProperties` (fallback `app.ai.groq.*` khi rỗng) — nối vào constructor test-only sẵn có.
- [x] A3.2 Mở rộng `chatCompletion`/`chatCompletionStream`: nhận optional `TierSpec` (overload mới, giữ nguyên chữ ký cũ cho caller chưa migrate) — model, per-call base-url (nếu tier override), `reasoning_effort` per-tier (thay field global; giữ hành vi cũ khi spec null).
- [x] A3.3 `buildRequestBody`: thêm optional `provider` object (`order`, `require_parameters`, `sort`, `quantizations`) và `session_id` — **chỉ serialize khi tier khai** ⇒ request luồng cũ byte-for-byte như cũ.
- [x] A3.4 Per-tier base-url: client giữ map RestClient/WebClient theo base-url (lazy, tối đa 2–3 endpoint) — KHÔNG tạo client mới mỗi call.
- [x] A3.5 Stub-server IT (tái dùng hạ tầng test R-B1): (a) luồng cũ không truyền spec → body y hệt trước; (b) spec có provider/session_id → body chứa đúng field; (c) tier base-url override → request đi đúng endpoint stub thứ hai.

**A4. `GradingModelConfig` thành adapter**
- [x] A4.1 `GradingModelConfig.model()` đọc `LlmTierResolver.spec(GRADING_EXAM).model()` — giữ nguyên public API; default yml giữ `openai/gpt-oss-120b` ⇒ teacher services không đổi hành vi.
- [x] A4.2 Cập nhật Javadoc: nguồn sự thật giờ là bảng tier; env cũ `GROQ_GRADING_MODEL` map vào `AI_LLM_TIER_GRADING_EXAM_MODEL` (giữ alias đọc env cũ 1 release, log WARN deprecated).
- [x] A4.3 `TeacherServiceTest`/`OrgMembershipServiceTest`… đang đỏ ở cây làm việc? — chạy toàn bộ `./mvnw test` xác nhận baseline TRƯỚC khi sửa (cây đang có file modified sẵn — làm trong worktree sạch theo quy ước).

### E. Ledger & giá

- [x] E.1 `AiCostEstimator`: thêm `ModelRate` HAIKU_4_5 (1.00/5.00), SONNET_4_6 (3.00/15.00), GEMINI_25_FLASH (điền từ P0.3), CEREBRAS_GPT_OSS_120B (điền từ P0.3) + mapping tên model OpenRouter (`anthropic/claude-haiku-4.5`…) về đúng rate (match theo substring như pattern hiện có).
- [x] E.2 Unit test: từng tên model OpenRouter KHÔNG rơi vào DEFAULT.
- [x] E.3 OpenRouter cost thật: khi response có `usage.cost` (bật `usage: {include: true}` trong body cho request đi OpenRouter) → ledger ghi cost thật, estimator chỉ là fallback. (Field cộng thêm vào `AiChatCompletionResult` + `TokenUsage`.)
- [x] ✅ E.4 `WHISPER_USD_PER_SEC` → giá Fireworks `whisper-v3-turbo` $0.0009/phút = **$0.000015/giây** ([PR #312](https://github.com/CuDinh03/DeutschFlow/pull/312)); hằng cũ $0.006/phút khai vống **6,67×**. Test khoá cả tỉ lệ vống để không ai đổi ngược. Kèm dọn comment giá STT lỗi thời ở `AiSessionController:126` (`WhisperApiClient` giữ nguyên $0.006 — nó thật sự gọi OpenAI).
- [x] ✅ E.1b **(bổ sung 09/08 theo bản viết lại của kế hoạch)** `ModelRate` cho toàn bộ ứng viên Fireworks + cột **cached-input** + overload `costUsd(model, prompt, cached, completion)` ([PR #312](https://github.com/CuDinh03/DeutschFlow/pull/312)). Trước đó `deepseek-*`/`qwen3p7-plus`/`kimi-*`/`minimax`/`glm-5p2` rơi DEFAULT $0.20/$0.20 — với Kimi K3 ($3/$15) là khai **thiếu 75×** ở đầu output. Slug lấy từ `GET /inference/v1/models` (Fireworks viết "2.6"→`k2p6`, "3.7"→`3p7`, "5.2"→`5p2`).
- [x] ✅ **E.6 XONG (quyết định #17)** — [PR #315](https://github.com/CuDinh03/DeutschFlow/pull/315), xếp chồng trên #314. Ledger ghi token cache để COGS thôi khai vống ~3×:
  - [x] E.6.1 **V270** thêm cột `cached_prompt_tokens` (INTEGER NOT NULL DEFAULT 0) vào `ai_token_usage_events` — là phần CON của `prompt_tokens`, không cộng thêm. ⚠️ replay fresh-DB để CI (Docker daemon không chạy ở máy dev; `ADD COLUMN IF NOT EXISTS … NOT NULL DEFAULT 0` không rewrite bảng trên PG 11+).
  - [x] E.6.2 `AiUsageLedgerService` thêm overload `record(…, TokenUsage, …)` + kẹp `cached ≤ prompt`; **20 call site ở 16 file** đổi từ 3 số rời sang truyền `usage()`. Dùng `TokenUsage` thay vì thêm tham số int thứ tư vì 4 int liền nhau là chỗ dễ đặt lệch slot nhất.
  - [x] E.6.3 `AdminManagementService` (3 truy vấn) + `AdminAnalyticsService` (1) `SELECT SUM(cached_prompt_tokens)` + dùng `costUsd(model, prompt, cached, completion)`. Không còn call site nào dùng overload 3 tham số.
  - [x] E.6.4 Test 17/0: chữ ký cũ ghi `cached=0` ⇒ **không viết lại lịch sử**; overload mới ghi đúng slot; `cached > prompt` bị kẹp; `usage=null` không ghi ledger lẫn không trừ ví. Full unit 1806/0. 🪤 bắt tham số INSERT phải quét invocation của mock — matcher varargs Mockito không khớp 11 đối số rời.
  - ℹ️ Vì sao đáng làm ngay: đo 09/08 thấy cache hit **~99% ở cả 8 tier** (system prompt lặp y nguyên mỗi lượt) và cached-in chỉ bằng **10%** giá input với 120b ⇒ số COGS đang dùng để quyết giá gói/ngân sách AI lệch có hệ thống.
- [x] E.5 Sửa nhãn `"gemini-1.5-flash"` → `"gemini-2.5-flash"` tại `TeacherLessonPlanService:222`.

### Nghiệm thu P1
- [x] P1.V1 `./mvnw verify` xanh (IT chạy với `DEUTSCHFLOW_IT_REQUIRE_DB=true`).
- [x] P1.V2 Log khởi động PROD in đủ 8 tier đúng model (chat/explain/content=20b+low, grading×2=120b, batch=120b) — script `DeutschFlow/smoke-llm-tier.sh` (dời khỏi cây deploy 08/08 vì file untracked làm deploy-backend.sh báo cây bẩn).
- [x] P1.V3 Diff request body (stub IT) các luồng hiện hữu = 0 thay đổi.
- [x] P1.V4 PR mô tả rõ "zero behavior change" + checklist này cập nhật dashboard.
- [x] P1.V5 Merge+deploy XONG (`2ba00e72`, health UP, Edge TTS 19 persona, Redis PONG). 👤 CÒN: owner làm 1 lượt chat + 1 bài chấm thật rồi soi ledger ghi 120b cho luồng chấm (cần tài khoản thật).

---

## P2 — ROUTE LUỒNG (Khu vực B) — model chấm vẫn 120b, flip Haiku ở P3

**B1. Sửa 4 luồng chấm mis-route → tier**
- [x] B1.1 `AiSpeakingMockExamController:101` → `spec(GRADING_EXAM)`.
- [x] B1.2 `SprechenTeil2Service:134` (call chấm) → `GRADING_EXAM`; dòng 159 (sinh đề) GIỮ nguyên default.
- [x] B1.3 `AiExamEvaluatorService:53` + `:177` → `GRADING_EXAM`.
- [x] B1.4 `ConversationEvaluationService:74` → `GRADING_DAILY` (bỏ đọc trực tiếp `gradingModelConfig`).
- [x] B1.5 `InterviewEvaluationService:71` → `GRADING_DAILY`.
- [x] B1.6 IT/unit từng luồng: cập nhật các `*ModelTest` hiện hữu sang hợp đồng tier (test cũ mã hoá đúng hành vi mis-route — bài học "test cũ mã hóa chính bug"); 27/27 xanh.
- [x] B1.7 **(phát hiện khi làm)** `SkillTreeController:296` CORRECT_WRITING — luồng CHẤM bài viết mis-route THỨ 5 (`getGroqClient()` + null) → route `GRADING_EXAM`, accessor đổi thành `getChatClient()` trả interface.
- [x] B1.8 **(phát hiện khi nghiệm thu P2.V1)** `WeeklySpeakingService:163` WEEK_RUBRIC — luồng CHẤM rubric bài nói tuần mis-route THỨ 6 (truyền `null` → model chat 20b) → route `GRADING_DAILY` + test hợp đồng tier (`WeeklySpeakingServiceUnitTest`). ✅ **PR #309 MERGED** `9dacf7ed` 08/08 — deploy 09/08 cùng chuyến #310 (owner chạy, xem FW.1 để chốt SHA).

**B2. AiTextService → EXPLAIN**
- [x] B2.1 `AiTextService.complete(...)` truyền `spec(EXPLAIN)` cho correction + explanation (generate() helper khác giữ default nếu là luồng nói).
- [x] B2.2 Xác nhận không đụng latency SSE (AiTextService là REST đồng bộ, không stream).

**B3. Curriculum bỏ inject trực tiếp**
- [x] B3.1 `PlacementTestService`: hoá ra field `groqChatClient` là INJECT CHẾT (không có call LLM nào) → đã gỡ field + import; không có gì để route.
- [x] B3.2 `SkillTreeService` (3 call site 460/1102/1243): → `OpenAiChatClient` + `spec(CONTENT)`.
- [x] B3.3 `PracticeNodeService` (168/194): → `spec(CONTENT)`.
- [x] B3.4 IT: contentHash cache KHÔNG regenerate — `SkillTreeContentCacheIntegrationTest`: node có `content_json` sẵn → unlock trả `CACHE`, `content_hash` giữ nguyên, LLM client (`@MockBean`) không bị gọi.
- [x] B3.5 Kiểm tra `AiCacheService`/`SkillTreeController` không còn tham chiếu kiểu `GroqChatClient` cụ thể — grep `origin/main` sạch (curriculum chỉ còn `OpenAiChatClient`).

**B4. Vocab tagging → BATCH**
- [x] B4.1 `VocabularyAutoTaggingService:191` → `spec(BATCH)` (=120b, quyết định #10 chốt tại P2).
- [ ] B4.2 Chạy thử 1 batch nhỏ (~50 từ) staging, so sánh tag trước/sau bằng mắt.

**B5. Khoá giáo án (#9) — PR riêng**
- [x] B5.1 BE: flag `app.features.teacher-lesson-plan.enabled:false` (env `FEATURE_TEACHER_LESSON_PLAN`) → `/generate-pptx` trả 403 `FEATURE_DISABLED` TRƯỚC mọi validate/quota/job — PR #308.
- [x] B5.2 FE: KHÔNG CẦN — soi thực tế: v2 không có UI nào gọi `generate-pptx` (chỉ còn comment ở `tools/materials`), các trang v1 từng gọi đã bị redirect 307 từ đợt xoá v1 (#290). Bề mặt UI đã tự chết.
- [x] B5.3 i18n: KHÔNG CẦN (hệ quả B5.2 — không có UI nào hiển thị thông báo; message 403 nằm trong body BE).
- [x] B5.4 Test: `TeacherMaterialControllerLockTest` — flag tắt → 403, không tạo AsyncJob (e2e nút không cần vì không còn nút).

**Nghiệm thu P2**
- [x] P2.V1 Grep toàn repo (08/08): `chatCompletion(.*null` — lòi `WeeklySpeakingService` là mis-route thứ 6 → fix ở B1.8. Danh sách trắng còn lại đúng thiết kế: `ChatCompletionService` (chat nói), `GroqApiService` (helpers nói), `SpeakingAiHelpersService`, `SprechenTeil2Service:162` (sinh đề), 2 default trong interface client.
- [x] P2.V2 `./mvnw verify` xanh 08/08 (unit 1810/0 đỏ; IT 122 chạy/0 đỏ, 10 skip = `AIModelServiceIntegrationTest` cần key LLM thật) + e2e `speaking.spec.ts` 2/2 xanh.
- [ ] P2.V3 Ledger sau deploy: mock exam/grammar exam/teil2 ghi model 120b.
- [ ] 👤 P2.V4 Owner QA: 1 bài mock exam + 1 grammar exam trên prod, cảm quan chất lượng chấm.

---

## P3 — CALIBRATION & FLIP (Khu vực F)

> **⚠️ VIẾT LẠI 09/08 — BỎ OPENROUTER (quyết định owner).** Kế hoạch gốc dùng OpenRouter làm cửa
> duy nhất tới Haiku/Sonnet/Gemini. Nay đã chuyển Fireworks nên **F2 (flip base-url từng tier sang
> OpenRouter) HUỶ TOÀN BỘ** — Fireworks là endpoint chính thức, không còn tầng trung gian nào để flip.
>
> **Hệ quả phải biết:** Fireworks **KHÔNG serve model Anthropic/Google**. Nên F3 (nâng chất lượng chấm
> bằng Haiku 4.5 / Sonnet 4.6) mất đường đi. Ba lựa chọn — **✅ owner ĐÃ CHỌN HƯỚNG 3 (09/08 chiều, quyết định #7)**:
> 1. **Bỏ luôn F3, ở lại gpt-oss-120b** — rẻ nhất, một nhà cung cấp, đúng tinh thần "bỏ OpenRouter".
>    Chấp nhận trần chất lượng chấm hiện tại. *(mặc định nếu không quyết gì thêm)*
> 2. **Gọi thẳng Anthropic API** cho riêng tier chấm — khung tier đã hỗ trợ per-tier `baseUrl`+`apiKey`
>    nên chỉ là config; đổi lại phải mở thêm một tài khoản + hoá đơn thứ hai (đúng thứ owner muốn tránh).
> 3. **Thử model to hơn TRÊN Fireworks** (Qwen/DeepSeek/Llama cỡ lớn) — một nhà, nhưng phải calibrate lại.
>
> F1 (harness đo chất lượng) **GIỮ NGUYÊN, vẫn đáng làm** dù chọn hướng nào: nó là thước đo, không phụ
> thuộc nhà cung cấp. Chạy nó trước rồi hẵng quyết 1/2/3.

**F1. Calibration harness**
- [ ] 🔴 **F1.0 (MỚI 09/08 — CHẶN F1.3)** Nới ngân sách token của các call site chấm, hoặc cho harness đặt ngân sách riêng theo lượt đo. Đo thật: ở 800 tok cả 3 ứng viên đều cụt/rỗng, ở 1500 chỉ V4 Flash sống (biên 20% — sát), ở 3000 thì V4 Flash + Qwen sống, K2.6 biên 2%. Call site phải nới nếu flip: `AiExamEvaluatorService:59,183` (800) · `SprechenTeil2Service:137` (1000) · `AiSpeakingMockExamController:104` (1200) · `GradingService` (1500) · `SkillTreeController:300` (2048, ĐỒNG BỘ — kiểm timeout vì latency lên 6–14s).
- [x] ✅ **F1.1 XONG** ([PR #314](https://github.com/CuDinh03/DeutschFlow/pull/314), xếp chồng trên #312). `/api/admin/grading-eval` nhận `tier` + `maxTokens` + `parallelism`; kết quả thêm **`feedbackMissing`** (bài CÓ điểm nhưng MẤT nhận xét — cột phải đọc TRƯỚC MAE, bài học FW.7), `maxCompletionTokens`, `withinTenRate` (1 band = 10 điểm), latency p50/p95, `costUsd`/`costPerCaseVnd`; mỗi bài trả kèm token prompt/cached/completion. Chạy song song (mặc định 2, trần 4 vì chia sẻ semaphore chat với traffic thật). `MAX_CASES` 50 → **100** theo F1.2. Thêm `POST /api/admin/grading-eval/csv` cho báo cáo F1.4. Ứng viên P3 **không** nằm trong `DEFAULT_MODELS` (mỗi ứng viên cần ngân sách riêng ⇒ phải truyền tường minh). Kèm: `GroqChatClient` đọc `usage.prompt_tokens_details.cached_tokens` → `TokenUsage.cachedPromptTokens`. Test 12/0, full unit 1802/0.
- [ ] F1.2 Chọn tập ~100 bài: trộn Schreiben/Sprechen/grammar-exam, đủ A1–B1, lấy từ prod (ẩn danh).
- [ ] F1.3 Chạy **120b (baseline) vs `accounts/fireworks/models/deepseek-v4-flash`, `maxTokens=3000`** (quyết định #14 — chỉ 2 model, không đo Qwen/K2.6 nữa). Lệnh mẫu:
  ```
  POST /api/admin/grading-eval/csv
  {"models":["openai/gpt-oss-120b","accounts/fireworks/models/deepseek-v4-flash"],
   "tier":"GRADING_EXAM","maxTokens":3000,"parallelism":2,"cases":[…]}
  ```
  ⚠️ Đọc `feedbackMissing` TRƯỚC MAE; nếu > 0 thì nới `maxTokens` rồi đo lại (số MAE của lượt đó không dùng được).
- [ ] F1.4 Báo cáo: offset trung bình, độ phân tán, danh sách bài lệch >1 band kèm diff giải thích — file `BAO_CAO_CALIBRATION_CHAM_<ngày>.md`.
- [ ] 👤 F1.5 Owner duyệt báo cáo → quyết flip.

**F2. ~~Flip OpenRouter theo tier~~ — 🚫 HUỶ TOÀN BỘ 09/08 (bỏ OpenRouter; Fireworks là endpoint chính thức, không còn gì để flip).**
- [x] ~~F2.1–F2.3 flip base-url từng tier sang OpenRouter~~ — không còn ý nghĩa.
- [x] ✅ **F2.4 XONG** — `scripts/ai-tier-contract-test.py` ([PR #313](https://github.com/CuDinh03/DeutschFlow/pull/313)), thay `qa_fw.py`/`rate_test.py` thủ công. Stdlib-only, exit code dùng làm cổng, không in secret. Kiểm: JSON mode · knob `reasoning_effort` · **ngân sách token chật nhất của từng tier + biên an toàn** · lặp n lượt (hỏng chập chờn) · TTFT stream theo trung vị · STT (transcript, `words[].probability`, bẫy nuốt prompt) · cache hit. Nghiệm thu bằng env prod thật: **8/8 tier đạt, exit 0**, biên an toàn 49–84%.
  - 🪤 Hai bẫy môi trường lòi ra khi chạy, đều **giả dạng "nhà cung cấp chết"**, đã xử lý trong script: (a) Python python.org trên macOS không có CA bundle ⇒ `CERTIFICATE_VERIFY_FAILED` mọi request; (b) host `audio-*.direct.fireworks.ai` sau Cloudflare **chặn User-Agent mặc định của urllib** bằng 403 `error code: 1010` — khai UA tường minh là xong.
- [ ] F2.4b Cắm vào quy trình: chạy script TRƯỚC mọi lần đổi `AI_LLM_TIER_*_MODEL`, dán kết quả vào PR flip (kèm số lượt, biên an toàn).

**F3. Flip model — ✅ HẾT TREO: owner chọn HƯỚNG 3 (09/08). Model đích do F1 quyết: 120b vs V4 Flash vs Qwen 3.7 Plus vs K2.6; riêng CONTENT chốt sẵn K2.6 (không chờ F1)**
- [ ] F3.1 `GRADING_EXAM.model` → model đã chọn. ⚠️ nếu là model KHÔNG-reasoning thì phải đặt `AI_LLM_TIER_GRADING_EXAM_EFFORT=` (rỗng) — xem FW.7.2.
- [ ] F3.2 `GRADING_DAILY.model` → model đã chọn (+ `..._DAILY_EFFORT` rỗng nếu cần). Đòn bẩy chi phí: hạ riêng tier này về 120b bằng 1 env.
- [ ] F3.3 `EXPLAIN.model` → model đã chọn.
- [x] ~~F3.4 `CONTENT.model` → kimi-k2p6~~ — **HUỶ trên đường realtime theo quyết định #15**: K2.6 ở ngân sách 1024 tok của `SkillTreeService:1107,1248` trả **RỖNG 3/3** (im lặng, không exception), ở 4096 tok chạy được nhưng **32–41s/node** — học viên đang chờ unlock không chịu được. `AI_LLM_TIER_CONTENT_MODEL` **giữ 20b**.
- [ ] **F3.4b (thay F3.4, quyết định #15)** Đường sinh nội dung TRƯỚC theo lô dùng K2.6: admin command sinh sẵn node theo level (không ai chờ ⇒ 32–41s/node vô hại), ghi vào cache như P5 nhưng cho node CHƯA có content. Env riêng cho đường này (không dùng chung `AI_LLM_TIER_CONTENT_MODEL` vì tier đó phục vụ cả đường realtime) hoặc gộp luôn vào admin command của P5/H1.1.
- [ ] F3.5 Release note 3 ngữ: "hệ thống chấm nâng cấp, thang điểm có thể lệch nhẹ so với trước <ngày>".
- [ ] F3.6 Theo dõi 1 tuần: cost/ngày theo tier (ledger), khiếu nại điểm, p95 latency chấm.

---

## P4 — VERIFY ERRORS (C) + PAID CEREBRAS (G) + STT (D)

**C. Pipeline thẩm định corrections (quyết định: shadow 1 tuần ✅, fail-open `unverified` ✅)**
- [ ] C1.1 Prompt + JSON schema verify: input câu user + errors 20b + CEFR; output `{confirmed:[], rejected:[{error, reason}]}` — max_tokens ~300, temp 0.
- [ ] C1.2 Executor riêng `correctionVerifyExecutor` (pool nhỏ 2–4, queue bounded, reject → coi như verify fail).
- [ ] C1.3 Service `CorrectionVerifyService`: gọi tier `ERROR_VERIFY`; timeout cứng 5s; CHỈ gọi khi errors ≠ rỗng.
- [ ] C1.4 Cột/flag `verification_status` (`UNVERIFIED|CONFIRMED|REJECTED|VERIFY_FAILED`) trên `user_grammar_errors` (+ migration V2xx, fresh-DB replay OK).
- [ ] C1.5 **SHADOW**: persist như cũ + ghi verification_status; metric `speaking_correction_reject_ratio` (Micrometer) + log mẫu các case REJECTED.
- [ ] C1.6 Metric dashboard/truy vấn admin xem tỉ lệ reject theo ngày.
- [ ] 👤 C1.7 Sau ≥1 tuần shadow: owner xem số liệu → duyệt ENFORCE.
- [ ] C2.1 **ENFORCE** (flag `app.speaking.correction-verify.enforce=true`): chỉ persist CONFIRMED (+ VERIFY_FAILED persist kèm cờ `unverified` — quyết định #3); REJECTED bỏ.
- [ ] C2.2 SSE event mới `corrections_verified` phát sau verify; luồng blocking (non-stream) trả corrections đã verify trong response nếu kịp 5s, không kịp → gửi qua kênh event/poll.
- [ ] C2.3 FE (web + mobile): render card sửa lỗi theo event mới; card `unverified` có style/nhãn nhẹ. (Mobile cần release OTA — JS-only nếu không thêm native module.)
- [ ] C2.4 e2e: lượt có lỗi → card xuất hiện sau lời thoại; lượt Gemini bác → không có card, không có row DB mới.
- [ ] C2.5 `TurnEvaluatorService`/`AdaptiveEngine` đọc theo verification_status (chỉ CONFIRMED vào lịch ôn/adaptive).

**G. Chat PAID — ⚠️ VIẾT LẠI 09/08: bỏ OpenRouter ⇒ bỏ luôn đường Cerebras (Cerebras chỉ tới được qua OpenRouter).**
> Hướng thay thế trong cùng nhà Fireworks: `CHAT_PAID` = `gpt-oss-120b` (cùng endpoint, chỉ khác model)
> — vẫn cho gói trả phí "não to" hơn FREE 20b, không thêm nhà cung cấp nào. Nền CHAT_FREE nay là
> Fireworks 20b (TTFT ~0,4s ấm), degrade PAID→FREE là rơi trong cùng một nhà nên đơn giản hơn thiết kế cũ.
- [ ] G1.1 `ChatPrepService`: resolve `CHAT_FREE`/`CHAT_PAID` theo `planCode` (QuotaService), cache trong prep của phiên.
- [ ] G1.2 `CHAT_PAID` config: `accounts/fireworks/models/gpt-oss-120b` + `reasoning-effort: low` (cùng endpoint Fireworks, KHÔNG cần provider.order/require_parameters — mấy field đó là của OpenRouter, nay bỏ).
- [ ] G1.3 Degrade: breaker/model-unavailable/timeout trên tier PAID → chạy lại lượt bằng CHAT_FREE, log + metric `chat_paid_degraded_total`, KHÔNG 503.
- [x] ✅ **G1.4 ĐÃ ĐO 09/08** (`scripts/ai-tier-contract-test.py --tiers chat-paid --model …gpt-oss-120b --stream --ttft-runs 12`): TTFT stream 120b **trung vị 1,29s** · min 0,65 · max 1,88 · **4/12 lượt vượt 1,5s**; đối chứng 20b trung vị **0,83s** · max 1,13 · **0/12 vượt**. Hợp đồng JSON của 120b ở ngân sách chat 800 tok: 3/3 đạt, biên an toàn 57%. Đính chính: "3,4s" của bench 08/08 là **non-stream** (đo lại non-stream ở đây 2,0–2,9s), không phải TTFT.
  - [ ] 👤 **G1.4b ĐO LẠI TỪ EC2 (quyết định #16) — chưa chốt ship G tới khi có số này.** Số 1,29s đo từ máy owner nên gồm RTT xuyên Thái Bình Dương; EC2 prod cùng vùng với Fireworks (us-east-1 ↔ us-virginia-1) nên thực tế phải nhanh hơn. Chạy trên EC2 (agent bị hook chặn `ssh`):
    ```
    scp -i deutschflow-key.pem scripts/ai-tier-contract-test.py ubuntu@35.175.232.152:/tmp/
    ssh -i deutschflow-key.pem ubuntu@35.175.232.152 \
      "python3 /tmp/ai-tier-contract-test.py --env-file /home/ubuntu/DeutschFlow/.env.production \
       --tiers chat-paid --model accounts/fireworks/models/gpt-oss-120b --runs 3 --stream --ttft-runs 12"
    ```
    (`.env.production` đã sẵn trên EC2 do `deploy-backend.sh` scp vào `/home/ubuntu/DeutschFlow/`.) Đo cả `--tiers chat-free` làm đối chứng cùng vantage point. Trung vị <1,5s ⇒ ship G; không đạt ⇒ PAID = FREE, phân biệt gói bằng quota/tính năng.
- [ ] G1.4b Contract test route PAID phía BE: schema V1/V2 khi tier PAID bật (chạy sau khi có G1.1–G1.3).
- [ ] G1.5 e2e 2 account FREE vs PRO: ledger ghi model khác nhau; kill-switch env `AI_LLM_TIER_CHAT_PAID_MODEL=accounts/fireworks/models/gpt-oss-20b` hoạt động.
- [ ] G1.6 Marketing/copy gói trả phí cập nhật (persona "não to") — phối hợp owner.

**D. STT hai tầng (quyết định: ngưỡng WER 1% giữ ✅) — ⚠️ HIỆN TRẠNG ĐỔI SAU FLIP FW 09/08**

> Thực tế vượt kế hoạch: env prod cũ (Groq) đã chạy `whisper-large-v3-turbo` từ trước, và sau flip toàn bộ STT (transcript + chấm phát âm) chạy **Fireworks `whisper-v3-turbo`**. Tức "flip turbo" mà D định đo trước khi làm thì… đã sống trên prod từ lâu, không thấy khiếu nại tích lũy. Mục D vì vậy đổi mục tiêu: KHÔNG còn là "đo trước khi bật turbo" mà là "**có đáng tách riêng tầng CHẤM PHÁT ÂM về model to hơn không**" (Fireworks có `whisper-v3` thường ở host `audio-prod...` — lưu ý mỗi model một host, xem javadoc `GroqWhisperClient`).

- [ ] D1.1 Property `whisper-transcript-model` + `whisper-scoring-model` (+ **base-url theo model** vì Fireworks tách host theo model) — chỉ làm nếu D1.3 cho thấy đáng.
- [ ] D1.2 Wiring: transcribe chat/PV → transcript-model; `PhonemeService` + `PronunciationScorerService` → scoring-model.
- [ ] D1.3 Script đo WER: ~50 audio prod ẩn danh chạy `whisper-v3-turbo` (host audio-turbo) vs `whisper-v3` (host audio-prod) trên Fireworks — nếu chênh ≤1% thì ĐÓNG cả mục D, giữ nguyên turbo cho cả hai tầng.
- [ ] 👤 D1.4 Owner duyệt kết quả D1.3.
- [ ] D1.5 Nếu tách tầng: theo dõi 1 tuần khiếu nại "nghe sai" / điểm phát âm bất thường.

---

## P5 — REGEN CÂY HỌC TẬP (Khu vực H)

- [ ] H1.1 Admin batch command (idempotent, resume được): iterate node theo level → sinh bằng `CONTENT` (Sonnet) → verifier Gemini 2.5 Flash chấm `{pass, issues[]}` → pass mới swap cache nguyên tử theo node; fail vào danh sách rà tay.
- [ ] H1.2 Dry-run 10 node A1 → 👤 owner rà mẫu nội dung.
- [ ] H1.3 Chạy A1 → rà mẫu → A2 → … (mỗi level một lần duyệt).
- [ ] H1.4 Ghi cost thật từng level vào checklist (ước tổng ~$30–40).
- [ ] H1.5 e2e cây học tập (đã có suite roadmap) xanh sau mỗi level.

---

## VIỆC XUYÊN SUỐT (mọi phase)

- [ ] X.1 Mỗi PR: cập nhật dashboard + tick checklist này NGAY khi xong phần đó (quy ước sync checklist).
- [ ] X.2 Không commit key/secret — repo PUBLIC; gitleaks không bắt được password trong bảng markdown → tự soát.
- [ ] X.3 Làm trong worktree sạch, `git fetch` + kiểm `merge-base --is-ancestor origin/main` trước khi sửa.
- [ ] X.4 Privacy policy 3 ngữ + DPA: **cập nhật sub-processor = Fireworks AI** (thay Groq; bỏ Anthropic/Cerebras/OpenRouter khỏi danh sách dự kiến vì đã bỏ OpenRouter). ⚠️ Việc này giờ KHẨN hơn trước: prod đã thực sự gửi dữ liệu học viên sang Fireworks từ 09/08, trong khi chính sách vẫn ghi nhà cũ — 👤 owner duyệt câu chữ.
- [ ] X.5 Sau mỗi deploy: soi SHA log `[2/6] Pull code`, đừng tin exit 0.
- [ ] X.6 🪤 **PR xếp chồng: đừng tin trạng thái MERGED.** 09/08 merge 4 PR trong 11 giây ⇒ #314 và #315 báo MERGED nhưng merge vào chính NHÁNH BASE của mình, không vào main (GitHub chỉ trỏ lại về main khi nhánh base bị XOÁ sau lúc PR của nó merge — 11 giây không kịp). Main khi đó thiếu V270 + harness + ledger cache trong khi checklist đã tick xong; vá bằng #316 (cherry-pick 2 commit squash). **Luôn kiểm bằng `git merge-base --is-ancestor <mergeCommit> origin/main` hoặc `git show origin/main:<file>`.** Lần sau: merge tuần tự CÓ CHỜ xoá nhánh base, hoặc gộp thành 1 PR.
