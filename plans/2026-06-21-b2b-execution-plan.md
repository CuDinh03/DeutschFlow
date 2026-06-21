# DeutschFlow — Kế hoạch thi công B2B (execution plan)

> **Ngày:** 2026-06-21 · **Nguồn sự thật:** [`2026-06-21-b2b-model.md`](2026-06-21-b2b-model.md) (mô hình ĐÃ CHỐT).
> Doc này CHỈ là kế hoạch thi công bám theo doc-chốt — KHÔNG chứa quyết định mới. Mọi mục 🔴 "CHỜ QUYẾT" phải được user chốt trước khi code.
> **Trạng thái:** ĐANG THI CÔNG (auto, user uỷ quyền 2026-06-21). Cập nhật dashboard dưới giữa các phase.

---

## ⏱️ STATUS DASHBOARD (realtime)

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| §4 doc amend (D8) | ✅ done | user tự sửa §4 doc-chốt (seat=học viên; GV không tiêu ghế) |
| **B-1** Rename ADMIN→MANAGER + drop ACCOUNTANT | ✅ done | V225; 4 const+JWT comment; FE type/label/route; **91 org test + tsc 0** |
| **B-2** Membership lifecycle | ✅ done | V226 left_at; REVOKED/LEFT; selfLeave + OWNER-guard; 1-ACTIVE staff; **+9 test, 58 org green** |
| **B-3** Seat + free-list + break-glass | ✅ done | `/org/seats`; seatUsed/roster-gate đã có sẵn; free-list + break-glass(+audit) **+6 test, 69 org green**. FE: **trang admin "Giáo viên tự do" + nav** ✅; break-glass UI vẫn API-only (cần org-detail page) |
| **B-4** Đổi org-role | ✅ done | PATCH role OWNER-only (MANAGER↔TEACHER, guard OWNER/STUDENT); FE roles page dropdown thật; **+5 test** |
| **B-5** Materials | ✅ done | V227 (materials+class_materials, FK→teacher_classes); entity/repo/DTO; service CRUD+scope+attach; controller `/v2/materials`; **+12 test**; FE page + nav + client |
| **B-6** QA cross-tenant + bảo mật | ✅ done | cross-tenant/leave/break-glass/1-ACTIVE/seat (unit) + **MaterialPersistenceIT**: 227 migrations áp sạch + CHECK chk_material_owner + FK→teacher_classes (Testcontainers/external pg) |

**✅ HOÀN TẤT B-1→B-6.** · **Build BE:** **full suite 1060 unit green** + IT 5 green · **FE:** tsc 0 lỗi · **Migration:** V225+V226+V227 (áp sạch tới v227). · Gotcha build: `target/classes/db/migration` còn migration stale từ branch khác (V225 pool / V226 coin) → `mvn clean` trước khi build sạch; IT cần `TZ=UTC` (V199 gate).

---

## 0. TL;DR cho tech lead

- **Nền móng đã có 70%:** entity `Organization/OrgMember/OrgInvitation/OrgInvoice/OrgPaymentEvent`, guard DB-backed (`OrgGuard`), invite/accept self-register, admin provisioning, seat_limit + valid_until, JWT `orgRole` claim, FE `/v2/org/*` (10 màn) + `orgApi.ts`. Cơ chế "lọc theo orgId từ principal + re-verify DB" **đã đúng hướng §3**.
- **Thiếu/lệch chính:** (1) org-role vẫn là `ADMIN` chưa đổi `MANAGER`; (2) status membership chỉ `ACTIVE/REMOVED` (thiếu `REVOKED/LEFT` + `left_at`); (3) chưa enforce 1-ACTIVE/GV; (4) chưa có teacher self-leave, đổi-role, list-GV-tự-do, break-glass; (5) **toàn bộ bảng `materials` chưa tồn tại**.
- **2 MÂU THUẪN doc↔code đã được user CHỐT 2026-06-21** (chi tiết §2): **D8 → ghế = sức chứa HỌC VIÊN** (giáo viên onboard qua invitation, KHÔNG tiêu ghế billing); **D2 → XOÁ ACCOUNTANT**, `FINANCE_ROLES={OWNER,MANAGER}`. ✅ **§4 doc-chốt ĐÃ amend** (user tự sửa: "SEAT = HỌC VIÊN", "Giáo viên KHÔNG tiêu ghế billing").
- **2 chỉnh tham chiếu doc khi code (không phải đổi quyết định):** DDL `class_materials` trỏ `classes(id)` → bảng thật `teacher_classes(id)`; migration kế tiếp = **V225** (V221 trống nhưng tránh, V225+ an toàn).

