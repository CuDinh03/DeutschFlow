# DeutschFlow — Kế hoạch THỰC THI khắc phục Role-interaction Audit + bổ sung test

> Ngày: 2026-06-23 · Nguồn: `plans/2026-06-23-role-interaction-audit-and-test-plan.md` (audit gốc)
> Trạng thái: **đã verify với source code thật** (06-23). File này là bản THỰC THI — chứa code change cụ thể, test cần thêm, và doc-edit áp vào plan gốc.
> Phương án đã chốt: **1A · 2A · 3B · 4A · 5A**.

---

## 0. Quyết định đã chốt

| # | Vấn đề (chỗ chưa hợp lý) | Phương án | Loại thay đổi |
|---|--------------------------|-----------|---------------|
| 1A | G-1 fix trả 403 mâu thuẫn quy ước "404 chống dò id" | Trả **404 NotFound**, đối xứng GET `/{id}` | Code + test + doc |
| 2A | G-1 `book` gate `isAuthenticated()` → mọi role book được | Khoá **`hasRole('STUDENT')`** ở controller + guard org (404) ở service (defense in depth) | Code + test |
| 3B | G-1 severity HIGH vượt blast-radius thực | Ghi lại **MEDIUM (impact) / HIGH (fix-priority)** | Doc |
| 4A | G-4 nói "tiêu quota tự do" (sai — có hard-cap) | **Chỉ sửa câu chữ**, giữ LOW | Doc |
| 5A | Test plan bỏ sót nhiều endpoint có thật | **Bổ sung đủ** suite (materials/certificates/invitations/detail/leave/429) | Test |

Bất biến giữ nguyên: MANAGER/OWNER **không** kế thừa TEACHER; Finance OWNER-only; orgId luôn từ principal.

---

## 1. G-1 — Booking org-teacher (1A + 2A + 3B)

### 1.1 Hiện trạng đã verify
- `TeacherSessionController.book` — `@PreAuthorize("isAuthenticated()")` ⇒ mọi user đã đăng nhập book được.
  File: `backend/src/main/java/com/deutschflow/teacher/controller/TeacherSessionController.java` (method `book`, dòng ~31–39).
- `TeacherSessionService.bookSession` — chỉ `findByIdWithUser(teacherProfileId)`, **không** check `orgId`.
  File: `backend/src/main/java/com/deutschflow/teacher/service/TeacherSessionService.java` (dòng ~35–59).
- Đối xứng cần noi theo: `TeacherMarketplaceController.getTeacherProfile` ném `NotFoundException` khi `profile.getUser().getOrgId() != null` (404).

### 1.2 Code change A — controller: khoá role STUDENT (2A)
File: `TeacherSessionController.java`, method `book`.

```java
// BEFORE
@PostMapping
@PreAuthorize("isAuthenticated()")
public ResponseEntity<TeacherSessionDto> book(
        @AuthenticationPrincipal User student,
        @RequestBody @Valid BookRequest req) {

// AFTER
@PostMapping
@PreAuthorize("hasRole('STUDENT')")   // 1:1 marketplace là sản phẩm B2C cho học viên
public ResponseEntity<TeacherSessionDto> book(
        @AuthenticationPrincipal User student,
        @RequestBody @Valid BookRequest req) {
```
> Nếu sau này cần ADMIN book hộ → `@PreAuthorize("hasAnyRole('STUDENT','ADMIN')")`. KHÔNG thêm TEACHER/MANAGER/OWNER.

### 1.3 Code change B — service: ẩn org-teacher khỏi booking, trả 404 (1A)
File: `TeacherSessionService.java`, method `bookSession`. `NotFoundException` đã được import sẵn (dòng 4) — không cần import mới.

```java
TeacherProfile profile = profileRepository.findByIdWithUser(teacherProfileId)
        .orElseThrow(() -> new NotFoundException("Giáo viên không tồn tại"));

// 1A: Org teachers không nằm trên marketplace công khai — ẩn khỏi booking luôn
// (đối xứng GET /api/v2/teachers/{id}). Dùng CÙNG message với "không tồn tại"
// để student không phân biệt được org-teacher có thật hay không (chống dò id).
if (profile.getUser().getOrgId() != null) {
    throw new NotFoundException("Giáo viên không tồn tại");
}

long price = profile.getHourlyRateVnd() * durationMinutes / 60L;
```

### 1.4 Severity (3B)
Ghi lại G-1: **Impact = MEDIUM** (booking chỉ tạo `TeacherSession` PENDING, KHÔNG trigger thanh toán; org-teacher nhìn thấy ở incoming-sessions) · **Fix-priority = HIGH** (authz-bypass trên write-endpoint, vượt rào B2B↔B2C). Xem doc-edit §4.

