# FIX_SPEC — Spec sửa hợp nhất (Pha phân tích, 2026-06-24)

> Nguồn: `qa/FIX_PLAN.md` + `audit/QA_2ACCOUNTS_2026-06-24.md`.  
> Quy trình: đọc codebase thật (file:dòng), gộp & khử trùng, phân loại P0→P2.  
> **✅ TOÀN BỘ 25 mục đã implement trong commit `417fb661` (2026-06-25). Verified file:dòng.**

---

## 1. Tình trạng chung

| Loại | Số lượng |
|------|----------|
| P0 🔴 — block tính năng lõi / mất tiền | 4 (H-1, H-2, MON-1, TF-1) |
| P1 🟠/🟡 — lỗi chức năng rõ ràng | 8 (M-1, F-2, MUT-1, F-1, U-1, U-2, TF-2, TF2-1, PRON) |
| P2 ⚪ — low / UX / a11y / i18n | 9 (SCH-1, SCH-2, F-3, TF2-2, U-4, L-1..L-5) |
| ĐÃ FIX — verify xong | 2 (H-3, M-2) |
| INFO — đã biết, không sửa lần này | 2 (I-1, I-2) |
| CẦN XÁC MINH thêm | 2 (TF-1 prod scenario, F-2 web leak) |

---

## 2. Bảng ưu tiên hợp nhất

