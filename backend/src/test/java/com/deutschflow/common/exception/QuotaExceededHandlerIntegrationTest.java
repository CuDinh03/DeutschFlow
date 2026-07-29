package com.deutschflow.common.exception;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class QuotaExceededHandlerIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @WithMockUser(roles = "STUDENT")
    void quotaExceeded_shouldReturn429ProblemJsonWithExtensions() throws Exception {
        mockMvc.perform(get("/api/test/quota-exceeded"))
                .andExpect(status().isTooManyRequests())
                .andExpect(content().contentTypeCompatibleWith(MediaType.valueOf("application/problem+json")))
                .andExpect(jsonPath("$.type").value("https://deutschflow.com/errors/quota-exceeded"))
                .andExpect(jsonPath("$.status").value(429))
                .andExpect(jsonPath("$.extensions.code").value("QUOTA_EXCEEDED"))
                .andExpect(jsonPath("$.extensions.planCode").value("FREE"))
                .andExpect(jsonPath("$.extensions.remainingThisMonth").value(0));
    }

    // 2 kênh token (26/07): mã org phải mang TYPE khác "quota-exceeded" — mobile cũ nhận diện
    // upsell qua đuôi type, nên type riêng là thứ chặn CTA "Nâng cấp" mời nhầm staff (P0-02).

    @Test
    @WithMockUser(roles = "TEACHER")
    void orgBudgetExhausted_shouldCarryOwnTypeAndCode() throws Exception {
        mockMvc.perform(get("/api/test/org-budget-exhausted"))
                .andExpect(status().isTooManyRequests())
                .andExpect(content().contentTypeCompatibleWith(MediaType.valueOf("application/problem+json")))
                .andExpect(jsonPath("$.type").value("https://deutschflow.com/errors/org-budget-exhausted"))
                .andExpect(jsonPath("$.extensions.code").value("ORG_BUDGET_EXHAUSTED"));
    }

    @Test
    @WithMockUser(roles = "TEACHER")
    void orgBudgetNotConfigured_shouldCarryOwnTypeAndCode() throws Exception {
        mockMvc.perform(get("/api/test/org-budget-not-configured"))
                .andExpect(status().isTooManyRequests())
                .andExpect(content().contentTypeCompatibleWith(MediaType.valueOf("application/problem+json")))
                .andExpect(jsonPath("$.type").value("https://deutschflow.com/errors/org-budget-not-configured"))
                .andExpect(jsonPath("$.extensions.code").value("ORG_BUDGET_NOT_CONFIGURED"));
    }
}