### 1.5 Test thay đổi/bổ sung (Suite H)
- **H2 (sửa kỳ vọng):** STUDENT `POST /api/teacher-sessions` với `teacherProfileId` của org-teacher → **404** (trước đây ghi 403).
- **H2b (mới — vector 2A):** TEACHER / MANAGER / OWNER `POST /api/teacher-sessions` (target bất kỳ) → **403** (chặn bởi `hasRole('STUDENT')`).
- **H3 (giữ):** STUDENT book public tutor (`org_id IS NULL`) hợp lệ → 200 PENDING.
- Seed cần: 1 org-teacher có `TeacherProfile` (để lấy `teacherProfileId`) thuộc org1; tutor public `tutor.anna@local.test` (org_id NULL).

---

## 2. G-4 — grade-image (4A, chỉ sửa câu chữ, KHÔNG code)

Đã verify: `GradingController.gradeImage` CÓ 2 lớp chặn — `orgPoolGuard.assertOrgPoolAvailable(...)` (hard-cap pool token cấp-org → 429) + `freeTierGuard.assertAndConsume(...)` (cap OCR-ảnh theo ngày cho gói free). Không IDOR (stateless, không đọc/ghi record student khác).

Sửa mô tả (xem doc-edit §4): bỏ chữ "tiêu quota org-pool **tự do**"; thay bằng "có hard-cap `OrgPoolGuard` + `FreeTierGuard`, **chỉ thiếu gắn lớp (classId/studentId) để audit/quy chiếu**". Giữ mức **LOW**. Không đổi code đợt này (đề xuất classId optional để mở ngoặc tương lai, không bắt buộc).

---

## 3. Bổ sung test coverage (5A)

> Quy ước status (cập nhật §5 plan gốc): thêm **429** = vượt hạn mức (org-pool/free-tier).
> Pattern: plain `@SpringBootTest` RBAC IT, **KHÔNG** import TestSecurityConfig (memory `reference_backend_auth_test_gotcha`); chạy qua pgvector ngoài + `DEUTSCHFLOW_IT_JDBC_URL` + `TZ=UTC`.

### 3.1 Suite F mở rộng — IDOR teacher materials (PPTX jobs)
Endpoint (đã verify `TeacherMaterialController`, gate method-level `hasRole('TEACHER') or ADMIN` + `assertOwnsJob`):
`GET /api/v2/teacher/materials/jobs/{jobId}`, `/jobs/{jobId}/sse`, `/jobs/{jobId}/download`.
- **F6:** Teacher B đọc/SSE/download `jobId` của Teacher A → **403** (`assertOwnsJob`).
- **F7:** STUDENT gọi bất kỳ `/api/v2/teacher/materials/**` → **403** (method gate).
- **F8:** `jobId` không tồn tại → 404; `download` lần 2 (đã getAndRemove) → 404.

### 3.2 Suite L (MỚI) — Certificates
Teacher API (`/api/v2/teacher/certificates`, gate `hasRole('TEACHER')`): `POST` issue · `GET /class/{classId}` · `POST /{certificateId}/revoke`.
Public (`/api/public/certificate/{token}`, permitAll): `GET` verify.
- **L1:** Teacher issue cert cho student **trong lớp mình** → 200; cho student/lớp **không thuộc mình** → 403 (`issue(teacherId, …)` ownership).
- **L2:** Teacher A `GET /class/{classId}` của lớp Teacher B → **403**.
- **L3:** Teacher A `POST /{certificateId}/revoke` cert do Teacher B cấp → **403**.
- **L4:** MANAGER/OWNER/STUDENT gọi `/api/v2/teacher/certificates/**` → **403** (`hasRole('TEACHER')`).
- **L5 (public):** token hợp lệ → 200 và **chỉ** trả field in trên cert (tên + level + center + code), **không** PII khác; token sai/giả → 404; xác nhận không enumerate được (token là secret).

### 3.3 Suite B mở rộng — Org invitations (admin-side)
Endpoint (đã verify `OrgController`): `GET /api/org/invitations`, `DELETE /api/org/invitations/{id}`.
- **B6:** OWNER/MANAGER `GET /api/org/invitations` → 200 (chỉ invitation của org mình); TEACHER/STUDENT → 403 (`assertOrgAdmin`).
- **B7:** OWNER/MANAGER `DELETE /invitations/{id}` của org mình → 200; của org khác → 403/404 (verify orgId từ principal); TEACHER/STUDENT → 403.

