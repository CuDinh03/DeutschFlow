package com.deutschflow.common.telemetry;

import com.deutschflow.common.security.JwtService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.servlet.HandlerMapping;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

/**
 * Cột `endpoint` phải giữ MẪU ROUTE, không phải URI thật.
 *
 * Bối cảnh: đo prod 08/09/2026 thấy 319 trong 443 endpoint khác nhau có chứa số, vì mỗi phiên thi
 * sinh một dòng endpoint riêng. Nhóm `/api/speaking/exam/sessions/{id}/turns` gộp lại có 72 lượt
 * và là endpoint chậm nhất hệ thống, nhưng chẻ nhỏ thì rơi khỏi mọi bảng báo cáo.
 */
@ExtendWith(MockitoExtension.class)
class ApiTelemetryFilterUnitTest {

    @Mock
    ApiTelemetryService apiTelemetryService;

    @Mock
    JwtService jwtService;

    @InjectMocks
    ApiTelemetryFilter filter;

    private ApiTelemetryEvent recordedEvent(MockHttpServletRequest request) throws Exception {
        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());
        ArgumentCaptor<ApiTelemetryEvent> captor = ArgumentCaptor.forClass(ApiTelemetryEvent.class);
        verify(apiTelemetryService).record(captor.capture());
        return captor.getValue();
    }

    @Test
    void ghiMauRouteKhiDispatcherServletDaKhopHandler() throws Exception {
        MockHttpServletRequest request =
                new MockHttpServletRequest("POST", "/api/speaking/exam/sessions/35/turns");
        request.setAttribute(
                HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE,
                "/api/speaking/exam/sessions/{sessionId}/turns");

        assertThat(recordedEvent(request).endpoint())
                .isEqualTo("/api/speaking/exam/sessions/{sessionId}/turns");
    }

    @Test
    void cheDoanSoKhiKhongCoMauRoute() throws Exception {
        // 404 hoặc bị Security chặn trước DispatcherServlet: không có attribute nào để đọc.
        MockHttpServletRequest request =
                new MockHttpServletRequest("GET", "/api/skill-tree/node/114/session");

        assertThat(recordedEvent(request).endpoint())
                .isEqualTo("/api/skill-tree/node/{id}/session");
    }

    @Test
    void giuNguyenDuongDanKhongCoThamSo() throws Exception {
        // Báo cáo admin mặc định lọc đúng chuỗi này — đổi là vỡ trang /v2/admin/reports.
        MockHttpServletRequest request =
                new MockHttpServletRequest("POST", "/api/plan/sessions/submit");

        assertThat(recordedEvent(request).endpoint()).isEqualTo("/api/plan/sessions/submit");
    }

    @Test
    void khongGhiMauBatTatCaKhiDuongDanKhongKhopController() throws Exception {
        // Đo trên prod 08/09: `/api/onboarding/preview/mentor/12345` (404) bị ghi thành `/**` vì
        // Spring khớp nó với handler tài nguyên tĩnh. Ghi vậy thì MỌI lượt 404 gộp làm một dòng và
        // mất sạch đường dẫn thật — phải quay về URI thô đã che định danh.
        MockHttpServletRequest request =
                new MockHttpServletRequest("GET", "/api/onboarding/preview/mentor/12345");
        request.setAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE, "/**");

        assertThat(recordedEvent(request).endpoint())
                .isEqualTo("/api/onboarding/preview/mentor/{id}");
    }

    @Test
    void khongCheDoanChuaChuCai() {
        assertThat(ApiTelemetryFilter.maskPathVariables("/api/v2/students/classes"))
                .isEqualTo("/api/v2/students/classes");
        assertThat(ApiTelemetryFilter.maskPathVariables("/api/auth/me/plan"))
                .isEqualTo("/api/auth/me/plan");
    }

    @Test
    void cheNhieuDoanSoVaDoanCuoi() {
        assertThat(ApiTelemetryFilter.maskPathVariables("/api/plan/sessions/3/7/theory/viewed"))
                .isEqualTo("/api/plan/sessions/{id}/{id}/theory/viewed");
        assertThat(ApiTelemetryFilter.maskPathVariables("/api/speaking/exam/sessions/35"))
                .isEqualTo("/api/speaking/exam/sessions/{id}");
    }

    @Test
    void cheDoanUuid() {
        assertThat(ApiTelemetryFilter.maskPathVariables(
                        "/api/materials/9f8b2c1a-4d3e-4f5a-8b7c-0d1e2f3a4b5c/download"))
                .isEqualTo("/api/materials/{uuid}/download");
    }

    @Test
    void khongNoVoiDuongDanRong() {
        assertThat(ApiTelemetryFilter.maskPathVariables(null)).isEqualTo("/");
        assertThat(ApiTelemetryFilter.maskPathVariables("")).isEqualTo("/");
    }
}
