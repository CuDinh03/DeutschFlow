package com.deutschflow.common.minor;

/**
 * Dữ liệu người giám hộ do điểm gọi cung cấp, TRƯỚC khi kiểm tra và chuẩn hoá.
 *
 * <p>Vì sao là record chứ không phải sáu tham số rời: {@code recordGuardian} đã cần
 * {@code studentUserId}, {@code orgId} và {@code AuditActor}; nhét thêm sáu trường nữa thành chín
 * tham số cùng kiểu {@code String} liền nhau, và một lần đảo chỗ {@code phone}/{@code email} thì
 * trình biên dịch không nói gì cả.
 *
 * <p>Đây KHÔNG phải DTO của HTTP — PR-1B sẽ có DTO riêng cho request và ánh xạ sang đây, để hình
 * dạng payload ngoài đổi không kéo theo chữ ký của tầng nghiệp vụ.
 *
 * @param primary người liên lạc CHÍNH; đặt {@code true} sẽ hạ người chính hiện tại xuống
 */
public record GuardianDraft(
        String fullName,
        StudentGuardian.Relationship relationship,
        String phone,
        String email,
        boolean primary
) {
}
