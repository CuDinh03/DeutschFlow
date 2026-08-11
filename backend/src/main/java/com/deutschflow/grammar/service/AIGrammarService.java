package com.deutschflow.grammar.service;

import com.deutschflow.ai.AiTextService;
import com.deutschflow.grammar.dto.GrammarPracticeSuggestionsDto;
import com.deutschflow.grammar.dto.GrammarPracticeSuggestionsDto.Suggestion;
import com.deutschflow.speaking.exception.AiServiceException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Service for AI-powered grammar correction and explanation
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AIGrammarService {

    // Đi qua bean OpenAiChatClient đang hoạt động (Groq trên prod) thay vì gọi thẳng AI server
    // tự host — nguyên nhân mọi endpoint ngữ pháp trả 500 trên prod (QA 03/08).
    private final AiTextService aiTextService;
    private final ObjectMapper objectMapper;

    private static final Set<String> CEFR_LEVELS = Set.of("A1", "A2", "B1", "B2", "C1", "C2");
    private static final int MAX_SUGGESTIONS = 10;
    private static final int DEFAULT_SUGGESTIONS = 6;
    
    /**
     * Correct German grammar using AI
     */
    public GrammarCorrectionResult correctGrammar(String germanText) {
        log.info("Correcting grammar for text: {}", germanText.substring(0, Math.min(50, germanText.length())));
        
        try {
            String corrected = aiTextService.correctGrammar(germanText);
            String explanation = aiTextService.explainGrammar(germanText);
            
            boolean hasErrors = !germanText.trim().equals(corrected.trim());
            
            return GrammarCorrectionResult.builder()
                    .originalText(germanText)
                    .correctedText(corrected)
                    .explanation(explanation)
                    .hasErrors(hasErrors)
                    .build();
                    
        } catch (AiServiceException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error correcting grammar", e);
            throw new AiServiceException("Dịch vụ AI tạm thời không khả dụng, vui lòng thử lại.", e);
        }
    }

    /**
     * Explain grammar rules in a sentence
     */
    public String explainGrammar(String germanText) {
        log.info("Explaining grammar for: {}", germanText.substring(0, Math.min(50, germanText.length())));

        try {
            return aiTextService.explainGrammar(germanText);
        } catch (AiServiceException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error explaining grammar", e);
            throw new AiServiceException("Dịch vụ AI tạm thời không khả dụng, vui lòng thử lại.", e);
        }
    }

    /**
     * Analyze grammar errors and provide detailed feedback
     */
    public GrammarAnalysisResult analyzeGrammar(String germanText) {
        log.info("Analyzing grammar for: {}", germanText.substring(0, Math.min(50, germanText.length())));

        try {
            String corrected = aiTextService.correctGrammar(germanText);
            String explanation = aiTextService.explainGrammar(germanText);
            String errorDetectionPrompt = "Identify the types of grammar errors in this German sentence: " + germanText;
            String errorTypes = aiTextService.generate(errorDetectionPrompt, "", 256, 0.3);
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
        } catch (AiServiceException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error analyzing grammar", e);
            throw new AiServiceException("Dịch vụ AI tạm thời không khả dụng, vui lòng thử lại.", e);
        }
    }

    /**
     * Provide grammar practice suggestions
     */
    public String suggestPractice(String errorType) {
        log.info("Suggesting practice for error type: {}", errorType);

        try {
            String instruction = "Suggest 3 practice exercises for improving this German grammar point: " + errorType;
            return aiTextService.generate(instruction, "", 512, 0.7);
        } catch (AiServiceException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error suggesting practice", e);
            throw new AiServiceException("Dịch vụ AI tạm thời không khả dụng, vui lòng thử lại.", e);
        }
    }

    /**
     * Structured practice suggestions for a CEFR level — powers the web "Gợi ý luyện tập" tab.
     *
     * <p>Prompts the LLM (JSON mode, via {@code AiTextService.generate}) for
     * {@code {"suggestions":[{"topic","description","example"}]}} and parses it. Invalid model output
     * degrades to an empty list rather than an error, so the tab renders "no suggestions" instead of
     * a toast (QA F-7: previously the endpoint 400'd on the wrong request shape).
     *
     * @param cefrLevel one of A1..C2 (validated); anything else falls back to A1
     * @param count     desired number of suggestions, clamped to 1..{@value #MAX_SUGGESTIONS}
     */
    public GrammarPracticeSuggestionsDto suggestPracticeByCefr(String cefrLevel, Integer count) {
        String level = normalizeCefr(cefrLevel);
        int n = clampCount(count);
        log.info("Suggesting {} CEFR practice ideas for level {}", n, level);

        String instruction = String.format("""
                Du bist ein Deutschlehrer. Erstelle %d abwechslungsreiche Übungsideen für Lernende \
                auf CEFR-Niveau %s. Antworte NUR mit JSON in genau diesem Format, ohne Vorwort:
                {"suggestions":[{"topic":"<Grammatikthema, kurz>","description":"<1 Satz auf \
                VIETNAMESISCH, was geübt wird>","example":"<ein kurzes deutsches Beispiel>"}]}
                Genau %d Einträge. Keine Nummerierung, keine Markdown-Codezäune.""", n, level, n);

        String raw;
        try {
            raw = aiTextService.generate(instruction, "", Math.min(2000, 400 + n * 140), 0.7);
        } catch (AiServiceException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error generating CEFR practice suggestions", e);
            throw new AiServiceException("Dịch vụ AI tạm thời không khả dụng, vui lòng thử lại.", e);
        }

        return new GrammarPracticeSuggestionsDto(parseSuggestions(raw, n));
    }

    private List<Suggestion> parseSuggestions(String raw, int limit) {
        List<Suggestion> out = new ArrayList<>();
        if (raw == null || raw.isBlank()) {
            return out;
        }
        try {
            // Model may wrap output; slice to the outermost JSON object before parsing.
            int start = raw.indexOf('{');
            int end = raw.lastIndexOf('}');
            String json = (start >= 0 && end > start) ? raw.substring(start, end + 1) : raw;
            JsonNode node = objectMapper.readTree(json).path("suggestions");
            if (node.isArray()) {
                for (JsonNode s : node) {
                    String topic = s.path("topic").asText("").trim();
                    String description = s.path("description").asText("").trim();
                    String example = s.path("example").asText("").trim();
                    if (!topic.isEmpty() || !description.isEmpty()) {
                        out.add(new Suggestion(topic, description, example));
                    }
                    if (out.size() >= limit) {
                        break;
                    }
                }
            }
        } catch (Exception e) {
            log.warn("[Grammar] could not parse CEFR suggestions JSON: {}", e.getMessage());
        }
        return out;
    }

    private String normalizeCefr(String cefrLevel) {
        if (cefrLevel == null) {
            return "A1";
        }
        String v = cefrLevel.trim().toUpperCase();
        return CEFR_LEVELS.contains(v) ? v : "A1";
    }

    private int clampCount(Integer count) {
        if (count == null) {
            return DEFAULT_SUGGESTIONS;
        }
        return Math.max(1, Math.min(MAX_SUGGESTIONS, count));
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
