# Bộ biểu tượng Galerie (mobile)

Tài liệu tự đứng cho bộ biểu tượng nhận diện của app iOS/Android. Đọc file này là đủ để **thêm glyph mới**, **thay một icon**, hoặc **hiểu vì sao** một chỗ dùng `GaGlyph` còn chỗ khác vẫn dùng Lucide — không cần memory của phiên trước.

## 1. Vì sao có bộ này

- Trước 06/09/2026 mobile dùng Lucide cho mọi icon và một số emoji giao diện (🔥 chuỗi học, 🎉, 📖…). Emoji do hệ điều hành vẽ nên mỗi máy một kiểu, luôn nhiều màu, không theo theme; Lucide là bộ chung chung, không mang ngôn ngữ thương hiệu.
- Owner chốt (06/09/2026): **biểu tượng nhận diện** (tab, ô tính năng, checklist, trạng thái, chủ đề lộ trình, hồ sơ) dùng bộ glyph riêng theo ngôn ngữ Galerie; **Lucide chỉ còn cho điều khiển** (mũi tên, đóng, tick, mắt, tìm kiếm, gửi, thêm/bớt, sao chép, tệp đính kèm, phát/tạm dừng); **pictogram từ vựng** (130 danh từ trong `components/ui/vocabIcons.tsx`) giữ nguyên vì là nội dung bài học.
- Bản thiết kế đã duyệt: canvas "Bộ biểu tượng Galerie" (Claude Design, artifact `4ad141fe-3eca-4a01-8070-b2de5171bc09`).

## 2. Luật hình học (mọi glyph đều tuân theo — test tự kiểm)

| Luật | Giá trị |
|---|---|
| Lưới | `viewBox 0 0 24 24`; hình nằm trong 1,5–22,5 (chừa mép) |
| Nét mực | `stroke-width 1.75`, `stroke-linecap square`, `stroke-linejoin miter` — góc nhọn, cùng ngữ pháp chữ D của logo (`BrandMark`) |
| Mảng vàng | **Đúng MỘT** khối phẳng mỗi glyph (thường 3×3), là motif ô vàng của thương hiệu — điểm nhấn, không tô màu |
| Đỏ | Chỉ cho hành động huỷ/xoá (`xoa`), thay chỗ mảng vàng |
| Thứ tự vẽ | vàng → đỏ → nét mực (nét không bao giờ bị mảng màu che) |
| Cỡ dùng | 16 chip · 20 trong ô 40 px · 24 tab bar · 32 hero/hero card |
| Nền tối | nét đổi sang paper (`ink="onInk"`), mảng vàng giữ nguyên |
| Đặt tên | chữ thường, không dấu, `t_` cho chủ đề lộ trình (`t_cafe`). Tên là khoá JSON và là kiểu `GlyphName` — **không đổi tên** glyph đang dùng |

`lib/__tests__/galerieGlyphs.test.ts` kiểm tất cả luật trên cho từng glyph (một mảng màu, hình nằm trong lưới, tên hợp lệ, chỉ `xoa` dùng đỏ).

## 3. Code nằm ở đâu

| File | Vai trò |
|---|---|
| `lib/galerieGlyphs.json` | **Nguồn dữ liệu duy nhất**: `{ tên: { label, ink[], gold[], red?[] } }`. Mỗi phần tử là chuỗi `d` của SVG path, hoặc `{"r":[x,y,w,h]}` (hình chữ nhật), hoặc `{"c":[cx,cy,r]}` (vòng tròn). |
| `lib/galerieGlyphs.ts` | Kiểu `GlyphName`, `GlyphDef`, `GlyphShape`; `GLYPHS`, `GLYPH_NAMES`, `isGlyphName()`. |
| `components/ui/GaGlyph.tsx` | `GaGlyph` (vẽ bằng react-native-svg) và `GaGlyphTile` (ô vuông bo 4 px chứa glyph, theo tông). |
| `components/ui/ListRow · EmptyState · StatTile · IconButton · Pill · Button` | Nhận prop `glyph` (ưu tiên hơn `icon` Lucide). |
| `components/ui/TabBar.tsx` | `ICONS` = tên glyph 4 tab. |
| `components/ui/TopicGlyphTile.tsx` | `GLYPH_ICON: Record<GlyphKey, GlyphName>` — chủ đề lộ trình → glyph. |
| `lib/skillExercises.ts` | `SKILL_GLYPH` (Nghe/Nói/Đọc/Viết) thay bộ emoji cũ. |
| `app/(student)/notifications.tsx` | `ICON_BY_KEY` loại thông báo → glyph. |
| `components/speaking/CompanionSelect.tsx` | `MODES`, `GROUP_ICONS` (chế độ luyện nói, nhóm ngành). |
| `scripts/glyph-sheet.mjs` | Xuất bảng kiểm HTML mọi glyph (96 px + 24 px, nền giấy và nền mực). |

