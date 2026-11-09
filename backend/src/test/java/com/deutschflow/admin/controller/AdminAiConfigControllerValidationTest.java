package com.deutschflow.admin.controller;

import com.deutschflow.admin.service.AiConfigHistoryService;
import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.system.service.SystemConfigService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Guards the A-2 hardening of {@code PUT /api/admin/ai-config}: the endpoint used to accept any
 * value (no {@code @Valid}, no bounds) and left no audit trail, so a stray {@code maxTokens=0} could
 * starve every AI feature system-wide with nobody the wiser. Đợt 2 admin (09/11/2026): thêm lý do
 * bắt buộc + lịch sử/quay lại — việc ghi nằm ở {@link AiConfigHistoryService}.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("admin ai-config · server-side validation + lý do bắt buộc")
class AdminAiConfigControllerValidationTest {

    private static final String REASON = "Giảm nhiệt độ vì câu trả lời quá lan man";

    @Mock
    private SystemConfigService systemConfigService;
    @Mock
    private AiConfigHistoryService aiConfigHistoryService;

    private AdminAiConfigController controller;

    @BeforeEach
    void setUp() {
        controller = new AdminAiConfigController(systemConfigService, aiConfigHistoryService);
    }

    private static AdminAiConfigController.AiConfigDto dto() {
        AdminAiConfigController.AiConfigDto dto = new AdminAiConfigController.AiConfigDto();
        dto.setReason(REASON);
        return dto;
    }

    @Test
    @DisplayName("rejects maxTokens below the floor and writes nothing (A-2)")
    void rejectsTinyMaxTokens() {
        var dto = dto();
        dto.setMaxTokens(0);

        assertThatThrownBy(() -> controller.updateConfig(dto, null))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(systemConfigService, aiConfigHistoryService);
    }

    @Test
    @DisplayName("rejects temperature outside [0, 2] (A-2)")
    void rejectsOutOfRangeTemperature() {
        var dto = dto();
        dto.setTemperature(5.0);

        assertThatThrownBy(() -> controller.updateConfig(dto, null))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(systemConfigService, aiConfigHistoryService);
    }

    @Test
    @DisplayName("từ chối system prompt vượt trần 8000 ký tự và không ghi gì (F-M7)")
    void rejectsOversizedPrompt() {
        // Prompt này ghép vào MỌI lời gọi AI của hệ thống: một chuỗi khổng lồ vừa đội chi phí token
        // mỗi request vừa đẩy chính nội dung người học ra khỏi cửa sổ ngữ cảnh.
        var dto = dto();
        dto.setPrompt("x".repeat(8001));

        assertThatThrownBy(() -> controller.updateConfig(dto, null))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(systemConfigService, aiConfigHistoryService);
    }

    @Test
    @DisplayName("thiếu lý do hoặc lý do quá ngắn → 400, không ghi gì (đợt 2)")
    void rejectsMissingReason() {
        var dto = new AdminAiConfigController.AiConfigDto();
        dto.setTemperature(0.5);
        assertThatThrownBy(() -> controller.updateConfig(dto, null)).isInstanceOf(BadRequestException.class);

        dto.setReason("ngắn");
        assertThatThrownBy(() -> controller.updateConfig(dto, null)).isInstanceOf(BadRequestException.class);
        verifyNoInteractions(systemConfigService, aiConfigHistoryService);
    }

    @Test
    @DisplayName("prompt đúng 8000 ký tự vẫn được chấp nhận (ranh giới)")
    void acceptsPromptAtTheBoundary() {
        var dto = dto();
        dto.setPrompt("x".repeat(8000));
        when(aiConfigHistoryService.update(any(), eq(REASON), any()))
                .thenReturn(new AiConfigHistoryService.ApplyResult(1L, List.of("systemPrompt")));

        assertThatCode(() -> controller.updateConfig(dto, null)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("giá trị hợp lệ chuyển xuống service cùng lý do đã cắt khoảng trắng + actor")
    void validUpdateDelegatesWithReason() {
        var dto = dto();
        dto.setReason("  " + REASON + "  ");
        dto.setMaxTokens(2000);
        dto.setTemperature(0.7);
        when(aiConfigHistoryService.update(any(), eq(REASON), any()))
                .thenReturn(new AiConfigHistoryService.ApplyResult(9L, List.of("maxTokens")));

        var res = controller.updateConfig(dto, null);

        ArgumentCaptor<AiConfigHistoryService.AiConfigValues> values =
                ArgumentCaptor.forClass(AiConfigHistoryService.AiConfigValues.class);
        verify(aiConfigHistoryService).update(values.capture(), eq(REASON), eq(new AuditActor(null, null, null)));
        assertThat(values.getValue().maxTokens()).isEqualTo(2000);
        assertThat(values.getValue().temperature()).isEqualTo(0.7);
        assertThat(values.getValue().prompt()).isNull();
        assertThat(res.getBody()).containsEntry("historyId", 9L);
    }

    @Test
    @DisplayName("restore: thiếu lý do → 400 và không gọi service; có lý do thì chuyển xuống service")
    void restoreRequiresReason() {
        assertThatThrownBy(() -> controller.restore(5L, null, null)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> controller.restore(5L, new AdminAiConfigController.RestoreRequest(" "), null))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(aiConfigHistoryService);

        when(aiConfigHistoryService.restore(anyLong(), eq(REASON), any()))
                .thenReturn(new AiConfigHistoryService.ApplyResult(6L, List.of("temperature")));
        var out = controller.restore(5L, new AdminAiConfigController.RestoreRequest(REASON), null);
        verify(aiConfigHistoryService).restore(eq(5L), eq(REASON), any());
        assertThat(out).containsEntry("historyId", 6L);
    }

    @Test
    @DisplayName("sha256 của prompt ổn định và không chứa prompt")
    void sha256IsStable() {
        String h = AiConfigHistoryService.sha256("Du bist ein Lehrer");
        assertThat(h).hasSize(64).isEqualTo(AiConfigHistoryService.sha256("Du bist ein Lehrer"));
        assertThat(h).doesNotContain("Lehrer");
        assertThat(AiConfigHistoryService.sha256(null)).isEqualTo(AiConfigHistoryService.sha256(""));
    }
}
