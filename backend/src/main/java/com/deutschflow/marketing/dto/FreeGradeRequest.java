package com.deutschflow.marketing.dto;

/**
 * Yêu cầu chấm thử miễn phí 1 bài Schreiben B1 (public, không auth).
 *
 * @param name        tên GV/HV (tùy chọn)
 * @param contact     email hoặc số Zalo/điện thoại để founder liên hệ (bắt buộc)
 * @param contactType EMAIL | ZALO | PHONE (tùy chọn, mặc định EMAIL)
 * @param topic       chủ đề bài viết (tùy chọn)
 * @param essay       nội dung bài viết tiếng Đức (bắt buộc, 50–3000 ký tự)
 * @param website     honeypot chống bot — người thật để trống; bot điền vào sẽ bị loại
 */
public record FreeGradeRequest(
        String name,
        String contact,
        String contactType,
        String topic,
        String essay,
        String website
) {}
