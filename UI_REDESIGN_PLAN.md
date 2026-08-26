# DeutschFlow — Screen Redesign Plan (Phase 4)

> **Trạng thái:** **APPROVED — owner duyệt P4-D1–P4-D8 ngày 26/08/2026** (P4-D4 có điều kiện; P4-D6/P4-D8 bản đã chỉnh — xem §7). **Phase 5 đang thực hiện — Wave 0 implemented, Gate 0 pending owner approval; Wave 1 chưa bắt đầu.** Điều kiện thi hành Wave 0: §7.1 (W0-C1…C10). Bằng chứng Gate 0: `WAVE_0_GATE_REPORT.md`.
> **Ngày:** 26/08/2026
> **Nguồn thượng nguồn đã APPROVED:** `DEUTSCHFLOW_DESIGN_SYSTEM.md` (D1–D8) · `INFORMATION_ARCHITECTURE.md` (IA-D1–IA-D8) · `CLAUDE_UI_UX_HANDOFF.md` · `UI_UX_AUDIT.md`
> **Phạm vi Phase 4:** kế hoạch redesign theo từng màn, implementation waves, component dependency order, gate và acceptance criteria.
> **Không thay đổi:** code UI, API, auth, business logic, data model. Phase 4 là tài liệu, không phải commit.

---

## 0. Input đã khóa — không bàn lại trong Phase 4

Từ Design System (approved D1–D8) và IA (approved IA-D1–IA-D8):

| Nguồn | Điều đã chốt |
|---|---|
| D1 | Hai family: **Newsreader** (display/vocab) + **Be Vietnam Pro** (UI sans duy nhất); bỏ Instrument Sans |
| D2 | Warning `#9A5B12` + soft; không dùng amber/orange tùy ý |
| D3 | Page gutter desktop **48px** (bỏ 52px) |
| D4 | Canonical web = **light warm-paper duy nhất**; không dark mode Galerie |
| D5 | Glassmorphism/`df-bottom-nav` chỉ sống trong `html.native`, ngoài phạm vi redesign web |
| D6 | Tooltip/Popover/Select/Toast = **adapter Radix/sonner + ga skin** |
| D7 | Type ramp 13 role + mapping gộp nửa-pixel |
| D8 | Control mobile **min-height 44px** |
| IA-D1 | Student nav: **Heute · Lernen · Sprechen · Prüfung · Fortschritt** |
| IA-D2 | `/v2/student/roadmap` là canonical Lernen/Journey home |
| IA-D3 | Classes trong Lernen + Heute; Messages/Notifications topbar; Profile/Tuition account menu |
| IA-D4 | Interview thuộc **Sprechen** + dedicated flow + Dashboard prominence; không top-level thứ 6 |
| IA-D5 | `/v2/student/progress` là Fortschritt home; stats/history/achievements/certificates thành subsection |
| IA-D6 | Teacher desktop: **Heute · Klassen · Bewerten · Materialien · Berichte** |
| IA-D7 | Mobile: student 5 items; teacher Heute/Klassen/Bewerten/Materialien/Mehr |
| IA-D8 | **Regroup navigation trước, URL consolidation sau** bằng 307/alias |

Ngoài ra giữ nguyên: Galerie `/v2` canonical · radius 2px + touch 6px · song ngữ theo trình độ · Speaking Studio = P1-high · quick wins gate chặt.

---

## 1. Cách đọc bản kế hoạch

### 1.1 Cấu trúc mỗi màn

Mỗi màn được mô tả theo đúng 13 mục: Current problem → UX reasoning → Proposed solution → Information hierarchy → Components affected → States → Responsive 1440/1280/768/390 → Accessibility → Performance → Priority → Dependencies → Risk → Acceptance criteria.

### 1.2 Thang ưu tiên dùng trong Phase 4

| Band | Nghĩa | Nguồn thẩm quyền |
|---|---|---|
| **P0-S** | Structural blocker — đã được Phase 1 xếp P0 và owner giữ nguyên (dashboard hierarchy, nav breadth, hai design system/token, journey spine, interview prominence, exam shell) | Handoff §17 |
| **P0-F** | **Functional blocker ĐÃ VERIFY** — có bằng chứng đo được hoặc tái hiện được, xử lý như hotfix riêng, không kéo cả redesign lên P0 | Bằng chứng liệt kê §1.3 |
| **P1-high** | Tranche đầu ngay sau P0 — **Speaking Studio** | Quyết định #7 đã chốt |
| **P1** | High impact, sau P1-high | Handoff §17 |
| **P2 / P3** | Visual consistency / polish | Handoff §17 |

**Quy tắc kỷ luật ưu tiên:** một hạng mục chỉ được gắn **P0-F** khi có bằng chứng verify (số đo, log, repro trên prod). Suy đoán "có thể hỏng" → tối đa P1 kèm nhiệm vụ verify. Speaking Studio **không** được nâng lên P0 dù nằm ở wave sớm.

### 1.3 Danh sách P0-F đã verify (bằng chứng có thật, tính đến 26/08/2026)

