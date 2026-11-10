package com.deutschflow.user.dto;

/**
 * Trả lời {@code POST /api/auth/login} (HTTP 200) khi tài khoản phải qua bước 2FA — hiện là mọi ADMIN.
 *
 * <pre>
 * { "mfaRequired": true, "mfaToken": "&lt;JWT typ=mfa, 5 phút&gt;", "enrolled": false, "emailHint": "a***@x.com" }
 * </pre>
 *
 * <p>CỐ Ý không có {@code accessToken}, {@code refreshToken}, {@code role} (và không đặt cookie refresh): client
 * cũ — kể cả app mobile chỉ nhận STUDENT — đọc thiếu token/role là coi như đăng nhập hỏng, không thể vô tình
 * mở phiên. {@code enrolled=false} → client đi luồng bật 2FA (mã email → QR → mã đầu tiên);
 * {@code true} → nhập mã 6 số hoặc mã khôi phục ở {@code POST /api/auth/mfa/verify}.
 */
public record MfaChallengeResponse(boolean mfaRequired, String mfaToken, boolean enrolled, String emailHint) {
}
