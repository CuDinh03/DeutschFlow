package com.deutschflow.grammar.service;

import com.deutschflow.ai.AIModelService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

/**
 * Service for AI-powered grammar correction and explanation
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AIGrammarService {
    
    private final AIModelService aiModelService;
    
    /**
     * Correct German grammar using AI
     */
    public GrammarCorrectionResult correctGrammar(String germanText) {
        log.info("Correcting grammar for text: {}", germanText.substring(0, Math.min(50, germanText.length())));
        
        try {
            String corrected = aiModelService.correctGrammar(germanText);
            String explanation = aiModelService.explainGrammar(germanText);
            
            boolean hasErrors = !germanText.trim().equals(corrected.trim());
            
            return GrammarCorrectionResult.builder()
                    .originalText(germanText)
                    .correctedText(corrected)
                    .explanation(explanation)
                    .hasErrors(hasErrors)
                    .build();
                    
        } catch (Exception e) {
            log.error("Error correcting grammar", e);
            throw new RuntimeException("Grammar correction failed: " + e.getMessage(), e);
        }
    }
    
    /**
     * Explain grammar rules in a sentence
     */
    public String explainGrammar(String germanText) {
        log.info("Explaining grammar for: {}", germanText.substring(0, Math.min(50, germanText.length())));
        
        try {
            return aiModelService.explainGrammar(germanText);
        } catch (Exception e) {
            log.error("Error explaining grammar", e);
            throw new RuntimeException("Grammar explanation failed: " + e.getMessage(), e);
        }
    }
    
    /**
     * Analyze grammar errors and provide detailed feedback
     */
    public GrammarAnalysisResult analyzeGrammar(String germanText) {
        log.info("Analyzing grammar for: {}", germanText.substring(0, Math.min(50, germanText.length())));
        
        try {
            // Get correction
            String corrected = aiModelService.correctGrammar(germanText);
            
            // Get explanation
            String explanation = aiModelService.explainGrammar(germanText);
            
            // Detect error types using AI
            String errorDetectionPrompt = "Identify the types of grammar errors in this German sentence: " + germanText;
            String errorTypes = aiModelService.generate(errorDetectionPrompt, "", 256, 0.3);
            
            // Calculate severity
            boolean hasErrors = !germanText.trim().equals(corrected.trim());
            String severity = determineSeverity(germanText, corrected);
            
            return GrammarAnalysisResult.builder()
                    .originalText(germanText)
                    .correctedText(corrected)
                    .explanation(explanation)
                    .errorTypes(errorTypes)
                    .severity(severity)
                    .hasErrors(hasErrors)
                    .build();
                    
        } catch (Exception e) {
            log.error("Error analyzing grammar", e);
            throw new RuntimeException("Grammar analysis failed: " + e.getMessage(), e);
        }
    }
    
    /**
     * Provide grammar practice suggestions
     */
    public String suggestPractice(String errorType) {
        log.info("Suggesting practice for error type: {}", errorType);
        
        try {
            String instruction = "Suggest 3 practice exercises for improving this German grammar point: " + errorType;
            return aiModelService.generate(instruction, "", 512, 0.7);
        } catch (Exception e) {
            log.error("Error suggesting practice", e);
            throw new RuntimeException("Practice suggestion failed: " + e.getMessage(), e);
        }
    }
    
    /**
     * Determine error severity based on original and corrected text
     */
    private String determineSeverity(String original, String corrected) {
        if (original.trim().equals(corrected.trim())) {
            return "NONE";
        }
        
        // Count differences
        int differences = countDifferences(original, corrected);
        
        if (differences <= 2) {
            return "MINOR";
        } else if (differences <= 5) {
            return "MAJOR";
        } else {
            return "BLOCKING";
        }
    }
    
    /**
     * Count word-level differences between two texts
     */
    private int countDifferences(String text1, String text2) {
        String[] words1 = text1.split("\\s+");
        String[] words2 = text2.split("\\s+");
        
        int differences = Math.abs(words1.length - words2.length);
        int minLength = Math.min(words1.length, words2.length);
        
        for (int i = 0; i < minLength; i++) {
            if (!words1[i].equals(words2[i])) {
                differences++;
            }
        }
        
        return differences;
    }
    
    // DTOs
    
    @lombok.Data
    @lombok.Builder
    public static class GrammarCorrectionResult {
        private String originalText;
        private String correctedText;
        private String explanation;
        private boolean hasErrors;
    }
    
    @lombok.Data
    @lombok.Builder
    public static class GrammarAnalysisResult {
        private String originalText;
        private String correctedText;
        private String explanation;
        private String errorTypes;
        private String severity;
        private boolean hasErrors;
    }
}
