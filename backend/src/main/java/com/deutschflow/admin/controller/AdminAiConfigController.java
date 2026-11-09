package com.deutschflow.admin.controller;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.admin.service.AiConfigHistoryService;
import com.deutschflow.system.service.SystemConfigService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/ai-config")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminAiConfigController {

    private final SystemConfigService systemConfigService;
    private final AiConfigHistoryService aiConfigHistoryService;

    // Real, env-driven model wiring (read-only) so the "Model đang dùng" panel stops hard-coding
    // Claude/Bedrock while prod actually runs these. Defaults mirror application.yml.
    @Value("${app.ai.chat-provider:local}")
    private String chatProvider;
    @Value("${app.ai.groq.model:openai/gpt-oss-20b}")
    private String chatModel;
    @Value("${app.ai.groq.grading-model:openai/gpt-oss-120b}")
    private String gradingModel;
    @Value("${app.ai.groq.whisper-model:whisper-large-v3}")
    private String sttModel;

    @GetMapping
    public ResponseEntity<AiConfigDto> getConfig() {
        AiConfigDto config = new AiConfigDto();
        config.setPrompt(systemConfigService.getString("ai.systemPrompt", ""));
        config.setTemperature(systemConfigService.getDouble("ai.temperature", 0.7));
        config.setMaxTokens(systemConfigService.getInteger("ai.maxTokens", 1024));
        config.setTopP(systemConfigService.getDouble("ai.topP", 0.9));
        config.setChatProvider(chatProvider);
        config.setChatModel(chatModel);
        config.setGradingModel(gradingModel);
        config.setSttModel(sttModel);
        return ResponseEntity.ok(config);
    }

    /**
     * Lưu cấu hình AI. Đợt 2 admin (09/11/2026): bắt buộc {@code reason} 10–500 ký tự, mỗi lần lưu có
     * một dòng {@code ai_config_history} (trước + sau) để xem lại và quay lại — xem
     * {@link AiConfigHistoryService}. Transaction nằm ở service (khoá dòng → ghi → lịch sử → vết).
     */
    @PutMapping
    public ResponseEntity<Map<String, Object>> updateConfig(@RequestBody AiConfigDto dto, Authentication authentication) {
        validate(dto);
        String reason = AdminManagementController.requireReason(dto.getReason());
        var result = aiConfigHistoryService.update(
                new AiConfigHistoryService.AiConfigValues(dto.getPrompt(), dto.getTemperature(), dto.getMaxTokens(), dto.getTopP()),
                reason,
                AuditActor.ofAuthentication(authentication));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("historyId", result.historyId());
        out.put("changed", result.changed());
        return ResponseEntity.ok(out);
    }

    /** Lịch sử cấu hình AI, mới nhất trước — kèm prompt đầy đủ ở before/after để xem diff. */
    @GetMapping("/history")
    public Map<String, Object> history(@RequestParam(defaultValue = "0") int page,
                                       @RequestParam(defaultValue = "20") int size) {
        return aiConfigHistoryService.history(page, size);
    }

    /** Quay lại một bản trong lịch sử (áp {@code after_json} của dòng đó). Bắt buộc lý do; 404 nếu id lạ. */
    @PostMapping("/history/{id}/restore")
    public Map<String, Object> restore(@PathVariable long id,
                                       @RequestBody(required = false) RestoreRequest req,
                                       Authentication authentication) {
        String reason = AdminManagementController.requireReason(req == null ? null : req.reason());
        var result = aiConfigHistoryService.restore(id, reason, AuditActor.ofAuthentication(authentication));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("historyId", result.historyId());
        out.put("changed", result.changed());
        return out;
    }

    public record RestoreRequest(String reason) {}

    private void validate(AiConfigDto dto) {
        AiConfigHistoryService.validate(new AiConfigHistoryService.AiConfigValues(
                dto.getPrompt(), dto.getTemperature(), dto.getMaxTokens(), dto.getTopP()));
    }


    @Data
    public static class AiConfigDto {
        private String prompt;
        private Double temperature;
        private Integer maxTokens;
        private Double topP;
        /** Lý do lưu (bắt buộc 10–500 ký tự khi PUT; bỏ qua ở GET). */
        private String reason;
        // Read-only runtime wiring (surfaced on GET, ignored on PUT).
        private String chatProvider;
        private String chatModel;
        private String gradingModel;
        private String sttModel;
    }
}
