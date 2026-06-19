# DEUTSCHFLOW — KHẮC PHỤC & NÂNG CẤP

> Tổng hợp từ `audit/pass1.md` → `pass4.md`. Tài liệu làm việc, không phải tóm tắt.
> Quy ước mức độ: 🔴 Nghiêm trọng / 🟠 Cao / 🟡 TB / ⚪ Thấp. Công sửa: S (giờ) / M (ngày) / L (tuần).
> KHÔNG chứa code vá — đây là bản đồ quyết định.

---

## 1. TÌNH TRẠNG DỰ ÁN

Phần xác thực và cách-ly-tenant của codebase **vững một cách bất ngờ**: re-verify ownership ở service-layer nhất quán, không tìm thấy lỗ hổng đọc-chéo-tenant trực tiếp, refresh-token có chống reuse. Nhưng **lõi monetization thì thủng**: chốt token-pool chỉ phủ ~5/24 đường gọi LLM, nhiều đường AI đắt tiền (kể cả một endpoint không hề kiểm tra cả role lẫn token — `AISpeakingController`) chảy thẳng ra Groq mà không ai đếm, và org-pool tính bằng `SUM(ledger)` nên về cấu trúc **mù** với phần lớn tiêu thụ — đây là rò rỉ biên lợi nhuận đang chảy theo mỗi khách mới. **Chưa an toàn để scale ngang**: SSE ticket (đường nói AI chính) lưu in-memory nên thêm node thứ 2 là hỏng, và `assertAllowed` ghi DB + chạy `SUM` không-index trên mỗi request AI. Mô hình dữ liệu có nợ cấu trúc: tenant có hai nguồn sự thật (`users.org_id` vs `org_members`) và bảng nghiệp vụ không mang `org_id`. Kết luận thẳng: **an toàn cho ~10 center hiện tại, sẽ vỡ về cả tiền lẫn hiệu năng trước khi tới 500** — phải bịt token-pool và bỏ state in-memory trước khi mở rộng.

---

## 2. BẢNG ƯU TIÊN TỔNG

Sắp xếp: Nghiêm trọng → Cao → TB → Thấp; trong cùng mức, công sửa nhỏ trước.
(ID kèm bí danh từ các pass khác nhau để truy vết.)

