# UI Redesign — Session Handoff (26/08/2026)

> **File này là điểm vào duy nhất cho session sau.** Nó gộp toàn bộ trạng thái, quyết định, và nội dung memory của track UI/UX redesign — session sau KHÔNG cần lịch sử chat, KHÔNG cần memory máy cũ.
> **Trạng thái (cập nhật 26/08):** Phase 1–4 **APPROVED** · **Gate 0 APPROVED** (kèm exception CLS/LCP before/after unavailable) · **Wave 0 đã commit** `5a9b6127` · **Wave 1 đã commit trọn 4 màn**: `dfe80764` (S-01 nav + S-13 mobile nav) và `f245d29f` (S-02 Heute + S-03 Lernweg) — báo cáo ở `WAVE_1_CHECKPOINT_S01_S13.md` và `WAVE_1_S02_S03_REPORT.md`. **Chưa push.** Việc kế: Gate 1 của Wave 1 (first-click test, analytics map cũ→mới) và hợp nhất Lernbaum trước khi chạm `TreeNodePanel`.

---

## 0. Việc còn lại → đọc `UI_REDESIGN_BACKLOG.md`

Toàn bộ việc chưa làm được liệt kê chi tiết (vì sao · file cụ thể · định nghĩa xong) trong **`UI_REDESIGN_BACKLOG.md`**. Ba việc P0 phải xử lý trước tiên:

1. **B-01 — e2e `student/roadmap.spec.ts` ĐANG GÃY** vì S-03 bỏ ba tab (spec còn click tab `"Bài học"`).
2. **B-02 — rà 12 spec e2e còn lại** theo nav mới (sidebar 30 mục → 5 area, Tin nhắn ra topbar).
3. **B-03 — mở PR để CI thật sự chạy**: nhánh feature KHÔNG kích hoạt workflow, nên step Design Token Ratchet của Wave 0 chưa từng chạy trên CI.

## 1. Mở session sau như thế nào

Prompt gợi ý cho Claude ở session sau:

> Đọc `UI_REDESIGN_SESSION_HANDOFF_2026-08-26.md` và tiếp tục đúng gate hiện tại. Không bàn lại quyết định đã chốt. [Nêu quyết định Gate 0 của tôi + việc muốn làm tiếp.]

Thứ tự đọc khi cần chi tiết: file này → `WAVE_0_GATE_REPORT.md` → `UI_REDESIGN_PLAN.md` (§7, §7.1, §3 Wave 0) → khi thi công màn nào thì đọc section S-xx tương ứng + `DEUTSCHFLOW_DESIGN_SYSTEM.md` + `INFORMATION_ARCHITECTURE.md`.

## 2. Bản đồ artifact

| File (root repo) | Vai trò | Trạng thái |
|---|---|---|
| `CLAUDE_UI_UX_HANDOFF.md` | Hợp đồng gốc 5 phase (đã sửa 11.6/17: Speaking P1-high) | Tham chiếu |
| `UI_UX_AUDIT.md` | Phase 1 audit | DONE |
| `DEUTSCHFLOW_DESIGN_SYSTEM.md` | Phase 2 — token/component contract | **APPROVED D1–D8** |
| `INFORMATION_ARCHITECTURE.md` | Phase 3 — IA/nav/taxonomy | **APPROVED IA-D1–IA-D8** (§18) |
| `UI_REDESIGN_PLAN.md` | Phase 4 — 14 màn S-01…S-14, Wave 0–5, §7 approved decisions, §7.1 điều kiện Wave 0 | **APPROVED P4-D1–P4-D8**; header ghi đúng "Phase 5 đang thực hiện — Wave 0 implemented, Gate 0 pending" |
| `WAVE_0_GATE_REPORT.md` | Báo cáo Gate 0 đầy đủ 10 mục + 0b (remediation lần 2) | **Chờ owner approve** |
| `docs/wave0-gate/` | Evidence: 13 PNG (4 viewport) + `measurements.json` | Trackable (đã mở `.gitignore` exception hẹp) |
| `frontend/design-token-baseline.json` + `design-token-exceptions.json` | Debt baseline fingerprint + exception registry | Sống — chỉ được GIẢM |

## 3. Việc OWNER cần làm tiếp (blocking)

