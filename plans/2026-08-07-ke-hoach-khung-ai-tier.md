# KẾ HOẠCH: KHUNG AI TIER + ROUTE MODEL THEO QUYẾT ĐỊNH 06/08

**Ngày:** 2026-08-07 · **Trạng thái:** CHỜ DUYỆT · **Căn cứ:** `BAO_CAO_DE_XUAT_MODEL_TOAN_HE_THONG_2026-08-06.md` (Phần III — bảng quyết định owner)

**Nguyên tắc xuyên suốt:** mỗi phase tự đứng được, phase sau flip bằng config/env chứ không deploy code mới; mọi thay đổi model đều đi qua bảng tier để về sau "xoay model = sửa 1 dòng yaml".

---

## KHU VỰC A — Nền tảng: khung tier + client tổng quát (điều kiện của mọi thứ)

### Vì sao
- Interface `OpenAiChatClient.chatCompletion(..., model, ...)` đã nhận model per-call, nhưng **không có bảng tra "chức năng → model"** — service truyền `null` (rơi về model nói) hoặc chuỗi cứng. Đây là gốc của 4 luồng chấm mis-route.
- `GroqChatClient` hardcode `GROQ_BASE_URL` (constructor test đã nhận `baseUrl` — chỉ thiếu nối lên property) ⇒ không đổi được nhà cung cấp bằng env.
- Quyết định 06/08 dùng 4 hãng (Groq/Cerebras/Google/Anthropic) — không có khung thì phải viết 3 SDK integration; có khung + OpenRouter thì tất cả là chuỗi `model` + object `provider`.

### Làm gì
1. **`LlmProperties`** (`app.ai.llm.*`, file mới cạnh `GroqProperties`):
   - `base-url` (default `https://api.groq.com/openai/v1` — GIỮ NGUYÊN hành vi), `api-key` (default = `GROQ_API_KEY`).
   - `tiers`: map tên tier → `{model, base-url?, provider-order?, require-parameters?, reasoning-effort?, sort?, session-sticky?}`. `base-url` per-tier là optional override để flip OpenRouter TỪNG tier (BATCH trước, SPEED cuối).
2. **Tier enum + `LlmTierResolver`** (bean mới): `CHAT_FREE, CHAT_PAID, ERROR_VERIFY, GRADING_EXAM, GRADING_DAILY, EXPLAIN, CONTENT, BATCH`. Resolver trả `{model, requestOptions}` cho client.
   - Tách `GRADING_EXAM` / `GRADING_DAILY` dù quyết định #3 cho cả hai là Haiku: giữ đòn bẩy chi phí trong config (nếu sau này cần hạ chấm-hội-thoại-thường về 120b thì flip 1 dòng, không sửa code).
3. **`GroqChatClient` tổng quát hoá** (giữ tên class + tên breaker `groqChat` để không phải sửa hàng loạt test/yml ở phase này):
   - `baseUrl`/`apiKey` đọc từ `LlmProperties` (fallback về `app.ai.groq.*` — không ai phải đổi env ngay).
   - `buildRequestBody` nhận thêm optional: `provider` object, `session_id`, `reasoning_effort` per-call (hiện effort là field global chỉ áp cho defaultModel — chuyển thành thuộc tính tier).
   - Chỉ gửi field khi tier khai — request của các luồng hiện tại **byte-for-byte như cũ**.
4. **`GradingModelConfig` trở thành adapter** đọc `LlmTierResolver` (giữ nguyên public API `model()` — `GradingService`/`TeacherAiGradingService`/lead-magnet không phải sửa).

### Rủi ro & kiểm soát
- Rủi ro chính: đụng client dùng chung mọi luồng. Kiểm soát: phase này **không đổi giá trị nào** — tiers khai đúng model hiện tại; stub-server IT sẵn có của GroqChatClient assert request body không đổi cho luồng cũ.
- Acceptance: toàn bộ IT xanh; log khởi động in bảng tier; grep không còn call site nào truyền chuỗi model cứng ngoài resolver.

**Cỡ: M** (1 PR).

---

## KHU VỰC B — Route từng chức năng theo bảng quyết định

### Vì sao
Đây là phần "trả nợ mis-route" + thi hành quyết định owner. Tách khỏi khu vực A để diff review được: A không đổi hành vi, B đổi hành vi có chủ đích, mỗi dòng route là một quyết định đã duyệt.

### Làm gì (từng luồng, model GIAI ĐOẠN ĐẦU trong ngoặc — flip Haiku/Sonnet ở khu vực F)