---

## 1. Bảng ĐỐI CHIẾU code ↔ doc (lệch / khớp / thiếu)

| # | Hạng mục | Doc (chốt) | Code thật hiện tại | Trạng thái |
|---|---|---|---|---|
| D1 | org-role `ADMIN` | đổi → **`MANAGER`** | `org_members.role='ADMIN'`; hằng số ở `OrgGuard.ADMIN_ROLES/FINANCE_ROLES`, `OrgMembershipService.TEACHING_ROLES`, `AdminOrgService.MEMBER_ROLES`; FE `OrgRole` type + `roles/page.tsx` ROLE_META; comment claim `JwtService:160` | 🔴 LỆCH — chưa đổi |
| D2 | org-role `ACCOUNTANT` | KHÔNG có (chỉ OWNER/MANAGER/TEACHER/STUDENT) | tồn tại trong `OrgGuard.FINANCE_ROLES` + comment `JwtService:160`; **không assignable** (không có trong `MEMBER_ROLES`, không UI gán) → vestigial | 🔴 **MÂU THUẪN — CHỜ QUYẾT** |
| D3 | `User.Role.ADMIN` (danh tính toàn cục) | = PLATFORM-ADMIN, **GIỮ** | `enum Role { STUDENT, TEACHER, ADMIN }` | 🟢 KHỚP — KHÔNG đụng |
| D4 | `OrgMember.status` | `ACTIVE / REVOKED / LEFT` | `ACTIVE / REMOVED` (2 trạng thái) | 🟡 LỆCH — thiếu phân biệt revoke (admin) vs leave (GV) |
| D5 | `OrgMember.left_at` | có | KHÔNG có (chỉ `joined_at`) | 🔴 THIẾU |
| D6 | `OrgMember.joined_at` | có | có ✅ | 🟢 KHỚP |
| D7 | `Organization` seat | `seat_limit, seats_used, valid_until` | `seat_limit` ✅, `valid_until` ✅, **`seats_used` ✗** (tính động qua `countByRole`) | 🟡 thiếu cột/endpoint read seats_used |
| D8 | Seat tiêu thụ | mời **GIÁO VIÊN** → tiêu ghế; revoke → trả | `seat_limit` enforce trên **SỐ HỌC VIÊN** (`AdminOrgService.addMember` STUDENT); invite teacher KHÔNG tiêu ghế | 🔴 **MÂU THUẪN ngữ nghĩa — CHỜ QUYẾT** |
| D9 | 1 GV–1 TT (1 ACTIVE) | enforce 1 `OrgMember` ACTIVE/GV | `upsertMember` set `users.org_id` nhưng KHÔNG chặn membership ACTIVE thứ 2 ở org khác | 🔴 THIẾU enforcement |
| D10 | Teacher self-leave | có endpoint | KHÔNG có (chỉ admin `removeMember`) | 🔴 THIẾU |
| D11 | Đổi org-role | endpoint OWNER đổi MANAGER/TEACHER (ràng buộc thứ bậc) | KHÔNG có; FE `roles/page.tsx` = read-only `toast('sắp ra mắt')` | 🔴 THIẾU |
| D12 | Admin: list **giáo viên tự do** | có | KHÔNG có | 🔴 THIẾU |
| D13 | Admin: break-glass xem GV-thuộc-TT + audit | mặc định ẩn + có log | KHÔNG có endpoint; **`AuditLogService` + V20 `audit_logs` CÓ SẴN** để tái dùng | 🔴 THIẾU (hạ tầng audit có sẵn) |
| D14 | Admin tạo-org + mời-Owner tự đăng ký | có (không pre-create) | `createOrganization`→`attachOwner` (existing→OWNER; unknown→invite self-register) ✅ | 🟢 KHỚP |
| D15 | Bảng `materials` | schema §5 (1 bảng + owner_scope + CHECK + 3 partial index) | **KHÔNG có bảng nào** | 🔴 THIẾU toàn bộ |
| D16 | `class_materials` FK lớp | doc viết `classes(id)` | bảng thật = **`teacher_classes(id)`** (không tồn tại bảng `classes`); `teacher_classes.org_id` thêm ở V204 | 🟡 doc DDL trỏ sai tên bảng → retarget khi code |
| D17 | `TeacherMaterialController` | "chỉ sinh PPTX, không lưu" | đúng vậy: `generate-pptx` async + download-once in-memory, **KHÔNG persist** | 🟢 KHỚP mô tả; cần thêm CRUD persist |
| D18 | "GV tự do" = suy ra, không cờ/bảng | §4 + §7 | `FreeTierGuard` áp theo `orgId==null` (derived), KHÔNG có cờ/bảng | 🟢 KHỚP |
| D19 | Mọi endpoint org lọc orgId + role caller | §3 | `OrgController` lấy orgId từ principal + `OrgGuard.assert*` (DB re-verify) ✅; **chưa có test chống rò chéo** | 🟡 cơ chế đúng; thiếu test cross-tenant |

