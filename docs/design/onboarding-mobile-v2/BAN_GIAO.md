# Bàn giao: Onboarding mobile v2 — thiết kế → thi công → phát hành

**Ngày:** 02/09/2026 · **Trạng thái:** đã merge + đã bắn OTA · Tài liệu này tự đứng,
không cần đọc memory/phiên chat nào khác.

## 0. TL;DR

| Hạng mục | Giá trị |
|---|---|
| Thiết kế | Canvas 9 artboard, owner duyệt 02/09 — https://claude.ai/code/artifact/3799743c-4e3b-45cb-913e-b023763d0eb5 (bản tĩnh: chính thư mục này) |
| Code | PR [#463](https://github.com/CuDinh03/DeutschFlow/pull/463) → squash `469ee943` trên `main` |
| Kiểm chứng | tsc 0 lỗi · jest 50 suites/461 test · CI xanh trọn 2 lượt · review độc lập APPROVE (0 CRITICAL/HIGH) |
| OTA | ✅ ĐÃ BẮN 02/09 tối — branch `production`, iOS, update group `5360fe92-43ea-4c78-b3da-a7c66fb4c258`, commit `469ee943`, runtime `dfba226acb01e4503ddfc801e2d2c18b0cb38b12` (= build 17) |
| Phạm vi OTA | Chỉ TestFlight build 16/17 nhận. App Store public (build 12) KHÁC runtime → **không** nhận |
| Còn lại | Owner test máy thật + submit v1.0.1 (mục §9) |

## 1. Bối cảnh & phạm vi

Màn onboarding mobile trước đây là **form một trang cuộn dài** (5 nhóm chip + 1 nút),
không có cảm giác hành trình, mentor chỉ là thẻ nhỏ lọt giữa form. Bản thiết kế
`na-onboarding.jsx` cũ (06/2026) là wizard nhưng sai mô hình dữ liệu (goal
'pflege/b1', mã lớp, nguồn biết app — không tồn tại trong sản phẩm).

Phạm vi đợt này: **thiết kế lại + thi công** trọn luồng onboarding iOS theo mô hình
dữ liệu thật (onb_v3): phễu khách 4 bước → quick win → cổng đăng ký → replay draft
→ màn "câu đầu tiên" → ăn mừng → Trang chủ. **Không đổi hợp đồng API, không đổi
logic nghiệp vụ** — chỉ trình bày và 4 hành vi có chủ đích ở §5.

## 2. Nguồn thiết kế

9 artboard iPhone 390×844 trong thư mục này (mở thẳng bằng trình duyệt xem được),
`canvas.json` chứa bố cục + sticky note đặc tả luồng/API/token. Canvas sống (chỉnh
trực tiếp, export PNG/PDF) ở URL trong bảng §0. Danh sách màn: xem
[README.md](README.md).

Ngôn ngữ thị giác lấy nguyên từ `mobile/lib/theme/` (Galerie v2 warm-paper): nền
`#FBFAF7` · mực `#161513` · viền `#E7E3DA` · vàng `#FFCD00` / gold `#C79A00` ·
Newsreader (tiêu đề serif) + Instrument Sans (UI) · bo góc 4px · motif ô vuông vàng
· icon lucide nét 1.8 · **không emoji**.

## 3. Quyết định thiết kế then chốt (và VÌ SAO)

1. **Form 1 trang → wizard 4 bước** (mục tiêu → trình độ → nhịp học → lĩnh vực/kỳ
   thi). Mỗi bước một câu hỏi, mentor reveal dồn về bước cuối làm đỉnh cảm xúc.
2. **A0 được CHỌN SẴN ở bước trình độ.** Trước đây `currentLevel` khởi tạo `null`
   và "không chạm hàng chip" là đường mặc định ngầm — chính lớp mơ hồ đó từng che
   bug F-1 (08/2026: học viên A0 iOS mất trọn onboarding v1 hơn 6 tuần). Mặc định
   giờ tường minh, POST luôn mang `currentLevel`.
3. **Mentor avatar = monogram serif trên ô mực** (chữ cái đầu, Newsreader vàng trên
   `#161513`), thay emoji — theo hướng icon-system v2 đã bỏ emoji toàn /v2.
4. **Không bịa số:** thẻ hành trình bước 2 chỉ hiện "46 chặng · ~11 tuần" cho cặp
   **A0→B1** (số đo thật trên lộ trình prod sinh 01/09). Cặp khác hiện câu chung.
   Map số nằm ở `mobile/lib/onboardingSteps.ts` — thêm cặp mới = thêm số ĐO ĐƯỢC.
5. **Nhánh CERT** (chọn "Thi chứng chỉ" ở bước 1): bước 4 đổi thành chọn kỳ thi
   (Goethe/telc/TestDaF), mentor cố định Anna (backend resolve, UI chỉ hiển thị).
6. **Quick win không thể thất bại** + cổng đăng ký giữ nguyên cơ chế draft; màn
   "câu đầu tiên" thêm lối chủ động "chỉ nghe — lặp lại (không dùng micro)".
7. **Không vẽ chrome giả** (status bar/keyboard), vùng chạm ≥44pt, tôn trọng
   Reduce Motion (kế thừa cơ chế sẵn có).

## 4. Bản đồ code (tất cả trong PR #463)

| File | Vai trò |
|---|---|
| `mobile/app/(auth)/onboarding.tsx` | Wizard 4 bước + GuestQuickWin + Resuming. **Logic submit/draft-resume/analytics/tour-flag GIỮ NGUYÊN từng byte** (review độc lập đối chiếu với main xác nhận) — chỉ JSX/trình bày đổi |
| `mobile/lib/onboardingSteps.ts` | MỚI — hàm thuần: `ONBOARDING_STEP_IDS` (thứ tự khoá), `canLeaveStep` (bước 2 đòi targetLevel), `journeyEstimate` (chỉ A0→B1 có số) |
| `mobile/lib/__tests__/onboardingSteps.test.ts` | MỚI — test.each khoá thứ tự bước + điều kiện rời bước + "không bịa số". Lý do tách hàm thuần: bài học F-1 — quyết định luồng nằm trong JSX thì không test nào bắt được khi nó lặng lẽ đổi nghĩa |
| `mobile/components/onboarding/StepHeader.tsx` | MỚI — back/brand mark + 4 vạch tiến trình vàng (trang trí, ẩn khỏi screen reader) + đếm "n/4" (có accessibilityLabel) |
| `mobile/components/onboarding/MentorMonogram.tsx` | MỚI — avatar monogram dùng chung (wizard, quick win, first-sentence) |
| `mobile/app/(auth)/first-sentence.tsx` | Monogram thay emoji; vòng đệm quanh mic + dòng trấn an; lối "chỉ nghe — lặp lại"; màn ăn mừng thêm 2 pill + thẻ "Tuần đầu của bạn". **Luồng audio/consent/TTS/chấm không đổi** |
| `docs/design/onboarding-mobile-v2/` | Bộ artboard + canvas.json + README + file này (`docs/` nằm trong `.gitignore` — thêm file mới vào đây phải `git add -f`) |

## 5. Hành vi ĐỔI có chủ đích — tất cả chỉ ở đây

1. `currentLevel` mặc định `'A0'` (trước: `null`) ⇒ `POST /onboarding/profile` và
   `GET /onboarding/route` luôn mang currentLevel tường minh.
2. Nhãn HIỂN THỊ kỳ thi đổi ("Goethe" → "Goethe-Zertifikat"…) — **value gửi
   backend không đổi** (`GOETHE`/`TELC`/`TESTDAF`).
3. `onb_first_sentence_skipped` có thêm giá trị `reason: 'no_mic_choice'` (user
   chủ động chọn nghe-lặp) — **tách** với `'mic'` (bị hệ thống từ chối quyền).
   Cùng đi vào biến thể echo, khác nhau chỉ ở analytics.
4. Emoji gỡ khỏi copy onboarding/first-sentence (🇩🇪/🎉/👇 và emoji mentor).

Mọi thứ khác — payload API, thứ tự sự kiện analytics, cơ chế draft
giành-quyền-replay, cờ `profile_done`/`first_sentence`, điều hướng
`nextAfterProfile()`, chặn back sau đăng nhập — **không đổi**.

## 6. Kiểm chứng đã làm

- `npx tsc --noEmit` 0 lỗi · `npx jest` 50 suites / 461 test xanh (local + CI).
- CI PR #463 xanh trọn **2 lượt** (mobile Type Check & Unit Tests, backend Unit +
  Integration Tests chạy thật, Compile, Semgrep, gitleaks, npm audit×2,
  Fingerprint-guard = không đổi runtime).
