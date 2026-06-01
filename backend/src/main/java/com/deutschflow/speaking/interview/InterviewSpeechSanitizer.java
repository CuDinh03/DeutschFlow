package com.deutschflow.speaking.interview;

import org.springframework.stereotype.Component;

import java.util.regex.Pattern;

@Component
public class InterviewSpeechSanitizer {

    /** Default cap on acknowledgment length when no plan-specific cap is given. */
    private static final int DEFAULT_ACK_MAX_WORDS = 15;
    /** Hard cap on the full reply length — keeps the interviewer concise without scrubbing tone. */
    private static final int MAX_SPEECH_CHARS = 600;

    private static final Pattern PROMPT_LEAK = Pattern.compile(
            "(?i)(der kandidat antwortete|fordern sie|pflichtfrage|kein lob|challenge-pflicht|antwortregeln|sprachniveau-kontrolle|anti-off-topic guard|"
                    + "bitte stellen sie sich kurz vor|stellen sie sich kurz vor|fragen sie direkt|bitte den kandidaten)");

    public String sanitize(String aiSpeechDe, InterviewTurnPlan plan, int userTurn) {
        if (aiSpeechDe == null || aiSpeechDe.isBlank()) {
            return aiSpeechDe;
        }
        String text = aiSpeechDe.trim();
        // GUARDRAIL kept: never leak orchestration instructions into the reply.
        if (PROMPT_LEAK.matcher(text).find()) {
            text = leakSafeFallback(plan, userTurn);
        }
        // RELAXED (guardrails-not-rails): brief, genuine acknowledgment is allowed through —
        // no blanket scrub of praise to "Verstehe.". Only collapse mechanically-repeated acks.
        text = collapseRepeatedAck(text);
        // Coverage fallback (Phase 1 only — removed in Phase 2 when the LLM drives follow-ups):
        // ensure the turn still advances if the model produced no question at all.
        if (plan != null && plan.mandatoryQuestionDe() != null && !containsQuestion(text)) {
            text = shortAck(userTurn) + " " + plan.mandatoryQuestionDe();
        }
        if (text.length() > MAX_SPEECH_CHARS) {
            text = truncateKeepingQuestion(text, plan);
        }
        return text.trim();
    }

    public String composeFromMeta(String ackDe, String questionDe, InterviewTurnPlan plan, int userTurn) {
        String ack = ackDe == null || ackDe.isBlank() ? shortAck(userTurn) : ackDe.trim();
        // RELAXED: keep the model's brief acknowledgment. Only guard against prompt leak and
        // over-long acks (trim to the cap instead of nuking to a canned "Verstehe.").
        ack = collapseRepeatedAck(ack);
        if (PROMPT_LEAK.matcher(ack).find()) {
            ack = shortAck(userTurn);
        }
        int ackCap = plan == null ? DEFAULT_ACK_MAX_WORDS : plan.ackMaxWords();
        if (ack.split("\\s+").length > ackCap) {
            ack = trimToWords(ack, ackCap);
        }
        String q = questionDe == null || questionDe.isBlank()
                ? (plan == null ? "" : plan.mandatoryQuestionDe())
                : questionDe.trim();
        if (q.isBlank()) {
            return sanitize(ack, plan, userTurn);
        }
        String combined = ack + " " + q;
        if (PROMPT_LEAK.matcher(combined).find()) {
            combined = leakSafeFallback(plan, userTurn);
        }
        return sanitize(combined, plan, userTurn);
    }

    private static String leakSafeFallback(InterviewTurnPlan plan, int userTurn) {
        String ack = shortAck(userTurn);
        String question = plan == null || plan.mandatoryQuestionDe() == null
                ? "Wie war Ihr letzter konkreter Erfolg?"
                : plan.mandatoryQuestionDe();
        return ack + " " + question;
    }

    private static String shortAck(int userTurn) {
        return userTurn <= 2 ? "Danke." : "Verstehe.";
    }

    private static boolean containsQuestion(String text) {
        return text.contains("?");
    }

    private static String collapseRepeatedAck(String text) {
        String t = text;
        for (int i = 0; i < 3; i++) {
            t = t.replace("Verstehe. Verstehe.", "Verstehe.");
            t = t.replace("Gut. Gut.", "Gut.");
        }
        return t;
    }

    private static String truncateKeepingQuestion(String text, InterviewTurnPlan plan) {
        int q = text.lastIndexOf('?');
        if (q > 0 && q < text.length() - 1) {
            int start = Math.max(0, q - 380);
            return text.substring(start).trim();
        }
        if (plan != null && plan.mandatoryQuestionDe() != null) {
            return shortAck(3) + " " + plan.mandatoryQuestionDe();
        }
        return text.substring(0, Math.min(500, text.length())).trim() + "…";
    }

    private static String trimToWords(String text, int maxWords) {
        String[] words = text.trim().split("\\s+");
        if (words.length <= maxWords) {
            return text.trim();
        }
        return String.join(" ", java.util.Arrays.copyOfRange(words, 0, maxWords));
    }
}
