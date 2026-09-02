# Thiết kế onboarding mobile v2 — 2026-09-02

Bản thiết kế đã được owner duyệt 02/09/2026. Canvas sống (pan/zoom, chỉnh trực tiếp):
**https://claude.ai/code/artifact/3799743c-4e3b-45cb-913e-b023763d0eb5**

Mỗi file `*.dc.html` là một artboard iPhone 390×844 (mở thẳng bằng trình duyệt cũng
xem được — markup + inline style tự đứng); `canvas.json` là bố cục + sticky note
đặc tả luồng/API/token.

## Các màn

| # | File | Màn | Ghi chú |
|---|------|-----|---------|
| 01 | `Main.dc.html` | Bước 1 · Mục tiêu | motivation 6 lựa chọn → goalType WORK/CERT |
| 02 | `Level.dc.html` | Bước 2 · Trình độ | A0 chọn sẵn; thẻ hành trình A0→B1 (46 chặng/11 tuần — số đo thật) |
| 03 | `Rhythm.dc.html` | Bước 3 · Nhịp học | 5/10/15/20 phút, mặc định 15; thẻ nhắc 20:00 |
| 04 | `Mentor.dc.html` | Bước 4 · Lĩnh vực + mentor reveal | IT → Jonas (FREE/A0) |
| 04B | `Exam.dc.html` | Bước 4 nhánh CERT | kỳ thi Goethe/telc/TestDaF; mentor Anna |
| 05 | `QuickWin.dc.html` | Quick win + cổng đăng ký | „Guten Morgen“, trạng thái đã giải đúng |
| 06 | `Creating.dc.html` | Đang tạo lộ trình | replay draft sau đăng ký |
| 07 | `FirstSentence.dc.html` | Câu đầu tiên | TTS + mic vàng 86px + lối „chỉ nghe – lặp lại“ |
| 08 | `Celebrate.dc.html` | Ăn mừng | confetti ô vuông + 2 pill + checklist tuần đầu |

## Ngôn ngữ thị giác

Theo `mobile/lib/theme/` (Galerie v2 warm-paper): nền `#FBFAF7` · mực `#161513` ·
viền `#E7E3DA` · vàng `#FFCD00` / gold `#C79A00` · Newsreader (tiêu đề) +
Instrument Sans (UI) · bo góc 4px · motif ô vuông vàng · icon SVG nét mảnh,
**không emoji** (avatar mentor = monogram serif trên ô mực).

## Thi công

PR `feat/onboarding-mobile-ui-v2`: `mobile/app/(auth)/onboarding.tsx` (wizard 4
bước, logic giữ nguyên — quyết định bước ở `mobile/lib/onboardingSteps.ts` có
test), `mobile/app/(auth)/first-sentence.tsx` (monogram + màn ăn mừng),
`mobile/components/onboarding/`.
