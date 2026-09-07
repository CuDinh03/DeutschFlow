package com.deutschflow.system.controller;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import io.micrometer.core.instrument.MeterRegistry;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Hợp đồng của điểm thu vi phạm CSP (QLT-15 / AC-EDGE-02): không auth vẫn nhận (permitAll),
 * hai định dạng giao hàng đều 204 + tăng counter, payload rác không bao giờ 5xx, body quá cỡ
 * bị cắt 413, và preflight CORS cho Reporting API được trả lời.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("CspReportController Integration Tests")
class CspReportControllerIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String PATH = "/api/public/csp-report";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private MeterRegistry meterRegistry;

    private double counted(String directive, String host) {
        return meterRegistry.counter("csp_report_total", "directive", directive, "blocked_host", host)
                .count();
    }

    @Test
    @DisplayName("report-uri cũ (application/csp-report), không auth → 204 và counter tăng")
    void legacyReportUriShape_noAuth_returns204AndCounts() throws Exception {
        double before = counted("script-src-elem", "evil.example");
        String body = """
                {"csp-report":{
                  "document-uri":"https://mydeutschflow.com/v2/login/",
                  "effective-directive":"script-src-elem",
                  "blocked-uri":"https://evil.example/x.js",
                  "source-file":"https://mydeutschflow.com/v2/login/",
                  "line-number":12
                }}""";
        mockMvc.perform(post(PATH)
                        .contentType("application/csp-report")
                        .content(body.getBytes(StandardCharsets.UTF_8)))
                .andExpect(status().isNoContent());
        assertThat(counted("script-src-elem", "evil.example")).isEqualTo(before + 1.0d);
    }

    @Test
    @DisplayName("Reporting API (application/reports+json, mảng có body) → 204 và counter tăng")
    void reportingApiBatchShape_returns204AndCounts() throws Exception {
        double before = counted("connect-src", "tracker.example");
        String body = """
                [{"type":"csp-violation","url":"https://mydeutschflow.com/",
                  "body":{
                    "documentURL":"https://mydeutschflow.com/",
                    "effectiveDirective":"connect-src",
                    "blockedURL":"https://tracker.example/beacon",
                    "sourceFile":"https://mydeutschflow.com/_next/static/chunks/app.js",
                    "lineNumber":1
                  }}]""";
        mockMvc.perform(post(PATH)
                        .contentType("application/reports+json")
                        .content(body.getBytes(StandardCharsets.UTF_8)))
                .andExpect(status().isNoContent());
        assertThat(counted("connect-src", "tracker.example")).isEqualTo(before + 1.0d);
    }

    @Test
    @DisplayName("blocked-uri từ extension trình duyệt → vẫn 204, đếm gộp blocked_host=extension")
    void extensionNoise_isCountedGrouped() throws Exception {
        double before = counted("script-src", "extension");
        String body = """
                {"csp-report":{
                  "effective-directive":"script-src",
                  "blocked-uri":"chrome-extension://abcdef/content.js"
                }}""";
        mockMvc.perform(post(PATH)
                        .contentType("application/csp-report")
                        .content(body.getBytes(StandardCharsets.UTF_8)))
                .andExpect(status().isNoContent());
        assertThat(counted("script-src", "extension")).isEqualTo(before + 1.0d);
    }

    @Test
    @DisplayName("payload rác → 204 (không bao giờ 5xx), đếm _unparseable")
    void garbageBody_neverErrors() throws Exception {
        double before = counted("_unparseable", "_unparseable");
        mockMvc.perform(post(PATH)
                        .contentType("application/json")
                        .content("not-json-at-all".getBytes(StandardCharsets.UTF_8)))
                .andExpect(status().isNoContent());
        assertThat(counted("_unparseable", "_unparseable")).isEqualTo(before + 1.0d);
    }

    @Test
    @DisplayName("body quá 16KB → 413")
    void oversizedBody_returns413() throws Exception {
        byte[] big = new byte[CspReportController.MAX_BODY_BYTES + 1];
        java.util.Arrays.fill(big, (byte) 'a');
        mockMvc.perform(post(PATH).contentType("application/csp-report").content(big))
                .andExpect(status().isPayloadTooLarge());
    }

    @Test
    @DisplayName("preflight CORS của Reporting API được trả lời cho origin cấu hình")
    void reportingApiPreflight_isAnswered() throws Exception {
        mockMvc.perform(options(PATH)
                        .header("Origin", "http://localhost:3000")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "content-type"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:3000"));
    }
}
