# 🚀 LAUNCH RUNBOOK — CHỦ DỰ ÁN TỰ LÀM (v1.0 free-only)

> Đây là **danh sách đầy đủ** những việc **chỉ bạn làm được** (console Apple/GitHub/AWS + deploy qua SSH — môi trường AI **chặn SSH** nên deploy bắt buộc bạn chạy từ laptop). Toàn bộ phần **code + docs đã xong** (branch `chore/phase0-audit-remediation`, 8 commit, đã verify: backend compile ✅, frontend `tsc`+`next build` ✅, java-reviewer APPROVED, `AccountDeletionIT` chứng minh tĩnh PASS).
>
> **Khóa dữ liệu (dán khi cần):** Repo `CuDinh03/DeutschFlow` · Bundle `com.cudinh.mydeutschflow` · Team `4M3CU3X9SS` · Legal entity Apple **`Cu Dinh`** · EC2 `ubuntu@35.175.232.152` · PEM `/Users/dinhcu/Developer/DeutschFlow/deutschflow-key.pem` · Region AWS `ap-southeast-1` · Web `https://mydeutschflow.com` · API `https://api.mydeutschflow.com`.

---

## 📊 TRẠNG THÁI & THỨ TỰ VIỆC CỦA BẠN

| # | Việc của bạn | Thời gian | Chặn submit v1.0? |
|---|---|---|---|
| **1** | **Deploy backend + web** (merge → `deploy-backend.sh`) | 30–45' (+ chờ chạy) | 🔴 CÓ (fix xóa TK + trang pháp lý) |
| **2** | RDS backup + branch protection + UptimeRobot + đổi pass `nvb@gmail.com` | 40' | ⚠️ nên trước deploy (RDS) |
| **3** | Tạo 2 demo account FREE | 20–30' | 🔴 CÓ |
| **4** | App metadata + review notes + screenshots trong ASC | 1–2h | 🔴 CÓ |
| **5** | `eas build production` → `eas submit` → Submit for Review | 1–1.5d | 🔴 CÓ |
| **6** | (tùy chọn) DSA trader status cho EU | 10' | Không (mất EU nếu bỏ) |
| **v1.1** | Paid Apps Agreement + IAP + ads + SePay (sau submit) | — | — |

✅ **Free Apps Agreement đã Active** → v1.0 free-only **không còn chặn bởi agreement**.

---

## 🟥 PHẦN 1 — DEPLOY (đưa fix xóa-tài-khoản + V243 + trang pháp lý lên live)

> **Vì sao gấp nhất:** (a) reviewer sẽ test "Xóa tài khoản" → backend phải có fix trước (nếu không sẽ 500 → reject 5.1.1(v)); (b) URL `/privacy` `/terms` `/support` phải **public** để dán vào ASC → cần web deploy.

### 1.0 — Quyết định: **Merge vào `main`** (khuyến nghị) hay deploy branch-only?

| | **A. Merge `main` rồi deploy** ⭐ | **B. `DEPLOY_BRANCH=… ` branch-only** |
|---|---|---|
| Kết quả | Backend **+ web** cùng lên (Amplify tự deploy web từ `main`) | Chỉ backend; web KHÔNG lên |
| Hợp với ta? | ✅ — ta **cần** trang pháp lý + pricing free-only lên web luôn | Chỉ khi muốn hoãn web |

→ **Chọn A.** Ta cần cả 2. (Side-effect "merge kéo web lên" ở đây là **điều mong muốn**, không phải rủi ro.)

### 1.1 — Tiền đề trước khi deploy (xác nhận nhanh)
- [ ] **RDS có backup**: AWS Console → RDS → instance → **Maintenance & backups** → Automated backups **Enabled**, retention > 0. Nếu chưa → chụp **snapshot thủ công** ngay (RDS → Actions → Take snapshot) TRƯỚC khi deploy (V243 là DDL sửa constraint). *(chi tiết ở Phần 2.1)*
- [ ] **SSH tới EC2 thông**: `ssh -i deutschflow-key.pem -o ConnectTimeout=10 ubuntu@35.175.232.152 'echo ok'` → phải in `ok`. Nếu timeout → IP bạn chưa whitelist port 22 trong Security Group.
- [ ] **Prod đang ở Flyway V241** (để V243 là migration duy nhất chạy): trên EC2 hoặc RDS chạy `SELECT max(version) FROM flyway_schema_history;` → kỳ vọng `241`/`242`.

