package com.deutschflow.ai;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AIController {
    
    private final AIModelService aiModelService;
    
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
    public ResponseEntity<Map<String, String>> translateToEnglish(@RequestBody Map<String, String> request) {
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
    public ResponseEntity<Map<String, String>> translateToGerman(@RequestBody Map<String, String> request) {
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
    public ResponseEntity<Map<String, String>> correctGrammar(@RequestBody Map<String, String> request) {
        String germanText = request.get("text");
        String corrected = aiModelService.correctGrammar(germanText);
        return ResponseEntity.ok(Map.of(
            "original", germanText,
            "corrected", corrected
        ));
    }
    
    /**
     * Explain German grammar
     */
    @PostMapping("/grammar/explain")
    public ResponseEntity<Map<String, String>> explainGrammar(@RequestBody Map<String, String> request) {
        String germanText = request.get("text");
        String explanation = aiModelService.explainGrammar(germanText);
        return ResponseEntity.ok(Map.of(
            "text", germanText,
            "explanation", explanation
        ));
    }
    
    /**
     * Generate conversation response
     */
    @PostMapping("/conversation/respond")
    public ResponseEntity<Map<String, String>> conversationRespond(@RequestBody Map<String, String> request) {
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
    public ResponseEntity<Map<String, String>> generate(@RequestBody Map<String, Object> request) {
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
}