## 4. Cách dùng

```tsx
import { GaGlyph, GaGlyphTile, ListRow, EmptyState } from '@/components/ui'

<GaGlyph name="speaking" size={20} />                       // nét mực, mảng vàng — mặc định
<GaGlyph name="chuoi" size={30} ink="accent" />             // trên thẻ mực: nét vàng
<GaGlyph name="speaking" ink="onAccent" gold="ink" />         // trên nút VÀNG: mảng vàng trùng màu nét
<GaGlyph name="hoc" ink="onInk" />                            // trên nền mực: nét màu giấy
<GaGlyphTile name="srs" tone="accent" size={40} />           // ô 40 px nền vàng mờ (hàng danh sách, ô tính năng)
<GaGlyphTile name="xoa" tone="danger" />                      // ô đỏ mờ
<ListRow glyph="matkhau" iconTone="neutral" title="Đổi mật khẩu" />
<EmptyState glyph="thongbao" title="Chưa có thông báo" />
```

Vai trò màu nét (`ink`): `primary` (mặc định) · `secondary` · `muted` · `faint` · `accent` · `accentText` · `brand` · `success` · `danger` · `info` · `onAccent` · `onInk`. Mảng vàng (`gold`): `accent` (mặc định) · `ink` (trùng màu nét, dùng trên nền vàng) · `success` · `danger` · `info` · `none`. Cần mã màu tuỳ ý (ô chủ đề có tông riêng): `inkColor` / `goldColor`.

Quy ước theo ngữ cảnh:

| Ngữ cảnh | ink | gold |
|---|---|---|
| Ô 40 px nền vàng mờ / trung tính (mặc định) | `primary` | `accent` |
| Thẻ mực (hero, streak) | `onInk` (hoặc `accent` cho ngọn lửa) | `accent` |
| Nút vàng (`Button variant="yellow"`, nút ghi âm) | `onAccent` | `ink` |
| Tông success / danger / info | cùng vai trò | cùng vai trò |
| Tab đang chọn | `accentText` | `accent` |
| `hoanthanh` (ô vàng + tick) | `onAccent` trên nền success/accent | **không bao giờ `ink`** (mảng là nền của dấu tick) |

Accessibility: không truyền `accessibilityLabel` thì glyph ẩn với screen reader (chữ cạnh bên đã nói đủ); truyền khi glyph là thông tin duy nhất.

## 5. Thêm một glyph mới (5 bước)

1. **Vẽ trên lưới 24** — nét thẳng, góc nhọn, hình nằm trong 1,5–22,5. Dùng path (`M… H… V… A…`), rect, circle. Chọn **một** chỗ đặt mảng vàng 3×3 có nghĩa (cửa của ngôi nhà, đèn của mic, con dấu trên giấy…). Nếu là hành động huỷ: dùng `red` thay `gold`.
2. **Thêm vào `lib/galerieGlyphs.json`** với `label` tiếng Việt:
   ```json
   "vidu": { "label": "Ví dụ", "ink": ["M4 4 H20 V20 H4 Z", {"c": [12, 12, 4]}], "gold": [{"r": [10.5, 10.5, 3, 3]}] }
   ```
3. **Soi hình**: `node scripts/glyph-sheet.mjs` rồi mở file HTML in ra (glyph hiện ở 96 px và 24 px, trên giấy và trên mực). Sửa tới khi đọc được ở 20 px.
4. **Chạy test**: `npx jest lib/__tests__/galerieGlyphs.test.ts` (kiểm luật một mảng màu, biên lưới, tên) và `npx tsc --noEmit -p .`.
5. **Dùng**: `<GaGlyph name="vidu" />` — `GlyphName` tự cập nhật từ khoá JSON nên gõ sai tên là lỗi biên dịch. Cập nhật bảng ở mục 7 nếu glyph thay cho một chỗ cụ thể.

Thay một icon đang là Lucide: nếu là **điều khiển** (chevron, đóng, tick…) → giữ Lucide qua `Icon`; nếu là **nhận diện** → thêm glyph theo 5 bước trên. Đừng vẽ lại pictogram từ vựng trừ khi owner yêu cầu.

## 6. Bẫy đã trả giá

- **RNSVG bỏ qua `pointerEvents="none"` trên Fabric** — SVG nằm trên vùng cần chạm phải bọc trong `View pointerEvents="none"` (đã dính ở lớp phủ spotlight tour).
- Gold vẽ trước, nét sau; đảo lại là mảng vàng che dấu tick của `hoanthanh`.
- `ink="accent"` (nét vàng) chỉ hợp trên nền mực; trên giấy/ô vàng mờ dùng `primary`.
- Không import `Map` từ Lucide trong file có `new Map()` — tên trùng với lớp `Map` của JS.
- Test import `studentClassesApi`/màn dùng expo-file-system phải mock `expo-file-system/legacy`.
- Đổi tên khoá JSON = phá mọi chỗ dùng; thêm khoá mới thay vì đổi tên.

