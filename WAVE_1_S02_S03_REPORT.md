# Wave 1 — S-02 (Heute / Student Dashboard) + S-03 (Lernen / Learning Journey)

> **Trạng thái:** implemented, kiểm chứng xong — **chưa commit** (chờ owner).
> **Ngày:** 26/08/2026 · Tiếp nối `dfe80764` (S-01 + S-13) và `5a9b6127` (Wave 0).
> **Evidence:** `docs/wave1-s02-s03/` (8 ảnh 4 breakpoint + `measurements.json`, chụp từ production build với API stub).

---

## 1. S-02 — Heute: đảo ngược hierarchy

**Trước:** màn mở bằng `TkStatStrip` 4 ô (streak · độ chính xác · cấp/XP · từ đã thuộc) → CTA phiên đầu → **3 thẻ hành động ngang hàng** mỗi thẻ một màu feature (violet/blue/orange) → card phase → card XP. Người học phải tự chọn "engine" trước khi học được (UX-01/UI-04/UI-06).

**Sau:**

```
Greeting (page header)
→ ContinueLearning        WEITERLERNEN · B1 → "Công việc và nghề nghiệp" (Arbeit und Beruf)
                          [▇▇▇▇▁▁] 60% · 3/5 bài · [ Weiterlernen → ] · Tiếp tục học
→ Heute                   4 việc hôm nay dạng danh sách, surface trung tính
→ Streak · XP             một hàng nhỏ, XP đứng cuối
→ Lernweg preview         node hiện tại + 2 node kế + 2/5 chặng · 40%
```

- **CTA filled duy nhất** trong viewport đầu (đo runtime: `filledCtaCount: 1`), trỏ đúng node đang học dở `/v2/student/learn/103`.
- **Stat strip bị giải thể.** "Độ chính xác"/"từ đã thuộc" là chỉ số tiến bộ → thuộc Fortschritt (S-10); vẫn tới được qua `/v2/student/stats` trong local nav Fortschritt. Khối `phase` cũng chuyển sang Fortschritt, không nhân bản.
- **Microcopy song ngữ** theo mẫu handoff §20: nút Đức `Weiterlernen`, dòng Việt `Tiếp tục học` ngay dưới; tiêu đề chương tiếng Việt trước, tiếng Đức là dòng ngữ cảnh có `lang="de"`.
- **Guardrail dữ liệu (P4-D2):** mọi con số có nguồn thật — `/roadmap/me` (node, tiến độ chương, % lộ trình), `/today/me` (việc hôm nay, streak), `/xp/me` (XP). **Không** vẽ CEFR % tổng hợp. `weeklyGoal` chưa có nguồn canonical nên KHÔNG hiển thị.
- Mỗi khối tự chịu lỗi riêng (`Promise.allSettled`); chỉ báo lỗi toàn màn khi cả 4 nguồn cùng hỏng.

## 2. S-03 — Lernweg: một mental model

**Trước:** ba tab ngang hàng `Cây · Bài học · Giai đoạn`; mỗi node trong list có 3–4 badge (trạng thái, CEFR, XP) + **hai** CTA ngang nhau (Học / Luyện); node khoá chỉ có ổ khoá.

**Sau (P4-D6):**

- **Cây là representation chính trên desktop**; `Danh sách` là **bản thay thế accessible của cùng dữ liệu** (`GET /roadmap/me`) chứ không phải mental model thứ hai — trình bày bằng segmented `Cây | Danh sách`, không phải tab ngang hàng.
- **Tab "Giai đoạn" bị gỡ**; bối cảnh phase hấp thụ vào header: *"Giai đoạn hiện tại: Sản sinh"* + tiến độ lộ trình `40% · 2/5 chặng` bên phải.
- **Node giảm mật độ:** đúng **1 badge** trạng thái + **1 CTA chính** (`Học` / `Học lại`) + hành động phụ im lặng (`Luyện 4 kỹ năng`); CEFR và tiêu đề Đức gộp một dòng meta.
- **Node khoá nói điều kiện mở bằng câu chữ:** *"Hoàn thành «Công việc và nghề nghiệp» để mở chặng này."* — suy từ thứ tự thật của lộ trình, không bịa trường dữ liệu backend không có.
- **Mobile (P4-D4):** mặc định list-first và **không mount canvas cây**; phía trên là **compact journey overview** (node hiện tại + 2 node kế, có nhãn trạng thái) nên mobile vẫn giữ visual signature, không thành danh sách generic.

