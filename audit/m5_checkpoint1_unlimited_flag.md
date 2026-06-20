# M-5 — CHECKPOINT 1: Điều tra nguồn-sự-thật "unlimited hợp lệ"

**Date:** 2026-06-20
**Status:** ✅ CHECKPOINT 1 DUYỆT 2026-06-20 — định nghĩa = **TẬP RỖNG + opt-in tường minh** (§4).
M-5 **tạm dừng**, sẽ làm Bước 2→6 trong **PR riêng** sau (CHECKPOINT 2 trước khi đổi guard).
Quick-wins H/P-9/D-3-G/Section-6 đã xong + commit (`a6d78961`).

> **Quyết định đã chốt với user:** backfill KHÔNG ai. Mọi org `pool_unlimited=false`.
> Unlimited = opt-in: thêm field pool/unlimited vào `UpdateOrgRequest`. Trước khi viết V225,
> chạy `prod_verify_section6.sql` ITEM 5 để xác nhận `orgs_with_pool_set=0` (provably đúng tập rỗng).

---

## 1. Công cụ & schema

- **Migration tool:** Flyway (SQL `V*__*.sql`), mới nhất `V224`.
- **Organization** (`organization/entity/Organization.java` + V204/V205):
  | Cột | Kiểu | Default | Nguồn |
  |-----|------|---------|-------|
  | `monthly_token_pool` | BIGINT NOT NULL | **0** (comment "0 = unlimited") | V205 |
  | `plan_code` | VARCHAR(32) → `subscription_plans(code)` | NULL | V204 |
  | `seat_limit` | INT NOT NULL | 0 (0 = chưa giới hạn) | V204 |
  | `valid_until` | timestamp | NULL | — |
  | `status` | VARCHAR(20) | ACTIVE | V204 |

## 2. ⚠️ Phát hiện quan trọng nhất: KHÔNG có đường nào set `monthly_token_pool`

- `UpdateOrgRequest` = `{planCode, seatLimit, status, validUntil}` — **không có field pool.**
- `AdminOrgService.updateOrganization()` set planCode/seatLimit/validUntil/status — **không bao giờ** gọi `setMonthlyTokenPool`.
- `grep setMonthlyTokenPool` toàn `src/main/java` → **0 kết quả.**

→ **Cách DUY NHẤT để pool > 0 là chạy SQL tay trên prod.** Nghĩa là trên thực tế gần như **mọi org đang có pool = 0**.

**Hệ quả (2 cái cùng lúc):**
1. Org-pool enforcement (`wouldExceedOrgPool`) hiện **no-op cho tất cả** — xác nhận Section 6 item 5.
2. M-5 backdoor (org member dùng PPTX/OCR đắt miễn phí) **đang mở cho mọi org member.**

## 3. Ứng viên nguồn-sự-thật "đã mua unlimited" — và vì sao đều KHÔNG dùng được

| Ứng viên | Vấn đề |
|----------|--------|
| `organizations.plan_code` | Admin set được, nhưng **nullable** + tái dùng plan B2C (FREE/PRO/ULTRA/INTERNAL). Plan mang `monthly_token_limit` dạng SỐ, không có khái niệm "org unlimited". |
| `org_invoices` (status=PAID) | Bằng chứng đã trả tiền, nhưng invoice chỉ có `seats` + `amount_vnd` — **không có field plan/tier/unlimited.** |
| `monthly_token_pool > 0` | Chính là cái ta đang vá — **cấm dùng làm tín hiệu** (theo ràng buộc của bạn). |

→ **Không có field nào trong dữ liệu hiện tại mã hoá "org này đã mua gói AI unlimited."**

## 4. 🎯 Đề xuất định nghĩa "unlimited hợp lệ" (chờ bạn duyệt)

Vì không tồn tại tín hiệu purchased-unlimited đáng tin, định nghĩa an toàn nhất là **TẬP RỖNG**:

> **Backfill KHÔNG ai.** Mọi org → `pool_unlimited = false` (default fail-safe).
> → mọi org member từ nay bị free-tier cap cho PPTX/OCR (đóng backdoor).
> Unlimited trở thành **opt-in tường minh**: thêm `monthlyTokenPool` + `poolUnlimited` vào
> `UpdateOrgRequest` để platform-admin bật **có chủ đích** cho từng org sau migration.

Định nghĩa này:
- ✅ Tuân thủ tuyệt đối ràng buộc của bạn (KHÔNG backfill true dựa trên pool=0).
- ✅ Fail-safe: default = bị cap, không phải default = unlimited miễn phí.
- ✅ Vá luôn bug sâu hơn: **pool hiện không set được qua API** — admin chưa từng có cần gạt.

## 5. Cần bạn làm trước khi tôi qua Bước 2

**(a)** Duyệt định nghĩa ở §4 (tập rỗng + opt-in tường minh), HOẶC chỉ định nguồn-sự-thật khác.

**(b)** Chạy `audit/prod_verify_section6.sql` (block ITEM 5) để xác nhận magnitude:
- Nếu `orgs_with_pool_set = 0` và `plan_code` phần lớn NULL → tập rỗng là **đúng provably**.
- Nếu có org mang `plan_code` nghĩa "unlimited tier" thật → tinh chỉnh định nghĩa để gồm đúng các org đó.

⛔ **DỪNG tại đây.** Không viết migration / sửa guard cho tới khi bạn xác nhận (a).

---

## Các bước còn lại (sau khi duyệt) — KHÔNG làm bây giờ

- **Bước 2:** V225 thêm `pool_unlimited BOOLEAN NOT NULL DEFAULT false` (+ có thể thêm field pool vào UpdateOrgRequest/updateOrganization để admin set được).
- **Bước 3:** backfill DRY-RUN theo định nghĩa đã duyệt → in danh sách → **CHECKPOINT 2.**
- **Bước 4:** sửa `FreeTierGuard.appliesTo` + bảng quyết định (unlimited=true→bypass; false&pool=0→cap; false&pool>0→metered).
- **Bước 5:** log/metric khi bypass do unlimited=true.
- **Bước 6:** test 5 ca (member pool=0→cap; unlimited→bypass; pool=500→metered; org mới→cap; non-org→free-tier cũ).