| ID | Mức | Công | Vùng | Tóm tắt | Trạng thái |
|----|-----|------|------|---------|------------|
| **H-1** | 🔴 | S | AI/grammar | Grammar AI → 500 (AI server/NPE) | ✅ `GlobalExceptionHandler.java:195`, `AIGrammarService.java:41-45` |
| **H-2** | 🔴 | S | AI/image | Image gen → 500 (Bedrock cfg/NPE) | ✅ `GlobalExceptionHandler.java:206`, `AiImageGenerationService.java:40-42` |
| **MON-1** | 🔴 | M | quota | PRO rớt DEFAULT sau 1 lượt AI (wallet debit race) | ✅ `AdminManagementService.java:264-283` seed wallet ON CONFLICT |
| **TF-1** | 🔴 | M | quota | INTERNAL "unlimited" ≠ enforcement + P-14 org6 pool | ✅ `OrgQuotaService.poolBlocks():early-return`; SQL patch prod `UPDATE 1` |
| **H-3** | ✅ | — | auth | `user.id="undefined"` → đã fix 4 file FE | ĐÃ FIX `71ce3f9a` |
| **M-2** | ✅ | — | analytics | PostHog identify("undefined") | ĐÃ FIX (gốc H-3) |
| **M-1** | 🟠 | S | FE/org | Org dashboard 0/0 lần đầu (hydration race) | ✅ `org/page.tsx:48` `'—'` during loading, `apiMessage(e)` |
| **F-2** | 🟡 | S | auth | refreshToken lộ body login/me? | ✅ `AuthController.java:74` `stripRefreshToken()` for web |
| **MUT-1** | 🟡 | S | schedule | dayOfWeek 0–6 lệch ISO; value 7→400 | ✅ `ClassScheduleService.java:297` + `V240__dayofweek_iso_1_7.sql` |
| **F-1** | 🟡 | S | schedule | date-only param → 500 (nên 400) | ✅ `GlobalExceptionHandler.java:72` `MethodArgumentTypeMismatchException→400` |
| **U-1** | 🟡 | S | FE | Guard sai-role /v2/* "mềm" | ✅ `middleware.ts:243-253` OWNER/MANAGER gating |
| **U-2** | 🟡 | S | FE | Lỗi lộ path API ra UI | ✅ `org/page.tsx:48` `apiMessage(e)` sanitized |
| **TF-2** | 🟡 | S | teacher | evaluateAssignment path-param tên sai | ✅ `TeacherController.java:178` `@PathVariable Long submissionId` |
| **TF2-1** | 🟡 | S | teacher | co-teacher add không kiểm org | ✅ `TeacherService.java:325-328` org isolation check |
| **PRON** | 🟡 | S | speaking | pronunciation 500 thiếu audio (nên 400) | ✅ `GlobalExceptionHandler.java:83` `MissingServletRequestPartException→400` |
| **SCH-1** | ⚪ | S | schedule | PATCH CANCELLED làm mất room | ✅ `ClassScheduleService.java:148` keeps room on CANCELLED |
| **SCH-2** | ⚪ | S | schedule | defaultRoom pattern không xuống session | ✅ included in `417fb661` |
| **F-3** | ⚪ | S | common | Lỗi không nhất quán Spring vs RFC7807 | ✅ `GlobalExceptionHandler.java:216-219` rethrow security exceptions |
| **TF2-2** | ⚪ | S | common | Status code 200/201/204 không nhất quán | ✅ `TeacherController` deleteClass/removeCoTeacher → 204 |
| **U-4** | ⚪ | S | FE | Wording "Session compromised" | ✅ `api.ts:157` Vietnamese session expiry message |
| **L-1** | ⚪ | S | FE | Link "Trợ giúp" trỏ home | ✅ `GaTopBar.tsx` `HELP_HREF` → `/help` all roles |
| **L-2** | ⚪ | S | i18n | Notification key thô "LEARNER_PLAN_UPDATED" | ✅ `notifications/page.tsx` `TYPE_LABEL` 21 keys |
| **L-3** | ⚪ | S | a11y | Dialog thiếu Description/aria-describedby | ✅ `admin/media/page.tsx` `<DialogDescription className="sr-only">` |
| **L-4** | ⚪ | M | i18n | DE chưa dịch đủ | ✅ `messages/de.json` adminNav + 26 persona keys |
| **L-5** | ⚪ | S | FE | Org-Manager thấy tab "Học tập" | ✅ `profile/page.tsx` `ROLES_WITHOUT_LEARNING` Set |

---

## 3. Chi tiết P0 (🔴)

---

### H-1 — Grammar AI `POST /api/ai/grammar/correct` → 500 [🔴 · S]

- **Triệu chứng:** Nhập câu Đức → "Không phân tích được — ERR-1"; network 500.
- **Repro:** Đăng nhập teacher → `/v2/teacher/tools/grammar/` → "Kiểm tra ngay" với `Ich habe gestern ins Kino gegangen.`
- **Nguyên nhân gốc (đã xác nhận):**
  1. `AIModelService.java` (tìm trong `backend/.../ai/`) — `correctGrammar()` gọi local AI server qua RestTemplate. Nếu server down hoặc trả body null/schema khác, `response.getBody()` → NPE không được bắt.
  2. Không có circuit-breaker bọc (khác với `generate()` có `circuitBreakers.call()`).
  3. Exception bắn ra → `GlobalExceptionHandler` generic 500.
  4. Trên prod: AI server (`AI_SERVER_URL`, mặc định `http://localhost:8000`) có thể không chạy hoặc endpoint `/grammar/correct` trả format khác.
- **Đường đi:** `/v2/teacher/tools/grammar/` FE → `POST /api/ai/grammar/correct` → `AIGrammarController` → `AIModelService.correctGrammar()` → RestTemplate → AI local server.
- **Hướng sửa:**
  1. **Ưu tiên (env):** Kiểm tra `AI_SERVER_URL` trên EC2 và thử curl thủ công: `curl -X POST $AI_SERVER_URL/grammar/correct -d '...'`.
  2. **Code:** Thêm null-check `response.getBody()` trước khi access; wrap trong try-catch trả 503 "AI service unavailable" thay vì để NPE.
  3. Thêm circuit-breaker tương tự `generate()`.
- **Phạm vi/rủi ro:** Chỉ `correctGrammar()`, không ảnh hưởng các AI khác (speaking/grading).
- **Nghiệm thu:** `POST /api/ai/grammar/correct` với text hợp lệ → 200 + JSON kết quả; khi AI server down → 503 (không 500).
- **Liên quan:** H-2 (cùng pattern AI 500). Không liên quan wave-6 Groq async (luồng khác).

---

### H-2 — Image Gen `POST /api/v2/ai-images/generate` → 500 [🔴 · S]

- **Triệu chứng:** "Tạo 4 ảnh" → "Không tạo được ảnh — ERR-2"; network 500.
- **Repro:** Đăng nhập teacher → `/v2/teacher/tools/images/` → nhập prompt → "Tạo 4 ảnh".
- **Nguyên nhân gốc (đã xác nhận):**
  1. `AiImageGenerationService.java` (gọi tắt: `aiimage/service/`) dùng AWS Bedrock. Nếu không config đủ (`aws.bedrock.enabled=true`, `aws.bedrock.region`, `aws.bedrock.previewModelId`, `aws.bedrock.finalModelId`, IAM key) → `ObjectProvider<ImageGenerationProvider>` trả null → `IllegalStateException` không được map trong `GlobalExceptionHandler`.
  2. Nếu Bedrock trả response thiếu field `images`/`image`/`artifacts` → `extractBase64Image()` trả null → `base64Image.isBlank()` ném NPE.
  3. `GlobalExceptionHandler` không có handler cho `IllegalStateException` → fallthrough 500.
- **Đường đi:** FE → `AiImageGenerationController` → `AiImageGenerationService.generate()` → `BedrockImageGenerationProvider` → AWS Bedrock SDK.
- **Hướng sửa:**
  1. **Ưu tiên (env):** Kiểm tra `.env.production`: `AWS_BEDROCK_ENABLED`, `AWS_BEDROCK_REGION`, model IDs, `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`.
  2. **Code (ngắn hạn):** Trong `AiImageGenerationService.generate()`, nếu provider == null → throw `ServiceUnavailableException("AI image service not configured")` (503, có message).
  3. Thêm null-check `extractBase64Image()` → nếu null → 503, không NPE.
  4. Thêm `@ExceptionHandler(IllegalStateException.class)` trong `GlobalExceptionHandler` → 503.
- **Phạm vi/rủi ro:** Chỉ `ai-images/generate`. P-16 OrgPoolGuard đã thêm gần đây nhưng không phải nguyên nhân (org ATB có pool unlimited).
- **Nghiệm thu:** Khi Bedrock không config → 503 có message; khi config đúng → 200 + ảnh Base64.
- **Liên quan:** H-1 (cùng pattern). Kiểm tra `AiImageGenerationService.java` đã thêm `OrgPoolGuard` (P-16) — happy path không ném NPE.

---

### MON-1 — Plan PRO rớt DEFAULT sau 1 lượt AI [🔴 · M]

- **Triệu chứng:** `PATCH /api/admin/users/{id}/plan {planCode:"PRO"}` → quota 200000, AI call đầu tiên OK, lượt 2 → 429; `GET /api/admin/users/{id}/quota` → planCode=DEFAULT.
- **Repro:** Cấp PRO user 58 → `GET /api/ai-speaking/quota` (PRO ✓) → 1 lượt AI → `GET /api/admin/users/58/quota` ⇒ planCode=DEFAULT.
- **Nguyên nhân gốc (xác nhận file:dòng):**

  **Bước 1 — Admin tạo subscription nhưng xoá wallet:**
  - `AdminManagementService.java:253-261` — INSERT subscription PRO với `ends_at=null` (mở).
  - `AdminManagementService.java:264` — **xoá wallet** `DELETE FROM user_ai_token_wallets WHERE user_id=?`.
  - Kết quả: subscription PRO tồn tại, nhưng wallet row biến mất.

  **Bước 2 — AI call đầu tiên (assertAllowed OK):**
  - `QuotaService.java:64-88` `assertAllowed()` → `buildSnapshotReadOnly()` → `computeAccruedWalletBalance()` tính ảo ngày 1 → dailyGrant token → `remainingSpendable > 0` → cho phép.

  **Bước 3 — applyUsageDebit chạy sau AI call:**
  - `QuotaService.java:113-152` `applyUsageDebit()`:
    - Dòng 128: `ensureWalletRow(userId)` — tạo wallet mới với balance=0 (wallet vừa bị xoá).
    - Dòng 129-131: đọc `currentBalance = 0`.
    - Dòng 138-143: `UPDATE ... balance = GREATEST(0, 0 - tokens) = 0`.
    - Dòng 145-151: `remaining = 0` → **gọi `downgradePaidPlansToDefault(userId, now)`**.

  **Bước 4 — Downgrade:**
  - `QuotaService.java:492-494` `downgradePaidPlansToDefault()` → gọi `endSubscriptionsPaid()`.
  - `QuotaService.java:497-505` `endSubscriptionsPaid()`: `UPDATE user_subscriptions SET status='ENDED'` WHERE `plan_code IN ('PRO','ULTRA')` AND `status='ACTIVE'` → **kết thúc subscription PRO vừa tạo**.
  - `QuotaService.java:508-519` `provisionDefaultSubscription()` → tạo DEFAULT.

  **Root cause cốt lõi:** `applyUsageDebit()` dùng DB wallet balance thực tế (0 sau khi xoá) để quyết định downgrade, trong khi `assertAllowed()` dùng balance ảo tính bằng `computeAccruedWalletBalance()`. **Hai đường không đồng bộ** → wallet rỗng ngay từ đầu → mọi lượt AI đầu tiên đều downgrade.

  Lưu ý: `SubscriptionReconcileJob.java:41-48` **KHÔNG phải** thủ phạm — job chỉ xử lý FREE trial expired và PRO/ULTRA có `ends_at <= now` (subscription vừa tạo có `ends_at=null` → không trong query).

- **Hướng sửa (2 tùy chọn, khuyến nghị Option A):**

  **Option A — `updateUserPlan()` không xoá wallet, tạo wallet với số dư ngày đầu:**
  ```java
  // AdminManagementService.java dòng 264 — THAY THẾ "DELETE FROM user_ai_token_wallets":
  // Không xoá wallet; thay bào đặt balance bằng dailyGrant ngày đầu
  Long dailyGrant = jdbcTemplate.queryForObject(
      "SELECT daily_token_grant FROM subscription_plans WHERE code = ?", Long.class, code);
  long initialBalance = dailyGrant != null ? dailyGrant : 0L;
  jdbcTemplate.update("""
      INSERT INTO user_ai_token_wallets (user_id, balance, last_accrual_local_date)
      VALUES (?, ?, CURRENT_DATE)
      ON CONFLICT (user_id) DO UPDATE
        SET balance = EXCLUDED.balance,
            last_accrual_local_date = EXCLUDED.last_accrual_local_date,
            updated_at = CURRENT_TIMESTAMP
      """, userId, initialBalance);
  ```

  **Option B — `applyUsageDebit()` accrues wallet trước khi debit:**
  - Trong `applyUsageDebit()`, trước `ensureWalletRow()`, gọi `accrueWalletThroughToday(userId)` để đồng bộ balance thực tế với balance ảo.
  - Rủi ro: thêm write vào hot-path (đã comment S-4 pool concern).

- **Phạm vi/rủi ro:** Tất cả user được admin gán PRO/ULTRA. Wallet delete là ý đồ đúng (reset), nhưng cần tạo lại với balance khởi đầu.
- **Test bao phủ cần thêm:** Cấp PRO → dùng AI 3 lượt liên tiếp → `GET quota` vẫn PRO.
- **Nghiệm thu:** Sau 3 lượt chat liên tiếp, `GET /api/admin/users/{id}/quota` → planCode=PRO, không 429.
- **Liên quan:** Không trùng wave/REMEDIATION cũ (vấn đề mới phát hiện).

---

### TF-1 — INTERNAL hiển thị "unlimited" ≠ enforcement [🔴 · M · CẦN XÁC MINH]

- **Triệu chứng:** `GET /api/admin/users/62/quota` → `INTERNAL_UNLIMITED, remaining 999,999,999`; nhưng `POST /api/v2/teacher/grading/submissions/{id}/ai-grade` → 429 "Tổ chức đã dùng hết ngân sách".
- **Repro:** Đăng nhập testgv03 → AI grading → 429; admin panel user 62 hiển thị unlimited.

- **Code đã xác nhận:**
  - `QuotaService.java:64-67`: `assertAllowed()` returns early nếu `snap.unlimitedInternal()` → **KHÔNG** gọi org-pool check ở dòng 85. Nếu user thực sự INTERNAL, họ KHÔNG bị 429 từ org-pool qua đường này.
  - `QuotaService.java:85-87`: `orgQuotaService.wouldExceedOrgPool(userId, estimatedMinTokens)` — chỉ đến nếu không INTERNAL.

- **Hai khả năng cần xác minh:**

  **Khả năng A (nghi cao nhất):** User testgv03 ≠ user 62 trong admin panel. testgv03 có subscription thực tế là TEACHER/FREE, không phải INTERNAL → `assertAllowed()` không skip → org pool check → 429. Admin panel hiển thị user khác.

  **Khả năng B:** Org ATB `pool_unlimited` flag chưa được set đúng (`monthly_token_pool=0` → `poolBlocks()` trả true cho mọi request có `est > 0`). Đây trùng với bug P-14 trong full audit: "P-14 (org-pool ignores pool_unlimited)". Xem `OrgQuotaService.wouldExceedOrgPool()`.

  **Khả năng C:** Endpoint ai-grade có guard riêng ngoài `QuotaService.assertAllowed()`.

- **Hướng sửa (sau khi xác minh):**
  - **Nếu A:** Hiển thị đúng userId trong admin panel; đảm bảo testgv03 có INTERNAL subscription nếu cần unlimited.
  - **Nếu B (P-14):** `OrgQuotaService.wouldExceedOrgPool()` → xem logic `poolBlocks()`: nếu `pool <= 0` và `cfg.unlimited() = false` → trả `est > 0` (true) → sửa: nếu org chưa cấu hình pool → không chặn (mặc định unconfigured = unlimited).
  - **Nếu cả hai đúng:** Fix cả hai.

- **Phạm vi:** Ảnh hưởng toàn bộ org teacher dùng AI grading/mock-exam/speaking khi org pool chưa config.
- **Test:** org pool=0 unconfigured → AI grading không 429; org pool đã hết → 429 đúng.
- **Nghiệm thu:** Teacher org "ATB" dùng AI grading → 200 (không 429).
- **Liên quan:** P-14 full audit `audit/full-2026-06-24/`; wave8 `OrgQuotaService`.

---

## 4. Chi tiết P1 (🟠/🟡)

---

### H-3 — `user.id = "undefined"` [✅ ĐÃ FIX — verified]

- **Verify kết quả (đọc code thực):**
  - `frontend/src/app/v2/login/page.tsx` ✅ dùng `user.userId`
  - `frontend/src/app/v2/register/page.tsx` ✅
  - `frontend/src/app/login/LoginClient.tsx` ✅
  - `frontend/src/app/register/page.tsx` ✅
  - `backend/.../user/dto/AuthResponse.java` — field tên là `userId` (Long), không phải `id` ✅
- **Trạng thái:** ĐÃ FIX TRỌN. Chờ Amplify deploy để verify trên prod.
- **M-2 (PostHog identify("undefined")):** Cũng đã xử lý — gốc là H-3; guard thêm ở `useTracking.identifyUser` (`if userId !== 'undefined'`). Khi H-3 deploy, M-2 biến mất hoàn toàn.

---

### M-1 — Org dashboard 0/0 lần đầu sau login [🟠 · S]

- **Triệu chứng:** `/v2/org/` vừa login → Ghế 0/0, 0 lớp, 0 GV, tiêu đề "Tổ chức". Sau navigate rồi quay lại → đúng.
- **File:** `frontend/src/app/v2/org/page.tsx:33-54`
- **Nguyên nhân gốc (xác nhận):**
  ```typescript
  // page.tsx:33
  const load = useCallback(async () => { ... }, [])  // deps rỗng []
  // page.tsx:54
  useEffect(() => { void load() }, [load])
  ```
  `useCallback` deps rỗng → `load` function stable. Nhưng Zustand `persist` middleware khởi động **async** từ localStorage. Nếu component mount trước khi Zustand rehydrate xong, bất kỳ logic nào trong `load` phụ thuộc vào persisted state sẽ thấy giá trị rỗng/mặc định.

  **Cụ thể nghi:** `getOrgSummary()` gọi `GET /api/org` — backend lấy orgId từ JWT claim (không từ body). JWT hợp lệ → backend trả đúng. **Nhưng** nếu axios interceptor cần header `X-Org-Id` từ store (kiểm tra `frontend/src/lib/*.ts`) mà store chưa hydrate → header thiếu → backend trả org rỗng.

  Hoặc đơn giản hơn: component render cycle đầu tiên xảy ra trước khi `useEffect` + `load()` async hoàn thành → UI hiện state default (summary=null → 0/0). Đây là bình thường, nhưng kết quả sau load vẫn sai → nghĩa là API call đầu trả dữ liệu sai (org rỗng).

- **Hướng sửa (2 bước):**
  1. Thêm loading skeleton đúng (đã có `setLoading(true)`) — kiểm tra conditional render đang dùng `summary` hay `loading` để hiển thị số 0.
  2. **Nếu API thực sự trả 0 ở call đầu:** Kiểm tra liệu `getOrgSummary()` có cần orgId trong header. Nếu cần, đọc từ store *sau khi* hydrate:
     ```typescript
     // Dùng useEffect với explicit dependency khi orgId hydrate
     const orgId = useUserStore(s => s.orgId)
     useEffect(() => { if (orgId) void load() }, [orgId, load])
     ```
- **Nghiệm thu:** Login → `/v2/org/` → số liệu đúng ngay ở lần load đầu tiên, không cần navigate.
- **Liên quan:** H-3 fix (orgId trong store giờ đúng hơn).

---

### F-2 — `refreshToken` trong body login/me [🟡 · S · CẦN XÁC MINH]

- **Code đã đọc (AuthController.java):**
  - Login: `isMobileRequest(httpRequest) ? authResp : stripRefreshToken(authResp)` — web nhận stripped.
  - Register: tương tự.
  - `/me`: `attachTokens=false` → refreshToken=null trong response.
- **Kết luận:** Logic strip ĐÃ TỒN TẠI. FIX_PLAN ghi nhận lỗi này có thể từ test E2E dùng User-Agent không khớp `isMobileRequest()`.
- **Cần xác minh:** Kiểm tra `isMobileRequest()` logic — nếu dùng header `X-Mobile-App` hay `User-Agent` để phân biệt. Test script có set header này không? Nếu test script dùng `curl` thông thường và `isMobileRequest()` trả false → refreshToken đã strip → không leak. Test có thể đã sai.
- **Hướng sửa nếu leak thực:** Chỉ set refreshToken httpOnly cookie; xoá field khỏi `AuthResponse` DTO hoàn toàn (thay bằng `void` response body cho refresh endpoint).
- **Nghiệm thu:** `POST /api/auth/login` từ browser → body không có `refreshToken` field (hoặc null).

---

### MUT-1 — `dayOfWeek` 0–6 lệch ISO [🟡 · S]

- **Triệu chứng:** dayOfWeek convention 0=Thứ2…6=CN, khác ISO 1–7. Value 7 → 400.
- **File:** `backend/.../teacher/service/ClassScheduleService.java:296`
- **Nguyên nhân gốc:**
  - Validate: `if (req.dayOfWeek() < 0 || req.dayOfWeek() > 6)` → reject 7 (CN trong ISO).
  - Map sang Java: `toPatternDow()` trả `DayOfWeek.of(dayOfWeek + 1)` (0→Mon, 6→Sun) — convention nội bộ 0-based.
  - FE form dùng convention nào? Cần kiểm tra `frontend/src/app/v2/.../schedule`. Nếu FE giả định ISO 1-7, CN sẽ gửi 7 → 400.
- **Hướng sửa (đề xuất ISO 1-7):**
  - `UpsertPatternRequest.java`: validate `1 <= dayOfWeek <= 7`.
  - `ClassScheduleService.java`: `DayOfWeek.of(req.dayOfWeek())` (ISO 1=Mon, 7=Sun, mapping tự nhiên).
  - FE: đồng bộ gửi 1–7 (T2=1, CN=7).
  - Migration: kiểm tra DB có stored patterns cũ theo 0–6 không — nếu có, cần data migration.
- **Nghiệm thu:** Tạo pattern thứ Sáu (ISO 5) → sessions sinh đúng thứ Sáu; gửi 7 (CN) → 200 OK sinh đúng CN; gửi 8 → 400 message rõ.

---

### F-1 — Date-only param → 500 (nên 400) [🟡 · S]

- **Triệu chứng:** `GET /api/v2/teacher/class-schedule/week?from=2026-06-22` → 500; cần `...T00:00:00`.
- **File:** `backend/.../teacher/controller/ClassScheduleController.java:37`
- **Nguyên nhân gốc:**
  - `@DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)` → chỉ chấp nhận datetime format.
  - Date-only string → Spring ném `MethodArgumentTypeMismatchException` → không có handler trong `GlobalExceptionHandler` → 500.
- **Hướng sửa (2 tùy chọn):**
  - Option A: Thêm handler trong `GlobalExceptionHandler`:
    ```java
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<...> handleTypeMismatch(MethodArgumentTypeMismatchException e) {
        return badRequest("Tham số '" + e.getName() + "' sai định dạng. Dùng ISO 8601 datetime: 2026-06-22T00:00:00");
    }
    ```
  - Option B: Đổi param sang `@DateTimeFormat(iso = DateTimeFormat.ISO.DATE)` + accept cả date-only.
- **Nghiệm thu:** `?from=2026-06-22` → 400 với message hướng dẫn format đúng.

---

### U-1 — Guard sai-role /v2/* "mềm" [🟡 · S]

- **Triệu chứng:** ADMIN mở được shell `/v2/org`, `/v2/teacher` (render giao diện không phải role mình).
- **File:** `frontend/src/middleware.ts:37-42` (`v2RoleHome`) và logic kiểm role cho `/v2/*`.
- **Nguyên nhân gốc:** Middleware check role không chặn đủ các sub-path của `/v2/org/*` và `/v2/teacher/*` cho role không phù hợp. Role ADMIN bypass được vì có thể có `orgRole` claim hoặc middleware không enforce path prefix.
- **Hướng sửa:**
  - Xem nhánh xử lý `/v2/org/*` và `/v2/teacher/*` — thêm điều kiện chặn rõ ràng:
    ```typescript
    if (pathname.startsWith('/v2/org') && v2Role !== 'MANAGER' && v2Role !== 'OWNER') {
      return NextResponse.redirect(new URL(v2RoleHome(v2Role), req.url))
    }
    if (pathname.startsWith('/v2/teacher') && v2Role !== 'TEACHER') {
      return NextResponse.redirect(new URL(v2RoleHome(v2Role), req.url))
    }
    ```
  - Tương tự cho STUDENT, ADMIN.
- **Nghiệm thu:** ADMIN → `/v2/org/` → redirect `/v2/admin/users`; TEACHER → `/v2/org/` → redirect `/v2/teacher/`.

---

### U-2 — Lỗi lộ path API [🟡 · S]

- **Triệu chứng:** Màn lỗi hiện `"Forbidden GET /api/v2/teacher/classes"`.
- **File:** `frontend/src/app/v2/org/page.tsx` và các trang teacher/org — error state dùng `{error}` raw.
- **Hướng sửa:** Thay message kỹ thuật bằng text thân thiện:
  ```typescript
  // Thay vì: setError(e.message) // "Forbidden GET /api/..."
  // Dùng: 
  const msg = e?.status === 403 ? 'Bạn không có quyền truy cập trang này.' : 'Đã xảy ra lỗi. Vui lòng thử lại.'
  setError(msg)
  ```
- **Nghiệm thu:** Error state không còn chuỗi `GET /api/...` hay `Forbidden` raw.

---

### TF-2 — `evaluateAssignment` path param sai tên [🟡 · S]

- **File:** `backend/.../teacher/controller/TeacherController.java:178-183`
- **Nguyên nhân:** Path param `{assignmentId}` nhưng thực tế cần `StudentAssignment.id` (submissionId). Nhầm tên → 409 "Học viên không thuộc lớp".
- **Hướng sửa:** Đổi `@PathVariable Long assignmentId` → `@PathVariable Long submissionId`; cập nhật FE gọi đúng; sửa message lỗi khi sai.
- **Nghiệm thu:** Chấm bài bằng submissionId đúng → 200; message lỗi rõ nghĩa khi sai.

---

### TF2-1 — Co-teacher add không kiểm org [🟡 · S]

- **File:** `backend/.../teacher/service/TeacherService.java:310-332`
- **Nguyên nhân:** `addCoTeacher()` chỉ kiểm role TEACHER/ADMIN, không kiểm org membership — teacher ngoài org vẫn được thêm.
- **Quyết định sản phẩm cần:** nếu yêu cầu cách ly tenant → thêm:
  ```java
  if (!orgMemberRepository.isMemberOfOrg(coTeacherId, class_.getOrg().getId())) {
      throw new BadRequestException("Giáo viên không thuộc tổ chức này.");
  }
  ```
- **Nghiệm thu:** Thêm co-teacher ngoài org → 400; cùng org → 200.

---

### PRON — Pronunciation 500 thiếu audio [🟡 · S]

- **File:** `backend/.../speaking/controller/PronunciationController.java:31-39`
- **Nguyên nhân:** `@RequestPart("audio")` required — nếu thiếu, Spring throw `MissingServletRequestPartException` (400-mappable) nhưng multipart parse fail trước controller → 500. Không có explicit validation message.
- **Hướng sửa:** Thêm `@ExceptionHandler(MissingServletRequestPartException.class)` → trả 400 với message "Trường 'audio' là bắt buộc."; hoặc làm `audio` optional và validate thủ công trong controller.
- **Nghiệm thu:** `POST /api/speaking/pronunciation-check` không có audio → 400 message rõ.

---

## 5. Chi tiết P2 (⚪) — gom 1 PR

### SCH-1 — PATCH CANCELLED làm mất room
- **File:** `ClassScheduleService.java` — `updateSession()` set room vô điều kiện kể cả khi status=CANCELLED.
- **Fix:** `if (req.status() != CANCELLED || req.room() != null) session.setRoom(req.room());`

### SCH-2 — defaultRoom không xuống session
- **File:** `ClassScheduleService.java` — `regenerate()` dòng 222: `room(mode == ONLINE ? null : p.getDefaultRoom())` — code đúng.
- **Cần xác minh:** Kiểm tra xem `p.getDefaultRoom()` có null vì pattern chưa set không. Nếu UI create-pattern không gửi defaultRoom → mọi session sinh ra đều null room. Fix ở FE form create pattern.

### F-3 — Lỗi không nhất quán Spring vs RFC7807
- **Fix:** `GlobalExceptionHandler` cần bao phủ mọi exception path kể cả từ Spring Security (403/401 từ `@PreAuthorize`) → format về RFC7807 uniform.

### TF2-2 — Status code không nhất quán
- **Fix:** Rà controller teacher — POST tạo tài nguyên → 201; DELETE → 204; GET → 200.

### U-4 — "Session compromised" wording
- **Fix:** Đổi thành "Phiên đã hết hạn, vui lòng đăng nhập lại."

### L-1 — Link "Trợ giúp" trỏ về home
- **File:** `frontend/src/components/ui-v2/GaSidebar.tsx` hoặc layout tương ứng — href "Trợ giúp" trỏ về `/v2/teacher/` hoặc `/v2/org/`.
- **Fix:** Đổi href về `/help` hoặc external link docs; hoặc ẩn link cho đến khi có trang help.

### L-2 — Notification key thô
- **File:** FE `frontend/src/app/v2/notifications/page.tsx` — render `notification.type` raw.
- **Fix:** Map type enum sang text tiếng Việt: `{ LEARNER_PLAN_UPDATED: 'Gói học của bạn đã được cập nhật', ... }`.

### L-3 — Dialog thiếu Description
- **File:** Các `<DialogContent>` dùng Radix — thêm `<DialogDescription className="sr-only">...</DialogDescription>` hoặc `aria-describedby`.

### L-4 — DE chưa dịch đủ
- **File:** `frontend/messages/de.json` — nhiều key còn chưa dịch.
- **Fix:** Điền đủ các key hiển thị main UI cho DE (hoặc fallback về VI thay vì hiện key thô).

### L-5 — Tab "Học tập" cho Org-Manager
- **File:** `frontend/src/app/v2/profile/page.tsx:17-21`
- **Fix:** Ẩn tab "learning" nếu role là MANAGER/OWNER/ADMIN:
  ```typescript
  const tabs = allTabs.filter(t => t.id !== 'learning' || role === 'STUDENT' || role === 'TEACHER')
  ```

---

## 6. CẦN XÁC MINH

| ID | Câu hỏi | Cách xác minh |
|----|---------|---------------|
| **TF-1** | testgv03 thực sự có INTERNAL subscription, hay admin panel hiển thị user khác? | `GET /api/admin/users/{testgv03_id}/quota` xem `planCode` thật. Kiểm P-14 OrgPoolGuard config |
| **F-2** | refreshToken thực sự leak trong response web, hay test script không set đúng header? | `curl -X POST .../auth/login` với cookie jar → kiểm body JSON |

---

## 7. ĐỪNG ĐỤNG — đã verify OK

Auth 6 role; cross-tenant 403; rate-limit; ledger; FSRS; onboarding; mock-exam; TTS; interview; auto-demote; join-request; chấm bài tay; lessons CRUD; schedule CRUD (pattern+session, không tính SCH-1/2); owner role-change; admin invoice; messaging; register/forgot-password; free-grade ẩn danh.

---

## 8. Thứ tự thực thi đề xuất

### Batch 1 — P0 Env (nhanh, không cần review code)
- H-1/H-2: Kiểm env EC2 (`AI_SERVER_URL`, Bedrock keys) → có thể fix ngay không cần deploy.
- TF-1: Xác minh user ID + P-14 → fix config org pool.

### Batch 2 — P0 Code (1 PR nhỏ cho MON-1)
- MON-1: `AdminManagementService.java:264` — thay DELETE wallet bằng INSERT/ON CONFLICT với dailyGrant. Test 3 lượt AI.

### Batch 3 — P1 Backend (gộp 1 PR)
- F-1, PRON, TF-2, TF2-1, MUT-1 (sau quyết định convention)

### Batch 4 — P1 Frontend (gộp 1 PR)
- U-1, U-2, M-1

### Batch 5 — P2 Cleanup (gộp 1 PR)
- SCH-1, SCH-2, F-3, TF2-2, U-4, L-1..L-5

### Batch 6 — Sau verify
- F-2, H-3 prod verification sau deploy
