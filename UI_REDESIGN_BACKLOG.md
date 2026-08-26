# UI Redesign — Backlog chi tiết cho session sau

> **Cập nhật:** 26/08/2026, sau khi push `f245d29f`.
> **Đọc cùng:** `UI_REDESIGN_SESSION_HANDOFF_2026-08-26.md` (trạng thái tổng) · `UI_REDESIGN_PLAN.md` (§3 waves, §7 quyết định) · `WAVE_0_GATE_REPORT.md` · `WAVE_1_CHECKPOINT_S01_S13.md` · `WAVE_1_S02_S03_REPORT.md`.
> **Đã xong:** Phase 1–4 approved · Wave 0 (`5a9b6127`) · Wave 1 S-01+S-13 (`dfe80764`) · Wave 1 S-02+S-03 (`f245d29f`). Cả ba đã push lên `origin/feat/roadmap-tree-v2`.

Mỗi mục dưới đây có: **vì sao**, **file cụ thể**, **định nghĩa xong**. Thứ tự trong mỗi nhóm là thứ tự nên làm.

---

## 🔴 P0 — Phải xử lý trước khi làm gì tiếp

### B-01. E2E `roadmap.spec.ts` ĐANG GÃY vì S-03

**Vì sao:** S-03 đã thay ba tab (`Cây học tập · Bài học · Giai đoạn`) bằng segmented `Cây | Danh sách`. Spec vẫn click tab tên **"Bài học"** — tab đó không còn tồn tại.

**File:** `frontend/tests/e2e/student/roadmap.spec.ts`
- dòng ~87: `page.getByRole('tab', { name: 'Bài học' }).click()` → phải là `{ name: 'Danh sách' }`
- dòng ~91, ~95: tên test + click tương tự
- dòng ~81 và comment đầu file (dòng 5, 17–18) mô tả cấu trúc 3 tab → viết lại theo mô hình mới
- Kiểm thêm: `roadmap-tree.spec.ts` (phủ tab cây) — cây giờ là **mặc định trên desktop nhưng KHÔNG mặc định dưới 768px**; spec chạy ở viewport nào?

**Lưu ý kỹ thuật:** `TkSeg` vẫn dùng `role="tab"`/`aria-selected` nên `getByRole('tab')` vẫn đúng loại, chỉ đổi *name*. Trên viewport hẹp giá trị mặc định là `Danh sách`, desktop là `Cây` — spec phải khai rõ viewport thay vì dựa vào mặc định.

**Xong khi:** `npm run test:e2e` xanh cho `student/roadmap.spec.ts` + `roadmap-tree.spec.ts`. 🪤 Nhớ export `E2E_JWT_SECRET` khớp `.env.local`, nếu không sẽ có ~30 fail giả.

### B-02. Rà toàn bộ e2e còn lại theo nav mới

**Vì sao:** S-01 đổi sidebar từ ~30 mục thành 5 area; nhãn/topbar/account menu đều đổi. Spec nào điều hướng bằng cách click nhãn sidebar cũ sẽ gãy.

**File cần đọc:** `tests/e2e/v2-smoke.spec.ts` · `live-account.spec.ts` · `auth.spec.ts` · `student/messages-inbox.spec.ts` (Tin nhắn giờ là icon inbox trên topbar, không còn mục sidebar) · `teacher-lms.spec.ts` · `role-area-guard.spec.ts`.

**Xong khi:** toàn bộ 12 spec e2e xanh, và có ít nhất 1 spec khẳng định persistent nav đúng 5 mục.

### B-03. Mở PR để CI thật sự chạy

**Vì sao:** `.github/workflows/frontend-ci.yml` chỉ trigger trên `push` vào `master/main/dev` hoặc `pull_request` **nhắm tới** các nhánh đó. Push vào nhánh feature **không kích hoạt gì**. Nghĩa là step **Design Token Ratchet** thêm ở Wave 0 **chưa từng chạy trên CI** — mới chỉ verify local.

**Việc:** mở PR `feat/roadmap-tree-v2` → `main`, mô tả gộp 3 commit, link 3 báo cáo. Kiểm cả 4 workflow (frontend, backend, security, mobile).

🪤 `gh pr checks` in nhiều dòng cùng tên job — đọc hết, đừng chỉ nhìn dòng cuối.

---

## 🟠 P1 — Hoàn tất Wave 1

### B-04. Hợp nhất Lernbaum rồi mới áp contract node cho `TreeNodePanel`

