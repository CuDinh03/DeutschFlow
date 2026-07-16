# DeutschFlow — HANDOFF (2026-06-22 EOD) → triển khai session sau

> **Đọc file này TRƯỚC.** Tự chứa đủ để 1 session mới tiếp tục mà KHÔNG cần lịch sử chat.
> Thay thế `2026-06-22-NEXT-SESSION-HANDOFF.md` (bản sáng nay — đã hoàn thành các track của nó).
> Mọi khẳng định dưới đây verify từ git/code thật (2026-06-22). Chỗ chưa chắc ghi rõ "cần xác minh".

---

## 1. TL;DR — đang ở đâu
- **B2B backend (#143) đã LIVE prod** (commit `37678da8`, deploy 2026-06-22, V225–227 applied, health 200) → đã gỡ lỗi 404 các trang `/v2/org/*`.
- **Round-2 audit FE (#144) đã MERGED→main** (`c7e72571`) → Amplify auto-deploy (khớp DTO #143, KHÔNG cần deploy BE kèm vì #144 FE-only).
- **CÒN 2 PR mở chưa deploy:** **#146** (messaging, V228) + **#147** (provisioning + MANAGER hierarchy, V229/V230, đang stacked).
- **⚠️ Ràng buộc cứng:** Flyway `out-of-order=false` → **#146 (V228) PHẢI deploy TRƯỚC #147 (V229,V230)**. Sai thứ tự = Flyway fail.
- **🔴 Bảo mật chưa xử lý:** prod còn account mặc định `admin@/teacher@deutschflow.com` mật khẩu `password123` (verify được trên prod). Phải đổi.
- **Prod:** web `https://mydeutschflow.com` (Amplify auto khi merge `main`, ~4 phút); API `https://api.mydeutschflow.com` (EC2, deploy bằng `./deploy-backend.sh` từ máy đã whitelist SSH).

---

## 2. Session này (2026-06-22) đã làm gì

| Hạng mục | Trạng thái | Vị trí |
|---|---|---|
| Finalize B2B model (roles/lifecycle/seats/materials, V225–227) | ✅ MERGED + **DEPLOYED prod** | main `37678da8` (#143) |
| Round-2 audit FE (weekly-speaking · 3 reports · wire rubric · global-role · …) | ✅ MERGED→main, Amplify deploying | main `c7e72571` (#144) |
| **MANAGER < OWNER hierarchy** + FE gating (middleware) + V229 CHECK | ⏳ trong #147 (chưa deploy) | `feat/b2b-provisioning` `0c9b4946` |
| **Top-down provisioning M1–M5** (created_via V230 · admin pre-create OWNER · org pre-create TEACHER) | ⏳ trong #147 (chưa deploy) | `feat/b2b-provisioning` |
| **Admin reset mật khẩu** (PATCH `/api/admin/users/{id}/password`) | ⏳ **chỉ local, CHƯA push** | local `fix/...` `d5f9c658` |
| **Sidebar admin + org: mục "Hồ sơ"** → `/v2/profile` (chỗ đổi mật khẩu) | ⏳ **chỉ local, CHƯA push** | local `fix/...` `9b7c4f6a` + `23958c9d` |
| E2E provisioning script (14/14 green) + seed nội bộ | ✅ committed (trong #147) | `scripts/e2e-b2b-provisioning.sh`, `scripts/seed-internal-accounts.sql` |

**Quyết định người dùng đã chốt (giữ nguyên):**
- Phân quyền tạo tài khoản (top-down): **ADMIN → tất cả** · **OWNER → {MANAGER, TEACHER, STUDENT}** · **MANAGER → {TEACHER, STUDENT}**. Giáo viên tự đăng ký = tương lai.
- **Xoá** student/teacher = chỉ ADMIN. OWNER/MANAGER chỉ **khoá (lock, hoàn tác được)**, không xoá.
- **OWNER > MANAGER** (OWNER=giám đốc trung tâm, MANAGER=nhân sự). MANAGER **bị ẩn** Tài chính + Gói/Giấy phép (finance = OWNER-only, `OrgGuard.FINANCE_ROLES={OWNER}`).
- `teacher@local.test` đã **hạ xuống giáo viên thuần** (tách khỏi org center) — trong seed script.
- **#147 GIỮ STACKED, deploy SAU cutover** (provisioning là tính năng B2B additive, không nằm critical-path go-live).

---

## 3. 🔜 SESSION SAU — RUNBOOK TRIỂN KHAI (đúng thứ tự)

### Bước 0 — 🔴 Bảo mật trước (KHÔNG cần chờ deploy)
Đổi mật khẩu account mặc định trên prod ngay, dùng self-service đã có:
1. Login `mydeutschflow.com` → `admin@deutschflow.com` / `password123`.
2. Vào **`/v2/profile`** → đổi mật khẩu (nhập cũ `password123` + mới ≥8).
3. Lặp cho `teacher@deutschflow.com` (và `student@deutschflow.com` — **cùng batch seed, coi như đã lộ, đổi luôn; cần xác minh student@ có tồn tại không**).

### Bước 1 — Merge + deploy **#146 (messaging, V228) TRƯỚC**
> Lý do thứ tự: V228 < V229/V230, `out-of-order=false`. Nếu #147 lên trước, Flyway từ chối V228 (version thấp hơn latest) → fail.
1. `gh pr checks 146` + `gh pr view 146 --json mergeable` → CI xanh + MERGEABLE.
2. `gh pr merge 146 --merge` (base = main, FE+BE: 2 commits `d3d08b37`+`daccdc96`).
3. **Deploy backend:** `./deploy-backend.sh` (áp **V228** `V228__messages.sql`). Amplify auto-deploy FE.
4. Smoke: student↔teacher chat 1-1 trên prod.

### Bước 2 — Retarget + merge + deploy **#147 (provisioning, V229/V230)**
1. **Retarget base:** `gh pr edit 147 --base main` (vì base cũ `fix/v2-audit-round2-rolechange` đã merged qua #144). Sau retarget, diff #147 = đúng 10 commit provisioning.
2. **Quyết định 3 commit account local** (`d5f9c658` admin-reset + `9b7c4f6a` sidebar admin + `23958c9d` sidebar org, chỉ local `fix/...`, **chưa push**): gộp vào #147 hay PR riêng?
   - Gộp: `git checkout feat/b2b-provisioning && git cherry-pick d5f9c658 9b7c4f6a 23958c9d && git push` (rồi #147 tự cập nhật).
   - Hoặc tạo branch+PR riêng từ 3 commit đó.
3. `gh pr checks 147` xanh → `gh pr merge 147 --merge`.
4. **Deploy backend:** `./deploy-backend.sh` (áp **V229** rồi **V230**, SAU V228). Amplify FE auto.
5. (tùy) Chạy `scripts/seed-internal-accounts.sql` trên prod nếu muốn account nội bộ `owner@/manager@deutschflow.com` + hạ `teacher@local.test`.
6. Smoke: `/v2/org/roles`, tạo OWNER (admin), tạo TEACHER (owner/manager), khoá/mở khoá, admin reset-password.

### Bước 3 — (tùy) Migration V231 dứt điểm default-cred
- Hiện `V48/V50` (trong `db/migration`, chạy MỌI env) seed lại account demo `password123` → nếu prod DB rebuild là lộ lại.
- Soạn **V231**: xoá/rotate account demo + chuyển seed sang `db/migration-local` (chỉ local). **Cần user quyết** (xoá hẳn hay chỉ rotate).

---

## 4. Bản đồ branch / PR / commit (verify `git`/`gh` 2026-06-22)

| Ref | Commit | Ý nghĩa |
|---|---|---|
| `origin/main` | `c7e72571` | #143 (B2B BE, **deployed**) + #144 (round-2 FE, merged) |
| **#146** OPEN `main ← feat/student-teacher-messaging` | `daccdc96` | messaging BE+FE, **V228** `V228__messages.sql`, 2 commit, chưa merge |
| **#147** OPEN `fix/v2-audit-round2-rolechange ← feat/b2b-provisioning` | `b73db3db` | provisioning+MANAGER, **V229+V230**, 10 commit, **stacked → cần retarget main** |
| local `fix/v2-audit-round2-rolechange` | `23958c9d` | = #147 nội dung + **3 commit account CHƯA push: admin-reset `d5f9c658` + sidebar admin `9b7c4f6a` + sidebar org `23958c9d`**. 13 commit ahead origin/main |
| `main` (local) | `37678da8` | **behind 12** — cần `git checkout main && git pull` đầu session |

**Migrations theo nhánh:** main = V225,V226,V227 · #146 = **V228** · #147 = **V229,V230** (V228 cố ý bị skip trên #147 → đó là lý do thứ tự #146 trước).

---

## 5. File & endpoint tham chiếu (provisioning, đang ở #147 + local)

**Backend**
- `admin/service/AdminManagementService.java` — `createUser` · `setUserActive` (lock) · `setUserPassword` (admin reset).
- `admin/controller/AdminManagementController.java` — `POST /users` · `PATCH /users/{id}/active` · `PATCH /users/{id}/password` (record `SetPasswordRequest`).
- `organization/service/AdminOrgService.java` — `attachOwner` pre-create OWNER (role TEACHER, `createdVia=ADMIN`).
- `organization/service/OrgInvitationService.java` — `preCreateTeacher`.
- `organization/controller/OrgController.java` — `POST /org/teachers` (OWNER/MANAGER, created_via theo role caller).
- `organization/service/OrgGuard.java` — `FINANCE_ROLES = {OWNER}` (MANAGER không thấy tài chính).
- `user/entity/User.java` — `createdVia` (`enum CreatedVia {ADMIN,OWNER,MANAGER,SELF,CSV}`), `V230__user_created_via.sql`.
- `V229__org_role_check_manager.sql` — CHECK constraint cho phép `MANAGER`.

**Frontend**
- `frontend/src/middleware.ts` — `OrgRole='OWNER'|'MANAGER'`, `normalizeOrgRole` (ADMIN legacy→MANAGER), gate `/v2/org/*` nhận OWNER|MANAGER.
- `v2/admin/users/UserDetailModal.tsx` — section khoá/mở + **"Đặt lại mật khẩu"**.
- `components/ui-v2/nav.ts` — `adminNav` (`9b7c4f6a`) + `orgNav` (`23958c9d`) đều thêm section **"Tài khoản" → "Hồ sơ"** (`/v2/profile`).
- `v2/admin/users/AdminCreateUserModal.tsx` · `v2/admin/organizations/CreateOrgModal.tsx` · `v2/org/teachers/CreateTeacherModal.tsx` · `v2/org/OwnerOnly.tsx`.

**Docs/specs liên quan**
- `plans/2026-06-21-b2b-model.md` (model "đã chốt", top-down) · `plans/2026-06-22-b2b-provisioning-e2e-plan.md` (kế hoạch M0–M5) · `docs/SESSION_SUMMARY_2026-06-22.md` (đối soát — **lưu ý `docs/` gitignored, chỉ local**).

---

## 6. Verify / chạy local
- **E2E provisioning:** `bash scripts/e2e-b2b-provisioning.sh` (cần backend local chạy; 14/14 pass). ⚠️ zsh: biến vòng lặp KHÔNG được đặt tên `UID` (read-only) → dùng `TUID`.
- **Stack local:** Docker pg/redis + `backend-local` (HS256) + `frontend-localapi` (`.claude/launch.json`). DB local có thể đang ở V220 → cần áp V225–230 (restart backend cho Flyway chạy, hoặc apply tay).
- **Test đã xanh session này:** BE unit (gồm `AdminManagementServiceUnitTest` 12/12 — có 2 test `setUserPassword`) · FE `tsc --noEmit` 0 lỗi · #144 CI (build-and-lint + npm audit + Semgrep + gitleaks) PASS.
- **Tài khoản QA:** `admin@local.test`=ADMIN · `teacher@local.test`=org1 OWNER (sẽ bị hạ bởi seed) · `student@deutschflow.com` pw `Admin12345!`. (Local, KHÁC prod.)

## 7. Rollback
- Web: ~~env Amplify `GALERIE_V2_DISABLED=true`~~ → ⚠️ **ĐÃ GỠ 2026-07-14** (đợt 0 xoá cây v1 — kill-switch tạo vòng lặp redirect với `/login`→`/v2/login`). Rollback web = revert commit trên `main` (Amplify auto-deploy) hoặc Amplify Console → "Redeploy this version". Chi tiết: `plans/2026-07-14-xoa-sach-v1-web.md`.
- Backend: `deploy-backend.sh` blue-green (giữ container cũ tới khi health xanh). Migration **forward-only** — V229/V230 additive (nullable + CHECK), V228 bảng mới → rollback = redeploy ảnh cũ, KHÔNG drop cột.

---

## 8. ⚠️ Gotchas (đã vấp session này)
- `deploy-backend.sh` **exit 1 ở prompt cleanup dù deploy THÀNH CÔNG** — đọc log, đừng tin exit code.
- `git add backend/src/...` khi đang đứng trong `backend/` → thành `backend/backend/...`. Chạy git từ repo root.
- SSH prod cần IP máy được whitelist trong Security Group (port 22). Lỗi "rule already exists" khi add = đã có, bỏ qua.
- `docs/` gitignored (trừ `BACKLOG_CHECKLIST.md`); `plans/` thì tracked → handoff để ở `plans/`.
- `gh pr merge` exit 1 khi đang đứng trên chính branch của PR (nó thử dọn local) — **merge remote vẫn xong**, check `origin/main`.
