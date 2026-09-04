# UI Redesign — Backlog chi tiết cho session sau

> **Cập nhật:** 28/08/2026, sau phiên đóng P0–P2 + mở Wave 2.
> 📘 **ĐỌC `UI_REDESIGN_SESSION_HANDOFF_2026-08-28.md` TRƯỚC** — trạng thái tổng, 6 lỗi thật đã vá, 9 quyết định đã chốt, trạng thái git (chưa commit gì), và bẫy đã trả giá. File backlog này là phần chi tiết từng mục.
> _(Cập nhật gốc: 26/08/2026, sau khi push `f245d29f`.)_
> **Đọc cùng:** `UI_REDESIGN_SESSION_HANDOFF_2026-08-26.md` (trạng thái tổng) · `UI_REDESIGN_PLAN.md` (§3 waves, §7 quyết định) · `WAVE_0_GATE_REPORT.md` · `WAVE_1_CHECKPOINT_S01_S13.md` · `WAVE_1_S02_S03_REPORT.md`.
> **Đã xong:** Phase 1–4 approved · Wave 0 (`5a9b6127`) · Wave 1 S-01+S-13 (`dfe80764`) · Wave 1 S-02+S-03 (`f245d29f`). Cả ba đã push lên `origin/feat/roadmap-tree-v2`.

Mỗi mục dưới đây có: **vì sao**, **file cụ thể**, **định nghĩa xong**. Thứ tự trong mỗi nhóm là thứ tự nên làm.

---

## 🔴 P0 — Phải xử lý trước khi làm gì tiếp

### ✅ B-01. E2E `roadmap.spec.ts` ĐANG GÃY vì S-03 — XONG 26/08

**Vì sao:** S-03 đã thay ba tab (`Cây học tập · Bài học · Giai đoạn`) bằng segmented `Cây | Danh sách`. Spec vẫn click tab tên **"Bài học"** — tab đó không còn tồn tại.

**File:** `frontend/tests/e2e/student/roadmap.spec.ts`
- dòng ~87: `page.getByRole('tab', { name: 'Bài học' }).click()` → phải là `{ name: 'Danh sách' }`
- dòng ~91, ~95: tên test + click tương tự
- dòng ~81 và comment đầu file (dòng 5, 17–18) mô tả cấu trúc 3 tab → viết lại theo mô hình mới
- Kiểm thêm: `roadmap-tree.spec.ts` (phủ tab cây) — cây giờ là **mặc định trên desktop nhưng KHÔNG mặc định dưới 768px**; spec chạy ở viewport nào?

**Lưu ý kỹ thuật:** `TkSeg` vẫn dùng `role="tab"`/`aria-selected` nên `getByRole('tab')` vẫn đúng loại, chỉ đổi *name*. Trên viewport hẹp giá trị mặc định là `Danh sách`, desktop là `Cây` — spec phải khai rõ viewport thay vì dựa vào mặc định.

**Xong khi:** `npm run test:e2e` xanh cho `student/roadmap.spec.ts` + `roadmap-tree.spec.ts`. 🪤 Nhớ export `E2E_JWT_SECRET` khớp `.env.local`, nếu không sẽ có ~30 fail giả.

**✅ Đã làm (26/08):** 8/8 test xanh. Hai spec viết lại theo segmented; viewport khai rõ ở `test.describe` (desktop 1280 cho cả hai, test mobile 375 chủ động bấm `Cây`). Test "rỗng" bỏ cú click tab — segmented KHÔNG render khi `nodes.length === 0` — và thay bằng khẳng định `getByRole('tab')` = 0.

> 🔴 **Nguyên nhân thật KHÔNG chỉ là đổi tên tab.** Sửa tên tab xong vẫn đỏ 8/8: trang Lernweg **crash vào error boundary** (`Cannot read properties of undefined (reading 'toLowerCase')`). Thủ phạm là code S-03 đã commit ở `f245d29f`:
> `const phaseLabel = phase ? t(\`phases.${phase.currentPhase.toLowerCase()}Label\`) : null`
> — `/phase/current` trả `{}` (đúng pattern mock của mọi spec) là object TRUTHY, `currentPhase` undefined → nổ. `.catch()` phía trên chỉ bắt lỗi mạng, không bắt lệch shape; kiểu `PhaseStateResponse` khai `currentPhase` bắt buộc nhưng đó chỉ là lời hứa lúc biên dịch. Chính comment trong file hứa "hỏng thì header vẫn đứng, không chặn lộ trình" — code làm ngược lại.
> **Đã vá** `src/app/v2/student/roadmap/page.tsx`: `phase?.currentPhase` + `t.has(key)` (chặn luôn trường hợp backend thêm phase mới chưa có khoá i18n).
> 🪤 Bài học mang sang Wave 2–3: mọi `X.y.z()` trên dữ liệu API trong code redesign đều là một crash tiềm tàng — mock `{}` là cách rẻ nhất để lộ ra.

### ✅ B-02. Rà toàn bộ e2e còn lại theo nav mới — XONG 26/08

**Vì sao:** S-01 đổi sidebar từ ~30 mục thành 5 area; nhãn/topbar/account menu đều đổi. Spec nào điều hướng bằng cách click nhãn sidebar cũ sẽ gãy.

**File cần đọc:** `tests/e2e/v2-smoke.spec.ts` · `live-account.spec.ts` · `auth.spec.ts` · `student/messages-inbox.spec.ts` (Tin nhắn giờ là icon inbox trên topbar, không còn mục sidebar) · `teacher-lms.spec.ts` · `role-area-guard.spec.ts`.

**Xong khi:** toàn bộ 12 spec e2e xanh, và có ít nhất 1 spec khẳng định persistent nav đúng 5 mục.

**✅ Đã làm (26/08):** **57 test / 11 spec xanh.** Chi tiết:

| Spec | Trạng thái |
|---|---|
| `v2-smoke.spec.ts` | **GÃY → đã sửa.** S-01 **bỏ hẳn ô tìm kiếm** trên topbar cho role có area nav (`GaTopBar` chỉ render `<input>` khi `!roleAreas`), mà spec lại khẳng định `getByPlaceholder('Tìm bài học, từ vựng, lớp…')` visible ở CẢ student và teacher. Thay bằng: nav khu vực đúng **5 link** (kèm kiểm đủ tên `Heute · Lernen · Sprechen · Prüfung · Fortschritt`), link inbox trên topbar, và khẳng định ô tìm kiếm đã biến mất. ⟵ đây là spec giữ hợp đồng "5 mục" |
| `student/__tree-analysis-shots.spec.ts` | **GÃY → đã sửa.** `openTree()` giả định cây mặc định ở mọi khổ; ở 375px giờ là danh sách. Thêm cú bấm `Cây` (no-op trên desktop). |
| `auth.spec.ts` | Xanh sẵn. Account menu của S-01 CŨNG có "Đăng xuất" nhưng panel là Radix popover chỉ mount khi mở → locator vẫn ra đúng 1 nút. Đã ghi chú ngay tại chỗ để B-06 biết spec này ghim chữ nào. |
| `role-area-guard` · `messages-inbox` · `teacher-lms` · `payment-and-srs` · `speaking` · `v2-responsive` | Xanh, không phụ thuộc nhãn nav (điều hướng bằng URL). |
| `live-account.spec.ts` | **KHÔNG chạy** — spec này trỏ `baseURL: https://mydeutschflow.com` và đi route **v1** với tài khoản thật. Không liên quan redesign /v2, nhưng `npm run test:e2e` trần sẽ bắn thẳng vào prod. |

🪤 Hai bẫy strict-mode mới, do S-02/S-03 đặt hai thành phần dùng chung một chuỗi:
- `JourneyPreview` (compact overview của mobile) nằm trong DOM cả ở desktop vì chỉ ẩn bằng `md:hidden`, và dùng CHUNG nhãn `"Chưa mở"` với badge của `NodeList` → assertion phải `.filter({ visible: true })`.
- `GaSidebar` và `GaBottomNav` **cùng** mang `aria-label="Điều hướng khu vực"` → `getByRole('navigation', …)` ra 2 kết quả, cũng phải lọc theo visible.

⚠️ `role-area-guard.spec.ts`, `student/messages-inbox.spec.ts`, `student/__tree-analysis-shots.spec.ts` hiện **untracked** (chưa từng commit) — mở PR mà không `git add` thì ba spec này không lên. `__tree-analysis-shots` tự khai "TẠM THỜI… xoá sau khi dùng" và ghi ảnh vào một scratchpad của phiên đã chết ⇒ **đề xuất xoá hẳn** thay vì commit.

### 🟡 B-03. Mở PR để CI thật sự chạy — ĐÃ SẴN SÀNG 04/09 (dọn WIP + merge main xong)

**Vì sao:** `.github/workflows/frontend-ci.yml` chỉ trigger trên `push` vào `master/main/dev` hoặc `pull_request` **nhắm tới** các nhánh đó. Push vào nhánh feature **không kích hoạt gì**. Nghĩa là step **Design Token Ratchet** thêm ở Wave 0 **chưa từng chạy trên CI** — mới chỉ verify local.

**Việc:** mở PR `feat/roadmap-tree-v2` → `main`, mô tả gộp 3 commit, link 3 báo cáo. Kiểm cả 4 workflow (frontend, backend, security, mobile).

