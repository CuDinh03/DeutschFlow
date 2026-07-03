# HƯỚNG DẪN 3 VIỆC "CLICK" — CHỦ DỰ ÁN TỰ LÀM (2026-07-03)

> Các việc này **không code được** (console Apple/GitHub/AWS). **Cập nhật 2026-07-06:** Free Apps Agreement **đã Active** → v1.0 free-only **không còn** đường-găng-agreement. Còn lại cho v1.0 = DSA trader (nếu muốn EU) + #2 + #3. Paid Apps Agreement chỉ cần cho v1.1.
> Repo: `CuDinh03/DeutschFlow` · Bundle iOS: `com.cudinh.mydeutschflow` · Team: `4M3CU3X9SS` · Legal entity Apple: `Cu Dinh` · Region AWS: `ap-southeast-1`.

**Thứ tự khuyến nghị cho v1.0:** #2 branch protection (10') → #3 RDS backup (15') → DSA trader (EU, tùy chọn). (#1 Paid Apps = để dành v1.1.)

---

## ✅ VIỆC #1 — Apple Agreements (đã cập nhật theo ASC 2026-07-06)

> **TIN TỐT — v1.0 free-only KHÔNG bị chặn bởi agreement.** Ảnh chụp ASC → Business cho thấy:
> - ✅ **Free Apps Agreement = Active** (Jun 25 2026 – Jun 25 2027) → **đủ để nộp app free**. Không phải làm gì thêm cho v1.0.
> - ⏳ **Paid Apps Agreement = New** (chưa ký) → **chỉ cần cho v1.1** (IAP). KHÔNG phải đường găng của v1.0 như bản trước ghi.
> - Legal entity đã đăng ký = **"Cu Dinh"** (đã dùng làm data-controller trong Privacy/Terms).

### Cho v1.0 (free-only): 0 việc agreement. Bỏ qua phần dưới, sang #2/#3.

### Cho v1.1 (monetization — làm SAU submit v1.0): ký Paid Apps Agreement
1. ASC → **Business** → **Edit Legal Entity**: ASC đang báo *"you must update your legal entity information prior to signing the Paid Apps Agreement"* → cập nhật cho đầy đủ trước.
2. **Agreements → Paid Apps** (status "New") → **Review/Accept**.
3. **Tax Forms** (tối thiểu US): cá nhân ngoài Mỹ → **W-8BEN**; cần **Foreign TIN** (MST cá nhân VN), địa chỉ thường trú, cư trú thuế = Vietnam; khai **treaty benefits** (VN có hiệp định với Mỹ) để giảm withholding.
4. **Bank Account**: TK ngân hàng VN nhận USD/VND; tên chủ TK khớp legal entity; số TK + **SWIFT/BIC**.
5. **Contact Info**: Senior Management / Financial / Technical / Legal (có thể cùng là bạn).
- **DoD (v1.1):** Paid Apps = **Active**; Tax = Complete; Bank = Verified. ⚠️ Apple verify tax/bank mất vài giờ→vài ngày.

### 🔴 VIỆC MỚI — DSA "trader status" (EU) — cần cho phân phối tại EU
ASC đang cảnh báo đỏ: *"you need to let us know whether or not you are a trader… DSA requires Apple to verify and display trader contact information."*
- Vào **Business → Complete Compliance Requirements** → khai trader status.
- Ý nghĩa: nếu khai **"trader"** (phân phối vì mục đích thương mại — đúng khi có ads/IAP), Apple **hiển thị công khai thông tin liên hệ** của bạn (tên/địa chỉ/email) tại EU và **verify** thông tin đó. Nếu **không khai**, app có thể **không hiển thị ở EU**.
- Với v1.0 free-only không ads: có thể khai theo thực tế; nhưng khi lên v1.1 (ads/IAP) chắc chắn là "trader" → chuẩn bị thông tin liên hệ verify được. **Quyết định phân loại là của bạn** (nên tham chiếu định nghĩa trader của Apple/EU); nếu để trống → mất thị trường EU.

---

## ✅ VIỆC #2 — Bật Branch Protection cho `main` (GitHub)

**Vì sao:** Hiện `main` **KHÔNG có** branch protection (đã xác nhận: `gh api ... 404 Branch not protected`). Bất kỳ ai (kể cả deploy script) có thể push thẳng, và CI đỏ 7+ ngày không ai biết. Bật để buộc mọi thay đổi qua PR + CI xanh.

### Cách A — Giao diện web (khuyến nghị nếu muốn kiểm soát chi tiết)
1. Vào **https://github.com/CuDinh03/DeutschFlow/settings/branches**.
2. **Add branch ruleset** (hoặc "Add rule" ở giao diện cũ) → Branch name pattern: `main`.
3. Tick các mục:
   - ☑️ **Require a pull request before merging** (Required approvals có thể để **0** vì bạn làm solo — vẫn buộc đi qua PR).
   - ☑️ **Require status checks to pass before merging** → chọn các check CI thật (ví dụ: `backend-ci`, `frontend-ci`, `Integration Tests` — chọn theo tên workflow đang chạy).
   - ☑️ **Require branches to be up to date before merging**.
   - ☑️ **Do not allow bypassing the above settings** (hoặc để trống nếu muốn tự bypass khi khẩn — solo dev cân nhắc).
   - ☑️ **Restrict deletions** + **Block force pushes**.
4. **Create / Save**.