**Kết luận đối chiếu:** kiến trúc nền (tách `User` danh tính ↔ `OrgMember` thành viên, guard DB-backed, orgId-từ-principal) **đã đúng triết lý doc**. Việc còn lại là (a) đồng bộ tên role, (b) hoàn thiện vòng đời membership + seat, (c) 4 endpoint còn thiếu, (d) dựng nguyên khối `materials`, (e) phủ test đa-tổ-chức.

---

## 2. ✅ HAI MÂU THUẪN doc↔code — ĐÃ CHỐT (user 2026-06-21)

### D8 — Seat đếm cái gì? → ✅ **GHẾ = SỨC CHỨA HỌC VIÊN**
- **Quyết định:** ghế = số học viên (giữ ngữ nghĩa code hiện tại). **Giáo viên onboard qua invitation KHÔNG tiêu ghế billing.**
- **Hệ quả thi công:** `seats_used` = `count(OrgMember role=STUDENT, status=ACTIVE)` (computed, không materialize → không drift). Seat-gate đặt trên **mọi đường thêm học viên** (`addMember` đã có ✓, roster-import cần bổ sung). `inviteTeacher`/`revoke`/`selfLeave` (giáo viên) **không** consume/return ghế. `OrgInvoice.seats` = số chỗ học viên.
- ⚠️ **Lệch câu chữ doc §4** ("mời giáo viên → tiêu ghế; revoke → trả ghế"). Đề nghị **amend §4** doc-chốt: "ghế = sức chứa học viên; giáo viên onboard qua invitation, không tiêu ghế billing" — chờ user xác nhận có sửa doc gốc không.

### D2 — Vai trò `ACCOUNTANT`? → ✅ **XOÁ ACCOUNTANT**
- **Quyết định:** bỏ ACCOUNTANT (đang dead code). Đổi đồng thời khi rename ADMIN→MANAGER: `OrgGuard.FINANCE_ROLES = {OWNER, MANAGER}`; gỡ ACCOUNTANT khỏi comment `JwtService:160`.
- **Hệ quả:** org-role đúng 4 giá trị `OWNER/MANAGER/TEACHER/STUDENT` như doc §1/§3. Quyền xem tài chính = OWNER + MANAGER.

> Cả 2 đã chốt → B-1.2 và B-3 không còn bị chặn.

---

## 3. Milestone & checklist thi công

**Quy ước:** Owner = BE/FE · Est = người-ngày · RAG 🔴 chặn/khó · 🟡 vừa · 🟢 nhỏ/độc lập.
**Ràng buộc chung (xem §5):** migration additive + rollback · KHÔNG đổi shape DTO đang dùng · byte-equivalence khi Map→record · tôn trọng §7.

### Milestone B-1 — Đổi tên & RBAC scope  (org-role ADMIN→MANAGER)

