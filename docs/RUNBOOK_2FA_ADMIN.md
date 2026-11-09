# Runbook — Xác thực hai lớp (2FA) bắt buộc cho ADMIN

Áp dụng từ bản có migration **V369** (`backend/src/main/resources/db/migration/V369__admin_mfa.sql`).
Owner chốt 09/11/2026: mọi tài khoản ADMIN bắt buộc TOTP (RFC 6238) + 10 mã khôi phục dùng một lần; lần bật đầu
tiên cần mật khẩu + mã 6 số gửi qua email, rồi xác nhận mã TOTP đầu tiên.

> Trên production hiện chỉ có **một** ADMIN (owner). Đọc kỹ §5 trước khi deploy: nếu khoá ngoài thì không có admin
> thứ hai nào đặt lại 2FA hộ được.

Liên quan: `docs/QUY_TRINH_PHAT_HANH.md` (§6 deploy backend, §8.1 env). Không bao giờ in giá trị khoá ra màn hình,
log, PR hay chat.

---

## 1. Biến môi trường (`/srv/deutschflow/env/backend.env`)

| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| `MFA_ENCRYPTION_KEY` | **Có** (preflight `deploy-backend-vm.sh` chặn nếu thiếu) | base64 của đúng 32 byte — khoá AES-256-GCM mã hoá bí mật TOTP trong `user_mfa.secret_enc`. Thiếu/sai ⇒ backend VẪN chạy, nhưng admin nhận `503 MFA_NOT_CONFIGURED` ở bước đăng nhập (đóng chặt). |
| `MFA_RECOVERY_PEPPER` | **Có** (preflight) | Pepper HMAC của mã khôi phục. Đổi giá trị ⇒ mọi mã khôi phục cũ vô hiệu. |
| `MFA_KEY_ID` | Không (mặc định `k1`) | Ghi kèm từng bí mật đã mã hoá, để sau này xoay khoá. |
| `ADMIN_MFA_ENFORCED` | Không (mặc định `true`) | **Kill-switch**. `false` ⇒ admin CHƯA bật 2FA đăng nhập bằng mật khẩu; admin ĐÃ bật vẫn phải nhập mã. Chỉ dùng theo §5, bật lại ngay. Preflight cảnh báo khi đang `false`. |
| `ADMIN_MFA_MAX_SESSION_HOURS` | Không (mặc định `12`) | Tuổi tối đa của một lần qua 2FA. Quá mốc ⇒ refresh bị từ chối, phải đăng nhập lại. |

Thư mã email đi qua SMTP sẵn có (`spring.mail.*`). SMTP hỏng ⇒ admin CHƯA bật 2FA không bật được
(`503 MFA_EMAIL_UNAVAILABLE`) — xem §5.3.

## 2. Trước khi deploy bản có V369 (làm MỘT lần, trên máy chủ)

```bash
ssh <máy-chủ>        # cách vào máy chủ: QUY_TRINH_PHAT_HANH.md §5.0
ENVF=/srv/deutschflow/env/backend.env
cp -p "$ENVF" "$ENVF.bak-$(date +%Y%m%d%H%M)"        # bản sao lưu cùng quyền
# Chỉ thêm khi CHƯA có — chạy lại lệnh không ghi đè khoá đang dùng. Giá trị không in ra màn hình.
grep -q '^MFA_ENCRYPTION_KEY=' "$ENVF"  || printf 'MFA_ENCRYPTION_KEY=%s\n'  "$(openssl rand -base64 32)" >> "$ENVF"
grep -q '^MFA_RECOVERY_PEPPER=' "$ENVF" || printf 'MFA_RECOVERY_PEPPER=%s\n' "$(openssl rand -base64 32)" >> "$ENVF"
chmod 600 "$ENVF"
grep -cE '^MFA_(ENCRYPTION_KEY|RECOVERY_PEPPER)=.' "$ENVF"   # phải in 2 (đếm dòng, không in giá trị)
```

Sao lưu hai giá trị này vào trình quản lý mật khẩu của owner (mở file bằng `sudoedit`/`nano` rồi chép, KHÔNG `cat`
ra terminal có ghi log). Mất `MFA_ENCRYPTION_KEY` = không giải mã được bí mật TOTP nào ⇒ mọi admin phải đặt lại
2FA (§5.3). Bản sao lưu DB (`backup-db.sh`) KHÔNG chứa khoá — đó là chủ ý.

