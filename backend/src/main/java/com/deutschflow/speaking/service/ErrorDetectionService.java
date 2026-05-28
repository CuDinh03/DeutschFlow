package com.deutschflow.speaking.service;

import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.ErrorCatalog;
import com.deutschflow.speaking.ai.GroqChatClient;
import com.deutschflow.speaking.dto.ErrorDetectionRequest;
import com.deutschflow.speaking.dto.ErrorDetectionResult;
import com.deutschflow.speaking.dto.ErrorItemDto;
import com.deutschflow.speaking.entity.UserGrammarError;
import com.deutschflow.speaking.exception.AiServiceException;
import com.deutschflow.speaking.repository.UserGrammarErrorRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class ErrorDetectionService {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(ErrorDetectionService.class);

    private final GroqChatClient groqChatClient;
    private final UserGrammarErrorRepository errorRepository;
    private final ObjectMapper objectMapper;

    public ErrorDetectionService(GroqChatClient groqChatClient,
                                 UserGrammarErrorRepository errorRepository,
                                 ObjectMapper objectMapper) {
        this.groqChatClient = groqChatClient;
        this.errorRepository = errorRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public ErrorDetectionResult detect(Long userId, ErrorDetectionRequest request) {
        String rawJson;
        try {
            List<ChatMessage> messages = buildMessages(request.text(), request.cefrLevel());
            rawJson = groqChatClient.chatCompletion(messages, null, 0.2, 400).content();
        } catch (AiServiceException e) {
            log.warn("Groq error detection failed for user {}: {}", userId, e.getMessage());
            throw e;
        }

        ParsedDetection parsed = parseDetectionResponse(rawJson, request.text());

        if (!parsed.errors().isEmpty()) {
            persistErrors(userId, request, parsed.errors());
        }

        String severity = computeOverallSeverity(parsed.errors());
        return new ErrorDetectionResult(
                request.text(),
                parsed.correctedText(),
                parsed.feedback(),
                parsed.errors(),
                parsed.errors().size(),
                severity
        );
    }

    private List<ChatMessage> buildMessages(String text, String cefrLevel) {
        String level = (cefrLevel != null && !cefrLevel.isBlank()) ? cefrLevel : "A1";
        String catalogCodes = String.join(", ", ErrorCatalog.ORDERED_CODES);

        String system = """
                Du bist ein strenger Deutschlehrer. Analysiere den deutschen Satz des Schülers auf Grammatikfehler.
                Antworte NUR mit einem JSON-Objekt (kein Markdown, kein Text):
                {
                  "corrected_text": "korrigierter vollständiger Satz oder null wenn korrekt",
                  "feedback": "1-2 ermutigende Sätze auf Englisch",
                  "errors": [
                    {
                      "error_code": "aus dem Katalog",
                      "severity": "BLOCKING | MAJOR | MINOR",
                      "confidence": 0.95,
                      "wrong_span": "falscher Teil",
                      "corrected_span": "richtiger Teil",
                      "rule_vi_short": "kurze Erklärung auf Englisch",
                      "example_correct_de": "korrektes Beispiel"
                    }
                  ]
                }
                Erlaubte error_code Werte: %s
                Schülerniveau: %s. Nur echte Fehler melden, confidence >= 0.7.
                """.formatted(catalogCodes, level);

        return List.of(
                new ChatMessage("system", system),
                new ChatMessage("user", "Analysiere: \"" + text + "\"")
        );
    }

    private ParsedDetection parseDetectionResponse(String rawJson, String originalText) {
        try {
            String cleaned = extractJsonObject(rawJson);
            JsonNode root = objectMapper.readTree(cleaned);

            String corrected = textOrNull(root, "corrected_text");
            String feedback = textOrNull(root, "feedback");
            List<ErrorItemDto> errors = parseErrors(root.get("errors"));

            return new ParsedDetection(
                    corrected != null ? corrected : originalText,
                    feedback != null ? feedback : "Good effort!",
                    errors
            );
        } catch (Exception e) {
            log.warn("Failed to parse error detection JSON: {}", e.getMessage());
            return new ParsedDetection(originalText, "Analysis unavailable.", List.of());
        }
    }

    private List<ErrorItemDto> parseErrors(JsonNode errorsNode) {
        if (errorsNode == null || !errorsNode.isArray()) return List.of();

        List<ErrorItemDto> out = new ArrayList<>();
        for (JsonNode item : errorsNode) {
            if (item == null || item.isNull()) continue;
            String code = textOrNull(item, "error_code");
            if (code == null || !ErrorCatalog.isValid(code)) {
                if (code != null) log.debug("Dropped unknown error_code: {}", code);
                continue;
            }
            String severity = textOrNull(item, "severity");
            if (severity == null) severity = "MINOR";

            Double confidence = null;
            JsonNode confNode = item.get("confidence");
            if (confNode != null && confNode.isNumber()) {
                confidence = Math.max(0.0, Math.min(1.0, confNode.asDouble()));
            }
            if (confidence != null && confidence < 0.7) continue;

            out.add(new ErrorItemDto(
                    code.trim(),
                    severity,
                    confidence,
                    textOrNull(item, "wrong_span"),
                    textOrNull(item, "corrected_span"),
                    textOrNull(item, "rule_vi_short"),
                    textOrNull(item, "example_correct_de")
            ));
        }
        return out;
    }

    private void persistErrors(Long userId, ErrorDetectionRequest request, List<ErrorItemDto> errors) {
        LocalDateTime now = LocalDateTime.now();
        for (ErrorItemDto e : errors) {
            UserGrammarError entity = UserGrammarError.builder()
                    .userId(userId)
                    .sessionId(request.sessionId())
                    .errorCode(e.errorCode())
                    .grammarPoint(e.errorCode())
                    .wrongSpan(e.wrongSpan())
                    .correctedSpan(e.correctedSpan())
                    .ruleViShort(e.ruleViShort())
                    .exampleCorrectDe(e.exampleCorrectDe())
                    .confidence(e.confidence() != null ? BigDecimal.valueOf(e.confidence()) : null)
                    .severity(e.severity())
                    .originalText(request.text())
                    .repairStatus("OPEN")
                    .cefrLevel(request.cefrLevel())
                    .createdAt(now)
                    .build();
            errorRepository.save(entity);
        }
    }

    private String computeOverallSeverity(List<ErrorItemDto> errors) {
        if (errors.isEmpty()) return "NONE";
        boolean hasBlocking = errors.stream().anyMatch(e -> "BLOCKING".equals(e.severity()));
        if (hasBlocking) return "BLOCKING";
        boolean hasMajor = errors.stream().anyMatch(e -> "MAJOR".equals(e.severity()));
        return hasMajor ? "MAJOR" : "MINOR";
    }

    private String extractJsonObject(String input) {
        if (input == null) return "{}";
        int start = input.indexOf('{');
        if (start < 0) return "{}";
        int depth = 0;
        for (int i = start; i < input.length(); i++) {
            char c = input.charAt(i);
            if (c == '{') depth++;
            else if (c == '}') {
                depth--;
                if (depth == 0) return input.substring(start, i + 1);
            }
        }
        int end = input.lastIndexOf('}');
        return (end > start) ? input.substring(start, end + 1) : "{}";
    }

    private String textOrNull(JsonNode node, String field) {
        JsonNode f = node.get(field);
        if (f == null || f.isNull()) return null;
        String text = f.asText(null);
        return (text == null || text.isBlank() || "null".equals(text)) ? null : text;
    }

    private record ParsedDetection(String correctedText, String feedback, List<ErrorItemDto> errors) {}
}
