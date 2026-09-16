# Ảnh chụp sản phẩm trên trang chủ

> Tài liệu này nằm cạnh công cụ sinh ảnh, **không** trong `public/` — để khỏi bị phát hành công
> khai tại `/landing/README.md` trên production.

Ảnh trong thư mục này là **ảnh chụp thật** từ giao diện `/v2`, không phải mockup vẽ tay và không
phải ảnh stock. Dữ liệu trong ảnh là **minh hoạ** (lớp "K30" dựng sẵn trong spec chụp) — không có
dữ liệu thật của học viên, giáo viên hay trung tâm nào.

## Cấu trúc

```
src/assets/landing/<locale>/<tên-màn>.webp   # locale ∈ vi | en | de
```

Chữ trong ảnh "nướng cứng" vào file, mà trang chủ dịch cả ba thứ tiếng, nên mỗi màn có ba bản.
`src/components/landing-v2/landingShots.ts` tra bản đúng theo locale đang xem.

| Tên màn | Trang nguồn | Dùng ở khối |
|---|---|---|
| `student-roadmap-tree` | `/v2/student/roadmap` | Lộ trình học |
| `student-mock-exam` | `/v2/student/mock-exam/run` | Luyện thi |
| `teacher-class-report` | `/v2/teacher/tc-reports` | Dành cho giáo viên |
| `teacher-grading` | `/v2/teacher/grading` | Dành cho giáo viên |

## Chụp lại (sau khi giao diện đổi)

```bash
npx playwright test tests/e2e/landing/__product-shots.spec.ts   # cần dev server ở :3000
node scripts/build-landing-shots.mjs                            # cần cwebp: brew install webp
```

Bước 1 ghi PNG 2880 px vào `test-results/landing-shots/<locale>/`; bước 2 thu về 1600 px và ghi
đè WebP ở đây. Spec mock toàn bộ API nên **không** cần backend và không chạm dữ liệu thật.

⚠️ Playwright **dọn sạch `test-results/` mỗi lần chạy**, nên chạy spec kèm `--grep` chỉ sinh lại
đúng vài PNG; bước 2 khi đó chỉ ghi đè đúng những ảnh vừa chụp (các ảnh khác trong thư mục này
vẫn nguyên). Muốn làm mới TOÀN BỘ thì chạy spec không kèm `--grep`.

## Lưu ý

- Script **chỉ thu nhỏ, không phóng to**: nó đọc bề ngang PNG từ IHDR và chỉ truyền `-resize`
  khi ảnh rộng hơn 1600px. `cwebp -resize` tự nó CÓ nội suy lên, nên bỏ bước kiểm này thì chụp
  lại ở khổ nhỏ sẽ ra ảnh nhoè mà không cảnh báo gì.

- Ảnh nằm trong `src/assets/`, **không** phải `public/`. Import tĩnh đã đưa chúng vào
  `_next/static/` với tên có băm nội dung; để thêm một bản trong `public/` nữa thì mỗi lần deploy
  mang hai bản của cùng 12 tấm, mà bản trong `public/` không bao giờ được yêu cầu.
- `.gitignore` gốc chặn `*.png` toàn cục nhưng **không** chặn `*.webp`, nên các file ảnh được theo
  dõi bình thường. Đừng commit bản PNG thô.
- Import trong `src/components/landing-v2/landingShots.ts` là **import tĩnh**: đổi tên file mà quên sửa import sẽ làm **đổ
  build**, thay vì thành ảnh 404 lặng lẽ trên production.
- Đổi ảnh thì soát lại chuỗi `shotAlt` trong `messages/v2/landing.{vi,en,de}.json` — alt mô tả
  đúng nội dung ảnh là điều kiện a11y, không phải chỗ nhét từ khoá.
