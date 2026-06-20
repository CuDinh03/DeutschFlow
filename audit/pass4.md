# PASS 4 — ĐÁNH GIÁ KIẾN TRÚC

> Đánh giá thẳng chất lượng quyết định kiến trúc + bảng ưu tiên hợp nhất Pass 1-4. KHÔNG sửa.

Xác nhận được 3 điểm quyết định: SSE ticket **in-memory**, org-pool SUM **không có index theo org_id**, và `reconcileSubscriptions` **ghi DB trên mỗi `assertAllowed`**.

---

## 1. OVER-ENGINEERED — lớp thừa không tạo giá trị

### O-1 — Pipeline speaking bị xé quá nhỏ, chữa cháy vòng phụ thuộc bằng callback — **Thừa, công sửa Lớn**
Một lượt nói AI đi qua: `AiSpeakingServiceImpl` (facade) → `ChatPrepService` → `ChatCompletionService` → `SpeakingStreamService` → `TurnSideEffectsService` → `SessionTurnGuard` → `SessionLifecycleService` + `AiChatClientFactory` + `AiCacheService`. Comment trong `SpeakingStreamService.java:37-42` tự thú: *"The turn-finalize callback breaks the cycle... receives it as a `SpeakingTurnFinalizer` rather than holding a back-reference to AiSpeakingServiceImpl"*. Truyền callback `SpeakingTurnFinalizer` để né vòng phụ thuộc là dấu hiệu một circular dependency bị che thay vì gỡ. Việc tách "many small files" đã vượt điểm hữu ích — giờ trace một lượt nói phải nhảy 7 file. Đây là refactor đuổi theo quy tắc kích thước file chứ không theo ranh giới trách nhiệm thật.

### O-2 — `QuotaService` 655 dòng + logic nhân đôi — **Thừa, công sửa Trung bình**
`buildSnapshot` (`:251`, có ghi DB) và `buildSnapshotReadOnly` (`:114`, không ghi) gần như trùng hoàn toàn — copy-paste hai nhánh. `computeAccruedWalletBalance` (`:219`, pure) và `accrueWalletThroughToday` (`:530`, JDBC) lặp lại cùng phép tính accrual. Bản thân mô hình "wallet tích lũy theo ngày, cap theo `wallet_cap_days`, drain khi dùng, có grace-period khi hết hạn" (`:415-452`) là phức tạp quá mức cho cái thực chất chỉ là "hạn mức token tháng". Phức tạp này sinh ra chính các bug Pass 2/3 (P-11 clamp nuốt overage, reconcile ghi mỗi call).

### O-3 — 4 lớp rate-limiter rời — **Thừa nhẹ, công sửa Nhỏ**
`AuthRateLimiterService`, `speaking/AiRateLimiterService`, `speaking/RateLimiterService`, `NotificationRateLimiterService` — bốn cài đặt sliding-window riêng. Chỉ `AuthRateLimiterService` có Redis+fallback; số còn lại nhiều khả năng in-memory. Nên là một abstraction.

> **Lưu ý**: KHÔNG đề nghị refactor O-1/O-2 chỉ vì đẹp — chúng hoạt động. Chỉ sửa khi đã phải đụng vào vùng đó.

---

## 2. VỠ KHI SCALE — đúng cho 10 center, sai cho 500

### S-1 — SSE ticket lưu in-memory → CHẶN scale ngang — **Nghiêm trọng cho scale**
`SseTicketService.java:33`: `ConcurrentHashMap<String, Entry> tickets`. SSE là đường nói AI chính (streaming). Ticket được mint ở node A, `EventSource` của browser kết nối lại có thể trúng node B → ticket không tồn tại → 401. Hôm nay chạy 1 node nên không lộ. Thêm node thứ 2 mà không sticky-session → speaking streaming hỏng ngẫu nhiên. Đây là **blocker scale ngang số 1**. (`AuthRateLimiterService` đã làm đúng với Redis+fallback — chứng tỏ team biết cách, chỉ chưa áp cho SSE ticket.)

