package com.deutschflow.speaking.interview;

import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.persona.SpeakingPersona;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

/**
 * Generates a fresh interview question via Groq when the static question bank
 * has been exhausted for the current phase.
 *
 * <p>Kept intentionally small: one blocking call with {@code max_tokens=80} so
 * the round-trip is typically 2-4 seconds. Returns {@code Optional.empty()} on
 * any failure so callers can fall back gracefully.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class InterviewQuestionGenerator {

    private final OpenAiChatClient chatClient;
    private final ObjectMapper objectMapper;

    /**
     * Generates a single question for the given persona/phase/position. Falls back to
     * {@code Optional.empty()} on timeout or parse errors — callers MUST handle the empty case.
     */
    public Optional<InterviewQuestionDef> generate(
            SpeakingPersona persona,
            InterviewPhase phase,
            String position,
            String cefrLevel,
            List<String> topicsCovered,
            List<String> askedIds) {
        try {
            String system = """
                    You are generating a German job interview question.
                    Return ONLY valid JSON with exactly two fields, no markdown:
                    {"questionDe":"<question in German>","topicKey":"<one_word_label>"}
                    The question must be in professional German, ask for a concrete past experience (not hypothetical), and be under 30 words.
                    """;

            String pos = (position == null || position.isBlank()) ? "Allgemein" : position;
            String cefr = (cefrLevel == null || cefrLevel.isBlank()) ? "B1" : cefrLevel;
            String covered = topicsCovered.isEmpty() ? "keines" : String.join(", ", topicsCovered);

            String user = String.format(
                    "Interviewer: %s (%s)%nPosition: %s%nPhase: %s%nCEFR of candidate: %s%n"
                    + "Topics already covered (do NOT repeat): %s%n"
                    + "Generate exactly one new %s interview question.",
                    persona.displayName(), persona.name(), pos,
                    phaseLabel(phase), cefr, covered, phaseLabel(phase));

            AiChatCompletionResult result = chatClient.chatCompletion(
                    List.of(new ChatMessage("system", system), new ChatMessage("user", user)),
                    null, 0.9, 80);

            JsonNode json = objectMapper.readTree(result.content());
            String questionDe = json.path("questionDe").asText(null);
            String topicKey = json.path("topicKey").asText("generated");

            if (questionDe == null || questionDe.isBlank()) {
                log.warn("[QuestionGen] Empty questionDe in response for phase={}", phase);
                return Optional.empty();
            }

            String id = "groq_" + phase.name().toLowerCase() + "_" + (System.currentTimeMillis() % 100_000);
            log.debug("[QuestionGen] Generated question for phase={} topic={}: {}", phase, topicKey, questionDe);
            return Optional.of(new InterviewQuestionDef(id, phase, topicKey, questionDe));

        } catch (Exception e) {
            log.warn("[QuestionGen] Failed to generate question for phase={}: {}", phase, e.getMessage());
            return Optional.empty();
        }
    }

    private static String phaseLabel(InterviewPhase phase) {
        return switch (phase) {
            case HARD_SKILLS -> "Hard Skills / Fachkompetenz";
            case STAR_SOFT   -> "Soft Skills / STAR-Methode";
            case ICE_BREAKER -> "Motivation und Hintergrund";
            default          -> phase.name();
        };
    }
}
