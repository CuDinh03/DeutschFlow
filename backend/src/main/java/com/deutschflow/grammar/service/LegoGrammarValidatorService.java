package com.deutschflow.grammar.service;

import com.deutschflow.grammar.dto.GrammarValidateRequest;
import com.deutschflow.grammar.dto.GrammarValidateResponse;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class LegoGrammarValidatorService {

    private static final Set<String> PRONOUNS = Set.of(
            "ich", "du", "er", "sie", "es", "wir", "ihr"
    );
    private static final Set<String> COMMON_FINITE_VERBS = Set.of(
            "bin", "bist", "ist", "sind", "seid",
            "habe", "hast", "hat", "haben", "habt",
            "lerne", "lernst", "lernt",
            "trinke", "trinkst", "trinkt",
            "fahre", "fährst", "fahrt",
            "lese", "liest", "lesen",
            "spiele", "spielst", "spielt",
            "gehe", "gehst", "geht"
    );

    public GrammarValidateResponse validate(GrammarValidateRequest req) {
        String joiner = "|".equals(req.joiner()) ? "|" : " ";
        List<String> answerTokens = tokens(req.answer(), joiner);
        List<String> expectedTokens = tokens(req.expected(), joiner);

        List<GrammarValidateResponse.ValidationError> errors = new ArrayList<>();
        if (answerTokens.size() != expectedTokens.size()) {
            errors.add(new GrammarValidateResponse.ValidationError(
                    "LENGTH_MISMATCH",
                    "Số lượng token chưa đúng với đáp án mong đợi.",
                    null,
                    String.valueOf(expectedTokens.size()),
                    String.valueOf(answerTokens.size())
            ));
        }

        int total = Math.max(expectedTokens.size(), answerTokens.size());
        int matched = 0;
        for (int i = 0; i < total; i++) {
            String expected = i < expectedTokens.size() ? expectedTokens.get(i) : null;
            String actual = i < answerTokens.size() ? answerTokens.get(i) : null;
            if (expected != null && expected.equals(actual)) {
                matched++;
                continue;
            }
            errors.add(new GrammarValidateResponse.ValidationError(
                    "TOKEN_MISMATCH",
                    "Token chưa đúng vị trí.",
                    i,
                    expected,
                    actual
            ));
        }

        appendVerbSecondRule(errors, answerTokens);

        int scorePercent = total == 0 ? 0 : (int) Math.round((matched * 100.0) / total);
        boolean valid = errors.isEmpty();
        if (!valid) {
            scorePercent = Math.min(scorePercent, 99);
        }
        return new GrammarValidateResponse(valid, scorePercent, errors);
    }

    private void appendVerbSecondRule(List<GrammarValidateResponse.ValidationError> errors, List<String> answerTokens) {
        if (answerTokens.size() < 2) {
            return;
        }
        String first = answerTokens.get(0);
        String second = answerTokens.get(1);
        if (PRONOUNS.contains(first) && !COMMON_FINITE_VERBS.contains(second)) {
            errors.add(new GrammarValidateResponse.ValidationError(
                    "VERB_POSITION",
                    "Trong câu đơn A1-A2, động từ chia thường đứng ở vị trí thứ 2.",
                    1,
                    "finite-verb",
                    second
            ));
        }
    }

    private List<String> tokens(String raw, String joiner) {
        String normalized = normalize(raw, joiner);
        if (normalized.isBlank()) {
            return List.of();
        }
        if ("|".equals(joiner)) {
            return List.of(normalized.split("\\|"));
        }
        return List.of(normalized.split(" "));
    }

    private String normalize(String raw, String joiner) {
        String source = String.valueOf(raw == null ? "" : raw).trim().toLowerCase(Locale.ROOT);
        if (source.isBlank()) {
            return "";
        }
        if ("|".equals(joiner)) {
            String[] parts = source.split("\\|");
            List<String> out = new ArrayList<>();
            for (String part : parts) {
                String token = part.trim().replaceAll("[\\p{Punct}]", "");
                if (!token.isBlank()) {
                    out.add(token);
                }
            }
            return String.join("|", out);
        }
        String compact = source
                .replaceAll("[\\p{Punct}]", " ")
                .replaceAll("\\s+", " ")
                .trim();
        return compact;
    }
}
