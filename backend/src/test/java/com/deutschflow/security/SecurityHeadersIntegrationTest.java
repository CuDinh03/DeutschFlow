package com.deutschflow.security;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * BE-1 (hạ tầng biên 07/09): HSTS phải ra trên MỌI response API. Ghi bằng
 * {@code StaticHeadersWriter} vô điều kiện vì writer HSTS mặc định của Spring chỉ ghi khi
 * {@code request.isSecure()} — sau nginx terminate TLS điều kiện đó không bao giờ đúng
 * (đó chính là lý do prod thiếu header này tới 07/09/2026).
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Security headers")
class SecurityHeadersIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("response API công khai mang HSTS 1 năm + includeSubDomains (không phụ thuộc isSecure)")
    void apiResponses_carryHsts() throws Exception {
        mockMvc.perform(get("/api/public/system/status"))
                .andExpect(status().isOk())
                .andExpect(header().string("Strict-Transport-Security", "max-age=31536000; includeSubDomains"));
    }
}
