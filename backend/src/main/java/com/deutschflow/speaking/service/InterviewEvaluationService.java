package com.deutschflow.speaking.service;

import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.entity.AiSpeakingMessage;
import com.deutschflow.speaking.entity.AiSpeakingSession;
import com.deutschflow.speaking.repository.AiSpeakingMessageRepository;
import com.deutschflow.common.quota.QuotaService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Generates a structured evaluation report when an INTERVIEW session ends.
 * Uses the full conversation history to assess the candidate across 4 dimensions.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class InterviewEvaluationService {

    private static final int EVAL_MAX_TOKENS = 1200;
    private static final double EVAL_TEMPERATURE = 0.3;

    private final AiSpeakingMessageRepository messageRepository;
    private final OpenAiChatClient openAiChatClient;
    private final QuotaService quotaService;

    /**
     * Generates a JSON evaluation report for the given interview session.
     * Returns the raw JSON string to be stored in the session entity.
     */
    public String generateReport(AiSpeakingSession session, Long userId) {
        try {
            List<AiSpeakingMessage> messages = messageRepository.findBySessionIdOrderByCreatedAtAsc(session.getId());
            if (messages.isEmpty()) {
                log.warn("No messages found for interview session {}, skipping evaluation", session.getId());
                return null;
            }

            String conversationSummary = buildConversationSummary(messages);
            String evalPrompt = buildEvaluationPrompt(session, conversationSummary);

            List<ChatMessage> aiMessages = List.of(
                    new ChatMessage("system", evalPrompt),
                    new ChatMessage("user", "Hãy đánh giá buổi phỏng vấn dựa trên toàn bộ cuộc hội thoại ở trên và xuất kết quả dưới dạng JSON.")
            );

            var snapshot = quotaService.assertAllowed(userId, Instant.now(), 1L);
            int maxTokens = (int) Math.max(1L, Math.min(EVAL_MAX_TOKENS, snapshot.remainingThisMonth()));

            AiChatCompletionResult result = openAiChatClient.chatCompletion(
                    aiMessages, null, EVAL_TEMPERATURE, maxTokens);

            String raw = result.content();
            // Extract JSON from possible markdown fences
            if (raw != null && raw.contains("{")) {
                int start = raw.indexOf('{');
                int end = raw.lastIndexOf('}');
                if (end > start) {
                    raw = raw.substring(start, end + 1);
                }
            }
            return raw;
        } catch (Exception e) {
            log.error("Failed to generate interview evaluation for session {}: {}", session.getId(), e.getMessage());
            return null;
        }
    }

    private String buildConversationSummary(List<AiSpeakingMessage> messages) {
        StringBuilder sb = new StringBuilder();
        for (AiSpeakingMessage msg : messages) {
            if (msg.getRole() == AiSpeakingMessage.MessageRole.USER) {
                sb.append("KANDIDAT: ").append(msg.getUserText() != null ? msg.getUserText() : "(kein Text)").append("\n\n");
            } else {
                sb.append("INTERVIEWER: ").append(msg.getAiSpeechDe() != null ? msg.getAiSpeechDe() : "").append("\n\n");
            }
        }
        return sb.toString();
    }

    private String buildEvaluationPrompt(AiSpeakingSession session, String conversationSummary) {
        String position = session.getInterviewPosition() != null ? session.getInterviewPosition() : "Allgemein";
        String experience = session.getExperienceLevel() != null ? session.getExperienceLevel() : "unbekannt";
        String cefrLevel = session.getCefrLevel() != null ? session.getCefrLevel() : "A1";

        return """
                Du bist ein erfahrener HR-Berater mit 15+ Jahren Erfahrung im Recruiting.
                
                Du hast gerade ein Bewerbungsgespräch beobachtet. Hier sind die Details:
                - Position: %s
                - Erfahrungslevel des Kandidaten: %s
                - Deutsch-Niveau (CEFR): %s
                
                == GESPRÄCHSPROTOKOLL ==
                %s
                == ENDE PROTOKOLL ==
                
                Erstelle eine DETAILLIERTE Bewertung als STRICT JSON (kein Markdown).
                Die Bewertung soll auf VIETNAMESISCH geschrieben sein, mit deutschen Fachbegriffen in Klammern wo relevant.
                
                JSON-Format:
                {
                  "overall_score": "Gesamtbewertung z.B. 7.5/10",
                  "verdict": "PASS | CONDITIONAL_PASS | NOT_PASS",
                  "verdict_label_vi": "Đạt | Đạt có điều kiện | Chưa đạt",
                  "categories": [
                    {
                      "name_vi": "Cấu trúc & Sự cô đọng (Struktur & Prägnanz)",
                      "score": 0-10,
                      "green_flags_vi": ["Dấu hiệu tích cực..."],
                      "red_flags_vi": ["Dấu hiệu cảnh báo..."],
                      "comment_vi": "Nhận xét chi tiết..."
                    },
                    {
                      "name_vi": "Kỹ năng chuyên môn (Fachkompetenz)",
                      "score": 0-10,
                      "green_flags_vi": [],
                      "red_flags_vi": [],
                      "comment_vi": ""
                    },
                    {
                      "name_vi": "Kỹ năng giao tiếp & Năng lượng (Kommunikation & Energie)",
                      "score": 0-10,
                      "green_flags_vi": [],
                      "red_flags_vi": [],
                      "comment_vi": ""
                    },
                    {
                      "name_vi": "Động lực & Định hướng (Motivation & Ausrichtung)",
                      "score": 0-10,
                      "green_flags_vi": [],
                      "red_flags_vi": [],
                      "comment_vi": ""
                    }
                  ],
                  "german_language": {
                    "grammar_accuracy_pct": "phần trăm chính xác ngữ pháp",
                    "vocabulary_level": "mức từ vựng (A1-C1)",
                    "fluency_vi": "Nhận xét về độ trôi chảy",
                    "common_errors_vi": ["Lỗi thường gặp..."]
                  },
                  "remediation_vi": [
                    "Giải pháp cụ thể 1...",
                    "Giải pháp cụ thể 2...",
                    "Giải pháp cụ thể 3..."
                  ],
                  "encouragement_vi": "Lời động viên chân thành, cụ thể dựa trên những điểm mạnh đã thể hiện..."
                }
                
                REGELN:
                - categories MUSS genau 4 Einträge haben (wie oben).
                - remediation_vi: mindestens 3, maximal 5 Vorschläge — praktisch und umsetzbar.
                - encouragement_vi: persönlich, bezieht sich auf konkrete Stärken aus dem Gespräch.
                - Bewerte FAIR: berücksichtige das Erfahrungslevel (%s) und das Deutsch-Niveau (%s).
                - NUR STRICT JSON ausgeben — kein Markdown, kein Text drumherum.
                """.formatted(position, experience, cefrLevel, conversationSummary, experience, cefrLevel);
    }
}