## 7. Danh sách glyph hiện có (61)

**Thanh tab**

| Tên | Nhãn | Đang dùng ở |
|---|---|---|
| `heute` | Heute | C/ui/TabBar.tsx |
| `hoc` | Học | C/guide/StarterChecklist.tsx, C/speaking/CompanionSelect.tsx, C/speaking/ConversationSummary.tsx, C/ui/TabBar. |
| `speaking` | Speaking | C/AiConsentSheet.tsx, C/guide/StarterChecklist.tsx, C/speaking/CompanionSelect.tsx, C/ui/TabBar.tsx, _layout.t |
| `hoso` | Hồ sơ | C/ui/TabBar.tsx, profile.tsx |

**Tính năng và hub**

| Tên | Nhãn | Đang dùng ở |
|---|---|---|
| `srs` | Ôn tập SRS | C/guide/StarterChecklist.tsx, _layout.tsx, learn.tsx, notifications.tsx, vocabulary.tsx |
| `lernweg` | Lộ trình | C/guide/StarterChecklist.tsx, _layout.tsx, auth/first-sentence.tsx, index.tsx, learn.tsx, upgrade.tsx |
| `tuvung` | Từ vựng | learn.tsx, vocabulary.tsx |
| `thithu` | Thi thử | exam.tsx, learn.tsx, node-practice.tsx, notifications.tsx, skill-practice.tsx, stats.tsx, upgrade.tsx |
| `nguphap` | Ngữ pháp | C/ui/TopicGlyphTile.tsx, learn.tsx |
| `hoithoai` | Hội thoại | C/AiConsentSheet.tsx, C/speaking/CompanionSelect.tsx, assignments/[id].tsx, class-chat/[classId].tsx, classes/ |
| `sualoi` | Sửa lỗi | C/MaintenanceOverlay.tsx, C/home/TodayTasks.tsx, error-repair.tsx, notifications.tsx, upgrade.tsx |
| `video` | Video bài giảng | grammar.tsx, video-lesson.tsx, vocabulary.tsx |
| `lophoc` | Lớp học | auth/onboarding.tsx, classes/[id].tsx, classes/index.tsx, messages/index.tsx, profile.tsx |
| `thongbao` | Thông báo | C/guide/ReminderSheet.tsx, C/guide/StarterChecklist.tsx, auth/onboarding.tsx, index.tsx, notifications.tsx, pr |
| `thongke` | Thống kê | C/speaking/ConversationSummary.tsx, C/speaking/SessionSummary.tsx, classes/[id].tsx, notifications.tsx, profil |
| `phongvan` | Phỏng vấn · Công việc | C/speaking/CompanionSelect.tsx, C/ui/TopicGlyphTile.tsx, auth/onboarding.tsx |
| `thinoi` | Thi nói · Huy hiệu | C/speaking/CompanionSelect.tsx, auth/onboarding.tsx, lernweg.tsx, notifications.tsx, speaking-exam-result.tsx, |
| `baigiao` | Bài tập được giao | auth/onboarding.tsx, classes/[id].tsx, classes/index.tsx, node-practice.tsx, notifications.tsx |
| `tinnhan` | Tin nhắn | auth/forgot-password.tsx |
| `lich` | Lịch | class-schedule/[classId].tsx, classes/[id].tsx, notifications.tsx |
| `huongdan` | Hướng dẫn | guide.tsx, profile.tsx |

**Hồ sơ và tài khoản**

| Tên | Nhãn | Đang dùng ở |
|---|---|---|
| `matkhau` | Mật khẩu | auth/reset-password.tsx, profile.tsx, settings/password.tsx |
| `antoan` | An toàn & chặn | profile.tsx, settings/blocked.tsx |
| `ngonngu` | Ngôn ngữ | C/speaking/CompanionSelect.tsx, profile.tsx |
| `goipro` | Gói PRO | index.tsx, profile.tsx, upgrade.tsx |
| `thanhtoan` | Thanh toán | profile.tsx |
| `hoantien` | Hoàn tiền | profile.tsx |
| `dulieuai` | Dữ liệu & AI | C/speaking/ConversationSummary.tsx, classes/[id].tsx, classes/index.tsx, node.tsx, profile.tsx |
| `khoa` | Khoá · Bảo mật | C/MinorAudioBlockedSheet.tsx, C/speaking/CompanionSelect.tsx, exam.tsx, grammar.tsx, lernweg.tsx, node.tsx, profile.tsx, settings/profile.ts |
| `dieukhoan` | Điều khoản | profile.tsx |
| `dangxuat` | Đăng xuất | profile.tsx |
| `xoa` | Xoá tài khoản | profile.tsx |
| `laptop` | Máy tính · IT | C/speaking/CompanionSelect.tsx, auth/onboarding.tsx |
| `banhrang` | Bánh răng · Kỹ thuật | C/speaking/CompanionSelect.tsx, auth/onboarding.tsx |
| `camera` | Máy ảnh | C/AiConsentSheet.tsx, lib/vocabGlyph.ts |

