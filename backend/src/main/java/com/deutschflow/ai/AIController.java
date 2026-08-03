package com.deutschflow.ai;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.RateLimitExceededException;
import com.deutschflow.speaking.AiRateLimiterService;
import com.deutschflow.user.entity.User;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class AIController {

    private final AIModelService aiModelService;
    // Grammar helpers go through the ACTIVE chat provider (Groq on prod, local server in dev) instead
    // of AIModelService, which only ever talks to the self-hosted Python server — the reason both
    // grammar endpoints answered 500 in production (QA 03/08). See AiTextService.
    private final AiTextService aiTextService;
    private final AiRateLimiterService aiRateLimiterService;

    /**
     * Health check endpoint
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(aiModelService.getHealthStatus());
    }

    /**
     * Translate German to English
     */
    @PostMapping("/translate/to-english")
    public ResponseEntity<Map<String, String>> translateToEnglish(
            @AuthenticationPrincipal User user,
            @RequestBody Map<String, String> request) {
        requireTextBudget(user);
        String germanText = request.get("text");
        String translation = aiModelService.translateToEnglish(germanText);
        return ResponseEntity.ok(Map.of(
            "original", germanText,
            "translation", translation
        ));
    }

    /**
     * Translate English to German
     */
    @PostMapping("/translate/to-german")
    public ResponseEntity<Map<String, String>> translateToGerman(
            @AuthenticationPrincipal User user,
            @RequestBody Map<String, String> request) {
        requireTextBudget(user);
        String englishText = request.get("text");
        String translation = aiModelService.translateToGerman(englishText);
        return ResponseEntity.ok(Map.of(
            "original", englishText,
            "translation", translation
        ));
    }

    /**
     * Correct German grammar
     */
    @PostMapping("/grammar/correct")
    public ResponseEntity<Map<String, String>> correctGrammar(
            @AuthenticationPrincipal User user,
            @RequestBody Map<String, String> request) {
        requireTextBudget(user);
        String germanText = requireText(request);
        String corrected = aiTextService.correctGrammar(germanText);
        return ResponseEntity.ok(Map.of(
            "original", germanText,
            "corrected", corrected
        ));
    }

    /**
     * Explain German grammar
     */
    @PostMapping("/grammar/explain")
    public ResponseEntity<Map<String, String>> explainGrammar(
            @AuthenticationPrincipal User user,
            @RequestBody Map<String, String> request) {
        requireTextBudget(user);
        String germanText = requireText(request);
        String explanation = aiTextService.explainGrammar(germanText);
        return ResponseEntity.ok(Map.of(
            "text", germanText,
            "explanation", explanation
        ));
    }

    /**
     * Generate conversation response
     */
    @PostMapping("/conversation/respond")
    public ResponseEntity<Map<String, String>> conversationRespond(
            @AuthenticationPrincipal User user,
            @RequestBody Map<String, String> request) {
        requireTextBudget(user);
        String userMessage = request.get("message");
        String context = request.getOrDefault("context", "");
        String response = aiModelService.generateConversationResponse(userMessage, context);
        return ResponseEntity.ok(Map.of(
            "userMessage", userMessage,
            "aiResponse", response
        ));
    }

    /**
     * Custom generation
     */
    @PostMapping("/generate")
    public ResponseEntity<Map<String, String>> generate(
            @AuthenticationPrincipal User user,
            @RequestBody Map<String, Object> request) {
        requireTextBudget(user);
        String instruction = (String) request.get("instruction");
        String input = (String) request.getOrDefault("input", "");
        Integer maxTokens = (Integer) request.getOrDefault("maxTokens", 256);
        Double temperature = (Double) request.getOrDefault("temperature", 0.7);

        String response = aiModelService.generate(instruction, input, maxTokens, temperature);
        return ResponseEntity.ok(Map.of(
            "instruction", instruction,
            "input", input,
            "response", response
        ));
    }

    /** Câu tiếng Đức bắt buộc — thiếu/rỗng phải là 400, không phải NPE ở tầng dưới. */
    private String requireText(Map<String, String> request) {
        String text = request == null ? null : request.get("text");
        if (text == null || text.isBlank()) {
            throw new BadRequestException("Vui lòng nhập câu tiếng Đức cần kiểm tra.");
        }
        return text.trim();
    }

    /** Per-user request-rate guard on raw LLM text helpers (cost control on top of the quota wallet). */
    private void requireTextBudget(User user) {
        if (!aiRateLimiterService.allow(AiRateLimiterService.Bucket.TEXT, user.getId())) {
            throw new RateLimitExceededException(
                    "Too many AI requests. Please slow down.",
                    aiRateLimiterService.retryAfterSeconds(AiRateLimiterService.Bucket.TEXT, user.getId()));
        }
    }
}
