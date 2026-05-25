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
                .andExpect(jsonPath("$.extensions.planCode").value("FREE"))
                .andExpect(jsonPath("$.extensions.remainingThisMonth").value(0));
    }
}

