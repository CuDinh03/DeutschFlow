# DeutschFlow — KẾ HOẠCH TRIỂN KHAI E2E: Provisioning B2B (top-down)

> **Vai trò:** tech lead. **Mục tiêu:** thi công mô hình provisioning đã chốt ở `plans/2026-06-21-b2b-model.md` (§2.1/§2.2/§3/§6, bản sửa 2026-06-22) cho khớp **NOW (Phase 1)**.
> **Nguồn:** `b2b-model.md` (model) + `2026-06-22-week-deploy-plan.md` (deploy) + `docs/SESSION_SUMMARY_2026-06-22.md` (đối soát). **Bước này CHỈ lập plan — KHÔNG code.**
> **Trạng thái đã verify (2026-06-22) — dùng lại, không verify lại từ đầu:**
> - ✅ **Đã có:** `POST /admin/users` (tạo {ADMIN,TEACHER,STUDENT} + org {TEACHER,MANAGER}) · STUDENT pre-create qua CSV (`OrgRosterService:138`) · Lock `PATCH /admin/users/{id}/active` (`is_active`, `hasRole ADMIN`, reversible) · Seat=STUDENT (`OrgService`) · Finance OWNER-only.
> - 🔧 **Còn thiếu (build đợt này):** (1) cột `created_via`; (2) admin pre-create OWNER; (3) org-admin pre-create TEACHER trực tiếp.
> - ⏭ **FUTURE (KHÔNG build):** teacher self-signup (`created_via=SELF`).

---

## 0. TL;DR + Critical path

```
M0 (tách commit) ──► M1 (created_via NỀN) ──► M2 (admin tạo OWNER) ──► M3 (org tạo TEACHER) ──► M4 (ràng buộc & bảo mật) ──► M5 (E2E demo)
                                          └──────────────► (M2 ‖ M3 song song được sau M1) ──┘
```
**Critical path:** `M0 → M1 → {M2, M3} → M4 → M5`. M2 và M3 **song song được** sau khi M1 xong (khác file/đường). Estimate thô tổng: **~8–12 ngày-người** (BE nặng, FE vừa, test nặng ở M4/M5).

**Quy ước cột:** Owner = BE/FE/DB/QA · Mức = 🔴 critical-path / 🟡 quan trọng / 🟢 phụ · Est = S(≤0.5d)/M(~1d)/L(~2d).

---

## Ràng buộc thi công (BẮT BUỘC — ghi vào mọi task)

