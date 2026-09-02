package com.deutschflow.admin.controller;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.exception.BadRequestException;
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

    // A bad ai.maxTokens once starved every AI feature system-wide (Groq TPM incident), so bound the
    // tunables server-side too — the UI sliders alone don't stop a direct API PUT.
    private static final double MIN_TEMPERATURE = 0.0;
    private static final double MAX_TEMPERATURE = 2.0;
    private static final double MIN_TOP_P = 0.0;
    private static final double MAX_TOP_P = 1.0;
    private static final int MIN_MAX_TOKENS = 64;
    private static final int MAX_MAX_TOKENS = 8192;

    private final SystemConfigService systemConfigService;
    private final AuditLogService auditLogService;

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

    @PutMapping
    public ResponseEntity<Void> updateConfig(@RequestBody AiConfigDto dto, Authentication authentication) {
        validate(dto);
        Map<String, Object> changed = new LinkedHashMap<>();
        if (dto.getPrompt() != null) {
            systemConfigService.setString("ai.systemPrompt", dto.getPrompt(), "Base system prompt for AI interactions");
            changed.put("systemPrompt", "updated");
        }
        if (dto.getTemperature() != null) {
            systemConfigService.setString("ai.temperature", String.valueOf(dto.getTemperature()), "Temperature for AI responses (0-2)");
            changed.put("temperature", dto.getTemperature());
        }
        if (dto.getMaxTokens() != null) {
            systemConfigService.setString("ai.maxTokens", String.valueOf(dto.getMaxTokens()), "Max tokens for AI responses");
            changed.put("maxTokens", dto.getMaxTokens());
        }
        if (dto.getTopP() != null) {
            systemConfigService.setString("ai.topP", String.valueOf(dto.getTopP()), "Top-P sampling for AI responses (0-1)");
            changed.put("topP", dto.getTopP());
        }
        // High-impact, system-wide change → leave an audit trail (it had none before).
        auditLogService.log(
                "admin.aiconfig.updated",
                AuditActor.ofAuthentication(authentication),
                "AI_CONFIG",
                "ai",
                changed);
        return ResponseEntity.ok().build();
    }

    private void validate(AiConfigDto dto) {
        if (dto.getTemperature() != null && (dto.getTemperature() < MIN_TEMPERATURE || dto.getTemperature() > MAX_TEMPERATURE)) {
            throw new BadRequestException("temperature phải trong khoảng [" + MIN_TEMPERATURE + ", " + MAX_TEMPERATURE + "]");
        }
        if (dto.getTopP() != null && (dto.getTopP() < MIN_TOP_P || dto.getTopP() > MAX_TOP_P)) {
            throw new BadRequestException("topP phải trong khoảng [" + MIN_TOP_P + ", " + MAX_TOP_P + "]");
        }
        if (dto.getMaxTokens() != null && (dto.getMaxTokens() < MIN_MAX_TOKENS || dto.getMaxTokens() > MAX_MAX_TOKENS)) {
            throw new BadRequestException("maxTokens phải trong khoảng [" + MIN_MAX_TOKENS + ", " + MAX_MAX_TOKENS + "]");
        }
    }


    @Data
    public static class AiConfigDto {
        private String prompt;
        private Double temperature;
        private Integer maxTokens;
        private Double topP;
        // Read-only runtime wiring (surfaced on GET, ignored on PUT).
        private String chatProvider;
        private String chatModel;
        private String gradingModel;
        private String sttModel;
    }
}
