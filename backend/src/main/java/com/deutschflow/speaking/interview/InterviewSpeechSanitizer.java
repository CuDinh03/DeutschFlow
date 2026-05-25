package com.deutschflow.speaking.interview;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

@Component
public class InterviewSpeechSanitizer {

    private static final Pattern PRAISE = Pattern.compile(
            "(?i)(das ist (sehr )?(gut|professionell|einfühlsam|umfassend|gründlich|strukturiert)|"
                    + "ein sehr (guter|professioneller|einfühlsamer|umfassender|gründlicher) (ansatz|vorgehensweise|interpretation)|"
                    + "beeindruckend|ausgezeichnet)");
    private static final Pattern PROMPT_LEAK = Pattern.compile(
            "(?i)(der kandidat antwortete|fordern sie|pflichtfrage|kein lob|challenge-pflicht|antwortregeln|sprachniveau-kontrolle|anti-off-topic guard|"
                    + "bitte stellen sie sich kurz vor|stellen sie sich kurz vor|fragen sie direkt|bitte den kandidaten)");

    public String sanitize(String aiSpeechDe, InterviewTurnPlan plan, int userTurn) {
        if (aiSpeechDe == null || aiSpeechDe.isBlank()) {
            return aiSpeechDe;
        }
        String text = aiSpeechDe.trim();
        if (PROMPT_LEAK.matcher(text).find()) {
            text = leakSafeFallback(plan, userTurn);
        }
        if (userTurn > 1) {
            text = PRAISE.matcher(text).replaceAll("Verstehe.");
            text = collapseRepeatedAck(text);
        }
        if (plan != null && plan.mandatoryQuestionDe() != null && !containsQuestion(text)) {
            text = shortAck(userTurn) + " " + plan.mandatoryQuestionDe();
        }
        if (text.length() > 520) {
            text = truncateKeepingQuestion(text, plan);
        }
        return text.trim();
    }

    public String composeFromMeta(String ackDe, String questionDe, InterviewTurnPlan plan, int userTurn) {
        String ack = ackDe == null || ackDe.isBlank() ? shortAck(userTurn) : ackDe.trim();
        if (userTurn > 1) {
            ack = PRAISE.matcher(ack).replaceAll("Verstehe.");
            ack = collapseRepeatedAck(ack);
            if (plan != null && containsForbiddenPraise(ack, plan.forbiddenPhrases())) {
                ack = shortAck(userTurn);
            }
            if (PROMPT_LEAK.matcher(ack).find()) {
                ack = shortAck(userTurn);
            }
        }
        if (ack.split("\\s+").length > (plan == null ? 8 : plan.ackMaxWords())) {
            ack = shortAck(userTurn);
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

    public static boolean containsForbiddenPraise(String text, List<String> forbidden) {
        if (text == null) {
            return false;
        }
        String lower = text.toLowerCase(Locale.ROOT);
        for (String f : forbidden) {
            if (lower.contains(f.toLowerCase(Locale.ROOT))) {
                return true;
            }
        }
        return PRAISE.matcher(text).find();
    }
}
