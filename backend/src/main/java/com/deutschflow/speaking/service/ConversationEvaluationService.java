package com.deutschflow.speaking.service;

import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.dto.ConversationReportDto;
import com.deutschflow.speaking.entity.AiSpeakingMessage;
import com.deutschflow.speaking.entity.AiSpeakingSession;
import com.deutschflow.speaking.repository.AiSpeakingMessageRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Generates and parses a structured, encouraging end-of-session evaluation for
 * COMMUNICATION / LESSON speaking sessions — the conversational counterpart of
 * {@link InterviewEvaluationService}. The raw JSON is stored in
 * {@code AiSpeakingSession.interviewReportJson}; {@link #parseReport} reads it back into a DTO.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ConversationEvaluationService {

    private static final int EVAL_MAX_TOKENS = 1000;
    private static final double EVAL_TEMPERATURE = 0.3;

    private final AiSpeakingMessageRepository messageRepository;
    private final OpenAiChatClient openAiChatClient;
    private final QuotaService quotaService;
    private final ObjectMapper objectMapper;

    /** Generates the evaluation JSON for a conversation/lesson session. Null when there is nothing to assess. */
    public String generateReport(AiSpeakingSession session, Long userId) {
        try {
            List<AiSpeakingMessage> messages = messageRepository.findBySessionIdOrderByCreatedAtAsc(session.getId());
            long userTurns = messages.stream()
                    .filter(m -> m.getRole() == AiSpeakingMessage.MessageRole.USER && m.getUserText() != null)
                    .count();
            if (userTurns == 0) {
                log.info("No user turns for session {}, skipping conversation evaluation", session.getId());
                return null;
            }

            String transcript = buildTranscript(messages);
            String prompt = buildEvaluationPrompt(session, transcript);
            List<ChatMessage> aiMessages = List.of(
                    new ChatMessage("system", prompt),
                    new ChatMessage("user", "Hãy đánh giá buổi luyện nói dựa trên toàn bộ cuộc hội thoại ở trên và xuất kết quả dưới dạng JSON.")
            );

            var snapshot = quotaService.assertAllowed(userId, Instant.now(), 1L);
            int maxTokens = (int) Math.max(1L, Math.min(EVAL_MAX_TOKENS, snapshot.remainingThisMonth()));

            AiChatCompletionResult result = openAiChatClient.chatCompletion(
                    aiMessages, null, EVAL_TEMPERATURE, maxTokens);

            String raw = result.content();
            if (raw != null && raw.contains("{")) {
                int start = raw.indexOf('{');
                int end = raw.lastIndexOf('}');
                if (end > start) {
                    raw = raw.substring(start, end + 1);
                }
            }
            return raw;
        } catch (Exception e) {
            log.error("Failed to generate conversation evaluation for session {}: {}", session.getId(), e.getMessage());
            return null;
        }
    }

    /** Parses the stored evaluation JSON into a DTO; tolerant of missing fields and unparseable JSON. */
    public ConversationReportDto parseReport(AiSpeakingSession session) {
        String json = session.getInterviewReportJson();
        if (json == null || json.isBlank()) {
            return empty(session);
        }
        try {
            JsonNode root = objectMapper.readTree(json);
            JsonNode grammar = root.get("grammar");
            return new ConversationReportDto(
                    session.getId(),
                    session.getTopic(),
                    text(root, "level_estimate", session.getCefrLevel()),
                    parseLeadingNumber(text(root, "overall_score", null)),
                    text(root, "summary_vi", null),
                    list(root, "strengths_vi"),
                    list(root, "improvements_vi"),
                    grammar != null ? text(grammar, "accuracy_pct", null) : null,
                    grammar != null ? list(grammar, "common_errors_vi") : List.of(),
                    text(root, "vocabulary_vi", null),
                    text(root, "fluency_vi", null),
                    list(root, "recommended_next_vi"),
                    text(root, "encouragement_vi", null)
            );
        } catch (Exception e) {
            log.warn("Conversation report JSON unparseable for session {}: {}", session.getId(), e.getMessage());
            return empty(session);
        }
    }

    private ConversationReportDto empty(AiSpeakingSession session) {
        return new ConversationReportDto(session.getId(), session.getTopic(), session.getCefrLevel(),
                null, null, List.of(), List.of(), null, List.of(), null, null, List.of(), null);
    }

    private String buildTranscript(List<AiSpeakingMessage> messages) {
        StringBuilder sb = new StringBuilder();
        for (AiSpeakingMessage msg : messages) {
            if (msg.getRole() == AiSpeakingMessage.MessageRole.USER) {
                sb.append("LERNENDER: ").append(msg.getUserText() != null ? msg.getUserText() : "(kein Text)").append("\n");
            } else {
                sb.append("TUTOR: ").append(msg.getAiSpeechDe() != null ? msg.getAiSpeechDe() : "").append("\n");
            }
        }
        return sb.toString();
    }

    private String buildEvaluationPrompt(AiSpeakingSession session, String transcript) {
        String topic = session.getTopic() != null ? session.getTopic() : "Alltag";
        String level = session.getCefrLevel() != null ? session.getCefrLevel() : "A1";
        return """
                Du bist ein erfahrener, ermutigender Deutsch-Sprachcoach.
                Du hast gerade eine freie Konversations-Übung begleitet (KEIN Interview).
                - Thema: %s
                - Ziel-Niveau (CEFR): %s

                == GESPRÄCHSPROTOKOLL ==
                %s
                == ENDE PROTOKOLL ==

                Erstelle eine ermutigende, konkrete Bewertung als STRICT JSON (kein Markdown).
                Alle Texte auf VIETNAMESISCH (deutsche Fachbegriffe in Klammern wo hilfreich).
                Bewerte FAIR relativ zum Ziel-Niveau %s — es geht um freies Sprechen, nicht um eine Prüfung.

                JSON-Format:
                {
                  "overall_score": "z.B. 7/10",
                  "level_estimate": "geschätztes CEFR-Niveau des Lernenden, z.B. A2",
                  "summary_vi": "1-2 câu tóm tắt buổi luyện nói",
                  "strengths_vi": ["điểm mạnh cụ thể..."],
                  "improvements_vi": ["điểm cần cải thiện cụ thể..."],
                  "grammar": {
                    "accuracy_pct": "ước lượng % câu đúng ngữ pháp, ví dụ 'khoảng 80%%'",
                    "common_errors_vi": ["lỗi ngữ pháp thường gặp trong buổi nói..."]
                  },
                  "vocabulary_vi": "nhận xét về vốn từ đã dùng",
                  "fluency_vi": "nhận xét về độ trôi chảy / tự nhiên",
                  "recommended_next_vi": ["gợi ý luyện tập tiếp theo..."],
                  "encouragement_vi": "lời động viên chân thành dựa trên điểm mạnh thực tế"
                }

                REGELN:
                - strengths_vi, improvements_vi, recommended_next_vi: je 2-4 Einträge, konkret und umsetzbar.
                - common_errors_vi: nur echte Fehler aus dem Protokoll (leer lassen, wenn keine).
                - encouragement_vi: persönlich, bezieht sich auf konkrete Momente im Gespräch.
                - NUR STRICT JSON ausgeben — kein Markdown, kein Text drumherum.
                """.formatted(topic, level, transcript, level);
    }

    private String text(JsonNode node, String field, String fallback) {
        JsonNode v = node.get(field);
        return v == null || v.isNull() ? fallback : v.asText(fallback);
    }

    private List<String> list(JsonNode node, String field) {
        JsonNode arr = node.get(field);
        if (arr == null || !arr.isArray()) {
            return List.of();
        }
        List<String> out = new ArrayList<>();
        arr.forEach(n -> {
            if (n != null && !n.isNull()) {
                String s = n.asText(null);
                if (s != null && !s.isBlank()) {
                    out.add(s);
                }
            }
        });
        return out;
    }

    /** Extracts the leading number from strings like "7/10", "7,5" or "8 / 10"; null when none. */
    static Double parseLeadingNumber(String s) {
        if (s == null) {
            return null;
        }
        var m = java.util.regex.Pattern.compile("(\\d+(?:[.,]\\d+)?)").matcher(s);
        if (!m.find()) {
            return null;
        }
        try {
            return new BigDecimal(m.group(1).replace(',', '.')).setScale(2, RoundingMode.HALF_UP).doubleValue();
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