- [ ] **Migration additive + rollback.** Mọi thay đổi schema = thêm cột/bảng nullable, **không sửa migration cũ**, kèm script rollback trong comment. Fresh-replay phải xanh.
- [ ] **Không phá web (byte-equiv).** Khi đụng response/DTO đang dùng (B2C, admin/users, org/*): field mới là **additive**; nếu đổi response đang dùng → so byte-equiv hoặc gate sau cờ. `created_via` **không lộ** ra B2C DTO.
- [ ] **M0 tách commit TRƯỚC.** Working tree đang **trộn 3 luồng chưa commit** (role-change · QA-teacher FIX · admin/finance) → phải tách sạch trước khi thêm việc mới.
- [ ] **KHÔNG tự deploy/merge prod.** Code-complete trên branch; **deploy M1–M5 chỉ SAU khi `#143` đã lên prod** (week-plan A1). Mỗi lần tới prod cần user duyệt merge + mở SSH.
- [ ] **KHÔNG build teacher self-signup** (Phase-2). Chỉ chừa sẵn giá trị `created_via=SELF` để sau thêm endpoint, không migrate mô hình.
- [ ] **Provision ≠ own.** Mọi endpoint pre-create KHÔNG được trao quyền sở hữu/sửa danh tính cho org; teacher portable (rời TT = đóng membership, account sống).

---

## M0 — Dọn nền: tách commit working tree (3 luồng)

> **Gate Go/No-Go:** `git status` sạch + 3 commit tách bạch + tsc/test xanh ⇒ mới sang M1.

| ID | Mô tả | Owner | blockedBy | Est | Mức | DoD |
|---|---|---|---|---|---|---|
| **M0-T1** | Tách working tree thành commit sạch theo 3 luồng: (a) role-change DB/middleware + `V229` + seed; (b) QA-teacher FIX-1..4 (S3 presigned, material, teacher page, nav); (c) admin create/lock + finance OWNER-only + tách teacher↔owner | BE/FE | — | M | 🔴 | 3 commit/nhánh rạch ròi; `git status` sạch; `tsc`+`mvn test` xanh; mỗi commit build độc lập |
| **M0-T2** | Chốt nhánh base cho provisioning: nhánh `feat/b2b-provisioning` cắt từ `main` (đã có #143). Ghi rõ: deploy các mốc **sau** khi #143 lên prod | BE | M0-T1 | S | 🟡 | nhánh tạo từ `main`; note phụ thuộc deploy A1 |

- [ ] M0-T1  · [ ] M0-T2

---

## M1 — NỀN: cột `created_via` (provenance) + set ở MỌI đường tạo

> **Mục tiêu:** ghi nguồn tạo cho mọi `User`, **không ảnh hưởng quyền/sở hữu**. Đây là nền để Phase-2 self-signup không phải rework.
> **Gate Go/No-Go:** migration fresh-replay xanh + mọi đường tạo set đúng nguồn + backfill hợp lý + test ⇒ sang M2/M3.

| ID | Mô tả | Owner | blockedBy | Est | Mức | DoD |
|---|---|---|---|---|---|---|
| **M1-T1** | **Migration** `V230__user_created_via.sql` (additive): thêm `created_via VARCHAR(16)` **nullable** + CHECK ∈ `{ADMIN,OWNER,MANAGER,SELF,CSV}`. **Backfill** data cũ heuristic: có `org_members(STUDENT)`→`CSV`/`OWNER`? → mặc định an toàn `SELF` cho B2C cũ, `ADMIN` cho `users.role=ADMIN`, `OWNER/MANAGER/TEACHER` org-member → để `SELF` nếu không suy được (ghi rõ giả định). Rollback = `DROP COLUMN` (comment) | DB | M0 | M | 🔴 | fresh-replay + DB hiện tại apply sạch; rollback script; 0 NULL sau backfill (hoặc nullable cố ý + lý do) |
| **M1-T2** | **Entity**: thêm `createdVia` vào `User.java` (+ enum/hằng). **Không** thêm vào B2C/`/auth/me` DTO (giữ byte-equiv) | BE | M1-T1 | S | 🔴 | map cột; response đang dùng không đổi (verify byte-equiv) |
| **M1-T3** | **Set ở MỌI đường tạo** (enumerate đã verify): `AuthService.register`→`SELF` (+OAuth nếu có) · `AdminManagementService.createUser`→`ADMIN` · `OrgRosterService`(CSV)→`CSV` · `OrgInvitationService.registerInvitedUser`(invite-accept)→`OWNER`/`MANAGER` (suy từ `invitation.invited_by` role / context). **Audit** `TeacherCenterService` (xác minh có tạo User không) + xác nhận `OrgMembershipService` = **update-only** (không cần set) | BE | M1-T2 | M | 🔴 | mỗi đường tạo set đúng nguồn; liệt kê đủ 5 đường + ghi rõ đường nào update-only |
| **M1-T4** | **Test**: unit mỗi đường tạo set đúng `created_via`; test backfill phân bố hợp lý; assert `created_via` **không** vào path phân quyền | BE/QA | M1-T3 | M | 🟡 | test xanh; query DB phân bố hợp lý |

- [ ] M1-T1  · [ ] M1-T2  · [ ] M1-T3  · [ ] M1-T4

---

## M2 — ADMIN pre-create OWNER (+ trung tâm)

> **Kiến trúc đề xuất (ít rework):** mở rộng `AdminOrgService.createOrganization(ownerEmail)` (đã có) — đổi `attachOwner`: email mới → **pre-create account OWNER + đặt tạm-mật-khẩu** thay vì `inviteTeacher`. Giữ bất biến 1-OWNER (org tạo ra có đúng 1 owner). *(Không cần đụng `createUser` reject-OWNER nếu đi luồng org.)*
> **Gate Go/No-Go:** admin tạo 1 trung tâm có Owner **đăng nhập được** + test (new-email pre-create / existing-email attach) ⇒ sang M4/M5.

| ID | Mô tả | Owner | blockedBy | Est | Mức | DoD |
|---|---|---|---|---|---|---|
| **M2-T1** | **Chốt thiết kế**: reuse `POST /admin/organizations` (có `ownerEmail`) → `attachOwner` mới. Quyết: role platform của Owner = `TEACHER` (org-role OWNER), credential = tạm-mật-khẩu trả trong response (chưa có email provider — memory) | BE | M1 | S | 🔴 | design doc 1 trang trong PR; chọn “mở rộng createOrganization” (không endpoint mới) |
| **M2-T2** | **Implement**: `attachOwner` email-mới → tạo `User`(TEACHER, password tạm random) + `upsertMember(OWNER)` + `created_via=ADMIN`; email-cũ → vẫn attach. Giữ 1-OWNER invariant | BE | M2-T1 | M | 🔴 | admin tạo org→owner account tồn tại; test: new-email pre-create, existing-email attach, 1-owner giữ |
| **M2-T3** | **Credential delivery (MVP)**: trả tạm-mật-khẩu trong response cho admin (chuyển tay). *(Optional hardening: cờ `must_change_password` lần đầu — chỉ làm nếu rẻ.)* | BE | M2-T2 | S | 🟡 | admin nhận credential; (opt) force-change |
| **M2-T4** | **FE** màn admin “Tạo trung tâm + Owner” (`/v2/admin/organizations`): form name/slug/plan/seat + ownerEmail + ownerName → hiển thị tạm-mật-khẩu sau tạo | FE | M2-T2 | M | 🟡 | tạo được qua UI; hiển thị credential 1 lần |
| **M2-T5** | **IT**: admin tạo org+owner → owner login OK; RBAC non-admin→403; org-orphan (không gắn được owner) xử lý đúng | BE/QA | M2-T2 | S | 🟡 | IT xanh |

- [ ] M2-T1 · [ ] M2-T2 · [ ] M2-T3 · [ ] M2-T4 · [ ] M2-T5

---

## M3 — ORG-ADMIN pre-create TEACHER

> **Kiến trúc:** endpoint mới `POST /api/org/teachers` (pre-create) — OWNER/MANAGER tạo account teacher trực tiếp (không qua invite). `assertOrgAdmin`. **MANAGER KHÔNG tạo MANAGER** (giữ owner-only, khớp `changeRole`). `created_via` = role caller.
> **Gate Go/No-Go:** Owner/Manager tạo teacher → teacher login → **rời TT account vẫn sống** + IDOR test ⇒ sang M4.

| ID | Mô tả | Owner | blockedBy | Est | Mức | DoD |
|---|---|---|---|---|---|---|
| **M3-T1** | **BE endpoint** `POST /org/teachers` (email, displayName, tạm-mật-khẩu): `assertOrgAdmin` (OWNER+MANAGER); tạo `User`(TEACHER, password tạm) + `upsertMember(TEACHER)` + `created_via`=OWNER/MANAGER; chặn tạo MANAGER qua đây | BE | M1 | M | 🔴 | OWNER/MANAGER tạo teacher; account+membership; teacher login; tạo MANAGER→400 |
| **M3-T2** | **Portability**: tận dụng lifecycle V226 — teacher leave/revoke → membership đóng, **account sống** → free teacher. Verify materials: ORG ở lại / PERSONAL theo teacher | BE | M3-T1 | M | 🔴 | test leave→`User` còn + org-member LEFT; material scope đúng |
| **M3-T3** | **Guard danh tính**: xác nhận org-admin **KHÔNG** có đường sửa password/email/xoá account teacher (chỉ membership ops). Audit 24-endpoint org | BE/QA | M3-T1 | S | 🟡 | bảng audit: org chỉ membership/role/class ops, 0 identity-write |
| **M3-T4** | **FE** màn “Thêm giáo viên” (`/v2/org/teachers`): chọn **Pre-create** (email/name/tạm-pw) vs **Mời** (giữ luồng invite cũ) | FE | M3-T1 | M | 🟡 | org-admin tạo teacher qua UI; hiển thị tạm-mật-khẩu |
| **M3-T5** | **IT**: OWNER tạo teacher ✅ · MANAGER tạo teacher ✅ · MANAGER tạo manager ❌ · cross-org (org A tạo vào org B) → 403/404 | BE/QA | M3-T1 | M | 🟡 | IT xanh đủ 4 ca |

- [ ] M3-T1 · [ ] M3-T2 · [ ] M3-T3 · [ ] M3-T4 · [ ] M3-T5

---

## M4 — RÀNG BUỘC & BẢO MẬT (regression + isolation)

> **Gate Go/No-Go:** toàn bộ suite portability + cross-tenant + seat + lock xanh ⇒ sang M5.
> *(Không có doc cross-tenant-audit riêng → M4-T2 tự định nghĩa ma trận test.)*

| ID | Mô tả | Owner | blockedBy | Est | Mức | DoD |
|---|---|---|---|---|---|---|
| **M4-T1** | **Portability suite**: teacher (pre-created) leave → account survive + thành free; materials ORG ở lại TT, PERSONAL theo teacher (bám b2b-model §2/§5) | BE/QA | M3 | M | 🔴 | test xanh cả 2 material scope |
| **M4-T2** | **Cross-tenant IDOR suite** (tự định nghĩa): org A ≠ org B trên MỌI org endpoint — members/classes/materials/invoices + **pre-create** mới (M2/M3). Mỗi endpoint có ca wrong-org→403/404 | BE/QA | M2,M3 | L | 🔴 | ma trận endpoint×org-A/B đầy đủ; test xanh |
| **M4-T3** | **Seat=student bất biến**: pre-create teacher KHÔNG tăng seat; pre-create/CSV student tăng seat; verify `OrgService` count | BE/QA | M3 | S | 🟡 | test seat đúng |
| **M4-T4** | **Lock reversible**: admin lock→login 401→unlock→login OK; org-admin **không** lock được (no endpoint) | BE/QA | M1 | S | 🟡 | test xanh |
| **M4-T5** | **`created_via` vô hại quyền**: assert phân quyền theo role/membership, KHÔNG theo `created_via` (đổi created_via không đổi quyền) | BE/QA | M1 | S | 🟢 | test/assert |

- [ ] M4-T1 · [ ] M4-T2 · [ ] M4-T3 · [ ] M4-T4 · [ ] M4-T5

---

## M5 — E2E DEMO (kịch bản xuyên suốt)

> **Gate Go/No-Go:** script E2E chạy xanh đầu-cuối ⇒ provisioning NOW = **code-complete**, sẵn cho deploy (sau #143).

| ID | Mô tả | Owner | blockedBy | Est | Mức | DoD |
|---|---|---|---|---|---|---|
| **M5-T1** | **E2E test/script** kịch bản: ADMIN tạo Owner+org → Owner tạo teacher + **CSV import students** → **promote** 1 teacher→manager → **gán teacher vào lớp** → teacher **leave** (account sống) → admin **lock** 1 account lạm dụng → **verify cross-tenant** (org khác không thấy). IT chuỗi hoặc Playwright + seed | BE/QA | M2,M3,M4 | L | 🔴 | script chạy xanh end-to-end; mỗi bước có assert |
| **M5-T2** | **Đồng bộ doc**: cập nhật `b2b-model.md §6` (đánh dấu gap đã đóng) + `QA_TEACHER_PROD_CHECKLIST` + `SESSION_SUMMARY` (LỆCH #4 resolved) | Docs | M5-T1 | S | 🟢 | doc khớp code thực |

- [ ] M5-T1 · [ ] M5-T2

---

## Bảng phụ thuộc (dependency)

| Task | blockedBy | Mức |
|---|---|---|
| M0-T1 | — | 🔴 |
| M0-T2 | M0-T1 | 🟡 |
| M1-T1 | M0 | 🔴 |
| M1-T2 | M1-T1 | 🔴 |
| M1-T3 | M1-T2 | 🔴 |
| M1-T4 | M1-T3 | 🟡 |
| M2-T1 | M1 | 🔴 |
| M2-T2 | M2-T1 | 🔴 |
| M2-T3/T4/T5 | M2-T2 | 🟡 |
| M3-T1 | M1 | 🔴 |
| M3-T2 | M3-T1 | 🔴 |
| M3-T3/T4/T5 | M3-T1 | 🟡 |
| M4-T1 | M3 | 🔴 |
| M4-T2 | M2,M3 | 🔴 |
| M4-T3/T4/T5 | M1/M3 | 🟡/🟢 |
| M5-T1 | M2,M3,M4 | 🔴 |
| M5-T2 | M5-T1 | 🟢 |

**Critical path (dài nhất):** `M0-T1 → M1-T1 → M1-T2 → M1-T3 → {M2-T2 ‖ M3-T1→M3-T2} → M4-T2 → M5-T1`.

---

## Bắt đầu từ đâu (3–5 task làm ngay)

1. [ ] **M0-T1** — tách commit 3 luồng (🔴 **chặn mọi việc mới** — làm đầu tiên).
2. [ ] **M1-T1 (thiết kế)** — viết migration `created_via` + chiến lược backfill (design/SQL nháp — **soạn được ngay**, không cần đợi M0 để THIẾT KẾ).
3. [ ] **M2-T1** — chốt thiết kế “admin pre-create OWNER” = mở rộng `createOrganization.attachOwner` (design 1 trang — soạn ngay).
4. [ ] **M3-T1 (thiết kế)** — phác endpoint `POST /org/teachers` (request/authz/created_via — soạn ngay).
5. [ ] **M4-T2 (khung)** — nháp ma trận cross-tenant test (endpoint × org-A/B) — không phụ thuộc, chuẩn bị trước.

> **Thứ tự thực thi:** xong **M0-T1** → song song **M1-T1..T3** (nền) → khi M1 xanh, chạy **M2 ‖ M3** → **M4** (regression/isolation) → **M5** (E2E). Deploy: gộp vào batch **sau khi #143 lên prod** (week-plan A1/A5), không deploy lẻ.

---

## Rủi ro & ghi chú

- 🔴 **Migration `created_via` đụng bảng `users` lớn** → backfill phải nhanh/idempotent; làm nullable trước, set default sau (tránh lock bảng lâu). Có rollback.
- 🟡 **Credential delivery chưa có email provider** → MVP trả tạm-mật-khẩu trong response (admin/owner chuyển tay); rủi ro lộ → chỉ hiển thị 1 lần + cân nhắc force-change.
- 🟡 **Đụng response đang dùng** (admin/users, org/*) → giữ byte-equiv hoặc additive; `created_via` không lộ B2C.
- 🟡 **M2 reuse createOrganization** đang có nhánh INVITE — đổi sang pre-create phải giữ ca existing-email-attach + org-orphan handling.
- 🟢 **Không build self-signup** — chỉ chừa `created_via=SELF`; nhắc rõ Phase-2.
- **Cổng prod:** mọi mốc tới prod cần user mở SSH + duyệt merge; **#143 phải lên prod trước** (week-plan A1).