### 1.2 — Merge branch vào main
```bash
cd /Users/dinhcu/Developer/DeutschFlow
git checkout main && git pull origin main
git merge --no-ff chore/phase0-audit-remediation -m "Merge Phase 0: delete-account fix + V243 + free-only web surface"
git push origin main
```
> ⚠️ **Chưa bật branch protection lúc này** (bật ở Phần 2 SAU khi merge) — để tránh gate CI đỏ chặn merge.
> Push `main` → **Amplify tự build web** (~5–10'). CI backend cũng chạy → job **Unit Tests** sẽ chạy luôn `AccountDeletionIT` (Testcontainers) → xem kết quả per-test.

### 1.3 — Deploy backend (blue-green, từ laptop)
```bash
cd /Users/dinhcu/Developer/DeutschFlow
git status            # PHẢI sạch — script abort nếu cây bẩn
./deploy-backend.sh   # deploy origin/main
```
**Trong lúc chạy — hiểu để không hoảng:**
- Container GREEN dựng ở `:8081`, Flyway chạy **V243** lúc boot, health-gate **300s**.
- Nếu V243/GREEN lỗi → GREEN bị hủy, **BLUE vẫn phục vụ** (an toàn, không mất dữ liệu) → đọc log, sửa, chạy lại.
- Nếu GREEN khỏe → promote sang `:8080`, có **downtime ~60–120s**, **KHÔNG có rollback tự động sau promote**.
- ⚠️ **Cuối script có prompt `Chạy cleanup…? [y/N]` và exit code có thể = 1 DÙ deploy thành công** → **nhìn log "✅ Deploy OK", đừng nhìn exit code.**

### 1.4 — Verify sau deploy
- [ ] `curl -s https://api.mydeutschflow.com/actuator/health` → `{"status":"UP"}`.
- [ ] **Test xóa tài khoản thật**: tạo 1 account rác, gửi cho nó 1 tin nhắn (hoặc để trống), gọi xóa → phải **thành công** (trước fix thì 500 nếu có tin nhắn).
- [ ] Web (Amplify build xong): mở `https://mydeutschflow.com/privacy`, `/terms`, `/support` → hiển thị đầy đủ, **không còn `[[…]]`**, ghi "operated by **Cu Dinh**".
- [ ] Pricing `https://mydeutschflow.com/student/pricing` → chỉ FREE + PRO (coming soon), không còn ULTRA/MoMo/Stripe.

---

## 🟧 PHẦN 2 — GITHUB / AWS HARDENING (rẻ, ~40', làm quanh deploy)

### 2.1 — RDS backup + deletion protection + encryption (làm TRƯỚC deploy)
1. AWS Console → region **ap-southeast-1** → **RDS → Databases → instance DeutschFlow**.
2. Tab **Maintenance & backups → Backup**: **Automated backups Enabled**, **Retention ≥ 7 ngày**. Nếu tắt → **Modify** → Backup retention = 7 → **Apply immediately**.
3. **Modify → Deletion protection = Enabled**.
4. Ghi nhận **Storage encrypted = Yes/No** (nếu No → task Phase 2, cần snapshot→copy-encrypted→restore, có downtime — không chặn submit).
5. (Nên) **Take snapshot** thủ công trước khi deploy V243.
- CLI nhanh: `aws rds describe-db-instances --region ap-southeast-1 --query "DBInstances[].{ID:DBInstanceIdentifier,Backup:BackupRetentionPeriod,DelProtect:DeletionProtection,Encrypted:StorageEncrypted}" --output table`

### 2.2 — Branch protection cho `main` (SAU khi merge ở Phần 1.2)
1. `https://github.com/CuDinh03/DeutschFlow/settings/branches` → **Add branch ruleset** → pattern `main`.
2. ☑️ Require a pull request before merging (approvals = **0**, bạn solo) · ☑️ Require status checks (chọn `Compile`, `Unit Tests`) · ☑️ Block force pushes · ☑️ Restrict deletions.
- CLI: `gh api -X PUT repos/CuDinh03/DeutschFlow/branches/main/protection -F "required_status_checks[strict]=true" -f "required_status_checks[checks][][context]=Unit Tests" -F "enforce_admins=false" -F "restrictions=null" -F "required_pull_request_reviews[required_approving_review_count]=0"`

### 2.3 — UptimeRobot + notify CI-fail + đổi mật khẩu lộ
- [ ] **UptimeRobot** (free) monitor HTTP → `https://api.mydeutschflow.com/actuator/health`, alert email.
- [ ] GitHub → **Settings → Notifications** → bật email khi **Actions workflow failed** (main đã đỏ 7+ ngày không ai biết).
- [ ] 🔴 **Đổi mật khẩu account `nvb@gmail.com`** — mật khẩu cũ `123456` đã lộ trong git history (đã gỡ khỏi test, nhưng phải đổi).

---

## 🟦 PHẦN 3 — TẠO 2 DEMO ACCOUNT (FREE) CHO APP REVIEW

> **KHÔNG viết SQL seed** (dễ tạo state FSRS/skill-tree không hợp lệ → trông "hỏng"). Tạo bằng đăng ký thật.

1. **Account CHÍNH** — đăng ký thật (trên build TestFlight hoặc web) → **dùng app 15–20 phút**: học 3–5 lesson khác nhau, để vài thẻ SRS tới hạn rồi ôn, làm 1 mock exam. Để **FREE** (đừng cấp PRO).
2. **Account PHỤ** — chỉ đăng ký, **KHÔNG** data/KHÔNG nhắn tin/KHÔNG join lớp → dành riêng cho reviewer test **Xóa tài khoản** (để không mất account chính).
3. Cả 2 để **FREE tier**. Reviewer chạm AI sẽ thấy card "Tính năng PRO" (cố ý — đã ghi trong review notes).
4. Ghi lại email/mật khẩu 2 account → **chỉ dán vào ô Review Information của ASC** (KHÔNG commit vào repo).

---

## 🟨 PHẦN 4 — APP STORE CONNECT: METADATA + SUBMIT (v1.0 free-only)

### 4.1 — Metadata (Apps → DeutschFlow → phiên bản 1.0)
- [ ] **Screenshots 6.9"** (iPhone 15/16 Pro Max) — theo `plans/appstore/SCREENSHOTS_ICON_SPEC.md`. Không cần iPad (`supportsTablet:false`).
- [ ] **Name / Subtitle / Keywords / Description** — copy từ `plans/appstore/STORE_COPY.md` (EN + VI).
- [ ] **Privacy Policy URL** = `https://mydeutschflow.com/privacy` · **Support URL** = `https://mydeutschflow.com/support`.
- [ ] **App Privacy (nutrition labels)** — khai theo app **v1.0 THẬT**: có PostHog analytics; **KHÔNG** khai ad-data, **KHÔNG** khai purchase-data (v1.0 chưa có ads/IAP), **KHÔNG** khai Sentry (inactive). `NSPrivacyTracking = false`, không ATT.

### 4.2 — App Review Information
- [ ] **Sign-in required = Yes**; dán **2 demo account** (Phần 3).
- [ ] **Notes to reviewer** — copy nguyên khối free-only từ `plans/appstore/STORE_COPY.md` (§App Review Information — đã viết lại: bỏ ads/subscription, nêu rõ AI là Pro-gated cố ý, hướng dẫn dùng account phụ để test xóa).

### 4.3 — Build & Submit
```bash
cd /Users/dinhcu/Developer/DeutschFlow/mobile
eas build --platform ios --profile production
eas submit --platform ios --latest
```
- [ ] Trong ASC: gắn build vừa lên vào phiên bản 1.0 → **Submit for Review**.
- [ ] ⚠️ Chỉ submit **sau khi Phần 1 (deploy backend) đã live** — nếu không reviewer test xóa TK sẽ dính bug.

---

## 🟩 PHẦN 5 — (TÙY CHỌN) DSA TRADER STATUS (EU)
ASC → **Business → Complete Compliance Requirements** → khai trader/non-trader. Nếu **để trống → app không hiển thị ở EU**. Khai "trader" → Apple hiển thị + verify thông tin liên hệ công khai (đúng khi có ads/IAP ở v1.1). Phân loại là quyết định của bạn (tham chiếu định nghĩa trader của Apple/EU).

---

## 🔵 SAU SUBMIT — v1.1 MONETIZATION (tóm tắt; chi tiết ở Phase 1 của execution-plan)
1. **Paid Apps Agreement**: ASC → Business → **Edit Legal Entity** (Apple đang yêu cầu) → ký Paid Apps → **W-8BEN** (Foreign TIN = MST cá nhân, treaty benefits) → **Bank** (SWIFT/BIC).
2. **IAP backend**: env `APPLE_BUNDLE_ID=com.cudinh.mydeutschflow` (default đang SAI) + **V242** align product IDs + ULTRA `is_active=FALSE` + đăng ký ASSN V2 URL.
3. **ASC**: tạo Subscription Group + PRO monthly/yearly (ID khớp V242) + sandbox tester.
4. **Mobile**: `expo-iap` + paywall 3.1.2 + bật `PAYWALL_ENABLED` iOS + AdMob non-personalized → 1 production build → submit v1.1.
5. **Web**: SePay "gói N ngày" cho student.

---

## 🧯 APPENDIX — DEPLOY TROUBLESHOOTING
- **Exit code 1 dù thành công**: prompt cleanup cuối script exit-1 kể cả khi deploy OK → tin dòng log `✅ Deploy OK — HTTP 200`, không tin exit code.
- **Cây bẩn**: script abort (`git status --porcelain` != rỗng) → commit/stash trước.
- **GREEN fail**: BLUE vẫn chạy, không mất data → `ssh … 'sudo docker logs deutschflow-backend-green --tail 50'` để xem lỗi Flyway/boot.
- **Rollback sau promote**: KHÔNG tự động → thủ công trên EC2 (deploy lại image cũ / commit cũ). Nên deploy giờ thấp điểm.
- Runbook cũ `plans/2026-06-20-deploy-ops-runbook.md` có vài dòng **lỗi thời** (nói script auto-commit — giờ nó ABORT). Tin doc này.
