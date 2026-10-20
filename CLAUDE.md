# DeutschFlow — chỉ dẫn cho phiên Claude Code

Repo PUBLIC — không commit credential. Trả lời tiếng Việt; giữ nguyên tên file/lệnh/field/commit.

> **BẮT BUỘC: trước mỗi lần merge vào `main` hoặc deploy (frontend, backend, mobile OTA/build, hạ tầng) phải đọc hết `docs/QUY_TRINH_PHAT_HANH.md` và làm đúng checklist trong đó.** Production đã rời AWS (tự host sau Cloudflare Tunnel); merge vào `main` KHÔNG tự deploy; máy chủ có thể đang deploy từ nhánh khác `main` (§2 của tài liệu).

## Tài liệu bền trong repo (đọc trước khi làm phần tương ứng)

| Việc | Đọc |
|---|---|
| **Merge vào `main`, deploy frontend/backend/mobile, đổi hạ tầng (env, nginx, backup, migration)** | **`docs/QUY_TRINH_PHAT_HANH.md`** (đọc hết, mỗi lần) |
| Thêm/đổi biểu tượng trên mobile (bộ glyph Galerie, emoji policy, luật hình học, cách thêm glyph) | `mobile/GALERIE_GLYPHS.md` |
| Runbook mobile: build/submit/OTA, fingerprint, QA simulator | `mobile/README.md` (nếu có) và handoff mới nhất trong `plans/` (`*handoff*mobile*`) |
| Đặc tả sản phẩm (SRS) — nguồn duy nhất là `chi-tiet/`, bản gộp sinh bằng `node pdf/pipeline/merge-md.mjs` | `TAI_LIEU_DAC_TA_SAN_PHAM/chi-tiet/` |
| Kế hoạch / handoff các đợt (LOCAL, untracked) | `plans/` |
| Định hướng A+B+E (chốt 18/10/2026): landing, trang công khai, onboarding, phỏng vấn theo nghề, trang trung tâm/nhà tuyển dụng — 9 quyết định, thứ tự đợt 0–5, sổ lời hứa | `plans/2026-10-18-quyet-dinh-dinh-huong-abe.md` (LOCAL) |

## Quy ước

- Sửa code = cập nhật SRS cùng đợt (`chi-tiet/` + ca nghiệm thu; ca mới để NOT_RUN).
- Mobile: Lucide chỉ cho điều khiển; biểu tượng nhận diện dùng `GaGlyph`; không thêm emoji giao diện.
- Deploy production (backend, frontend, OTA mobile) chỉ khi owner ra lệnh trực tiếp. "Merge đi" không có nghĩa là "deploy đi".
- Không chạy `deploy-backend.sh`, `cleanup-deploy.sh` ở gốc repo, không dựa vào `amplify.yml`: di sản AWS, đã ngừng dùng.