**Trạng thái, kỹ năng, huy hiệu**

| Tên | Nhãn | Đang dùng ở |
|---|---|---|
| `chuoi` | Chuỗi học | auth/first-sentence.tsx, index.tsx, notifications.tsx, stats.tsx, weekly-speaking.tsx |
| `xp` | XP | index.tsx, node.tsx, upgrade.tsx |
| `capdo` | Cấp độ | index.tsx, profile.tsx, stats.tsx |
| `hoanthanh` | Hoàn thành | C/guide/StarterChecklist.tsx, C/speaking/ConversationSummary.tsx, C/speaking/SessionSummary.tsx, assignments/[ |
| `danghoc` | Đang học | classes/[id].tsx |
| `muctieu` | Mục tiêu | C/speaking/ConversationSummary.tsx, C/speaking/SessionSummary.tsx, stats.tsx |
| `canhbao` | Cảnh báo | C/speaking/ConversationSummary.tsx, C/speaking/SessionSummary.tsx, C/ui/ErrorState.tsx, assignments/[id].tsx,  |
| `thoigian` | Thời gian | C/ui/TopicGlyphTile.tsx, assignments/[id].tsx, auth/onboarding.tsx, class-schedule/[classId].tsx, classes/[id] |
| `nghe` | Nghe | lib/skillExercises.ts, stats.tsx |
| `noi` | Nói | C/guide/StarterChecklist.tsx, C/home/TodayTasks.tsx, lib/skillExercises.ts, speaking-exam-weakness.tsx, stats. |
| `doc` | Đọc | exam-attempt.tsx, lib/skillExercises.ts, node.tsx, stats.tsx |
| `viet` | Viết | lib/skillExercises.ts, node-practice.tsx, stats.tsx |

**Chủ đề lộ trình**

| Tên | Nhãn | Đang dùng ở |
|---|---|---|
| `t_cafe` | Quán cà phê | C/ui/TopicGlyphTile.tsx |
| `t_food` | Ăn uống | C/speaking/CompanionSelect.tsx, C/ui/TopicGlyphTile.tsx, auth/onboarding.tsx |
| `t_travel` | Đi lại | C/ui/TopicGlyphTile.tsx, auth/onboarding.tsx |
| `t_greeting` | Chào hỏi | C/ui/TopicGlyphTile.tsx |
| `t_family` | Gia đình | C/ui/TopicGlyphTile.tsx |
| `t_numbers` | Số đếm | C/ui/TopicGlyphTile.tsx |
| `t_shopping` | Mua sắm | C/speaking/CompanionSelect.tsx, C/ui/TopicGlyphTile.tsx, auth/onboarding.tsx |
| `t_home` | Nhà ở | C/ui/TopicGlyphTile.tsx, auth/onboarding.tsx |
| `t_health` | Sức khoẻ | C/speaking/CompanionSelect.tsx, C/ui/TopicGlyphTile.tsx, auth/onboarding.tsx |
| `t_culture` | Văn hoá | C/ui/TopicGlyphTile.tsx |
| `t_weather` | Thời tiết | C/ui/TopicGlyphTile.tsx |
| `t_communication` | Liên lạc | C/ui/TopicGlyphTile.tsx |
| `t_hobby` | Sở thích | C/ui/TopicGlyphTile.tsx, auth/onboarding.tsx |
| `t_exam` | Thi cử | C/ui/TopicGlyphTile.tsx, auth/onboarding.tsx, classes/[id].tsx, notifications.tsx |

## 8. Checklist khi mở PR đụng bộ glyph

- [ ] `npx tsc --noEmit -p .` sạch; `npx jest` xanh (kể cả `galerieGlyphs.test.ts`).
- [ ] `node scripts/glyph-sheet.mjs` đã soi glyph mới ở 24 px.
- [ ] Không có emoji giao diện mới (emoji chỉ ở avatar mentor/persona, cờ, tranh nhân vật, phản ứng của persona).
- [ ] Không có import Lucide mới cho biểu tượng nhận diện.
- [ ] Bảng mục 7 cập nhật; SRS (`TAI_LIEU_DAC_TA_SAN_PHAM/chi-tiet/`) thêm ca nếu đổi hành vi hiển thị.
- [ ] Thuần JS → OTA được (fingerprint không đổi).
