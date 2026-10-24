package com.deutschflow.marketing.dto;

/**
 * Thân form "Đặt lịch demo" của trang trung tâm. {@code website} là honeypot: người thật để trống.
 *
 * @param studentCount   LT20 | S20_50 | S50_200 | GT200
 * @param contactChannel EMAIL | ZALO | WHATSAPP | PHONE
 * @param locale         ngôn ngữ trang người gửi đang xem (vi | en | de)
 */
public record SchoolDemoRequestPayload(
        String name,
        String organization,
        String country,
        String studentCount,
        String contactChannel,
        String contact,
        String message,
        String locale,
        String website
) {}
