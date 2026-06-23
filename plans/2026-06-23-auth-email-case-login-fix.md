# Auth Email-Case Login Fix — Change Record (2026-06-23)

**Trạng thái:** ✅ MERGED + DEPLOYED prod + verified live
**PR:** [#156](https://github.com/CuDinh03/DeutschFlow/pull/156) → `main` merge `0bb93c5d`
**Commits:** `d3c3356f` (core) · `ed738028` (DTO trim + FE follow-up)
**Phạm vi:** 10 files, +258/−11 · backend auth + 1 migration + FE login

---

## TL;DR

Người dùng báo: *admin đặt lại mật khẩu cho tài khoản khác → đăng nhập "báo sai mật khẩu"*.

Sau khi trace toàn bộ: **luồng đặt lại mật khẩu của admin HOÀN TOÀN ĐÚNG** (hash + lưu chuẩn). Thủ phạm thật là **2 lỗi độc lập về email/mật khẩu, không phải lỗi đặt lại mật khẩu**:

1. **Login tra email phân biệt hoa/thường + khoảng trắng** — ghi thì ép chữ thường, đọc lúc login lại khớp tuyệt đối → lệch 1 chữ hoa (bàn phím mobile tự viết hoa) hoặc 1 dấu cách thừa làm "không tìm thấy user", và Spring Security giấu lỗi này thành `BadCredentials` → hiện ra **y hệt sai mật khẩu**.
2. **Quên mật khẩu (OTP) ghi sai cột** — `UPDATE users SET password = ?` trong khi cột thật là `password_hash` → mọi lần reset OTP văng SQL error **sau khi** token đã bị tiêu, mật khẩu không hề đổi.

---

## 1. Triệu chứng (report)

Màn `mydeutschflow.com/v2/admin/users` → mở chi tiết user → mục **"ĐẶT LẠI MẬT KHẨU"** → đặt mật khẩu mới → đăng nhập lại bằng mật khẩu đó → **"Email hoặc mật khẩu không đúng"**.

## 2. Điều tra & Root Cause

### Loại trừ: luồng đặt lại mật khẩu của admin ĐÚNG
- FE [`UserDetailModal.tsx:130`](../frontend/src/app/v2/admin/users/UserDetailModal.tsx) gọi đúng `PATCH /admin/users/{id}/password` với body `{ password }`, gate `length ≥ 8`.
- BE [`AdminManagementService.setUserPassword`](../backend/src/main/java/com/deutschflow/admin/service/AdminManagementService.java) — `passwordEncoder.encode()` (bean `BCryptPasswordEncoder` **duy nhất**) + `save()`, có `@Transactional`.
- Entity [`User.java`](../backend/src/main/java/com/deutschflow/user/entity/User.java) — `getPassword()` trả về đúng `passwordHash`; cột `password_hash` updatable; **không có** `@PreUpdate`/`@EntityListeners` phá hash.
→ Với 1 tài khoản đang `active` + gõ đúng email + đúng mật khẩu, login **bắt buộc** phải thành công. Nếu fail → biến số còn lại chỉ là **email lookup** hoặc **whitespace**.

### Bug A — Email lookup phân biệt hoa/thường (root cause của báo cáo)
- **Ghi** ép chữ thường: `createUser` → `email.trim().toLowerCase()`; seed V234 chữ thường. (`register` thì lưu **nguyên dạng** — không nhất quán.)
- **Đọc lúc login KHÔNG chuẩn hoá:** [`UserDetailsServiceConfig`](../backend/src/main/java/com/deutschflow/common/config/UserDetailsServiceConfig.java) + [`AuthService.login`](../backend/src/main/java/com/deutschflow/user/service/AuthService.java) dùng `findByEmail()` khớp tuyệt đối.
- Cột `email` là `VARCHAR(255) UNIQUE` thường — **không** `citext`, **không** `lower(email)` index, **không** `findByEmailIgnoreCase`.
- `loadUserByUsername` tìm 0 dòng → `UsernameNotFoundException` → `DaoAuthenticationProvider` (mặc định `hideUserNotFoundExceptions=true`) đổi thành `BadCredentialsException` → `AuthService` → `BadRequestException("Invalid email or password")`.

### Bug B — OTP reset ghi cột không tồn tại
- [`PasswordResetService.java:104`](../backend/src/main/java/com/deutschflow/user/service/PasswordResetService.java): `UPDATE users SET password = ? …`. Bảng `users` **chỉ có `password_hash`** (xác nhận qua `information_schema`).
- Token bị `SET used = TRUE` (dòng 101) **trước** UPDATE lỗi (dòng 103) → OTP tiêu mất, mật khẩu không đổi, 500. (Trớ trêu: phần tra email trong chính file này đã đúng `lower(email)` — chứng tỏ login bị bỏ sót.)

## 3. Tái hiện (DB thật, local)

`admin@deutschflow.com` lưu chữ thường:

| Email gõ lúc login | Số dòng `findByEmail` | Kết quả |
|---|---|---|
| `admin@deutschflow.com` | 1 | ✅ vào được |
| `Admin@deutschflow.com` (mobile viết hoa chữ đầu) | 0 | ❌ "sai mật khẩu" |
| `␣admin@deutschflow.com` (autofill/paste dính cách) | 0 | ❌ "sai mật khẩu" |
| `nguyenvanb@gmail.com` (DB lưu `nguyenvanB`, gõ thường) | 0 | ❌ "sai mật khẩu" |
| `lower(email)=lower(...)` (cách sửa) | 1 | ✅ |

Phát hiện thêm: user `nguyenvanB@gmail.com` lưu **mixed-case** (do `register` lưu nguyên dạng) — nguy cơ tài khoản trùng-theo-hoa-thường.

## 4. Thay đổi chi tiết

### Backend
| File | Sửa |
|---|---|
| `user/repository/UserRepository.java` | +`findByEmailIgnoreCase`, +`existsByEmailIgnoreCase` (`WHERE upper(email)=upper(?)`) |
| `common/config/UserDetailsServiceConfig.java` | login tra cứu `findByEmailIgnoreCase(email.trim())` |
| `user/service/AuthService.java` | `login`: trim email + `findByEmailIgnoreCase` (cả lần tra sau auth); `register`: chuẩn hoá `trim().toLowerCase()` + `existsByEmailIgnoreCase` |
| `user/service/PasswordResetService.java` | `SET password` → **`SET password_hash`** |
| `user/dto/LoginRequest.java` | compact constructor **trim email** trước `@Email` (để email dính khoảng trắng không bị 400 ở tầng validation) |

### Frontend
| File | Sửa |
|---|---|
| `app/v2/login/page.tsx` | gửi `email.trim()` — **CHỈ trim, KHÔNG lowercase** (lowercase phía client sẽ làm hỏng login của user lưu mixed-case khi backend cũ còn case-sensitive trong cửa sổ rollout, vì FE auto-deploy Amplify trước backend) |

### Migration — `V238__canonicalize_user_emails.sql`
- Guard chống đụng: nếu có email trùng theo `lower(btrim(email))` → **ABORT** (không tự gộp tài khoản).
- Backfill: `UPDATE users SET email = lower(btrim(email))` cho các dòng chưa chuẩn.
- `CREATE UNIQUE INDEX ux_users_email_lower ON users (lower(email))` — chặn trùng hoa/thường ở tầng DB về sau.

### Cố ý KHÔNG đụng
`createUser` (admin), `OrgInvitationService`/`OrgRosterService`/`AdminOrgService`/`TeacherService` (luồng invite/roster) — đã được unique-index `lower(email)` bảo vệ ở tầng DB. Có thể chuẩn hoá nốt sau cho đồng bộ (follow-up, low-value).

## 5. Tests (+3 file mới / sửa)
- `AuthServiceUnitTest`: +login trim & IgnoreCase, +register chuẩn hoá lowercase, +register chặn trùng hoa/thường; sửa 2 stub `existsByEmail`→`existsByEmailIgnoreCase`.
- `PasswordResetServiceUnitTest` (mới): UPDATE phải nhắm `password_hash`; OTP sai/đã dùng không ghi mật khẩu.
- `LoginRequestTest` (mới): DTO trim email; email null vẫn null.
→ **16 unit test xanh** local.

## 6. Kiểm chứng
- **Unit:** 16 test local xanh; **CI full** (Compile, Unit Tests, SAST, gitleaks, lint) xanh trên commit cuối `ed738028`.
- **E2E (backend chạy thật, local):** register email mixed-case → login bằng **HOA + dấu cách bao quanh** → **HTTP 200 + token**. Sanity: sai mật khẩu vẫn 400.
- **Migration:** V238 apply sạch lúc backend khởi động (`now at version v238`); `nguyenvanB`→`nguyenvanb`; index `ux_users_email_lower` tạo OK. (Local 0 collision.)

## 7. Deploy record (prod)
- Merge `#156` → `main` `0bb93c5d`; branch xoá; local main sync.
- **FE:** Amplify auto-deploy khi merge (an toàn, chỉ trim).
- **Backend:** `./deploy-backend.sh` (blue-green) — preflight OK, sync `.env.production`, EC2 checkout `0bb93c5d`, build image, **GREEN healthy sau 50s ⇒ Flyway V238 apply thành công, KHÔNG abort ⇒ prod không có email trùng hoa/thường**, warm-up, stop BLUE, promote GREEN→`:8080` (`--restart unless-stopped`).
  - Script bị `[INTERRUPTED]` ở vòng poll health **cuối cùng** (cosmetic) — container production đã chạy độc lập trước đó.
- **Verify live trên prod:**
  - `GET /actuator/health` → `{"status":"UP"}`.
  - Probe `POST /api/auth/login` email dính khoảng trắng → trả `"Invalid email or password"` (KHÔNG phải lỗi validation) ⇒ **DTO trim mới đang chạy live**.

## 8. Vận hành — pre-check trước mỗi lần deploy lại
V238 đã chạy 1 lần (idempotent). Nếu cần chạy lại trên môi trường khác, kiểm tra trùng trước (V238 sẽ ABORT an toàn nếu có — blue-green giữ bản cũ, không downtime):
```sql
SELECT lower(btrim(email)) AS norm, count(*), string_agg(email,' | ')
FROM users GROUP BY lower(btrim(email)) HAVING count(*) > 1;
```
→ 0 dòng: an toàn. Có dòng: merge/đổi tên rồi mới deploy.

**Gotcha deploy-backend.sh:** refuse dirty tree (stash file `plans/*` chưa track trước); `read` cleanup cuối làm script **exit 1 dù deploy thành công** → xem health/output EC2 chứ đừng tin exit code.

## 9. Follow-ups (chưa làm)
- Chuẩn hoá email ở `createUser` + luồng org-invite/roster cho đồng bộ (hiện DB index đã chặn).
- Cân nhắc trim email trong `RegisterRequest` (giống `LoginRequest`) để register email dính cách không bị 400.
