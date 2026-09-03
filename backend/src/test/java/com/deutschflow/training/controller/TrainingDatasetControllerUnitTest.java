package com.deutschflow.training.controller;

import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.training.service.TrainingDatasetService;
import com.deutschflow.unittest.support.MockMvcWithValidation;
import com.deutschflow.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TrainingDatasetControllerUnitTest {

    private MockMvc mvc;
    @Mock TrainingDatasetService trainingDatasetService;
    @Mock AuditLogService auditLogService;

    @InjectMocks
    TrainingDatasetController controller;

    private static User admin() {
        return User.builder().id(1L).email("admin@x.com").displayName("Admin").role(User.Role.ADMIN).build();
    }

    @BeforeEach
    void setup() {
        mvc = MockMvcWithValidation.standaloneWithAdvice(controller);
    }

    @Test
    void controllerConstructedAndMockMvcInitialized() {
        assertNotNull(controller);
        assertNotNull(mvc);
    }

    // ── C2 (F-M10): export corpus PII phải cấm cache ────────────────────────────────

    @Test
    @DisplayName("export conversations đặt Cache-Control: no-store")
    void exportConversations_setsNoStore() {
        when(trainingDatasetService.exportAlpacaJsonl(eq("B1"), eq(false), anyInt()))
                .thenReturn("{\"x\":1}\n");

        var response = controller.exportConversations("B1", false, 100, admin());

        assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
    }

    @Test
    @DisplayName("export errors đặt Cache-Control: no-store")
    void exportErrors_setsNoStore() {
        when(trainingDatasetService.exportErrorSamplesJsonl(anyString(), anyInt()))
                .thenReturn("{\"x\":1}\n");

        var response = controller.exportErrors("A2", 100, admin());

        assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
    }
}
