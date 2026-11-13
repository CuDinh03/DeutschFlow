# DeutschFlow — chỉ dẫn cho phiên Claude Code

Repo PUBLIC (công khai lại từ 11/2026; từng private từ 08/11/2026) — không commit credential; tiêu đề, mô tả PR và commit của bản vá bảo mật không mô tả cách khai thác. Trả lời tiếng Việt; giữ nguyên tên file/lệnh/field/commit.

> **BẮT BUỘC: trước mỗi lần merge vào `main` hoặc deploy (frontend, backend, mobile OTA/build, hạ tầng) phải đọc hết `docs/QUY_TRINH_PHAT_HANH.md` và làm đúng checklist trong đó.** Production đã rời AWS (tự host sau Cloudflare Tunnel); merge vào `main` KHÔNG tự deploy; máy chủ có thể đang deploy từ nhánh khác `main` (§2 của tài liệu).

## Tài liệu bền trong repo (đọc trước khi làm phần tương ứng)

| Việc | Đọc |
|---|---|
| Mở phiên mới, chưa rõ dự án đang ở đâu, hoặc cần biết việc nào đọc gì và giao agent nào | `TAI_LIEU_DAC_TA_SAN_PHAM/bo-nao/README.md` (LOCAL, repo tài liệu riêng tư; chỉ có ở checkout chính) |
| **Merge vào `main`, deploy frontend/backend/mobile, đổi hạ tầng (env, nginx, backup, migration)** | **`docs/QUY_TRINH_PHAT_HANH.md`** (đọc hết, mỗi lần) |
| Luyện thi telc trên web (Hôm nay, luyện Teil, thi thử, kết quả, lịch ôn, hướng dẫn lần đầu, bài chẩn đoán) | `docs/LUYEN_THI.md` |
| Thêm/đổi icon trên web (ô `GaGlyph`, nét 1,9, glyph tự vẽ, màu token, eyebrow trơn) | `frontend/ICON_WEB.md` |
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
