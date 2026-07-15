# DeutschFlow — HANDOFF (2026-06-22) → tiếp tục mai

> **Đọc file này TRƯỚC.** Tự chứa đủ để 1 session mới tiếp tục. Thay thế `2026-06-20-NEXT-SESSION-HANDOFF.md` (đã superseded).

## 1. TL;DR — đang ở đâu
- **Web v2 "Galerie" cutover = ✅ LIVE 100% mọi user** (hardcode v2-default, KHÔNG cờ). Landing công khai `/`, `/login`→app, toàn bộ `/v2/*` (4 vai) đều là v2.
- ~~**Rollback lever** = `GALERIE_V2_DISABLED=true`~~ → ⚠️ **ĐÃ GỠ 2026-07-14** (đợt 0 kế hoạch xoá cây v1). Env này giờ là no-op; bật lên KHÔNG rollback được gì. Rollback = revert commit / Amplify "Redeploy this version". Xem `plans/2026-07-14-xoa-sach-v1-web.md` và `plans/2026-06-20-deploy-ops-runbook.md` §2.
- **Prod:** web `https://mydeutschflow.com` (Amplify auto-deploy khi merge `main`, ~4 phút); API `https://api.mydeutschflow.com` (EC2 `ubuntu@35.175.232.152`, ssh có thể bị chặn IP).
- iOS native = **HOÃN** (chờ Apple Developer). KHÔNG đụng `feat/native-ios-phase0`.

## 2. Đã làm session 06-21→06-22 (tất cả MERGED→main)
| PR | Nội dung | Trạng thái |
|---|---|---|
| #131/#132/#134/#135/#136 | Cutover v2-default (cache + /login+/v2 force-dynamic + sidebar logout/icons) | ✅ live |
| #137 | Sync planning docs về cutover-reality | ✅ |
| #138 | Landing Galerie ở `/` (homepage công khai) | ✅ live |
| #139 | Bug sweep: RoleShell cookie-role · notification enum · /interview link · setUser | ✅ live |
| #140 | Chuông giữ khu vực (`?from=`) · logout→/v2/login · logo wordmark | ✅ live |
| #141 | Logo BRAND thật (SVG) · grammar /explain · revenue KPIs · teacher duyệt-vào-lớp · B2B+round2 docs | ✅ LIVE (`bf42d708`, deploy verified) |

## 3. 🔜 MAI LÀM — 2 track (đã có checklist chi tiết trên main)

### Track A — Round-2 audit fixes → `plans/2026-06-22-v2-audit-followups.md`
Admin BE↔FE còn hỏng, **đã kèm DTO thật** trong doc đó:
1. **weekly-speaking** — viết lại form+list theo `WeeklyPromptAdminUpsertRequest` (weekStartDate/cefrBand/title/promptDe/mandatoryPoints).
2. **3 reports con** (vocabulary-quality · grammar-feedback-coverage · personalization-ruleset) — đọc field thật (hub `admin/reports/page.tsx` đọc đúng → tham chiếu).
3. **Wire rubric** (`admin/personas/page.tsx`) — gọi `interviewAdminApi.updateRubric` (đang lưu giả).
4. **orgs seat/validUntil** — ⚠️ cần thêm field vào `OrgDto`/`OrgDetailDto` (backend) — KHÔNG fix FE-thuần.

### Track B — B2B role model → `plans/2026-06-22-b2b-role-model-checklist.md`
- **P0-1 (S, nên làm trước):** KHÔI PHỤC nút đổi global-role ở `v2/admin/users/UserDetailModal.tsx` (backend `PATCH /api/admin/users/{id}/role` còn nguyên + audited; legacy `app/admin/users/page.tsx:183` là ref). ⬅️ *role-change đã ghi nhận ở đây.*
- **P0-3 / P1-1:** tạo enum `OrgRole` + `PATCH /api/org/members/{id}/role` (org tự quản role — hiện KHÔNG có endpoint nào).

## 4. Recipe tiếp tục (đã verify session này)
```bash
cd /Users/dinhcu/Developer/DeutschFlow
git fetch origin && git checkout -b <branch> origin/main
# sửa code dưới frontend/
cd frontend && npm run build            # = tsc + lint + build (GATE; phải xanh)
npx eslint <files> --ext .ts,.tsx       # eslint riêng nếu cần (dir-glob flaky)
# commit → push → gh pr create → MERGE CẦN USER DUYỆT (classifier chặn prod-merge tự động)
```
Deploy = Amplify auto khi merge `main`. Verify deploy bằng poll fingerprint chunk:
`curl -s https://mydeutschflow.com/ | grep -oE 'static/chunks/[a-z0-9_-]+\.js' | sort -u` đổi = deploy xong.

## 5. ⚠️ GOTCHAS quan trọng (durable)
- **Role/identity: đọc COOKIE/JWT, KHÔNG đọc Zustand store.** Prod store `user`=null (login chưa từng gọi setUser tới #139), `orgRole` stale. Dùng `authSession.getAuthRole()/getOrgRole()/getAccessToken()` (middleware + role-layout đã dùng đúng). RoleShell + #139 setUser đã sửa lớp này.
- **Force-dynamic:** `/`, `/login`, toàn bộ `/v2` đều `force-dynamic` để tránh CloudFront cache 1 năm pin shell cũ. Trang client-only cần `force-dynamic` ở server wrapper (xem `app/page.tsx`+`HomeClient.tsx`, `app/login/page.tsx`+`LoginClient.tsx`).
- **GaLogo** = brand SVG tĩnh (KHÔNG framer-motion — v2 phải giữ framer-motion-free cho landing).
- **Notification bell** truyền `?from=<area>`; `RoleShell` validate theo entitlement → giữ đúng shell (teacher-owns-org không nhảy sang org).
- **QA accounts (prod):** `admin@deutschflow.com`, `teacher@deutschflow.com`, `student@deutschflow.com`. Login form: KHÔNG được tự nhập mật khẩu (user nhập).
- `cd frontend` trước mọi npm/eslint. `plans/` tracked, `docs/` gitignored.

## 6. Branch/PR map
- `main` = `bf42d708` (sau #141) — đích deploy.
- `feat/native-ios-phase0` — iOS, **KHÔNG đụng**.
- `feat/native-iap-tts-typed` (#129, open) — optional, cho iOS sau.
- Các branch fix đã merge (#138-#141) còn trên remote (chưa xoá) — bỏ qua.
