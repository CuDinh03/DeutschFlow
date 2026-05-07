package com.deutschflow.admin.controller;

import com.deutschflow.system.service.SystemConfigService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/ai-config")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminAiConfigController {

    private final SystemConfigService systemConfigService;

    @GetMapping
    public ResponseEntity<AiConfigDto> getConfig() {
        AiConfigDto config = new AiConfigDto();
        config.setPrompt(systemConfigService.getString("ai.systemPrompt", ""));
        config.setTemperature(systemConfigService.getDouble("ai.temperature", 0.7));
        config.setMaxTokens(systemConfigService.getInteger("ai.maxTokens", 1024));
        config.setTopP(systemConfigService.getDouble("ai.topP", 0.9));
        return ResponseEntity.ok(config);
    }

    @PutMapping
    public ResponseEntity<Void> updateConfig(@RequestBody AiConfigDto dto) {
        if (dto.getPrompt() != null) {
            systemConfigService.setString("ai.systemPrompt", dto.getPrompt(), "Base system prompt for AI interactions");
        }
        if (dto.getTemperature() != null) {
            systemConfigService.setString("ai.temperature", String.valueOf(dto.getTemperature()), "Temperature for AI responses (0-2)");
        }
        if (dto.getMaxTokens() != null) {
            systemConfigService.setString("ai.maxTokens", String.valueOf(dto.getMaxTokens()), "Max tokens for AI responses");
        }
        if (dto.getTopP() != null) {
            systemConfigService.setString("ai.topP", String.valueOf(dto.getTopP()), "Top-P sampling for AI responses (0-1)");
        }
        return ResponseEntity.ok().build();
    }

    @Data
    public static class AiConfigDto {
        private String prompt;
        private Double temperature;
        private Integer maxTokens;
        private Double topP;
    }
}
