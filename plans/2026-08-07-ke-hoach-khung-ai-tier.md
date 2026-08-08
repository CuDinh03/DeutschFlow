# KẾ HOẠCH: KHUNG AI TIER + ROUTE MODEL THEO QUYẾT ĐỊNH 06/08

**Ngày:** 2026-08-07 · **Trạng thái:** ĐÃ DUYỆT — **CẬP NHẬT LỚN 09/08 (Fireworks-only, xem khung dưới)** · **Căn cứ:** `BAO_CAO_DE_XUAT_MODEL_TOAN_HE_THONG_2026-08-06.md` (Phần III) + **`BAO_CAO_LUA_CHON_MODEL_FIREWORKS_2026-08-09.md` (ma trận model thay thế, đã chốt)**

**Nguyên tắc xuyên suốt:** mỗi phase tự đứng được, phase sau flip bằng config/env chứ không deploy code mới; mọi thay đổi model đều đi qua bảng tier để về sau "xoay model = sửa 1 dòng yaml".

---

## ⚠️ CẬP NHẬT 09/08/2026 — BỎ OPENROUTER, FIREWORKS LÀ NHÀ CUNG CẤP DUY NHẤT

Đã flip prod sang Fireworks (#310, #311); quyết định owner (6) bỏ OpenRouter ⇒ **mọi tham chiếu OpenRouter/Haiku/Sonnet/Gemini/Cerebras trong các khu vực C/E/F/G/H dưới đây là LỖI THỜI** — giữ nguyên văn làm bối cảnh, đối chiếu bảng chốt này (owner duyệt 09/08, chi tiết + giá trong `BAO_CAO_LUA_CHON_MODEL_FIREWORKS_2026-08-09.md`):

| # | Quyết định 09/08 | Chốt |
|---|---|---|
| 7 | **Chấm (GRADING_EXAM + GRADING_DAILY):** hướng 3 — F1 calibration ~100 bài, 120b (baseline) vs **DeepSeek V4 Flash**; chỉ flip khi thắng rõ precision/recall. **THU HẸP bởi #14 (09/08 tối): bỏ Qwen 3.7 Plus + Kimi K2.6** khỏi đợt đo, và phải chạy ở `maxTokens=3000` (ở 800 tok mọi ứng viên đều cụt JSON). EXPLAIN đo cùng đợt | ⚠️ thu hẹp |
| 8 | **ERROR_VERIFY = DeepSeek V4 Flash** (temp 0, ~300 tok) — nguyên tắc model verify phải KHÁC HỌ model sinh; shadow 1 tuần giữ nguyên (quyết định #2) | ✅ |
| 9 | ~~**CONTENT = Kimi K2.6** cho lần sinh mới~~ → **SỬA bởi #15 (09/08 tối)**: đường sinh-khi-unlock GIỮ 20b (K2.6 trả RỖNG ở ngân sách 1024 tok, và 32–41s/node thì học viên không chờ); K2.6 chỉ cho sinh TRƯỚC theo lô. **regen P5 = Kimi K3** (~$6/144 node) và verifier pass của H = V4 Flash: giữ nguyên | ⚠️ sửa |
| 10 | **CHAT_PAID = gpt-oss-120b@Fireworks CÓ ĐIỀU KIỆN**: đo TTFT chế độ STREAM trước (G1.4); đạt <1,5s mới ship G. **Đo 09/08 tối: trung vị 1,29s / max 1,88s / 4-12 lượt vượt** — nhưng đo từ máy owner nên #16 hoãn chốt tới khi đo lại TỪ EC2 | ⚠️ chờ #16 |
| 11 | **STT:** đo D1.3 (WER turbo vs whisper-v3, ~50 audio prod) rồi quyết; chênh ≤1% ⇒ đóng mục D, giữ turbo cả 2 tầng | ✅ |
| 12 | **BATCH + weekly rubric → Fireworks Batch API (−50%)**, ticket riêng SAU khi FW.1–FW.6 nghiệm thu sạch | ✅ |
| 13 | **Placement:** chưa tách — đi chung GRADING_EXAM, chờ số F1 rồi mới cân nhắc override riêng (ứng viên K3 nếu cần) | ✅ |

Nhóm real-time **không đổi**: CHAT_FREE = `gpt-oss-20b` effort=low, STT transcript = `whisper-v3-turbo`, sinh câu hỏi PV + helpers = 20b, TTS giữ nguyên.

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

## KHU VỰC C — Pipeline thẩm định errors (#2, ~~Gemini 2.5 Flash~~ → **DeepSeek V4 Flash, quyết định #8 09/08**)

> **⚠️ 09/08:** mọi chỗ ghi "Gemini 2.5 Flash qua OpenRouter" dưới đây đọc thành **`ERROR_VERIFY` = DeepSeek V4 Flash @Fireworks** (khác họ với 20b sinh lỗi — giữ được tính trọng tài độc lập). Thiết kế 2 nấc shadow→enforce, fail-open `unverified`, timeout 5s: GIỮ NGUYÊN.

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

> **⚠️ 09/08 — hiện trạng ĐẢO NGƯỢC giả định:** sau flip Fireworks, CẢ HAI tầng (transcript + chấm phát âm) đang chạy `whisper-v3-turbo` (QA đọc-đúng 100/100, prod không khiếu nại). Mục D đổi mục tiêu thành **"có đáng tách tầng CHẤM về `whisper-v3` thường không"** — quyết định #11: chạy D1.3 đo WER ~50 audio prod, chênh ≤1% thì ĐÓNG mục D. Lưu ý Fireworks tách host theo model (`audio-turbo...` vs `audio-prod...`) nên nếu tách tầng thì property phải kèm base-url theo model.

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
1. ~~Thêm `ModelRate` cho Haiku/Sonnet/Gemini/Cerebras~~ → **09/08:** thêm `ModelRate` cho các ứng viên Fireworks (giá Standard, xác nhận docs.fireworks.ai 09/08): **DeepSeek V4 Flash $0.14/$0.28 · Qwen 3.7 Plus $0.40/$1.60 · Kimi K2.6 $0.95/$4.00 · Kimi K3 $3.00/$15.00 · MiniMax M3 $0.30/$1.20** (rate Haiku/Sonnet/Gemini đã thêm ở P1 giữ lại vô hại).
2. ~~Khi đi OpenRouter: đọc cost thật từ `usage.include`~~ → **09/08:** Fireworks không trả `usage.cost` kiểu OpenRouter — ledger tính theo bảng `ModelRate` + `cached_tokens` (cached input = 50% giá với 20b, 10% với 120b; lấy từ `usage.prompt_tokens_details`).
3. Sửa nhãn `gemini-1.5-flash` → `gemini-2.5-flash` tại `TeacherLessonPlanService:222` (dù chức năng bị khoá — ledger cũ vẫn hiển thị).
4. Sửa `WHISPER_USD_PER_SEC` theo giá Groq thật sau xác nhận (hiện $0.006/phút là giá OpenAI, nghi vống ~3×).

**Cỡ: S.**

---

## KHU VỰC F — Calibration rồi mới flip (~~Haiku/Sonnet~~ → **ứng viên Fireworks, quyết định #7/#9 09/08**)

### Vì sao
Đổi trọng tài chấm là đổi phân phối điểm — học viên/GV sẽ thấy điểm "khác tuần trước". Flip không calibration = gánh khiếu nại không có số liệu trả lời.

### Làm gì (viết lại 09/08)
1. Mở rộng `/api/admin/grading-eval`: chấm lại ~100 bài đã lưu (trộn Schreiben/Sprechen/grammar-exam đủ level) bằng **120b (baseline) vs DeepSeek V4 Flash vs Qwen 3.7 Plus vs Kimi K2.6** qua tier config; báo cáo offset trung bình, phân tán, các bài lệch >1 band + precision/recall phát hiện lỗi (đối chiếu nhãn `user_grammar_errors`). EXPLAIN đo cùng đợt (ứng viên V4 Flash).
2. Owner duyệt báo cáo → flip config: `GRADING_EXAM`/`GRADING_DAILY` → model thắng (V4 Flash thắng thì vừa nâng chất vừa **giảm** chi phí ~15đ vs 22đ/bài); không ai thắng rõ ⇒ ở lại 120b (hướng 1 là mặc định an toàn). `CONTENT` → **Kimi K2.6** (quyết định #9, không cần chờ F1 — nội dung sinh-một-lần-rồi-cache, chi phí khấu hao ~0). Ghi release note nếu offset đáng kể.
3. ~~Flip base-url sang OpenRouter theo thứ tự tier~~ — **HUỶ** (một endpoint Fireworks duy nhất, không còn gì để flip). Thay bằng: **contract test (script `qa_fw.py` chính thức hoá — F2.4)** bắn request mẫu có `response_format` vào từng tier mỗi lần đổi model; model ngoài họ gpt-oss nhớ đặt `AI_LLM_TIER_*_EFFORT=` rỗng (bài học FW.7).

**Cỡ: S code + công chạy/duyệt.**

---

## KHU VỰC G — Chat PAID ~~qua Cerebras~~ → **120b@Fireworks CÓ ĐIỀU KIỆN (quyết định #10 09/08)**

### Vì sao
Điểm bán gói trả phí; cần plan-gating vì model đắt ×4.

> **⚠️ 09/08:** Cerebras chỉ tới được qua OpenRouter — đóng đường. Thay bằng `gpt-oss-120b` cùng nhà Fireworks (cùng endpoint, cùng họ ⇒ JSON contract byte-compatible, degrade PAID→FREE không lệch giọng). **Điều kiện tiên quyết: G1.4 đo TTFT chế độ STREAM của 120b đạt <1,5s** (bench 08/08 chỉ có 3,4s non-stream — chưa đủ để hứa real-time); không đạt ⇒ HOÃN cả khu vực G, PAID tạm = FREE, phân biệt gói bằng quota/tính năng.

### Làm gì
1. `ChatPrepService`/`ChatCompletionService`: resolve tier theo `planCode` từ `QuotaService` (FREE→CHAT_FREE, PRO/ULTRA/INTERNAL→CHAT_PAID). Cache theo phiên để không query quota mỗi lượt.
2. `CHAT_PAID` = `accounts/fireworks/models/gpt-oss-120b` + `reasoning-effort: low` (cùng endpoint Fireworks — `provider.order`/`require_parameters`/sticky là field OpenRouter, BỎ).
3. Fallback: khi tier PAID lỗi (breaker/model unavailable) → tự hạ về CHAT_FREE trong lượt đó (degrade êm, log + metric `chat_paid_degraded_total`) — user trả phí thà nhận 20b còn hơn 503.
4. Kiểm chứng schema V1/V2 + JSON mode + **TTFT stream (điều kiện tiên quyết ở khung trên)** bằng contract test.

### Rủi ro
- Persona 2 gói khác giọng — chủ đích (điểm bán), ghi vào marketing copy.
- Acceptance: e2e 2 account FREE/PRO thấy model khác nhau trong ledger; kill-switch env đưa PAID về 20b.

**Cỡ: M.**

---

## KHU VỰC H — Regen cây học tập bằng ~~Sonnet~~ **Kimi K3 (quyết định #9 09/08)** (one-off, cuối cùng)

### Vì sao
Nội dung cache là lỗi có hệ số nhân lớn nhất; sinh bằng **Kimi K3** (frontier-class trên Fireworks, $3/$15) + thẩm định chéo trước khi cache; chi phí một lần **~$6 cho 144 node** (~3K in/2K out mỗi node — rẻ hơn hẳn dự toán Sonnet $30–40 cũ).

### Làm gì
1. Admin batch command: iterate node → sinh bằng CONTENT tier (env tạm trỏ K3 cho đợt regen; sinh thường nhật sau đó quay về K2.6) → **verifier pass** (~~Gemini 2.5 Flash~~ → **DeepSeek V4 Flash** — khác họ với K2/K3, chấm đúng/sai ngữ pháp + khớp CEFR, JSON pass/fail + lý do) → pass mới ghi đè cache (contentHash mới); fail đưa vào danh sách rà tay.
2. Chạy theo level (A1 trước), owner rà mẫu ~10 node/level trước khi chạy level tiếp.
3. Node đang có user học không bị đổi giữa phiên (cache swap nguyên tử theo node).

**Cỡ: M one-off.**

---

## TRÌNH TỰ PHASE & ĐIỀU KIỆN QUA PHASE

| Phase | Gồm | Điều kiện vào | Hành vi user đổi? |
|---|---|---|---|
| P0 (owner, ngay) | ~~Keys OpenRouter/Anthropic/Cerebras~~ → **09/08: FW.1 deploy + FW.3 Auto Reload + FW.4 revoke key Groq lộ**; kiểm env llama-3.3 hết ý nghĩa (đã rời Groq) | — | Không |
| P1 | Khu vực A + E | ✅ XONG (#306) | **Không** (zero-change) |
| P2 | Khu vực B (route, model = 120b/hiện trạng) + khoá giáo án | ✅ XONG (#307/#308/#309) | Chấm chính xác hơn; giáo án khoá |
| P3 | Khu vực F (F1 calibration ứng viên Fireworks → flip GRADING_*; CONTENT → K2.6 không cần chờ) | FW.1–FW.6 nghiệm thu sạch; báo cáo calibration được duyệt | Điểm chấm đổi phân phối (có release note) |
| P4 | Khu vực C (verify = V4 Flash, shadow → enforce) + G (PAID 120b, điều kiện TTFT stream) + D (D1.3 đo WER → quyết) + **Batch API −50% (quyết định #12, ticket riêng)** | P3 ổn định 1 tuần | Card sửa lỗi trễ 1–2s; PAID persona mới (nếu G ship) |
| P5 | Khu vực H (regen cây bằng K3, verifier V4 Flash) | P3 xong (CONTENT tier = K2.6) | Nội dung bài học mới |

Mỗi phase một (vài) PR riêng, e2e + IT xanh trước merge, deploy theo quy trình worktree `DeutschFlow-deploy` hiện hành, soi SHA ở log `[2/6] Pull code`.

## ĐIỂM CẦN OWNER QUYẾT KHI DUYỆT PLAN

**Đợt 1 — đã chốt 07/08:**
1. ✅ Tách `GRADING_EXAM`/`GRADING_DAILY` (tách để giữ đòn bẩy config).
2. ✅ Shadow mode 1 tuần cho verify errors trước khi enforce.
3. ✅ Fail-open có đánh dấu `unverified` khi verify lỗi (thay vì chặn correction).
4. ✅ PAID degrade về 20b khi model PAID sự cố (thay vì báo lỗi).
5. ✅ Ngưỡng WER 1% cho STT — giữ.

**Đợt 2 — đã chốt 09/08 (sau flip Fireworks, bỏ OpenRouter):**
6. ✅ Bỏ OpenRouter — Fireworks là nhà cung cấp duy nhất.
7. ✅ Chấm: hướng 3 — F1 calibration (120b baseline vs V4 Flash vs Qwen 3.7 Plus vs K2.6) rồi mới flip; không ai thắng rõ thì ở lại 120b.
8. ✅ ERROR_VERIFY = DeepSeek V4 Flash (khác họ model sinh).
9. ✅ CONTENT = Kimi K2.6 ngay; regen P5 = Kimi K3 (~$6), verifier = V4 Flash.
10. ✅ CHAT_PAID = 120b@Fireworks có điều kiện TTFT stream <1,5s; không đạt thì hoãn G.
11. ✅ STT: đo D1.3 rồi quyết; ≤1% thì đóng mục D, giữ turbo cả 2 tầng.
12. ✅ BATCH + weekly → Fireworks Batch API (−50%), ticket riêng sau FW sạch.
13. ✅ Placement: chưa tách, chờ số F1 (ứng viên K3 nếu cần override riêng).

**Đợt 3 — chốt 09/08 TỐI, sau khi contract-test đo thật (`BAO_CAO_CONTRACT_TEST_TIER_2026-08-09.md`). Đợt này THU HẸP #7 và SỬA #9:**
14. ✅ **F1 chỉ đo `deepseek-v4-flash` @ `maxTokens=3000`** vs 120b baseline. Bỏ `qwen3p7-plus` (cần cùng 3000 tok mà đắt 4× ở đầu output) và bỏ `kimi-k2p6` khỏi tầng chấm (27–43s/bài, biên an toàn 2%). Tinh thần #7 giữ nguyên — calibrate rồi mới flip — chỉ còn 1 ứng viên.
15. ✅ **CONTENT tách 2 đường** (sửa #9): đường sinh-khi-unlock **giữ 20b**; K2.6 chỉ cho sinh TRƯỚC theo lô + regen P5. Lý do: ở ngân sách 1024 tok thật của `SkillTreeService:1107,1248` K2.6 trả RỖNG 3/3 im lặng; ở 4096 tok chạy được nhưng 32–41s/node.
16. ✅ **CHAT_PAID: đo lại TTFT từ EC2 rồi mới chốt** (hoãn #10). Số 1,29s đo từ máy owner gồm RTT xuyên Thái Bình Dương; EC2 (us-east-1) cùng vùng với Fireworks (us-virginia-1) nên thực tế phải nhanh hơn.
17. ✅ **Ledger đọc `cached_tokens` — làm ngay, PR riêng** (E.6 mới trong checklist): cache hit ~99% ở cả 8 tier, cached-in chỉ 10% giá input với 120b ⇒ COGS chat đang khai vống ~3×.
