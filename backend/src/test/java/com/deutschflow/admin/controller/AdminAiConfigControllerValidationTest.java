package com.deutschflow.admin.controller;

import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.system.service.SystemConfigService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * Guards the A-2 hardening of {@code PUT /api/admin/ai-config}: the endpoint used to accept any
 * value (no {@code @Valid}, no bounds) and left no audit trail, so a stray {@code maxTokens=0} could
 * starve every AI feature system-wide with nobody the wiser.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("admin ai-config · server-side validation + audit")
class AdminAiConfigControllerValidationTest {

    @Mock
    private SystemConfigService systemConfigService;
    @Mock
    private AuditLogService auditLogService;

    private AdminAiConfigController controller;

    @BeforeEach
    void setUp() {
        controller = new AdminAiConfigController(systemConfigService, auditLogService);
    }

    @Test
    @DisplayName("rejects maxTokens below the floor and writes nothing (A-2)")
    void rejectsTinyMaxTokens() {
        AdminAiConfigController.AiConfigDto dto = new AdminAiConfigController.AiConfigDto();
        dto.setMaxTokens(0);

        assertThatThrownBy(() -> controller.updateConfig(dto, null))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(systemConfigService, auditLogService);
    }

    @Test
    @DisplayName("rejects temperature outside [0, 2] (A-2)")
    void rejectsOutOfRangeTemperature() {
        AdminAiConfigController.AiConfigDto dto = new AdminAiConfigController.AiConfigDto();
        dto.setTemperature(5.0);

        assertThatThrownBy(() -> controller.updateConfig(dto, null))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(systemConfigService, auditLogService);
    }

    @Test
    @DisplayName("valid values persist and leave an audit trail (A-2)")
    void validUpdatePersistsAndAudits() {
        AdminAiConfigController.AiConfigDto dto = new AdminAiConfigController.AiConfigDto();
        dto.setMaxTokens(2000);
        dto.setTemperature(0.7);

        assertThatCode(() -> controller.updateConfig(dto, null)).doesNotThrowAnyException();

        verify(systemConfigService).setString(eq("ai.maxTokens"), eq("2000"), anyString());
        verify(auditLogService).log(
                eq("admin.aiconfig.updated"), isNull(), isNull(), isNull(),
                eq("AI_CONFIG"), eq("ai"), anyMap());
    }
}
