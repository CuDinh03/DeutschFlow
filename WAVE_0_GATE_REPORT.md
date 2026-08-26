# Wave 0 — Gate 0 Report

> **Trạng thái:** Wave 0 implemented (sau Gate 0 review lần 1 **và vòng remediation lần 2**) — **chờ owner approve Gate 0**. Wave 1 CHƯA bắt đầu. Chưa commit/push.
> **Ngày:** 26/08/2026 · **Nguồn:** `UI_REDESIGN_PLAN.md` §3 Wave 0 + §7.1 (W0-C1…C10) + 6 điều chỉnh Gate 0 review của owner.
> **Evidence thị giác:** `docs/wave0-gate/` (13 file, chụp từ production build qua Playwright) + `docs/wave0-gate/measurements.json` (số đo tái tạo được).

---

## 0. Trả lời 6 điểm Gate 0 review

| # | Yêu cầu owner | Kết quả |
|---|---|---|
| 1 | Ratchet theo fingerprint | ✅ Baseline đổi sang identity `{file → rule → normalized match → count}`. Thay A bằng B cùng file = FAIL; file mới = baseline 0 = FAIL nếu có violation; `design-token-allow` bắt buộc lý do không rỗng; exception match file CHÍNH XÁC (===). GaTooltip `text-[12px]` → `text-ga-caption`, KHÔNG vào baseline. 3 regression test đã thêm (`src/__tests__/designTokenLint.test.ts`). |
| 2 | Focus contract | ✅ Token mới `--ga-focus: #27406B` (role-independent — student accent #FFCD00 ~1.4:1 fail 3:1; navy >7:1 trên bg/card/surface cả 4 role). 23 chỗ `ring-ga-accent` → `ring-ga-focus` (0 còn lại); `lt-node:focus-visible` cũng đổi. TkSearch + TeacherPendingPill min-h 44 mobile; Ga*Trigger có default contract khi dùng trực tiếp; DataTable row clickable: `tabIndex=0` + Enter/Space + ring inset, GIỮ table semantics (không role=button). Test: `gaFocusContract.test.ts` (static scan 4-role independence) + case mới trong `GaWave0Primitives.test.tsx`. |
| 3 | Visual evidence bền vững | ✅ File này + `docs/wave0-gate/*.png` + `measurements.json` (chi tiết §5). |
| 4 | Đồng bộ doc | ✅ `UI_REDESIGN_PLAN.md` header + §8: "Phase 5 đang thực hiện — Wave 0 implemented, Gate 0 pending owner approval; Wave 1 chưa bắt đầu." |
| 5 | Build report trung thực | ✅ §7 dưới: build exit 0 NHƯNG có `MISSING_MESSAGE: pricing.plans.FREE.badge (vi)` từ legacy `/student/pricing` khi prerender + 24 lint warning hiện hữu — known out-of-scope. |
| 6 | Font | ✅ GIỮ italic Newsreader thật theo quyết định owner; risk ghi vào plan Wave 0.2: 22 WOFF2/505KB, preload 18 file (~432KB), payload CHƯA giảm; font-loading optimization = backlog có owner (Wave 4–5). |

---

## 0b. Vòng remediation lần 2 (3 điểm owner yêu cầu)

| # | Yêu cầu | Kết quả |
|---|---|---|
| R1 | **TkModal portal phải giữ role** | ✅ `GaRoleProvider` (client, trong `gaScope.tsx`) được `GaShell` render MỘT lần cho cả cây → `TkModal` Content nhận `data-role` từ context (`useGaShellRole`), prop `gaRole` override được, page KHÔNG phải sửa. `GaPortalRoleProvider` (GaPopover/Tooltip/Select) cũng fallback qua shell context (ưu tiên: prop > shell > DOM detect). Test `TkModalPortalRole.test.tsx`: đủ 4 role — dialog ngoài app subtree + `.ga-scope` + đúng `data-role` + `matches('.ga-scope[data-role=…]')` khớp rule galerie.css định nghĩa accent đúng giá trị role (student #FFCD00 · teacher #7C56C8 · admin #27406B · org #11888A); query bằng `getByRole('dialog')`, không activeElement/DOM lookup brittle. Bằng chứng trình duyệt thật (student): `measurements.json → portalScope.accent = "#ffcd00"`. |
| R2 | **DataTable row interactive semantics thật** | ✅ Prop mới `rowActionLabel(row)` + **action column render nút `<button>` thật** (accessible name có ngữ cảnh row; fallback `v2.ui.openRow` khi màn chưa truyền; header cột sr-only `v2.ui.actions`). `<tr>` GIỮ table semantics: **bỏ tabIndex/keydown khỏi `<tr>`** — không còn là tab stop; pointer click toàn row giữ như enhancement (stopPropagation chống gọi đôi). Test: button focusable, tên "Mở hồ sơ Anna", Enter/Space/click đều mở đúng row, `<tr>` không tabindex/role. |
| R3 | **Evidence/report đúng mức chứng minh** | ✅ §7 đổi thành "Post-change visual evidence", bỏ claim "0 unexpected regression" (không có baseline trước Wave 0). **CLS/LCP before/after: UNAVAILABLE — Gate exception tường minh chờ owner chấp nhận** (§7); số đo post-change được ghi làm forward baseline: LCP 120ms · CLS 0 (homepage, localhost prod build). `.gitignore` thêm exception **phạm vi hẹp** chỉ cho `docs/wave0-gate/` (verify: evidence trackable, `docs/CLAUDE.md` vẫn ignored, không mở `docs/` hay `*.png` nói chung). Ratchet known limitation ghi ở §4. |

---

## 1. File thực tế đã chạm (Wave 0 — không gồm file dirty của người khác)

**Foundation/token:** `frontend/src/styles/galerie.css` · `frontend/tailwind.config.ts` · `frontend/src/app/layout.tsx`
**Lint:** `frontend/scripts/lint-design-tokens.mjs` (mới) · `frontend/design-token-baseline.json` (mới, fingerprint) · `frontend/design-token-exceptions.json` (mới, 2 entry GaLogo có lý do) · `frontend/package.json` · `.github/workflows/frontend-ci.yml`
**Remediation ui-v2 (16):** `GaBtn` `GaShell` `GaShellNav` `GaSidebar` `GaTopBar` `LanguageToggle` `NotificationBell` `TeacherPendingPill` `TkBadge` `TkModal` `TkSearch` `TkSeg` `TkTabs` `DataTable` `ErrorBanner` `index.ts`
**Primitives mới (7 file):** `GaInput.tsx`(+Textarea) `GaProgress.tsx` `GaSelect.tsx` `GaTooltip.tsx` `GaPopover.tsx` `gaScope.tsx`
**i18n:** `frontend/messages/v2/chrome.{vi,en,de}.json` (+35 key `ui.*`, additive — gồm `openRow`/`actions` của remediation R2)
**Test (7):** mới `src/test/components/GaWave0Primitives.test.tsx` · `src/test/components/GaPortalScope.test.tsx` · `src/test/components/TkModalPortalRole.test.tsx` · `src/__tests__/designTokenLint.test.ts` · `src/__tests__/gaFocusContract.test.ts`; sửa `GaSidebarDrawer.test.tsx` (aria-label→key i18n) · `PatternModal.test.tsx` (+mock next-intl)
**Gitignore:** `.gitignore` (khối exception hẹp cuối file cho `docs/wave0-gate/`)
**Doc:** `UI_REDESIGN_PLAN.md` (§ trạng thái, §3 Wave 0, §7.1) · file này
**Phụ:** `.claude/launch.json` (+entry `frontend-prod` phục vụ verify)

KHÔNG chạm: `nav.ts`, page/screen, `globals.css` legacy, backend, mobile native, `GaLogo.tsx`. Không xóa legacy component. Không revert thay đổi hiện có nào trong dirty worktree.

## 2. Diff summary theo 0.1–0.7

- **0.1 Token:** 16 fontSize `text-ga-*` (13 role + biến thể mobile), 10 spacing `ga-1…ga-10`, semantic warning `#9A5B12`/overlay/locked/streak/xp/progress, **`--ga-focus`**, `--ga-radius-touch: 6px`, `shadow-ga-drawer`/`shadow-ga-selected-bar`, 4 duration + 2 easing; compound selector `.ga-scope[data-role]` (portal contract).
- **0.2 Font:** bỏ Instrument Sans; Be Vietnam Pro 400/500/600 (không 700); Newsreader normal + **italic thật** (landing dùng ~10 chỗ, trước là faux); `--ga-ui` → BVP; gỡ `--ga-vn` chết; Inter giữ nguyên CHỈ cho legacy.
- **0.3 Lint:** ratchet fingerprint (xem §4).
- **0.4 focus-visible:** 100% interactive/focusable element ui-v2 có ring `--ga-focus` (kể cả nested: sort header thành `<button>` thật, pager, row action, mark-all, close, drawer links); static component không thêm tabindex/ring (có test khẳng định).
- **0.5 44px mobile:** GaBtn (sm/md/lg), GaSidebarToggle, help link, NotificationBell trigger, LanguageToggle, TkSeg, TkTabs, TkModal close, DataTable pager, GaSidebar links/close/logout, TkSearch container, TeacherPendingPill, GaInput/GaSelect trigger, Ga*Trigger default.
- **0.6 a11y/i18n:** DataTable `role="status"+aria-busy` / `role="alert"` + pager aria-label + `aria-current`; contract i18n duy nhất: default từ `v2.ui` + prop override; hết hardcode tiếng Việt trong primitive; DataTable row keyboard (Enter/Space).
- **0.7 Primitives:** đúng 6 approve + NotificationBell→GaPopover (**cross-import legacy cuối cùng đã gỡ**); portal contract: content tự mang `.ga-scope`+`data-role` (prop `gaRole` hoặc auto-detect từ trigger); TkModal overlay `bg-black/40` → `ga-scope bg-ga-overlay`; trigger contract cho dùng-trực-tiếp.
- **Hardcode vá trong file chạm:** GaSidebar 2 shadow → token; GaTopBar chip xanh inline → `bg-ga-green-soft text-ga-green`; NotificationBell `#ef4444`/`#fff`/`shadow-sm` → `bg-ga-red`/`text-ga-bg`/bỏ; LanguageToggle `rounded-[6px]` → `rounded-ga-touch`; TkBadge `text-white` → `text-ga-bg` (⚠️ chủ đích lệch DS §9.3: `--ga-accent-ink` đổi theo role, student = màu tối sẽ phá contrast badge tone cố định — đã comment tại chỗ).

## 3. Font measurement trước/sau (W0-C2)

| Chỉ số | Trước | Sau |
|---|---|---|
| Tổng WOFF2 | 24 | **22** |
| Tổng payload | 504KB | **505.1KB — KHÔNG giảm; KHÔNG claim performance improved** |
| Preload theo route | root layout, mọi route | **18/22 file preload (~432KB), root layout, mọi route** |
| Phân rã | Inter + Newsreader(normal) + Instrument Sans + BVP×4w | Inter 214KB/7 (legacy-only) · Newsreader 217KB/6 (normal+italic) · BVP 74KB/9 (400/500/600×3 subset) |
| Glyph Việt | UI sans KHÔNG có subset vietnamese → mixed-glyph | ✅ runtime prod: `.ga-scope` computed = `__Be_Vietnam_Pro…` duy nhất; 6 @font-face có unicode-range Việt (`measurements.json → fontEvidence`) |
| Italic | faux (synthesize) | ✅ `fontStyle: italic` computed với `__Newsreader…` thật (3 italic faces loaded) |
| CLS/LCP signal | swap + size-adjust fallback | Giữ nguyên: `__Be_Vietnam_Pro_Fallback_` tồn tại trong CSS build; LCP homepage là CSS mockup (không đổi) |

**Quyết định owner:** GIỮ italic thật (editorial identity). **Backlog có owner (Wave 4–5):** scope preload theo surface + cắt Inter khi legacy chết (−214KB) — ghi trong plan Wave 0.2.
Kiểm German compound + tiếng Việt có dấu sau swap: `docs/wave0-gate/font-home-*.png` (headline Việt đủ dấu, câu Đức italic „Warum haben Sie sich entschieden, als Pflegekraft…" render đúng ở 4 viewport).

## 4. Token lint baseline & violation mới

- Cơ chế: **fingerprint** `{file → rule → normalized match → count}`; 5 rule (hex, text-[px], rounded-[..], shadow-[..], shadow mặc định kể cả `hover:`).
- **Baseline: 171 file / 2.438 violation hiện trạng** (fingerprint đếm từng match trên dòng nên chính xác hơn bản đếm-theo-dòng cũ). **Violation mới: 0.**
- File mới Wave 0 trong baseline: **0** (đã kiểm bằng script).
- Ratchet: thay A→B cùng file FAIL · file mới FAIL · escape hatch không lý do FAIL · baseline chỉ giảm (`--update-baseline` từ chối nâng trừ khi `APPROVE_BASELINE_INCREASE=1`) — tất cả có regression test.
- **Known limitation (owner chấp nhận cho Gate 0):** cùng một literal bị CHUYỂN VỊ TRÍ trong cùng file với count không đổi vẫn pass (identity là nội dung match, không kèm vị trí). Không mở rộng scope để sửa ở Wave 0.
- CI (`frontend-ci.yml` step "Design Token Ratchet") và local chạy cùng `npm run check:design-tokens`.

## 5. Test / typecheck / build / i18n

| Check | Kết quả |
|---|---|
| `npx vitest run` | **51 file / 467 test PASS** |
| Targeted Wave 0 (6 file test) | PASS (52 test) |
| `npx tsc --noEmit` | PASS |
| `npm run lint` (ESLint) | PASS (0 warning mới của Wave 0) |
| `npm run check:i18n` | PASS — 3.128 key × 3 locale sync; 4.611 usage resolve |
| `npm run check:design-tokens` | PASS — 0 violation mới |
| `npm run build` | **exit 0, KHÔNG hoàn toàn clean** — xem §7 |

## 6. Accessibility results

- **Focus:** 100% interactive ui-v2 dùng `ring-ga-focus` (navy #27406B — ≥3:1 trên mọi nền sáng 4 role); test static-scan khẳng định 0 `ring-ga-accent`, token khai đúng 1 lần và không bị override trong bất kỳ `[data-role]` block; runtime: `measurements.json → focusRing1440` = `rgb(39,64,107) 0 0 0 2px inset` trên nút đang focus; ảnh `focus-login-1440.png`, `focus-login-390.png`.
- **Touch 44px (đo px thật ở 390):** VI/EN/DE 44×44 · GaBtn submit 44 · input 50 (`measurements.json → touchTargets390`). Còn 40px: nút "Hiện mật khẩu", link "← Trang chủ"/"Quên mật khẩu" — **thuộc page login (screen code), ngoài scope W0-C10**, xử lý khi chạm màn ở wave sau.
- **Semantics:** DataTable loading `role=status`+`aria-busy`, error `role=alert`; **row-action contract (R2): nút thật trong action column với accessible name có ngữ cảnh row; `<tr>` giữ nguyên table semantics (không tabindex/role), pointer click toàn row là enhancement**; aria-invalid trên input primitives; state không chỉ bằng màu (selected bar+weight, checked icon+weight).
- **Portal (runtime, `measurements.json → portalScope`):** `hasGaScopeClass: true` · `dataRole: "student"` · `insideAppScope: false` (thật sự portal ra ngoài) · background = `--ga-card` · border = `--ga-border` · **`accent: "#ffcd00"` = đúng student role accent trong portal (R1)**. TkModal nhận role qua `GaRoleProvider` ở GaShell; test 4-role trong `TkModalPortalRole.test.tsx`. Ảnh `portal-bell-1440.png`.

## 7. Post-change visual evidence (KHÔNG phải visual regression)

**Giới hạn chứng minh (R3):** không tồn tại screenshot baseline TRƯỚC Wave 0, nên bộ ảnh này là **bằng chứng trạng thái sau thay đổi**, không phải phép so sánh regression — **không claim "0 unexpected regression"**. Bộ ảnh này trở thành baseline cho các wave sau; visual-snapshot tự động thuộc Gate 1.

**Evidence (tracked trong repo — `.gitignore` đã mở exception hẹp):** `docs/wave0-gate/` — `font-home-{1440,1280,768,390}.png`, `login-{1440,1280,768,390}.png`, `focus-login-{1440,390}.png`, `shell-student-1440.png`, `portal-bell-1440.png`, `measurements.json`.

| Delta có chủ đích (đã dự kiến trong plan Wave 0) | Bằng chứng post-change |
|---|---|
| UI sans Instrument Sans → Be Vietnam Pro | font-home-*, fontEvidence |
| Italic thật thay faux italic | font-home-1440, italicComputed |
| Focus ring navy khi Tab | focus-login-*, focusRing1440 |
| Control mobile 40→44px | touchTargets390 (đo px) |
| Radius touch 6px (input/toggle) | login-390 |
| Portal skin token ga + đúng role accent | portal-bell-1440, portalScope (accent #ffcd00) |
| Badge chuông `#ef4444` → `--ga-red` | portal-bell khi có unread |
| Action column chevron trên bảng có onRowClick (R2) | thay đổi mới — sẽ thấy ở các bảng /v2 dùng row click |

### CLS/LCP — Gate exception tường minh (chờ owner chấp nhận)

**CLS/LCP before/after: UNAVAILABLE** — không có số đo trước Wave 0 nên không thể có so sánh hợp lệ. Số đo **post-change only** (forward baseline, homepage `/`, prod build, localhost, Chromium): **LCP 120ms · CLS 0** (`measurements.json → webVitalsPostChangeOnly`). Số này không phản ánh điều kiện mạng thật — chỉ dùng làm mốc so sánh nội bộ cho wave sau.

## 8. Primitive defer + lý do

- **GaCheckbox / GaRadio / GaSwitch — DEFER:** 0 consumer trong màn Wave 1–2 (checkbox/radio hiện chỉ ở admin pages, login, và ExamTaking dùng native input trong engine mà S-09 cam kết không đụng). Tạo ở wave đầu tiên có consumer.
- **GaToast — DEFER:** root layout (`src/app/layout.tsx`) render `Toaster` từ `ui/sonner` legacy, dùng chung cả cây v1. **Dependency:** chỉ làm khi migrate được root Toaster thực tế (W1 shell hoặc khi legacy Toaster thay toàn cục) — không tạo adapter chưa dùng.
- SkeletonRow (thống nhất `ga-shimmer` thay `animate-pulse`): chưa chạm — ngoài các hạng mục 0.x, để wave chạm file.

## 9. Rủi ro / blocker còn lại

1. **Build không hoàn toàn clean (known, out-of-scope):** `MISSING_MESSAGE: pricing.plans.FREE.badge (vi)` — lỗi non-fatal khi prerender trang **legacy** `/student/pricing` (log tại build, 230/230 trang vẫn generate, exit 0). Thiếu key trong catalog legacy `messages/vi.json` — KHÔNG sửa trong Wave 0 (legacy đóng băng, W0-C10); ứng viên vá nhỏ riêng hoặc chờ legacy retirement. Ngoài ra 24 ESLint warning hiện hữu (img/hook-deps) — tất cả pre-existing, 0 của Wave 0.
2. **Font payload đi ngang** (505KB) — chấp nhận theo quyết định owner (italic thật); backlog optimization có owner ghi ở plan Wave 0.2.
3. Page-level 40px controls trên `/v2/login` (ngoài scope) — vá khi chạm màn.
4. Test mock next-intl trả key → test cũ nào query aria-label tiếng Việt trên primitive phải đổi theo key (đã sửa 2 file; suite xanh).
5. `--ga-focus` navy trên nền tối (GaBtn ink, tooltip) tương phản với chính phần tử thấp hơn — ring offset trên nền giấy vẫn nhìn thấy; nếu Wave sau có surface tối lớn (exam chrome) cần biến thể focus cho nền tối.

## 10. Xác nhận

- **Wave 1 CHƯA bắt đầu.** Không chạm `nav.ts`, page/screen, `globals.css` legacy, backend, native.
- **Chưa commit/push.**
- Dừng tại đây chờ owner approve Gate 0.
