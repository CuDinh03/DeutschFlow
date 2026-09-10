package com.deutschflow.moderation.service;

import com.deutschflow.moderation.service.ModerationRateLimiterService.Decision;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * B2 (owner chốt 10/09/2026): 10 báo cáo/giờ + 30/ngày theo người. Chạy trên đường in-memory
 * (không Redis) — đó cũng chính là đường fallback khi Redis chết, nên đây không phải "test cái
 * phụ": hai đường phải cho cùng kết quả và script Lua chỉ là bản Redis của đúng thuật toán này.
 */
class ModerationRateLimiterServiceTest {

    private static ModerationRateLimiterService limiter(boolean enabled, int hourMax, int dayMax) {
        return new ModerationRateLimiterService(enabled, hourMax, 3600, dayMax, 86400, null);
    }

    @Test
    @DisplayName("lần thứ 11 trong một giờ bị chặn với Retry-After trong (0, 3600]; người khác không bị ảnh hưởng")
    void eleventhReportWithinAnHourIsBlocked() {
        ModerationRateLimiterService l = limiter(true, 10, 30);

        for (int i = 1; i <= 10; i++) {
            assertThat(l.decide(1L).allowed()).as("lần %d", i).isTrue();
        }
        Decision eleventh = l.decide(1L);
        assertThat(eleventh.allowed()).isFalse();
        assertThat(eleventh.retryAfterSeconds()).isBetween(1, 3600);

        // Cửa sổ khoá THEO NGƯỜI: người khác vẫn nộp được.
        assertThat(l.decide(2L).allowed()).isTrue();
        // Và lần chặn không "đốt" gì thêm: hỏi lại vẫn chặn với cùng lý do, không đổi thành chặn ngày.
        assertThat(l.decide(1L).retryAfterSeconds()).isBetween(1, 3600);
    }

    @Test
    @DisplayName("cửa sổ NGÀY chặn độc lập: lần 31 bị chặn dù cửa sổ giờ còn chỗ, Retry-After tính theo ngày")
    void dayWindowBlocksIndependentlyOfHourWindow() {
        ModerationRateLimiterService l = limiter(true, 100, 30);

        for (int i = 1; i <= 30; i++) {
            assertThat(l.decide(1L).allowed()).as("lần %d", i).isTrue();
        }
        Decision thirtyFirst = l.decide(1L);
        assertThat(thirtyFirst.allowed()).isFalse();
        // Lượt cũ nhất vừa được ghi ⇒ slot ngày mở lại sau ~86400s: lớn hơn hẳn cửa sổ giờ, tức
        // Retry-After lấy từ ĐÚNG cửa sổ đã chặn chứ không phải cửa sổ ngắn hơn.
        assertThat(thirtyFirst.retryAfterSeconds()).isGreaterThan(3600).isLessThanOrEqualTo(86400);
    }

    @Test
    @DisplayName("enabled=false ⇒ luôn cho qua (đường tắt vận hành khẩn)")
    void disabledAlwaysAllows() {
        ModerationRateLimiterService l = limiter(false, 1, 1);

        for (int i = 0; i < 5; i++) {
            assertThat(l.decide(1L).allowed()).isTrue();
        }
    }

    @Test
    @DisplayName("Decision.blocked kẹp Retry-After tối thiểu 1s — không bao giờ trả 0 để client quay vòng tức thì")
    void blockedDecisionNeverAdvertisesZeroRetry() {
        assertThat(Decision.blocked(0).retryAfterSeconds()).isEqualTo(1);
        assertThat(Decision.blocked(-5).retryAfterSeconds()).isEqualTo(1);
        assertThat(Decision.allow().allowed()).isTrue();
    }
}
