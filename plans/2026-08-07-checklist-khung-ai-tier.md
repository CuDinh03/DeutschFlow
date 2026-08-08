# CHECKLIST THI CÔNG: KHUNG AI TIER + ROUTE MODEL

**Ngày tạo:** 2026-08-07 · **Kế hoạch gốc:** `plans/2026-08-07-ke-hoach-khung-ai-tier.md` · **Trạng thái:** ĐÃ DUYỆT 07/08 — P1 đang chạy

## 📊 DASHBOARD TRẠNG THÁI

| Phase | Nội dung | Trạng thái | PR | Deploy |
|---|---|---|---|---|
| P0 | Owner: keys + env llama-3.3 | ⬜ CHƯA | — | — |
| P1 | Khung tier (A) + ledger/giá (E) | 🔄 CHỜ CI + owner duyệt merge | [#306](https://github.com/CuDinh03/DeutschFlow/pull/306) | — |
| P2 | Route luồng (B) + khoá giáo án | 🔄 B1–B4 lên PR (chờ P1 merge + CI); B5 giáo án CHƯA | [#307](https://github.com/CuDinh03/DeutschFlow/pull/307) | — |
| P3 | Calibration + flip Haiku/Sonnet/OpenRouter (F) | ⬜ CHƯA | — | — |
| P4 | Verify errors (C) + PAID Cerebras (G) + STT (D) | ⬜ CHƯA | — | — |
| P5 | Regen cây học tập (H) | ⬜ CHƯA | — | — |

**Quyết định đã chốt 07/08:** (1) tách GRADING_EXAM/GRADING_DAILY ✅ · (2) shadow 1 tuần verify errors ✅ · (3) fail-open đánh dấu `unverified` ✅ · (4) PAID degrade về 20b ✅ · (5) ngưỡng WER 1% giữ nguyên ✅

Ký hiệu: ⬜ chưa làm · 🔄 đang làm · ✅ xong · ⛔ chặn (ghi lý do) · 👤 việc của owner

---

## P0 — TIỀN ĐỀ (OWNER) — làm được ngay, song song mọi thứ

- [ ] 👤 P0.1 Kiểm env EC2 prod: `printenv | grep -E 'GROQ_MODEL|GROQ_GRADING_MODEL'` — xác nhận KHÔNG ghim `llama-3.3-70b-versatile` (Groq khai tử **16/08**). Nếu có → xoá override, restart theo quy trình deploy (nhớ: `docker restart` KHÔNG đọc lại `--env-file`).
- [ ] 👤 P0.2 Tạo tài khoản + key OpenRouter, nạp credit ban đầu (~$20), bật ZDR trong privacy settings. Lưu key vào chỗ quản lý secret của deploy (KHÔNG commit — repo PUBLIC).
- [ ] 👤 P0.3 Xác nhận trên OpenRouter có đủ 4 model: `openai/gpt-oss-20b`, `openai/gpt-oss-120b` (provider groq + cerebras còn hoạt động), `anthropic/claude-haiku-4.5`, `anthropic/claude-sonnet-4.6`, `google/gemini-2.5-flash` — chụp bảng giá hiện hành từng model (input/output per 1M) gửi vào issue/chat để E dùng.
- [ ] 👤 P0.4 Xác nhận giá Groq Whisper hiện hành: `whisper-large-v3` ($/giờ) và `whisper-large-v3-turbo` — cho E.4 và D.
- [ ] 👤 P0.5 Nâng Groq Dev tier (việc treo từ 04/08) — độc lập với plan nhưng gỡ trần 8K TPM cho FREE tier vẫn chạy Groq trực tiếp.

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
- [ ] E.4 Sửa `WHISPER_USD_PER_SEC` theo giá xác nhận ở P0.4 (kèm comment nguồn + ngày tra).
- [x] E.5 Sửa nhãn `"gemini-1.5-flash"` → `"gemini-2.5-flash"` tại `TeacherLessonPlanService:222`.

### Nghiệm thu P1
- [x] P1.V1 `./mvnw verify` xanh (IT chạy với `DEUTSCHFLOW_IT_REQUIRE_DB=true`).
- [ ] P1.V2 Log khởi động in bảng 8 tier đúng model hiện trạng.
- [x] P1.V3 Diff request body (stub IT) các luồng hiện hữu = 0 thay đổi.
- [x] P1.V4 PR mô tả rõ "zero behavior change" + checklist này cập nhật dashboard.
- [ ] 👤 P1.V5 Owner duyệt merge → deploy → smoke test 1 lượt chat + 1 bài chấm trên prod, soi ledger ghi đúng model.

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

**B2. AiTextService → EXPLAIN**
- [x] B2.1 `AiTextService.complete(...)` truyền `spec(EXPLAIN)` cho correction + explanation (generate() helper khác giữ default nếu là luồng nói).
- [x] B2.2 Xác nhận không đụng latency SSE (AiTextService là REST đồng bộ, không stream).

**B3. Curriculum bỏ inject trực tiếp**
- [x] B3.1 `PlacementTestService`: hoá ra field `groqChatClient` là INJECT CHẾT (không có call LLM nào) → đã gỡ field + import; không có gì để route.
- [x] B3.2 `SkillTreeService` (3 call site 460/1102/1243): → `OpenAiChatClient` + `spec(CONTENT)`.
- [x] B3.3 `PracticeNodeService` (168/194): → `spec(CONTENT)`.
- [ ] B3.4 IT: contentHash cache KHÔNG regenerate (model P2 chưa đổi ⇒ hash prompt không đổi) — assert node cũ giữ nguyên sau deploy.
- [ ] B3.5 Kiểm tra `AiCacheService`/`SkillTreeController` không còn tham chiếu kiểu `GroqChatClient` cụ thể.

**B4. Vocab tagging → BATCH**
- [x] B4.1 `VocabularyAutoTaggingService:191` → `spec(BATCH)` (=120b, quyết định #10 chốt tại P2).
- [ ] B4.2 Chạy thử 1 batch nhỏ (~50 từ) staging, so sánh tag trước/sau bằng mắt.

**B5. Khoá giáo án (#9) — PR riêng**
- [ ] B5.1 BE: flag `app.features.teacher-lesson-plan.enabled:false` → endpoint trả 403 + error code `FEATURE_DISABLED`.
- [ ] B5.2 FE: ẩn nút/route theo flag (đọc từ API config sẵn có của FE nếu có, không thì hardcode ẩn).
- [ ] B5.3 i18n: key thông báo "tính năng tạm khoá" ×3 locale (`teacher.*.json` — nhớ đủ CẢ 3, checker parity mù khi thiếu cả 3).
- [ ] B5.4 e2e teacher: nút không hiện; gọi API trực tiếp nhận 403.

**Nghiệm thu P2**
- [ ] P2.V1 Grep toàn repo: `chatCompletion(.*null` chỉ còn ở luồng nói/helpers đúng thiết kế (danh sách trắng ghi trong PR).
- [ ] P2.V2 `./mvnw verify` + e2e speaking specs xanh.
- [ ] P2.V3 Ledger sau deploy: mock exam/grammar exam/teil2 ghi model 120b.
- [ ] 👤 P2.V4 Owner QA: 1 bài mock exam + 1 grammar exam trên prod, cảm quan chất lượng chấm.

---

## P3 — CALIBRATION & FLIP (Khu vực F)

**F1. Calibration harness**
- [ ] F1.1 Mở rộng `/api/admin/grading-eval`: nhận tham số tier/model list, chấm N bài đã lưu bằng từng model, xuất JSON/CSV (điểm, band, thời gian, cost).
- [ ] F1.2 Chọn tập ~100 bài: trộn Schreiben/Sprechen/grammar-exam, đủ A1–B1, lấy từ prod (ẩn danh).
- [ ] F1.3 Chạy 120b vs `anthropic/claude-haiku-4.5` (qua OpenRouter, tier config tạm trên staging).
- [ ] F1.4 Báo cáo: offset trung bình, độ phân tán, danh sách bài lệch >1 band kèm diff giải thích — file `BAO_CAO_CALIBRATION_CHAM_<ngày>.md`.
- [ ] 👤 F1.5 Owner duyệt báo cáo → quyết flip.

**F2. Flip OpenRouter theo tier (mỗi bước quan sát 2–3 ngày: error rate + ledger cost + latency)**
- [ ] F2.1 `BATCH.base-url` → OpenRouter (model giữ 120b, `provider.sort=price`). Quan sát.
- [ ] F2.2 `CONTENT.base-url` → OpenRouter. Quan sát.
- [ ] F2.3 `GRADING_EXAM` + `GRADING_DAILY` + `EXPLAIN` base-url → OpenRouter (`require_parameters=true`). Quan sát.
- [ ] F2.4 Contract test tự động (script curl) bắn request mẫu có `response_format` vào từng tier sau mỗi flip — JSON parse OK.

**F3. Flip model theo quyết định owner**
- [ ] F3.1 `GRADING_EXAM.model` → `anthropic/claude-haiku-4.5`.
- [ ] F3.2 `GRADING_DAILY.model` → `anthropic/claude-haiku-4.5` (đòn bẩy: nếu cost tháng đầu vượt ngân sách, owner có thể hạ riêng tier này về 120b bằng 1 env — ghi chú vận hành).
- [ ] F3.3 `EXPLAIN.model` → `anthropic/claude-haiku-4.5`.
- [ ] F3.4 `CONTENT.model` → `anthropic/claude-sonnet-4.6` (chỉ ảnh hưởng lần sinh mới; regen ở P5).
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

**G. Chat PAID qua Cerebras (quyết định: degrade về 20b ✅)**
- [ ] G1.1 `ChatPrepService`: resolve `CHAT_FREE`/`CHAT_PAID` theo `planCode` (QuotaService), cache trong prep của phiên.
- [ ] G1.2 `CHAT_PAID` config: `openai/gpt-oss-120b`, base-url OpenRouter, `provider.order=[cerebras]`, `require_parameters=true`, `session-sticky=true` (`session_id="spk-{sessionId}"`).
- [ ] G1.3 Degrade: breaker/model-unavailable/timeout trên tier PAID → chạy lại lượt bằng CHAT_FREE, log + metric `chat_paid_degraded_total`, KHÔNG 503.
- [ ] G1.4 Contract test Cerebras route: schema V1/V2 + JSON mode + kiểm tra `reasoning_effort` được chấp nhận/bỏ qua an toàn.
- [ ] G1.5 e2e 2 account FREE vs PRO: ledger ghi model khác nhau; kill-switch env `AI_LLM_TIER_CHAT_PAID_MODEL=openai/gpt-oss-20b` hoạt động.
- [ ] G1.6 Marketing/copy gói trả phí cập nhật (persona "não to") — phối hợp owner.

**D. STT hai tầng (quyết định: ngưỡng WER 1% giữ ✅)**
- [ ] D1.1 Property `app.ai.groq.whisper-transcript-model` (default `whisper-large-v3` — chưa đổi) + `whisper-scoring-model` (large-v3); `GroqWhisperClient` nhận model theo mục đích call.
- [ ] D1.2 Wiring: transcribe chat/PV → transcript-model; `PhonemeService` + `PronunciationScorerService` → scoring-model.
- [ ] D1.3 Script đo WER: ~50 audio prod ẩn danh (đủ giọng/nhiễu/ngập ngừng) chạy large-v3 vs turbo, xuất bảng WER + diff câu lệch.
- [ ] 👤 D1.4 Owner duyệt kết quả: chênh ≤1% tuyệt đối → flip env transcript-model=turbo; > 1% → giữ large-v3, đóng mục này.
- [ ] D1.5 Nếu flip: theo dõi 1 tuần tỉ lệ user sửa tay transcript (nếu có metric) / khiếu nại "nghe sai".

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
- [ ] X.4 Privacy policy 3 ngữ + DPA: thêm Google/Anthropic/Cerebras/OpenRouter làm sub-processor (làm trước khi ENFORCE C2 và flip G) — 👤 owner duyệt câu chữ.
- [ ] X.5 Sau mỗi deploy: soi SHA log `[2/6] Pull code`, đừng tin exit 0.
