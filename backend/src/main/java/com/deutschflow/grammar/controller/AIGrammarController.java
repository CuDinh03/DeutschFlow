package com.deutschflow.grammar.controller;

import com.deutschflow.grammar.service.AIGrammarService;
import com.deutschflow.grammar.service.AIGrammarService.GrammarCorrectionResult;
import com.deutschflow.grammar.service.AIGrammarService.GrammarAnalysisResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * REST API for AI-powered grammar features
 */
@Slf4j
@RestController
@RequestMapping("/api/grammar/ai")
@RequiredArgsConstructor
public class AIGrammarController {
    
    private final AIGrammarService aiGrammarService;
    
    /**
     * Correct German grammar
     * POST /api/grammar/ai/correct
     */
    @PostMapping("/correct")
    public ResponseEntity<GrammarCorrectionResult> correctGrammar(@RequestBody Map<String, String> request) {
        String text = request.get("text");
        
        if (text == null || text.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        
        GrammarCorrectionResult result = aiGrammarService.correctGrammar(text);
        return ResponseEntity.ok(result);
    }
    
    /**
     * Explain grammar rules
     * POST /api/grammar/ai/explain
     */
    @PostMapping("/explain")
    public ResponseEntity<Map<String, String>> explainGrammar(@RequestBody Map<String, String> request) {
        String text = request.get("text");
        
        if (text == null || text.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        
        String explanation = aiGrammarService.explainGrammar(text);
        return ResponseEntity.ok(Map.of(
            "text", text,
            "explanation", explanation
        ));
    }
    
    /**
     * Analyze grammar errors in detail
     * POST /api/grammar/ai/analyze
     */
    @PostMapping("/analyze")
    public ResponseEntity<GrammarAnalysisResult> analyzeGrammar(@RequestBody Map<String, String> request) {
        String text = request.get("text");
        
        if (text == null || text.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        
        GrammarAnalysisResult result = aiGrammarService.analyzeGrammar(text);
        return ResponseEntity.ok(result);
    }
    
    /**
     * Get practice suggestions for specific error type
     * POST /api/grammar/ai/practice-suggestions
     */
    @PostMapping("/practice-suggestions")
    public ResponseEntity<Map<String, String>> suggestPractice(@RequestBody Map<String, String> request) {
        String errorType = request.get("errorType");
        
        if (errorType == null || errorType.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        
        String suggestions = aiGrammarService.suggestPractice(errorType);
        return ResponseEntity.ok(Map.of(
            "errorType", errorType,
            "suggestions", suggestions
        ));
    }
}
