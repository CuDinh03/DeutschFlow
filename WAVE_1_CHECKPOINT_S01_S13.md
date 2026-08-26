# Wave 1 — S-01 (Navigation & role shells) + S-13 (Mobile navigation)

> **Trạng thái:** ✅ checkpoint đã được owner duyệt · **đã commit `dfe80764`**.
> **Tiếp theo:** S-02 + S-03 đã implemented — xem `WAVE_1_S02_S03_REPORT.md` (chưa commit).
> **Ngày:** 26/08/2026 · Gate 0 đã được owner approve (kèm exception CLS/LCP) và Wave 0 đã commit `5a9b6127`.
> **Evidence:** `docs/wave1-s01-s13/` (8 ảnh + `measurements.json`, chụp từ production build).

---

## 1. Kết quả — điều gì đã đổi

**Persistent navigation của học viên: ~30 destination → đúng 5 area** (IA-D1)

```
Heute (Hôm nay) · Lernen (Học) · Sprechen (Luyện nói) · Prüfung (Luyện thi) · Fortschritt (Tiến bộ)
```

Không route nào bị xoá, không URL nào đổi (IA-D8). Destination cũ đi về đúng chỗ:
- **Cấp 2 (GaLocalNav)** — thanh điều hướng ngang dưới top bar, đổi theo area đang mở. Ví dụ Lernen: Lộ trình · Ôn tập (SRS) · Sổ lỗi · Từ vựng · Ngữ pháp · Bài tập bổ trợ · Bài học · Lớp của tôi · Tin tức Đức · Trò chơi.
- **Utility (account menu + topbar)** — Hồ sơ · Học phí · Hướng dẫn · Trợ giúp · Đăng xuất; Tin nhắn thành icon inbox trên topbar (IA-D3).

**AI Interview có entry thật** (IA-D4): trước Wave 1, `/v2/student/interviews` tồn tại nhưng **không có mục nào trong `nav.ts`** — giờ nó đứng **đầu** local nav của Sprechen.

**Teacher: 5 nhóm theo việc hằng ngày** (IA-D6) `Heute · Klassen · Bewerten · Materialien · Berichte`; công cụ AI trở thành phương thức tạo trong Materialien, không còn là product area.

**Mobile web (<768px): bottom nav** (S-13, IA-D7) — student 5 ô, teacher 4 ô + `Mehr` (mở ngăn kéo chứa Berichte + tài khoản). Ẩn **hoàn toàn** trong route toàn màn hình. Dưới `md`, ngăn kéo bỏ danh sách area (bottom nav đã phủ) và chỉ còn utility.

## 2. File đã chạm (chỉ Wave 1; chưa commit)

**Mới (4):** `GaLocalNav.tsx` · `GaBottomNav.tsx` · `GaAccountMenu.tsx` · test `src/__tests__/navAreaModel.test.ts`, `src/test/components/GaAreaNavigation.test.tsx`
**Sửa (5):** `nav.ts` (thêm mô hình `AreaNav`/`RoleAreas` + `studentAreas`/`teacherAreas` + `resolveArea`/`isUnder`/`isImmersiveRoute`; **giữ nguyên** `ROLE_NAV` legacy cho admin/org) · `GaSidebar.tsx` · `GaTopBar.tsx` · `GaShell.tsx` · `index.ts`
**i18n:** `chrome.{vi,en,de}.json` — `nav.areas` (11 khoá), `nav.areaHelper` (11), `nav.items` +2, `ui` +5
**Khác:** `.gitignore` (mở exception hẹp cho `docs/wave1-s01-s13/`), evidence

Không chạm: page/screen nào, `globals.css` legacy, backend, native. Không xoá component legacy. Không đụng thay đổi đang dở của owner.

## 3. Kiểm chứng

| Check | Kết quả |
|---|---|
| Unit/component test | **515/515 PASS** (53 file) — +48 test mới của Wave 1 |
| `tsc --noEmit` | PASS |
| ESLint | 24 warning = đúng baseline pre-existing, **0 mới** |
| `check:design-tokens` | PASS — ratchet **đã bắt 4 violation mới của chính đợt này** (text-[10px]/[13px]/[14.5px]) → đã vá về `text-ga-*`, hiện 0 violation mới |
| `check:i18n` | 3.159 khoá × 3 locale in sync |
| `next build` | exit 0 (vẫn known: `MISSING_MESSAGE: pricing.plans.FREE.badge (vi)` ở legacy `/student/pricing`) |

**Test đáng chú ý nhất — "0 orphan route":** `navAreaModel.test.ts` đọc cây route thật trong `src/app/v2/**` rồi khẳng định **mọi** route `/v2/student/**` và `/v2/teacher/**` đều thuộc một area hoặc utility đã khai báo. Đây là lưới an toàn chống mất destination khi thu gọn nav — nó sẽ fail nếu ai đó thêm route mới mà quên gắn vào area.

**Đo runtime (`docs/wave1-s01-s13/measurements.json`):**
- Sidebar student: đúng 5 area link + 3 utility link.
- Local nav Lernen: 10 link, mục đang mở có `aria-current="page"`.
- Bottom nav 390px: 5 ô, cao **62px** (≥44), **không tràn ngang**; teacher: `Heute·Klassen·Bewerten·Materialien·Mehr`.
- Route toàn màn hình (`/v2/student/mock-exam/run`): bottom nav **vắng mặt**.
- Account menu: portal có `.ga-scope` + `data-role="student"` + `--ga-accent: #ffcd00` (portal contract Wave 0 hoạt động đúng ở component mới).

## 4. Điểm cần owner quyết trước khi đi tiếp

| # | Vấn đề | Đề xuất |
|---|---|---|
| A | **Ô tìm kiếm trang trí trên topbar đã bị gỡ** cho student/teacher (IA §13.4: global search không phải nhu cầu learner; tìm kiếm thuộc từng màn thư viện). Admin/org giữ nguyên. | Giữ như đã làm |
| B | **Sidebar vẫn có footer avatar + Đăng xuất** trong khi topbar đã có account menu → hơi trùng. | Giữ ở đợt này (desktop tiện), gộp khi làm S-02 nếu owner muốn |
| C | **Local nav Lernen có 10 mục** → ở 1440 phải cuộn ngang. IA §5.3 gợi ý gom `Bibliothek`/`Entdecken` thành nhóm con. | Gom nhóm khi làm S-03 (Lernen là màn của S-03), không sửa lẻ bây giờ |
| D | `/v2/teacher/sessions` và `/v2/teacher/profile` là tàn dư v1 **đã không có trong nav từ trước** Wave 1; test ghi nhận là ngoại lệ đã biết. | Xử lý trong legacy retirement (Wave 5) |
| E | Endpoint text trong error UI của teacher (`/api/v2/teacher/grading/queue`) vẫn còn — thấy rõ trong ảnh `teacher-bewerten-390.png`. | Đúng lịch: thuộc S-12 (Wave 3) |

## 5. Chưa làm (đúng phạm vi checkpoint)

- **S-02 Heute** và **S-03 Lernen/Journey**: chưa bắt đầu.
- Chưa commit Wave 1 (chờ review).
- Chưa chạy first-click test / analytics mapping cũ→mới (Gate 1 của Wave 1, cần cả S-02/S-03 xong).
