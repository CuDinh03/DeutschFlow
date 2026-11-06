package com.deutschflow.user.service;

/**
 * Chuẩn hoá đầu vào tự đăng ký — MỘT bản cho cả {@code /register} cũ lẫn luồng mã PIN, để hai đường
 * không bao giờ hiểu cùng một email/SĐT theo hai cách.
 */
public final class SelfRegistrationInputs {

    private SelfRegistrationInputs() {}

    /**
     * trim + lowercase, khớp admin createUser: email lưu nhất quán để tra không phân biệt hoa/thường luôn
     * trúng, và kiểm tồn tại IgnoreCase chặn bản sao khác hoa/thường (Foo@x.com vs foo@x.com).
     */
    public static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }

    /**
     * SĐT không bắt buộc (App Store 5.1.1(v)). Bỏ trống ⇒ NULL chứ không phải "": cột UNIQUE, Postgres
     * cho nhiều NULL nhưng chỉ một chuỗi rỗng.
     */
    public static String normalizePhone(String phone) {
        return (phone == null || phone.isBlank()) ? null : phone.trim();
    }
}