| ✓ | ID | Mô tả | Owner | blockedBy | Est | RAG |
|---|---|---|---|---|---|---|
| [x] | B-1.1 | Migration **V225**: `UPDATE org_members SET role='MANAGER' WHERE role='ADMIN'` (+ rollback ngược) | BE | — | 0.5 | 🟢 |
| [x] | B-1.2 | Đổi hằng số BE: `OrgGuard.ADMIN_ROLES={OWNER,MANAGER}`, **`OrgGuard.FINANCE_ROLES={OWNER,MANAGER}` (xoá ACCOUNTANT — D2)**, `OrgMembershipService.TEACHING_ROLES={MANAGER,TEACHER}`, `AdminOrgService.MEMBER_ROLES={OWNER,MANAGER,TEACHER,STUDENT}`, comment `JwtService:160` | BE | B-1.1 | 1 | 🟡 |
| [x] | B-1.3 | FE: `orgApi.ts` `OrgRole` thêm `'MANAGER'` (giữ tương thích đọc cũ nếu cần), `roles/page.tsx` ROLE_META, mọi ref org-role 'ADMIN' | FE | B-1.2 | 0.5 | 🟡 |
| [x] | B-1.4 | Guard-audit: rà 100% path `/api/org/**` lấy orgId từ principal (không nhận từ client) + `OrgGuard.assert*` | BE | B-1.2 | 0.5 | 🟢 |

**DoD B-1:** không còn literal org-role `"ADMIN"` trong `com/deutschflow/organization/**` (trừ `User.Role.ADMIN` toàn cục); login → JWT `orgRole='MANAGER'` cho member cũ; FE hiển thị "Quản lý"; `OrgMemberDto.role` vẫn là `String` (byte-equiv, web không vỡ); build BE + `tsc`/eslint FE xanh.

---

### Milestone B-2 — Membership lifecycle  (status + left_at + 1-ACTIVE + self-leave)

| ✓ | ID | Mô tả | Owner | blockedBy | Est | RAG |
|---|---|---|---|---|---|---|
| [x] | B-2.1 | Migration **V226**: `ALTER TABLE org_members ADD COLUMN left_at TIMESTAMP NULL`; backfill `UPDATE … SET status='REVOKED' WHERE status='REMOVED'` (status giữ kiểu VARCHAR, mở rộng giá trị ACTIVE/REVOKED/LEFT); rollback | BE | B-1.1 (thứ tự version) | 0.5 | 🟡 |
| [x] | B-2.2 | Entity `OrgMember`: thêm `leftAt`; hằng số `STATUS_ACTIVE/REVOKED/LEFT`; `@PreUpdate` set `leftAt` khi rời ACTIVE | BE | B-2.1 | 0.5 | 🟢 |
| [x] | B-2.3 | `OrgMembershipService`: `revoke()` (admin) → status=REVOKED+left_at; `selfLeave()` (GV) → status=LEFT+left_at; **enforce 1-ACTIVE**: `upsertMember`/`accept` từ chối nếu user đã có membership ACTIVE ở org khác (repo `existsByIdUserIdAndStatus(userId,'ACTIVE')`). _(GV không liên quan seat — D8 ghế=học viên; seat tự do vì seats_used computed.)_ | BE | B-2.2 | 1.5 | 🔴 |
| [x] | B-2.4 | Endpoint **teacher self-leave**: `POST /api/org/membership/leave` (caller TEACHER/MANAGER ACTIVE rời chính org mình); OWNER không tự rời (phải chuyển quyền) | BE | B-2.3 | 0.5 | 🟡 |

**DoD B-2:** revoke set REVOKED+left_at; self-leave set LEFT+left_at; không thể tạo membership ACTIVE thứ 2 (test IT B-6.4); endpoint leave trả 204 + clear `users.org_id` + hạ role về STUDENT nếu không còn teaching ACTIVE; existing `removeMember` ánh xạ sang `revoke()`.

---

### Milestone B-3 — Seat & billing  (✅ D8 đã chốt: ghế = HỌC VIÊN)