| ID | Vấn đề | Loại | Mức độ | Công | File:dòng | Thời điểm |
|---|---|---|---|---|---|---|
| **P-3** | `AISpeakingController` /api/speaking/ai/* — không @PreAuthorize, không token, không ledger | Khắc phục | 🔴 Nghiêm trọng | S | `AISpeakingController.java:35-90`; `SpeakingAiHelpersService.java:26` | Ngay |
| **P-4** | Teacher AI sinh bài tập bỏ qua cả org pool | Khắc phục | 🟠 Cao | S | `GrammarSyllabusController` generate (:66,72) | Ngay |
| **P-6/E** | `catch(Exception)` nuốt `assertAllowed` ở 2 eval → quota vô hiệu + không ghi ledger | Khắc phục | 🟠 Cao | S | `ConversationEvaluationService.java:44-79`; `InterviewEvaluationService.java:43-78` | Ngay |
| **P-7** | TTS endpoint không chốt, text user không giới hạn độ dài | Khắc phục | 🟠 Cao | S | `TtsController.java:37-62` | Ngay |
| **I** | Auto-promote STUDENT→TEACHER, không auto-demote khi remove | Khắc phục | 🟠 Cao | S | `OrgMembershipService.java:55-57,65-78` | Ngay |
| **S-3** | ~~Org-pool `SUM` không index theo org_id~~ ✅ DONE `f8c59380` | Nâng cấp | 🟠 Cao | S | `org_monthly_token_counters` V224; PK lookup O(1) | Trước scale |
| **P-1** | LLM ungated + vô hình ledger: mock-exam finish, correct-writing, greeting, video | Khắc phục | 🟠 Cao | M | `AiExamEvaluatorService:50,169`; `SkillTreeController:245`; `GroqApiService:31,53`; `VideoLessonService:184` | Ngay→Trước scale |
| **P-2** | LLM ungated (student) đốt pool gián tiếp: practice, satellite, pronunciation | Khắc phục | 🟠 Cao | M | `PracticeNodeService:117,143`; `SkillTreeService:417,886,1024` | Trước scale |
| **S-1** | SSE ticket in-memory → chặn scale ngang (speaking hỏng đa-node) | Nâng cấp | 🟠 Cao | M | `SseTicketService.java:33` | Trước scale |
| **S-4** | `reconcileSubscriptions` ghi DB mỗi `assertAllowed` (write-amp) | Nâng cấp | 🟠 Cao | M | `QuotaService.java:48,252,370` | Trước scale |
| **B-leak** | Org pool = SUM(ledger) → mù với toàn bộ AI ungated; enforce sai đối tượng | Khắc phục | 🟠 Cao | L | `OrgQuotaService.java:28-34` | Trước scale |
| **P-11** | Wallet clamp `GREATEST(0,...)` nuốt overage → thất thu im lặng | Khắc phục | 🟡 TB | S | `QuotaService.java:100` | Trước scale |
| **P-5** | Onboarding mock-exam chỉ rate-limit, không token quota | Khắc phục | 🟡 TB | S | `AiSpeakingMockExamController.java:34,143` | Trước scale |
| **M-3** | Org pool theo `date_trunc(UTC)` lệch personal-quota theo VN-day | Khắc phục | 🟡 TB | S | `OrgQuotaService.java:28-35` vs `QuotaVnCalendar.java` | Trước scale |
| **M-5** | `FreeTierGuard` chỉ áp B2C; org member bỏ qua free-tier PPTX/OCR | Khắc phục | 🟡 TB | S | `FreeTierGuard.java:78-81` | Trước scale |
| **P-9/D** | Check-then-debit không atomic → race over-spend | Khắc phục | 🟡 TB | M | `QuotaService.java:47-64,82-112` | Trước scale |
| **P-10/M-4** | ~~Org pool không khóa → race vượt pool~~ ✅ IMPROVED `f8c59380` | Khắc phục | 🟡 TB | M | atomic counter (soft-cap; hard reserve = P-9 still deferred) | Trước scale |
| **P-8** | STT không pre-check, chỉ ghi post-hoc | Khắc phục | 🟡 TB | M | `AiSessionController:106`; `PhonemeService:38`; `SkillTreeController:183`; `AiJobWorker:107`; `PronunciationScorerService:42` | Trước scale |
| **T-1/D-1/M-2** | Hai nguồn tenant: `users.org_id` vs `org_members`, không constraint | Nâng cấp | 🟡 TB | M | `OrgQuotaService.java:65-74` vs `OrgGuard.java:31` | Trước scale |
| **T-5/D-4** | Thiếu role accountant/TA → finance buộc làm org-admin (over-privilege) | Nâng cấp | 🟡 TB | M | `User.java:112`; `OrgController` billing | Trước scale |
| **S-2/B** | `loadUserByUsername` mỗi request, không cache | Nâng cấp | 🟡 TB | M | `JwtAuthFilter.java:129` | Trước scale |
| **S-5** | ~~LLM đồng bộ giữ thread Tomcat~~ ✅ DONE `e7ea78ff` | Nâng cấp | 🟡 TB | M | `PracticeNodeService:async`; `MockExamController:processFinishExam` | Trước scale |
| **D-2** | Không có `org_id` trên bảng nghiệp vụ → cách ly không nền cứng | Nâng cấp | 🟡 TB (latent) | L | classes/sessions/assignments/`ai_token_usage_events` (toàn cục) | Trước scale (quyết định) |
| **D-3/G** | Invoice seats tĩnh, tách rời membership; thiếu metering/proration | Nâng cấp | 🟡 TB | L | `OrgBillingService.java:50-68` | Trước scale (quyết định SP) |
| **A** | `System.err.println` cho lỗi trial → mất khỏi log container | Khắc phục | ⚪ Thấp | S | `AuthService.java:114` | Ngay |
| **F** | Thêm member đơn lẻ qua API không check seat limit | Khắc phục | ⚪ Thấp | S | `OrgController` add-member | Trước scale |
| **H** | `attachOwner` nuốt lỗi invite → org tạo xong không owner | Khắc phục | ⚪ Thấp | S | `AdminOrgService` attachOwner | Backlog |
| **K** | `break` khi hit seat-limit bỏ qua existing member hàng sau | Khắc phục | ⚪ Thấp | S | `OrgRosterService.java:121` | Backlog |
| **T-4** | Admin org endpoint không re-verify orgId từ path | Khắc phục | ⚪ Thấp | S | `AdminOrganizationController.java` (10 ep) | Backlog |
| **dead** | `ErrorDetectionService` không có caller | Nâng cấp | ⚪ Thấp | S | `ErrorDetectionService.java:43` | Ngay (xóa) |
| **M-1** | `exceptionHandling` cấu hình 2 lần (thừa) | Nâng cấp | ⚪ Thấp | S | `SecurityConfig.java:54,115` | Backlog |
| **O-3** | 4 lớp rate-limiter rời, chỉ 1 có Redis | Nâng cấp | ⚪ Thấp | S | `AuthRateLimiterService` + `speaking/AiRateLimiterService` + `speaking/RateLimiterService` + `NotificationRateLimiterService` | Backlog |
| **C** | `orgRole` JWT là display-hint, lệch tới 15' sau khi đổi quyền | Khắc phục | ⚪ Thấp | M | `JwtService.java:142-164` (claim); `JwtAuthFilter.java` | Backlog |
| **J** | Roster seat-limit race (SELECT COUNT không lock) | Khắc phục | ⚪ Thấp | M | `OrgRosterService.java:113-114` | Backlog |
| **S-6** | `SessionTurnGuard` in-memory → lượt nói đôi đa-node | Nâng cấp | ⚪ Thấp | M | `SessionTurnGuard.java:18` | Trước scale (hoặc sticky) |
| **O-2** | `QuotaService` 655 dòng + 2 cặp hàm nhân đôi | Nâng cấp | ⚪ Thấp | M | `QuotaService.java:114/251`, `:219/530` | Backlog |
| **O-1** | Pipeline speaking xé quá nhỏ + callback né vòng phụ thuộc | Nâng cấp | ⚪ Thấp | L | `SpeakingStreamService.java:37-42` + 7 service | Backlog |

---

## 3. KHẮC PHỤC — những thứ ĐANG hỏng/rủi ro

> Ưu tiên security & tiền. Mỗi mục: vấn đề & vì sao nguy hiểm → ở đâu → hướng sửa → rủi ro nếu bỏ qua.

### P-3 — `AISpeakingController` không auth-role, không token, không ledger 🔴
- **Vấn đề**: 5 endpoint dưới `/api/speaking/ai/*` (`generateConversation`, `provideFeedback`, `generateScenario`, `generateErrorPractice`, `provideCulturalContext`) không có `@PreAuthorize` ở class lẫn method → rơi xuống `anyRequest().authenticated()`. Bất kỳ user đăng nhập nào (mọi role) gọi thẳng Groq với prompt tùy ý, **không đếm token, không ghi ledger**. Đây là vector lạm dụng sạch nhất: input tự do + LLM trực tiếp + zero accounting.
- **Ở đâu**: `AISpeakingController.java:35-90`; lõi LLM `SpeakingAiHelpersService.java:26`.
- **Hướng sửa**: Bắt mọi method đi qua một entry-point chốt token chung (xem "AI-gate" ở Đợt 1) nhận `userId`, gọi `assertAllowed` + ghi ledger sau khi LLM trả `usage`. Đồng thời gắn role tối thiểu (`isAuthenticated` là sàn, cân nhắc giới hạn STUDENT/TEACHER). Nếu các endpoint này là tàn dư không dùng, xác minh ở frontend rồi xóa hẳn.
- **Rủi ro nếu bỏ qua**: COGS không trần, một script đăng nhập 1 lần có thể bơm Groq vô hạn; không thể quy chi phí cho user/org.

### P-4 — Teacher AI sinh bài tập bỏ qua org pool 🟠
- **Vấn đề**: `GrammarSyllabusController` generate (gate `hasAnyRole(TEACHER,ADMIN)`) gọi LLM nhưng **không** gọi `orgPoolGuard.assertOrgPoolAvailable` lẫn `assertAllowed`. Teacher trong org tiêu token AI ngoài mọi hạn mức org.
- **Ở đâu**: `GrammarSyllabusController` (annotation :66, method :72).
- **Hướng sửa**: Thêm `orgPoolGuard.assertOrgPoolAvailable(userId, estimated)` trước call, và ghi ledger sau — giống pattern `GradingController.java:105`.
- **Rủi ro nếu bỏ qua**: Org pool (đòn bẩy bán B2B) bị teacher vượt mặt; không bán được gói "giới hạn token" đúng nghĩa.

### P-6/E — `catch(Exception)` nuốt quota ở 2 eval 🟠
- **Vấn đề**: Cả hàm eval bọc trong `try { … assertAllowed … chatCompletion … } catch(Exception){ return null }`. `QuotaExceededException` bị nuốt → quota **không được thực thi** cho report; LLM vẫn chạy nhưng **không ghi ledger** → cost ẩn.
- **Ở đâu**: `ConversationEvaluationService.java:44-79` (assertAllowed :61, LLM :64); `InterviewEvaluationService.java:43-78` (assertAllowed :59, LLM :62).
- **Hướng sửa**: Thu hẹp `catch` — để `QuotaExceededException` (và lỗi nghiệp vụ) propagate ra ngoài, chỉ nuốt lỗi parse/format. Thêm ghi ledger sau khi LLM trả `usage` (hiện hoàn toàn thiếu ở 2 service này).
- **Rủi ro nếu bỏ qua**: User cạn quota vẫn nhận eval miễn phí; token eval không bao giờ vào sổ → báo cáo COGS sai.

### P-7 — TTS endpoint không chốt, text không giới hạn 🟠
- **Vấn đề**: `POST /api/ai-speaking/tts` chỉ `isAuthenticated()`, nhận `text` từ body **không giới hạn độ dài** (chỉ chặn rỗng), gọi `ttsService.synthesize` trực tiếp. Lạm dụng/DoS chi phí TTS dễ dàng.
- **Ở đâu**: `TtsController.java:37-62` (synthesize :50).
- **Hướng sửa**: Giới hạn độ dài `text` (ví dụ ≤ vài trăm ký tự), thêm rate-limit per-user, và nếu TTS có chi phí thực thì đưa qua chốt/ledger. Tối thiểu là cap độ dài + rate-limit.
- **Rủi ro nếu bỏ qua**: Một user gửi text khổng lồ lặp lại → đốt CPU/chi phí sidecar TTS.

### I — Auto-promote STUDENT→TEACHER không auto-demote 🟠
- **Vấn đề**: `upsertMember` nâng `User.Role` lên TEACHER khi gán org-role ADMIN/TEACHER (`:55-57`), nhưng `removeMember` (`:65-78`) chỉ set `org_id=null` + status REMOVED, **không hạ role về STUDENT**. Người bị remove vẫn giữ `ROLE_TEACHER` toàn hệ thống → truy cập mọi teacher endpoint.
- **Ở đâu**: `OrgMembershipService.java:55-57` (promote), `:65-78` (remove).
- **Hướng sửa**: Trong `removeMember`, nếu user không còn org-membership teaching nào khác thì hạ `User.Role` về STUDENT. Cân nhắc lưu role gốc để khôi phục chính xác.
- **Rủi ro nếu bỏ qua**: Leo thang quyền tồn dư — cựu teacher của 1 center giữ quyền teacher vĩnh viễn.

### P-1 — LLM ungated + vô hình ledger (mock-exam, correct-writing, greeting, video) 🟠
- **Vấn đề**: 4 cụm gọi Groq mà **không chốt token và không ghi ledger** → vừa không chặn, vừa vô hình với org-pool. `MockExamController` thậm chí không có `@PreAuthorize`.
- **Ở đâu**: `AiExamEvaluatorService.java:50,169` (qua `/api/mock-exams/.../finish`); `SkillTreeController.java:245` (correct-writing); `GroqApiService.java:31,53` (greeting-session); `VideoLessonService.java:184` (listening).
- **Hướng sửa**: Định tuyến tất cả qua AI-gate chung (Đợt 1): `assertAllowed` trước + ghi ledger sau. Thêm `@PreAuthorize` cho `MockExamController`.
- **Rủi ro nếu bỏ qua**: Rò rỉ COGS thuần, không quy được về org → không thể tính giá B2B theo tiêu thụ.

### P-2 — LLM ungated (student) đốt pool gián tiếp 🟠
- **Vấn đề**: Practice/satellite/pronunciation gọi LLM **không pre-check** nhưng **có** ghi ledger sau. Pool thấy tiêu thụ (SUM tăng) nhưng không bao giờ chặn các call này → chúng "đốt" hạn mức của org rồi chỉ khóa luồng speaking (đã gated) của chính org đó.
- **Ở đâu**: `PracticeNodeService.java:117,143` (ledger :172); `SkillTreeService.java:417` (ledger :438), `:886` (ledger :903), `:1024` (ledger :1032).
- **Hướng sửa**: Thêm `assertAllowed` trước mỗi call qua AI-gate. Vì đã ghi ledger sẵn, chỉ cần bổ sung chốt trước.
- **Rủi ro nếu bỏ qua**: Hạn mức org bị tiêu sai chỗ; trải nghiệm "hết quota" giáng xuống đúng tính năng đã được tính tiền (speaking) trong khi tính năng free đốt pool.

### B-leak — Org pool tính bằng SUM(ledger) nên mù với AI ungated 🟠
- **Vấn đề**: `orgUsageThisMonth` = `SUM(total_tokens) FROM ai_token_usage_events`. Mọi đường Lớp B (P-1, P-3) không ghi ledger → pool không bao giờ thấy. Enforcement đánh sai đối tượng.
- **Ở đâu**: `OrgQuotaService.java:28-34`.
- **Hướng sửa**: Đây là hệ quả của P-1/P-2/P-3/P-4 — **một khi mọi đường AI đi qua AI-gate ghi ledger thống nhất, B-leak tự đóng**. Đảm bảo gate luôn ghi ledger kể cả khi không gated cứng. Cân nhắc tách thành counter tăng-dần (xem S-3) thay vì SUM.
- **Rủi ro nếu bỏ qua**: Không thể chào gói "X triệu token/tháng" cho center vì hệ thống không đo đúng tiêu thụ.

### P-11 — Wallet clamp nuốt overage im lặng 🟡
- **Vấn đề**: `balance = GREATEST(0, balance - tokens)` → balance không âm, nhưng phần tiêu vượt bị hấp thụ thành 0; user dùng free phần dôi, **không ghi nhận thất thu** ở đâu.
- **Ở đâu**: `QuotaService.java:100`.
- **Hướng sửa**: Khi `tokens > balance`, ghi log/metric phần thâm hụt (debt) trước khi clamp, để có số liệu thất thu và phát hiện lạm dụng. Kết hợp với P-9 (atomic) để giảm tần suất.
- **Rủi ro nếu bỏ qua**: Doanh thu rò rỉ vô hình, không đo được.

### P-5 — Onboarding mock-exam chỉ rate-limit, không token quota 🟡
- **Vấn đề**: `requireEvalBudget` dùng `aiRateLimiterService` (chặn tần suất) chứ không phải `assertAllowed` (chặn token). Khác bản chất — rate-limit không bảo vệ hạn mức tiền.
- **Ở đâu**: `AiSpeakingMockExamController.java:34,143`; `SprechenTeil2Service:134,159`.
- **Hướng sửa**: Bổ sung `assertAllowed`/ledger song song với rate-limit hiện có, qua AI-gate.
- **Rủi ro nếu bỏ qua**: Đường onboarding (lưu lượng cao, user chưa trả tiền) tiêu LLM ngoài sổ.

### M-3 — Cửa sổ quota org (UTC) lệch personal (VN-day) 🟡
- **Vấn đề**: Org pool reset theo `date_trunc('month', now())` (timezone server, nhiều khả năng UTC); personal quota theo `Asia/Ho_Chi_Minh`. Hai ranh giới thời gian không khớp → báo cáo và reset lệch nhau.
- **Ở đâu**: `OrgQuotaService.java:28-35` vs `QuotaVnCalendar.java`.
- **Hướng sửa**: Thống nhất một calendar (VN) cho cả org và personal; tính mốc đầu tháng theo VN rồi truyền xuống query.
- **Rủi ro nếu bỏ qua**: Tranh cãi hóa đơn với center ("pool reset ngày nào"), số liệu lệch ngày.
- **(Lưu ý: finding này có trong pass1 (M3) nhưng bị bỏ sót khỏi bảng hợp nhất pass4 — đưa lại đây.)**

### M-5 — `FreeTierGuard` chỉ áp B2C; org member bỏ qua free-tier 🟡
- **Vấn đề**: `appliesTo` trả true chỉ khi `orgId == null`. Org member dùng PPTX/OCR không bị free-tier chặn — chỉ bị org-pool. Nếu org pool = 0 (unlimited mặc định), teacher org dùng PPTX/OCR vô giới hạn không cần subscription.
- **Ở đâu**: `FreeTierGuard.java:78-81`.
- **Hướng sửa**: Quyết định chính sách: org member nên chịu giới hạn nào? Nếu org pool = 0 nghĩa là "unlimited có chủ đích" thì OK; nếu không, cần fallback limit cho org member.
- **Rủi ro nếu bỏ qua**: Org chưa cấu hình pool = cửa hậu dùng AI đắt miễn phí.
- **(Lưu ý: finding này có trong pass1 (M5) nhưng bị bỏ sót khỏi bảng hợp nhất pass4 — đưa lại đây.)**

### P-9/D — Check-then-debit không atomic (race over-spend) 🟡
- **Vấn đề**: `assertAllowed` (`REQUIRES_NEW`, chỉ đọc) và `applyUsageDebit` (sau LLM) ở hai transaction riêng, cách nhau bởi LLM call 2-10s. N request đồng thời cùng user đều pass check → vượt quota.
- **Ở đâu**: `QuotaService.java:47-64` (check), `:82-112` (debit).
- **Hướng sửa**: Đây là soft-cap có chủ đích nhưng không document. Nếu cần cap cứng: reserve token trước LLM (atomic decrement) rồi điều chỉnh sau theo usage thực; hoặc chấp nhận và document rõ giới hạn overage.
- **Rủi ro nếu bỏ qua**: Overage 10-20% với user concurrency cao; cộng dồn ở quy mô lớn.

### P-10/M-4 — Org pool không khóa (race vượt pool) 🟡
- **Vấn đề**: `wouldExceedOrgPool` làm `SELECT SUM` không lock; `OrgPoolGuard` chỉ check không decrement. Nhiều teacher chấm bài đồng thời khi pool sắp cạn đều pass → vượt pool.
- **Ở đâu**: `OrgQuotaService.java:64-85`; `OrgPoolGuard.java:29-39`.
- **Hướng sửa**: Chuyển pool sang counter tăng-dần (xem S-3) với cập nhật atomic, hoặc reserve trước job. Kết hợp với việc đóng B-leak.
- **Rủi ro nếu bỏ qua**: Center vượt hạn mức đã bán; biên lợi nhuận trên gói cố định bị bào.

### P-8 — STT không pre-check, chỉ ghi post-hoc 🟡
- **Vấn đề**: Mọi đường Whisper gọi rồi `recordStt` sau, **không** kiểm tra quota/pool trước. Phí audio-giây không bao giờ bị chặn.
- **Ở đâu**: `AiSessionController:106`; `PhonemeService:38`; `SkillTreeController:183`; `AiJobWorker:107`; `PronunciationScorerService:42`.
- **Hướng sửa**: Thêm pre-check qua AI-gate (đơn vị có thể là token tương đương hoặc audio-giây). `stt_usage_events` đã có sẵn để tính.
- **Rủi ro nếu bỏ qua**: STT là chi phí biến đổi không trần; lạm dụng audio dài.

### A — `System.err.println` cho lỗi trial ⚪
- **Vấn đề**: Lỗi provision trial ghi ra `System.err`, không qua SLF4J → biến mất trong log container EC2/Docker. Student đăng nhập OK nhưng không có subscription mà không ai biết.
- **Ở đâu**: `AuthService.java:114`.
- **Hướng sửa**: Đổi sang `log.warn(...)` với context userId; cân nhắc metric đếm trial-provision-fail.
- **Rủi ro nếu bỏ qua**: Mất quan sát; student rơi vào DEFAULT plan âm thầm.

### F — Thêm member đơn lẻ không check seat limit ⚪
- **Vấn đề**: Chỉ roster CSV import check seat; thêm từng member qua API bỏ qua. Admin vượt seat limit bằng cách thêm lẻ.
- **Ở đâu**: `OrgController` add-member.
- **Hướng sửa**: Đưa seat-check vào `OrgMembershipService.upsertMember` (một chỗ) thay vì chỉ ở roster, để mọi đường thêm member đều qua.
- **Rủi ro nếu bỏ qua**: Seat limit không thực thi nhất quán → bán seat không kiểm soát.

### H — `attachOwner` nuốt lỗi invite ⚪
- **Vấn đề**: Tạo org thành công dù lời mời OWNER fail (catch RuntimeException + log.warn, đi tiếp). Org "mồ côi" không owner.
- **Ở đâu**: `AdminOrgService` attachOwner.
- **Hướng sửa**: Hoặc fail cả transaction nếu không gắn được owner, hoặc đánh dấu org "pending owner" + alert để xử lý tay.
- **Rủi ro nếu bỏ qua**: Org tạo ra không ai quản lý được; phải sửa DB tay.

### K — `break` bỏ qua existing member hàng sau ⚪
- **Vấn đề**: Khi hit seat-limit ở hàng new-student, `break` dừng cả vòng lặp — existing member ở hàng sau (vốn được phép) cũng bị bỏ. Comment thừa nhận lệch contract.
- **Ở đâu**: `OrgRosterService.java:121`.
- **Hướng sửa**: Đổi `break` → `continue` (chỉ bỏ qua new-student vượt seat, vẫn xử lý existing member).
- **Rủi ro nếu bỏ qua**: Import thiếu member cũ một cách khó hiểu cho admin.

### T-4 — Admin org endpoint không re-verify orgId từ path ⚪
- **Vấn đề**: 10 endpoint nhận `@PathVariable orgId`, không `existsById`/guard. Không phải IDOR (chỉ platform-admin), nhưng thiếu fail-fast khi orgId sai/đã xóa.
- **Ở đâu**: `AdminOrganizationController.java` (10 endpoint).
- **Hướng sửa**: Thêm helper load-and-validate org đầu mỗi handler.
- **Rủi ro nếu bỏ qua**: Thấp; lỗi mơ hồ khi admin thao tác nhầm orgId.

### C — `orgRole` JWT là display-hint, lệch tới 15' ⚪
- **Vấn đề**: Đổi org-role không phản ánh ngay vì JWT sống 15'. Backend re-verify nên **không phải lỗ hổng** authz, nhưng nếu frontend tin claim để hiện UI admin thì lệch.
- **Ở đâu**: `JwtService.java:142-164` (sinh claim); `JwtAuthFilter.java`.
- **Hướng sửa**: Chấp nhận (vốn dĩ của stateless JWT) + đảm bảo backend luôn là nguồn quyết định; hoặc rút ngắn TTL/đẩy claim quan trọng ra khỏi UI-trust.
- **Rủi ro nếu bỏ qua**: Thấp; chỉ lệch hiển thị tạm thời.

### J — Roster seat-limit race ⚪
- **Vấn đề**: `SELECT COUNT(*)` không lock; hai import đồng thời cùng đọc count → vượt seat.
- **Ở đâu**: `OrgRosterService.java:113-114`.
- **Hướng sửa**: Ràng buộc seat ở DB (ví dụ check khi insert membership) hoặc khóa org-row khi import; hoặc chấp nhận + giám sát (hiếm khi import đồng thời cùng org).
- **Rủi ro nếu bỏ qua**: Thấp; vượt seat vài đơn vị trong tình huống hiếm.

---

## 4. NÂNG CẤP — chạy được nhưng nên cải thiện

> Thêm "chi phí hoãn lại" cho mỗi mục.

### S-1 — SSE ticket in-memory chặn scale ngang 🟠
- **Vấn đề**: `ConcurrentHashMap` lưu ticket; mint node A, EventSource trúng node B → 401. SSE là đường nói AI chính.
- **Ở đâu**: `SseTicketService.java:33`.
- **Hướng sửa**: Chuyển ticket store sang Redis (TTL ngắn) — đúng pattern `AuthRateLimiterService` đã làm. Hoặc bật sticky-session ở load balancer như giải pháp tạm.
- **Chi phí hoãn**: Trần scale cứng ở 1 instance cho speaking → không thể thêm node để chịu tải.

### S-3 — Org-pool SUM không index theo org_id 🟠 ✅ DONE `f8c59380`
- **Đã làm**: V224 `org_monthly_token_counters(org_id, month_start PK, tokens_used)`. `AiUsageLedgerService.record()` atomic `ON CONFLICT DO UPDATE`. `OrgQuotaService.orgUsageThisMonth()` = O(1) PK lookup.
- **Xem thêm**: `audit/wave7_s3_p10_org_counter.md`

### S-4 — `reconcileSubscriptions` ghi DB mỗi `assertAllowed` 🟠
- **Vấn đề**: Mỗi call AI gated mở `REQUIRES_NEW` + nhiều UPDATE trên `user_subscriptions`. Đường-đọc đang ghi → write-amp + tranh khóa.
- **Ở đâu**: `QuotaService.java:48,252,370` (các UPDATE :372,:382,:444,:477).
- **Hướng sửa**: Tách reconcile thành job nền định kỳ (đã có `@EnableScheduling`); hot-path chỉ đọc snapshot.
- **Chi phí hoãn**: Dưới tải, contention trên `user_subscriptions` + tốn connection pool (Hikari max 20).

### T-1/D-1/M-2 — Hai nguồn sự thật về tenant 🟡
- **Vấn đề**: Quota đọc `users.org_id`; authz đọc `org_members`. Bất biến giữ bởi code, không có FK/constraint/trigger. Lệch → tính token sai org.
- **Ở đâu**: `OrgQuotaService.java:65-74` vs `OrgGuard.java:31`.
- **Hướng sửa**: Chọn một nguồn chuẩn (`org_members`), derive `org_id`; hoặc thêm FK + ràng buộc đồng bộ. **Lưu ý mâu thuẫn liên-pass đã giải quyết**: pass1 (M2) nghi ngờ không có cơ chế clear `users.org_id` khi remove; pass2 xác nhận `removeMember` (`OrgMembershipService.java:65-78`) **có** clear (khi `org_id` khớp). Rủi ro drift còn lại chỉ ở kịch bản multi-org lịch sử, không phải remove thông thường.
- **Chi phí hoãn**: Càng nhiều dữ liệu càng khó reconcile; bug tính tiền sai org khó truy.

### T-5/D-4 — Thiếu role accountant/TA 🟡
- **Vấn đề**: Chỉ 3 app-role. Kế toán muốn xem hóa đơn phải là org-ADMIN → kèm quyền sửa member/role/roster (over-privilege).
- **Ở đâu**: `User.java:112`; billing trong `OrgController`.
- **Hướng sửa**: Thêm org-role chi tiết (ACCOUNTANT chỉ đọc billing) ở tầng `OrgGuard` — không cần đụng `User.Role`. Map authority theo org-role cho các endpoint billing.
- **Chi phí hoãn**: Càng nhiều center, càng nhiều tài khoản admin thừa quyền = bề mặt rủi ro nội bộ.

### S-2/B — `loadUserByUsername` mỗi request, không cache 🟡
- **Vấn đề**: Mỗi request authed = 1 DB query load User; pool Hikari max 20.
- **Ở đâu**: `JwtAuthFilter.java:129`.
- **Hướng sửa**: Cache user theo email/TTL ngắn (Redis/Caffeine), invalidate khi đổi role/active.
- **Chi phí hoãn**: DB pool bão hòa sớm dưới tải đồng thời; latency cộng dồn mọi endpoint.

### S-5 — LLM đồng bộ giữ thread Tomcat 🟡 ✅ DONE `e7ea78ff`
- **Đã làm**: `PracticeNodeService` → `startPracticeSessionAsync`/`generateNextAsync` trả 202+jobId; `MockExamController.finishExam` → tách `processFinishExam` sang `aiExecutor`; quota gate giữ synchronous (fast). SkillTreeService + VideoLessonService đã async trước đó.
- **Xem thêm**: `audit/wave6_s5_llm_async.md`

### D-2 — Không có `org_id` trên bảng nghiệp vụ 🟡 (latent, đắt nhất để sửa)
- **Vấn đề**: classes/sessions/assignments/ledger không mang `org_id`; cách ly teacher dựa hoàn toàn vào đồ thị sở hữu lớp; ledger phải JOIN users mới biết org.
- **Ở đâu**: toàn cục (classes, ai_speaking_sessions, student_assignments, `ai_token_usage_events`).
- **Hướng sửa**: Quyết định sớm có thêm cột `org_id` (denormalized) trên các bảng chính không. Nếu có: thêm cột + backfill + ghi `org_id` tại thời điểm tạo. Gắn trực tiếp với S-3 (index org pool) và B-leak.
- **Chi phí hoãn**: Backfill trên dữ liệu lớn + viết lại truy vấn isolation; rẻ khi 10 center, đau khi 500. **Đây là khoản nợ đắt nhất nếu để lâu.**

### D-3/G — Invoice seats tĩnh, tách rời membership 🟡
- **Vấn đề**: `seats`/`amount_vnd` admin tự nhập, không link `org_members`; `activateEntitlements` kích hoạt theo member thực tế, không theo seats invoice. Premise "tính tiền theo seat/cycle" nhưng billing là sổ tay thủ công, không metering/proration.
- **Ở đâu**: `OrgBillingService.java:50-68`.
- **Hướng sửa**: Quyết định mô hình billing: (a) chốt seat theo snapshot membership tại kỳ, hoặc (b) metering thực + proration khi thêm/bớt giữa kỳ. Đây là quyết định sản phẩm trước khi là kỹ thuật.
- **Chi phí hoãn**: Khi nhiều center + biến động sĩ số, đối soát tay không scale; tranh chấp hóa đơn.

### S-6 — `SessionTurnGuard` in-memory 🟡
- **Vấn đề**: Guard chống lượt-nói-trùng lưu in-memory; đa-node → lượt nói đôi cùng session.
- **Ở đâu**: `SessionTurnGuard.java:18`.
- **Hướng sửa**: Redis lock per-session, hoặc dựa vào sticky-session (cùng giải pháp S-1).
- **Chi phí hoãn**: Hậu quả nhẹ (lượt nói đôi); chỉ thành vấn đề khi đã đa-node.

### dead — `ErrorDetectionService` không caller ⚪
- **Vấn đề**: Service gọi LLM nhưng không nơi nào dùng.
- **Ở đâu**: `ErrorDetectionService.java:43`.
- **Hướng sửa**: Xác minh không dùng (đã grep) rồi xóa.
- **Chi phí hoãn**: Nhiễu; rủi ro ai đó nối lại một call-site ungated.

### M-1 — `exceptionHandling` cấu hình 2 lần ⚪
- **Vấn đề**: Đăng ký trùng; lần sau (`:115`) ghi đè lần đầu (`:54`). Thừa, không sai hành vi.
- **Ở đâu**: `SecurityConfig.java:54,115`.
- **Hướng sửa**: Bỏ block trùng đầu tiên.
- **Chi phí hoãn**: Không; chỉ gây nhầm khi đọc.

### O-3 — 4 lớp rate-limiter rời ⚪
- **Vấn đề**: 4 cài đặt sliding-window; chỉ `AuthRateLimiterService` có Redis+fallback.
- **Ở đâu**: `AuthRateLimiterService` + `speaking/AiRateLimiterService` + `speaking/RateLimiterService` + `NotificationRateLimiterService`.
- **Hướng sửa**: Gộp thành một abstraction có Redis backing; các nơi khác dùng chung.
- **Chi phí hoãn**: Các limiter in-memory cũng vỡ khi scale ngang (cùng họ vấn đề S-1).

### O-2 — `QuotaService` 655 dòng + hàm nhân đôi ⚪
- **Vấn đề**: `buildSnapshot`/`buildSnapshotReadOnly` trùng; `computeAccruedWalletBalance`/`accrueWalletThroughToday` trùng phép tính. Mô hình wallet-accrual phức tạp quá mức.
- **Ở đâu**: `QuotaService.java:114/251`, `:219/530`.
- **Hướng sửa**: Hợp nhất cặp hàm; cân nhắc đơn giản hóa mô hình quota (chỉ làm khi đã đụng vùng này — đừng refactor vì đẹp).
- **Chi phí hoãn**: Mỗi sửa quota tốn công gấp đôi + dễ sinh bug (P-11 là hệ quả của độ phức tạp này).

### O-1 — Pipeline speaking xé quá nhỏ + callback né vòng phụ thuộc ⚪
- **Vấn đề**: 1 lượt nói qua 7 service + `SpeakingTurnFinalizer` callback để né circular dependency.
- **Ở đâu**: `SpeakingStreamService.java:37-42` + cụm service speaking.
- **Hướng sửa**: KHÔNG refactor chỉ vì đẹp. Nếu phải đụng, gỡ vòng phụ thuộc thật thay vì callback.
- **Chi phí hoãn**: Chi phí đọc-hiểu/onboard tăng; bug khó trace. Chấp nhận được.

---

## 5. LỘ TRÌNH ĐỀ XUẤT

### ĐỢT 1 — Chặn rò rỉ (xong TRƯỚC khi nhận thêm center)
Mục tiêu: bịt lỗ tiền/quyền đang chảy + lỗi nuốt âm thầm. Đa số effort S.

**Việc nền tảng (làm trước — là phụ thuộc của nhiều mục):**
- **AI-GATE chung**: tạo một entry-point chốt token + ghi ledger dùng chung cho mọi đường LLM/TTS/STT. *Đây là tiền đề cho P-1, P-2, P-4, P-5, P-8 và đóng B-leak.*

**Sau đó (song song được):**
1. **P-3** — gắn auth + AI-gate cho `AISpeakingController` (hoặc xóa nếu chết). *Phụ thuộc: AI-gate.*
2. **P-6/E** — thu hẹp `catch`, để QuotaException propagate, thêm ledger. *Độc lập.*
3. **P-7** — cap độ dài text + rate-limit TTS. *Độc lập.*
4. **P-4** — thêm `orgPoolGuard` + ledger cho grammar-syllabus. *Phụ thuộc: AI-gate (hoặc dùng OrgPoolGuard sẵn có).*
5. **P-1** — định tuyến mock-exam/correct-writing/greeting/video qua AI-gate; thêm `@PreAuthorize` cho MockExamController. *Phụ thuộc: AI-gate.*
6. **I** — auto-demote role khi remove member. *Độc lập.*
7. **A** — đổi `System.err` → `log.warn`. *Độc lập, trivial.*
8. **dead** — xóa `ErrorDetectionService`. *Độc lập, trivial.*

> Ghi chú phụ thuộc: làm **AI-gate trước**, rồi P-3/P-1/P-4/P-5 mới gắn vào. P-6/P-7/I/A/dead không phụ thuộc, làm ngay.

### ĐỢT 2 — Trước khi scale (xong khi còn ít khách)
Mục tiêu: chịu được node thứ 2 + hot-path không vỡ + phủ kín token + sửa lệch tính tiền.

**Cụm hạ tầng (chặn scale ngang — ưu tiên cao nhất đợt này):**
- **S-1** — SSE ticket sang Redis. *Mở khóa đa-node.*
- **S-6** — SessionTurnGuard sang Redis lock (đi kèm S-1, cùng quyết định sticky-session).
- **S-2/B** — cache user trong JwtAuthFilter.
- **S-4** — tách reconcileSubscriptions thành job nền.
- **S-5** — đẩy LLM sinh-nội-dung-dài sang job queue.

**Cụm token-pool (phụ thuộc AI-gate của Đợt 1):**
- **P-2** — thêm pre-check cho practice/satellite/pronunciation.
- **P-8** — pre-check STT.
- **P-5** — thêm token quota cho onboarding mock-exam.
- **B-leak** — xác nhận mọi đường đã ghi ledger (hệ quả của P-1/P-2/P-3/P-4).
- **S-3** — chuyển org-pool sang counter tăng-dần (atomic). *Đồng thời giải **P-10**.*
- **P-9** — reserve token atomic (nếu muốn cap cứng). *Cùng họ với S-3/P-10.*
- **P-11** — log thất thu khi clamp wallet.
- **M-3** — thống nhất calendar VN cho org + personal.
- **M-5** — quyết định chính sách free-tier cho org member.

**Cụm tenant & seat:**
- **T-1/D-1** — chọn nguồn tenant chuẩn + constraint. *Nên làm trước/cùng D-2.*
- **D-2** — **quyết định** thêm `org_id` trên bảng nghiệp vụ. *Tiền đề sạch cho S-3 và B-leak; quyết định càng sớm càng rẻ.*
- **T-5/D-4** — thêm org-role ACCOUNTANT read-only billing.
- **F** — đưa seat-check vào `upsertMember` (một chỗ).

> Ghi chú phụ thuộc: **S-3/P-10/P-9** nên làm cùng nhau (đều xoay quanh counter atomic). **D-2** nên quyết định trước S-3 nếu chọn gắn `org_id` lên ledger. **T-1/D-1** nên chốt trước khi đụng billing.

### ĐỢT 3 — Backlog (cải thiện dần)
Không chặn scale, làm khi có dịp.
- **D-3/G** — thiết kế lại billing (metering/proration). *Quyết định sản phẩm; phụ thuộc T-1/D-1 + D-2.*
- **C** — chính sách TTL/UI-trust cho orgRole claim.
- **J** — ràng buộc seat-limit ở DB (chống race import).
- **K** — `break` → `continue` trong roster.
- **H** — xử lý org mồ côi owner.
- **T-4** — load-and-validate orgId ở admin endpoints.
- **M-1** — bỏ `exceptionHandling` trùng.
- **O-3** — gộp rate-limiter.
- **O-2** — hợp nhất hàm trùng trong QuotaService (cơ hội).
- **O-1** — chấp nhận; chỉ gỡ vòng phụ thuộc khi buộc phải đụng.

---

## 6. CẦN XÁC MINH THÊM

Những chỗ audit chưa chắc 100% — kiểm tra tay trước khi hành động:

1. **Tenant teacher-cluster (23 method `TeacherController`)** — pass3 kết luận "sạch" dựa trên **agent-trace pattern** (`assertTeacherOwnsClass`), không phải đọc trực tiếp từng method. Nên đọc tay toàn bộ `TeacherController.java` + `teacher/service/TeacherService.java` để chắc không có method nào nhận `classId`/`studentId` mà quên check ownership.

2. **Caller-chain các đường LLM "ungated"** — P-1/P-2 dựa một phần trên agent-trace ngược caller. Đã verify trực tiếp: P-3, P-1 (correct-writing + mock-exam no-@PreAuthorize), P-7, bảng ledger-write. **Chưa đọc tay**: chuỗi gọi đầy đủ của `GroqApiService` (greeting), `VideoLessonService:184`, `GrammarSyllabusController` generate — xác nhận thật sự không có chốt nào ở tầng trên.

3. **Timezone server DB (M-3)** — chưa xác nhận `now()` của Postgres prod trả UTC hay VN. Kiểm tra `SHOW timezone;` trên DB prod để biết org-pool reset thực tế lúc nào.

4. **`AiRateLimiterService` / `RateLimiterService` backing** — chưa đọc xong; giả định in-memory (O-3). Xác nhận chúng có Redis hay không để biết có vỡ khi scale ngang không.

5. **`monthly_token_pool` mặc định = 0 (unlimited) cho org mới** — `Organization.java:42-44` default 0. Cần xác nhận org thật trên prod có cấu hình pool > 0 không; nếu tất cả đang = 0 thì **mọi enforcement org-pool hiện đang no-op** (và M-5 thành cửa hậu thực sự).

6. **Mâu thuẫn liên-pass đã ghi nhận (không cần chọn bừa)**: pass1-M2 nghi "không clear `users.org_id` khi remove" vs pass2 xác nhận "có clear" (`OrgMembershipService.java:65-78`). Đã hợp nhất ở T-1/D-1: cơ chế clear **có tồn tại** cho remove thường; drift chỉ còn rủi ro ở kịch bản multi-org lịch sử. Xác minh bằng query thực: có user nào `users.org_id` không khớp `org_members` ACTIVE không.

7. **`InterviewEvaluationService` / `ConversationEvaluationService` thiếu ledger** (P-6) — xác nhận không có nơi nào khác ghi ledger hộ cho 2 eval này (ví dụ ở `SessionLifecycleService` gọi chúng). Nếu thật sự thiếu hoàn toàn thì token eval chưa bao giờ vào sổ.
