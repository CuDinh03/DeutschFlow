# DeutschFlow Mobile — Design Parity QA (Claude Design v2 "Galerie" ↔ codebase)

> So sánh **screens đã code** (`app/`) với **bản thiết kế Claude Design** (`design/v2/native/na-*.jsx`).
> Thực hiện **2026-06-29** trên nhánh `chore/ios-deploy-sdk54`, qua 7 agent QA song song (đọc full mockup + screen, so 6 nhóm tiêu chí: layout/typography/spacing/màu-token/component/states).

---

## BUILD LOG (parity fixes — 2026-06-29/30)

Verify = **self-QA so code với `na-*.jsx`** (sim không mở được window → không screenshot tự động được). Mỗi commit tsc 0 · jest 18/18.

| ✅ | Item | Data thật | Commit |
|---|---|---|---|
| ✅ | SkillRadar SVG (stats) | `progressApi.skills` | `a6fc73f9` |
| ✅ | Primary Button → ink + YSq; + variant `yellow` | — | `44cdfd0e`·`3a569ea6` |
| ✅ | Password reveal toggle (TextField) | — | `d99de65a` |
| ✅ | Register strength meter + terms checkbox | — | `9bd9ac3a` |
| ✅ | Token violet/teal/orange (B6) | — | `9bd9ac3a` |
| ✅ | Vocabulary SRS due-hero + quick-actions | `/srs/due` | `3a569ea6` |
| ✅ | Home PathCard (roadmap %) | `skillTreeApi` | `c0599852` |
| ✅ | Font v1 + hardcode màu → token (B2/B3) | — | `0eb1dd0e` |

**Còn lại (chưa làm — lớn / rủi ro build-mù cao):** Grammar leveled hub + quiz flow (`grammarApi`); Skill Tree SVG canvas (`skillTreeApi`).
**Backend-blocked (bỏ):** tutor-booking, tuition, announcements, teacher-chat.
**Cần visual-QA Xcode:** vocabulary header height; Button ink+YSq mọi CTA; strength meter/terms.

---

## 0. TL;DR

**Token/primitive layer = FAITHFUL gần như tuyệt đối.** Palette warm-paper, sharp 4px, Newsreader serif + Instrument Sans, ink-hero, yellow-square, caption eyebrow — đều port đúng. App "trông Galerie".

**Drift nằm ở tầng COMPOSITION/FEATURE, không phải theming.** Phần lớn màn được **thiết kế lại quanh backend thật** (khác mockup về *mục đích*, không phải lười). Một phần là **quyết định product có chủ đích** (exam reading-only, paywall iOS compliance, payment defer). Phần còn lại là **gap fidelity thật** + vài **bug nhỏ fix nhanh**.

**Verdict tổng:** ~3 màn FAITHFUL/MINOR, ~15 SIGNIFICANT DRIFT, ~8 mockup CHƯA BUILD. Nhưng nhiều "drift" là cố ý — xem §2 tách rõ.

---

## 1. Scorecard

| Màn | Verdict | Loại |
|---|---|---|
| Roadmap (timeline) | 🟡 MINOR DRIFT | actionable nhỏ |
| SRS flashcards | 🟡 MINOR DRIFT | actionable nhỏ |
| Onboarding | 🟡 MINOR DRIFT | actionable nhỏ |
| Assignment submission (shell) | 🟡 MINOR DRIFT | actionable nhỏ |
| notifications.tsx · guide.tsx | ✅ NO-DESIGN-REF, bám token tốt | — |
| Home | 🔴 SIGNIFICANT | gap thật |
| Skill Tree (learn) | 🔴 SIGNIFICANT — gần như **chưa build** | gap lớn |
| Vocabulary | 🔴 SIGNIFICANT | gap thật |
| Grammar | 🔴 SIGNIFICANT | gap thật + quiz-flow chưa build |
| Node | 🔴 SIGNIFICANT | gap thật |
| Profile | 🔴 SIGNIFICANT | gap thật |
| Edit profile | 🔴 SIGNIFICANT | gap thật |
| Stats/Progress | 🔴 SIGNIFICANT | gap thật (data-viz) |
| Speaking | 🔴 SIGNIFICANT | redesign + quota-gate thiếu |
| Video lessons | 🔴 SIGNIFICANT | gap thật |
| Auth (login/register/forgot/reset) | 🔴 SIGNIFICANT | gap thật + bug |
| Splash/Intro | 🔴 SIGNIFICANT | màu ngược + intro chưa build |
| Classes list | 🔴 SIGNIFICANT | IA khác |
| Class detail | 🔴 SIGNIFICANT | thiếu submit modes/feed |
| Exam · exam-attempt · exam-review | 🔴 SIGNIFICANT | **chủ đích** (reading-only) |
| Paywall/Upgrade | 🔴 SIGNIFICANT | **chủ đích** (iOS compliance) |
| Weekly-speaking/detail (vs na-tutor) | 🔴 feature mismatch | **chủ đích** (feature khác) |
| Tuition | ⚫ UNIMPLEMENTED | **chủ đích** (payment defer) |

