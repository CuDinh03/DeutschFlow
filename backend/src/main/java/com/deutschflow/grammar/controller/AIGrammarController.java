package com.deutschflow.grammar.controller;

import com.deutschflow.common.exception.RateLimitExceededException;
import com.deutschflow.grammar.dto.GrammarExplainRequest;
import com.deutschflow.grammar.dto.GrammarExplanationDto;
import com.deutschflow.grammar.dto.GrammarPracticeRequest;
import com.deutschflow.grammar.dto.GrammarPracticeSuggestionsDto;
import com.deutschflow.grammar.service.AIGrammarService;
import com.deutschflow.grammar.service.AIGrammarService.GrammarCorrectionResult;
import com.deutschflow.grammar.service.AIGrammarService.GrammarAnalysisResult;
import com.deutschflow.speaking.AiRateLimiterService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST API for AI-powered grammar features
 */
@Slf4j
@RestController
@RequestMapping("/api/grammar/ai")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class AIGrammarController {

    private final AIGrammarService aiGrammarService;
    private final AiRateLimiterService aiRateLimiterService;

    /**
     * Correct German grammar
     * POST /api/grammar/ai/correct
     */
    @PostMapping("/correct")
    public ResponseEntity<GrammarCorrectionResult> correctGrammar(
            @AuthenticationPrincipal User user,
            @RequestBody Map<String, String> request) {
        String text = request.get("text");

        if (text == null || text.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        requireTextBudget(user);
        GrammarCorrectionResult result = aiGrammarService.correctGrammar(text);
        return ResponseEntity.ok(result);
    }

    /**
     * Explain grammar rules
     * POST /api/grammar/ai/explain
     */
    @PostMapping("/explain")
    public ResponseEntity<GrammarExplanationDto> explainGrammar(
            @AuthenticationPrincipal User user,
            @RequestBody GrammarExplainRequest request) {
        String text = request.text();

        if (text == null || text.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        requireTextBudget(user);
        String explanation = aiGrammarService.explainGrammar(text);
        return ResponseEntity.ok(new GrammarExplanationDto(text, explanation));
    }

    /**
     * Analyze grammar errors in detail
     * POST /api/grammar/ai/analyze
     */
    @PostMapping("/analyze")
    public ResponseEntity<GrammarAnalysisResult> analyzeGrammar(
            @AuthenticationPrincipal User user,
            @RequestBody Map<String, String> request) {
        String text = request.get("text");

        if (text == null || text.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        requireTextBudget(user);
        GrammarAnalysisResult result = aiGrammarService.analyzeGrammar(text);
        return ResponseEntity.ok(result);
    }

    /**
     * Practice suggestions. Two modes (QA F-7):
     *   - CEFR mode (web default tab): body {cefrLevel, count} → structured {suggestions:[{topic,
     *     description, example}]}.
     *   - Legacy error mode: body {errorType} → the same shape, wrapping the AI text as one item.
     * POST /api/grammar/ai/practice-suggestions
     */
    @PostMapping("/practice-suggestions")
    public ResponseEntity<GrammarPracticeSuggestionsDto> suggestPractice(
            @AuthenticationPrincipal User user,
            @RequestBody GrammarPracticeRequest request) {
        boolean hasCefr = request.cefrLevel() != null && !request.cefrLevel().isBlank();
        boolean hasErrorType = request.errorType() != null && !request.errorType().isBlank();
        if (!hasCefr && !hasErrorType) {
            return ResponseEntity.badRequest().build();
        }

        requireTextBudget(user);

        if (hasCefr) {
            return ResponseEntity.ok(
                    aiGrammarService.suggestPracticeByCefr(request.cefrLevel(), request.count()));
        }

        // Legacy error-type path — return in the unified shape so a single client contract holds.
        String errorType = request.errorType();
        String suggestions = aiGrammarService.suggestPractice(errorType);
        return ResponseEntity.ok(new GrammarPracticeSuggestionsDto(
                List.of(new GrammarPracticeSuggestionsDto.Suggestion(errorType, suggestions, ""))));
    }

    /** Per-user request-rate guard on raw LLM grammar helpers (cost control on top of the quota wallet). */
    private void requireTextBudget(User user) {
        if (!aiRateLimiterService.allow(AiRateLimiterService.Bucket.TEXT, user.getId())) {
            throw new RateLimitExceededException(
                    "Too many AI requests. Please slow down.",
                    aiRateLimiterService.retryAfterSeconds(AiRateLimiterService.Bucket.TEXT, user.getId()));
        }
    }
}