🪤 `gh pr checks` in nhiều dòng cùng tên job — đọc hết, đừng chỉ nhìn dòng cuối.

**✅ Session 04/09 — tiền đề của B-03 đã xong, PR mở ngay sau e2e xanh:**
- 293 file WIP đã phân loại: **echo của PR-đã-merge** (46 tracked + 26 untracked, gồm cả bản nháp backend audit và `app/v2/messages/` chụp trước #475) đưa vào 4 stash `*-2026-09-04`, KHÔNG cuốn vào nhánh; phần thật chia **3 commit**: `d915114f` (S-09 exam + S-06 interview), `0bd3b087` (speaking studio + lesson shell), `24ea34e3` (chrome B-05→B-12 + i18n + docs).
- **Merge `origin/main` (352 commit, 56 file conflict) = `1d999f38`.** Nguyên tắc đã dùng: exam bỏ hẳn `lib/exam/examDraft` localStorage, nối vỏ ExamShell vào **autosave server V285/#409** (server sở hữu nháp + đồng hồ; i18n/spec đổi theo — nhãn "trên thiết bị này" chỉ còn ở practice, nơi CHƯA có autosave server); roadmap giữ segmented + nhận **feiern L3a (#376)** và URL-state `?tab=&node=` (link cũ `nodes/phase` map về `list`); learn views lấy chấm-điểm-server F-19/F-21/F-22 + MicDeniedGuide của main làm nền rồi phủ token + LessonShell; speaking giữ studio, port Đ4 gợi-ý-theo-yêu-cầu xuống `SpeakingFeedbackSummary` (sheet + sidebar cùng hưởng); i18n merge ngữ nghĩa 3 chiều theo key (script scratchpad `merge-i18n.mjs`, chỉ 1 key thật sự đụng: `draftRestored` — lấy chữ server của main).
- Verify sau merge: **tsc sạch · 1016/1016 unit · build prod exit 0 · check-i18n-usage 5680 key OK · cổng fresh-migration PASS (301 migrations → v303, chạy qua PG local :55442 vì Docker chết)**.
- ⛔ **CHỜ OWNER — cổng nâng baseline ratchet (W0-C1):** CI `build-and-lint` #519 đỏ ở step Design Token Ratchet: 416 violation "mới" nhưng 100% nằm trong 53 file GỐC-MAIN vừa vào tầm quét qua merge (maintenance, GalerieReviewGrid, tc-checklist, billing, exam-golden, speaking/exam…) — nợ có sẵn, không phải nợ redesign viết thêm (nợ cũ của nhánh còn GIẢM 41). Script từ chối nâng baseline trừ khi owner approve. Lệnh khi anh duyệt:
  `cd frontend && APPROVE_BASELINE_INCREASE=1 npm run check:design-tokens -- --update-baseline && cd .. && git add frontend/design-token-baseline.json && git commit -m "chore(ratchet): chốt baseline sau merge main — 53 file gốc-main vào tầm quét (owner approved)" && git push origin feat/roadmap-tree-v2`
- 🔎 **Việc lộ ra, chưa làm (Wave sau):** (1) nút "gợi ý theo yêu cầu" Đ4 mới có ở sheet/sidebar — `SpeakingContextRail` (desktop) chưa có lối gọi tương đương; (2) `student/__tree-analysis-shots.spec.ts` vẫn untracked, giữ nguyên đề xuất XOÁ; (3) 4 stash echo giữ lại để đối chiếu, dọn sau khi PR merge (`git stash drop` từng cái).

---

## 🟠 P1 — Hoàn tất Wave 1

### B-04. Hợp nhất Lernbaum rồi mới áp contract node cho `TreeNodePanel`

**Vì sao:** panel node của cây vẫn có **4 nút kỹ năng 4 màu khác nhau** (Nghe/Đọc/Nói/Viết) và 4 CTA ngang hàng — vi phạm UI-06 (feature colors) và contract S-03 ("1 CTA chính"). Tôi **cố ý chưa chạm** vì đây là file của mảng Lernbaum đang mid-flight (L3c → L2 → L4, PR #376), plan S-03 §Risk yêu cầu hợp nhất trước.

**File:** `frontend/src/components/roadmap-tree/TreeNodePanel.tsx` (+ `SkillTreeCanvas.tsx` nếu chạm màu).
**Thứ tự:** merge/đóng nhánh Lernbaum → mới sửa → visual regression cây ở 4 breakpoint.
**Xong khi:** panel có 1 CTA chính + hành động phụ; 4 kỹ năng dùng surface trung tính + một accent; ảnh cây trước/sau không lệch ngoài dự kiến.

### ✅ B-05. Gom nhóm local nav của Lernen — XONG 26/08

**Vì sao:** local nav Lernen đang **10 mục phẳng** nên phải cuộn ngang ở 1440. IA §5.3 quy định nhóm con: `Lernweg` · `Heute wiederholen` · `Bibliothek` (video/từ vựng/ngữ pháp/bài tập) · `Meine Klasse` · `Entdecken` (tin tức/trò chơi).

**File:** `frontend/src/components/ui-v2/nav.ts` (`studentAreas.lernen.local`) + `GaLocalNav.tsx` (hỗ trợ nhóm/nhóm phụ).
**Xong khi:** local nav ≤5 mục cấp 1 ở 1440 không cuộn ngang; mọi destination cũ vẫn ≤2 cấp.

**✅ Đã làm (26/08):**
- `nav.ts` có `LocalGroup` / `LocalEntry` / `isLocalGroup()` / `localItems()`. `AreaNav.local` giờ là `LocalEntry[]` — **một ô cấp 1 là destination đi thẳng HOẶC một nhóm**. Ràng buộc "≤2 cấp" thành bất biến của KIỂU: `LocalGroup.items` là `NavItem[]`, không có cách nào khai cấp thứ ba.
- Lernen: `Lộ trình` · `Ôn tập ▾` (SRS + Sổ lỗi) · `Thư viện ▾` (Bài học/Từ vựng/Ngữ pháp/Bài tập) · `Lớp của tôi` · `Khám phá ▾` (Tin tức/Trò chơi). Nhóm một item thì KHÔNG khai nhóm — bắt mở menu để tới đúng một chỗ là chi phí thừa.
- `GaLocalNav` render nhóm bằng `GaPopover` (Radix, portal đã có ga-scope + role accent). Trigger mang gạch chân accent + `aria-current="true"` để biết "đang ở trong nhóm này" mà **không phải mở menu**; item đang mở trong menu mang `aria-current="page"`.
- i18n `v2.nav.localGroups.{wiederholen,bibliothek,entdecken}` × 3 locale (nhóm một-item dùng thẳng nhãn item nên không cần khoá). `GaIcon` thêm `explore` (Compass) + `expand_more` (ChevronDown) — thiếu là rơi về `Circle` trông như lỗi UI.
- Kiểm: `navAreaModel.test.ts` +5 test (5 ô cấp 1 · **trải phẳng vẫn đủ 10 href** · mọi area ≤5 ô · nhóm ≥2 item · id nhóm không đụng id item). Reachability "0 orphan" giờ đo qua `localItems()` — gom nhóm không thể âm thầm nuốt route. `GaAreaNavigation.test.tsx` viết lại 3 test + thêm 1. E2E: 5 ô + **không cuộn ngang ở 1440** + mở nhóm đi tới `/vocabulary` thật.

*(B-04 và B-05 chạm cùng vùng Lernen → nên làm CHUNG một đợt.)*

### ✅ B-06. Gộp footer sidebar với account menu — XONG 26/08

**Vì sao:** sidebar còn footer avatar + "Đăng xuất" trong khi topbar đã có account menu chứa đúng những mục đó — trùng lặp (điểm B của checkpoint S-01).

**File:** `frontend/src/components/ui-v2/GaSidebar.tsx` (khối `mt-auto`).
**Xong khi:** một nơi duy nhất cho hồ sơ/đăng xuất, hoặc có lý do viết rõ tại chỗ vì sao giữ cả hai.

**✅ Đã làm (26/08):** trùng lặp rộng hơn điểm B mô tả — sidebar còn nguyên **cả nhóm utility** (Hồ sơ/Học phí/Hướng dẫn) lẫn footer danh tính + Đăng xuất, tức là bản sao gần đủ của account menu. Với role có area nav, cả hai khối đã gỡ; account menu trên topbar là nhà duy nhất. **Admin/org GIỮ NGUYÊN** footer vì họ không có account menu — gỡ luôn là mất đường đăng xuất.

> 🔴 **Bug thật lộ ra khi làm B-06.** Danh sách area trong ngăn kéo là `hidden md:block` với lý do "dưới md bottom nav đã phủ". Nhưng nút **Mehr** của bottom nav lại `setOpen(true)` mở đúng ngăn kéo đó, và Mehr chỉ tồn tại dưới 768px — nên **giáo viên trên điện thoại bấm Mehr chỉ thấy một ngăn kéo KHÔNG có Berichte**: `Phân tích giảng dạy` + `Chấm công` là ngõ cụt trên mobile. Đây là lỗi của S-01 (`dfe80764`), `navAreaModel.test.ts` không bắt được vì nó kiểm MÔ HÌNH chứ không kiểm render.
> **Đã vá:** bỏ `hidden md:block` — ngăn kéo luôn là danh sách area đầy đủ (và nhờ vậy cũng không bao giờ rỗng sau khi utility dọn đi). Có e2e ở 390px chốt lại: khẳng định link Berichte **ngoài viewport** trước khi bấm Mehr rồi **trong viewport** sau khi bấm, để bài test không xanh giả — `translate-x` không xoá phần tử khỏi cây nên `toBeVisible()` một mình là vô nghĩa.
> 🪤 `auth.spec.ts` phải đổi theo: logout giờ nằm sau một cú bấm mở account menu.

### B-07. Gate 1 của Wave 1 (cần người thật — owner chạy)

Theo `UI_REDESIGN_PLAN.md` §3 Gate 1:
- First-click test: **≥80%** chọn ContinueLearning khi được hỏi "học tiếp".
- Task "tìm và mở node kế tiếp": thành công **≥90%**.
- Route reachability 100% (đã có lưới tự động: `navAreaModel.test.ts`).
- **Analytics map cũ→mới**: nav đổi id/nhãn nên event cũ sẽ đứt. Cần map trước khi coi số liệu là so sánh được (IA §15).

---

## 🟡 P2 — Nợ còn lại của Wave 0 (chưa làm, có chủ đích)

### ✅ B-08. Hợp nhất `TkStatStrip` + `AdStat` thành một component — XONG 26/08

**Vì sao:** DS §8.2 yêu cầu hợp nhất; `AdStat` bắt caller truyền **hex thô** và tự ghép chuỗi `${color}0e`, còn `TkStatStrip` nhận CSS var — hai API cho cùng một thứ. Wave 0 chỉ vá file thực sự chạm nên chưa gộp.

**File:** `frontend/src/components/ui-v2/TkStatStrip.tsx` · `AdStat.tsx` + **13 màn tiêu thụ** (`app/v2/org/*` 9 màn, `app/v2/student/achievements`, `app/v2/admin/*`).
**Xong khi:** một component, API nhận **tone token** (không nhận hex), typography theo `--ga-text-stat`/`--ga-text-stat-label`, `border-ga-line` thống nhất.

**✅ Đã làm (26/08).** ⚠️ Quy mô thật lớn hơn "13 màn": **35 call site / 34 file**, và có **BA** bản chứ không phải hai — bản thứ ba là `AdStat` chép tay ngay trong `admin/users/page.tsx`, lệch thêm ở nhãn (10px/0.08em thay vì 11px/0.16em).

- `GaStatStrip.tsx` mới; `TkStatStrip.tsx` + `AdStat.tsx` đã **xoá**, barrel export lại đúng một tên.
- API: `tone?: GaStatTone` (`accent · navy · blue · violet · teal · green · orange · gold · red · neutral`) → class **tĩnh** `bg-ga-*`/`text-ga-*`. Không hex, không inline style, không ghép chuỗi class (ghép là JIT không sinh ra class, ô mất màu).
- Typography về thang chung: nhãn `text-ga-stat-label`, giá trị `text-ga-stat-m` → `lg:text-ga-stat`. Bỏ hai thang riêng 22/26/32 và 24/28/36.
- Bỏ nền tint `{color}0e` (chỉ AdStat có) và `delta`/`deltaUp` — **0 call site** dùng delta.

> 🔴 **Vì sao API nhận màu là sai, có bằng chứng.** Hợp đồng cũ của AdStat bắt caller truyền HEX để chuỗi `${color}0e` giải được. `admin/users/page.tsx` truyền `var(--ga-navy)` ⇒ nền thành `"var(--ga-navy)0e"` — CSS vô nghĩa, **im lặng không vẽ gì**. Không lỗi, không cảnh báo, không ai thấy. API kiểu tone không diễn đạt được sai lầm đó.

**Kết quả đo:** debt token **2.397 → 2.284 (−113)** — đã chạy `--update-baseline` chốt mức thấp hơn nên không thể trôi ngược. tsc sạch ngay lần đầu; 550 test + 61 e2e + build exit 0; 23 warning không đổi.

🪤 Codemod đụng `color:` **chỉ trong khối stat** (quét cân ngoặc), không quét cả file — `color:` còn xuất hiện ở chart/segment và đổi nhầm là hỏng biểu đồ. Script nổ nếu gặp màu chưa có trong bảng map thay vì bỏ qua im lặng.

### ✅ B-09. `SkeletonRow` dùng chung `ga-shimmer` — XONG 26/08

**Vì sao:** `SkeletonRow` đang dùng `animate-pulse` của Tailwind trong khi `DataTable` dùng `.ga-shimmer` — hai ngôn ngữ loading trong cùng một hệ.
**File:** `frontend/src/components/ui-v2/SkeletonRow.tsx`.

**✅ Đã làm (26/08):** 6 ô đổi sang `.ga-shimmer`, bỏ luôn `bg-*` riêng (gradient của shimmer tự vẽ nền; đặt thêm là ô đứng im). Lợi thêm: `.ga-shimmer` tự tắt animation dưới `prefers-reduced-motion`, thứ `animate-pulse` không làm.

### B-10. Primitive đã DEFER — điều kiện mở

| Primitive | Điều kiện làm |
|---|---|
| `GaCheckbox` / `GaRadio` / `GaSwitch` | Khi có consumer thật (nhiều khả năng ở S-09 Exam hoặc form teacher). Không tạo trước. |
| `GaToast` | **Dependency:** `frontend/src/app/layout.tsx` còn render `Toaster` từ `@/components/ui/sonner` (legacy, dùng chung cả cây v1). Chỉ làm khi migrate được root Toaster thật. **Bước 1 XONG 03/09:** toast thông báo realtime (NotificationBell) đã có thẻ Galerie riêng — `GaNotificationToast` qua `toast.custom` (tự mang `.ga-scope`+`data-role` theo W0-C4, bottom-right, CTA + close 44px); skin legacy của Toaster đã rào `data-[styled=true]:` nên không đè toast custom. Còn lại: toast success/error chung vẫn skin cũ, đợi migrate root. |

### B-11. Hardcode còn lại trong danh sách DS §9.3

- `frontend/src/components/ui/gender-word.tsx`: **14 hex** der/die/das/plural → 4 token `--gender-*` + dẫn xuất (file thuộc lớp legacy đang phong tỏa → làm khi lớp đó được mở hoặc khi màn từ vựng được redesign ở S-08).
- `sonner` skin navy → skin ga: đi cùng B-10 GaToast.
- `GaLogo.tsx`: hex là **exception đã ghi** trong `design-token-exceptions.json` (asset SVG) — không cần sửa.

### ✅ B-12. Dọn code chết vừa lộ ra — XONG 26/08

`frontend/src/components/features/dashboard/DashboardContainer.tsx` và `TodayPlanBoard.tsx` **không còn ai import** (đã kiểm bằng grep toàn `src`). Chúng là tàn dư v1, không phải do Wave 1 tạo ra, nhưng giờ chắc chắn mồ côi.
**Xong khi:** xoá kèm kiểm `knip`/grep, hoặc ghi vào legacy deletion map nếu muốn gộp vào Wave 5.

**✅ Đã làm (26/08):** đã xoá cả hai (**158 dòng**) sau khi grep `src`/`tests`/`scripts` cho cả tên component lẫn đường dẫn `features/dashboard` — 0 tham chiếu, kể cả import động. Thư mục `src/components/features/dashboard/` không còn file nào nên xoá luôn. tsc + build + 550 test vẫn xanh sau khi xoá.

---

## 🔵 Wave 2 — theo P4-D8 (thứ tự phụ thuộc kết quả verification)

### ✅ B-13. **2.0 — Read-only verification autosave/data-loss của Exam** — XONG 26/08

**Đây là việc ĐẦU TIÊN của Wave 2, và nó quyết định thứ tự hai việc sau.**

**Việc:** chỉ ĐỌC, không sửa — xác minh engine thi hiện tại có autosave/recovery thật không.
**Nơi đọc:** `frontend/src/app/v2/student/mock-exam/run/**` (`ExamTaking.tsx`), API bài thi ở backend, hành vi khi rớt mạng giữa bài.
**Kết luận dẫn tới:**
- Có blocker data-loss/recovery **đã verify** → **S-09 Exam Shell trước** S-06 Interview.
- Không có blocker verified → **S-06 AI Interview trước** (khớp hero-product priority).

⚠️ Nếu engine **chưa** có autosave: Exam Shell **không được** hiển thị "Đã lưu" (cấm nói dối trạng thái — plan S-14). Phải cảnh báo trước khi vào bài.

---

## 🔴 KẾT LUẬN B-13 (26/08): CÓ blocker data-loss, đã verify ⇒ **S-09 Exam Shell ĐI TRƯỚC S-06 Interview**

**Engine thi hiện tại KHÔNG có autosave, KHÔNG có recovery, và đang NÓI DỐI người học.** Kết luận dựa trên cả đọc mã lẫn đo hành vi thật (4 kịch bản Playwright, backend mock, đã gỡ spec sau khi đo — B-13 là read-only).

### Đọc mã

| Nơi | Sự thật |
|---|---|
| `run/page.tsx` | `answers` chỉ nằm trong `useState`. **Không** localStorage / sessionStorage / `beforeunload` / autosave — grep toàn `mock-exam` + `components/exam` ra 0 kết quả |
| `startExam()` | luôn `setAnswers({})` + `setTimeLeft(minutes * 60)` — kể cả khi resume một attempt đang dở |
| `MockExamController` | 9 endpoint, **không có endpoint lưu tạm nào**. Không `/save`, không `PATCH answers` |
| `finishExam()` | `answers_submitted_json` được ghi **đúng một lần**, trong chính câu `UPDATE … SET status='COMPLETED'` |
| `/start` (nhánh resume) | `SELECT id FROM mock_exam_attempts …` — chỉ lấy `id`, **không trả `started_at`** ⇒ client không có cách nào biết đã trôi bao lâu |
| `V118__mock_goethe.sql` | bảng **đã có sẵn** `answers_json JSONB` và `started_at TIMESTAMPTZ` — chưa dòng mã nào của mock-exam đụng tới `answers_json` |

### Đo hành vi

| Kịch bản | Kết quả đo |
|---|---|
| A. Trả lời 2 câu rồi **tải lại** | lượt ghi API trong lúc làm bài: **`[]`** (không một request nào ngoài `/start`) · sau reload `q1=false q2=false`, tiến độ **`0/3 câu`** · đồng hồ **`29:56` → `30:00`** |
| B. **Mất mạng lúc nộp** | `localStorage` chỉ có `accessToken` + khoá PostHog, `sessionStorage` chỉ có PostHog — **không byte nào của bài làm**. Người dùng còn ở màn thi và đáp án còn trong RAM, nên bấm lại được — nhưng đóng tab là mất trắng |
| C. **Rời trang giữa bài** | **không** có hỏi xác nhận (`beforeunload` không tồn tại) — điều hướng đi là im lặng và mất sạch |
| D. Bấm **"Tiếp tục"** trên bài `IN_PROGRESS` (bắt đầu 12 phút trước, giới hạn 30) | tiến độ **`0/3 câu`**, đồng hồ **`30:00`** — đúng phải là ~`18:00` |

### 🔴 Điểm nặng nhất: "Tiếp tục" là một lời nói dối đang chạy trên prod

Danh sách bài thi hiện badge **"Đang làm"** kèm nút **"Tiếp tục"** cho attempt `IN_PROGRESS`. Người học tin là bài của mình còn đó. Bấm vào thì `resumeExam → startExam` xoá sạch đáp án và **đặt lại đồng hồ về full**, trên chính attempt cũ. Đây đã là vi phạm S-14 ("cấm nói dối trạng thái") **trước khi** Exam Shell được viết — không phải rủi ro tương lai.

*(Ngược lại, `recoveryRenderDesc` = "Bài làm của bạn vẫn được giữ" là **đúng**: ErrorBoundary chỉ bọc `ExamTaking`, state nằm ở component cha nên `reset()` giữ được đáp án. Chỉ nhánh render-error là trung thực.)*

### Ràng buộc bắt buộc cho S-09

1. **CẤM** hiển thị "Đã lưu" / "Đang lưu" cho tới khi có lưu thật.
2. Trước khi vào bài phải cảnh báo rõ: **thoát hoặc mất mạng là mất bài**.
3. Nút "Tiếp tục" phải hoặc (a) thôi hứa — đổi thành "Làm lại từ đầu", hoặc (b) được hậu thuẫn bằng lưu thật. Giữ nguyên chữ "Tiếp tục" mà không lưu là không chấp nhận được.
4. Đồng hồ: hết `timeLeft` là **tự nộp**, nên đồng hồ reset ⇒ người học được thêm giờ trên cùng một attempt. Vá đồng hồ **phải** đi kèm backend trả `started_at` ở nhánh resume.

### Đường vá rẻ nhất (cho backlog backend, KHÔNG làm trong B-13)

Không cần migration: cột `answers_json` + `started_at` đã có sẵn từ V118. Cần đúng hai thứ — một endpoint `PATCH /mock-exams/attempts/{id}/answers` ghi `answers_json`, và `/start` trả thêm `started_at` + `answers_json` ở nhánh reuse (hiện chỉ `SELECT id`).

---

### ✅ B-14. S-09 — Prüfung hub + Exam Shell (P0-S) — XONG 26/08
`/v2/student/exam` (96 dòng, đang là destination mờ nhạt) → hub 3 nhóm theo IA §6.3: kỹ năng Goethe · `Prüfungssimulation` · `B1-Bereitschaft` + báo cáo. ExamShell ẩn XP/streak/nav/animation, có timer + section + progress + trạng thái autosave + exit có kiểm soát. Style: light warm-paper (P4-D5).

**✅ Đã làm (26/08).**

#### Hub

Bản cũ hứa nhiều đường hơn số đường thật: bốn thẻ "luyện theo kỹ năng" mà **ba trong bốn cùng trỏ `/mock-exam`**, cộng bốn thẻ cấp độ không bấm được. Hub mới có ba nhóm, mỗi nhóm một đích thật: **Prüfungssimulation** (khối chính, CTA duy nhất) · **B1-Bereitschaft** · **Prüfungsberichte**. Bốn kỹ năng Goethe thôi giả làm destination — chúng là dải MÔ TẢ đề thi gồm gì, và chỉ Sprechen mang một đường đi thật (cross-link phòng luyện nói, có nhãn mode). Dòng "đang chuẩn bị Goethe {level}" chỉ in khi có `targetLevel` thật, không có thì bỏ hẳn dòng (P4-D5).

#### ExamShell

`components/exam/ExamShell.tsx` — layout song song với role shell. `ExamTaking` rút về **nội dung thuần**: đồng hồ, tiến độ, trạng thái lưu, nút thoát đều chuyển lên vỏ (hai nơi cùng vẽ chrome thì chúng sẽ trôi khỏi nhau).

- Đồng hồ `aria-live="off"` + vùng `role="status"` riêng chỉ thông báo ở mốc **5 phút / 1 phút** — đọc lại từng giây là tra tấn người dùng screen reader.
- Cảnh báo ≤5 phút đổi màu `--ga-warning` + **bỏ `animate-pulse`** của bản cũ (DS §7 cấm animation trang trí trong vỏ thi, và nhấp nháy đúng lúc căng thẳng nhất là tệ nhất).
- Vùng đọc giới hạn ~72ch. Ở 390px nhãn phần chiếm trọn một dòng — để nó chia hàng với đồng hồ thì flex ép "LESEN" vỡ thành "LESE / N".

> 🔑 **"0 nav toàn cục" chỉ thành thật nhờ một bước nữa.** Vỏ thi là `fixed inset-0`, nên role shell vẫn NẰM TRONG DOM phía sau: che được bằng mắt nhưng vẫn tab vào được và phép kiểm DOM vẫn thấy nav. Giải: ExamShell bật `<body data-exam-mode="on">`, CSS cho `[data-ga-chrome]` `display:none` — mất khỏi cả tab order lẫn cây accessibility. Đặt theo **trạng thái** chứ không theo route, vì `/mock-exam/run` còn phục vụ màn danh sách và màn kết quả, những màn đó VẪN cần nav.

#### Lỗ hổng mất bài của B-13 — đã bịt phần client làm được

`lib/exam/examDraft.ts`: lưu nháp (đáp án + **mốc hết giờ tuyệt đối** + phần đang làm) xuống `localStorage`, debounce 600ms, dọn nháp quá 24 giờ, xoá sau khi nộp. Ba điểm cốt lõi:

1. **Nói đúng phạm vi.** Nhãn là "Đã lưu **trên thiết bị này** · HH:MM", không phải "Đã lưu" trống không (S-14). Hub cũng cảnh báo TRƯỚC khi vào bài rằng đổi máy hoặc xoá site data là không khôi phục được.
2. **Đồng hồ lưu mốc tuyệt đối**, không lưu số giây còn lại — đây đúng là chỗ B-13 đo ra lỗi cấp thêm giờ. Đồng hồ cũng đọc lại từ mốc mỗi nhịp thay vì tự trừ dần, nên tab bị trình duyệt tiết chế cũng không trôi.
3. **"Tiếp tục" thôi nói dối.** Có nháp → khôi phục và báo số câu; không có nháp trên máy này → nói thẳng "bạn sẽ bắt đầu lại từ đầu" thay vì im lặng dựng bài trống.

⚠️ **Vẫn còn giới hạn, và nó được nói ra chứ không giấu:** đây là `localStorage` của MỘT trình duyệt. Đổi máy vẫn mất. Endpoint lưu tạm ở backend (cột `answers_json` + `started_at` đã có sẵn từ V118) là việc riêng đã tách sang backlog backend.

**Kiểm:** 17 unit test cho `examDraft` (gồm storage ném ở cả ba lối vào — private mode / hết quota; JSON hỏng; nháp lệch attempt; giá trị rác) + 5 e2e mới trong `student/exam-shell.spec.ts`: ba nhóm hub đi ba nơi · **0 nav / 0 XP / 0 streak / 0 `animate-*` trong vỏ** (có đối chứng dương: ngoài phòng thi nav CÓ mặt, nếu không phép đo vô nghĩa) · thoát ra thì chrome quay lại · **tải lại giữ nguyên đáp án và đồng hồ đi tiếp** · nộp xong nháp bị dọn.

🪤 jsdom trong repo KHÔNG cấp `localStorage` (global tồn tại nhưng là object rỗng, không có `setItem`) — spec tự dựng `MemoryStorage` thay vì sửa `vitest.config` toàn repo.

### 🟡 B-15. S-06 — AI Interview (P0-S) — 27–28/08, còn 1 mục (chặn ở backend)
`/v2/student/interviews` (399 dòng) → đủ flow Setup → Room → Question → Answer → Evaluation → Improved Answer → Report. **P4-D4 (Interview):** verify API từng stage ở đầu W3; stage nào thiếu backend thì ship không có stage đó + ghi backlog backend riêng, KHÔNG chờ.
Room ẩn nav (đã có sẵn: `isImmersiveRoute()` trong `nav.ts` đã liệt kê `/v2/student/interviews`).

**🟡 Đã làm một phần (27/08).**

#### P4-D4 — verify API từng chặng (bước bắt buộc, làm trước)

| Chặng | Backend | Kết luận |
|---|---|---|
| Setup | `POST /api/ai-speaking/sessions` (`sessionMode` · `interviewPosition` · `experienceLevel` · `persona`) + `GET /api/interviews/personas` | ✅ đủ (không có trường **thời lượng**) |
| Room | `/sessions/{id}/chat/stream` · `/transcribe` · `/messages` · `/quota` | ✅ |
| Question | `GET /api/interviews/{id}/turns` → `turnIndex` + `phase` | ⚠️ **không có tổng số câu** |
| Answer | `/transcribe` + `/chat/stream` | ✅ |
| Evaluation | `GET /{id}/phase-results` (score · strengths · weaknesses theo pha) | ✅ |
| **Improved Answer** | grep `improved\|betterAnswer\|modelAnswer\|sampleAnswer` khắp `interview/` + `speaking/` → **0 kết quả**. Schema báo cáo AI (`SkillTreeService.generateInterviewReport`) chỉ có `overallScore · fluency · grammar · vocabulary · strengths[] · improvements[] · summaryVi` — `improvements` là **lời khuyên**, không phải câu trả lời viết lại | ❌ **KHÔNG TỒN TẠI** |
| Report | `GET /api/interviews/{id}/report` + job `/jobs/interview-report` + SSE | ✅ |

> 🟢 **Tin tốt, và nó trái ngược hẳn B-13:** mỗi lượt hoàn tất được ghi server NGAY — `InterviewDomainCoordinator.onTurnCompleted → InterviewTurnPersistenceService.saveTurn` (`REQUIRES_NEW`), gọi từ `TurnSideEffectsService` trong luồng chat. Đọc lại qua `GET /{id}/turns`. Tức **AC-2 đã đạt ở tầng dữ liệu**: rớt mạng không mất lượt đã trả lời. Engine thi mất trắng, engine phỏng vấn không mất gì.
>
> 🔴 **"Câu hỏi 3/8" của brief là không làm được.** Không có mẫu số. In "3/8" là bịa dữ liệu (S-14). Thay bằng tiến độ theo **PHA** — bộ 5 pha `INTRO · ICE_BREAKER · HARD_SKILLS · STAR_SOFT · CLOSING` là thứ có thật.

#### Đã ship

- **`InterviewPhaseBar`** — tiến độ 5 pha, nhãn chữ cho pha đang mở (bốn pha kia vẫn có nhãn cho screen reader; trạng thái không truyền chỉ bằng màu). Trước đó pha chỉ là một chữ lẫn trong subtitle của header, người ta biết "đang ở Chuyên môn" mà không biết còn mấy chặng.
- **AC-4 — Room không còn chrome.** Route `/v2/student/speaking/live` **chưa từng** nằm trong `isImmersiveRoute()`, nên cả Interview lẫn Studio vẫn chạy trong role shell đầy đủ (sidebar · topbar · bottom nav) — AC-4 đang đỏ mà không ai để ý. Nay `SpeakingChatExperience` gọi `useImmersiveChrome(viewMode !== 'summary')`: gỡ chrome trong phiên, **trả lại ở màn tổng kết** (đó là báo cáo, người dùng cần nav để đi tiếp).
- **Thoát có xác nhận** — chỉ hỏi khi đã có lượt trả lời, và câu chữ nêu đúng sự thật đã verify: lượt xong đã nằm trên server.
- **`useImmersiveChrome`** tách khỏi ExamShell thành hook dùng chung cho mọi mode shell (đếm tham chiếu để hai shell chồng nhau lúc chuyển màn không làm nav loé ra). Cờ CSS đổi `data-exam-mode` → `data-immersive-mode`.
- **`isImmersiveRoute` bỏ `/v2/student/interviews`** — đó là màn CHỦ (bắt đầu · phiên dở · báo cáo), ẩn nav ở đó là ẩn nhầm chỗ. Phòng thật ẩn theo trạng thái.
- **Màn chủ nói Interview khác Studio ở đâu** ngay tại cửa vào (AC-5), và phiên dở ghi rõ "các lượt đã trả lời đã được lưu".

#### 🔴 Còn lại của S-06 — KHÔNG làm trong B-15, có lý do

1. **Improved Answer (AC-3 nửa đầu) — backend chưa có.** Theo P4-D4: ship không có chặng đó, ghi backlog backend riêng, KHÔNG chờ. Cần một trường "câu trả lời viết lại" ở schema báo cáo hoặc theo từng lượt.
2. ~~**Nút "Tiếp tục" cho phiên dở (AC-2 nửa UI).**~~ ✅ **XONG 28/08** — xem dưới.
3. **Room shell riêng.** Cố ý KHÔNG bọc `SpeakingChatExperience` (776 dòng) bằng một mode shell mới: nó tự render `SpeakingChatHeader` nên sẽ thành hai header chồng nhau, rồi B-16 lại gỡ. Hợp đồng Room được áp **tại chỗ** thay vì bọc vỏ.

#### ✅ Nút "Tiếp tục" — xong 28/08

`lib/speaking/resumeSession.ts` (thuần, 11 unit test) + `resumeSpeakingSessionIntoStore` đặt cạnh bootstrap sẵn có, và một hàng hành động trên thẻ phiên chưa hoàn tất. 3 e2e phủ: mở lại mang theo nguyên lịch sử · phiên đã xong thì không mời tiếp tục · nhân vật lạ thì báo rõ thay vì mở phòng sai người.

> 🔴 **Không map một-một được, và chỗ đó là nơi dễ hỏng nhất.** Backend gắn `errors` vào lượt **ASSISTANT** (`getMessages` chỉ gộp `UserGrammarError` cho `MessageRole.ASSISTANT`; lượt USER luôn nhận `List.of()`), nhưng những lỗi đó mô tả câu NGƯỜI HỌC vừa nói và phiên đang chạy đặt chúng lên lượt USER. Map thẳng ⇒ bấm "Tiếp tục" xong bảng phản hồi trống trơn dù lượt đó có lỗi. Mapper vì thế **dồn ngược** về lượt USER gần nhất, và giữ nguyên phân biệt `undefined` (chưa phân tích) ↔ `[]` (đã phân tích, sạch lỗi) mà `feedbackModel` dựa vào.
>
> `status` để `null` vì `AiSpeakingMessageDto` **không có** trường đó (chỉ `assistantFeedback`) ⇒ chiều "Phù hợp" không dựng cho lượt cũ. Cố ý: thà thiếu một chiều còn hơn suy ra một phán đoán API không trả về.
>
> Persona lạ ⇒ `companionFromPersonaId` trả `null` và nút ẩn/báo lỗi, thay vì đắp Lukas vào một phiên của người khác. API trả persona CHỮ HOA (`"LUKAS"`) còn `PERSONA_TOKENS` khoá chữ thường — quên hạ chữ là tra trượt và engine đá thẳng người dùng về màn chọn nhân vật.

#### 🔴 Hai lỗi thật tìm ra khi làm nút này

1. **Kiểu `AiSpeakingSession['status']` khai SAI dây thật.** Nó ghi `'ACTIVE' | 'ENDED'` (tên enum nội bộ của backend), nhưng `AiSpeakingServiceImpl.toSessionDto` ánh xạ `ENDED → "COMPLETED"`, `ACTIVE → "IN_PROGRESS"` trước khi trả. Tức TypeScript **báo lỗi ở phép so đúng** và **chấp nhận phép so không bao giờ khớp** — ngược hẳn công dụng của kiểu. Chưa gây lỗi sống vì các trang dùng interface cục bộ `status?: string`, nhưng là bẫy chờ người tiếp theo. Đã sửa kiểu; một fixture test đang mã hoá `"ACTIVE"` cũng phải sửa theo (đúng mẫu "test cũ mã hoá chính cái sai").
2. **`trackFeatureAction` không có action `resumed`.** Gộp vào `started` thì số phiên bắt đầu bị thổi lên bởi các lần mở lại, và không đo được nút này có ai dùng — đúng câu hỏi khiến nó được làm. Đã tách riêng.

**Đo sau B-15:** 612 test / 59 file · 76 e2e / 13 spec · tsc sạch · 23 warning · debt token 2.242 · i18n 3.242 khoá × 3 locale · build exit 0.

**Đo lúc 27/08 (lần trước):** 569 test / 56 file · 66 e2e · tsc sạch · 23 warning · debt token 2.242 · i18n 3.238 khoá × 3 locale · build exit 0.

### 🟢 B-16. S-07 — Speaking Studio (**P1-high**) — LÔ 1+2+3+4 XONG 28/08 (còn phần dời thư mục, xem cuối mục)
Bỏ kiến trúc chat-centric (`ChatMessageBubble`/`SpeakingChatExperience`/input dock) → studio shell: persona · scenario · CEFR · goal · mic · waveform · timer, transcript là panel phụ, feedback 4 chiều summary-first.
**P4-D7:** gỡ mesh/orb/character-float khỏi phiên đang chạy; chỉ cân nhắc ở welcome/setup và phải respect `prefers-reduced-motion`.
Hợp nhất hai họ component: `components/speaking/*` (legacy) + `components/features/ai-speaking/*` (21 component).

**🟡 Lô 1 xong (28/08).** Plan §Risk tự yêu cầu "làm theo lô, giữ hành vi API, visual regression từng lô" — hai họ cộng lại ~7.100 dòng, không có chuyện làm một nhát.

#### Trinh sát trước khi đụng vào

| Component trang trí | Người dùng thật |
|---|---|
| `SpeakingMeshBackground` (170 dòng) | **0** — đã chết từ trước |
| `SpeakingAmbientOrbs` (42 dòng) | **0** — đã chết từ trước |
| `SpeakingCharacterFloat` (90 dòng) | **0** (chỉ còn một dòng comment nhắc tên) |
| `SpeakingPersonaFloat` (96 dòng) | **`SpeakingChatExperience` — tức là ĐANG chạy trong phiên** |

Tranh thủ soi luôn: `SpeakingCompanionInput` và `SpeakingMessageInput` cũng mồ côi. Còn tranh minh hoạ nhân vật (`characters/*`, 20 file) thì **KHÔNG** mồ côi — `PersonaCard` ở màn chọn nhân vật và màn luyện từ vựng vẫn dùng, nên không đụng.

#### Đã làm

Gỡ `SpeakingPersonaFloat` khỏi phiên đang chạy (P4-D7). Nó là một `motion.div` **`aria-hidden`** với vầng sáng `repeat: Infinity` (blur + scale 1→1.18) chạy suốt lúc ghi âm. Hai lý do bỏ, cả hai đều đo được:

1. **Không mất thông tin gì.** Trạng thái nó biểu diễn (listening · thinking · talking) vốn `aria-hidden` nên screen reader chưa bao giờ đọc được. Cùng trạng thái đó đã có ở `StreamStatusIndicator` dưới dạng **chữ** kèm `aria-live` ("Đang nghe" · "Đang xử lý" · "Đang trả lời"). Tức bỏ đi là bỏ đúng phần trang trí.
2. **CPU trong lúc thu âm.** Chất lượng audio phụ thuộc CPU (plan §Performance); một animation blur lặp vô hạn ngay trong phiên là thứ đầu tiên nên cắt.

Xoá luôn **8 file / 902 dòng** đã thành rác: 4 file mồ côi sẵn + `SpeakingPersonaFloat` + `PersonaAvatar` (chỉ float dùng) + `usePersonaReaction` (chỉ float dùng).

⚠️ **Không đụng** các animation lặp còn lại (`StreamStatusIndicator` ping, `SpeakingVoiceVisualizer`, dấu ba chấm streaming của `ChatMessageBubble`): chúng là **phản hồi trạng thái**, không phải trang trí — và waveform còn là thứ plan muốn ĐƯA LÊN trong studio hierarchy.

### Lô 2 xong (28/08) — đảo thứ bậc gõ ↔ nói

**Chẩn đoán UX-05 đúng, và nó nằm gọn trong `SpeakingInputDock`.** Dock cũ đặt ô nhập chữ chiếm `flex-1` với nút mic 48px nép bên trái: thứ TO NHẤT trên màn hình là chỗ để **gõ**, trong khi mục tiêu sản phẩm là luyện **nói**. Nay nút mic là hành động chính — 80px (mobile) / 88px (desktop), đứng giữa, kèm nhãn trạng thái bằng chữ. Đường gõ vẫn còn (plan §Risk: "giữ đường text ở drill") nhưng thu về một nút **"Gõ thay vì nói"**, mở ra mới có ô nhập. Ô nhập tự bung khi có chữ đổ vào (bấm gợi ý) — nếu không, cú bấm gợi ý trông như không ăn.

> 🔴 **Không vẽ waveform, và đó là quyết định chứ không phải bỏ sót.** Plan vẽ một dải sóng cạnh nút mic. Pipeline ghi âm **không hề lộ mức tín hiệu**: `useSpeech` chỉ trả `isListening`/`isSpeaking` — không analyser, không amplitude. Còn `SpeakingVoiceVisualizer` sẵn có thì vẽ bằng **biên độ HẰNG SỐ** (`BASE_AMPLITUDES`), tức một dải sóng không liên quan gì tới micro, cộng một vầng blur `repeat: Infinity` chạy suốt lúc thu âm. Vẽ nó ra là nói dối trạng thái (S-14) **và** đốt CPU đúng lúc chất lượng audio phụ thuộc CPU. Trạng thái vì thế là **chữ + `aria-live`** ở cả dock lẫn sidebar. Muốn waveform thật thì phải thêm `AnalyserNode` vào pipeline ghi âm — việc của backlog engine, không phải của lớp trình bày.

Bỏ luôn `animate-pulse` trên nút mic và nhãn "REC": trạng thái ghi âm nay báo bằng màu + chấm đặc + chữ, không nhấp nháy.

**Dọn tiếp họ legacy:** xoá `SpeakingVoiceVisualizer` · `VoiceVisualizer` · `MicButton` · `CorrectionCard` · `RealChatBubble` · và **`components/speaking/index.ts`** — barrel này KHÔNG ai import (mọi nơi đều import thẳng đường dẫn) nhưng nó `export` bốn file, khiến phép dò mồ côi đếm nhầm là "còn dùng". Gỡ barrel xong mới lộ ra hai file chết nữa.

**Họ legacy `components/speaking/*`: 3.360 → 1.950 dòng** (19 → 7 file, chưa tính thư mục `characters/` vẫn sống vì `PersonaCard` và màn từ vựng dùng thật).

### Lô 4 xong (28/08) — phản hồi summary-first + bố cục 3 vùng

**Bảng phản hồi 4 chiều, mặc định một dòng mỗi chiều** (AC-3). Bằng chứng — span sai → span đúng, luật, ví dụ, bảng phoneme, câu gợi ý — nằm sau nút "Xem bằng chứng". Trước đó sidebar đổ ba khối song song (lỗi · phoneme · gợi ý) nên phản hồi một lượt dài quá màn hình. Bảng này **dùng chung** cho sidebar desktop và sheet mobile: bản mobile cũ chép lại một biến thể rút gọn và lặng lẽ bỏ mất `ruleViShort` + `exampleCorrectDe`, tức người học trên điện thoại thấy mình sai ở đâu nhưng không thấy vì sao.

Logic tách hẳn ra `lib/speaking/feedbackModel.ts` (thuần, 24 unit test) — nằm trong `src/lib/**` nên có coverage, khác với lớp trình bày.

> 🔴 **Chỉ dựng chiều CÓ dữ liệu thật, và chiều thứ tư mang đúng tên nó có.** Plan vẽ `Aussprache · Grammatik · Wortschatz · Natürlichkeit`. Backend không cấp bốn kênh ngang nhau:
> | Chiều | Nguồn thật | Dựng khi |
> |---|---|---|
> | Phát âm | `PhonemeEvalResult` (dịch vụ phoneme, tất định) | lượt đó có chấm phát âm |
> | Ngữ pháp | `errors[]` trừ mã `LEXICAL.*` | lượt ĐÃ được phân tích |
> | Từ vựng | lỗi `LEXICAL.*` + `suggestions[]` | có lỗi dùng từ hoặc có gợi ý đang hiện |
> | **Phù hợp** (không phải "Tự nhiên") | `status` + `feedback` của lượt | backend trả `status` |
>
> Trường duy nhất gần "tự nhiên" là `status`, mà prompt định nghĩa `ON_TOPIC_NEEDS_IMPROVEMENT` là *"đúng chủ đề nhưng yếu về ngôn ngữ hoặc quá ngắn"* — đó là phán đoán **đúng chủ đề + đủ mạnh**, không phải phép đo độ tự nhiên. Dán nhãn "Tự nhiên" lên nó là nói quá dữ liệu, cùng loại với việc in "Câu 3/8" khi không có mẫu số (D-4).
>
> Và **Từ vựng không bao giờ báo "Tốt"**: danh mục lỗi chỉ có MỘT mã `LEXICAL.*`, nên "không có lỗi ⇒ từ vựng tốt" là kết luận rút từ sự im lặng. Chiều này là kênh **đề nghị**, không phải kênh chấm.

**Bố cục 3 vùng ở ≥1280** — dải ngữ cảnh trái (nhân vật · vai trò · chế độ · CEFR · mục tiêu · đồng hồ) · transcript giữa · phản hồi phải. Dưới 1280 dải trái gập, header lấy lại subtitle + đồng hồ bằng `xl:hidden`; ở 390 cả hai panel bên gập, nút nói dính đáy. Gỡ luôn ba chỗ nói cùng một thứ trên cùng khung nhìn: khối "câu mở đầu" trùng giữa sidebar và empty state, và vai trò + chủ đề trùng giữa dải trái và empty state.

Bảng phoneme `dynamic import` (§Performance) — nó chỉ xuất hiện khi lượt đó thật sự được chấm phát âm.

#### 🔴 Ba lỗi thật lô 4 tìm ra

1. **Panel trạng thái in chuỗi khoá thô ra màn hình.** `SpeakingChatSidebar` đọc `recorder.*` từ namespace `speaking.chat`, nhưng nhóm đó sống ở `speaking`. next-intl **không ném lỗi** — nó in thẳng `speaking.chat.recorder.aiSpeaking` cho người dùng. Lô 2 đặt vào (lúc thay dải sóng bằng chữ) và mọi phiên desktop đều dính. `SpeakingInputDock` đọc đúng namespace, hai chỗ cùng một nhãn mà lệch nguồn.
2. **`check-i18n-usage.js` mù với khoá ghép lúc chạy** — đó là lý do lỗi trên sống sót qua CI xanh. Đã dạy checker kiểm **phần tĩnh** trước `${`: nó phải giải ra một NHÓM trong catalog. Self-test 13 → 17 ca; số khoá được kiểm 4.629 → 4.751. Đã nghiệm thu bằng cách đưa bug trở lại: checker đỏ đúng chỗ.
3. **Gợi ý trả lời chen ngang lúc đang thu âm.** Bộ đếm gợi ý **không hề nhìn ô gõ** — nó chỉ đếm từ lúc AI nói xong — nên sau 10 giây nó bật panel gợi ý ngay giữa lúc người học đang nói, tức mời họ đọc câu viết sẵn đúng vào lúc họ tự nói. Nay đồng hồ tạm dừng khi mic mở. Câu chữ dưới dock cũng viết lại: bản cũ nói *"nếu bạn chưa nhập"* trong khi bộ đếm không liên quan gì tới việc nhập và đường chính giờ là **nói** (3 locale).

Thêm một chỗ **shape-lie** đã chặn: `lastUserErrors = lastUserMessage?.errors ?? []` xoá mất phân biệt giữa `undefined` (lượt chưa được AI phân tích) và `[]` (đã phân tích, sạch lỗi) — giữ `?? []` thì bảng sẽ báo "Ngữ pháp: Tốt" cho một câu chưa ai chấm. Cùng họ lỗi với §2.3.

**Đo sau lô 4:** **601 test / 58 file** · **73 e2e / 12 spec** · tsc sạch · 23 warning · debt token 2.242 · i18n parity + usage OK (self-test 17/17) · build exit 0.

### Lô 3 xong (28/08) — dọn trùng CHẾT, không phải trùng vai

Trinh sát cho kết quả khác hẳn dự đoán của handoff: phần lớn "hai họ trùng vai" hoá ra là **trùng chết**. Xoá **6 file / 1.312 dòng**, tất cả đều verify 0 người dùng (không route, không import, không dynamic import, `git status` sạch — owner không đụng).

**Vòng một — 4 file, 1.192 dòng:**

| File | Dòng | Vì sao chết |
|---|---|---|
| `components/speaking/WelcomeScreen.tsx` | 565 | người dùng duy nhất là `SpeakingWelcomeClient`, mà file đó cũng chết |
| `components/speaking/SessionSummary.tsx` | 349 | mọi import `SessionSummary` đều trỏ bản `features/ai-speaking/` |
| `features/ai-speaking/SpeakingWelcomeClient.tsx` | 144 | không route nào mount |
| `features/ai-speaking/ChatMessageBubble.tsx` | 134 | phòng chat dùng `SpeakingMessageBubble`, không ai import file này |

> ⚠️ Handoff cũ **ghi nhầm** rằng `SessionSummary.tsx` đang bị owner sửa song song. Có HAI file cùng tên; bản owner sửa là `features/ai-speaking/SessionSummary.tsx` (643 dòng, còn sống, 4 người dùng). Bản legacy 349 dòng hoàn toàn mồ côi.

**Vòng hai — bẫy §7.5 đúng như dự báo, xoá lớp trên lộ lớp dưới:** thêm 2 file (`SuggestionBar` 90 · `SpeakingAutoTtsToggle` 30) và **6 export chết** trong `components/speaking/types.ts` (`Exchange` · `ErrorSegment` · `glass` · `glassLight` · `SPEAKING_DARK` · `SPEAKING_PAPER_BG`) — chúng chỉ sống nhờ `WelcomeScreen`/`SessionSummary` legacy. `types.ts`: 140 → 89 dòng.

**Vòng ba: sạch** — không còn file mồ côi ở cả hai họ.

> 🪤 **Phép dò mồ côi tự nó suýt nói dối, hai lần.** Lần đầu vì `grep` ở máy này là **ugrep** và mẫu `\|` trong hàm không khớp như BRE; lần sau vì **BSD `sed` không hiểu `\?`** nên `s/\.tsx\?$//` không cắt đuôi, và script đi tìm chuỗi `"SpeakingChatExperience.tsx"` — thứ không ai viết trong import. Cả hai lần script báo **TOÀN BỘ hai họ đã chết**, kể cả `SpeakingChatExperience` đang chạy. Bắt được là nhờ **đối chứng dương chạy qua đúng đường code của vòng lặp** — đối chứng hardcode ở ngoài vòng lặp vẫn xanh trong khi vòng lặp đã hỏng. Ghi lại vì đây là cách một đợt "dọn code chết" biến thành một đợt xoá nhầm.

#### Còn lại của lô 3 — dời thư mục (chưa làm, có chủ đích)

Ba file **không** trùng vai, chỉ đứng nhầm chỗ: `SpeakingMessageBubble` (385) · `WeeklyChallengeCard` (310) · `PronunciationFeedback` (209), cộng `SpeakingPersonaMiniAvatar` · `UserTextWithErrorSpans` · `actionChips` · `personaTheme` · `types`. Dời chúng sang `features/ai-speaking/` sẽ đóng trọn AC-5 ("chỉ còn một họ component") nhưng là một diff thuần cơ học chạm **cả consumer v1 lẫn v2** — nên tách ra làm riêng kèm visual regression, thay vì gộp vào đợt vừa dọn 1.312 dòng.
⚠️ Thư mục `characters/*` (20 file) **KHÔNG** mồ côi: `PersonaCard` và màn luyện từ vựng dùng thật.

**Đo sau lô 3:** 612 test / 59 file · 76 e2e / 13 spec · tsc sạch · 23 warning · debt token 2.242 · i18n parity + usage OK · build exit 0. Số file nguồn checker quét: 794 → 788.

### ✅ B-17. S-04 — Lesson shell (P1) — XONG 28/08

`LessonShell` chung cho bài **Học** (`/learn/{nodeId}`) và bài **Luyện** (`/practice/{nodeId}/{skill}`): header ngữ cảnh (chương · tiêu đề · mục tiêu · thời lượng) → segmented **Học | Luyện** → thanh tiến độ theo bước → nội dung → (tuỳ chọn) cột phản hồi ở ≥1280. URL giữ nguyên theo IA-D8; segmented chỉ đổi đường đi.

> 🔴 **ĐO TRƯỚC KHI DỰNG — và runner luyện tập mất trắng y như engine thi của B-13.** Ba kịch bản Playwright chạy trên mã CŨ:
> - trả lời 2/3 câu rồi **tải lại** → còn **0**;
> - trả lời rồi **đi trang khác và quay lại** → còn **0**;
> - `localStorage` **không đổi một byte** sau khi trả lời.
>
> Nguyên nhân giống hệt B-13: `answers` chỉ sống trong `useState`, không `localStorage`, không `beforeunload`. Phép đo có **đối chứng dương** (đếm đúng 2 câu đã trả lời TRƯỚC khi tải lại) nên không phải phép đo rỗng nghĩa. Ba spec đó nay là bộ nghiệm thu của AC-2 — chúng từng đỏ 3/3, giờ xanh 3/3.

**Vá:** `lib/lesson/lessonDraft.ts` (thuần, 13 unit test) theo đúng khuôn `examDraft` của B-14, **cộng một trường mà bài thi không cần**: `generation`. Một kỹ năng có thể sinh **thế hệ đề mới** (`POST …/{SKILL}/next`); khôi phục đáp án của thế hệ 1 lên đề thế hệ 2 sẽ đánh dấu đúng những câu người học chưa hề trả lời, nên nháp lệch thế hệ bị coi như không có. Nhãn nêu **đúng phạm vi** — "Đã lưu trên thiết bị này lúc HH:MM" — vì đây là `localStorage` của một trình duyệt chứ không phải server (ràng buộc S-14, y như nhãn bài thi).

🪤 Bẫy đã chặn khi cài: effect **ghi** nháp chạy trước effect **khôi phục** sẽ ghi đè bản nháp bằng một Map rỗng ngay khi vào trang. Chặn bằng cờ `draftReadyRef` gắn theo scope — và cờ đó phải reset khi sinh đề mới, nếu không vòng khôi phục tưởng mình đã chạy rồi.

#### 🔴 Hai lỗi thật B-17 tìm ra

1. **Runner luyện tập KHÔNG hề báo tiến độ.** Không có "còn mấy câu" ở bất cứ đâu — nút nộp chỉ xuất hiện khi đã trả lời hết, nên trước đó người học không có cách nào biết mình đang ở đâu. Shell nay có thanh + nhãn "Bước n/N", đọc được bằng `aria-valuenow` và thông báo qua `aria-live`.
2. **`estimatedMinutes` đã nằm trên dây từ lâu nhưng UI vứt đi im lặng.** `SkillTreeService.getNodeSession` trả `estimatedMinutes` (từ `skill_tree_nodes.estimated_minutes`, thêm ở V144) trong chính response mà trang học đang đọc, nhưng kiểu `NodeSession` ở FE **không khai** trường đó nên nó bị bỏ. Đã khai; cột NULLABLE thật nên chỗ hiển thị bỏ HẲN ô khi vắng thay vì in "~0 phút".

**Ba chỗ nói trùng đã gỡ:** tiêu đề · tiếng Đức · module (header shell ↔ thẻ đầu bài của trang Học) · tiêu đề kỹ năng và chương (header shell ↔ thẻ điểm của runner) · nút "sang luyện tập" (nay là segmented). Thẻ đầu bài rút thành một **dải gọn** (emoji · cấp độ · XP) chứ không giữ nguyên thẻ đệm dày sau khi rút ruột — một ô gần trống trông như lỗi hơn là như thiết kế. Thẻ vị trí-trong-lộ-trình nay buộc theo `roadmapState` thay vì `session`, vì `/roadmap/me` có thể không chứa node đó.

**Còn lại của S-04 (chưa làm, có chủ đích):** AC-3/AC-4/AC-5 — chuẩn hoá 5 skill view (bỏ hex/radius hardcode, dùng chung primitive loading/error/empty, hyphenation từ ghép Đức ở 390). Plan §Risk yêu cầu **làm theo lô từng skill, mỗi lô một visual regression**; gộp vào đợt này là đúng thứ plan cảnh báo không nên làm.

**Đo sau B-17:** **641 test / 61 file** · **84 e2e / 14 spec** · tsc sạch · 23 warning · **debt token 2.236** (giảm 6, baseline đã chốt lại) · i18n 3.252 khoá × 3 locale · build exit 0.

---

## 🟣 Wave 3–5 (tóm tắt, chi tiết ở `UI_REDESIGN_PLAN.md` §2)

| Wave | Việc | Ghi chú quan trọng |
|---|---|---|
| 3 | **S-08** SRS: một pre-session duy nhất (`Heute · N Karten fällig`), hợp nhất các bản VocabularyCard trùng | Cấm chạm thuật toán FSRS/SM-2 — chỉ đổi lớp trình bày |
| 3 | **S-10** Fortschritt: hierarchy learning → mastery → milestone → habit → reward → evidence | **P4-D2:** skill mastery & CEFR % **KHÔNG có nguồn canonical** → hiển thị "chưa đủ dữ liệu", cấm vẽ. Đây cũng là nơi nhận stat strip và khối phase đã gỡ khỏi Heute |
| 3 | **S-12** Teacher Heute + nav | Gỡ endpoint text khỏi error UI (`/api/v2/teacher/grading/queue` vẫn còn — thấy trong `docs/wave1-s01-s13/teacher-bewerten-390.png`) |
| 3 | **S-14** hợp đồng trạng thái phủ mọi màn đã redesign | route-level `loading.tsx`/`error.tsx` cho các area chính |
| 4 | **S-11** Homepage: narrative + server component + neutral+1 accent | **P4-D5** gỡ số liệu/testimonial không nguồn; **P4-D6 (demo)** CTA "Xem demo 90 giây" phải gỡ hoặc dẫn demo thật |
| 4 | Typography/spacing sweep phần còn lại · motion vocabulary · **18 screen-local primitive** (DS §9.4) | Debt token hiện **2.397**, chỉ được giảm |
| 5 | Legacy retirement + URL alias (IA Wave 2–3) | stats/history/achievements/certificates → Progress; interviews → Sprechen. 307 + giữ query. Điều kiện xoá: IA §12 Wave 3 (6 điều kiện) |

---

## ⚪ Nợ kỹ thuật mang theo (không do redesign tạo ra)

| # | Vấn đề | Ghi chú |
|---|---|---|
| N-01 | `MISSING_MESSAGE: pricing.plans.FREE.badge (vi)` khi prerender legacy `/student/pricing` | Build vẫn exit 0. Thiếu khoá trong catalog legacy `messages/vi.json`. Vá lẻ hoặc chờ legacy retirement |
| N-02 | Font payload **không giảm** (22 WOFF2 / ~505KB, preload 18 file ~432KB trên mọi route) | Owner đã chốt giữ italic Newsreader thật. Đường giảm thật: cắt Inter (−214KB) khi legacy chết → Wave 4–5 |
| N-03 | Control 40px ở **page code** của `/v2/login` (nút hiện mật khẩu, link phụ) | Ngoài scope Wave 0 (chỉ primitive). Vá khi chạm màn auth |
| N-04 | 24 ESLint warning pre-existing (img/hook-deps), hiện còn **23** | Không tăng; giảm dần khi chạm file |
| N-05 | Ratchet known limitation: cùng một literal **chuyển vị trí** trong cùng file với count không đổi vẫn pass | Owner đã chấp nhận cho Gate 0 |
| N-06 | CLS/LCP **before/after unavailable** (không có baseline trước Wave 0) | Đã là Gate exception owner chấp nhận. Forward baseline: LCP 120ms · CLS 0 (localhost) |

---

## 🧰 Bẫy đã trả giá — đọc trước khi bắt tay

1. **Chụp evidence:** ĐỪNG bấm "OK" trên `AuthRecoveryDialog` (= logout → về `/v2/login`). Chỉ chờ ~2s rồi dùng **DOM-level click** (`page.evaluate(() => btn.click())`) vì dialog che pointer.
2. **Không có backend local:** dùng `page.route('**/api/**')` stub `/roadmap/me`, `/today/me`, `/phase`, `/xp` — xem `docs/wave1-s02-s03/` để biết shape fixture.
3. **Cookie `refresh_token=dummy`** đủ qua middleware (gate cookie-presence) để render shell.
4. **Test mock `next-intl` trả KEY** → assertion phải theo key (`openNav`), không theo chuỗi tiếng Việt.
5. **`chrome.*.json` bị CẢ HAI track chạm** (khối `error` của owner + khối `ui`/`nav` của redesign). Khi commit phải tách bằng script node: dựng bản staged = `HEAD` + đúng khoá của mình, `git add`, rồi khôi phục working tree. **`git add -p` không dùng được** ở môi trường này.
6. **`.gitignore`** ignore `docs/` và `*.png` toàn cục; evidence sống nhờ khối exception **hẹp** ở CUỐI file (thứ tự rule quan trọng). Thêm thư mục evidence mới thì thêm cặp `!docs/<dir>/` + `!docs/<dir>/**`.
7. **`ga-ui` là class CHẾT** (không rule CSS nào) — đừng thêm vào code mới.
8. **`TkBadge` solid dùng `text-ga-bg`**, KHÔNG dùng `--ga-accent-ink` (đổi theo role → student là màu tối, phá contrast).
9. **e2e cần `E2E_JWT_SECRET`** khớp `.env.local`, nếu không ~30 fail giả.
10. **Nhánh `feat/roadmap-tree-v2` không kích hoạt CI** — phải có PR nhắm `main`/`dev`.

---

## ✅ Lệnh verify chuẩn (chạy trước mỗi lần báo cáo)

```bash
cd frontend && npm run check:design-tokens && npx tsc --noEmit && npm run check:i18n
```
```bash
cd frontend && npx vitest run
```
```bash
cd frontend && npm run build
```
Hiện trạng chuẩn để so sánh: **543 test / 55 file** xanh · tsc sạch · **23** ESLint warning · debt token **2.397** · i18n **3.203 khoá × 3 locale** · build exit 0 (kèm N-01).

**Đo lại 26/08 sau B-01+B-02 — khớp nguyên vẹn:** 543/55 xanh · tsc sạch · 23 warning · debt 2.397 (0 vi phạm mới) · 3.203 khoá × 3 locale · build exit 0 (2 dòng `MISSING_MESSAGE` = N-01).

**Đo lại 26/08 sau B-05+B-06+B-08+B-09+B-12:** 550 test / 55 file · 61 e2e · tsc sạch · 23 warning · debt token 2.284 · i18n 3.206 khoá × 3 locale · build exit 0.

**Đo lại 26/08 sau B-14 — mốc chuẩn MỚI:** **567 test / 56 file** xanh (+17) · **66 test e2e** xanh (+5) · tsc sạch · **23** warning (không tăng) · debt token **2.242** (giảm thêm 42, baseline đã chốt lại) · i18n **3.226 khoá × 3 locale** · build exit 0.

E2E chạy được thì cần dev server + secret khớp:
```bash
cd frontend && export E2E_JWT_SECRET="$(grep '^JWT_SECRET=' .env.local | head -1 | sed 's/^JWT_SECRET=//')" && npx playwright test student/ v2-smoke.spec.ts auth.spec.ts role-area-guard.spec.ts teacher-lms.spec.ts payment-and-srs.spec.ts speaking.spec.ts v2-responsive.spec.ts
```
(cố ý liệt kê từng tệp thay vì chạy trần: `npm run test:e2e` sẽ kéo cả `live-account.spec.ts` bắn vào prod)
