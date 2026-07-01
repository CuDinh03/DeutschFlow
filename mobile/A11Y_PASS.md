# DeutschFlow Mobile — Accessibility Pass (Screen Reader)

> Hồ sơ công việc a11y screen-reader trên app Expo (`mobile/`). Hoàn thành **2026-06-29** trên nhánh `chore/ios-deploy-sdk54`.
> Nguồn gốc: các finding `[a11y]` trong `QA_SCREENS_AUDIT.md` (24 màn student) + mở rộng sang màn `(auth)`.

---

## 1. TL;DR

**Toàn bộ control tương tác trong `app/` giờ phơi `accessibilityRole` + `accessibilityLabel`** (+ `selected` / `disabled` / `expanded` state khi phù hợp) cho VoiceOver/TalkBack. Sweep xác nhận **0 `Pressable` thiếu role** ở bất kỳ màn nào (24 student + auth flow).

- **Phạm vi:** role/label/state trên các `Pressable` viết tay + chạm 44pt (iOS HIG) trên các chip nhỏ hơn 44pt.
- **Nguyên tắc:** **chỉ thêm (additive) — 0 thay đổi visual.** Không động vào reskin v2 "Galerie" vừa hoàn thành.
- **Cách làm:** tái dùng a11y có sẵn trong `IconButton` / `Card`; **không** extract primitive mới (tránh rủi ro vỡ reskin).
- **Verify:** `tsc` 0 lỗi · `jest` 18/18 · grep sweep 0 Pressable thiếu role.

Commits: `b11b76b4` (HIGH) · `aa042b2f` (MEDIUM sweep) · `d066a41a` (auth).

---

## 2. Vì sao additive thay vì extract shared primitive

`QA_SCREENS_AUDIT.md` khuyến nghị làm a11y **trong shared components** (extract `Chip`/`SelectableRow`, để `Pill` enforce 44pt) — đúng về DRY, nhưng audit được viết **trước** reskin v2. Lúc làm pass này, reskin đã xong 24/24 màn với inline style editorial. Extract primitive mới lúc này = phải khớp lại visual của 24 màn vừa style → rủi ro vỡ giao diện cao.

Đánh đổi đã chọn: **thêm thuộc tính a11y tại chỗ** (0 rủi ro visual), tái dùng `IconButton`/`Card` (vốn đã centralize role/label/state) **chỉ khi markup đã sẵn vừa**. Việc extract `SelectableChip`/`SelectableRow` để DRY lúc đó được hoãn — **nay đã làm xong** (2026-06-29) theo cách presentation-only giữ style ở caller (xem §7.2).

Nền tảng sẵn có (không cần sửa):
- **`IconButton`** — role `button`, `accessibilityLabel` **bắt buộc ở type-level**, hint/state, `hitSlop` mặc định 8 (icon 22pt → ≥44pt). Primitive chuẩn cho icon-only button.
- **`Card`** — nhận `accessibilityLabel`/`hint`/`disabled`, role `button` khi có `onPress`; `disabled` vừa announce vừa chặn handler.
- **`ListRow`** — pressable tự sinh label mặc định từ title/subtitle.

---

## 3. HIGH cluster — `b11b76b4`

6 file. Các finding HIGH `[a11y]` trong audit (đã re-verify với code **sau** reskin — vài cái reskin đã sửa một phần).

| Finding | Màn | Việc đã làm |
|---|---|---|
| **H3** | roadmap | Node `Card` truyền `accessibilityLabel` (`"{title}, ngày {n}, {trạng thái}"`) + `disabled={isLocked}`. Hàng locked giờ announce là **disabled button** (trước: drop `onPress` → là `View` trơ, không role; trạng thái chỉ thể hiện bằng màu/icon). |
| **H8** | speaking | role+label+state cho cả **6** icon-only control: resume-card, dismiss ✕, header close ✕, end/flag, **mic** (label động `Ghi âm` / `Dừng ghi âm` → trạng thái record không còn color-only), send. |
| **H11** | exam-attempt | Thêm `accessibilityLabel={label}` cho radio Choice. (role `radio` + `selected` state đã có sẵn từ reskin.) |
| **H15/H16** | video-lesson | role+label+`selected` cho 5 chip (level / Tới hạn / Hội thoại / topic) + nút export; thêm `hitSlop` để đạt **44pt** (chip vốn ~26–28pt cao). |
| **H19** | profile | role+label+hint cho nút **Xoá tài khoản** (destructive, hint mô tả tính vĩnh viễn). |
| **H20** | guide | role + `accessibilityState={{ expanded }}` cho accordion FAQ + hint. |