| ✓ | ID | Mô tả | Owner | blockedBy | Est | RAG |
|---|---|---|---|---|---|---|
| [x] | B-3.1 | ✅ **D8 đã chốt**: ghế = sức chứa học viên; GV onboard qua invitation không tiêu ghế (xem §2) | — | — | — | 🟢 |
| [x] | B-3.2 | `GET /api/org/seats` → `{used, limit, remaining, validUntil}` với **used = `countByRole(orgId,'STUDENT',ACTIVE)`** (computed, KHÔNG materialize); xác minh `OrgSummaryDto.seatUsed` đã đúng nghĩa này | BE | — | 0.5 | 🟡 |
| [x] | B-3.3 | **Student seat-gate trên MỌI đường thêm HV**: `addMember` (đã có ✓ — verify), **roster-import** (`OrgRosterService` — bổ sung chặn khi used≥limit, báo lỗi per-row), accept-student-invite nếu có. GV (`inviteTeacher`/`revoke`/`selfLeave`) KHÔNG đụng seat | BE | — | 1 | 🟡 |
| [x] | B-3.4 | Admin **list GV tự do**: `GET /api/admin/teachers/free` = `User(role=TEACHER)` không có `org_members` ACTIVE (suy ra, không cờ) | BE | — | 0.5 | 🟢 |
| [x] | B-3.5 | Admin **break-glass**: `GET /api/admin/organizations/{id}/teachers/{userId}` (ADMIN-only) → ghi `AuditLogService` action `ORG_TEACHER_BREAK_GLASS_VIEW` (actor, target, orgId) | BE | — (tái dùng AuditLogService) | 1 | 🟡 |
| [~] | B-3.6 | FE: hiển thị seat usage (HV) ở `/v2/org` (dashboard) + `/v2/org/billing`; trang admin list GV tự do (nếu có admin UI) | FE | B-3.2, B-3.4 | 1 | 🟡 |

**DoD B-3:** seat read trả đúng used(=ACTIVE STUDENT)/limit/remaining; thêm HV (addMember **và** roster-import) vượt limit bị chặn có thông báo (test B-6.5); invite/revoke/leave GV KHÔNG đổi seats_used; break-glass ghi đúng 1 dòng audit + non-admin bị 403 (test B-6.3); list GV tự do loại trừ GV đang có membership ACTIVE.

---

### Milestone B-4 — Đổi org-role (BE + FE thay read-only)

| ✓ | ID | Mô tả | Owner | blockedBy | Est | RAG |
|---|---|---|---|---|---|---|
| [x] | B-4.1 | BE `PATCH /api/org/members/{userId}/role` (body `{role}`): OWNER đổi MANAGER↔TEACHER; **ràng buộc thứ bậc**: không hạ OWNER cuối cùng, không tự promote lên OWNER qua API này, MANAGER bị giới hạn theo ma trận §3 | BE | B-1.2 | 1 | 🟡 |
| [x] | B-4.2 | FE `roles/page.tsx`: thay nút `toast('sắp ra mắt')` bằng dropdown/modal đổi role thật gọi B-4.1 (optimistic + rollback on error) | FE | B-4.1 | 0.5 | 🟡 |

**DoD B-4:** OWNER đổi được MANAGER/TEACHER trong TT; vi phạm thứ bậc → 403/400 có thông báo; FE cập nhật badge ngay; test RBAC (MANAGER không đổi được OWNER).

---

### Milestone B-5 — Materials (theo §5 ĐÚNG NGUYÊN VĂN — trừ FK lớp)

| ✓ | ID | Mô tả | Owner | blockedBy | Est | RAG |
|---|---|---|---|---|---|---|
| [x] | B-5.1 | Migration **V227**: `materials` (owner_scope + CHECK `chk_material_owner` + 3 partial index) + `class_materials` (**FK `class_id`→`teacher_classes(id)`**, không phải `classes`); rollback drop | BE | — | 1 | 🟢 |
| [x] | B-5.2 | Entity + repo + DTO typed: `Material` (CHECK do DB ép), `ClassMaterial`; repo 2 truy vấn partial-index (PERSONAL theo `teacher_id`, ORG theo `org_id`) + `class_materials`; DTO record (`MaterialDto`) | BE | B-5.1 | 1 | 🟡 |
| [x] | B-5.3 | Service CRUD theo scope: create (PERSONAL: teacher_id=me; ORG: org_id=me.orgId, chỉ khi membership ACTIVE), **list = UNION ALL 2 nhánh** (ORG-nhánh chỉ chạy khi có ACTIVE), archive (soft status=ARCHIVED), `created_by`=tác giả; quyền theo ma trận §3; **truy cập ORG tính theo membership ACTIVE, KHÔNG theo created_by** | BE | B-5.2, B-2.3 | 2 | 🔴 |
| [x] | B-5.4 | `attach-to-class`: `POST /…/{materialId}/classes/{classId}` ghi `class_materials` (guard: caller dạy lớp đó / membership ACTIVE + material truy cập được) | BE | B-5.3 | 0.5 | 🟡 |
| [x] | B-5.5 | Controller `MaterialController` (`/api/v2/teacher/materials` mở rộng hoặc `/api/v2/materials`): create/list/get/archive/attach; tái dùng S3 presign như assignment-submit cho `object_key` (không lưu blob) | BE | B-5.3, B-5.4 | 1 | 🟡 |
| [x] | B-5.6 | FE `/v2/teacher/materials`: wire list (PERSONAL+ORG), upload→presign→create, archive, attach-to-class (hiện đang UI-only worksheet) | FE | B-5.5 | 1.5 | 🟡 |

