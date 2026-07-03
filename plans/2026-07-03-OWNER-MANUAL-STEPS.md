# HƯỚNG DẪN 3 VIỆC "CLICK" — CHỦ DỰ ÁN TỰ LÀM (2026-07-03)

> Ba việc này **không code được** (nằm trên console Apple/GitHub/AWS) nhưng là **đường găng** của launch. Làm càng sớm càng tốt — mục #1 (Apple) có lead-time duyệt ngoài tầm kiểm soát.
> Repo: `CuDinh03/DeutschFlow` · Bundle iOS: `com.cudinh.mydeutschflow` · Team: `4M3CU3X9SS` · Region AWS: `ap-southeast-1`.

**Thứ tự khuyến nghị:** #1 (ngay, chờ Apple duyệt) → #3 (15') → #2 (10').

---

## ✅ VIỆC #1 — Ký Paid Apps Agreement + W-8BEN + Banking (Apple)

**Vì sao gấp:** Đây là **đường găng dài nhất** của cả launch. Không có hợp đồng này ở trạng thái **Active**, mọi sản phẩm In-App Purchase (v1.1) sẽ kẹt "Missing Metadata" và **không submit được**. Ngay cả khi v1.0 nộp free-only, ký ngay để hợp đồng Active sẵn cho v1.1.

**Điều kiện tiên quyết:** bạn là Account Holder (hoặc Admin) của Apple Developer account.

### Bước làm (App Store Connect)
1. Vào **https://appstoreconnect.apple.com** → đăng nhập.
2. Click **Business** (hoặc **Agreements, Tax, and Banking** — tùy giao diện).
3. Ở mục **Agreements**:
   - Tìm hàng **Paid Apps** (Paid Applications Agreement).
   - Nếu trạng thái là "New" hoặc có nút **Set Up** / **Request** → click và **Review Agreement** → tick đồng ý → **Agree/Accept**.
4. **Tax Forms** (điền cho từng khu vực bán — tối thiểu US):
   - Là cá nhân/tổ chức **ngoài Mỹ** → điền **W-8BEN** (cá nhân) hoặc **W-8BEN-E** (công ty).
   - Cần: **Foreign TIN** (mã số thuế cá nhân VN — MST cá nhân), địa chỉ thường trú, quốc gia cư trú thuế = Vietnam.
   - Việt Nam có hiệp định thuế với Mỹ → có thể khai treaty benefits để giảm withholding (mục "Claim of Tax Treaty Benefits").
5. **Bank Account** (nhận doanh thu):
   - Thêm tài khoản ngân hàng VN nhận USD (hoặc VND tùy ngân hàng hỗ trợ). Cần: tên chủ TK khớp danh tính pháp lý, số TK, **SWIFT/BIC** của ngân hàng.
6. **Contact Info**: điền đủ Senior Management / Financial / Technical / Legal contacts (có thể cùng 1 người là bạn).

### ✔️ Định nghĩa hoàn thành (DoD)
- Mục **Agreements → Paid Apps** hiển thị trạng thái **Active** (không còn "Pending" hay cảnh báo vàng).
- Tax form status = **Complete/Approved**; Bank account = **Verified/Active**.

### ⚠️ Lưu ý
- Apple có thể mất **vài giờ → vài ngày** để verify tax/bank. **Đừng đợi tới sát deadline.**
- Tên pháp lý (legal name) khai ở đây **phải khớp** tên bạn dùng cho Privacy Policy / danh tính publisher cá nhân.

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
