# Hệ biểu tượng web (Galerie)

Đọc file này trước khi thêm hoặc đổi một icon trong `frontend/src` (khu `/v2` và trang công khai Galerie).
Chốt 07/11/2026 sau đợt rà toàn web (bảng rà soát: `plans/2026-11-07-ra-soat-icon-web.md`, local).
Mobile có bộ riêng: `mobile/GALERIE_GLYPHS.md`.

## 1. Bốn loại icon, bốn chỗ

| Loại | Dùng gì | Ví dụ |
|---|---|---|
| **Điều khiển** (mũi tên, đóng, tick trong nút, phát/dừng, gửi, sao chép, tìm, thêm/bớt, sửa, xoá, spinner) | Lucide trần `lucide-react` 0.487, hoặc `GaIcon` khi tên đến từ dữ liệu | `<ArrowLeft size={15} aria-hidden />`, `<Loader2 className="ga-spin" />` |
| **Nhận diện** (một phần/tính năng/kỹ năng/loại; đầu thẻ, ô số liệu, trạng thái trống, ô lỗi, hàng danh sách, ô chế độ, hero) | Ô `GaGlyph` | `<GaGlyph icon={Headphones} />`, `<GaGlyph name="error" tone="red" size="lg" />` |
| **Điều hướng** học viên/giáo viên | `GaNavIcon` → glyph thương hiệu `GaGlyphMark` (bộ chung với mobile) khi `nav.ts` khai `glyph`, còn lại `GaIcon` | admin, trung tâm: chỉ Lucide |
| **Hình Lucide không có** | Glyph nét tự vẽ trong `src/components/ui-v2/glyphs/` | `SpeakAi`, `TreeBud`, `TreeNub` |

Emoji không bao giờ là icon giao diện (QLT-16). Emoji backend (`skill_tree_nodes.emoji`, huy hiệu) đi qua
`GaGlyph emoji=…` → `emojiIconMap`. Ký tự kiểu ✓ ✗ ▲ ● ⏱ ▾ → cũng không: dùng icon.

## 2. Luật

- **Nét 1,9 cho mọi icon.** `galerie.css` ép `.ga-scope svg.lucide, .ga-scope svg.ga-line-glyph { stroke-width: 1.9 }`, nên
  không cần (và đừng) truyền `strokeWidth`. Muốn nét khác là dấu hiệu đang vẽ minh hoạ, không phải icon.
- **Màu chỉ token `ga-*`** (`text-ga-muted`, `text-ga-navy`, `text-ga-card`, `bg-ga-red-soft`…). Không hex, không `text-amber-500`,
  không `text-white` (dùng `text-ga-card`). Không ghép `${'var(--ga-x)'}1a` — đó không phải CSS hợp lệ, nền biến mất.
- **Eyebrow/cap** (`GaCap`, `text-ga-eyebrow uppercase`): chữ xám trơn, không icon, không vàng/tím riêng.
- **Một ô = một nghĩa.** Hai mục cạnh nhau (một menu, một danh sách loại) không dùng chung một hình.
- Icon trang trí cạnh chữ: `aria-hidden` (GaGlyph, GaIcon, glyph tự vẽ mặc định đã ẩn). Icon là thông tin duy nhất: truyền `title`.
  Nút chỉ có icon: `aria-label` trên nút.

## 3. `GaGlyph` — ô nhận diện

```tsx
import { GaGlyph } from '@/components/ui-v2'
<GaGlyph icon={BookOpen} />                       // md 36px, icon 18, navy
<GaGlyph icon={Lock} tone="plain" size="lg" />   // trạng thái khoá / trống
<GaGlyph icon={SpeakAi} size="lg" />              // glyph tự vẽ dùng y như Lucide
<GaGlyph name="repeat" tone="green" size="sm" />  // tên trong bảng GaIcon
```