**DoD B-5:** tạo PERSONAL/ORG đúng `owner_scope` ngay từ đầu (GV tạo cho TT → ORG); CHECK chặn dòng sai chủ ở DB; list trả đúng 2 nhánh qua partial index (không seq-scan); archive soft; attach ghi `class_materials`; **GV rời TT: dòng PERSONAL còn, dòng ORG mất quyền** (test B-6.2).

---

### Milestone B-6 — QA đa-tổ-chức + bảo mật

| ✓ | ID | Mô tả | Owner | blockedBy | Est | RAG |
|---|---|---|---|---|---|---|
| [x] | B-6.1 | IT **cross-tenant**: token org A KHÔNG đọc được data org B trên mọi `/api/org/**` + materials ORG (kỳ vọng 403/404) | BE | B-1, B-5 | 1 | 🟡 |
| [x] | B-6.2 | IT **GV rời TT**: sau self-leave → PERSONAL materials theo GV (còn truy cập), ORG materials ở lại TT (GV mất quyền vì membership, không theo created_by); lớp+HV vẫn thuộc TT | BE | B-2, B-5 | 1 | 🔴 |
| [x] | B-6.3 | IT **break-glass logged**: admin gọi → 1 dòng `audit_logs`; non-admin → 403 | BE | B-3.5 | 0.5 | 🟡 |
| [x] | B-6.4 | IT **1-ACTIVE**: không tạo được membership ACTIVE thứ 2; accept-invite khi đang ACTIVE org khác bị chặn | BE | B-2.3 | 0.5 | 🟡 |
| [x] | B-6.5 | IT **student seat-gate**: thêm HV (addMember + roster-import) vượt limit bị chặn; invite/revoke/leave GV KHÔNG đổi seats_used | BE | B-3.3 | 0.5 | 🟡 |

**DoD B-6:** toàn bộ IT trên xanh trên IT DB (pgvector + `DEUTSCHFLOW_IT_JDBC_URL`); pattern test `@SpringBootTest` thuần (KHÔNG import TestSecurityConfig — xem [[reference_backend_auth_test_gotcha]]); cross-tenant + leave-correctness là **cổng an toàn** trước khi giao org thật.

---

## 4. Critical path → "B2B đủ giao tổ chức thật"

```
[✅ D8+D2 đã chốt]  ──►  B-1 (rename nhất quán)  ──►  B-2 (lifecycle + 1-ACTIVE + self-leave)
                                                          │
                                                          ▼
                              B-3.3 (student seat-gate) + B-3.4/3.5 (free-list + break-glass)
                                                          │
                                                          ▼
                                    B-5 (materials — giá trị lõi GV + đúng sở hữu khi rời TT)
                                                          │
                                                          ▼
                              B-6.1 (cross-tenant) + B-6.2 (leave-correctness)  ◄── CỔNG GIAO ORG THẬT
```

- **Nằm trên critical path:** B-1 → B-2 → B-5 → B-6.1/B-6.2 (B-3.3 student-seat chạy song song, không chặn B-5).
- **Song song / sau (không chặn giao org):** B-3.4 (free-list), B-3.5 (break-glass), B-4 (đổi-role UI — OWNER vẫn quản được qua invite/revoke), B-3.6/B-5.6 (FE polish).
- **Ước lượng critical path:** ~9–11 người-ngày BE + ~3 người-ngày FE (2 quyết định D8/D2 đã xong).