Kiểm SMTP còn sống (thư quên mật khẩu tới được) — bước bật 2FA cần nó.

## 3. Điều gì xảy ra khi deploy

1. Màu mới chạy V369 (chỉ thêm bảng + một cột NULL trên `refresh_tokens` — tương thích ngược, màu cũ vẫn phục vụ).
2. Khi upstream đổi sang màu mới: **mọi phiên ADMIN đang mở bị đăng xuất**:
   - access token ADMIN không có claim `mfa` ⇒ `401 MFA_REQUIRED` (web xoá token, về `/v2/login?reason=mfa`);
   - refresh token ADMIN không có `mfa_verified_at` ⇒ refresh `401 MFA_REQUIRED`.
   Người dùng khác (học viên, giáo viên, trung tâm) không bị ảnh hưởng.
3. **Owner đăng nhập ngay sau deploy** tại `https://mydeutschflow.com/v2/login`:
   mật khẩu → "Gửi mã qua email" → nhập mã trong thư → quét QR bằng ứng dụng xác thực (hoặc nhập khoá tay) → nhập
   mã 6 số → **lưu 10 mã khôi phục** (tải `.txt` / chép vào trình quản lý mật khẩu, tick "đã lưu") → vào trang.
4. Kiểm sau deploy:
   ```bash
   docker logs --since 10m "$(docker ps --format '{{.Names}}' | grep -m1 deutschflow-backend)" 2>&1 | grep '\[MFA\]'
   # mong đợi: "[MFA] Khoá 2FA đã nạp (keyId=k1)." — KHÔNG có dòng ERROR "MFA_ENCRYPTION_KEY thiếu"
   docker exec deutschflow-postgres psql -U deutschflow_user -d deutschflow -c \
     "SELECT u.id, u.email, m.enabled_at IS NOT NULL AS mfa_on,
             (SELECT count(*) FROM user_mfa_recovery_codes r WHERE r.user_id=u.id AND r.used_at IS NULL) AS codes_left
        FROM users u LEFT JOIN user_mfa m ON m.user_id=u.id WHERE u.role='ADMIN' AND u.is_active;"
   ```

Rollback (`deploy-backend-vm.sh --rollback`): bản cũ bỏ qua các bảng mới; admin đăng nhập bằng mật khẩu như trước.
Deploy lại bản mới sau đó: dữ liệu 2FA còn nguyên, admin chỉ cần nhập mã.

## 4. Vận hành thường ngày

- Mỗi lần đăng nhập: mật khẩu + mã 6 số (hoặc một mã khôi phục — mỗi mã dùng một lần; dùng xong có thông báo + email).
- Phiên 2FA sống tối đa 12 giờ (`ADMIN_MFA_MAX_SESSION_HOURS`), sau đó đăng nhập lại.
- Còn < 3 mã khôi phục ⇒ thông báo + email. Tạo bộ mới: Hồ sơ → Bảo mật → "Tạo mã khôi phục mới" (cần mã 6 số hiện
  tại; bộ cũ hết hiệu lực ngay).
- Nhập sai 5 lần / 15 phút (theo tài khoản và theo IP) ⇒ `429`, chờ hết cửa sổ. Bộ đếm nằm ở Redis
  (`rl:mfa-fail-user|<id>`, `rl:mfa-fail-ip|<ip>`); restart Redis/backend xoá bộ đếm.
- Có từ hai ADMIN trở lên: admin mất điện thoại + hết mã ⇒ admin KHÁC vào `/v2/admin/users/<id>` → "Đặt lại 2FA"
  (bắt buộc lý do, cắt mọi phiên, ghi vết `admin.user.mfa.reset`). Không ai tự đặt lại được cho chính mình.

## 5. Khoá ngoài khi chỉ có MỘT admin

### 5.1 Còn mã khôi phục
Trang đăng nhập → "Dùng mã khôi phục". Vào được thì tạo bộ mã mới (§4) và thêm lại thiết bị nếu cần (§5.2 để
đổi điện thoại: xoá 2FA rồi đăng ký lại).

### 5.2 Mất điện thoại + hết mã, nhưng SMTP và `MFA_ENCRYPTION_KEY` vẫn ổn
Không cần kill-switch: xoá 2FA của admin trong DB, lần đăng nhập tới sẽ là luồng bật 2FA từ đầu (mật khẩu + mã email).