### S-3 — Org-pool SUM không index theo org_id, chạy MỖI request — **Cao**
`OrgQuotaService.java:28-34` tính pool bằng `SUM(total_tokens) FROM ai_token_usage_events JOIN users WHERE u.org_id=? AND created_at >= date_trunc('month',now())`. Index hiện có (V188) chỉ là `idx_ai_token_usage_user_created (user_id, created_at DESC)` và `idx_ai_token_usage_feature (feature, created_at DESC)` — **không có index phục vụ `org_id`**. Bảng ledger append-only, chỉ có retention index (V218 `(created_at)`), không partition. Mỗi request AI của user org chạy lại aggregate này trên bảng ngày càng to. 500 center × nghìn event/tháng → SUM-per-request thành quả bom latency.

### S-4 — `reconcileSubscriptions` ghi DB trên mỗi `assertAllowed` — **Cao**
`assertAllowed:48 → buildSnapshot:252 → reconcileSubscriptions:370`. Mỗi lượt gọi AI gated mở một transaction `REQUIRES_NEW` rồi chạy nhiều `UPDATE` (`:372`, `:382`, `:444`, `provisionDefaultSubscription:477`). Đường-đọc đang ghi. Dưới tải, đây là write-amplification + tranh khóa trên `user_subscriptions`. Reconcile nên là job nền định kỳ, không nằm trên hot-path.

### S-2 (= Pass 2 finding B) — `loadUserByUsername` mỗi request, không cache — **Trung bình**
`JwtAuthFilter.java:129`: mỗi request authed = 1 DB query load `User`. Pool Hikari max 20 (RDS t4g.micro). Cache TTL ngắn (Redis/Caffeine) sẽ cắt phần lớn.

### S-5 — LLM đồng bộ giữ thread Tomcat — **Trung bình**
Chỉ `SpeakingStreamService` dispatch off-thread (`:111`). Skill-tree gen (`SkillTreeService:417`), practice (`PracticeNodeService:117`), mock-exam (`AiExamEvaluatorService:50`), video (`VideoLessonService:184`) gọi Groq **đồng bộ**, giữ thread 2-10s. Pool Tomcat = 48 (`application.yml:169`). 48 lượt sinh-bài chậm là đủ làm đói toàn server.

### S-6 — `SessionTurnGuard` in-memory — **Thấp cho scale**
`SessionTurnGuard.java:18` ConcurrentHashMap. Hai node, cùng session → cả hai acquire được → lượt nói đôi. Hậu quả nhẹ; sticky-session hoặc Redis lock giải quyết.

---

## 3. ABSTRACTION / MÔ HÌNH DỮ LIỆU SAI — tốn kém sửa về sau

### D-2 — KHÔNG có `org_id` trên bảng nghiệp vụ → cách ly tenant không có nền cứng — **Đắt nhất để sửa**
`classes`, `ai_speaking_sessions`, `student_assignments`, `ai_token_usage_events` đều **không mang `org_id`**. Cách ly dữ liệu teacher hoàn toàn dựa vào đồ thị sở hữu lớp (`classTeacher`/`classStudent`), không phải cột tenant. Ledger phải JOIN qua `users` mới biết org. Khi cần: org-level analytics đúng, hard isolation, data residency, hoặc row-level-security → phải backfill `org_id` trên hàng loạt bảng đã đầy dữ liệu. Đây là khoản đắt nhất nếu hoãn — sửa khi 10 center thì rẻ, sửa khi 500 center là migration đau.

