package com.deutschflow.common.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * M-2/L-5 — hợp đồng của throttle public: chỉ áp {@code /api/public/**}, chặn 429 khi vượt
 * cửa sổ, và FAIL-OPEN khi Redis chết (throttle là lớp chống lạm dụng, không được làm sập
 * trải nghiệm hợp lệ).
 */
@ExtendWith(MockitoExtension.class)
class PublicApiRateLimitFilterTest {

    private static final int LIMIT = 30;

    @Mock
    private StringRedisTemplate redis;

    @Mock
    private ValueOperations<String, String> valueOps;

    private PublicApiRateLimitFilter filter(boolean enabled) {
        return new PublicApiRateLimitFilter(new ClientIpResolver(1), redis, enabled, LIMIT);
    }

    private MockHttpServletRequest publicRequest() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/public/free-grade");
        request.setRequestURI("/api/public/free-grade");
        request.setRemoteAddr("203.0.113.9");
        return request;
    }

    @Test
    @DisplayName("đường ngoài /api/public/** không bị filter đụng tới")
    void nonPublicPath_skipped() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/auth/me");
        request.setRequestURI("/api/auth/me");
        assertThat(filter(true).shouldNotFilter(request)).isTrue();
    }

    @Test
    @DisplayName("tắt bằng config thì mọi request đều bỏ qua filter")
    void disabled_skipsEverything() {
        assertThat(filter(false).shouldNotFilter(publicRequest())).isTrue();
    }

    @Test
    @DisplayName("dưới ngưỡng: request đi tiếp bình thường")
    void underLimit_passesThrough() throws Exception {
        when(redis.opsForValue()).thenReturn(valueOps);
        when(valueOps.increment(anyString())).thenReturn(3L);

        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter(true).doFilterInternal(publicRequest(), response, chain);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(chain.getRequest()).isNotNull(); // chain đã được gọi
    }

    @Test
    @DisplayName("vượt ngưỡng: 429 + Retry-After, chain không được gọi")
    void overLimit_blockedWith429() throws Exception {
        when(redis.opsForValue()).thenReturn(valueOps);
        when(valueOps.increment(anyString())).thenReturn((long) LIMIT + 1);

        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter(true).doFilterInternal(publicRequest(), response, chain);

        assertThat(response.getStatus()).isEqualTo(429);
        assertThat(response.getHeader("Retry-After")).isNotNull();
        assertThat(Long.parseLong(response.getHeader("Retry-After"))).isBetween(1L, 60L);
        assertThat(response.getContentAsString()).contains("Quá nhiều yêu cầu");
        assertThat(chain.getRequest()).isNull(); // chain KHÔNG được gọi
    }

    @Test
    @DisplayName("Redis ném exception → fail-open, request vẫn đi tiếp")
    void redisDown_failOpen() throws Exception {
        when(redis.opsForValue()).thenThrow(new IllegalStateException("redis down"));

        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter(true).doFilterInternal(publicRequest(), response, chain);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(chain.getRequest()).isNotNull();
    }

    @Test
    @DisplayName("không có Redis bean (null) → fail-open")
    void noRedisBean_failOpen() throws Exception {
        PublicApiRateLimitFilter noRedis =
                new PublicApiRateLimitFilter(new ClientIpResolver(1), null, true, LIMIT);

        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        noRedis.doFilterInternal(publicRequest(), response, chain);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(chain.getRequest()).isNotNull();
    }
}