1. **Approve/deny Gate 0** — đọc `WAVE_0_GATE_REPORT.md`. Trong đó có **1 Gate exception tường minh chờ chấp nhận**: *CLS/LCP before/after UNAVAILABLE* (không có số đo trước Wave 0; forward baseline post-change: LCP 120ms · CLS 0, homepage, prod build, localhost).
2. **Quyết định commit** — toàn bộ Wave 0 đang nằm trong working tree, CHƯA commit. Lưu ý: worktree đang có sẵn thay đổi CỦA OWNER ở mảng khác (admin pages, messages, layouts, teacher/org — xem §8) → khi commit phải tách file Wave 0 (danh sách đầy đủ ở `WAVE_0_GATE_REPORT.md` §1), đừng `git add -A`.
3. Sau khi approve Gate 0 → ra lệnh Wave 1 (S-01 nav/shells + S-02 Heute + S-03 Lernen + S-13 bottom nav; gate riêng ở plan §3).

## 4. Toàn bộ quyết định ĐÃ CHỐT (không bàn lại)

### 4.1 — 8 quyết định nền (owner, 26/08)
1. Canonical UI = Galerie `/v2`; refine trong semantic system, cấm hệ thứ ba.
2. Radius 2px static/editorial; ngoại lệ CÓ TÊN cho touch controls/inputs/recording/pills; touch ≥44px.
3. Song ngữ theo trình độ, KHÔNG tooltip-only; A1–A2 German-first + Việt trực tiếp; B1+ helper theo yêu cầu; safety/payment/error/destructive luôn ưu tiên comprehension.
4. Font: đo rồi mới khóa (→ đã chốt ở D1).
5. Nav student ≤5 top-level; `Heute·Lernen·Sprechen·Prüfung·Fortschritt` (chốt tên ở IA-D1).
6. AI Interview dưới Sprechen + prominence riêng; không top-level thứ 6.
7. Speaking Studio = **P1-high**; chỉ blocker chức năng ĐÃ VERIFY mới P0.
8. Quick wins gate chặt; security/data-loss là luồng riêng.

### 4.2 — Design System D1–D8 (APPROVED)
D1 **2 family: Newsreader + Be Vietnam Pro** (bỏ Instrument Sans — không có subset vietnamese) · D2 warning `#9A5B12` · D3 gutter desktop 48px · D4 **light warm-paper duy nhất**, không dark mode Galerie · D5 glassmorphism/`df-bottom-nav` chỉ scope `html.native` · D6 Tooltip/Popover/Select/Toast = adapter Radix/sonner + ga skin · D7 type ramp 13 role + gộp nửa-pixel · D8 control mobile ≥44px.

### 4.3 — IA IA-D1–IA-D8 (APPROVED, ghi trong `INFORMATION_ARCHITECTURE.md` §18)
Nav student 5 mục trên · `/v2/student/roadmap` = Lernen home · utilities ra topbar/account menu · Interview thuộc Sprechen + Dashboard prominence · `/v2/student/progress` = Fortschritt home · teacher `Heute·Klassen·Bewerten·Materialien·Berichte` · mobile student đúng 5 items / teacher `…Mehr` · **regroup navigation TRƯỚC, đổi URL SAU bằng 307/alias**.

### 4.4 — Phase 4 P4-D1–P4-D8 (APPROVED, ghi trong `UI_REDESIGN_PLAN.md` §7)
D1 hai band **P0-S / P0-F** (mọi issue ghi rõ band; P0-S ≠ nhãn incident) · D2 chỉ số phải có nguồn thật, thiếu → "chưa đủ dữ liệu", cấm synthetic CEFR % · D3 Goethe Speaking trình bày trong Prüfung, giữ URL, alias sau kiểm bookmark/session/E2E · **D4 có điều kiện: mobile Journey list-first NHƯNG phải có compact journey/branch overview giữ visual signature** · D5 gỡ số liệu/testimonial không nguồn · **D6: Tree chính desktop, Nodes = accessible alternate (không phải tab ngang hàng), Phase hấp thụ vào header — bỏ 3 tab** · D7 gỡ mesh/orb/character-float khỏi active Speaking session (welcome/setup được cân nhắc, respect reduced-motion) · **D8: Wave 2 mở bằng read-only verification autosave/data-loss Exam → có blocker verified thì Exam Shell trước Interview, không thì Interview trước; Studio luôn P1-high sau Interview + mode shells nền**.

