package com.deutschflow.contract;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class W2OpenApiContractTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void shouldExposeW2OpenApiGroup() throws Exception {
        mockMvc.perform(get("/v3/api-docs/w2"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("application/json"))
                .andExpect(jsonPath("$.paths['/api/auth/login']").exists())
                .andExpect(jsonPath("$.paths['/api/plan/me']").exists())
                .andExpect(jsonPath("$.paths['/api/words']").exists())
                .andExpect(jsonPath("$.paths['/api/admin/reports/student-plan-progress']").exists());
    }

    @Test
    void shouldKeepSecuredEndpointUnauthorizedWithoutToken() throws Exception {
        mockMvc.perform(get("/api/plan/me"))
                .andExpect(status().isForbidden());
    }
}