```bash
ssh <máy-chủ>        # cách vào máy chủ: QUY_TRINH_PHAT_HANH.md §5.0
docker exec -it deutschflow-postgres psql -U deutschflow_user -d deutschflow
```
```sql
-- 1) Xác định đúng admin
SELECT id, email FROM users WHERE role = 'ADMIN' AND is_active;
-- 2) Thay 123 bằng id ở trên
BEGIN;
DELETE FROM user_mfa_recovery_codes WHERE user_id = 123;
DELETE FROM mfa_email_codes        WHERE user_id = 123;
DELETE FROM user_mfa               WHERE user_id = 123;
UPDATE refresh_tokens SET revoked = true WHERE user_id = 123 AND NOT revoked;
INSERT INTO audit_logs (event_name, actor_email, actor_role, target_type, target_id, metadata_json)
VALUES ('ops.user.mfa.reset_sql', 'runbook', 'OPS', 'USER', '123',
        '{"reason":"Mất điện thoại và mã khôi phục — đặt lại theo RUNBOOK_2FA_ADMIN §5.2"}'::jsonb);
COMMIT;
```
Rồi đăng nhập và bật lại 2FA như §3 bước 3. Không cần restart backend.

### 5.3 SMTP hỏng, hoặc mất/sai `MFA_ENCRYPTION_KEY` — dùng kill-switch
1. Bật kill-switch và (nếu cần) sửa khoá:
   ```bash
   ENVF=/srv/deutschflow/env/backend.env
   cp -p "$ENVF" "$ENVF.bak-$(date +%Y%m%d%H%M)"
   if grep -q '^ADMIN_MFA_ENFORCED=' "$ENVF"; then sed -i 's/^ADMIN_MFA_ENFORCED=.*/ADMIN_MFA_ENFORCED=false/' "$ENVF"
   else echo 'ADMIN_MFA_ENFORCED=false' >> "$ENVF"; fi
   ```
   Mất `MFA_ENCRYPTION_KEY`: tạo khoá mới (lệnh ở §2, nhưng xoá dòng cũ trước) — mọi bí mật cũ thành rác, nên
   bước 2 phải xoá 2FA của TẤT CẢ admin.
2. Xoá 2FA của admin (SQL ở §5.2; mất khoá thì bỏ điều kiện `user_id` để xoá hết: `DELETE FROM user_mfa;` …).
   Kill-switch chỉ mở cho admin CHƯA bật 2FA — bỏ bước này thì admin vẫn bị hỏi mã.
3. Áp env mới: env chỉ đọc lúc tạo container, nên phải deploy lại (owner ra lệnh): 
   `cd /srv/deutschflow/repo && deploy/self-host/deploy-backend-vm.sh`. Preflight sẽ cảnh báo kill-switch đang tắt.
4. Đăng nhập bằng mật khẩu (không bước 2FA). Sửa nguyên nhân (SMTP, khoá).
5. **Bật lại**: đặt `ADMIN_MFA_ENFORCED=true` (hoặc xoá dòng), deploy lại. Mọi phiên admin bị đăng xuất; đăng nhập
   và bật 2FA như §3 bước 3.
6. Ghi lại sự cố (ngày, lý do, ai làm) trong handoff/nhật ký vận hành.

## 6. Ghi chú kỹ thuật (cho người sửa code)

- Bảng: `user_mfa` (bí mật mã hoá `v1:<keyId>:<base64(iv|ct|tag)>`, AAD = user id; `last_used_step` chống phát lại),
  `user_mfa_recovery_codes` (HMAC-SHA256), `mfa_email_codes` (HMAC, 10 phút, 5 lần sai), `refresh_tokens.mfa_verified_at`.
- Chốt cấp token duy nhất: `AuthService.buildAuthResponse` từ chối ADMIN không mang trạng thái 2FA. Access token
  admin mang `mfa=true` + `mfa_at`; `JwtAuthFilter` đòi `mfa=true` khi kill-switch bật.
- SSE ticket không kiểm lại 2FA: ticket chỉ phát từ request Bearer đã qua kiểm 2FA, dùng một lần, sống 60 s.
- Nhận lời mời trung tâm (`/api/public/org-invitations/*/accept`) và đăng ký bằng mã PIN không cấp phiên cho ADMIN
  (`403 MFA_REQUIRED_USE_LOGIN`) — admin đăng nhập bình thường.
- Xoay khoá (chưa có công cụ): giữ khoá cũ, thêm khoá mới với `MFA_KEY_ID` mới cần code giải mã đa khoá — làm ở PR riêng.