### 3.4 Suite D mở rộng — Cross-org 404 cho bản detail
Endpoint: `GET /api/org/classes/{id}`, `GET /api/org/students/{id}` (đã verify `assertOrgAdmin` + orgId từ principal).
- **D9:** OWNER/MANAGER đọc `/classes/{id}` & `/students/{id}` thuộc org mình → 200; **của org khác → 403/404**.
- **D10:** TEACHER/STUDENT gọi 2 endpoint detail trên → 403.

### 3.5 Suite A mở rộng — selfLeave non-OWNER
Endpoint: `POST /api/org/membership/leave` (đã verify `selfLeave`).
- **A12:** MANAGER/TEACHER/STUDENT (ACTIVE member) selfLeave → 200/204 + status=LEFT. (Đối chiếu A8: OWNER selfLeave → 400 "chuyển quyền trước".)

### 3.6 Suite M (MỚI) — Hạn mức quota/pool (429)
- **M1:** Org đã cạn pool token → `POST /api/v2/teacher/grading/grade-image` → **429** (`OrgPoolGuard`).
- **M2:** Org đã cạn pool → `POST /api/v2/teacher/materials/generate-pptx` → **429**.
- **M3:** Gói free vượt cap OCR-ảnh ngày → `grade-image` → **429** (`FreeTierGuard`); B2C/non-org/pool=0 → luôn qua (không 429).
- **M4:** `POST /api/v2/teacher/grading/submissions/{id}/ai-grade` khi cạn pool → 429.

### 3.7 §6 checklist — bổ sung param
Thêm vào ma trận quét IDOR các định danh còn thiếu: **`jobId` (UUID)**, **`certificateId`**, **`token`** (public cert). Chạy cùng ma trận (a/b/c/d) như các id khác.

---

## 4. Doc-edit cần áp vào PLAN GỐC (`...audit-and-test-plan.md`)

1. **TL;DR G-1 (dòng bảng §0):** đổi cột Mức từ `**HIGH**` → `**MEDIUM** (impact) / **HIGH** (fix-priority)`; thêm cuối ô tóm tắt: "Booking endpoint còn gate `isAuthenticated()` → khoá `hasRole('STUDENT')`."
2. **§4 G-1 — "Fix đề xuất":** đổi "thêm org-guard … 403" → "thêm org-guard ném **404 NotFound** (đối xứng GET `/{id}`, cùng message chống dò id) **và** khoá controller `hasRole('STUDENT')`."
3. **TL;DR G-4 + §4 G-4:** thay "tiêu quota org-pool **tự do**" → "có hard-cap `OrgPoolGuard` + `FreeTierGuard`, chỉ thiếu gắn lớp để audit".
4. **§5 quy ước:** thêm dòng "**429** = vượt hạn mức (org-pool/free-tier)."
5. **Suite H2:** đổi kỳ vọng sau fix 403 → **404**; thêm H2b/H3 (xem §1.5).
6. **§6:** thêm `jobId|certificateId|token` vào danh sách param.
7. (Tùy chọn) thêm tham chiếu file này ở đầu plan gốc: "Khắc phục: xem `2026-06-23-role-interaction-remediation-and-test-additions.md`".

---

## 5. Thứ tự thực thi + checklist

1. [ ] Code G-1: `TeacherSessionController.book` → `hasRole('STUDENT')` (1.2).
2. [ ] Code G-1: `TeacherSessionService.bookSession` → guard org ném 404 (1.3).
3. [ ] Áp 7 doc-edit vào plan gốc (§4).
4. [ ] Viết test security-cao trước: H2/H2b/H3 (G-1), Suite L (certificates public + IDOR), F6–F8 (materials IDOR).
5. [ ] Viết tiếp: B6/B7, D9/D10, A12, Suite M (429).
6. [ ] Seed bổ sung: org-teacher có TeacherProfile (cho H2); cert mẫu (cho L5); async job mẫu 2 teacher (F6).

---

## 6. Verification (bắt buộc trước khi đóng)
- [ ] `./mvnw -q compile` backend pass sau 2 code change.
- [ ] IT mới chạy xanh qua `@SpringBootTest` (không TestSecurityConfig), `DEUTSCHFLOW_IT_JDBC_URL` + `TZ=UTC`.
- [ ] Smoke thủ công G-1: STUDENT book org-teacher → 404; TEACHER book → 403; STUDENT book tutor B2C → 200.
- [ ] Regression: H6 (org-teacher set availability → 200) vẫn pass — fix G-1 KHÔNG đụng availability.
- [ ] Diff review: xác nhận không nới lỏng `hasRole('TEACHER')` ở bất kỳ `/api/v2/teacher/**` nào (G-3 vẫn nguyên tắc endpoint `/api/org/**` riêng).