- Review độc lập (typescript-reviewer): **APPROVE, 0 CRITICAL/HIGH**; đối chiếu
  từng dòng với main xác nhận logic nguyên vẹn. 4 MEDIUM + 5 LOW → đã vá 6 mục
  trong `78f24d91` (announce bước cho VoiceOver khi wizard chuyển bước; ẩn vạch
  trang trí; underline thật thay border-giả cho link no-mic; touch target ≥44pt;
  màn Resuming bỏ monogram — cuộc đua replay-draft có thể khiến nó hiện SAI mentor;
  spinner bọc hộp 22×22 thẳng cột).
- **LOW còn lại, cần mắt nhìn máy thật** (chưa ai render UI này trên thiết bị):
  (a) lưới 2 cột `flexBasis 47%` hơi sát mép trên máy 375pt; (b) hàng nút cuối khi
  có "Bỏ qua" + "Tạo lộ trình của tôi" hơi chật trên máy hẹp; (c) hợp đồng màu của
  `AchievementPill` là hex 6 chữ số (truyền `rgba(...)` nền lặng lẽ biến mất — đã
  ghi comment tại chỗ).

## 7. Phát hành

- Merge: squash `469ee943` (02/09). **OTA bắn từ ĐÚNG commit này, TRƯỚC khi #464
  (messaging idempotency) merge** — cố ý, vì #464 yêu cầu deploy backend V300
  trước khi OTA phần mobile của nó.
