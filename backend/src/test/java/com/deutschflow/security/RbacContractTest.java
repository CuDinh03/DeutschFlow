package com.deutschflow.security;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RbacContractTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void adminReportShouldRequireAuthentication() throws Exception {
        mockMvc.perform(get("/api/admin/reports/student-plan-progress"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "STUDENT")
    void adminReportShouldRejectStudentRole() throws Exception {
        mockMvc.perform(get("/api/admin/reports/student-plan-progress"))
                .andExpect(status().isForbidden());
    }
}
