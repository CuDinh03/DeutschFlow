# DeutschFlow — chỉ dẫn cho phiên Claude Code

Repo PUBLIC — không commit credential. Trả lời tiếng Việt; giữ nguyên tên file/lệnh/field/commit.

## Tài liệu bền trong repo (đọc trước khi làm phần tương ứng)

| Việc | Đọc |
|---|---|
| Thêm/đổi biểu tượng trên mobile (bộ glyph Galerie, emoji policy, luật hình học, cách thêm glyph) | `mobile/GALERIE_GLYPHS.md` |
| Runbook mobile: build/submit/OTA, fingerprint, QA simulator | `mobile/README.md` (nếu có) và handoff mới nhất trong `plans/` (`*handoff*mobile*`) |
| Đặc tả sản phẩm (SRS) — nguồn duy nhất là `chi-tiet/`, bản gộp sinh bằng `node pdf/pipeline/merge-md.mjs` | `TAI_LIEU_DAC_TA_SAN_PHAM/chi-tiet/` |
| Kế hoạch / handoff các đợt (LOCAL, untracked) | `plans/` |

## Quy ước

- Sửa code = cập nhật SRS cùng đợt (`chi-tiet/` + ca nghiệm thu; ca mới để NOT_RUN).
- Mobile: Lucide chỉ cho điều khiển; biểu tượng nhận diện dùng `GaGlyph`; không thêm emoji giao diện.
- Deploy backend / OTA production chỉ khi owner ra lệnh trực tiếp.