- Runbook OTA đã theo (chuẩn cho mọi lần sau):
  1. Worktree **detach main sạch** (`git checkout --detach origin/main`; đừng bắn
     từ checkout dev chính vì cây bẩn/node_modules cũ);
  2. `cd mobile && npm ci`;
  3. `npx eas-cli fingerprint:compare "<runtime build đích>"` — lần này khớp
     `dfba226a…` (build 17). ⚠️ ĐỪNG dùng `npx @expo/fingerprint .` — ra số SAI
     (khác platform/option), từng gây báo động giả;
  4. `npx eas-cli update --branch production --platform ios --message "..."`.
- Kết quả: update group `5360fe92-43ea-4c78-b3da-a7c66fb4c258` · iOS update id
  `01a0614b-69e8-7268-9542-11252e227e66` · dashboard
  https://expo.dev/accounts/cudinh3502/projects/deutschflow/updates/5360fe92-43ea-4c78-b3da-a7c66fb4c258
- Tầm với: runtime-fingerprint policy ⇒ chỉ build cùng runtime `dfba226a…` nhận
  (TestFlight build 16/17). App Store public đang là build 12 (runtime khác, JS
  đóng băng) — người dùng public CHỈ thấy onboarding mới khi build 17 được duyệt
  và phát hành.

## 8. Rollback & sự cố

- **Quay về bản OTA trước** (bộ 3 cụm màn + fix blur-audio, bắn trưa 02/09):
  `cd mobile && npx eas-cli update:republish --group 41edaf7d-8c2c-49cc-a4fd-c8f8c64f91c2`
- **Sửa nhanh rồi bắn đè:** sửa trên main → theo đúng runbook §7. ⚠️ Từ giờ main
  đã chứa #464: trước khi OTA bất kỳ bản nào từ main mới, **backend V300 phải
  deploy trước** (ràng buộc của #464, ghi trong PR đó).
- Sự cố hiển thị nghi do OTA: kill app mở lại 2 lần để chắc đã áp bản mới nhất
  (bản tải nền áp ở lần mở sau), đối chiếu update group trong Sentry/EAS dashboard.

## 9. Việc còn lại (owner)

- [ ] Mở app build 17 TestFlight → kill hẳn → mở lại (nhận OTA) → đi trọn phễu:
      4 bước → quick win → đăng ký → resume → câu đầu tiên → ăn mừng → tour.
      Kèm 3 điểm LOW ở §6 (máy 375pt).
- [ ] Submit for Review v1.0.1 trên ASC (nếu chưa) — reviewer sẽ thấy đúng bản
      onboarding này; muốn reviewer thấy bản cũ thì republish theo §8 trước.
- [ ] (kỹ thuật, không gấp) `mentorEmoji()` trong `mobile/lib/onboardingMentor.ts`
      không còn ai gọi — dọn ở đợt refactor sau; i18n mobile vẫn chưa phủ
      onboarding (Q-D chỉ chốt phạm vi, chưa thi công).

## 10. Tham chiếu

- Spec luồng: [docs/onboarding-flow-spec.md](../../onboarding-flow-spec.md)
  (bảng sự thật §3 + taxonomy sự kiện §6 đã cập nhật cùng PR docs này).
- SRS: `TAI_LIEU_DAC_TA_SAN_PHAM/chi-tiet/modules/02-onboarding-va-ca-nhan-hoa.md`
  (local, không track git) — ONB-08 + AC-ONB-06..08 (NOT_RUN) thêm cùng đợt.
- Build 17 / TestFlight: `BAN_GIAO_BUILD16_2026-09-02.md` (repo root).
- PR liên quan: [#463](https://github.com/CuDinh03/DeutschFlow/pull/463) (đợt này) ·
  [#464](https://github.com/CuDinh03/DeutschFlow/pull/464) (messaging, merge sau OTA) ·
  #375/#407/#410 (nền onboarding v1→v3 trước đó).