---

## 4. MEDIUM sweep — `aa042b2f`

11 màn student còn lại. Audit không liệt kê từng MEDIUM riêng → dùng grep sweep (`<Pressable` vs `accessibilityRole`) để tìm mọi Pressable viết tay còn thiếu role, rồi gán role/label/state theo mục đích control.

| Màn | Control |
|---|---|
| exam | Chip chọn cấp độ (role/label/`selected`) |
| grammar | Link kasus → video-lesson (role/label) |
| index (home) | Chuông thông báo (role + label kèm số chưa đọc) |
| node-practice | Hàng đáp án trắc nghiệm (role/label/`selected`/`disabled`) + nút "Xem đáp án" |
| notifications | Icon "đánh dấu tất cả đã đọc" (role/label/`disabled`) |
| settings/profile | Icon Lưu (role/label/`disabled`) |
| srs | Icon "Bắt đầu lại" (role/label) |
| vocabulary | Label cho filter chip + nút "đánh dấu đã thuộc" (role/label/`disabled`) |
| weekly-speaking | Nút "Ghi lại" + record/stop (role + label động) |
| classes | Backdrop dismiss của join-sheet (role) |
| profile | Chip XP/thống kê (role/label) |

---

## 5. Auth screens — `d066a41a`

Mở rộng ra flow `(auth)` (ngoài scope QA 24 màn student). Additive, 0 thay đổi visual.

- **login** — link "Quên mật khẩu", "Học thử miễn phí", "Đăng ký miễn phí" (role/label)
- **register** — link "Đăng nhập" (role/label)
- **onboarding** — option chọn loại học (role/label/`selected`) + option quiz quick-win của khách (role/label/`selected`/`disabled`)

→ **0 Pressable thiếu role trong toàn bộ `app/`.**

---

## 6. KeyboardAvoidingView (KAV) — đã xong từ trước, KHÔNG phải pass này

Audit liệt 4 finding KAV là HIGH (H12 node-practice, H22 classes join-sheet, H23 settings/profile, H25 assignments). **Cả 4 đã được sửa từ commit `a1f96655`** (correctness pass, 2026-06-28). Verify 2026-06-29: cả 4 màn đều bọc `KeyboardAvoidingView` đúng pattern auth (`behavior={Platform.OS==='ios'?'padding':'height'}`, `flex:1`; sheet dùng `justifyContent:'flex-end'`).

Audit liệt "open" vì snapshot **trước** pass đó → stale. Sweep xác nhận mọi màn text-entry-ở-dưới đều có KAV; `vocabulary` chỉ có search field ở **đầu** màn (bàn phím nổi từ dưới, xa input) → đúng là **không cần** KAV.

---

## 7. Còn nợ (a11y mở rộng)

Không thuộc screen-reader role/label, nên không nằm trong pass gốc:

1. ✅ **Color-only meaning cho người nhìn (color-blind) — gần đủ.** Trạng thái selected/correct/status đã announce cho VoiceOver qua `accessibilityState`. Phần lớn các điểm cũng đã có **cue phi-màu (icon hình dạng)** từ reskin v2: roadmap status (`Check`/`YellowSquare`/`Lock`/dot theo state), exam-attempt radio selected (dấu `Check` trong vòng tròn), node-practice sau khi nộp (`Check` đúng / `X` sai), và **node-practice option đã chọn trước khi nộp** (đã vá 2026-06-29 `7b4c939f`: thêm `Check` accent — trước đó chỉ phân biệt bằng viền/nền accent). Còn yếu (chấp nhận được): notifications unread chỉ phân biệt bằng có/không `YellowSquare` + đổi nền — rà thêm các status/badge khác nếu mở rộng.
2. ✅ **Extract `SelectableChip` / `SelectableRow` shared (DRY) — XONG 2026-06-29.** Hai primitive mới ở `components/ui/`: **`SelectableChip`** (chip filter/toggle: role `button` + label + `selected` + hitSlop mặc định 44pt-safe; bỏ `selected` cho action chip để không announce "not selected") và **`SelectableRow`** (option/radio: `role` cấu hình `button|radio` + label + `selected`/`disabled`). **Cách giữ 0-visual-regression:** primitive chỉ tập trung phần lặp (Pressable + a11y triple + 44pt), **style và children vẫn do caller truyền nguyên xi** → visual giống hệt by-construction (style từng màn vốn khác nhau nên không ép chung). Đã migrate 5 màn: video-lesson (4 chip + topic + export), exam (level chip), vocabulary (filter chip + mark-known), exam-attempt (radio), node-practice (option). Verify: `tsc` 0 · `jest` 18/18 · sweep 0 Pressable thiếu role. **Còn nợ: device-QA visual trên simulator** (xác nhận parity bằng mắt). Nút one-off không phải chip (vd "Xem đáp án") giữ `Pressable` inline.
3. ✅ **`maxFontSizeMultiplier` policy (Dynamic Type) — XONG 2026-06-29.** Cap phóng chữ theo variant ở `lib/theme/tokens.ts` (`maxFontScale`), tiêu thụ trong `ThemedText` (per-variant: display/title serif cap chặt 1.25–1.4, body/label rộng hơn 1.5–1.6) + `Caption` (1.4) + `TextField` input (1.6 = bodyLg). Đặt trước `{...rest}` nên caller vẫn override được per-instance. Layout editorial v2 không vỡ khi user bật font lớn trong iOS Settings. (Verify device thật còn nợ — xem §8.)

---

## 8. Pattern tham chiếu (cho lần sau)

**Icon-only button** — ưu tiên `IconButton` (label bắt buộc ở type-level). Khi markup là Pressable có style/child phức tạp (vd mic có background tròn + `ActivityIndicator`), thêm tại chỗ:
```tsx
<Pressable
  accessibilityRole="button"
  accessibilityLabel={isRecording ? 'Dừng ghi âm' : 'Ghi âm câu trả lời'}  // label ĐỘNG khi trạng thái đổi → tránh color-only
  accessibilityState={{ disabled: busy }}
  ...
/>
```

**Selectable chip / option** — role `button` (hoặc `radio` cho radio thật) + `selected` state; nếu chip < 44pt cao, thêm `hitSlop` thay vì đổi padding (giữ visual):
```tsx
<Pressable
  accessibilityRole="button"
  accessibilityLabel={label}
  accessibilityState={{ selected: active }}
  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}  // ~28pt + 16 = 44pt
  ...
/>
```

**Pressable Card** — truyền `accessibilityLabel` + `disabled` (đừng drop `onPress` để "khoá"; `disabled` vừa announce vừa chặn handler):
```tsx
<Card onPress={go} disabled={isLocked} accessibilityLabel={`${title}, ${statusText}`} />
```

**Accordion / disclosure** — role `button` + `accessibilityState={{ expanded }}`.

**Verify nhanh:**
```bash
cd mobile && npx tsc --noEmit && npm test
# sweep: mọi Pressable trong app/ phải có role
for f in $(find app -name '*.tsx'); do
  p=$(grep -c '<Pressable' "$f"); r=$(grep -c accessibilityRole "$f")
  [ "$p" -gt 0 ] && [ "$r" -lt "$p" ] && echo "${f#app/}: P=$p role=$r"
done
```

---

## 9. Tài liệu liên quan
`mobile/QA_SCREENS_AUDIT.md` (nguồn finding) · `mobile/SESSION_HANDOFF.md` (trạng thái deploy tổng) · `components/ui/IconButton.tsx` / `Card.tsx` / `SelectableChip.tsx` / `SelectableRow.tsx` (primitive a11y) · `lib/theme/tokens.ts` (`maxFontScale` — Dynamic Type caps).