### 4.5 — Điều kiện Wave 0 W0-C1…C10 (ghi trong plan §7.1) + phán quyết remediation
- Review lần 1 (6 điểm): ratchet baseline/ratchet; font giới hạn weight + đo 5 chỉ số; focus-visible định nghĩa theo *interactive elements* (không đếm component); portal Radix giữ Galerie scope, KHÔNG promote `--ga-*` lên `:root`; không primitive speculative (defer checkbox/radio/switch/toast); TkBadge vào danh sách hardcode; test thuộc inventory; i18n contract nhất quán; Wave 0 CÓ visual delta có chủ đích; scope an toàn.
- Review lần 2 (3 điểm): **TkModal phải nhận `data-role` qua shell context** (GaRoleProvider) + test 4 role; **DataTable row-action = nút thật trong cell** (accessible name có ngữ cảnh row), `<tr>` không tabindex/role; evidence = "post-change" (không claim regression 0-unexpected), **CLS/LCP exception tường minh**, gitignore exception hẹp, ratchet known-limitation ghi nhận.
- Font: owner chốt **GIỮ italic Newsreader thật** (editorial identity), chấp nhận payload đi ngang; font-loading optimization = backlog có owner Wave 4–5.

## 5. Wave 0 — đã làm gì (tóm tắt; chi tiết ở `WAVE_0_GATE_REPORT.md`)

- **0.1 Token:** `galerie.css` + `tailwind.config.ts` — 16 `text-ga-*`, 10 `--ga-space-*`, warning/overlay/locked/streak/xp/progress, **`--ga-focus: #27406B`** (role-independent — accent student fail 3:1), `--ga-radius-touch: 6px`, shadow drawer/selected-bar, motion tokens, compound `.ga-scope[data-role]`.
- **0.2 Font swap D1:** Instrument Sans gỡ; BVP 400/500/600; Newsreader + italic thật; kết quả đo: 24→22 WOFF2, **505KB ≈ cũ (không claim improved)**, mixed-glyph Việt HẾT (verify computed style prod).
- **0.3 Lint ratchet fingerprint:** `npm run check:design-tokens` (local = CI); baseline `{file→rule→match→count}` = **171 file / 2.438 violation, chỉ được giảm**; nâng baseline cần `APPROVE_BASELINE_INCREASE=1`; escape `design-token-allow: <lý do>`; exception registry match file `===`. Known limitation: literal chuyển vị trí cùng file, count không đổi → pass.
- **0.4/0.5:** focus ring `--ga-focus` cho 100% interactive ui-v2 (23 chỗ đổi từ accent); 44px mobile cho mọi control (GaBtn/toggle/bell/help/pager/seg/tabs/modal-close/language/nav-links/search/pill/input/select).
- **0.6:** DataTable role=status/alert + **row-action contract** (`rowActionLabel(row)` + action column button thật, fallback `v2.ui.openRow`); i18n contract: default từ namespace **`v2.ui`** (chrome.*.json, 35 key × 3 locale) + prop override.
- **0.7 Primitives mới:** `GaInput`/`GaTextarea`/`GaProgress`/`GaSelect`/`GaTooltip`/`GaPopover` + `gaScope.tsx` (**GaRoleProvider** ở GaShell → TkModal/portal nhận role; thứ tự: prop `gaRole` > shell context > DOM detect); NotificationBell → GaPopover (hết cross-import legacy). **DEFER:** GaCheckbox/GaRadio/GaSwitch (0 consumer W1–2), GaToast (root layout còn `ui/sonner` legacy — dependency ghi rõ).
- **0.8 Tests:** 7 file test mới/sửa; suite **467/467** xanh.

## 6. Lệnh verify lại (session sau chạy để tin trạng thái)

```bash
cd frontend && npm run check:design-tokens
```
```bash
cd frontend && npx vitest run
```
```bash
cd frontend && npx tsc --noEmit && npm run check:i18n
```
```bash
cd frontend && npm run build
```
Build exit 0 nhưng **known issue**: `MISSING_MESSAGE: pricing.plans.FREE.badge (vi)` khi prerender legacy `/student/pricing` (non-fatal, out-of-scope Wave 0) + 24 ESLint warning pre-existing. Preview: `.claude/launch.json` có entry `frontend-prod` (npm start :3000).

## 7. Sau Gate 0 — Wave 1 là gì