**Vì sao:** panel node của cây vẫn có **4 nút kỹ năng 4 màu khác nhau** (Nghe/Đọc/Nói/Viết) và 4 CTA ngang hàng — vi phạm UI-06 (feature colors) và contract S-03 ("1 CTA chính"). Tôi **cố ý chưa chạm** vì đây là file của mảng Lernbaum đang mid-flight (L3c → L2 → L4, PR #376), plan S-03 §Risk yêu cầu hợp nhất trước.

**File:** `frontend/src/components/roadmap-tree/TreeNodePanel.tsx` (+ `SkillTreeCanvas.tsx` nếu chạm màu).
**Thứ tự:** merge/đóng nhánh Lernbaum → mới sửa → visual regression cây ở 4 breakpoint.
**Xong khi:** panel có 1 CTA chính + hành động phụ; 4 kỹ năng dùng surface trung tính + một accent; ảnh cây trước/sau không lệch ngoài dự kiến.

### B-05. Gom nhóm local nav của Lernen

**Vì sao:** local nav Lernen đang **10 mục phẳng** nên phải cuộn ngang ở 1440. IA §5.3 quy định nhóm con: `Lernweg` · `Heute wiederholen` · `Bibliothek` (video/từ vựng/ngữ pháp/bài tập) · `Meine Klasse` · `Entdecken` (tin tức/trò chơi).

**File:** `frontend/src/components/ui-v2/nav.ts` (`studentAreas.lernen.local`) + `GaLocalNav.tsx` (hỗ trợ nhóm/nhóm phụ).
**Xong khi:** local nav ≤5 mục cấp 1 ở 1440 không cuộn ngang; mọi destination cũ vẫn ≤2 cấp.

*(B-04 và B-05 chạm cùng vùng Lernen → nên làm CHUNG một đợt.)*

### B-06. Gộp footer sidebar với account menu

**Vì sao:** sidebar còn footer avatar + "Đăng xuất" trong khi topbar đã có account menu chứa đúng những mục đó — trùng lặp (điểm B của checkpoint S-01).

**File:** `frontend/src/components/ui-v2/GaSidebar.tsx` (khối `mt-auto`).
**Xong khi:** một nơi duy nhất cho hồ sơ/đăng xuất, hoặc có lý do viết rõ tại chỗ vì sao giữ cả hai.

### B-07. Gate 1 của Wave 1 (cần người thật — owner chạy)

Theo `UI_REDESIGN_PLAN.md` §3 Gate 1:
- First-click test: **≥80%** chọn ContinueLearning khi được hỏi "học tiếp".
- Task "tìm và mở node kế tiếp": thành công **≥90%**.
- Route reachability 100% (đã có lưới tự động: `navAreaModel.test.ts`).
- **Analytics map cũ→mới**: nav đổi id/nhãn nên event cũ sẽ đứt. Cần map trước khi coi số liệu là so sánh được (IA §15).

---

## 🟡 P2 — Nợ còn lại của Wave 0 (chưa làm, có chủ đích)

### B-08. Hợp nhất `TkStatStrip` + `AdStat` thành một component

**Vì sao:** DS §8.2 yêu cầu hợp nhất; `AdStat` bắt caller truyền **hex thô** và tự ghép chuỗi `${color}0e`, còn `TkStatStrip` nhận CSS var — hai API cho cùng một thứ. Wave 0 chỉ vá file thực sự chạm nên chưa gộp.

**File:** `frontend/src/components/ui-v2/TkStatStrip.tsx` · `AdStat.tsx` + **13 màn tiêu thụ** (`app/v2/org/*` 9 màn, `app/v2/student/achievements`, `app/v2/admin/*`).
**Xong khi:** một component, API nhận **tone token** (không nhận hex), typography theo `--ga-text-stat`/`--ga-text-stat-label`, `border-ga-line` thống nhất.

### B-09. `SkeletonRow` dùng chung `ga-shimmer`

**Vì sao:** `SkeletonRow` đang dùng `animate-pulse` của Tailwind trong khi `DataTable` dùng `.ga-shimmer` — hai ngôn ngữ loading trong cùng một hệ.
**File:** `frontend/src/components/ui-v2/SkeletonRow.tsx`.

### B-10. Primitive đã DEFER — điều kiện mở

| Primitive | Điều kiện làm |
|---|---|
| `GaCheckbox` / `GaRadio` / `GaSwitch` | Khi có consumer thật (nhiều khả năng ở S-09 Exam hoặc form teacher). Không tạo trước. |
| `GaToast` | **Dependency:** `frontend/src/app/layout.tsx` còn render `Toaster` từ `@/components/ui/sonner` (legacy, dùng chung cả cây v1). Chỉ làm khi migrate được root Toaster thật. |

### B-11. Hardcode còn lại trong danh sách DS §9.3

- `frontend/src/components/ui/gender-word.tsx`: **14 hex** der/die/das/plural → 4 token `--gender-*` + dẫn xuất (file thuộc lớp legacy đang phong tỏa → làm khi lớp đó được mở hoặc khi màn từ vựng được redesign ở S-08).
- `sonner` skin navy → skin ga: đi cùng B-10 GaToast.
- `GaLogo.tsx`: hex là **exception đã ghi** trong `design-token-exceptions.json` (asset SVG) — không cần sửa.

### B-12. Dọn code chết vừa lộ ra

`frontend/src/components/features/dashboard/DashboardContainer.tsx` và `TodayPlanBoard.tsx` **không còn ai import** (đã kiểm bằng grep toàn `src`). Chúng là tàn dư v1, không phải do Wave 1 tạo ra, nhưng giờ chắc chắn mồ côi.
**Xong khi:** xoá kèm kiểm `knip`/grep, hoặc ghi vào legacy deletion map nếu muốn gộp vào Wave 5.

---

## 🔵 Wave 2 — theo P4-D8 (thứ tự phụ thuộc kết quả verification)

### B-13. **2.0 — Read-only verification autosave/data-loss của Exam** ⟵ mở màn Wave 2

**Đây là việc ĐẦU TIÊN của Wave 2, và nó quyết định thứ tự hai việc sau.**

**Việc:** chỉ ĐỌC, không sửa — xác minh engine thi hiện tại có autosave/recovery thật không.
**Nơi đọc:** `frontend/src/app/v2/student/mock-exam/run/**` (`ExamTaking.tsx`), API bài thi ở backend, hành vi khi rớt mạng giữa bài.
**Kết luận dẫn tới:**
- Có blocker data-loss/recovery **đã verify** → **S-09 Exam Shell trước** S-06 Interview.
- Không có blocker verified → **S-06 AI Interview trước** (khớp hero-product priority).

⚠️ Nếu engine **chưa** có autosave: Exam Shell **không được** hiển thị "Đã lưu" (cấm nói dối trạng thái — plan S-14). Phải cảnh báo trước khi vào bài.

### B-14. S-09 — Prüfung hub + Exam Shell (P0-S)
`/v2/student/exam` (96 dòng, đang là destination mờ nhạt) → hub 3 nhóm theo IA §6.3: kỹ năng Goethe · `Prüfungssimulation` · `B1-Bereitschaft` + báo cáo. ExamShell ẩn XP/streak/nav/animation, có timer + section + progress + trạng thái autosave + exit có kiểm soát. Style: light warm-paper (P4-D5).

### B-15. S-06 — AI Interview (P0-S)
`/v2/student/interviews` (399 dòng) → đủ flow Setup → Room → Question → Answer → Evaluation → Improved Answer → Report. **P4-D4 (Interview):** verify API từng stage ở đầu W3; stage nào thiếu backend thì ship không có stage đó + ghi backlog backend riêng, KHÔNG chờ.
Room ẩn nav (đã có sẵn: `isImmersiveRoute()` trong `nav.ts` đã liệt kê `/v2/student/interviews`).

### B-16. S-07 — Speaking Studio (**P1-high**, sau Interview)
Bỏ kiến trúc chat-centric (`ChatMessageBubble`/`SpeakingChatExperience`/input dock) → studio shell: persona · scenario · CEFR · goal · mic · waveform · timer, transcript là panel phụ, feedback 4 chiều summary-first.
**P4-D7:** gỡ mesh/orb/character-float khỏi phiên đang chạy; chỉ cân nhắc ở welcome/setup và phải respect `prefers-reduced-motion`.
Hợp nhất hai họ component: `components/speaking/*` (legacy) + `components/features/ai-speaking/*` (21 component).

### B-17. S-04 — Lesson shell (P1)
`LessonShell` chung cho `/learn/[nodeId]` và `/practice/[nodeId]`: header chương + mục tiêu + tiến độ + thời lượng, exit có save, recap + next action. 5 skill view bọc lại dần, không rewrite.

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
