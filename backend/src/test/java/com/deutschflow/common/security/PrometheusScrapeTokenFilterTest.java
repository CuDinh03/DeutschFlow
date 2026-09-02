package com.deutschflow.common.security;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.assertj.core.api.Assertions.assertThat;

class PrometheusScrapeTokenFilterTest {

    private static final String TOKEN = "test-scrape-token-0123456789abcdef";

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private MockHttpServletRequest scrapeRequest(String authorizationHeader) {
        var request = new MockHttpServletRequest("GET", "/actuator/prometheus");
        request.setRequestURI("/actuator/prometheus");
        if (authorizationHeader != null) {
            request.addHeader("Authorization", authorizationHeader);
        }
        return request;
    }

    @Test
    void tokenDung_setRolePrometheus() throws Exception {
        var filter = new PrometheusScrapeTokenFilter(TOKEN);
        var request = scrapeRequest("Bearer " + TOKEN);

        assertThat(filter.shouldNotFilter(request)).isFalse();
        filter.doFilterInternal(request, new MockHttpServletResponse(), new MockFilterChain());

        var auth = SecurityContextHolder.getContext().getAuthentication();
        assertThat(auth).isNotNull();
        assertThat(auth.getAuthorities()).extracting(Object::toString)
                .containsExactly("ROLE_PROMETHEUS");
    }

    @Test
    void tokenSai_khongSetAuth() throws Exception {
        var filter = new PrometheusScrapeTokenFilter(TOKEN);
        var request = scrapeRequest("Bearer sai-token-hoan-toan");

        filter.doFilterInternal(request, new MockHttpServletResponse(), new MockFilterChain());

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void thieuHeader_khongSetAuth() throws Exception {
        var filter = new PrometheusScrapeTokenFilter(TOKEN);
        var request = scrapeRequest(null);

        filter.doFilterInternal(request, new MockHttpServletResponse(), new MockFilterChain());

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void tokenConfigRong_filterBatHoat_failClosed() {
        var filter = new PrometheusScrapeTokenFilter("");

        assertThat(filter.shouldNotFilter(scrapeRequest("Bearer " + TOKEN))).isTrue();
    }

    @Test
    void pathKhac_khongLoc() {
        var filter = new PrometheusScrapeTokenFilter(TOKEN);
        var request = new MockHttpServletRequest("GET", "/api/auth/me");
        request.setRequestURI("/api/auth/me");

        assertThat(filter.shouldNotFilter(request)).isTrue();
    }
}