## 3. File đã chạm

**Mới (6):** `src/lib/learning/currentNode.ts` · `components/learning/{ContinueLearning,TodayList,HabitStrip,JourneyPreview,NodeList}.tsx`
**Test mới (2):** `src/__tests__/currentNode.test.ts` · `src/test/components/GaLearningComponents.test.tsx`
**Viết lại (2):** `app/v2/student/dashboard/page.tsx` · `app/v2/student/roadmap/page.tsx`
**Khác:** `messages/v2/student.{vi,en,de}.json` (+31 khoá × 3) · `design-token-baseline.json` (chốt mức thấp hơn) · `.gitignore` (evidence)

**KHÔNG chạm:** `components/roadmap-tree/**` (Lernbaum đang mid-flight — xem §5), backend, API, native, legacy.

## 4. Kiểm chứng

| Check | Kết quả |
|---|---|
| Unit/component test | **543/543 PASS** (55 file) — +28 test mới |
| `tsc --noEmit` | PASS |
| ESLint | **23** warning (giảm 1 so với baseline 24; 0 mới) |
| `check:design-tokens` | **debt giảm 41 → 2.397**, baseline đã chốt mức thấp hơn; 0 violation mới |
| `check:i18n` | 3.203 khoá × 3 locale in sync |
| `next build` | exit 0 (known: `MISSING_MESSAGE: pricing.plans.FREE.badge (vi)` ở legacy `/student/pricing`) |

**Đo runtime với API stub** (`docs/wave1-s02-s03/measurements.json`):
- Heute 1440: `filledCtaCount: 1` · CTA `Weiterlernen` → `/v2/student/learn/103` · H2 "Công việc và nghề nghiệp" · progress `aria-valuenow=60` · thứ tự section `continue → today → habit → journey` · **không có stat strip**.
- Heute 390: cùng thứ tự dọc, **không tràn ngang**.
- Lernweg 1440: `Cây` (selected) | `Danh sách` — đúng **2** lựa chọn, không còn 3 tab; cây render.
- Lernweg 390: mặc định `Danh sách`, có compact overview, node khoá hiện câu điều kiện mở, **không tràn ngang**.

## 5. Việc còn lại / điểm cần biết

| # | Vấn đề | Trạng thái |
|---|---|---|
| A | **Panel node của cây vẫn có 4 nút kỹ năng 4 màu khác nhau** (Nghe/Đọc/Nói/Viết — feature colors, UI-06) và 4 CTA ngang hàng. Đây là `components/roadmap-tree/TreeNodePanel.tsx` thuộc mảng **Lernbaum đang mid-flight** (L3c → L2 → L4, PR #376). | **Cố ý chưa chạm** — plan S-03 §Risk yêu cầu hợp nhất Lernbaum trước khi sửa cùng file. Cần hợp nhất rồi mới áp contract "1 CTA chính". |
| B | Local nav Lernen vẫn 10 mục phẳng (điểm C của checkpoint trước). | Chưa gom nhóm `Bibliothek`/`Entdecken` — đề xuất làm cùng đợt hợp nhất Lernbaum ở A |
| C | Sidebar còn footer avatar + Đăng xuất trùng với account menu (điểm B checkpoint trước). | Chưa gộp — chờ owner quyết |
| D | Gate 1 của Wave 1 (first-click ≥80% chọn ContinueLearning · task "tìm node kế tiếp" ≥90% · analytics map cũ→mới) | Chưa chạy — cần người dùng thật |
| E | Verification dùng **API stub** vì máy local không có backend | Bố cục/hierarchy/state đã chứng minh được; số liệu thật cần QA trên prod sau deploy |
