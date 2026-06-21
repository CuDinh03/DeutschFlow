# B2B / Org Role Model — Analysis + Checklist (2026-06-22)

> Nguồn: codebase audit (backend `backend/` + frontend `frontend/`). Mục đích: rà mô hình vai trò B2B
> (trung tâm tiếng Đức / org), xác định role cần có, và **không để rơi mất "role-change"** khi làm B2B.

## TL;DR — 3 sự thật cốt lõi
1. **2 lớp vai trò độc lập.** GLOBAL (`users.role` enum `STUDENT|TEACHER|ADMIN`) ⟂ ORG (`org_members.role` = **String thô** `OWNER|ADMIN|TEACHER|STUDENT` + 1 role mồ côi `ACCOUNTANT`). **KHÔNG có enum `OrgRole`** → vocab đã trôi (ACCOUNTANT chỉ có trong `OrgGuard`).
2. **KHÔNG có endpoint đổi org-role nào.** Org-admin chỉ invite (teacher-only), remove, import CSV — **không promote/demote được**. Mọi đổi role phải qua **global-admin** `POST /api/admin/organizations/{id}/members` (re-add). `/v2/org/roles` chỉ là toast stub.
3. **UI đổi global-role bị THOÁI HOÁ.** Legacy `/admin/users` có `<select>` role → `PATCH /admin/users/{id}/role` (chạy được). Bản live **`/v2/admin/users` MẤT** (badge read-only, modal chỉ PATCH plan). **Backend endpoint còn nguyên + có audit log.**

## Mô hình hiện tại (tham chiếu file)
- **Global role:** `user/entity/User.java:40,112` (enum) → JWT `role` (`JwtService.java:147`) → `@PreAuthorize` + `middleware.ts requiredRole():41`. Đổi qua `AdminManagementController.java:211` (`updateUserRole:635`, ADMIN-only, audit `admin.user.role.updated`).
- **Org role:** `OrgMember.java:22` (String, default `"TEACHER"`), guard `OrgGuard.java` (`assertOrgAdmin:39` = {OWNER,ADMIN}; `assertOrgFinance:51` = {OWNER,ADMIN,ACCOUNTANT}). JWT `orgRole` chỉ để FE routing (backend không tin). `middleware.ts normalizeOrgRole:82` chỉ nhận `OWNER|ADMIN`.
- **Nhận org role:** invite teacher (`OrgController.java:79`, hardcode TEACHER) · admin add (`AdminOrgService.addMember:211`, nhận mọi role trừ ACCOUNTANT) · owner attach lúc tạo org · remove (`OrgController.java:103`, auto-demote global TEACHER→STUDENT).
- **Entitlement/seat/pool:** `Organization` (`seatLimit` 0=∞, `monthlyTokenPool` 0=∞, `validUntil`, `status`); seat đếm STUDENT, **không enforce trên invite-accept**; `OrgPoolGuard` → 429 khi cạn pool.

## Ma trận role cần-vs-có
| Role trung tâm cần | Có? | Gap |
|---|---|---|
| Owner | ✅ | Org không tự set được; không có chuyển-quyền-sở-hữu |
| Manager/Org-Admin | ⚠️ | ADMIN = OWNER y hệt (cả 2 trong ADMIN+FINANCE set) → không có tier "quản lý không thấy tài chính" |
| Teacher | ✅ | OK (không vào /org by design) |
| Student | ✅ | Chỉ vào qua admin-add/CSV; chưa self-serve org-code |
| Billing/Accountant | ⚠️ nửa vời | `ACCOUNTANT` chỉ trong `OrgGuard.FINANCE_ROLES` — **không assign được, không UI, 0 FE hit** |
| Observer/read-only | ❌ | Chưa mô hình hoá |

## ✅ CHECKLIST (ưu tiên)
### P0 — Coherence & regression (làm trước)
- [ ] **P0-1 (S) — KHÔI PHỤC đổi global-role ở v2 admin.** ⬅️ *role-change được ghi nhận tại đây.* Live `/v2/admin/users` mất nút đổi role; backend `PATCH /api/admin/users/{userId}/role` còn nguyên + audited. Thêm control vào `v2/admin/users/UserDetailModal.tsx` (tham chiếu legacy `app/admin/users/page.tsx:183`).
- [ ] **P0-2 (S) — Quyết ACCOUNTANT:** finish (P1-2) hoặc gỡ khỏi `OrgGuard.java:25,51` (role nửa-enforce = bug authz tiềm ẩn).
- [ ] **P0-3 (S) — Tạo enum `OrgRole` (BE)** + permission map dùng chung, thay String thô ở `OrgGuard`/`OrgMembershipService`/`AdminOrgService`/`OrgInvitationService` (vocab đang trùng ≥4 chỗ).

### P1 — Đóng gap org tự quản role (yêu cầu chính)
- [ ] **P1-1 (M) — Đổi org-role trong org.** `PATCH /api/org/members/{userId}/role` + `OrgMembershipService.changeRole`, gate `assertOrgAdmin`; chỉ OWNER set/clear OWNER. Wire `/v2/org/roles` (thay toast) + `orgApi.updateMemberRole`. **#1 capability thiếu.**
- [ ] **P1-2 (M) — Invite có chọn role (TEACHER/ADMIN/ACCOUNTANT).** Thêm `role` vào invite (`OrgController.java:79`, `OrgInvitationService.java:45`); `/v2/org/invitations` đã có selector.
- [ ] **P1-3 (S) — Tách quyền OWNER vs ADMIN** (hoặc document parity) — encode trong permission map P0-3.
- [ ] **P1-4 (M) — Org-admin phân teacher vào lớp.** Endpoint org-scoped (tái dùng `ClassTeacher`/`addCoTeacher` nhưng gate `assertOrgAdmin` thay `assertPrimaryTeacher`); thay toast `/v2/org/teachers` "Phân công".

### P2 — Hardening
- [ ] **P2-1 (S)** — enforce seat-limit trên invite-accept (`OrgInvitationService.java:168`) — hiện bypass được.
- [ ] **P2-2 (S)** — audit-log mọi org membership mutation (chỉ global `updateUserRole` có).
- [ ] **P2-3 (S)** — `middleware.ts normalizeOrgRole:82` nếu ACCOUNTANT/Observer cần vào `/org/*`.
- [ ] **P2-4 (M)** — Observer/read-only org role (chỉ khi product cần).

### Ranh giới UI đổi role (chốt)
- **Global role** = việc của **platform** → chỉ ở **global-admin** (`/v2/admin/users`, P0-1). Org OWNER **không** được mint global ADMIN.
- **Org role** = việc của **org-admin** → `/v2/org/roles` (P1-1). Hai lớp không chạm nhau (trừ side-effect STUDENT→TEACHER khi dạy, giữ nguyên).
