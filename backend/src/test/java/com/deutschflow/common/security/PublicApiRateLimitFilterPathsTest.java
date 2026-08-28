package com.deutschflow.common.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Danh sách đường dẫn công khai được rate-limit là một hợp đồng, không phải một
 * chuỗi config tình cờ.
 *
 * <p>Vì sao cần test này: mọi bề mặt public đều dựa vào chuỗi mặc định trong
 * {@code @Value} để được chặn. Ai đó sửa chuỗi và làm rơi một prefix thì không có
 * gì đỏ — endpoint vẫn chạy, chỉ là hết được bảo vệ, và ta chỉ biết khi bị bơm.
 */
class PublicApiRateLimitFilterPathsTest {

    /** Nguyên văn giá trị mặc định trong {@code @Value} của filter. */
    private static final String DEFAULT_PATHS =
            "/api/onboarding/preview/,/api/onboarding/guest-session,/api/v2/media/by-tag";

    private static PublicApiRateLimitFilter filterWithDefaults() {
        return new PublicApiRateLimitFilter(
                new ClientIpResolver(1), null, true, 30, DEFAULT_PATHS, 120);
    }

    private static boolean isRateLimited(String uri) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI(uri);
        // shouldNotFilter=false nghĩa là filter CÓ chạy cho đường dẫn này.
        return !filterWithDefaults().shouldNotFilter(request);
    }

    @Test
    @DisplayName("guest-session nằm trong danh sách chặn — bề mặt public mới không được để trần")
    void guestSessionIsRateLimited() {
        assertThat(isRateLimited("/api/onboarding/guest-session")).isTrue();
        assertThat(isRateLimited("/api/onboarding/guest-session/11111111-2222-3333-4444-555555555555"))
                .as("PATCH cũng phải bị chặn, nếu không thì bơm phình qua đường sửa")
                .isTrue();
    }

    @Test
    @DisplayName("các bề mặt public có sẵn vẫn được chặn — không làm rơi cái nào khi thêm mới")
    void existingPublicSurfacesStillCovered() {
        assertThat(isRateLimited("/api/onboarding/preview/mentor")).isTrue();
        assertThat(isRateLimited("/api/v2/media/by-tag")).isTrue();
        assertThat(isRateLimited("/api/public/anything")).isTrue();
    }

    @Test
    @DisplayName("đường đã xác thực KHÔNG đi qua filter này — nó chỉ dành cho bề mặt công khai")
    void authedPathsAreNotFiltered() {
        assertThat(isRateLimited("/api/onboarding/profile")).isFalse();
        assertThat(isRateLimited("/api/onboarding/claim")).isFalse();
        assertThat(isRateLimited("/api/onboarding/progress")).isFalse();
    }
}
