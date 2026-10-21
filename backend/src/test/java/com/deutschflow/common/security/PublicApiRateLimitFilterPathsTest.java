package com.deutschflow.common.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

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

    /** Nguyên văn giá trị mặc định của nhánh fail-closed (R9). */
    private static final String DEFAULT_FAIL_CLOSED_PATHS = "/api/public/report-issues/";

    private static PublicApiRateLimitFilter filterWithDefaults() {
        return new PublicApiRateLimitFilter(
                new ClientIpResolver(1), null, true, 30, DEFAULT_PATHS, 120, DEFAULT_FAIL_CLOSED_PATHS, 20, 300);
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
    @DisplayName("mặc định trong application.yml khớp nguyên văn @Value — yml THẮNG @Value nên lệch là mất chặn")
    void ymlDefaultMatchesValueDefault() throws Exception {
        // 21/10/2026: yml thiếu /api/onboarding/guest-session trong khi @Value có ⇒ test trên vẫn xanh
        // mà prod không throttle phiên khách. Khoá hai nguồn lại với nhau.
        String yml;
        try (InputStream in = getClass().getResourceAsStream("/application.yml")) {
            assertThat(in).as("application.yml trên classpath").isNotNull();
            yml = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
        Matcher m = Pattern.compile(Pattern.quote("${APP_SECURITY_UNAUTH_RATE_LIMIT_PATHS:") + "([^}]*)}").matcher(yml);
        assertThat(m.find()).as("khoá APP_SECURITY_UNAUTH_RATE_LIMIT_PATHS trong application.yml").isTrue();
        assertThat(m.group(1)).isEqualTo(DEFAULT_PATHS);
    }

    @Test
    @DisplayName("danh mục nghề vẫn nằm dưới filter — nới ngân sách, không gỡ throttle")
    void occupationCatalogIsRateLimited() {
        assertThat(isRateLimited("/api/public/occupations")).isTrue();
        assertThat(isRateLimited("/api/public/occupations/kellner")).isTrue();
    }

    @Test
    @DisplayName("đường đã xác thực KHÔNG đi qua filter này — nó chỉ dành cho bề mặt công khai")
    void authedPathsAreNotFiltered() {
        assertThat(isRateLimited("/api/onboarding/profile")).isFalse();
        assertThat(isRateLimited("/api/onboarding/claim")).isFalse();
        assertThat(isRateLimited("/api/onboarding/progress")).isFalse();
    }
}