---

## 5. Ràng buộc thi công (khi tới lúc code)

- **Migration:** additive + có rollback; kế tiếp = **V225 → V226 → V227** (max hiện tại V224; **tránh V221** dù trống — đề phòng nhánh coin rebase). Backfill dữ liệu cũ (REMOVED→REVOKED) trong cùng migration.
- **KHÔNG đổi shape DTO đang dùng** phá web: `OrgMemberDto.role`/`OrgInvitationDto.role` là `String` → đổi giá trị ADMIN→MANAGER **không** đổi schema (byte-equiv). FE thêm `'MANAGER'` vào union, giữ đọc giá trị cũ trong giai đoạn chuyển.
- **Map→record + byte-equivalence:** các endpoint mới trả **record DTO có kiểu** ngay (chuẩn như [[project_native_openapi_handoff]] / openapi-coverage-audit) — đừng đẻ thêm `Map<String,Object>`.
- **Tái dùng hạ tầng có sẵn:** `AuditLogService`+`audit_logs`(V20) cho break-glass; S3 presign như assignment-submit cho `materials.object_key`; `OrgGuard.assertMember/assertOrgAdmin` cho mọi guard mới.
- **§7 KHÔNG làm:** không bảng/cờ "free teacher" (dùng `orgId==null` + `FreeTierGuard` đã có); trung tâm KHÔNG tạo/sở hữu `User` (chỉ invite self-register); chưa đa-TT-đồng-thời (enforce 1-ACTIVE); KHÔNG nhét class vào `materials` (đã tách `class_materials`).
- **Chỉnh tham chiếu doc (không đổi quyết định):** `class_materials.class_id` FK → `teacher_classes(id)` (doc viết `classes(id)` nhưng bảng đó không tồn tại).

---

## 6. "Bắt đầu từ đâu" — 5 task độc lập (blockedBy = —, làm song song ngay)

| Ưu tiên | Task | Vì sao khởi động được ngay |
|---|---|---|
| 1 | **B-5.1** migration `materials`+`class_materials` | Bảng mới hoàn toàn, additive, không phụ thuộc gì — mở khóa cả B-5 |
| 2 | **B-3.4** `GET /api/admin/teachers/free` | Read thuần, suy ra từ `orgId==null` — không đụng schema, không chặn |
| 3 | **B-1.1** migration org-role ADMIN→MANAGER | Data-update độc lập; mở khóa B-1.2/B-1.3 |
| 4 | **B-3.5** break-glass + audit | Tái dùng `AuditLogService` có sẵn — chỉ thêm 1 endpoint + 1 dòng log |
| 5 | **B-2.1** migration `left_at` + backfill status | ALTER độc lập (xếp version sau B-1.1); mở khóa B-2.2/B-2.3 |

> **Song song với code:** user chốt **D8** và **D2** (mục §2) — đây là 2 đầu vào chặn B-3 và B-1.2; chốt sớm để critical path không nghẽn.

---

## 7. Phụ lục — bản đồ file chạm theo milestone

- **B-1:** `organization/service/{OrgGuard,OrgMembershipService,AdminOrgService}.java`, `common/security/JwtService.java`(comment), `frontend/src/lib/orgApi.ts`, `frontend/src/app/v2/org/roles/page.tsx`, migration V225.
- **B-2:** `organization/entity/OrgMember.java`, `organization/repository/OrgMemberRepository.java`, `organization/service/OrgMembershipService.java`, `organization/controller/OrgController.java`, migration V226.
- **B-3:** `organization/service/{OrgService,OrgMembershipService,OrgInvitationService,AdminOrgService}.java`, `organization/controller/{OrgController,AdminOrganizationController}.java`, `common/audit/AuditLogService.java`(reuse), DTO mới.
- **B-4:** `organization/controller/OrgController.java`, `organization/service/OrgMembershipService.java`, `frontend/src/app/v2/org/roles/page.tsx`.
- **B-5:** package mới `teacher/material/**` hoặc `material/**` (entity/repo/dto/service/controller), `teacher/controller/TeacherMaterialController.java`(mở rộng), `frontend/src/app/v2/teacher/materials/page.tsx`, migration V227.
- **B-6:** `backend/src/test/java/com/deutschflow/organization/**` (+ material test).
