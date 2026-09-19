package com.deutschflow.user.dto;

import java.time.LocalDate;

/**
 * Toàn bộ thông tin cá nhân mà chính chủ sửa được ở trang Hồ sơ.
 *
 * <p>Tách khỏi {@link AuthResponse} có chủ đích: {@code AuthResponse} là hợp đồng của luồng đăng
 * nhập (mobile phụ thuộc chặt vào nó), còn đây là hợp đồng của màn hình hồ sơ và sẽ còn lớn dần.
 * Trang hồ sơ trước đây nạp {@code /auth/me} nên không thấy được ngày sinh và múi giờ.
 *
 * <p>🪤 Phải dựng từ bản ĐỌC LẠI TỪ DB, không phải từ {@code @AuthenticationPrincipal}:
 * {@code JwtAuthFilter} cache principal ~60 giây nên ngay sau khi khai ngày sinh, principal vẫn
 * còn {@code birthDate = null} và giao diện sẽ tưởng chưa lưu được.
 *
 * @param birthDateLocked ngày sinh đã ghi ⇒ giao diện hiển thị dạng chỉ đọc kèm lối liên hệ hỗ trợ
 *                        (xem {@code UserBirthDateService} để biết vì sao không cho tự sửa)
 */
public record PersonalProfileResponse(
        Long userId,
        String email,
        String displayName,
        String phoneNumber,
        String locale,
        String avatarUrl,
        String role,
        LocalDate birthDate,
        boolean birthDateLocked,
        String notificationTimezone,
        /** Giờ nhắc học 0–23 theo notificationTimezone; null = chưa chọn (Đợt 6). */
        Integer reminderHourLocal
) {}