Theo plan §3: **1.1** S-01 Navigation + role shells (5 top-level student qua `nav.ts`, teacher 5 nhóm, utilities ra topbar/account) · **1.2** S-02 Heute (ContinueLearning dominant, giải thể stat strip) · **1.3** S-03 Lernen/Journey (một mental model; nhớ P4-D4/D6; hợp nhất với nhánh `feat/roadmap-tree-v2` + mảng Lernbaum TRƯỚC khi chạm cùng file) · **1.4** S-13 bottom nav web 5 item. Gate 1: route reachability 100%, first-click ≥80% ContinueLearning, task tìm-node ≥90%, analytics map cũ→mới. Release theo P4-D2 gốc… (flag theo role: student trước teacher — xem plan §7 bản cũ nếu cần). Dữ liệu đã xác minh cho S-02/S-10 (đừng đo lại): dashboard dùng `todayApi.getMe()` + `phaseApi` + `xpApi` (`Promise.allSettled`); `/v2/student/progress` hiện CHỈ có class progress; **skill mastery & CEFR % KHÔNG có nguồn canonical → cấm vẽ (P4-D2)**.

## 8. Trạng thái worktree (QUAN TRỌNG — đừng revert của người khác)

Nhánh: `feat/roadmap-tree-v2`, worktree **bẩn** gồm 2 nhóm:
1. **Thay đổi của OWNER/phiên khác (KHÔNG chạm/revert):** backend admin/notification/org/teacher + tests; frontend admin pages, `v2/*/layout.tsx` (RoleAreaGuard), messages pages, `next.config.mjs`, `adminContent/adminOps/teacher/account/auth` message files, `legacy-redirects.mjs`, e2e specs mới…
2. **Wave 0 (của track này, chưa commit):** danh sách đầy đủ + diff summary ở `WAVE_0_GATE_REPORT.md` §1–§2. `chrome.{vi,en,de}.json` bị chạm bởi CẢ HAI nhóm (Wave 0 chỉ thêm khối `ui`).

## 9. Bẫy đã gặp (trả giá rồi — đừng gặp lại)

- Test mock next-intl trả **KEY** → test query aria-label bằng tiếng Việt sẽ fail; query theo key (`openNav`, `ui.closeNav`…).
- jsdom không cascade CSS custom property → test token resolve bằng `element.matches('.ga-scope[data-role=…]')` + parse rule trong galerie.css; proof trình duyệt thật nằm ở `measurements.json`.
- Radix Select trong jsdom: mở bằng bàn phím (`ArrowDown`), không pointerdown; cần polyfill `hasPointerCapture`/`scrollIntoView` (xem `GaPortalScope.test.tsx`).
- Chụp evidence shell không cần backend: cookie `refresh_token=dummy` qua được middleware (gate cookie-presence); `AuthRecoveryDialog` che pointer → dispatch **DOM-level click** thay vì Playwright click.
- `.gitignore` root có `docs/` + `*.png` toàn cục — evidence sống được nhờ khối exception hẹp Ở CUỐI file (thứ tự rules quan trọng).
- `ga-ui` là class CHẾT (không rule CSS nào) — đừng thêm vào code mới; gỡ dần khi chạm file.
- TkBadge solid dùng `text-ga-bg`, KHÔNG dùng `--ga-accent-ink` (đổi theo role → student là màu tối, phá contrast badge tone cố định).
- `sed` hàng loạt trên ui-v2 ổn, nhưng luôn grep lại cả pattern trong chuỗi nối (`'ga-ui ' + …`).

## 10. Nội dung memory đã chuyển vào docs

Memory máy này (file `project_uiux_redesign_decisions_2026_08_26.md` trong thư mục memory của Claude) đã được chuyển TOÀN BỘ nội dung còn giá trị vào chính file handoff này (§4, §5, §7–§9). Ghi chú tồn tại trong memory nhưng cần biết: có một note cũ *"owner tự làm mảng UI/UX — agent không tự tiếp track trừ khi được yêu cầu trực tiếp"* — các phiên sau chỉ làm track này khi owner ra lệnh trực tiếp (như session này). Các track khác của repo (Lernbaum, Speaking, email verification…) có memory/handoff riêng — không thuộc file này.

---
*Handoff viết bởi phiên 26/08/2026 (phiên thi công Phase 2→Wave 0). Mọi con số trong file này đều tái tạo được bằng lệnh ở §6.*