| Luồng | File sửa | Tier | Model P2 → sau F |
|---|---|---|---|
| Mock exam eval | `AiSpeakingMockExamController:101` | GRADING_EXAM | 120b → Haiku 4.5 |
| Sprechen Teil 2 (call chấm dòng 134) | `SprechenTeil2Service` | GRADING_EXAM | 120b → Haiku 4.5 |
| Grammar exam eval (2 call) | `AiExamEvaluatorService:53,177` | GRADING_EXAM | 120b → Haiku 4.5 |
| Chấm hội thoại + chấm PV | `ConversationEvaluationService`, `InterviewEvaluationService` | GRADING_DAILY | 120b → Haiku 4.5 (quyết định #3; giữ tier riêng làm đòn bẩy) |
| Chấm essay + rubric GV B2B | qua `GradingModelConfig` (adapter tự trỏ GRADING_EXAM) | GRADING_EXAM | 120b → Haiku 4.5 |
| Placement test | `PlacementTestService` — **đổi inject `GroqChatClient` → `OpenAiChatClient` + resolver** | GRADING_EXAM | 120b → Haiku 4.5 |
| Giải thích lỗi | `AiTextService` | EXPLAIN | 120b → Haiku 4.5 |
| Sinh nội dung node + bài luyện | `SkillTreeService:460,1102,1243`, `PracticeNodeService:168,194` — bỏ inject trực tiếp | CONTENT | 120b → Sonnet 4.6 (chỉ ảnh hưởng lần sinh MỚI; regen ở khu vực H) |
| Tag từ vựng | `VocabularyAutoTaggingService` | BATCH | 120b (quyết định #10 — chốt luôn ở P2) |
| Chat lượt/greeting/interview | `ChatPrepService`/`ChatCompletionService` | CHAT_FREE (CHAT_PAID ở khu vực G) | 20b giữ nguyên |
| Sinh câu hỏi PV, helpers, weekly, dịch VI | — | không đổi (quyết định #14, #11) | 20b |

- **Khoá giáo án (#9):** flag `app.features.teacher-lesson-plan.enabled:false` → controller trả 403 mã lỗi riêng; FE ẩn nút + key i18n ×3 locale (teacher.\*). Làm trong PR riêng nhỏ vì đụng FE.

### Rủi ro & kiểm soát
- 6 luồng đổi 20b→120b ngay tại P2: chi phí tăng nhẹ (~×2 đơn giá trên token ít), chất lượng chấm tăng — đây là fix nợ, không cần chờ calibration (120b đã là chuẩn của chấm essay từ trước).
- `SkillTreeService`/`PracticeNodeService` đổi kiểu inject: cần IT xác nhận contentHash cache không bị regenerate ngoài ý muốn (model chưa đổi ở P2 nên hash prompt không đổi).
- Acceptance: bảng "luồng → tier → model" in được từ actuator/log; 0 call site còn `chatCompletion(.., null, ..)` ở luồng chấm.

**Cỡ: M** (1–2 PR). 

---

## KHU VỰC C — Pipeline thẩm định errors (#2, Gemini 2.5 Flash)

### Vì sao
`errors`/`suggestions` sinh từ 20b effort=low trong cùng call SSE rồi `TurnEvaluatorService` ghi thẳng vào `UserGrammarError` + lịch ôn — correction bịa được SRS bắt ôn lại nhiều lần (tiền lệ PR #210 chỉ vá prompt). Quyết định #2: Gemini 2.5 Flash làm trọng tài.

### Thiết kế
1. **Điểm chèn:** sau `AiResponseParser` cho ra `AiParseOutcome`, TRƯỚC `TurnEvaluatorService.recordTurn` + `GrammarPersistenceService`. Lời thoại (`content`/`ai_speech_de`) đi SSE ngay như cũ — verify KHÔNG chặn stream.
2. **Call verify:** tier `ERROR_VERIFY` (`google/gemini-2.5-flash` qua OpenRouter), input = câu user + danh sách errors 20b đề xuất + CEFR, output JSON `{confirmed: [...], rejected: [...]}`, max ~300 tok. **Chỉ gọi khi errors ≠ rỗng** (mitigation đã nêu: −40–60% call).
3. **Rollout 2 nấc:**
   - **Nấc 1 — SHADOW (1 tuần):** verify chạy async, KHÔNG đổi hành vi user; log tỉ lệ Gemini bác lỗi của 20b (metric `speaking.correction.rejected.rate`). Đây là số liệu quyết định nấc 2 và là bằng chứng "20b bịa bao nhiêu %".
   - **Nấc 2 — ENFORCE:** chỉ persist + hiển thị correction đã confirmed. FE: card sửa lỗi render theo SSE event mới `corrections_verified` (đến trễ 1–2s sau lời thoại). Fail-mode khi Gemini lỗi/timeout 5s: **fail-open có đánh dấu** (persist như cũ, flag `unverified`) — không để sự cố Gemini làm mất tính năng sửa lỗi.
4. Chạy trên executor riêng (như `speakingStreamExecutor`) hoặc tái dùng hàng đợi `AiJobWorker` — quyết khi implement, thiên về executor cho đơn giản.

### Rủi ro & kiểm soát
- UX "AI rút lời sửa": tránh hẳn nhờ enforce = chỉ-hiển-thị-đã-confirm (card không bao giờ xuất hiện rồi biến mất).
- Chi phí: ~22đ/lượt-có-lỗi; shadow mode cho số thật trước khi cam kết.
- Acceptance nấc 1: dashboard tỉ lệ reject; nấc 2: e2e — lượt có lỗi hiện card sau lời thoại, lượt Gemini bác không ghi `UserGrammarError`.

**Cỡ: M–L** (BE M + FE S). 

---

## KHU VỰC D — STT hai tầng (#12, #13)

### Vì sao
STT là khoản chi lớn nhất mỗi lượt; transcript hội thoại chịu được turbo, nhưng transcript cascades vào correction nên phải đo trước — không flip mù.

### Làm gì
1. Property mới `app.ai.groq.whisper-transcript-model` (default **large-v3** — chưa đổi hành vi) bên cạnh `whisper-model` hiện tại (đổi tên vai trò thành scoring). `PhonemeService`/`PronunciationScorerService` → scoring model; transcribe chat/PV → transcript model.
2. Script đo WER: ~50 audio thật từ prod (giọng Việt nói Đức, ngập ngừng), chạy song song large-v3 vs turbo, báo cáo WER + diff các câu lệch. **Gate: chênh ≤1% tuyệt đối → owner duyệt flip env `whisper-transcript-model=whisper-large-v3-turbo`.**

**Cỡ: S** (property + wiring) **+ S** (script đo). 

---

## KHU VỰC E — Ledger, giá, nhãn (làm cùng A/B)

### Vì sao
Mọi call mới không có rate trong `AiCostEstimator` sẽ rơi vào DEFAULT ($0.20/$0.20) → dashboard COGS sai đúng lúc cần theo dõi nhất (đang tăng chi phí có chủ đích).

### Làm gì
1. Thêm `ModelRate` cho: Haiku 4.5 ($1/$5), Sonnet 4.6 ($3/$15), Gemini 2.5 Flash, Cerebras gpt-oss-120b ($0.35/$0.75) — **xác nhận bảng giá hiện hành trước khi commit số**.
2. Khi đi OpenRouter: đọc **cost thật** từ response (`usage.include=true`) ghi vào ledger thay vì ước theo bảng — bảng chỉ còn là fallback.
3. Sửa nhãn `gemini-1.5-flash` → `gemini-2.5-flash` tại `TeacherLessonPlanService:222` (dù chức năng bị khoá — ledger cũ vẫn hiển thị).
4. Sửa `WHISPER_USD_PER_SEC` theo giá Groq thật sau xác nhận (hiện $0.006/phút là giá OpenAI, nghi vống ~3×).

**Cỡ: S.**

---

## KHU VỰC F — Calibration rồi mới flip Haiku/Sonnet

### Vì sao
Đổi trọng tài chấm là đổi phân phối điểm — học viên/GV sẽ thấy điểm "khác tuần trước". Flip không calibration = gánh khiếu nại không có số liệu trả lời.

### Làm gì
1. Mở rộng `/api/admin/grading-eval`: chấm lại ~100 bài đã lưu (trộn Schreiben/Sprechen/grammar-exam đủ level) bằng cả 120b lẫn Haiku 4.5 qua tier config; báo cáo offset trung bình, phân tán, các bài lệch >1 band.
2. Owner duyệt báo cáo → flip config: `GRADING_EXAM`/`GRADING_DAILY`/`EXPLAIN` → `anthropic/claude-haiku-4.5`; `CONTENT` → `anthropic/claude-sonnet-4.6`. Ghi release note về thay đổi thang điểm nếu offset đáng kể.
3. Flip base-url sang OpenRouter theo thứ tự tier: BATCH → CONTENT → GRADING_* → EXPLAIN → CHAT_* (mỗi bước quan sát 2–3 ngày qua ledger + error rate). Tier nào có model ngoài-Groq thì flip base-url là điều kiện tiên quyết của flip model.

**Cỡ: S code + công chạy/duyệt.**

---

## KHU VỰC G — Chat PAID qua Cerebras (#1) + sticky/fallback

### Vì sao
Điểm bán gói trả phí; cần plan-gating vì model đắt ×4.

### Làm gì
1. `ChatPrepService`/`ChatCompletionService`: resolve tier theo `planCode` từ `QuotaService` (FREE→CHAT_FREE, PRO/ULTRA/INTERNAL→CHAT_PAID). Cache theo phiên để không query quota mỗi lượt.
2. `CHAT_PAID` = `openai/gpt-oss-120b`, base-url OpenRouter, `provider.order=[cerebras]`, `require_parameters=true`, sticky `session_id = "spk-{sessionId}"`.
3. Fallback: khi tier PAID lỗi (breaker/model unavailable) → tự hạ về CHAT_FREE trong lượt đó (degrade êm, log + metric) — user trả phí thà nhận 20b còn hơn 503.
4. Kiểm chứng schema V1/V2 + reasoning trên Cerebras bằng contract test (họ hỗ trợ gpt-oss + JSON mode nhưng phải test hành vi thật, nhất là `reasoning_effort`).

### Rủi ro
- Persona 2 gói khác giọng — chủ đích (điểm bán), ghi vào marketing copy.
- Acceptance: e2e 2 account FREE/PRO thấy model khác nhau trong ledger; kill-switch env đưa PAID về 20b.

**Cỡ: M.**

---

## KHU VỰC H — Regen cây học tập bằng Sonnet (one-off, cuối cùng)

### Vì sao
Nội dung cache là lỗi có hệ số nhân lớn nhất; sinh bằng Sonnet 4.6 + thẩm định chéo trước khi cache; chi phí một lần ~$30–40.

### Làm gì
1. Admin batch command: iterate node → sinh bằng CONTENT tier → **verifier pass** (Gemini 2.5 Flash chấm đúng/sai ngữ pháp + khớp CEFR, JSON pass/fail + lý do) → pass mới ghi đè cache (contentHash mới); fail đưa vào danh sách rà tay.
2. Chạy theo level (A1 trước), owner rà mẫu ~10 node/level trước khi chạy level tiếp.
3. Node đang có user học không bị đổi giữa phiên (cache swap nguyên tử theo node).

**Cỡ: M one-off.**

---

## TRÌNH TỰ PHASE & ĐIỀU KIỆN QUA PHASE

| Phase | Gồm | Điều kiện vào | Hành vi user đổi? |
|---|---|---|---|
| P0 (owner, ngay) | Keys OpenRouter/Anthropic/Cerebras + billing; kiểm env llama-3.3 trước 16/08 | — | Không |
| P1 | Khu vực A + E | P0 xong (key chưa cần dùng) | **Không** (zero-change) |
| P2 | Khu vực B (route, model = 120b/hiện trạng) + khoá giáo án | P1 merged + IT xanh | Chấm chính xác hơn (6 luồng 20b→120b); giáo án khoá |
| P3 | Khu vực F (calibration → flip Haiku/Sonnet + flip OpenRouter từng tier) | Báo cáo calibration được duyệt | Điểm chấm đổi phân phối (có release note) |
| P4 | Khu vực C (shadow → enforce) + G (PAID Cerebras) + D (đo WER → flip) | P3 ổn định 1 tuần | Card sửa lỗi trễ 1–2s; PAID persona mới |
| P5 | Khu vực H (regen cây) | P3 xong (CONTENT tier = Sonnet) | Nội dung bài học mới |

Mỗi phase một (vài) PR riêng, e2e + IT xanh trước merge, deploy theo quy trình worktree `DeutschFlow-deploy` hiện hành, soi SHA ở log `[2/6] Pull code`.

## ĐIỂM CẦN OWNER QUYẾT KHI DUYỆT PLAN

1. ✅/❌ Tách `GRADING_EXAM`/`GRADING_DAILY` (cả hai = Haiku theo quyết định #3, tách chỉ để giữ đòn bẩy config).
2. ✅/❌ Shadow mode 1 tuần cho verify errors trước khi enforce (khuyến nghị mạnh: có).
3. ✅/❌ Fail-open có đánh dấu khi Gemini verify lỗi (thay vì chặn correction).
4. ✅/❌ PAID degrade về 20b khi Cerebras sự cố (thay vì báo lỗi).
5. Ngưỡng WER 1% cho STT turbo — giữ hay nới?