---

## 2. Drift CHỦ ĐÍCH (không phải lỗi — đừng "sửa")

Các "SIGNIFICANT DRIFT" sau là **quyết định product đúng**, mockup mới là cái lệch khỏi thực tế:

1. **Exam (3 màn):** app chỉ auto-chấm **Đọc/Lesen**; Nghe/Viết/Nói punt sang web → timer, audio player, waveform, textarea, mic, paginated runner, ProgressRing-result vắng **là cố ý**. (Component radio-choice của exam-attempt là phần faithful nhất.)
2. **Paywall (upgrade):** iOS `PAYWALL_ENABLED=false` (App Store Guideline 3.1.1) → màn neutral compliance, không plan/price/Face-ID/trial. (Lưu ý: nhánh Android-enabled cũng thiếu plan-toggle/compare-table — nếu định bán trên Android thì đây là gap thật.)
3. **Tuition:** payment đang defer (MoMo dummy theo memory) → mockup `na-tuition` chưa có screen/route/menu. Hợp lý với scope hiện tại.
4. **Assignment submit modes:** upload/record/quiz/speaking punt web; app chỉ write + "mở web app".
5. **Weekly-speaking/detail:** là feature **AI weekly challenge** (chấm rubric), KHÁC hẳn `na-tutor` (đặt lịch gia sư 1:1). Mockup tutor-booking không có bản implement; weekly là feature riêng, v2-styled đúng.

---

## 3. Bug nhỏ — FIX NHANH

| # | Bug | Vị trí | Trạng thái |
|---|---|---|---|
| B2 | Font v1 cũ `PlusJakartaSans_400Regular` còn sót → đổi sang `fonts.bodyRegular` (Instrument Sans) | `app/(student)/speaking.tsx:736` | ✅ **FIXED** `0eb1dd0e` |
| B3 | Hardcode màu Tailwind green/red (`#22C55E`/`#EF4444`/`#F0FDF4`/`#FEF2F2`/`#15803D`) → token `success/danger/successSoft/dangerSoft` | `app/(auth)/onboarding.tsx:533-556` (GuestQuickWin) | ✅ **FIXED** `0eb1dd0e` |
| B4 | ~~Version "v1.0.0" vs mockup "2.0"~~ | `profile.tsx:203` | ⚪ **KHÔNG fix** — `app.json` version thật = 1.0.0, hiển thị ĐÚNG; mockup "2.0" chỉ minh hoạ |
| B5 | `borderStrong #D8D2C6` là token tự chế (mockup dùng ink) | `lib/theme/themes.ts` | ⏸️ **HOÃN** — đổi sang ink làm divider đen đậm toàn app (ripple visual), cần review, không phải quick-win |
| B6 | Thiếu hue `violet`/`orange`/`teal` → avatar GV thành vàng; assignment todo/overdue gộp đỏ | `lib/theme/themes.ts` + classes/assignments | ⏸️ **HOÃN** — thêm token mà chưa wire = dead code; wire cần đổi visual nhiều màn + review |

> **B1 ĐÍNH CHÍNH (không phải quick-win):** Agent ban đầu báo "Button thiếu YSq, là ink button". **Sai.** Thực tế impl primary button nền **VÀNG** (`Button.tsx:54`), còn mockup primary nền **INK đen + chữ sáng + YSq vàng** (`na-theme.jsx:167`). Đặt YSq vàng lên nền vàng → vô hình. Đây là **quyết định design lớn** (đổi primary button vàng→ink toàn app), thay đổi visual đáng kể, cần product confirm + review trên simulator — KHÔNG fix mù.

---

## 4. Gap fidelity ở token/typography (toàn app)

1. **Không có "masthead serif 32px".** Mockup `Page` = title serif 32px **trong body** + eyebrow uppercase. App dùng `AppHeader` = `titleLg` 22px serif inline cạnh chevron + caption nhỏ. → **mất khoảnh khắc big-headline editorial trên MỌI màn** (gap pervasive nhất). Cân nhắc thêm 1 variant masthead cho các màn top-level.
2. **Title weight 700 vs 500.** `type.titleLg/title` dùng `displayBold` (700) trong khi mockup title lean 500. App render tiêu đề nặng hơn editorial. (`display` đã đúng 500.)
3. **`radius.xl/2xl/3xl` (6/8/10px)** tạo độ bo mềm mockup không bao giờ dùng (thuần 4px). Vài icon-chip/card mềm hơn thiết kế.
4. **`Caption` component khớp `Cap`** (uppercase/tracked/600/10.5) — TỐT. Nhưng field label trong `TextField` dùng `type.label` (13px sentence-case), không phải overline tracked như mockup `Field`.
5. **`accentSoft` alpha 0.16 vs mockup 0.09** → fill "selected" đậm hơn ~1.8×.
6. **Icon system swap toàn cục:** mockup Material Symbols → app lucide-react-native (cố ý, nhất quán, nhưng glyph khác source-of-truth).

---

## 5. Gap COMPOSITION thật (actionable, theo độ ưu tiên)