### Cách B — CLI (nhanh, 1 lệnh)
```bash
gh api -X PUT repos/CuDinh03/DeutschFlow/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  -f "required_pull_request_reviews[required_approving_review_count]=0" \
  -F "enforce_admins=false" \
  -F "required_status_checks[strict]=true" \
  -f "required_status_checks[checks][][context]=backend-ci" \
  -f "required_status_checks[checks][][context]=frontend-ci" \
  -F "restrictions=null"
```
> ⚠️ Thay `backend-ci`/`frontend-ci` bằng **đúng tên job CI** của bạn. Xem tên bằng: `gh run list --limit 5` hoặc `gh api repos/CuDinh03/DeutschFlow/commits/main/check-runs -q '.check_runs[].name'`.
> `enforce_admins=false` để bạn (solo) vẫn merge được khi cần; đổi `true` nếu muốn nghiêm ngặt tuyệt đối.

### ✔️ DoD
- `gh api repos/CuDinh03/DeutschFlow/branches/main/protection` trả về JSON (không còn 404).
- Thử push thẳng lên `main` bị chặn / phải qua PR.

### 💡 Kèm theo (tùy chọn, 5'): bật notify khi CI fail
- GitHub → **Settings → Notifications** (cá nhân) → bật email cho **Actions: workflow runs failed**, hoặc thêm 1 step gửi Telegram/email vào workflow CI khi `failure()`.

---

## ✅ VIỆC #3 — Xác minh RDS Backup + Deletion Protection + Encryption (AWS)

**Vì sao:** Toàn bộ dữ liệu nằm trên **1 RDS t4g.micro single-AZ**, và audit **không tìm thấy bằng chứng backup nào** trong repo. Nếu automated backup đang TẮT → mất DB = mất tất cả (kèm ledger tài chính vốn CASCADE theo user). 15 phút xác minh chặn được rủi ro tử vong lớn nhất.

### Cách A — AWS Console (dễ nhất)
1. Đăng nhập **AWS Console** → chuyển region về **Asia Pacific (Singapore) `ap-southeast-1`** (góc phải trên).
2. Vào **RDS** → **Databases** → click vào instance PostgreSQL của DeutschFlow.
3. Tab **Maintenance & backups** → mục **Backup**:
   - Kiểm tra **Automated backups**: phải **Enabled** với **Retention period ≥ 7 days**.
   - Nếu **Disabled** hoặc retention = 0 → click **Modify** (nút góc phải trên) → mục **Backup** → đặt **Backup retention period = 7 (hoặc 14) days** → chọn **Backup window** giờ thấp điểm (VD 18:00–19:00 UTC = ~1–2h sáng VN) → **Continue** → **Apply immediately**.
4. Tab **Configuration** (hoặc **Modify**) → kiểm tra:
   - **Deletion protection**: phải **Enabled**. Nếu chưa → **Modify** → tick **Enable deletion protection** → Apply.
   - **Encryption**: xem **Storage encrypted = Yes/No**.
     - ⚠️ Nếu **No**: KHÔNG bật trực tiếp được trên instance đang chạy. Phải: tạo **snapshot** → **Copy snapshot** với tùy chọn **Enable encryption** (chọn KMS key) → **Restore** từ snapshot đã mã hóa → đổi endpoint. Đây là việc có downtime, **để Phase 2** (không chặn submit), nhưng **ghi nhận** kết quả Yes/No hôm nay.
5. **Chụp màn hình** trạng thái Backup + Deletion protection + Encryption → lưu vào repo (`plans/appstore/` hoặc gửi tôi để đính runbook).

### Cách B — AWS CLI (nếu đã cấu hình `aws`)
```bash
# Liệt kê instance + các thuộc tính chốt (đổi region nếu khác)
aws rds describe-db-instances --region ap-southeast-1 \
  --query "DBInstances[].{ID:DBInstanceIdentifier, Backup:BackupRetentionPeriod, DelProtect:DeletionProtection, Encrypted:StorageEncrypted, MultiAZ:MultiAZ, Class:DBInstanceClass}" \
  --output table
```
- **Backup** = số ngày retention (0 = TẮT → bật ngay). **Encrypted** = true/false. **DelProtect** = true/false.

Bật nhanh nếu đang tắt (thay `<DB_ID>` bằng identifier thật):
```bash
# Bật automated backup 7 ngày + deletion protection
aws rds modify-db-instance --region ap-southeast-1 \
  --db-instance-identifier <DB_ID> \
  --backup-retention-period 7 \
  --deletion-protection \
  --apply-immediately
```

### Thử restore (chứng minh backup dùng được — nên làm 1 lần)
1. RDS → **Automated backups** (hoặc **Snapshots**) → chọn 1 snapshot gần nhất → **Restore to point in time** / **Restore snapshot** thành 1 instance tạm `deutschflow-restore-test`.
2. Kết nối thử (psql) đếm vài bảng → xác nhận dữ liệu có.
3. **Xóa instance tạm** để khỏi tốn tiền.

### ✔️ DoD
- Có bằng chứng (ảnh chụp/CLI output): **Backup retention ≥ 7 ngày**, **Deletion protection = ON**.
- Ghi nhận **Storage encrypted = Yes/No** (nếu No → tạo task Phase 2 mã hóa).
- (Nên) 1 lần restore thử thành công, rồi xóa instance tạm.

---

## 📋 CHECKLIST NHANH (tick khi xong)

- [ ] **#1** Paid Apps Agreement = **Active** + Tax (W-8BEN) Complete + Bank Verified
- [ ] **#2** Branch protection `main` bật (PR + status checks) + notify CI-fail
- [ ] **#3** RDS backup ≥7d + deletion protection ON + ghi nhận encryption Yes/No (+ restore thử)

> Khi xong #1 và #3, báo tôi biết — #1 mở khóa Phase 1 (IAP config), #3 chốt được rủi ro mất dữ liệu để yên tâm submit.