### D-1 (= T-1) — Hai nguồn sự thật về tenant: `users.org_id` vs `org_members` — **Trung bình-Cao**
Quota đọc `users.org_id` (`OrgQuotaService:66`); authz đọc `org_members` (`OrgGuard:31`). Bất biến "hai cái khớp nhau" chỉ được giữ bởi code `OrgMembershipService`, **không có FK/constraint/trigger** ép. Lệch nhau → tính token sai org. Mô hình đúng: một nguồn (`org_members`), `org_id` là derived — hoặc FK cứng.

### D-3 (= Pass 2 G) — Invoice seats tĩnh, tách rời membership — **Trung bình, công Lớn**
`OrgBillingService:50-68`: `seats`/`amount_vnd` admin tự nhập, không liên kết `org_members`. `activateEntitlements` lại kích hoạt theo member thực tế chứ không theo seats trên invoice. Premise sản phẩm là "tính tiền theo seat/course cycle" — nhưng billing hiện là sổ tay thủ công, không có metering/proration. Sai mô hình cho chính lõi monetization.

### D-4 (= T-5) — Role model không khớp tổ chức thật — **Trung bình**
`User.Role = {STUDENT,TEACHER,ADMIN}` (`User.java:112`). Không có accountant/TA. Nhân viên kế toán muốn xem hóa đơn buộc phải là org-ADMIN → kèm luôn quyền sửa member/role/roster. Thêm role chi tiết sau = thêm tầng ánh xạ authority mới.

---

## 4. NỢ KỸ THUẬT LỚN NHẤT + chi phí hoãn

**#1 — Token-pool chỉ gắn vào 2/24 đường AI (Pass 3: B-leak + P-1/P-2/P-3).** Đây không phải bug tiềm ẩn — là **rò rỉ biên lợi nhuận đang chảy**, tăng theo mức dùng. Mỗi đường ungated là COGS không trần; org-pool (đòn bẩy monetization B2B) **về mặt cấu trúc mù** với phần lớn tiêu thụ vì pool = SUM(ledger) mà nhiều đường không ghi ledger. *Chi phí hoãn*: lỗ trực tiếp tỉ lệ thuận với tăng trưởng + không thể báo cáo COGS theo org cho khách B2B.

**#2 — Không có `org_id` trên bảng nghiệp vụ (D-2).** *Chi phí hoãn*: migration backfill trên dữ liệu lớn + nguy cơ phải viết lại mọi truy vấn isolation. Càng nhiều center càng đau.

**#3 — State in-memory trên hot-path (S-1 SSE ticket).** *Chi phí hoãn*: không thể thêm node thứ 2 → trần scale cứng ở 1 instance cho tính năng nói.

---

# BẢNG ƯU TIÊN HỢP NHẤT (Pass 1-4)

Mức độ × Công sửa × Phán quyết. Đã gộp các finding trùng.

