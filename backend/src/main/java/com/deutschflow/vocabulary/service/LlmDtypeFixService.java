package com.deutschflow.vocabulary.service;

import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Phase 1 — Fix word dtype (part-of-speech) for words incorrectly tagged as Noun.
 *
 * Strategy (2 tầng):
 * 1. Suffix rules (free, instant) — covers ~40% of misclassified words
 * 2. LLM batch classification (GPT-4o-mini) — covers the rest
 *
 * Supported dtypes: Noun, Verb, Adjective, Adverb, Conjunction,
 *                   Preposition, Pronoun, Article, Numeral, Interjection, Other
 *
 * Admin endpoint: POST /api/admin/vocabulary/dtype-fix/batch?limit=200&useLlm=true
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LlmDtypeFixService {

    private static final String SOURCE = "LLM_DTYPE_FIX";
    private static final int LLM_BATCH_SIZE = 50;

    // German suffix → inferred dtype (checked in order — most specific first)
    private static final List<String[]> SUFFIX_NOUN_DIE = List.of(
            new String[]{"ung"}, new String[]{"heit"}, new String[]{"keit"},
            new String[]{"schaft"}, new String[]{"tion"}, new String[]{"sion"},
            new String[]{"tät"}, new String[]{"tur"}, new String[]{"ur"},
            new String[]{"ei"}, new String[]{"ie"}, new String[]{"ik"},
            new String[]{"enz"}, new String[]{"anz"}, new String[]{"age"},
            new String[]{"isse"}, new String[]{"sis"}, new String[]{"xis"}
    );
    private static final List<String[]> SUFFIX_NOUN_DAS = List.of(
            new String[]{"chen"}, new String[]{"lein"}, new String[]{"ment"},
            new String[]{"tum"}, new String[]{"tel"}, new String[]{"nis"}
    );
    private static final List<String[]> SUFFIX_ADJECTIVE = List.of(
            new String[]{"lich"}, new String[]{"ig"}, new String[]{"isch"},
            new String[]{"sam"}, new String[]{"bar"}, new String[]{"los"},
            new String[]{"haft"}, new String[]{"mäßig"}, new String[]{"fähig"},
            new String[]{"reich"}, new String[]{"arm"}, new String[]{"wert"},
            new String[]{"artig"}, new String[]{"fertig"}, new String[]{"frei"}
    );
    private static final Set<String> CONJUNCTIONS = Set.of(
            "aber", "und", "oder", "denn", "sondern", "weil", "da", "wenn",
            "ob", "dass", "obwohl", "damit", "bevor", "nachdem", "als",
            "seitdem", "sobald", "solange", "während", "falls", "sofern",
            "soweit", "trotzdem", "obgleich", "obschon", "ehe"
    );
    private static final Set<String> PREPOSITIONS = Set.of(
            "an", "auf", "aus", "bei", "bis", "durch", "für", "gegen", "hinter",
            "in", "mit", "nach", "neben", "ohne", "seit", "über", "um", "unter",
            "von", "vor", "während", "wegen", "zu", "zwischen", "ab", "außer",
            "gegenüber", "innerhalb", "außerhalb", "entlang", "trotz", "statt"
    );
    private static final Set<String> PRONOUNS = Set.of(
            "ich", "du", "er", "sie", "es", "wir", "ihr",
            "mich", "dich", "sich", "uns", "euch",
            "mir", "dir", "ihm", "ihnen",
            "mein", "dein", "sein", "unser", "euer",
            "man", "jemand", "niemand", "etwas", "nichts",
            "dieser", "diese", "dieses", "welcher", "welche", "welches",
            "wer", "was", "wessen", "wem", "wen"
    );
    private static final Set<String> ARTICLES = Set.of(
            "der", "die", "das", "den", "dem", "des",
            "ein", "eine", "einen", "einem", "einer", "eines",
            "kein", "keine", "keinen", "keinem", "keiner", "keines"
    );
    private static final Set<String> ADVERBS = Set.of(
            "auch", "nicht", "sehr", "noch", "schon", "nur", "mal", "doch",
            "ja", "nein", "bitte", "gern", "gerne", "leider", "natuerlich",
            "eigentlich", "wirklich", "vielleicht", "wahrscheinlich",
            "endlich", "sofort", "immer", "nie", "oft", "manchmal", "selten",
            "hier", "dort", "weg", "hin", "her", "oben", "unten", "links", "rechts",
            "heute", "gestern", "morgen", "jetzt", "dann", "wann", "wie",
            "wo", "woher", "wohin", "warum", "deshalb",
            "zusammen", "allein", "genau", "fast", "kaum", "bereits"
    );

    private final JdbcTemplate jdbc;
    private final OpenAiChatClient llmClient;
    private final ObjectMapper objectMapper;

    /**
     * Run dtype fix batch.
     *
     * @param limit   max words to process (default 200, max 1000)
     * @param useLlm  if true, words not fixed by suffix rules go to LLM
     * @param dryRun  if true, only report — no DB writes
     */
    public Map<String, Object> runBatch(Integer limit, boolean useLlm, boolean dryRun) {
        int cap = Math.min(limit != null && limit > 0 ? limit : 200, 1000);

        // Count words that might have wrong dtype
        Integer remaining = jdbc.queryForObject("""
                SELECT COUNT(*) FROM words
                WHERE dtype NOT IN ('Verb','Adjective','Adverb','Conjunction',
                                    'Preposition','Pronoun','Article','Numeral',
                                    'Interjection','Other')
                   OR dtype IS NULL
                """, Integer.class);

        // Fetch candidates — Noun first (most likely wrong), then by id ASC
        List<Map<String, Object>> words = jdbc.queryForList(
                "SELECT id, base_form, COALESCE(dtype, 'Noun') AS dtype, gender" +
                " FROM words" +
                " ORDER BY CASE WHEN COALESCE(dtype, 'Noun') = 'Noun' THEN 0 ELSE 1 END, id ASC" +
                " LIMIT " + cap);

        int suffixFixed = 0;
        int llmFixed = 0;
        int unchanged = 0;
        List<Map<String, Object>> needsLlm = new ArrayList<>();
        List<String> changes = new ArrayList<>();

        for (Map<String, Object> w : words) {
            long id = ((Number) w.get("id")).longValue();
            String form = Objects.toString(w.get("base_form"), "").toLowerCase().trim();
            String currentDtype = Objects.toString(w.get("dtype"), "");

            String inferred = inferBySuffix(form);

            if (inferred != null && !inferred.equals(currentDtype)) {
                if (!dryRun) applyFix(id, inferred);
                changes.add(form + ": " + currentDtype + " → " + inferred + " [suffix]");
                suffixFixed++;
            } else if (inferred == null && useLlm) {
                needsLlm.add(w);
            } else {
                unchanged++;
            }
        }

        // LLM classification for ambiguous words
        if (!needsLlm.isEmpty() && useLlm) {
            for (int i = 0; i < needsLlm.size(); i += LLM_BATCH_SIZE) {
                List<Map<String, Object>> batch = needsLlm.subList(i, Math.min(i + LLM_BATCH_SIZE, needsLlm.size()));
                try {
                    Map<Long, String> llmResult = classifyWithLlm(batch);
                    for (Map.Entry<Long, String> e : llmResult.entrySet()) {
                        long wordId = e.getKey();
                        String newDtype = e.getValue();
                        // Find original dtype
                        String origDtype = batch.stream()
                                .filter(b -> ((Number) b.get("id")).longValue() == wordId)
                                .map(b -> Objects.toString(b.get("dtype"), ""))
                                .findFirst().orElse("");
                        String origForm = batch.stream()
                                .filter(b -> ((Number) b.get("id")).longValue() == wordId)
                                .map(b -> Objects.toString(b.get("base_form"), ""))
                                .findFirst().orElse("");

                        if (!newDtype.equals(origDtype)) {
                            if (!dryRun) applyFix(wordId, newDtype);
                            changes.add(origForm + ": " + origDtype + " → " + newDtype + " [llm]");
                            llmFixed++;
                        } else {
                            unchanged++;
                        }
                    }
                } catch (Exception e) {
                    log.error("[DtypeFix] LLM batch failed: {}", e.getMessage());
                }
            }
        }

        var result = new LinkedHashMap<String, Object>();
        result.put("source", SOURCE);
        result.put("processed", words.size());
        result.put("suffixFixed", suffixFixed);
        result.put("llmFixed", llmFixed);
        result.put("totalFixed", suffixFixed + llmFixed);
        result.put("unchanged", unchanged);
        result.put("remaining", remaining);
        result.put("dryRun", dryRun);
        result.put("status", dryRun ? "DRY_RUN" : "OK");
        if (dryRun && !changes.isEmpty()) {
            result.put("preview", changes.subList(0, Math.min(20, changes.size())));
        }
        return result;
    }

    // ── Suffix-based inference ────────────────────────────────────────────────

    private String inferBySuffix(String form) {
        if (form.isBlank()) return null;

        // Exact match sets (highest priority)
        if (ARTICLES.contains(form)) return "Article";
        if (PRONOUNS.contains(form)) return "Pronoun";
        if (CONJUNCTIONS.contains(form)) return "Conjunction";
        if (PREPOSITIONS.contains(form)) return "Preposition";
        if (ADVERBS.contains(form)) return "Adverb";

        // Suffix → Adjective (check before Noun to catch -isch etc.)
        for (String[] suffix : SUFFIX_ADJECTIVE) {
            if (form.endsWith(suffix[0]) && form.length() > suffix[0].length() + 1) {
                return "Adjective";
            }
        }

        // Suffix → Noun (die)
        for (String[] suffix : SUFFIX_NOUN_DIE) {
            if (form.endsWith(suffix[0]) && form.length() > suffix[0].length() + 1) {
                return "Noun"; // gender will be set separately in Phase 2
            }
        }

        // Suffix → Noun (das)
        for (String[] suffix : SUFFIX_NOUN_DAS) {
            if (form.endsWith(suffix[0]) && form.length() > suffix[0].length() + 1) {
                return "Noun";
            }
        }

        // German infinitive pattern: ends in -en/-ern/-eln, length > 4
        if ((form.endsWith("en") || form.endsWith("ern") || form.endsWith("eln"))
                && form.length() > 4
                && !form.endsWith("chen")  // -chen is Noun (das)
                && Character.isLowerCase(form.charAt(0))) {
            return "Verb";
        }

        return null; // ambiguous — needs LLM
    }

    // ── LLM classification ────────────────────────────────────────────────────

    private Map<Long, String> classifyWithLlm(List<Map<String, Object>> words) throws Exception {
        StringBuilder userMsg = new StringBuilder();
        for (Map<String, Object> w : words) {
            long id = ((Number) w.get("id")).longValue();
            String form = Objects.toString(w.get("base_form"), "");
            userMsg.append(id).append(": ").append(form).append("\n");
        }

        String system = """
                You are a German linguistics expert.
                Classify each German word by part of speech.
                Return ONLY valid JSON: {"word_id": "dtype", ...}
                Allowed types: Noun, Verb, Adjective, Adverb, Conjunction, Preposition, Pronoun, Article, Numeral, Interjection, Other
                Rules:
                - Nouns start with uppercase in German (der/die/das words)
                - Verbs end in -en/-ern/-eln (infinitive form)
                - Articles: der/die/das/ein/eine/kein...
                - Conjunctions: und/oder/aber/weil/dass/ob...
                - Prepositions: in/an/auf/für/mit/von/zu/durch...
                Example: {"101": "Conjunction", "102": "Noun", "103": "Verb"}
                """;

        var response = llmClient.chatCompletion(
                List.of(new ChatMessage("system", system),
                        new ChatMessage("user", userMsg.toString())),
                null, 0.0, 600);

        return parseLlmResponse(response.content(), words);
    }

    private Map<Long, String> parseLlmResponse(String raw, List<Map<String, Object>> words) {
        Set<Long> validIds = new HashSet<>();
        words.forEach(w -> validIds.add(((Number) w.get("id")).longValue()));
        Set<String> VALID_DTYPES = Set.of("Noun","Verb","Adjective","Adverb","Conjunction",
                "Preposition","Pronoun","Article","Numeral","Interjection","Other");

        int start = raw.indexOf('{'), end = raw.lastIndexOf('}');
        if (start < 0 || end < 0) return Map.of();
        try {
            Map<String, Object> parsed = objectMapper.readValue(
                    raw.substring(start, end + 1), new TypeReference<>() {});
            Map<Long, String> result = new LinkedHashMap<>();
            for (var e : parsed.entrySet()) {
                try {
                    long id = Long.parseLong(e.getKey());
                    if (!validIds.contains(id)) continue;
                    String dtype = Objects.toString(e.getValue(), "").trim();
                    if (VALID_DTYPES.contains(dtype)) result.put(id, dtype);
                } catch (NumberFormatException ignored) {}
            }
            return result;
        } catch (Exception e) {
            log.warn("[DtypeFix] Failed to parse LLM JSON: {}", e.getMessage());
            return Map.of();
        }
    }

    private void applyFix(long wordId, String newDtype) {
        jdbc.update("UPDATE words SET dtype = ? WHERE id = ?", newDtype, wordId);
    }
}
