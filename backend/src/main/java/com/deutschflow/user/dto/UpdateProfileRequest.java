package com.deutschflow.user.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * DTO for student to update their own basic profile info.
 * All fields are optional — only non-null values will be applied.
 */
public record UpdateProfileRequest(

        @Size(min = 2, max = 100, message = "displayName must be 2–100 characters")
        String displayName,

        /** Vietnamese phone number: 0xxxxxxxxx or +84xxxxxxxxx */
        @Pattern(regexp = "^(\\+84|0)[0-9]{8,9}$", message = "phoneNumber must be a valid Vietnamese number")
        String phoneNumber,

        /** UI locale: vi | en | de */
        @Pattern(regexp = "^(vi|en|de)$", message = "locale must be vi, en or de")
        String locale,

        /**
         * Múi giờ nhận thông báo hằng ngày (IANA, ví dụ {@code Asia/Ho_Chi_Minh}).
         * {@code DailyNotificationJob} đọc cột này mỗi giờ để biết 8h/18h của người dùng là lúc nào.
         * Giá trị được đối chiếu với danh sách zone của JVM ở {@code AuthService.updateProfile} —
         * regex ở đây chỉ chặn rác thô, không thay thế phép kiểm đó.
         */
        @Size(max = 50, message = "notificationTimezone must be at most 50 characters")
        @Pattern(regexp = "^[A-Za-z]+(/[A-Za-z0-9_+-]+){1,2}$", message = "notificationTimezone must be an IANA zone id")
        String notificationTimezone
) {}