| Cỡ | Ô | Icon | Dùng |
|---|---|---|---|
| `sm` | 28px | 15 | hàng danh sách dày, đầu thẻ nhỏ, chuông thông báo |
| `md` | 36px | 18 | hàng danh sách, đầu thẻ, ô chế độ nhỏ |
| `lg` | 48px | 24 | trạng thái trống, ô lỗi trang, hero, ô chế độ lớn |

| Tông | Nền / icon | Khi nào |
|---|---|---|
| `navy` (mặc định) | `ga-navy-soft` / `ga-navy` | nhận diện thường |
| `plain` | `ga-side-active` / `ga-muted` | trống, khoá, phụ, chỉ để biết |
| `yellow` | `ga-yellow` / `ga-ink` | điểm nhấn DUY NHẤT của màn (việc hôm nay, kết quả) |
| `ink` | `ga-ink` / `ga-card` | đang chọn, trên nền mực |
| `green` / `red` | soft / đậm | đạt / lỗi, huỷ |
| `orange` | `ga-orange-soft` / `ga-orange` | cảnh báo không phải lỗi (lời mời hết hạn) |
| `accent` | màu vai trò soft / `ga-ink` | hiếm; khi cần màu vai trò |

`EmptyState`, `ErrorBanner` (biến thể page), lỗi route, chuông/toast/trang thông báo đã dùng `GaGlyph`. Ô `Glyph` của
Luyện thi (`components/exam/today/visual.tsx`) là `GaGlyph`.

## 4. Thêm glyph tự vẽ

1. Chắc Lucide 0.487 không có: `node -e "console.log(Object.keys(require('lucide-react')).filter(k=>/Tên/i.test(k)))"`.
2. Vẽ trên lưới 24, hình trong 2–22, chỉ nét (không tô), góc và đầu nét tròn — đứng cạnh Lucide không được lộ.
3. Thêm vào `src/components/ui-v2/glyphs/index.tsx` bằng `createGlyph('TenTheoNghia', <>…</>)`, ghi chỗ dùng trong chú thích,
   thêm vào `GA_LINE_GLYPHS`.
4. `npx vitest run src/test/components/iconSystem.test.tsx` kiểm lưới, nét, `currentColor`, không tô.

| Glyph | Nghĩa | Dùng ở |
|---|---|---|
| `SpeakAi` | người nói AI (bong bóng thoại + sóng âm) | đầu tóm tắt buổi nói, avatar lượt AI ở lịch sử luyện nói |
| `TreeBud` | nụ = bài đã mở | chú giải cây lộ trình |
| `TreeNub` | chấm khoá = bài chưa mở | chú giải cây lộ trình |

## 5. Bẫy đã gặp

- `background: \`${tone}1a\`` với `tone = 'var(--ga-orange)'` → CSS hỏng, trình duyệt bỏ im lặng: icon trôi không ô
  (chuông thông báo, hub Luyện nói đến 07/11/2026).
- `GaIcon` gặp tên không có trong bảng thì vẽ `Circle` rỗng — thêm khoá vào `GaIcon.tsx` cùng lúc thêm chỗ dùng
  (`iconSystem.test.tsx` kiểm loại thông báo và thanh bên admin).
- `PenTool` là bút vẽ vector của phần mềm đồ hoạ, không phải "viết": dùng `PenLine`.
- Test mock `@/components/ui-v2` phải có `GaGlyph` khi component dùng nó.
- Trang công khai ngoài `.ga-scope` (`certificate`, `teachers`, `payment/success`) chưa chuyển Galerie: token `ga-*` không có
  hiệu lực ở đó — đồng bộ icon phải đi cùng việc chuyển cả trang. `luyen-thi`, `luyen-thi/[slug]`, `free-grade`, `report` đã
  chuyển (icon đợt B, 09/11/2026) và nằm trong phạm vi `check:design-tokens` + `src/test/publicGaleriePages.test.ts`.
  `ShareButtons`/`GradeScore` (`components/marketing`) dùng token `ga-*`, chỉ đặt trong trang có `.ga-scope`.
