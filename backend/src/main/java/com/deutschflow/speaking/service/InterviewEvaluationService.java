package com.deutschflow.speaking.service;

import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.entity.AiSpeakingMessage;
import com.deutschflow.speaking.entity.AiSpeakingSession;
import com.deutschflow.speaking.interview.InterviewReportValidator;
import com.deutschflow.speaking.interview.InterviewSessionState;
import com.deutschflow.speaking.interview.InterviewStateCodec;
import com.deutschflow.speaking.repository.AiSpeakingMessageRepository;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.common.quota.QuotaExceededException;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.ai.tier.LlmTier;
import com.deutschflow.ai.tier.LlmTierResolver;
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

    // gpt-oss (model chấm) là reasoning model: token "nghĩ" tính CHUNG vào max_tokens, và luồng chấm
    // CỐ TÌNH không đặt reasoning_effort (giữ chất lượng chấm). Đo thật 10/08 trên Fireworks: phần
    // "nghĩ" nuốt ~1.5k token nên 2200 vẫn cụt 3/3 lần → owner chốt nâng 4000 (phương án B);
    // lần retry sau validation-fail được nới thêm để không chết vì đúng lý do cũ.
    private static final int EVAL_MAX_TOKENS = 4000;
    private static final int EVAL_RETRY_MAX_TOKENS = 6000;
    private static final double EVAL_TEMPERATURE = 0.3;
    // Guard đủ-dữ-liệu (owner chốt 10/08): dưới ngưỡng thì KHÔNG chấm — nói thật "chưa đủ dữ liệu"
    // thay vì để model bịa nhận xét cho người chưa nói gì (prod sid 356/357/386).
    private static final int MIN_USER_TURNS = 2;
    private static final int MIN_USER_WORDS = 30;

    private final AiSpeakingMessageRepository messageRepository;
    private final OpenAiChatClient openAiChatClient;
    private final QuotaService quotaService;
    private final AiUsageLedgerService ledgerService;
    private final InterviewStateCodec interviewStateCodec;
    private final InterviewReportValidator reportValidator;
    // Khung tier B1.5: chấm phỏng vấn = GRADING_DAILY.
    private final LlmTierResolver llmTierResolver;

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

            // Đợt A (10/08): guard đủ-dữ-liệu TRƯỚC khi tốn 1 call LLM. Check messages.isEmpty() cũ
            // không đủ — greeting của AI làm list không rỗng nên phiên ứng viên im lặng vẫn bị chấm.
            List<String> userTexts = messages.stream()
                    .filter(m -> m.getRole() == AiSpeakingMessage.MessageRole.USER)
                    .map(m -> m.getUserText() != null ? m.getUserText() : "")
                    .toList();
            int userTurns = userTexts.size();
            int userWords = InterviewReportValidator.countWords(userTexts);
            if (userTurns < MIN_USER_TURNS || userWords < MIN_USER_WORDS) {
                log.info("[InterviewEval] session {} chưa đủ dữ liệu để chấm (turns={}, words={}) — INSUFFICIENT_DATA, không gọi LLM",
                        session.getId(), userTurns, userWords);
                return reportValidator.insufficientData(userTurns, userWords, MIN_USER_TURNS, MIN_USER_WORDS);
            }

            InterviewSessionState state = interviewStateCodec.decode(session.getInterviewStateJson());
            String conversationSummary = buildConversationSummary(messages);
            String evalPrompt = buildEvaluationPrompt(session, conversationSummary, state);

            List<ChatMessage> aiMessages = List.of(
                    new ChatMessage("system", evalPrompt),
                    new ChatMessage("user", "Hãy đánh giá buổi phỏng vấn dựa trên toàn bộ cuộc hội thoại ở trên và xuất kết quả dưới dạng JSON.")
            );

            // Audit 24/07 R-G5/R-G6: cấp trọn ngân sách token cố định (không kẹp theo quota còn lại,
            // tránh JSON cụt → report rỗng nhưng vẫn trừ token) và dùng MODEL CHẤM thay model nói.
            quotaService.assertAllowed(userId, Instant.now(), 1L);

            String raw = callEvalModel(aiMessages, userId, session, EVAL_MAX_TOKENS);
            InterviewReportValidator.ValidationResult vr = reportValidator.validate(raw, userTexts, state);
            if (!vr.valid()) {
                log.warn("[InterviewEval] session {} report không qua validator (lần 1): {} — retry, budget {}",
                        session.getId(), vr.failures(), EVAL_RETRY_MAX_TOKENS);
                List<ChatMessage> retryMessages = new ArrayList<>(aiMessages);
                retryMessages.add(new ChatMessage("user",
                        "Der vorherige Versuch war UNGÜLTIG: " + String.join("; ", vr.failures())
                                + ". Erzeuge das komplette JSON erneut — STRICT JSON, alle 4 Kategorien, und jede Kategorie"
                                + " MUSS mindestens ein wörtliches Zitat des Kandidaten in „…\" enthalten (exakt wie im Protokoll)."));
                raw = callEvalModel(retryMessages, userId, session, EVAL_RETRY_MAX_TOKENS);
                vr = reportValidator.validate(raw, userTexts, state);
            }
            if (!vr.valid()) {
                log.warn("[InterviewEval] session {} report vẫn trượt validator sau retry: {} — lưu EVAL_FAILED, KHÔNG lưu raw",
                        session.getId(), vr.failures());
                return reportValidator.evalFailed(vr.failures());
            }
            return vr.normalizedJson();
        } catch (QuotaExceededException e) {
            log.warn("Quota exceeded for interview eval session {}: {}", session.getId(), e.getMessage());
            throw e;
        } catch (Exception e) {
            log.error("Failed to generate interview evaluation for session {}: {}", session.getId(), e.getMessage());
            return null;
        }
    }

    private String callEvalModel(List<ChatMessage> aiMessages, Long userId, AiSpeakingSession session, int maxTokens) {
        AiChatCompletionResult result = openAiChatClient.chatCompletionForTier(
                aiMessages, llmTierResolver.spec(LlmTier.GRADING_DAILY), EVAL_TEMPERATURE, maxTokens);
        if (result.usage() != null) {
            ledgerService.record(userId, result.provider(), result.model(),
                    result.usage(), "INTERVIEW_EVAL", null, session.getId());
        }
        return result.content();
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

    private String buildEvaluationPrompt(AiSpeakingSession session, String conversationSummary,
                                         InterviewSessionState interviewState) {
        String position = session.getInterviewPosition() != null ? session.getInterviewPosition() : "Allgemein";
        String experience = session.getExperienceLevel() != null ? session.getExperienceLevel() : "unbekannt";
        String cefrLevel = session.getCefrLevel() != null ? session.getCefrLevel() : "A1";
        String orchestrationMetrics = interviewState != null
                ? interviewState.metricsSummary()
                : "keine Orchestrator-Metriken";

        return """
                Du bist ein erfahrener HR-Berater mit 15+ Jahren Erfahrung im Recruiting.
                
                Du hast gerade ein Bewerbungsgespräch beobachtet. Hier sind die Details:
                - Position: %s
                - Erfahrungslevel des Kandidaten: %s
                - Deutsch-Niveau (CEFR): %s
                - Interview-Orchestrierung (Server): %s
                
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
                - BELEGE MIT ZITATEN: Jede Kategorie MUSS mindestens EIN wörtliches Zitat des Kandidaten
                  aus dem Protokoll enthalten (in green_flags_vi, red_flags_vi oder comment_vi),
                  in Anführungszeichen „...". Keine Behauptung ohne Beleg aus dem Gespräch.
                  Allgemeinplätze wie "Câu trả lời rõ ràng" ohne Zitat sind VERBOTEN.
                - PUNKTE-SKALA (für jede Kategorie):
                  9-10 = überzeugend, strukturiert, mit konkreten Beispielen belegt;
                  7-8  = solide, kleinere Lücken, meist konkret;
                  5-6  = brauchbar, aber oberflächlich oder ohne Beispiele;
                  3-4  = schwach, ausweichend, kaum Substanz;
                  0-2  = keine verwertbare Antwort.
                - overall_score = Durchschnitt der 4 Kategorie-Scores, auf 0.5 gerundet,
                  im Format "X/10" (z.B. "5.5/10"). KEINE davon abweichende Gesamtnote.
                - remediation_vi: mindestens 3, maximal 5 Vorschläge — praktisch und umsetzbar.
                - encouragement_vi: persönlich, bezieht sich auf konkrete Stärken aus dem Gespräch.
                - Bewerte FAIR: berücksichtige das Erfahrungslevel (%s) und das Deutsch-Niveau (%s).
                - Berücksichtige challengeCount und concreteExample in den Orchestrator-Metriken bei Fachkompetenz.
                - Das Protokoll ist eine Sprache-zu-Text-Transkription: bewerte KEINE Aussprache/Orthografie,
                  nur Inhalt, Struktur, Grammatik und Wortschatz.
                - NUR STRICT JSON ausgeben — kein Markdown, kein Text drumherum.
                """.formatted(position, experience, cefrLevel, orchestrationMetrics, conversationSummary, experience, cefrLevel);
    }
}