### HIGH — màn signature lệch/chưa build
- **Skill Tree (`na-tree` ↔ learn.tsx):** cây SVG tương tác (quả/nhánh/companion/zoom/lesson-sheet/quiz) — **chưa build**; learn.tsx là hub toolkit khác. Đây là màn chữ ký của v2.
- **Home (`na-home` ↔ index.tsx):** thiếu **"Kế hoạch hôm nay" checklist (PlanList)** + stats grid + ~8 block editorial; thay bằng streak/XP dashboard. Không có empty/all-done state.
- **Stats (`na-progress` ↔ stats.tsx):** **SkillRadar (SVG radar)** thay bằng progress bars; mất 14-day streak grid; weekly XP-by-weekday → minutes-by-week; Progress gộp với Achievements.
- **Vocabulary:** dictionary/search thay vì **SRS dashboard** (due-hero/quick-actions/decks). `NAVocabCards` (swipe) + `NAVocabStats` (thống kê SRS) **chưa build**.
- **Auth:** thiếu password-visibility toggle, password-strength meter, terms checkbox, email-verify screen; dùng `Alert` thay inline banner/validation; centered thay vì top-anchor + pinned footer.

### MEDIUM — concept khác hoặc thành phần thiếu
- **Node:** content-reader (theory/vocab/phrases) thay vì activity-checklist launcher; thiếu activity list + fixed CTA + locked-card + completion ăn mừng (đang nằm rải ở node-practice).
- **Grammar:** Kasus declension reference thay vì leveled topic hub + **Lesson/Practice/Review quiz flow (chưa build)**.
- **Profile:** ink hero thay light card; bỏ stats strip 3-up; settings cắt **17→6 rows** (thiếu Gói học/Hạn mức AI/Mục tiêu/Học phí/Video/Gia sư/Thi thử/Thành tích/Giọng đọc/Bảo mật).
- **Edit profile:** bỏ avatar/đổi-ảnh + level selector; chỉ sửa tên.
- **Speaking:** persona picker redesign (card minh hoạ cao + group filter vs grid initial-serif compact); **free-quota gate card thiếu**; mode-tab active vàng vs mockup ink.
- **Video lessons:** không có màn library/list; player là slideshow ảnh thay vì video scrubber; thiếu state "Không phát được video" + "Xem tất cả".
- **Classes:** multi-class list vs single-class hub; thiếu join-card inline, next-session card, announcement feed, benefit-list + link **"Tôi tự học, bỏ qua →"**.
- **Class detail:** status taxonomy 5→3 (mất `regrade`/`overdue`); thiếu announcement feed/detail + teacher chat; assignment thiếu "Tự lưu nháp" + error-correction "Chữa lỗi" card.

### LOW — polish
- **SRS finish, Node locked, …**: state ăn mừng/empty thiết kế riêng bị **downgrade về `EmptyState` generic**.
- **Roadmap:** thiếu tab-switcher (Cây/Giai đoạn) + glow-ring node "đang học".
- **SRS:** rating 4→3 (mất tier "Dễ/4 ngày" xanh dương); gộp màn swipe vào.

---

## 6. Mockup CHƯA BUILD (toàn bộ screen)

`na-tree` (skill tree) · `NAVocabCards` (swipe) · `NAVocabStats` (thống kê SRS) · Grammar Lesson/Practice/Review quiz · `NAWelcome`/`NAGetStarted`/`NAChooseDir` (intro carousel/SSO/direction) · `NAVerify` (email verify) · `na-tutor` (đặt lịch gia sư) · `na-tuition` (học phí) · Announcement feed/detail + teacher chat · `NAAchievements` (đang gộp vào stats).

> Lưu ý: nhiều cái trong số này (tutor, tuition, intro-SSO) có thể **ngoài scope MVP hiện tại** — cần xác nhận với product trước khi coi là "thiếu".

---

## 7. Khuyến nghị thứ tự xử lý

1. **Quick wins (1 buổi):** B1 YSq trong Button (impact cao nhất, 1 component) · B2 font sót · B3 hardcode màu · B5/B6 token (borderStrong + violet/orange/teal) · B4 version string.
2. **Token/type polish:** title weight 500, masthead variant 32px, bỏ radius xl/2xl/3xl thừa, accentSoft 0.09.
3. **State fidelity:** thay `EmptyState` generic bằng celebratory/empty thiết kế riêng (SRS finish, node, home).
4. **Screen-level (cần product confirm scope):** quyết định build hay bỏ Skill Tree, SRS dashboard/stats, grammar quiz flow, Home daily-plan, SkillRadar — đây là các màn signature.
5. **Auth completeness:** password toggle/strength/terms/verify nếu muốn đạt spec.

**Điều cần xác nhận với product trước khi action:** mockup là **spec bắt buộc** hay **exploration tham khảo**? Nhiều màn (node/vocab/grammar/home) impl bám backend thật và khác mockup về *mục đích* — nếu mockup là aspirational thì phần lớn §5 là "tính năng tương lai", không phải "lỗi".