| ID | Blocker | Bằng chứng | Trạng thái |
|---|---|---|---|
| F-01 | `Permissions-Policy: microphone=()` chặn mic toàn site | `curl -sI` header prod; `NotAllowedError` tái hiện 2 profile | ✅ đã vá (#392) |
| F-02 | `<audio>` blob TTS treo readyState 0 → khoá lượt vĩnh viễn | Probe trong page prod: không event, `decodeAudioData` OK | ✅ đã vá (#400) |
| F-03 | Trần axios 8s cho lượt nói → client huỷ trong khi backend vẫn xử lý | Banner ECONNABORTED trên prod, tail lượt >6,5s | ✅ đã vá (#401) |
| F-04 | Text LLM double-escape `\n` lọt UI + TTS | Bong bóng partner trên prod; test tái hiện | ✅ đã vá (#404) |
| F-05 | **focus-visible chỉ 2/27 primitive** | Đo trong Phase 2 §2.3 | ⛔ **CHƯA vá — P0-F của Phase 5** |
| F-06 | **Control mobile 40px < 44px** (GaBtn, pager DataTable) | Đo trong Phase 2 §10.1 | ⛔ **CHƯA vá — P0-F (D8)** |
| F-07 | **UI tiếng Việt trong `.ga-scope` render mixed-glyph** (Instrument Sans thiếu subset vietnamese) | Đo trong Phase 2 §2.1 | ⛔ **CHƯA vá — P0-F (D1)** |
| F-08 | DataTable loading/error thiếu `role="status"`/`role="alert"` | Đo trong Phase 2 §2.3 | ⛔ **CHƯA vá — P0-F** |

F-05 → F-08 là bốn hạng mục **P0-F duy nhất** được thừa nhận ở thời điểm này. Bất kỳ P0-F mới nào phải kèm bằng chứng trước khi được thêm vào danh sách.

### 1.4 Guardrail dữ liệu (bắt buộc, kế thừa IA §7.3)

Mỗi con số hiển thị phải khai **nguồn** và **fallback**. Cấm tạo chỉ số tổng hợp mới (kiểu `B1 · 63%`) bằng cách cộng XP + lesson + attendance nếu backend chưa có canonical calculation. Khi không có nguồn: hiển thị trạng thái "chưa đủ dữ liệu", không hiển thị 0% hay số bịa.

Nguồn dữ liệu đã xác minh trong code hiện tại:

| Dữ liệu | Nguồn thật | Ghi chú |
|---|---|---|
| Today plan, due repair tasks, recommended speaking | `todayApi.getMe()` → `/today/me` | Đã dùng ở dashboard + speaking landing |
| Phase/giai đoạn | `phaseApi.getCurrent()` | |
| XP | `xpApi.getMyXp()` | Reward — luôn xếp sau learning progress |
| Class progress | `studentClassesApi` (`fetchMyClasses`, `fetchClassLessons`) | **Hiện là toàn bộ nội dung `/v2/student/progress`** |
| Weekly speaking | `weeklySpeakingApi` | |
| Exam speaking | `/api/speaking/exam/**` | Blueprint, session, result, weakness |

Chỉ số **chưa có nguồn canonical** (phải chờ xác minh ở kick-off Phase 5, không được vẽ trước): overall CEFR %, skill mastery 6 kỹ năng, retention estimate, "next milestone" tự động.

---

## 2. Kế hoạch theo từng màn

### S-01 — Navigation và role shells

**Current problem.** Student sidebar phơi ~30 destination theo module inventory (Học tập 10 · Luyện thi 5 · Lớp học 4 · Cá nhân 8). AI Interview có route `/v2/student/interviews` nhưng **không có entry trong `nav.ts`**. Teacher có >15 item, riêng "Quản lý lớp" 11 item. Utility (hồ sơ, học phí, thông báo, hướng dẫn, chứng chỉ) chiếm chỗ ngang với learning intention. Shell có hai thế hệ: `GaShell`/`GaShellNav`/`GaSidebar`/`GaTopBar` (v2) và `components/layouts/*Shell` legacy (59 import, framer-motion).

**UX reasoning.** Navigation đang buộc learner phải hiểu kiến trúc module trước khi học (UX-02). Mental model thật chỉ có bốn ý định: học · luyện nói · luyện thi · xem tiến bộ, cộng một trạm điều phối hằng ngày. Nav là thứ xuất hiện trên **mọi** màn, nên là điểm đòn bẩy cao nhất: sửa nav một lần thì mọi màn khác được hưởng orientation đúng, và các màn sau có chỗ đứng rõ ràng để deep-link.

**Proposed solution.** Thay cấu hình nav (`components/ui-v2/nav.ts`) bằng đúng 5 top-level theo IA-D1, giữ nguyên URL theo IA-D8. Mọi destination cũ trở thành local nav trong area chủ sở hữu hoặc utility ở topbar/account menu — **không xoá route nào**. Thêm entry Interview trong Sprechen (khắc phục mismatch acquisition). Shell v2 là canonical; legacy shell đóng băng, chỉ gỡ theo Wave 3.

**Information hierarchy.**
```text
Topbar:  [Area title] ................ [Search local nếu có] [Bell] [Inbox] [Avatar/account]
Sidebar (desktop ≥1280):
  Heute        ← default sau đăng nhập
  Lernen       → local: Lernweg · Heute wiederholen · Bibliothek · Meine Klasse · Entdecken
  Sprechen     → local: AI Interview · Speaking Studio · Wochen-Challenge · Verlauf
  Prüfung      → local: Lesen · Hören · Schreiben · Sprechen · Simulation · B1-Bereitschaft · Berichte
  Fortschritt  → local: Überblick · Fähigkeiten · Verlauf · Zertifikate
Account menu: Hồ sơ · Học phí · Hướng dẫn · Đăng xuất
```

**Components affected.** `nav.ts` (nguồn sự thật 4 role) · `GaShellNav` · `GaSidebar` (shadow → `--ga-shadow-drawer`, inset bar → `--ga-selected-bar`, thêm focus-visible) · `GaTopBar` (hex inline → token) · `NotificationBell` (bỏ cross-import legacy popover, `shadow-sm` → token) · `LanguageToggle` (`rounded-[6px]` → `--ga-radius-touch`) · MỚI: `GaLocalNav` (thanh điều hướng cấp 2 dùng chung cho 5 area).

**States.** default · hover · **focus-visible (ring 2px `--ga-accent`, offset 2px)** · selected (inset bar 3px + weight, **không chỉ màu**) · disabled (feature-flag off) · loading (skeleton giữ đúng chiều cao, không nhảy layout) · badge (chỉ cho task time-sensitive: bài chấm, tin nhắn chưa đọc; **cấm badge XP**) · collapsed (≤1280) · drawer (<768).

**Responsive.**
- **1440:** sidebar mở, label đầy đủ + local nav cột trái của area.
- **1280:** sidebar thu icon+label rút gọn; local nav chuyển thành tab ngang dưới page header.
- **768:** sidebar thành drawer; local nav = tab ngang cuộn ngang trong container riêng.
- **390:** bottom nav 5 item (S-13); drawer chỉ chứa utility, **không** chứa lại 30 destination.

**Accessibility.** `<nav aria-label>` phân biệt global/local · `aria-current="page"` cho item active · focus order: skip-link → topbar → nav → main · target ≥44px mobile (D8) · trạng thái selected có indicator + weight, không chỉ màu · label tiếng Đức có `aria-description`/helper tiếng Việt cho A1–A2 (không tooltip-only) · drawer là focus trap có `Esc` và trả focus về nút mở.

**Performance.** `nav.ts` là dữ liệu tĩnh → giữ ở server component nếu có thể; chỉ phần bell/inbox là island client. Cắt legacy shell khỏi bundle của route `/v2` (framer-motion trong legacy shell là chi phí thuần). Đo delta bundle của layout `/v2/student` trước/sau.

**Priority.** **P0-S** (UX-02, cùng nhóm với UI-01/UI-02 vì shell là nơi token được áp trước tiên).

**Dependencies.** Cần trước: token layer (§4 Wave 0). Chặn: mọi màn còn lại (mọi màn đều render trong shell).

**Risk.** *Learner không tìm được destination cũ* → giữ nguyên URL + thêm redirect nội bộ nếu cần, kèm bảng "cũ → mới" trong help. *Label Đức lạ với A1* → nav education một lần khi first-use. *Analytics gãy* → map event cũ→mới trước khi release (IA §15).

**Acceptance criteria.**
1. Persistent student nav có **đúng 5** item; teacher **đúng 5** nhóm.
2. **Mọi** destination hiện có vẫn reachable ≤2 cấp từ nav (test route reachability toàn bộ, 0 orphan ngoài danh sách deprecate có chủ đích).
3. Có entry Interview thấy được từ Sprechen **và** Heute.
4. focus-visible hiển thị trên 100% item nav bằng bàn phím; `aria-current` đúng.
5. Không component nav nào còn hex literal/`rounded-[Npx]`/`shadow-sm` Tailwind.
6. Bundle layout `/v2/student` không tăng; nếu tăng phải giải trình.

---

### S-02 — Heute (Student Dashboard)

**Current problem.** `app/v2/student/dashboard/page.tsx` render theo thứ tự: `TkStatStrip` (4 chỉ số) → CTA phiên đầu (điều kiện) → 3 `GaCard` hành động ngang hàng (Speaking · Từ vựng · SRS) → card phase → card XP. Không có object "Weiterlernen" chiếm ưu thế. Streak xuất hiện hai lần (badge header + stat strip). "Accuracy"/"mastered" không kèm khung thời gian. XP chiếm diện tích ngang phase progress.

**UX reasoning.** Đây là màn tần suất cao nhất và đang trả lời sai câu hỏi: người học mở app để **học tiếp**, không để đọc thống kê rồi tự chọn engine. Stat trước action làm tăng decision load và đẩy gamification lên trước learning value (UI-04/UX-01). Một CTA thắng tuyệt đối sẽ giảm thời gian tới hành động học đầu tiên.

**Proposed solution.** Đảo hierarchy: greeting + level context → **ContinueLearning (một CTA filled duy nhất trong viewport đầu)** → Heute tasks (từ `todayApi`) → habit strip (weekly goal · streak · XP, gộp một hàng, kích thước nhỏ) → Journey preview → 1 gợi ý phụ. Stat strip 4 ô bị **giải thể**: chỉ số nào có nguồn và có nghĩa thì về Fortschritt (S-10), chỉ số nào phục vụ hành động hôm nay thì nhập vào Heute tasks.

**Information hierarchy.**
```text
Guten Abend, {Name}          ← greeting + level chip (nguồn: user store)
Weiterlernen                 ← EYEBROW
Kapitel 08 · Arbeit & Beruf  ← H2 (nguồn: todayApi.recommended / phaseApi)
[▇▇▇▇▇▁▁] 72%                ← GaProgress + nhãn số (không chỉ màu)
[ Weiterlernen → ]           ← CTA filled DUY NHẤT

Heute                        ← 1–4 task: SRS đến hạn · speaking · bài lớp · sửa lỗi
Wochenziel · Streak · XP     ← một hàng compact, XP nhỏ nhất
Lernweg                      ← preview cây: node hiện tại + 2 node kế
Vorschlag                    ← đúng 1 gợi ý phụ, dạng link không phải card
```

**Components affected.** `app/v2/student/dashboard/page.tsx` · `components/features/dashboard/DashboardContainer.tsx`, `TodayPlanBoard.tsx` · MỚI `ContinueLearning` (§8.3 DS) · MỚI `GaProgress` · `WeeklyGoal`/`Streak`/`XP` (learning components) · `TkStatStrip` **bị gỡ khỏi màn này** (giữ cho Fortschritt/teacher) · `GaCard` (bỏ 3 card ngang hàng).

**States.**

| State | Hành vi |
|---|---|
| New user (chưa có phiên nào) | ContinueLearning → CTA "Bắt đầu bài đầu tiên"/placement; Heute tasks ẩn; Journey preview chỉ hiện node đầu |
| Returning | Continue = hoạt động dở gần nhất; task đến hạn xếp sau |
| Loading | Skeleton **giữ đúng kích thước** ContinueLearning + 3 dòng task (`ga-shimmer`, `role="status"`) |
| Partial | `Promise.allSettled` đã dùng — mỗi khối tự hỏng riêng: today lỗi → chỉ khối Heute hiện retry, ContinueLearning vẫn sống |
| Error toàn phần | `ErrorBanner` + retry, giữ greeting; **không** trắng màn |
| Offline | Banner "đang ngoại tuyến"; CTA chuyển sang nội dung đã cache nếu có, nếu không thì disable kèm lý do |
| Completed (hết task hôm nay) | Trạng thái "Fertig für heute" + 1 gợi ý luyện thêm; **không** confetti |
| Advanced | Label Đức-first, thêm shortcut tới branch đang theo |

**Responsive.**
- **1440:** 2 cột — trái (Continue + Heute) 8/12, phải (habit + Journey preview) 4/12.
- **1280:** giữ 2 cột, gutter 48 → nội dung co; habit strip xuống 1 hàng ngang.
- **768:** 1 cột; Journey preview rút còn dải ngang cuộn được.
- **390:** thứ tự **đổi có chủ đích** theo handoff §11.14 — Continue → Heute tasks → Speaking → Wortschatz → Journey → habit/tools; habit strip xuống **cuối**; tối đa 1 CTA filled trong viewport đầu.

**Accessibility.** H1 là greeting/tên màn; ContinueLearning là `<section aria-labelledby>` · CTA có nhãn nêu rõ đích ("Weiterlernen — Kapitel 8") không chỉ "Tiếp tục" · progress có `role="progressbar"` + `aria-valuenow` + nhãn text · skeleton `role="status" aria-live="polite"` · task list là `<ul>` semantic · greeting đổi theo giờ phải có text ổn định cho screen reader.

**Performance.** 3 request song song đã đúng (`allSettled`); thêm streaming/suspense theo khối để ContinueLearning render trước. Journey preview **không** tải cả canvas cây — dùng dữ liệu rút gọn hoặc dynamic import khi vào viewport. Mục tiêu: LCP là khối ContinueLearning, không phải stat strip.

**Priority.** **P0-S** (UX-01/UI-04).

**Dependencies.** S-01 (shell/nav), `GaProgress`, `ContinueLearning`, token layer. Chia sẻ dữ liệu với S-05 (`todayApi.recommendedSpeaking`) và S-03 (Journey preview).

**Risk.** *Continue chọn sai hoạt động* → quy tắc chọn phải khai rõ và có fallback (dở dang > đến hạn > node kế); nếu không xác định được thì hiện lựa chọn ngắn thay vì đoán bừa. *Gỡ stat strip bị hiểu là mất dữ liệu* → nêu rõ "xem đầy đủ ở Fortschritt". *Task quá nhiều* → trần 4 task, phần dư đẩy sang area chủ sở hữu.

**Acceptance criteria.**
1. First-click test: **≥80%** người dùng bấm ContinueLearning khi được hỏi "học tiếp".
2. Trong viewport đầu ở cả 4 breakpoint: **đúng 1** CTA filled.
3. Blur/grayscale test: CTA chính vẫn nổi bật nhất.
4. Không có stat nào đứng trên ContinueLearning ở bất kỳ breakpoint nào.
5. Mọi số hiển thị đều truy được nguồn theo §1.4; không có chỉ số tổng hợp mới.
6. Một khối lỗi không làm hỏng các khối còn lại (test bằng cách ép 1 API fail).

---

### S-03 — Lernen / Learning Journey

**Current problem.** `/v2/student/roadmap` (`RoadmapTreePage.tsx`, 315 dòng page) hiện có ba tab **Tree / Nodes / Phase** = ba mental model ngang hàng. Mỗi node trong list mang badge + CEFR + XP + progress + mô tả + **hai CTA** (Học / Luyện) → mật độ cao và learner không phân biệt được hai hành động. Locked chỉ hiện ổ khoá, không nói điều kiện mở. Mastery chưa phải state độc lập. Cây có nhiều animation (breath/bob/sway/level-up) dễ trở thành trang trí.

**UX reasoning.** Journey phải là **spine**, không phải một feature cạnh Vocabulary/Grammar (UX-03, IA-D2). Ba tab ngang hàng buộc learner chọn cách nhìn trước khi học — đó là decision load vô nghĩa. Một node = một vị trí trong hành trình, nên nó chỉ được có **một** hành động chính; biến thể (luyện lại, ôn từ, thi thử) là hành động phụ trong node detail.

**Proposed solution.** `Lernweg` là view mặc định và duy nhất ở cấp landing; **Nodes** trở thành fallback danh sách có thể truy cập (đồng thời là bản accessible của cây, phục vụ screen reader), **Phase** bị hấp thụ vào header ngữ cảnh (bạn đang ở giai đoạn nào) chứ không còn là tab. Node giảm còn: tên · trạng thái · 1 CTA chính + `⋯` mở node detail. Locked hiển thị **điều kiện mở** dạng câu ("Hoàn thành Kapitel 7 để mở"). Bibliothek/Entdecken nằm dưới local nav, không có prominence ngang Journey.

**Information hierarchy.**
```text
[Header] Lernweg · A2 → B1 · Kapitel 08          ← ngữ cảnh phase (thay tab Phase)
[Canvas cây]  node hiện tại nổi bật nhất
              nhánh: Alltag · Beruf · Goethe
[Node detail panel khi chọn]
   Tên node · trạng thái · mục tiêu học
   [ Bắt đầu/Tiếp tục → ]                        ← 1 CTA chính
   Phụ: Luyện lại · Từ vựng của bài · Thi thử phần này
[Local nav] Lernweg | Heute wiederholen | Bibliothek | Meine Klasse | Entdecken
```

**Components affected.** `app/v2/student/roadmap/page.tsx` · `components/features/roadmap/RoadmapTreePage.tsx` · `LearningNode`/`lt-node` (giữ focus ring 6px đã có) · MỚI `NodeDetailPanel` · `GaLocalNav` · `GaProgress` · `TkTabs` (gỡ khỏi vai trò chọn mental model; chỉ còn dùng nếu cần trong node detail).

**States.** locked (dashed border + nhãn "Gesperrt/Khoá" + câu điều kiện) · available · **current (nổi bật nhất, chỉ 1)** · completed (`--ga-green-soft` + icon check) · mastery (state độc lập, dấu hiệu riêng không phải chỉ màu) · loading (skeleton cây giữ khung, không nhảy) · error (fallback **danh sách node accessible**, không phải trắng màn) · empty (chưa có lộ trình → CTA placement) · partial (nhánh chưa có dữ liệu → nhánh xám kèm nhãn, không ẩn im lặng).

**Responsive.**
- **1440:** cây + node detail dạng side panel cố định bên phải.
- **1280:** cây thu nhỏ, node detail vẫn side panel (hẹp hơn).
- **768:** cây cuộn ngang trong container riêng; node detail thành sheet trượt từ dưới.
- **390:** **mặc định là danh sách theo chặng** (list-first), cây đầy đủ là chế độ xem tuỳ chọn — cây SVG lớn trên màn 390 không đọc được và tốn CPU; danh sách giữ đúng thứ tự hành trình. **Điều kiện P4-D4 (approved):** phía trên danh sách phải có **compact journey/branch overview** (dải minh họa vị trí hiện tại + các nhánh Alltag·Beruf·Goethe) để giữ visual signature — mobile **không được** thành danh sách generic.

**Accessibility.** Cây phải có bản danh sách tương đương (không phải "fallback khi lỗi" mà là chế độ xem bình đẳng) · điều hướng bàn phím giữa node (đã có `lt-node:focus-visible`) · trạng thái node có icon/nhãn ngoài màu · `prefers-reduced-motion` tắt breath/bob/sway (giữ chuẩn hiện có) · node là `<button>`/`<a>` thật, không phải `<g>` gắn onClick.

**Performance.** Canvas cây là thành phần nặng nhất khu học → dynamic import, không nằm trong bundle của Heute. Ở 390 mặc định list nên không tải canvas. Animation chỉ chạy khi node đổi state thật, không loop vô hạn ngoài viewport.

**Priority.** **P0-S** (UX-03).

**Dependencies.** S-01 (local nav), `GaProgress`, token/motion layer. Cung cấp dữ liệu preview cho S-02; deep-link tới S-04, S-08, S-09.

**Risk.** *Bỏ tab Nodes/Phase bị coi là mất tính năng* → giữ chúng dưới dạng chế độ xem/ngữ cảnh, không xoá URL. *Cây đẹp nhưng khó dùng* → tiêu chí nghiệm thu là task success "tìm node kế tiếp", không phải cảm nhận thẩm mỹ. *Regression đang có việc dở* — nhánh `feat/roadmap-tree-v2` và Lernbaum L3 đang mở → phải hợp nhất trước khi chạm cùng file.

**Acceptance criteria.**
1. Landing chỉ có **một** mental model mặc định (Lernweg); không còn ba tab ngang hàng.
2. Mỗi node hiển thị **tối đa 1 badge + 1 CTA chính**.
3. 100% node locked nêu được điều kiện mở bằng câu, không chỉ icon.
4. Task "tìm và mở node kế tiếp" thành công ≥90% trong test có người dùng.
5. Bàn phím đi hết được lộ trình; screen reader đọc được trạng thái từng node.
6. Ở 390 mặc định là list; canvas không được tải khi không dùng.

---

### S-04 — Lesson shell (Lesson / Practice)

**Current problem.** `/v2/student/learn/[nodeId]` và `/v2/student/practice/[nodeId]` là hai route/CTA cạnh nhau ở cấp node, learner không rõ khác biệt. Các skill view (reading/listening/writing/speaking/grammar) có màu/radius/focus hardcode riêng. Không có shell dùng chung khai báo: mục tiêu bài, tiến độ, thời lượng ước tính, hành vi thoát/lưu. Loading/error giữa các skill view không đồng nhất. Từ ghép Đức dài xử lý cục bộ bằng `break-words`.

**UX reasoning.** Bài học là nơi learner ở lại lâu nhất; nếu mỗi kỹ năng là một tiểu vũ trụ thì họ phải học lại cách dùng giao diện ở mỗi node. Một shell chung giữ orientation ("tôi đang ở đâu trong bài, còn bao lâu, thoát thì có mất bài không") và cho phép mọi skill view chỉ tập trung vào nội dung.

**Proposed solution.** Định nghĩa **Lesson Shell** dùng chung cho cả learn và practice: header ngữ cảnh (chương/node · mục tiêu · tiến độ · thời lượng) → khu nội dung skill → khu phản hồi → recap + hành động kế tiếp. "Học" và "Luyện" trở thành **hai chế độ của cùng một shell** (segmented ở header) thay vì hai đích rời rạc — URL giữ nguyên theo IA-D8.

**Information hierarchy.**
```text
[← Thoát]  Kapitel 08 · Lektion 3        [Học | Luyện]      ~12 phút
Mục tiêu: Nói về công việc hằng ngày
[▇▇▇▁▁] Bước 3/7
────────────────────────────────
[ Nội dung skill: Lesen | Hören | Schreiben | Sprechen | Grammatik ]
────────────────────────────────
[ Phản hồi: summary trước, chi tiết theo yêu cầu ]
[ Recap · Hành động kế tiếp → ]
```

**Components affected.** MỚI `LessonShell` (layout + header + exit/save) · các skill view hiện có (chuẩn hoá token, bỏ hardcode) · `GaProgress` · `LessonCard` · `GaBtn` · `TkSeg` (chế độ Học/Luyện) · `EmptyState`/`ErrorBanner`/`LoadingState`.

**States.** default · loading (skeleton **shell giữ nguyên**, chỉ vùng nội dung shimmer) · empty/locked (node chưa mở → nêu điều kiện, CTA về Journey) · error (giữ tiến độ, retry tại chỗ, **không** mất câu trả lời đã nhập) · partial (một phần media hỏng → skill view khác vẫn dùng được) · offline (chặn nộp, giữ nháp cục bộ, nêu rõ trạng thái) · completed (recap + next) · exit-confirm (khi có tiến độ chưa lưu).

**Responsive.**
- **1440/1280:** header dính trên, nội dung tối đa ~72ch, phản hồi ở cột phụ khi đủ chỗ.
- **768:** một cột, header dính, phản hồi nằm dưới nội dung.
- **390:** header rút gọn còn chương + tiến độ + thoát; hành động chính dính đáy (an toàn vùng bàn phím ảo); từ ghép Đức bật hyphenation theo `--ga-text-vocab`/`lang="de"`.

**Accessibility.** Thứ tự heading ổn định ở mọi skill view · nút thoát luôn tới được bằng bàn phím · thay đổi bước thông báo qua `aria-live` · audio có transcript/điều khiển bàn phím · input có `aria-invalid` + lỗi liên kết `aria-describedby` · không khoá zoom.

**Performance.** Shell là server component nếu có thể, skill view nạp động theo loại · media tải theo bước, không preload cả bài · giữ kích thước skeleton để tránh CLS.

**Priority.** **P1** (sau P0-S và P1-high Speaking).

**Dependencies.** S-03 (điểm vào), token layer, `GaProgress`, `GaInput`/`GaTextarea` mới (D6/DS §8.2).

**Risk.** *Gộp Học/Luyện làm mất thói quen cũ* → giữ URL, segmented ghi rõ nghĩa từng chế độ. *Chuẩn hoá skill view chạm nhiều file legacy* → làm theo lô từng skill, mỗi lô có visual regression riêng. *Mất bài khi thoát* → autosave nháp trước khi đổi bất kỳ hành vi điều hướng nào.

**Acceptance criteria.**
1. Cả 5 skill view chạy trong **một** shell duy nhất, cùng header/tiến độ/thoát.
2. Thoát giữa chừng: 0 trường hợp mất dữ liệu đã nhập (test có kịch bản).
3. Không skill view nào còn hex literal/radius ngoài token.
4. Loading/error/empty của mọi skill view dùng chung primitive.
5. Từ ghép Đức dài nhất trong nội dung thật không phá layout ở 390.

---

### S-05 — Sprechen landing

**Current problem.** `/v2/student/speaking/page.tsx` (177 dòng) đã có link tới `/v2/student/interviews`, history và mode card, nhưng thứ tự các mode là cố định và Interview — feature bán hàng chính ở homepage — không có prominence tương xứng (UX-04). Ngoài ra `/v2/student/speaking/exam` (Prüfungsraum Sprechen) đang sống **dưới route Sprechen** trong khi IA quy định Goethe Speaking thuộc **Prüfung**.

**UX reasoning.** Learner đến khu này với một trong hai ý định: luyện giao tiếp chung, hoặc luyện phỏng vấn nghề nghiệp. Một lưới mode ngang hàng bắt họ tự phân loại; landing nên **đọc mục tiêu của họ** rồi xếp thứ tự tương ứng (IA §6.2). Việc phòng thi Sprechen nằm dưới `/speaking` là chi tiết kỹ thuật, không phải ý định — nên nó phải được **trình bày** trong Prüfung, còn URL giữ nguyên theo IA-D8.

**Proposed solution.** Landing goal-aware: nếu hồ sơ/mục tiêu là nghề nghiệp → AI Interview là khối chính; nếu là giao tiếp chung → Speaking Studio là khối chính; khối còn lại vẫn hiện nhưng cỡ nhỏ hơn. Wochen-Challenge và Verlauf là hàng phụ. Thêm cross-link **có nhãn mode rõ ràng** "Goethe Sprechen → Prüfung" (IA §13.1), không nhân bản màn.

**Information hierarchy.**
```text
Sprechen
[ KHỐI CHÍNH theo mục tiêu ]        ← Interview hoặc Studio, 1 CTA filled
[ Khối phụ ]                        ← mode còn lại, cỡ nhỏ hơn rõ rệt
Wochen-Challenge · Verlauf          ← hàng phụ
Goethe Sprechen (→ Prüfung)         ← cross-link, không phải card ngang hàng
```

**Components affected.** `app/v2/student/speaking/page.tsx` · `GaCard` (giảm số card ngang hàng) · MỚI `ModeHero` (khối chính) · `todayApi.recommendedSpeaking` (đã dùng) · `weeklySpeakingApi` · `GaLocalNav`.

**States.** default (theo goal) · goal chưa xác định (hiện cả hai ngang nhau + câu hỏi 1 lần "bạn muốn luyện gì?") · loading (skeleton khối chính) · error (một nguồn hỏng → khối đó retry riêng) · empty (chưa có phiên nào → mô tả rõ hai mode khác nhau thế nào **trước khi** vào) · quota hết (hiện điều kiện + đường nâng cấp, không chặn im lặng) · offline (chặn vào phiên, nêu lý do).

**Responsive.** **1440/1280:** khối chính chiếm ~2/3, khối phụ 1/3. **768:** khối chính full, khối phụ dạng dải. **390:** khối chính → khối phụ → challenge → verlauf; cross-link Prüfung ở cuối; mỗi khối ≤1 CTA.

**Accessibility.** Hai mode phải phân biệt được bằng **văn bản** (không chỉ icon/màu) trước khi bấm · CTA nêu đích cụ thể · quota/permission thông báo bằng text có `role="status"`.

**Performance.** Landing chủ yếu tĩnh + 2 request; không preload SDK ghi âm ở landing (chỉ tải khi vào phiên).

**Priority.** **P0-S** cho phần *prominence của Interview* (UX-04); phần sắp xếp goal-aware còn lại **P1**.

**Dependencies.** S-01, S-06 (flow Interview), S-07 (Studio), quota/entitlement hiện có.

**Risk.** *Đoán sai mục tiêu người dùng* → luôn cho phép đổi, không khoá; khối phụ vẫn nhìn thấy được. *Cross-link Goethe gây nhầm hai home* → nhãn mode rõ + không nhân bản state.

**Acceptance criteria.**
1. Người dùng phân biệt được Studio và Interview **trước khi** bắt đầu (test mô tả, ≥80%).
2. Interview tới được từ Sprechen **và** Heute; nguồn vào đo được bằng analytics.
3. Đúng 1 CTA filled trong viewport đầu ở cả 4 breakpoint.
4. Goethe Speaking chỉ có **một** home (Prüfung); Sprechen chỉ cross-link.

---

### S-06 — AI Interview

**Current problem.** `/v2/student/interviews/page.tsx` (399 dòng) tồn tại nhưng không có entry nav (S-01) và cần xác minh đủ 6 chặng theo brief: Setup → Room → Question → Answer → Evaluation → Improved Answer → Report. Rủi ro đã nêu ở audit: feedback thiên về điểm số dễ khiến người học "săn điểm" thay vì cải thiện câu trả lời.

**UX reasoning.** Đây là lời hứa acquisition của homepage; khoảng cách giữa lời hứa và sản phẩm sau đăng nhập làm giảm activation (UX-04). Interview phải cho cảm giác **mô phỏng phỏng vấn thật**: có nhà tuyển dụng, có công ty/ngành, có vị trí, có tiến độ câu hỏi — chứ không phải bài kiểm tra chấm điểm.

**Proposed solution.** Chuẩn hoá 6 chặng thành flow có shell riêng (Interview Room ẩn nav như exam-lite), báo cáo đặt **câu trả lời cải thiện** ngang hàng với điểm, và kết thúc bằng **hành động luyện tiếp** (link về Studio/Journey) thay vì chỉ số điểm.

**Information hierarchy.**
```text
Setup:  ngành · vị trí · CEFR · thời lượng            → [ Bắt đầu ]
Room:   [Nhà tuyển dụng · Công ty · Vị trí · CEFR]
        Câu hỏi 3/8   ● đang ghi âm   00:42
        [ Ghi âm / Dừng ]                              ← 1 hành động chính
Report: Tổng quan ngắn → 4 chiều đánh giá → câu trả lời cải thiện
        → hành động luyện tiếp (không phải điểm số)
```

**Components affected.** `app/v2/student/interviews/*` · MỚI `InterviewShell` (ẩn nav, exit có xác nhận) · `InterviewQuestion` · `SpeakingFeedback` (dùng chung với S-07, khác trình bày) · `ExamTimer`-family cho đồng hồ · audio primitives dùng chung với Studio.

**States.** setup chưa đủ (CTA disabled + nêu thiếu gì) · connecting · idle/recording/processing/answered · **permission denied** (dùng `MicDeniedGuide` đã có) · quota hết · network drop giữa phiên (**resume**, không mất câu đã trả lời) · completed → report · error báo cáo (giữ dữ liệu phiên, cho thử lại) · offline.

**Responsive.** **1440/1280:** hai cột (ngữ cảnh trái · câu hỏi/ghi âm phải). **768:** một cột, ngữ cảnh thu thành dải trên. **390:** ngữ cảnh gập lại, nút ghi âm dính đáy ≥44px (D8), **ẩn bottom nav** trong Room (IA §10.1) với exit rõ ràng.

**Accessibility.** Trạng thái ghi âm/đồng hồ qua `aria-live` (không chỉ animation) · reduced-motion thay hiệu ứng "breathe" bằng nhãn chữ · transcript đọc được · nút thoát luôn tới được bằng bàn phím · nhãn nhà tuyển dụng/công ty là text thật.

**Performance.** Tải audio SDK chỉ khi vào Room · streaming feedback không chặn render · report tách route/lazy để Room nhẹ.

**Priority.** **P0-S** cho prominence + tính toàn vẹn flow; các blocker chức năng bên trong (mic, mất dữ liệu) là **P0-F khi verify**.

**Dependencies.** S-01, S-05, audio primitives chung với S-07, `MicDeniedGuide` (đã có).

**Risk.** *Trùng lặp với Speaking Studio* → tách bằng ngữ cảnh và trình bày, dùng chung primitive nhưng khác shell. *Mất câu trả lời khi rớt mạng* → resume + autosave là điều kiện bắt buộc trước khi mở rộng. *Gamify quá tay* → cấm confetti/điểm nhảy múa trong Room.

**Acceptance criteria.**
1. Đủ 6 chặng, mỗi chặng có state loading/error/empty riêng.
2. Rớt mạng giữa phiên: 0 mất câu trả lời đã hoàn tất; có đường resume.
3. Report luôn có **câu trả lời cải thiện** + 1 hành động luyện tiếp.
4. Trong Room: không XP, không streak, không nav toàn cục, exit có xác nhận.
5. Người dùng phân biệt Interview với Studio ngay ở màn Setup.

---

### S-07 — Speaking Studio

**Current problem.** `components/features/ai-speaking/` có 21 component với `ChatMessageBubble`, `SpeakingChatExperience`, `SpeakingChatHeader`, `SpeakingChatSidebar`, `SpeakingInputDock` — kiến trúc đặt **tin nhắn chat** ở trung tâm (UX-05). Song song còn họ component `components/speaking/*` legacy (persona theme, mesh background, character float). Ambient orbs/mesh/pulse cạnh tranh với mục tiêu nói. Feedback 4 chiều đã có nhưng chưa progressive disclosure nhất quán.

**UX reasoning.** Mục tiêu là **luyện nói trong tình huống**, không phải chat với AI có micro. Khi bong bóng chat là trung tâm, hành vi mặc định của người dùng là **gõ**, không phải nói — đúng thứ sản phẩm không muốn. Studio phải đặt scenario/goal/micro/waveform/phản hồi phát âm lên trước; transcript là bằng chứng, không phải sân khấu.

**Proposed solution.** Chuyển sang **Studio shell**: dải ngữ cảnh (persona · scenario · CEFR · mục tiêu hội thoại · đồng hồ) → khu ghi âm (nút lớn + waveform + trạng thái) → transcript dạng biên bản gọn → feedback summary-first (chi tiết theo yêu cầu). Hợp nhất hai họ component (legacy `speaking/*` và `features/ai-speaking/*`) về một họ; gỡ ambient decoration khỏi phiên đang chạy.

**Information hierarchy.**
```text
[Persona · Szenario · B1 · Ziel: đặt lịch hẹn]      ← ngữ cảnh, luôn thấy
        ◎  Bấm để nói            00:42               ← hành động chính, lớn nhất
        ▁▃▅▇▅▃▁ waveform
[Biên bản hội thoại]                                ← gọn, phân vai rõ
[Phản hồi] Aussprache · Grammatik · Wortschatz · Natürlichkeit
           tóm tắt trước → "xem bằng chứng" mở chi tiết
```

**Components affected.** Toàn bộ `features/ai-speaking/*` (đổi vai trò, không xoá dữ liệu) · `components/speaking/*` legacy (hợp nhất) · `SpeakingFeedback` (dùng chung S-06) · `MicBar`/`MicCheck`/`MicDeniedGuide` (đã có, tái dùng) · `SpeakingQuotaPill`/`QuotaBlockedBanner` (giữ) · `SpeakingMeshBackground`/`SpeakingCharacterFloat` (**gỡ khỏi phiên**, cân nhắc giữ ở welcome).

**States.** chưa cấp mic (guide 3 bước — đã có) · idle · recording (breathe motion, reduced-motion → nhãn chữ) · processing · streaming feedback · answered · quota hết · network drop (giữ phiên, cho tiếp tục) · offline · session summary · error phiên (không mất transcript đã có).

**Responsive.** **1440/1280:** ngữ cảnh trái, ghi âm + transcript giữa, feedback phải (3 vùng, không phải sidebar chat). **768:** ngữ cảnh gập, ghi âm giữa, feedback dưới. **390:** nút ghi âm dính đáy ≥44px, transcript cuộn, feedback trong sheet; **ẩn bottom nav** khi phiên đang chạy (IA §10.1).

**Accessibility.** Trạng thái ghi âm qua `aria-live` · waveform là trang trí (`aria-hidden`) nhưng có nhãn trạng thái text · điều khiển ghi âm dùng được bằng bàn phím · transcript có ngữ nghĩa vai nói · phản hồi phát âm không truyền chỉ bằng màu (3 mức có nhãn).

**Performance.** Gỡ mesh/orb/framer-motion khỏi phiên → giảm CPU khi ghi âm (chất lượng audio phụ thuộc CPU) · dynamic import panel phoneme · không giữ nhiều `<audio>` sống cùng lúc (đã có bài học TTS treo — S-14).

**Priority.** **P1-high** — tranche đầu tiên ngay sau nhóm P0. Không nâng lên P0. Blocker chức năng bên trong (mic/ghi âm/mất dữ liệu/accessibility) là **P0-F khi verify** và đi luồng hotfix riêng (đã có tiền lệ F-01…F-04).

**Dependencies.** S-01, S-05; dùng chung audio primitives với S-06; cần token/motion layer để gỡ persona tint hardcode.

**Risk.** *Hợp nhất hai họ component chạm nhiều file đang sống* → làm theo lô, giữ hành vi API, visual regression từng lô. *Gỡ ambient bị coi là "xấu đi"* → đo bằng task success + CPU, không bằng cảm nhận. *Người dùng quen gõ* → giữ đường text ở drill nhưng không đặt ở vị trí trung tâm.

**Acceptance criteria.**
1. Trong phiên, **nút nói là phần tử lớn nhất**; ô nhập text không phải trung tâm.
2. Screenshot phiên Studio và phiên Interview phân biệt được ngay (mode identity — DoD handoff).
3. Feedback mặc định là tóm tắt; chi tiết chỉ mở khi yêu cầu.
4. Không còn ambient animation chạy trong lúc ghi âm; reduced-motion có nhãn thay thế.
5. Chỉ còn **một** họ component speaking; không import chéo legacy từ màn.

---

### S-08 — Vocabulary / SRS

**Current problem.** Bề mặt bị chia nhỏ: `/vocabulary`, `/review`, `/errors`, practice, swipe, article quiz, analytics — mỗi thứ một điểm vào (UX-06). Ý định hằng ngày ("hôm nay ôn gì") bị chìm dưới thư viện và công cụ. Có nhiều bản dựng thẻ từ vựng khác nhau giữa legacy và v2 (`components/features/vocabulary/VocabCard.tsx` + các bản legacy). Nút Again/Hard/Good/Easy cần target size, phím tắt và giải thích cho người mới.

**UX reasoning.** SRS là **thói quen**, và thói quen cần một cửa vào duy nhất, không phải một menu. Khi mở app, learner cần thấy ngay "18 thẻ đến hạn → Ôn" chứ không phải chọn giữa sáu công cụ từ vựng.

**Proposed solution.** Một **pre-session** duy nhất là cửa vào chính thức (đặt trong Lernen → *Heute wiederholen*, đồng thời là task trong Heute): số thẻ đến hạn, tách mới/ôn lại, một CTA. Thư viện và analytics là công cụ phụ trong Bibliothek. Session dùng một `VocabularyCard` duy nhất theo DS §8.3. Post-session: kết quả gọn, **XP là phụ**, nêu lần ôn kế tiếp.

**Information hierarchy.**
```text
Pre-session          Heute · 18 Karten fällig · Neu 5 · Wiederholen 13 · [ Wiederholen → ]
Session              Từ (--ga-text-vocab) · IPA · ví dụ · ngữ cảnh · audio
                     [ Again ] [ Hard ] [ Good ] [ Easy ]    ← ≥44px, phím 1–4
Post-session         Đã ôn 18 · giữ lại ~x% · lần kế: 2 ngày nữa · XP nhỏ
```

**Components affected.** `components/features/vocabulary/VocabCard.tsx` (thành canonical) · các bản thẻ legacy (hợp nhất) · `/v2/student/review`, `/vocabulary`, `/errors` (regroup, giữ URL) · MỚI `SrsPreSession` · `GaProgress` · gender token §5.6.

**States.** zero due (**không** ép ôn — gợi ý học từ mới hoặc nghỉ) · loading (preload thẻ, skeleton đúng kích thước) · session đang chạy · answer revealed · error giữa phiên (**giữ nguyên hàng đợi**, không mất tiến độ) · offline (cho ôn tiếp bằng thẻ đã tải, đồng bộ sau) · completed · first-time (giải thích Again/Hard/Good/Easy một lần).

**Responsive.** **1440/1280:** thẻ giữa, tối đa ~60ch, 4 nút hàng ngang. **768:** thẻ full-width, nút vẫn hàng ngang. **390:** thẻ chiếm màn, 4 nút hàng ngang ≥44px ở đáy (vùng ngón cái), cấm swipe là **cách duy nhất** để trả lời (phải có nút).

**Accessibility.** Phím 1–4 map 4 mức + hiển thị gợi ý phím · nút có nhãn text (không chỉ icon/màu) · từ vựng `lang="de"`, ví dụ `lang="de"` · audio có nút phát dùng được bằng bàn phím · thay đổi thẻ thông báo qua `aria-live` (không gây spam: chỉ báo tiến độ x/y).

**Performance.** Preload thẻ kế tiếp (1–2 thẻ) chứ không cả hàng đợi · audio nạp theo yêu cầu · gender color qua token, không tính runtime.

**Priority.** **P1**.

**Dependencies.** S-01 (local nav Lernen), S-02 (task Heute), token layer.

**Risk.** *Hợp nhất thẻ chạm dữ liệu SRS thật* → chỉ đổi lớp trình bày, cấm chạm thuật toán FSRS/SM-2. *Zero-due bị hiểu là lỗi* → copy rõ ràng, có hành động thay thế.

**Acceptance criteria.**
1. Từ Heute tới phiên ôn ≤2 thao tác.
2. Chỉ còn **một** implementation thẻ từ vựng trong `/v2`.
3. 4 nút đạt ≥44px ở 390 và có phím tắt hoạt động.
4. Lỗi mạng giữa phiên: hàng đợi và tiến độ được giữ nguyên.
5. XP không bao giờ đứng trên kết quả học trong màn kết quả.

---

### S-09 — Prüfung hub và Exam Shell

**Current problem.** `/v2/student/exam/page.tsx` chỉ 96 dòng — là một destination mờ nhạt chứ chưa phải hub. Ba khái niệm `exam` (chuẩn bị) · `mock-exam` (mô phỏng có giờ) · `assessment` (đánh giá mức sẵn sàng B1) dễ bị hiểu là ba phiên bản của cùng một thứ (IA-04). Chưa có **exam shell** đảm bảo không phân tán: role shell vẫn hiển thị XP/streak/nav trong lúc thi (UX-07). Phòng luyện thi Nói (`/v2/student/speaking/exam`) đã hoàn chỉnh nhưng nằm dưới route Sprechen.

**UX reasoning.** Thi là **chế độ nhận thức khác** với học: người thi cần biết còn bao nhiêu thời gian, đang ở phần nào, bài đã lưu chưa — và không cần biết mình được bao nhiêu XP. Mọi thứ không phục vụ việc làm bài đều là nhiễu và làm tăng lo lắng.

**Proposed solution.** Nâng `/v2/student/exam` thành **hub** với 3 nhóm rõ nghĩa và nhãn theo IA §6.3: *Kỹ năng* (Lesen · Hören · Schreiben · Sprechen) · *Prüfungssimulation* (có giờ) · *B1-Bereitschaft* (đánh giá). Thêm *Prüfungsberichte*. Định nghĩa **Exam Shell** dùng chung cho mọi phiên thi: timer + section + progress + trạng thái autosave + exit có kiểm soát; ẩn XP/streak/nav/animation. Phòng luyện thi Nói được **trình bày** trong hub (Sprechen chỉ cross-link); URL giữ nguyên ở wave 1 (IA-D8).

**Information hierarchy.**
```text
Prüfung
  Bạn đang chuẩn bị: Goethe B1 · kỳ thi mục tiêu {ngày}     ← nếu có dữ liệu, không bịa
  [Kỹ năng]  Lesen · Hören · Schreiben · Sprechen(→phòng thi nói)
  [Prüfungssimulation]  bài thi đầy đủ có giờ   [ Bắt đầu ]
  [B1-Bereitschaft]     đánh giá mức sẵn sàng
  [Prüfungsberichte]    lịch sử + phiếu điểm

Exam Shell (khi đang thi)
  [Teil 2/3]  ⏱ 12:04   ● Đã lưu 10:02        [ Thoát ]
  ────────────────────────────────────────────
  Nội dung câu hỏi / phòng thu
```

**Components affected.** `app/v2/student/exam/page.tsx` (thành hub) · `/mock-exam`, `/mock-exam/run`, `/assessment` (regroup) · MỚI `ExamShell` (layout riêng, không dùng role shell) · `ExamTimer` (đã có ở exam-speaking) · autosave/status indicator · `Ergebnisbogen`/`DrillSummary` (đã có, tái dùng cho báo cáo).

**States.** hub: chưa có gói đề · loading · error · đã có lịch sử. Shell: preload media · đang làm · **autosave OK / đang lưu / lưu lỗi** (3 trạng thái rõ) · hết giờ (tự nộp có thông báo) · rớt mạng (**giữ bài, cho phép resume**) · offline · nộp xong → báo cáo · thoát giữa chừng (xác nhận + nêu hậu quả).

**Responsive.** **1440/1280:** shell tối giản, timer góc trên, nội dung giữa tối đa ~72ch. **768:** timer dính trên, nội dung full. **390:** timer + section thành một dải dính trên; hành động chính dính đáy; **ẩn bottom nav hoàn toàn**; exit là nút rõ ràng, không dựa vào back trình duyệt.

**Accessibility.** Timer là `aria-live="off"` nhưng có mốc thông báo (còn 5 phút / 1 phút) qua `role="status"` — tránh đọc liên tục · trạng thái autosave thông báo bằng text · cảnh báo ≤5 phút dùng `--ga-warning`, **không nhấp nháy** · điều hướng câu hỏi bằng bàn phím · không khoá zoom.

**Performance.** Preload media theo section, không cả bài · Exam Shell là bundle riêng, không kéo theo nav/gamification · cấm animation trang trí (DS §7).

**Priority.** **P0-S** (UX-07 — exam shell contract).

**Dependencies.** S-01 (thoát khỏi role shell), token layer, `ExamTimer` (tái dùng), backend autosave hiện có (**phải xác minh** trước khi hứa "không mất bài").

**Risk.** *Hứa autosave khi backend chưa có* → kiểm chứng năng lực autosave trước; nếu chưa có thì shell phải nói đúng sự thật ("bài chưa được lưu tự động"), tuyệt đối không hiển thị "Đã lưu" giả. *Ẩn nav gây cảm giác mắc kẹt* → exit rõ + đường quay lại. *Ba nhãn mới vẫn khó hiểu* → test hiểu nhãn với người thật (IA §15).

**Acceptance criteria.**
1. Trong Exam Shell: **0** XP, **0** streak, **0** nav toàn cục, **0** animation trang trí (kiểm bằng screenshot + DOM).
2. Ba khái niệm chuẩn bị/mô phỏng/đánh giá phân biệt được ≥80% trong test hiểu nhãn.
3. Rớt mạng giữa bài: bài làm không mất; có đường resume; trạng thái lưu hiển thị đúng sự thật.
4. Hết giờ tự nộp có cảnh báo trước và không mất câu đã trả lời.
5. Goethe Speaking có **một** home là Prüfung; Sprechen chỉ cross-link có nhãn mode.

---

### S-10 — Fortschritt

**Current problem.** `/v2/student/progress/page.tsx` (164 dòng) hiện **chỉ có tiến độ lớp** (`fetchMyClasses`/`fetchClassLessons`) — trong khi `/stats`, `/achievements`, `/exercise-history`, `/certificates` là các route riêng. Không có hierarchy canonical; "B1 · 63%" chưa có công thức chuẩn (UX-08, IA-02).

**UX reasoning.** Người học hỏi bốn câu: tôi đang ở đâu · mạnh/yếu gì · mốc kế tiếp là gì · nên làm gì. Chart không trả lời được các câu đó nếu đứng một mình. Và quan trọng hơn: **thà thiếu số còn hơn số sai** — gộp XP/lesson/attendance thành một điểm tổng là tạo ra chỉ số vô nghĩa.

**Proposed solution.** `/v2/student/progress` thành Fortschritt home theo hierarchy IA §7.1: learning progress → skill mastery → next milestone → habit → reward → evidence. Class progress trở thành **subsection có nhãn nguồn** ("do giáo viên cập nhật"). `/stats`, `/achievements`, `/exercise-history`, `/certificates` trở thành subsection/tab, URL giữ (IA-D8). Chỉ số chưa có nguồn canonical thì **không vẽ**.

**Information hierarchy.**
```text
Fortschritt
  A2 → B1 · {tiến độ lộ trình}      ← nguồn: phaseApi/roadmap, KHÔNG bịa %
  Mốc kế tiếp: {điều kiện} → [ hành động đề xuất ]
  Fähigkeiten     Lesen · Hören · Schreiben · Sprechen · Wortschatz · Grammatik
                  (chỉ hiện kỹ năng CÓ nguồn; kỹ năng thiếu dữ liệu ghi "chưa đủ dữ liệu")
  Gewohnheit      Wochenziel · Streak
  Belohnung       XP · Erfolge                      ← sau cùng
  Nachweise       lịch sử bài · phiếu thi · lớp học · chứng chỉ
```

**Components affected.** `app/v2/student/progress/page.tsx` (mở rộng) · `/stats`, `/achievements`, `/exercise-history`, `/certificates` (thành subsection) · `TkStatStrip`+`AdStat` (hợp nhất một component, nhận **tone token** không nhận hex) · `SkillScore` · `GaProgress` · `TkTabs`.

**States.** new (chưa đủ dữ liệu → giải thích cách tiến độ được tính, không hiện 0%) · loading (skeleton chart **ổn định kích thước**) · partial (một nguồn hỏng → phần đó hiện "không tải được", phần khác vẫn hiển thị) · error (fallback **tóm tắt bằng chữ**) · offline · advanced (mở thêm phân tích chi tiết) · enrolled (hiện subsection lớp) · không thuộc lớp (ẩn subsection, không để ô trống).

**Responsive.** **1440:** 2 cột (learning+skills trái, habit/reward/evidence phải). **1280:** 2 cột hẹp hơn. **768:** 1 cột, chart cuộn trong container riêng. **390:** ưu tiên "đang ở đâu + mốc kế tiếp + 1 hành động"; chart thu gọn hoặc thay bằng bảng số; evidence là danh sách gập.

**Accessibility.** Mọi chart có **text alternative** (bảng hoặc tóm tắt) — bắt buộc theo DS §10.1 · tabular-nums cho mọi số · nhãn nguồn dữ liệu đọc được · không truyền mạnh/yếu chỉ bằng màu.

**Performance.** Thư viện chart nạp động, chỉ khi vào tab tương ứng · dữ liệu evidence phân trang, không tải toàn bộ lịch sử.

**Priority.** **P1**.

**Dependencies.** S-01; cần **quyết định nguồn dữ liệu** (P4-D2 §7) trước khi vẽ skill mastery/CEFR %.

**Risk.** *Gộp che mất nguồn khác nhau* → mọi khối ghi nguồn. *Người dùng mất bookmark `/stats`* → giữ URL + alias ở Wave 2. *Áp lực hiển thị "một con số đẹp"* → guardrail §1.4 là điều kiện nghiệm thu, không phải khuyến nghị.

**Acceptance criteria.**
1. Fortschritt mở đầu bằng learning progress; **XP không nằm trong màn đầu tiên nhìn thấy**.
2. Mọi số đều có nguồn khai báo được; **0** chỉ số tổng hợp mới không có công thức canonical.
3. Mỗi chart có text alternative.
4. Class progress có nhãn nguồn rõ ràng và không trộn vào mastery.
5. Các route cũ vẫn tới được nội dung tương ứng.

---

### S-11 — Homepage

**Current problem.** Narrative hiện: Hero → proof → problem → how → feature grid → level path → industries/career → Goethe → testimonials → teacher → pricing → final CTA. Thiếu section **Learning Journey** (signature) và Interview chưa có section sâu riêng dù là hero feature. Sáu feature block dùng **sáu accent color** (UI-06). CTA phụ "Xem demo 90 giây" trỏ `/v2/login` — sai kỳ vọng. Toàn trang là client component chỉ vì tab ngành + menu mobile. Số liệu social proof (`92%`, `2.400+`) cần evidence governance.

**UX reasoning.** Homepage đang tốt về hierarchy và không tràn ở 390 — nên đây **không** phải ưu tiên số một (handoff §10.10). Vấn đề là lời hứa: hero bán "AI phỏng vấn theo ngành", phần sau lại kể một nền tảng all-in-one, làm loãng định vị. Và CTA dẫn tới login thay vì demo là mất niềm tin ngay ở bước rẻ nhất.

**Proposed solution.** Giữ nguyên visual direction; **sắp lại narrative** theo handoff §11.1 (thêm Learning Journey + section Interview sâu), chuyển 6 accent color về **neutral + một accent**, sửa CTA demo trỏ demo thật (hoặc đổi nhãn đúng hành vi — không được để nhãn hứa sai), và tách trang thành server component + island nhỏ cho tab/menu.

**Information hierarchy.** `Hero → Proof → Problem → How it works → Learning ecosystem (kết nối, không phải 6 ô ngang hàng) → **Learning Journey** → Career German → **AI Interview (sâu)** → Goethe → Kết quả học viên → Teacher → Pricing → Final CTA`. Mỗi section **một nhiệm vụ**, tối đa 1 CTA filled/section.

**Components affected.** `app/page.tsx` + các section homepage · tab ngành (island) · menu mobile (island) · MỚI section Journey + section Interview · pricing block (đồng bộ với S-11 pricing canonical).

**States.** default · loading ảnh (kích thước cố định, không CLS) · tab ngành đang chọn · menu mobile mở · **evidence chưa có** (nếu không chứng minh được số liệu → gỡ số, không để claim trần) · offline (trang tĩnh vẫn đọc được).

**Responsive.** **1440/1280:** hero 2 cột, mockup thật bên phải. **768:** hero 1 cột, mockup dưới. **390:** giữ trạng thái hiện tại (đã không tràn, CTA 44px); ưu tiên hero → proof → how → interview → pricing; các section dài rút gọn/gập.

**Accessibility.** Một `<h1>` duy nhất (đã đạt) · thứ tự heading không nhảy cấp · tab ngành là tablist thật có bàn phím · menu mobile có aria state (đã có) · ảnh mockup có alt mô tả sản phẩm.

**Performance.** **Chuyển phần lớn sang server component** — đây là thắng lợi hiệu năng lớn nhất và rẻ nhất của cả redesign; island chỉ cho tab + menu. Ảnh AVIF/WebP kích thước đúng; preload chỉ ảnh hero + 1 weight font. Mục tiêu: LCP < 2,5s, CLS < 0,1.

**Priority.** **P1** (sau P0 và P1-high). Ngoại lệ: **CTA demo sai kỳ vọng** là lỗi niềm tin, có thể xử lý sớm như quick win **nếu owner mở gate** (§6).

**Dependencies.** Token layer (đổi 6 accent → neutral + 1); nội dung Journey/Interview lấy từ S-03/S-06 để không hứa sai sản phẩm.

**Risk.** *Sắp lại narrative làm giảm conversion* → đổi theo lô + đo, không đổi một lần toàn trang. *Gỡ số liệu làm trang yếu đi* → thay bằng bằng chứng thật (kết quả học viên có nguồn). *Chuyển server component phá tab/menu* → island hoá có test.

**Acceptance criteria.**
1. Test 5 giây: người mới hiểu sản phẩm ≥80%.
2. Có section Learning Journey và section Interview riêng.
3. Số accent màu trong feature area giảm về **neutral + 1**.
4. Mọi CTA dẫn tới đúng thứ nó hứa (0 nhãn sai).
5. LCP/CLS không tệ hơn hiện trạng; JS gửi xuống giảm.

---

### S-12 — Teacher Heute và teacher navigation

**Current problem.** `/v2/teacher/page.tsx` (355 dòng) mở bằng **stat strip** rồi mới tới hàng đợi công việc; ô "Tạo lớp" chiếm prominence cao cho một việc không hằng ngày. Nav teacher >15 item, riêng "Quản lý lớp" 11 item (UX-10). Error UI từng lộ chuỗi endpoint API (`GET /api/...`) cho giáo viên.

**UX reasoning.** Giáo viên mở app để biết **hôm nay dạy gì, còn bài nào phải chấm, ai đang tụt lại** — không phải để đọc KPI hay tạo lớp mới. IA-D6 đã chốt 5 nhóm theo công việc hằng ngày; màn Heute phải phản chiếu đúng thứ tự đó.

**Proposed solution.** Đảo hierarchy Teacher Heute: lịch dạy hôm nay → hàng đợi chấm bài → học viên cần chú ý → tin nhắn gần đây → (số liệu lớp xuống dưới) → công cụ/tạo lớp vào **Klassen**. Nav gom về `Heute · Klassen · Bewerten · Materialien · Berichte`; AI tools thành **hành động tạo** trong Materialien. Xoá text endpoint khỏi mọi error UI.

**Information hierarchy.**
```text
Heute · {ngày}
  Unterricht heute        ← lớp + giờ + phòng/link, CTA "Vào lớp"
  Zu bewerten (n)         ← hàng đợi chấm, CTA "Chấm tiếp"
  Braucht Aufmerksamkeit  ← học viên tụt lại/vắng, kèm lý do
  Nachrichten             ← 3 tin gần nhất
  Klassenzahlen           ← số liệu, sau cùng
```

**Components affected.** `app/v2/teacher/page.tsx` · `nav.ts` (nhóm teacher) · `TkStatStrip` (xuống dưới) · `DataTable` (hàng đợi chấm — cần `role="status"`/`role="alert"`, F-08) · `TeacherPendingPill` · `ErrorBanner` (bỏ chuỗi endpoint) · `GaLocalNav`.

**States.** không có lớp hôm nay (nêu rõ + gợi ý việc khác, không để trống) · hàng đợi rỗng ("đã chấm hết") · loading · partial (một nguồn hỏng → khối đó retry) · error (**không lộ endpoint/stack**) · offline · giáo viên mới (chưa có lớp → hướng dẫn tạo lớp — đây là lúc "Tạo lớp" được phép nổi bật).

**Responsive.** **1440/1280:** 2 cột (lịch + hàng đợi trái; attention + tin nhắn phải). **768:** 1 cột theo đúng thứ tự ưu tiên. **390:** lịch hôm nay + hàng đợi trước; bảng chuyển thành danh sách task (không co ngang); bottom nav `Heute · Klassen · Bewerten · Materialien · Mehr` (IA-D7).

**Accessibility.** Hàng đợi là list/table có semantics đúng · row click phải có phần tử focusable thật (DS §8.2) · số lượng chờ chấm đọc được (không chỉ badge màu) · thông báo lỗi bằng ngôn ngữ người dùng.

**Performance.** Tách truy vấn theo khối để khối lịch hiện trước · bảng phân trang server-side nếu dữ liệu lớn.

**Priority.** **P1**.

**Dependencies.** S-01 (nav teacher), F-08 (DataTable a11y), token layer.

**Risk.** *Giáo viên quen sidebar cũ* → giữ URL, thêm bảng ánh xạ + local nav có tìm kiếm. *"Tạo lớp" bị chôn* → vẫn nổi bật cho giáo viên chưa có lớp (state-driven, không vị trí cố định).

**Acceptance criteria.**
1. Trong viewport đầu: **hàng đợi công việc đứng trên số liệu** ở cả 4 breakpoint.
2. Nav teacher còn **5 nhóm**; mọi destination cũ vẫn reachable ≤2 cấp.
3. **0** chuỗi endpoint/stack trong error UI của giáo viên.
4. Thời gian tới hành động chấm bài đầu tiên giảm (đo bằng analytics sau cutover).

---

### S-13 — Mobile navigation

**Current problem.** Mobile hiện dùng **cùng inventory desktop** trong drawer (IA-08) — giải quyết chỗ hiển thị chứ không giải quyết decision load. Primitive control còn 36–40px < 44px (F-06). Native shell có `df-bottom-nav` glassmorphism nhưng đó là scope `html.native` (D5), không phải web.

**UX reasoning.** Mobile là nơi learner mở app nhiều nhất giữa các buổi học; task order phải khác desktop **có chủ đích**, không phải desktop xếp chồng. Bottom nav 5 item phản chiếu đúng 5 ý định đã chốt, còn utility rút về topbar/account.

**Proposed solution.** Web mobile (<768) dùng **bottom nav 5 item** đúng IA-D7 cho student và `…/Mehr` cho teacher; drawer chỉ chứa utility; **ẩn bottom nav** trong Exam Room, Interview Room và Speaking session đang chạy, thay bằng exit rõ ràng + trạng thái lưu.

**Information hierarchy.**
```text
Topbar:   [Tiêu đề màn]                    [🔔] [Avatar]
Nội dung: theo thứ tự mobile của từng màn (S-02 §Responsive)
Bottom:   Heute · Lernen · Sprechen · Prüfung · Fortschritt      ← icon + nhãn Đức ngắn
          (ẩn hoàn toàn trong mode shell)
```

**Components affected.** MỚI `GaBottomNav` (web, **không** dùng lại `df-bottom-nav` native theo D5) · `GaShell` (nhánh mobile) · `GaSidebar` (chỉ còn utility drawer) · mọi mode shell (S-06, S-07, S-09) khai báo `hideBottomNav`.

**States.** default · selected (indicator + weight + nhãn, **không chỉ màu**) · badge (chỉ task time-sensitive; **cấm badge XP**) · hidden (mode shell) · keyboard mở (nav không che input) · safe-area (giữ inset đã có).

**Responsive.** **1440/1280:** bottom nav không tồn tại (dùng sidebar). **768:** ngưỡng chuyển — kiểm tra cả hai phía biên. **390:** bottom nav cố định, mỗi item ≥44px, nhãn không xuống dòng (nhãn Đức ngắn, **không** hiển thị hai dòng Đức/Việt thường trực — IA §10.1).

**Accessibility.** `<nav aria-label>` + `aria-current` · target ≥44px (D8) · vùng an toàn iOS · nav không che nội dung khi bàn phím ảo mở · trợ giúp tiếng Việt qua first-use education/accessible description.

**Performance.** Bottom nav là component nhẹ, không animation nặng; tránh re-render toàn shell khi đổi route.

**Priority.** **P1** (riêng phần **≥44px** là **P0-F/F-06**).

**Dependencies.** S-01 (nav config dùng chung), D8, mode shells của S-06/S-07/S-09.

**Risk.** *Trùng lặp với native bottom nav* → phân định rõ scope `html.native` (D5), không dùng chung CSS. *Nhãn Đức bị cắt* → kiểm tra bằng chuỗi dài nhất ở 390 và cỡ chữ hệ thống lớn.

**Acceptance criteria.**
1. Bottom nav đúng 5 item, mỗi item ≥44px ở 390.
2. Bottom nav **ẩn hoàn toàn** trong Exam/Interview/Speaking session; có exit rõ ràng.
3. Thứ tự nội dung mobile của Heute khác desktop đúng như S-02.
4. Không có nhãn bị cắt/ xuống dòng ở 390 với cỡ chữ hệ thống 100% và 130%.

---

### S-14 — Empty / loading / error / partial / offline (hợp đồng xuyên suốt)

**Current problem.** Toàn repo chỉ có **1** `loading.tsx` và **7** `error.tsx` ở cấp route trên 233 page. Galerie có primitive tốt (`EmptyState`, `ErrorBanner`, `LoadingState`, `SkeletonRow`) nhưng legacy dùng spinner/state tự chế; `DataTable` thiếu `role="status"`/`role="alert"` (F-08); copy mặc định hardcode tiếng Việt trong component. Skeleton trộn `animate-pulse` và `ga-shimmer`.

**UX reasoning.** Trạng thái không phải "trường hợp hiếm" — người dùng thật gặp chúng mỗi ngày (mạng yếu, dữ liệu chưa có, quota hết). Nếu mỗi màn tự phát minh cách hiển thị lỗi thì sản phẩm mất tính nhất quán đúng lúc người dùng dễ mất niềm tin nhất.

**Proposed solution.** Một hợp đồng trạng thái áp cho **mọi** màn trong kế hoạch này, dùng đúng 4 primitive Galerie + 2 quy tắc mới: (1) **partial trước total** — một khối hỏng không được làm hỏng cả màn (mẫu `Promise.allSettled` đã có ở dashboard); (2) **không bao giờ nói dối trạng thái** — chưa lưu thì không hiện "đã lưu", chưa có dữ liệu thì không hiện 0.

**Information hierarchy.** Thứ tự ưu tiên khi một màn ở trạng thái bất thường — luôn giữ được orientation trước, rồi mới tới lỗi:
```text
1. Ngữ cảnh vẫn hiển thị   (tôi đang ở màn nào, đang học gì)   ← không bao giờ bị nuốt bởi lỗi
2. Trạng thái của khối hỏng (một khối, không phải cả màn)
3. Hành động khôi phục      (thử lại / tiếp tục offline / quay về owner area)
4. Hệ quả nếu không làm gì  (bài đã lưu chưa, hàng đợi có mất không)
5. Đường thoát an toàn      (về area chủ sở hữu, không phải back trình duyệt)
```

**Ma trận trạng thái chuẩn (mở rộng handoff §16).**

| Màn | Empty / new | Loading | Partial | Error / recovery | Offline | Completed |
|---|---|---|---|---|---|---|
| Heute | CTA bài đầu tiên | Skeleton giữ hierarchy | Khối hỏng retry riêng | Giữ greeting + retry | Nội dung cache/disable có lý do | "Fertig für heute" + 1 gợi ý |
| Lernweg | Placement/setup | Skeleton cây giữ khung | Nhánh thiếu dữ liệu ghi nhãn | **Fallback danh sách accessible** | Xem lộ trình đã tải | Mastery + nhánh kế |
| Lesson | Chưa mở/khoá | Skeleton trong shell | Media hỏng, phần khác dùng được | Giữ tiến độ, retry tại chỗ | Nháp cục bộ, chặn nộp | Recap + next |
| Speaking | Chưa cấp mic/persona | Connecting/processing | Feedback thiếu chiều → ghi rõ | Permission/quota/network recovery | Chặn phiên, nêu lý do | Summary + luyện lại |
| Interview | Setup thiếu | Interviewer connecting | Một câu lỗi không mất câu khác | **Resume interview** | Chặn + giữ phiên | Report + luyện tiếp |
| SRS | Zero due (không ép) | Preload thẻ | — | **Giữ nguyên hàng đợi** | Ôn thẻ đã tải, đồng bộ sau | Retention + lần kế |
| Exam | Chưa có gói đề | Preload media | — | **Resume + trạng thái lưu thật** | Chặn nộp, giữ bài | Điểm/báo cáo |
| Fortschritt | Chưa đủ dữ liệu (giải thích) | Skeleton chart ổn định | Nguồn hỏng → chỉ khối đó | **Tóm tắt bằng chữ** | Dữ liệu đã tải | Mốc CEFR kế tiếp |
| Teacher Heute | Chưa có lớp | Skeleton hàng đợi | Khối hỏng riêng | Không lộ endpoint | Chỉ đọc | "Đã chấm hết" |

**Components affected.** `EmptyState` · `ErrorBanner` · `LoadingState` · `SkeletonRow` (thống nhất `ga-shimmer`) · `DataTable` (thêm `role="status"`/`role="alert"` — F-08) · MỚI `OfflineBanner` · route-level `loading.tsx`/`error.tsx` cho các area chính.

**States.** (chính là nội dung màn này — xem ma trận trên.)

**Responsive.** Skeleton phải **giữ đúng kích thước thật** ở cả 4 breakpoint (chống CLS) · banner lỗi không đẩy nội dung nhảy · ở 390 banner không che hành động chính.

**Accessibility.** loading → `role="status" aria-live="polite"` + `aria-busy` trên control · error → `role="alert"` · offline → thông báo một lần, không lặp · **mọi copy qua i18n** (hết hardcode tiếng Việt trong primitive) · trạng thái không truyền chỉ bằng màu/icon.

**Performance.** Skeleton nhẹ, không animation nặng · tránh spinner toàn màn (chặn cảm giác tiến triển) · error boundary theo area, không toàn app.

**Priority.** **P0-F** cho F-08 (a11y DataTable) và cho hợp đồng "không nói dối trạng thái" trong Exam; phần còn lại **P1**.

**Dependencies.** Token layer, i18n keys cho copy mặc định.

**Risk.** *Mỗi màn tự làm lại* → checklist review là điều kiện merge. *Copy i18n thiếu key* → chạy `check:i18n` như hiện tại (đã có script parity 3 locale).

**Acceptance criteria.**
1. 100% màn trong kế hoạch này khai đủ 6 trạng thái trong ma trận (n/a phải ghi rõ).
2. **0** primitive còn copy hardcode tiếng Việt.
3. `DataTable` loading/error có `role` đúng.
4. Không màn nào hiển thị trạng thái sai sự thật (đặc biệt "đã lưu" trong Exam).
5. Skeleton không gây CLS đo được ở 4 breakpoint.

---

## 3. Implementation waves

Nguyên tắc: **thứ tự phụ thuộc, không phải thứ tự dễ làm** (handoff §18). Mỗi wave có gate riêng; không mở wave sau khi wave trước chưa đạt gate.

### Wave 0 — Foundations (CÓ thay đổi thị giác có chủ đích — xem "Expected visual deltas" bên dưới)

**Điều kiện thi hành Wave 0 (owner duyệt 26/08 — xem §7 mục W0-C1…C10):** lint theo baseline/ratchet; font swap giới hạn weight + đo before/after; focus-visible định nghĩa theo *interactive/focusable elements*, không theo đếm component; portal Radix phải giữ Galerie scope; chỉ tạo primitive có consumer thật; hardcode chỉ vá trong file thực sự chạm; test files nằm trong inventory; i18n contract nhất quán cho primitive; scope an toàn (không nav.ts/page/globals.css legacy/backend/native, không xóa legacy, không revert thay đổi người khác, không commit khi chưa được yêu cầu).

| # | Hạng mục | Band |
|---|---|---|
| 0.1 | Token layer: 13 type role, 10 spacing, warning/overlay/locked/selected/xp/streak/progress, radius-touch, shadow-drawer, 4 duration + 2 easing | P0-S |
| 0.2 | **D1 font swap** — bỏ Instrument Sans; Be Vietnam Pro (chỉ weight 400/500/600, KHÔNG 700) thành UI sans; Newsreader chỉ tải style/weight thực dùng (kiểm italic homepage); Inter giữ cho legacy trong migration; **đo before/after: số WOFF2, payload, preload/route, glyph Việt, CLS/LCP signal** — không tuyên bố cải thiện nếu payload chưa giảm. **Quyết định owner (Gate 0 review): GIỮ italic Newsreader thật** — italic dùng ở Homepage + màn authenticated, thuộc editorial identity. **Performance risk ghi nhận: 22 WOFF2 / ~505KB, root layout preload 18 file / ~432KB, payload CHƯA giảm** → font-loading optimization (scope preload theo surface, cắt Inter khi legacy chết) là backlog có owner ở Wave 4–5, không claim improved | **P0-F (F-07)** |
| 0.3 | Token lint **baseline/ratchet**: chặn violation MỚI trong file/dòng thay đổi; baseline + exception registry (file/pattern/lý do); baseline chỉ được GIẢM; script `check:design-tokens` trong `frontend/package.json`; CI và local chạy CÙNG một command; không auto-generate exception | P0-S |
| 0.4 | **focus-visible: 100% interactive/focusable elements trong ui-v2** có visible keyboard focus (audit cả nested button/link/trigger/pager); KHÔNG thêm tabindex/ring cho static component (Card/Cap/PageHdr) chỉ để đạt count; state không truyền chỉ bằng màu | **P0-F (F-05)** |
| 0.5 | Interactive control mobile ≥44px (GaBtn, pager DataTable, toggle GaShellNav, trigger NotificationBell, TkSeg/TkTabs/TkModal-close, LanguageToggle) | **P0-F (F-06)** |
| 0.6 | `DataTable` `role="status"`/`role="alert"`; **i18n primitive contract nhất quán**: default qua namespace i18n chung (primitive client luôn trong provider) + override qua prop — không trộn hardcode/hook/prop vô quy tắc | **P0-F (F-08)** |
| 0.7 | Primitive CÓ consumer: `GaInput` · `GaTextarea` · `GaProgress` · `GaSelect` · `GaTooltip` · `GaPopover` + **NotificationBell migrate sang GaPopover**. **Portal scope contract bắt buộc trước khi viết adapter**: portal content tự mang `.ga-scope` + đúng `data-role` (hoặc mount vào container đã có scope); KHÔNG promote `--ga-*` lên `:root` trong Wave 0; có test xác nhận portal render đúng token. **Defer nếu chưa có consumer Wave 1–2**: GaCheckbox/GaRadio/GaSwitch; **GaToast defer** nếu root layout còn dùng `ui/sonner` legacy (ghi dependency) | P0-S |
| 0.8 | **Test inventory**: unit/component test cho focus-visible/disabled/aria-invalid/loading-error (khi applicable); test portal scope Select/Tooltip/Popover; test target ≥44px cho trigger/pager/button chính; test lint baseline/ratchet; update test GaSidebar/GaShell hiện có nếu kích thước trigger đổi; chạy check i18n vi/en/de | P0-S |

**File dự kiến chạm (bổ sung theo điều kiện owner):** `frontend/package.json` · `frontend/scripts/lint-design-tokens.mjs` (mới) · baseline/exception file (mới) · `.github/workflows/frontend-ci.yml` · `TkBadge.tsx` (vá `text-white` → token vì file được chạm) · **KHÔNG chạm** `GaLogo.tsx` (không có dependency trực tiếp trong Wave 0).

**Expected visual deltas (có chủ đích — visual regression phân biệt expected vs unexpected=fail):** (1) font UI sans đổi Instrument Sans → Be Vietnam Pro; (2) focus ring xuất hiện khi điều hướng bàn phím; (3) interactive control mobile 40→44px; (4) radius touch 6px trên input/control mới; (5) skin portal (Select/Tooltip/Popover) theo token ga.

**Gate 0:** `check:design-tokens` xanh (0 violation mới, baseline không tăng) · visual regression 4 breakpoint: expected deltas đúng danh sách, unexpected = fail · a11y test focus/target đạt · font đo before/after đầy đủ 5 chỉ số · test + typecheck + build + check-i18n 3 locale xanh · báo cáo 10 mục cho owner, **dừng chờ approve Gate 0 trước Wave 1**.

### Wave 1 — Navigation & spine
| # | Hạng mục | Band |
|---|---|---|
| 1.1 | S-01 Navigation + role shells (5 top-level student, 5 nhóm teacher, utility ra topbar/account) | P0-S |
| 1.2 | S-02 Heute — ContinueLearning dominant, giải thể stat strip | P0-S |
| 1.3 | S-03 Lernen/Journey — một mental model, node 1 CTA, locked có điều kiện | P0-S |
| 1.4 | S-13 phần bottom nav web 5 item | P1 (44px là P0-F) |

**Gate 1:** route reachability 100% · first-click ≥80% chọn ContinueLearning · task "tìm node kế tiếp" ≥90% · analytics map cũ→mới đã chạy.

### Wave 2 — Mode shells (nơi người học ở lại lâu)

**Thứ tự 2.1↔2.2 theo P4-D8 (approved):** Wave 2 mở màn bằng **2.0 — read-only verification autosave/data-loss của Exam** (không code sửa, chỉ kiểm chứng). Nếu verify được data-loss/recovery blocker → Exam Shell (2.1) trước Interview (2.2). Nếu không có blocker verified → **Interview trước** (hero-product priority). Studio luôn sau Interview và foundational mode shells.

| # | Hạng mục | Band |
|---|---|---|
| 2.0 | **Read-only verification autosave/recovery Exam** (kết quả quyết định thứ tự 2.1/2.2) | P0-S (verification) |
| 2.1 | S-09 Exam Shell + Prüfung hub (autosave/exit/ẩn gamification) | P0-S |
| 2.2 | S-06 AI Interview — 6 chặng + prominence + resume | P0-S |
| 2.3 | **S-07 Speaking Studio** — tranche đầu sau P0, sau Interview + mode shells nền | **P1-high** |
| 2.4 | S-04 Lesson shell | P1 |

**Gate 2:** Exam Shell 0 gamification (kiểm DOM) · rớt mạng không mất bài/câu trả lời · Studio ≠ Interview qua mode identity test · Lesson shell dùng chung cho 5 skill view.

### Wave 3 — Habit & evidence
| # | Hạng mục | Band |
|---|---|---|
| 3.1 | S-08 Vocabulary/SRS — pre-session duy nhất, hợp nhất thẻ | P1 |
| 3.2 | S-10 Fortschritt — hierarchy + nhãn nguồn dữ liệu | P1 |
| 3.3 | S-12 Teacher Heute + nav teacher | P1 |
| 3.4 | S-14 hợp đồng trạng thái phủ toàn bộ màn đã redesign | P1 |

**Gate 3:** 0 chỉ số tổng hợp không nguồn · hàng đợi teacher trên số liệu · ma trận trạng thái đủ 6 cột/màn.

### Wave 4 — Acquisition & polish
| # | Hạng mục | Band |
|---|---|---|
| 4.1 | S-11 Homepage: narrative + server component + neutral+1 accent + CTA đúng nghĩa | P1 |
| 4.2 | Typography/spacing/surface sweep phần còn lại | P2 |
| 4.3 | Motion vocabulary, milestone ritual thay confetti | P2/P3 |
| 4.4 | Screen-local primitives (18 vị trí) hợp nhất; hardcode §9.3 trả về token | P2 |

**Gate 4:** LCP/CLS không tệ hơn · JS homepage giảm · 0 literal design value mới ngoài exception.

### Wave 5 — Legacy retirement (theo IA Wave 2–3)
307/alias cho stats/history/achievements/certificates/interview/mock; xoá legacy chỉ khi thoả 6 điều kiện IA §12 Wave 3. **Không** đụng native scope (D5), public/SEO, token verify, payment callback.

---

## 4. Component dependency order

Xây theo thứ tự này; mũi tên là "phải có trước".

```text
[1] Tokens (type · spacing · color · surface · radius · shadow · motion)
      ↓
[2] Primitive contracts: focus-visible · state matrix · i18n copy
      ↓
[3] Primitive còn thiếu:  GaInput · GaTextarea · GaProgress
                          adapter: Select · Checkbox/Radio/Switch · Tooltip · Popover · Toast
      ↓
[4] Shell layer:  GaShell → GaShellNav · GaSidebar · GaTopBar · GaBottomNav · GaLocalNav
      ↓
[5] Learning components:  ContinueLearning · LessonCard · LearningNode · VocabularyCard
                          SpeakingFeedback · InterviewQuestion · SkillScore
                          Streak · XP · WeeklyGoal · ExamTimer · Achievement
      ↓
[6] Mode shells:  LessonShell · StudioShell · InterviewShell · ExamShell
      ↓
[7] Screens:  Heute → Lernweg → Prüfung/Exam → Interview → Studio → Lesson
              → SRS → Fortschritt → Teacher Heute → Homepage
```

Ràng buộc bắt buộc:
- `ContinueLearning` cần `GaProgress` → nên `GaProgress` phải xong trong Wave 0.
- `ExamShell`/`InterviewShell`/`StudioShell` **không** được dựng trên role shell — chúng là layout song song, cùng token.
- `SpeakingFeedback` dùng chung S-06/S-07 nhưng **hai shell khác nhau**; cấm gộp shell để "tiết kiệm".
- `TkStatStrip` + `AdStat` hợp nhất **trước** khi Fortschritt dùng lại (tránh sinh biến thể thứ ba).

---

## 5. Quick wins — vẫn ĐÓNG GATE, chưa implement

12 quick win trong handoff §22 **không được làm** trong Phase 4 và không tự động mở khi Phase 4 được approve. Chúng chỉ được mở khi owner nói rõ. Lý do giữ gate: phần lớn quick win chạm đúng những màn đang chờ redesign (dashboard, nav, mobile primitives) — làm trước sẽ tạo ra biến thể phải sửa lại hai lần.

| Quick win | Thuộc màn | Sẽ được thực hiện tự nhiên trong |
|---|---|---|
| Đưa stat strip xuống dưới Continue/Today | S-02 | Wave 1.2 |
| Bỏ streak trùng lặp | S-02 | Wave 1.2 |
| Thêm entry Interview rõ ràng | S-01/S-05 | Wave 1.1 |
| Ẩn nav ít dùng xuống cấp 2 | S-01 | Wave 1.1 |
| Mobile primitives 44px | S-13 | **Wave 0.5 (P0-F)** |
| Card feature màu → neutral + 1 accent | S-02/S-11 | Wave 1.2 / 4.1 |
| Chuẩn hoá padding card | Tokens | Wave 0.1 |
| Bỏ endpoint text khỏi teacher error | S-12 | Wave 3.3 |
| CTA demo dẫn tới demo thật | S-11 | Wave 4.1 |
| Skeleton kích thước ổn định | S-14 | Wave 0.7/3.4 |
| Tabular numerals cho score/timer | Tokens | Wave 0.1 |
| Nhãn trạng thái ngoài màu | S-14 | Wave 0.2/3.4 |

**Ngoại lệ duy nhất:** lỗi security/mất dữ liệu là luồng hotfix riêng, không đi qua gate này (đã áp dụng cho F-01…F-04).

---

## 6. Verification cho mỗi wave

Mỗi màn chỉ được coi là xong khi qua đủ 5 lớp kiểm chứng:

1. **Runtime 4 breakpoint** — 1440/1280/768/390, đủ ma trận trạng thái S-14 (empty/loading/partial/error/offline/completed/locked/new/advanced), có chuỗi tiếng Đức dài nhất và tiếng Việt có dấu.
2. **Accessibility** — keyboard path đầy đủ, focus-visible, contrast AA, target ≥44px, reduced-motion, live region, text alternative cho chart.
3. **Token discipline** — CI lint 0 literal mới; visual regression 4 breakpoint.
4. **Performance** — delta bundle route, LCP/CLS của màn, không thêm animation library.
5. **Task success** — bài test hành vi tương ứng đã ghi trong Acceptance criteria của màn.

Trên prod: mọi màn học viên phải QA bằng tài khoản thật (bài học từ đợt Speaking: "spec xanh" không chứng minh đường thật sống).

---

## 7. Approved decisions — owner duyệt ngày 26/08/2026

**Trạng thái: APPROVED.** Toàn bộ P4-D1–P4-D8 đã được owner chốt (P4-D4 có điều kiện; P4-D6 và P4-D8 được chỉnh so với khuyến nghị gốc). Đây là quyết định đã khóa — Phase 5 thi hành đúng nguyên văn dưới đây, không bàn lại:

| ID | Quyết định đã chốt |
|---|---|
| **P4-D1** ✅ | **Giữ hai band P0-S và P0-F**, nhưng **mọi issue phải ghi rõ band**. P0-F chỉ dùng cho blocker chức năng **đã verify**. P0-S dùng cho dependency cấu trúc chặn các màn khác — **không được dùng như nhãn production incident**. |
| **P4-D2** ✅ | Chỉ hiển thị progress/mastery **có nguồn dữ liệu thật**. Không tạo synthetic CEFR %, overall score hoặc công thức mới. Thiếu dữ liệu phải hiển thị **"chưa đủ dữ liệu"**. |
| **P4-D3** ✅ | Goethe Speaking được **trình bày trong Prüfung**. Giữ URL hiện tại (`/v2/student/speaking/exam`) trong wave đầu; **chỉ tạo alias/307 sau khi bookmark, active session và E2E đã được kiểm tra**. |
| **P4-D4** ✅ có điều kiện | Mobile mặc định **list-first** (performance + accessibility). **Điều kiện:** Learning Journey vẫn phải giữ **visual signature bằng một compact journey/branch overview** trên mobile; tree đầy đủ là chế độ xem tùy chọn. **Không được biến mobile thành danh sách generic.** |
| **P4-D5** ✅ | **Gỡ mọi số liệu/testimonial không có nguồn kiểm chứng.** Có thể thay bằng proof có nguồn hoặc copy định tính trung thực. |
| **P4-D6** ✅ đã chỉnh | **Journey/Tree là representation chính trên desktop.** Nodes list là **accessible alternate representation của cùng dữ liệu** — không phải mental model hoặc tab ngang hàng có prominence bằng Journey. Mobile list-first theo P4-D4. **Phase được hấp thụ vào contextual header.** Không giữ cấu trúc ba tab Tree/Nodes/Phase hiện tại. |
| **P4-D7** ✅ | **Gỡ mesh/orb/character float khỏi active Speaking session.** Chỉ được cân nhắc ở welcome/setup khi không cạnh tranh với recording, goal và feedback; **phải respect `prefers-reduced-motion`**. |
| **P4-D8** ✅ đã chỉnh | **Bắt đầu Wave 2 bằng read-only verification về autosave/data-loss của Exam.** Nếu có data-loss/recovery blocker được verify → **Exam Shell trước Interview**. Nếu không có blocker được verify → **AI Interview trước** để khớp hero-product priority. **Speaking Studio luôn P1-high**, thực hiện **sau Interview và foundational mode shells**. |

### §7.1 — Điều kiện thi hành Wave 0 (owner duyệt 26/08/2026, kèm approve Phase 5/Wave 0)

Owner duyệt **chỉ Wave 0** (không Wave 1) với 10 điều kiện bắt buộc:

| ID | Điều kiện |
|---|---|
| **W0-C1** | **Token lint = baseline/ratchet.** Không tạo rule khiến toàn bộ debt cũ fail. Chặn violation MỚI trong file/dòng thay đổi; baseline/exception registry có file+pattern+lý do; baseline chỉ được giảm, tăng phải có approval; script `check:design-tokens` trong `frontend/package.json`; CI và local cùng một command; không auto-generate exception cho violation mới. |
| **W0-C2** | **Font swap giới hạn weight + đo.** Be Vietnam Pro chỉ 400/500/600 (không 700); Newsreader chỉ style/weight thực dùng (kiểm italic homepage); Inter chỉ cho legacy trong migration. Đo before/after: tổng WOFF2, tổng payload, preload theo route, glyph Việt thực tế, CLS/LCP signal đo được. Không tuyên bố "performance improved" nếu payload chưa giảm. Kiểm German compounds + Vietnamese diacritics sau swap. |
| **W0-C3** | **focus-visible định nghĩa đúng:** 100% *interactive/focusable elements* trong ui-v2 có visible keyboard focus; static component không tự thêm tabindex/ring để đạt count; audit nested button/link/trigger/pager; state không truyền chỉ bằng màu; touch target interactive ≥44px mobile. |
| **W0-C4** | **Radix portal giữ Galerie scope.** Định nghĩa portal scope contract TRƯỚC khi viết adapter: portal content tự mang `.ga-scope` + đúng `data-role`, hoặc mount vào container đã có scope. Không promote `--ga-*` lên `:root` trong Wave 0. Phải có test xác nhận Popover/Tooltip/Select render đúng token khi portal ra ngoài DOM subtree. |
| **W0-C5** | **Không primitive speculative.** Wave 0 chỉ: GaInput, GaTextarea, GaProgress, GaSelect, GaTooltip, GaPopover, NotificationBell→GaPopover. GaCheckbox/GaRadio/GaSwitch chỉ tạo nếu chỉ ra consumer cụ thể Wave 1–2, không thì defer. GaToast chỉ làm nếu giải quyết đủ portal scope + chuyển được root Toaster thực tế; root còn dùng `ui/sonner` legacy → defer + ghi dependency. |
| **W0-C6** | **Đồng bộ danh sách hardcode.** Vá hardcode chỉ trong file thực sự chạm (TkBadge.tsx vào danh sách chính thức); không sweep toàn repo; không chạm GaLogo hoặc screen/page ngoài scope nếu không có dependency trực tiếp. |
| **W0-C7** | **Test files thuộc inventory.** Unit/component test focus-visible/disabled/aria-invalid/loading-error; test portal scope; test target ≥44px; test lint baseline/ratchet; update test GaSidebar/GaShell hiện có nếu trigger đổi kích thước; chạy check i18n vi/en/de. Liệt kê test file mới/sửa trước khi code. |
| **W0-C8** | **i18n primitive contract nhất quán:** không hardcode tiếng Việt trong primitive; chọn MỘT contract (prop hoặc namespace chung khi luôn trong provider) — không trộn vô quy tắc; phải test được. |
| **W0-C9** | **Visual change expectation:** Wave 0 CÓ thay đổi thị giác có chủ đích (font, focus ring, 40→44px, radius touch, portal skin). Visual regression gate phân biệt expected deltas (đã liệt kê) vs unexpected = fail. |
| **W0-C10** | **Scope & an toàn:** không chạm `nav.ts`, page/screen, `globals.css` legacy, backend, mobile native; không xóa legacy component; không revert/overwrite thay đổi người khác trong dirty worktree; không bắt đầu Wave 1; không commit/push khi chưa được yêu cầu. |

**Gate 0 report (bắt buộc khi Wave 0 xong, dừng chờ approve):** (1) file thực tế đã chạm; (2) diff summary theo 0.1–0.7; (3) font measurement trước/sau; (4) lint baseline + số violation mới; (5) test/typecheck/build/i18n; (6) accessibility; (7) visual regression expected/unexpected; (8) primitive đã defer + lý do; (9) rủi ro/blocker còn lại; (10) xác nhận chưa bắt đầu Wave 1. |

---

## 8. Tóm tắt Phase 4

- **14 màn** được lập kế hoạch theo đúng 13 mục yêu cầu, bám Design System (D1–D8) và IA (IA-D1–IA-D8) đã approve; không bàn lại quyết định đã chốt.
- **Thang ưu tiên có kỷ luật:** P0-S cho 7 structural blocker của Phase 1; **P0-F chỉ cho blocker chức năng đã verify** (hiện có 4 mục chưa vá: F-05…F-08); **Speaking Studio giữ P1-high**, không được nâng lên P0.
- **6 wave** với gate riêng, và **component dependency order 7 tầng** — token → primitive → shell → learning component → mode shell → screen.
- **Guardrail dữ liệu**: mọi con số phải có nguồn; cấm chỉ số tổng hợp mới; cấm hiển thị trạng thái sai sự thật (đặc biệt autosave trong Exam).
- **Quick wins vẫn đóng gate**, chỉ mở khi owner cho phép; hotfix security/mất dữ liệu là luồng riêng.
- **P4-D1–P4-D8 đã được owner approve ngày 26/08/2026** (§7 — P4-D4 có điều kiện compact overview; P4-D6 Nodes = accessible alternate; P4-D8 thứ tự Wave 2 theo kết quả verification 2.0). **Phase 5 đang thực hiện — Wave 0 implemented, Gate 0 pending owner approval; Wave 1 chưa bắt đầu.**