| ID | Phát hiện | file:dòng | Mức | Công | Phán quyết |
|---|---|---|---|---|---|
| **P-3** | `AISpeakingController` /api/speaking/ai/* — không @PreAuthorize, không token, không ledger; mọi user authed bơm Groq tùy ý | `AISpeakingController.java:35-90` | 🔴 Nghiêm trọng | S | **SỬA NGAY** |
| **P-6/E** | `assertAllowed` bị `catch(Exception)` nuốt ở 2 eval → quota vô hiệu + không ghi ledger | `ConversationEvaluationService.java:44-79`; `InterviewEvaluationService.java:43-78` | 🔴 Cao | S | **SỬA NGAY** |
| **P-7** | TTS endpoint không chốt, text user không giới hạn | `TtsController.java:37-62` | 🔴 Cao | S | **SỬA NGAY** |
| **P-4** | Teacher AI sinh bài tập bỏ qua cả org pool | `GrammarSyllabusController` generate | 🔴 Cao | S | **SỬA NGAY** |
| **I** | Auto-promote STUDENT→TEACHER không có auto-demote khi remove | `OrgMembershipService.java:55-57,65-78` | 🔴 Cao | S | **SỬA NGAY** |
| **A** | `System.err.println` cho lỗi trial — mất khỏi log container | `AuthService.java:114` | 🟡 Thấp | S(trivial) | **SỬA NGAY** |
| **dead** | `ErrorDetectionService` không caller | `ErrorDetectionService.java:43` | 🟡 Thấp | S | **SỬA NGAY** (xóa) |
| **B-leak** | Org pool = SUM(ledger) → mù với toàn bộ AI ungated; enforce sai đối tượng | `OrgQuotaService.java:28-34` | 🔴 Cao | L | **TRƯỚC SCALE** |
| **P-1** | LLM ungated + vô hình ledger: mock-exam finish, correct-writing, greeting, video | `AiExamEvaluatorService:50,169`; `SkillTreeController:245`; `GroqApiService:31,53`; `VideoLessonService:184` | 🔴 Cao | M | **TRƯỚC SCALE** |
| **P-2** | LLM ungated (student) đốt pool gián tiếp: practice, satellite, pronunciation | `PracticeNodeService:117,143`; `SkillTreeService:417,886` | 🔴 Cao | M | **TRƯỚC SCALE** |
| **S-1** | SSE ticket in-memory → chặn scale ngang (speaking hỏng đa-node) | `SseTicketService.java:33` | 🔴 Cao | M | **TRƯỚC SCALE** |
| **S-3** | Org-pool SUM không index org_id, chạy mỗi request | `OrgQuotaService.java:28-34`; thiếu index (V188) | 🔴 Cao | S | **TRƯỚC SCALE** |
| **S-4** | `reconcileSubscriptions` ghi DB mỗi `assertAllowed` (write-amp) | `QuotaService.java:48,252,370` | 🟠 TB-Cao | M | **TRƯỚC SCALE** |
| **D-2** | Không có `org_id` trên bảng nghiệp vụ → cách ly không nền cứng | classes/sessions/assignments/ledger (toàn cục) | 🟠 TB (latent) | L | **TRƯỚC SCALE** (quyết định) |
| **D-1/T-1** | Hai nguồn tenant: `users.org_id` vs `org_members`, không constraint | `OrgQuotaService:66` vs `OrgGuard:31` | 🟠 TB | M | **TRƯỚC SCALE** |
| **D-3/G** | Invoice seats tĩnh, tách rời membership; thiếu metering | `OrgBillingService.java:50-68` | 🟠 TB | L | **TRƯỚC SCALE** (quyết định SP) |
| **D-4/T-5** | Thiếu role accountant/TA → finance over-privilege | `User.java:112`; `OrgController` billing | 🟠 TB | M | **TRƯỚC SCALE** |
| **S-5** | LLM đồng bộ giữ thread Tomcat (skill-tree/practice/mock-exam/video) | `SkillTreeService:417`; `PracticeNodeService:117`; `AiExamEvaluatorService:50`; `VideoLessonService:184` | 🟠 TB | M | **TRƯỚC SCALE** |
| **S-2/B** | `loadUserByUsername` mỗi request, không cache | `JwtAuthFilter.java:129` | 🟠 TB | M | **TRƯỚC SCALE** |
| **P-9/D** | Check-then-debit không atomic → race over-spend | `QuotaService.java:47,82` | 🟠 TB | M | **TRƯỚC SCALE** |
| **P-10** | Org pool không khóa → race vượt pool | `OrgQuotaService.java:64-85` | 🟠 TB | M | **TRƯỚC SCALE** |
| **P-11** | Wallet clamp `GREATEST(0,...)` nuốt overage → thất thu im lặng | `QuotaService.java:100` | 🟠 TB | S | **TRƯỚC SCALE** |
| **P-8** | STT không pre-check, chỉ ghi post-hoc | `AiSessionController:106`; `PhonemeService:38`; +3 | 🟠 TB | M | **TRƯỚC SCALE** |
| **P-5** | Onboarding mock-exam chỉ rate-limit, không token quota | `AiSpeakingMockExamController:34,143` | 🟠 TB | S | **TRƯỚC SCALE** |
| **F** | Thêm member đơn lẻ qua API không check seat limit | `OrgController` add-member | 🟡 Thấp | S | **TRƯỚC SCALE** |
| **S-6** | `SessionTurnGuard` in-memory → lượt nói đôi đa-node | `SessionTurnGuard.java:18` | 🟡 Thấp | M | **TRƯỚC SCALE** (hoặc sticky) |
| **J** | Roster seat-limit race (SELECT COUNT không lock) | `OrgRosterService.java:113-114` | 🟡 Thấp | M | **CHẤP NHẬN** (giám sát) |
| **K** | `break` khi hit seat-limit bỏ qua existing member hàng sau | `OrgRosterService.java:121` | 🟡 Thấp | S | **CHẤP NHẬN** |
| **H** | `attachOwner` nuốt lỗi invite → org tạo xong không owner | `AdminOrgService` attachOwner | 🟡 Thấp | S | **CHẤP NHẬN** |
| **T-4** | Admin org endpoint không re-verify orgId từ path | `AdminOrganizationController.java` (10 ep) | 🟡 Thấp | S | **CHẤP NHẬN** (admin-only) |
| **M-1** | `exceptionHandling` cấu hình 2 lần (thừa) | `SecurityConfig.java:54,115` | 🟡 Thấp | S | **CHẤP NHẬN** |
| **O-1** | Pipeline speaking xé quá nhỏ + callback né vòng phụ thuộc | `SpeakingStreamService.java:37-42` + 7 service | ⚪ Over-eng | L | **CHẤP NHẬN** (đừng refactor vì đẹp) |
| **O-2** | `QuotaService` 655 dòng + 2 cặp hàm nhân đôi | `QuotaService.java:114/251`, `:219/530` | ⚪ Over-eng | M | **CHẤP NHẬN** (cơ hội) |
| **O-3** | 4 lớp rate-limiter rời, chỉ 1 có Redis | `AuthRateLimiterService` + 3 | ⚪ Over-eng | S | **CHẤP NHẬN** |

---

## Đọc bảng thế nào

- **7 mục SỬA NGAY**: đều effort nhỏ, chặn rò rỉ tiền/quyền đang chảy (P-3, P-6, P-7, P-4, I) + 2 dọn dẹp tầm thường (A, dead). Một buổi làm là xong phần lớn.
- **Chủ đề "TRƯỚC SCALE"** chụm vào 3 cụm: **(a) phủ kín token-pool** (B-leak, P-1, P-2, P-5, P-8 + race P-9/10/11) — đây là khối lợi nhuận; **(b) bỏ state in-memory + index/cache hot-path** (S-1, S-3, S-4, S-2, S-5) — khối latency/throughput; **(c) mô hình tenant & billing** (D-1, D-2, D-3, D-4) — khối nợ cấu trúc, riêng D-2 nên quyết định sớm vì càng để càng đắt.
- **CHẤP NHẬN**: rủi ro thấp + thường cần điều kiện hiếm (race roster, admin-compromise) hoặc over-engineering mà refactor không đáng rủi ro.

---

## Phương pháp & độ tin cậy

- **Đã verify trực tiếp** (đọc nguyên file, không qua agent): P-3, P-1 (correct-writing + mock-exam no-@PreAuthorize), P-7, S-1 (SseTicketService in-memory), S-3 (index V188), S-4 (reconcile ghi mỗi call), bảng ledger-write đầy đủ.
- **Agent-traced** (đọc excerpt, cần verify lại nếu hành động): cluster tenant teacher (23 method TeacherController), một số caller-chain LLM.
- Backend thực tế = **Java 21 + Spring Boot 3** (không phải Node.js như đề bài mô tả). Role thực tế = 3 app-role + 4 org-role (không có TA/accountant).
