package com.deutschflow.admin.support;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.audit.AuditOrgResolver;
import com.deutschflow.common.security.support.SupportSessionContext;
import com.deutschflow.common.security.support.SupportSessionDbGuard;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@DisplayName("SupportSessionReadOnlyFilter — phiên hỗ trợ chỉ đọc")
class SupportSessionReadOnlyFilterTest {

    private static final SupportSessionContext CTX = new SupportSessionContext(77L, 1L, "admin@df.test", 9L);

    @Mock private SupportSessionStore store;
    @Mock private AuditLogService auditLogService;
    @Mock private AuditOrgResolver auditOrgResolver;

    @AfterEach
    void cleanup() {
        SupportSessionDbGuard.exit();
    }

    private SupportSessionReadOnlyFilter filter() {
        return new SupportSessionReadOnlyFilter(store, auditLogService, auditOrgResolver);
    }

    private static MockHttpServletRequest supportRequest(String method, String uri) {
        MockHttpServletRequest r = new MockHttpServletRequest(method, uri);
        r.setAttribute(SupportSessionContext.REQUEST_ATTRIBUTE, CTX);
        return r;
    }

    @Test
    @DisplayName("request không phải phiên hỗ trợ → đi tiếp, không ghi gì")
    void nonSupportPassesThrough() throws Exception {
        MockHttpServletResponse res = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter().doFilter(new MockHttpServletRequest("POST", "/api/anything"), res, chain);

        assertThat(chain.getRequest()).isNotNull();
        verify(store, never()).insertEvent(any(Long.class), anyString(), anyString(), any(Integer.class));
    }

    @ParameterizedTest
    @ValueSource(strings = {"POST", "PUT", "PATCH", "DELETE"})
    @DisplayName("method ghi → 403 SUPPORT_SESSION_READ_ONLY, không đi tiếp chain")
    void writeMethodsDenied(String method) throws Exception {
        MockHttpServletResponse res = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter().doFilter(supportRequest(method, "/api/profile/me"), res, chain);

        assertThat(res.getStatus()).isEqualTo(403);
        assertThat(res.getContentType()).startsWith("application/problem+json");
        assertThat(res.getContentAsString()).contains("SUPPORT_SESSION_READ_ONLY");
        assertThat(chain.getRequest()).isNull();
        verify(store).insertEvent(77L, method, "/api/profile/me", 403);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "/api/v2/admin/x",
            "/api/admin/users",
            "/api/payments/apple/account-token",
            "/api/sse/ticket",
            "/api/auth/refresh",
            "/api/notifications/stream",
            "/api/v2/teacher/classes/3/students/4/comprehensive-report",
            "/api/v2/students/assignments/5/scenario",
            "/api/video-lessons/listening",
            "/api/skill-tree/node/12/session",
            "/api/phase/current",
            "/api/phase/next-action",
            "/api/exam-plan",
            "/api/mock-exams/attempts/me",
            "/api/words/coverage",
            "/api/v2/teacher/materials/jobs/abc/download",
            "/api/v2/students/assignments/presigned-url",
            "/api/ai-speaking/sessions/8/report"
    })
    @DisplayName("GET trong danh sách chặn → 403")
    void deniedGets(String path) throws Exception {
        MockHttpServletResponse res = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter().doFilter(supportRequest("GET", path), res, chain);

        assertThat(res.getStatus()).isEqualTo(403);
        assertThat(res.getContentAsString()).contains("SUPPORT_SESSION_READ_ONLY");
        assertThat(chain.getRequest()).isNull();
    }

    @Test
    @DisplayName("GET thường → đi tiếp TRONG lưới READ ONLY của DB; sự kiện ghi SAU khi tắt cờ")
    void allowedGetRunsInsideDbGuardAndRecordsAfter() throws Exception {
        AtomicBoolean guardDuringChain = new AtomicBoolean(false);
        FilterChain chain = (req, res) -> guardDuringChain.set(SupportSessionDbGuard.isActive());
        AtomicBoolean guardDuringRecord = new AtomicBoolean(true);
        doAnswer(inv -> {
            guardDuringRecord.set(SupportSessionDbGuard.isActive());
            return null;
        }).when(store).insertEvent(eq(77L), eq("GET"), eq("/api/srs/due"), eq(200));

        MockHttpServletRequest req = supportRequest("GET", "/api/srs/due");
        req.setQueryString("limit=5");
        filter().doFilter(req, new MockHttpServletResponse(), chain);

        assertThat(guardDuringChain).isTrue();
        assertThat(guardDuringRecord).isFalse();
        assertThat(SupportSessionDbGuard.isActive()).isFalse();
    }

    @Test
    @DisplayName("GET /api/auth/me được qua (web đọc hồ sơ khi mở trang)")
    void authMeAllowed() throws Exception {
        MockFilterChain chain = new MockFilterChain();
        filter().doFilter(supportRequest("GET", "/api/auth/me"), new MockHttpServletResponse(), chain);
        assertThat(chain.getRequest()).isNotNull();
    }

    @Test
    @DisplayName("POST /api/support-session/end được qua và chạy NGOÀI lưới READ ONLY (cần UPDATE phiên)")
    void endEndpointAllowedOutsideGuard() throws Exception {
        AtomicBoolean guardDuringChain = new AtomicBoolean(true);
        FilterChain chain = (req, res) -> guardDuringChain.set(SupportSessionDbGuard.isActive());
        filter().doFilter(supportRequest("POST", "/api/support-session/end"), new MockHttpServletResponse(), chain);

        assertThat(guardDuringChain).isFalse();
        verify(store).insertEvent(77L, "POST", "/api/support-session/end", 200);
    }

    @Test
    @DisplayName("vết write_denied: tối đa một lần cho mỗi (phiên, method + đường dẫn)")
    void writeDeniedAuditedOncePerPath() throws Exception {
        for (int i = 0; i < 3; i++) {
            filter0().doFilter(supportRequest("POST", "/api/profile/me"), new MockHttpServletResponse(), new MockFilterChain());
        }
        filter0().doFilter(supportRequest("DELETE", "/api/profile/me"), new MockHttpServletResponse(), new MockFilterChain());

        verify(auditLogService, times(1)).log(eq(SupportSessionService.EVENT_WRITE_DENIED), any(AuditActor.class),
                eq("USER"), eq("9"), any(), org.mockito.ArgumentMatchers.argThat(
                        (java.util.Map<String, Object> m) -> "POST".equals(m.get("method"))));
        verify(auditLogService, times(2)).log(eq(SupportSessionService.EVENT_WRITE_DENIED), any(AuditActor.class),
                eq("USER"), eq("9"), any(), anyMap());
    }

    private SupportSessionReadOnlyFilter shared;

    private SupportSessionReadOnlyFilter filter0() {
        if (shared == null) {
            shared = filter();
        }
        return shared;
    }

    @Test
    @DisplayName("chain ném lỗi → vẫn tắt cờ READ ONLY và ghi sự kiện status 500")
    void exceptionStillClearsGuard() {
        FilterChain chain = (req, res) -> {
            throw new IllegalStateException("boom");
        };
        try {
            filter().doFilter(supportRequest("GET", "/api/today/me"), new MockHttpServletResponse(), chain);
        } catch (Exception ignored) {
            // mong đợi
        }
        assertThat(SupportSessionDbGuard.isActive()).isFalse();
        InOrder order = inOrder(store);
        order.verify(store).insertEvent(77L, "GET", "/api/today/me", 500);
    }
}
