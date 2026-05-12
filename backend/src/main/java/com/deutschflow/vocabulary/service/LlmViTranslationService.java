package com.deutschflow.vocabulary.service;

import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Translates German lemmas to Vietnamese using LLM (batch mode).
 * Replaces Glosbe scraping with a stable, rate-limit-free solution.
 *
 * Cost estimate: 10k words × 8 words/token avg × 2 (prompt+completion)
 *   ≈ 160k tokens → $0.024 with GPT-4o-mini ($0.15/1M tokens)
 *
 * Strategy: Batch 50 words per LLM call → 200 calls for 10k words.
 * Admin can trigger via POST /api/admin/vocabulary/llm-vi/enrich/batch
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LlmViTranslationService {

    private static final String SOURCE = "LLM_VI_TRANSLATE";
    private static final int BATCH_SIZE = 50;

    private final JdbcTemplate jdbc;
    private final OpenAiChatClient llmClient;
    private final ObjectMapper objectMapper;

    @Value("${app.vocabulary.llm-vi.enabled:false}")
    private boolean enabled;

    @Value("${app.vocabulary.llm-vi.batch-size:50}")
    private int batchSize;

    @Value("${app.vocabulary.llm-vi.delay-ms:60000}")
    private long delayMs;

    // ── Scheduled: runs every delayMs, only if enabled ────────────────────────

    @Scheduled(fixedDelayString = "${app.vocabulary.llm-vi.delay-ms:60000}")
    public void runScheduled() {
        if (!enabled) return;
        try {
            Map<String, Object> result = runBatch(batchSize, false);
            log.info("[LLM-VI] Scheduled: processed={} translated={} status={}",
                    result.get("processed"), result.get("translated"), result.get("status"));
        } catch (Exception e) {
            log.warn("[LLM-VI] Scheduler error: {}", e.getMessage());
        }
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Translate a batch of words missing VI meaning.
     * @param limitOverride number of words to process (null = use batchSize config)
     * @param resetCursor   if true, start from word id=0
     */
    public Map<String, Object> runBatch(Integer limitOverride, boolean resetCursor) {
        if (resetCursor) setState("last_processed_word_id", "0");

        int limit = limitOverride != null && limitOverride > 0
                ? Math.min(limitOverride, 500) // hard cap 500 per admin request
                : batchSize;
        Long lastId = parseLong(getState("last_processed_word_id"));
        if (lastId == null) lastId = 0L;

        // Fetch words missing VI translation
        List<Map<String, Object>> words = jdbc.queryForList("""
            SELECT w.id, w.base_form, w.cefr_level,
                   COALESCE(t_en.meaning, '') AS meaning_en
            FROM words w
            LEFT JOIN word_translations t_en ON t_en.word_id = w.id AND t_en.locale = 'en'
            WHERE w.id > ?
              AND NOT EXISTS (
                SELECT 1 FROM word_translations t
                WHERE t.word_id = w.id AND t.locale = 'vi'
                  AND t.meaning IS NOT NULL AND TRIM(t.meaning) != ''
                  AND LOWER(t.meaning) NOT LIKE 'not in wordlists%'
                  AND LOWER(t.meaning) NOT LIKE 'chua co trong%'
              )
            ORDER BY
              CASE COALESCE(NULLIF(TRIM(w.cefr_level), ''), 'ZZ')
                WHEN 'A1' THEN 1 WHEN 'A2' THEN 2 WHEN 'B1' THEN 3
                WHEN 'B2' THEN 4 WHEN 'C1' THEN 5 WHEN 'C2' THEN 6
                ELSE 99 END,
              w.id ASC
            LIMIT ?
            """, lastId, limit);

        if (words.isEmpty()) {
            return Map.of("source", SOURCE, "status", "IDLE",
                    "processed", 0, "translated", 0, "lastId", lastId);
        }

        int translated = 0;
        int failed = 0;
        long maxSeen = lastId;

        // Process in sub-batches of BATCH_SIZE
        for (int i = 0; i < words.size(); i += BATCH_SIZE) {
            List<Map<String, Object>> batch = words.subList(i, Math.min(i + BATCH_SIZE, words.size()));
            try {
                Map<Long, String> translations = translateBatch(batch);
                for (Map.Entry<Long, String> entry : translations.entrySet()) {
                    long wordId = entry.getKey();
                    String meaning = entry.getValue();
                    if (meaning != null && !meaning.isBlank()) {
                        jdbc.update("""
                            INSERT INTO word_translations (word_id, locale, meaning, example)
                            VALUES (?, 'vi', ?, NULL)
                            ON CONFLICT (word_id, locale) DO UPDATE SET
                              meaning = CASE
                                WHEN word_translations.meaning IS NULL
                                  OR TRIM(word_translations.meaning) = ''
                                  OR LOWER(word_translations.meaning) LIKE 'not in wordlists%'
                                THEN EXCLUDED.meaning
                                ELSE word_translations.meaning
                              END
                            """, wordId, meaning.trim());
                        translated++;
                    }
                }
            } catch (Exception e) {
                log.error("[LLM-VI] Batch {}-{} failed: {}", i, i + batch.size(), e.getMessage());
                failed += batch.size();
            }

            // Update cursor to last word in this sub-batch
            batch.stream()
                    .mapToLong(r -> ((Number) r.get("id")).longValue())
                    .max()
                    .ifPresent(id -> setState("last_processed_word_id", String.valueOf(id)));
            maxSeen = words.stream().mapToLong(r -> ((Number) r.get("id")).longValue()).max().orElse(maxSeen);
        }

        setState("last_processed_word_id", String.valueOf(maxSeen));

        return new LinkedHashMap<>(Map.of(
                "source", SOURCE,
                "processed", words.size(),
                "translated", translated,
                "failed", failed,
                "lastId", maxSeen,
                "status", "OK"
        ));
    }

    // ── LLM Translation ───────────────────────────────────────────────────────

    private Map<Long, String> translateBatch(List<Map<String, Object>> words) throws Exception {
        StringBuilder userMsg = new StringBuilder();
        for (Map<String, Object> w : words) {
            long id = ((Number) w.get("id")).longValue();
            String form = Objects.toString(w.get("base_form"), "");
            String enMeaning = Objects.toString(w.get("meaning_en"), "");
            userMsg.append(id).append(": ").append(form);
            if (!enMeaning.isBlank()) userMsg.append(" (").append(enMeaning).append(")");
            userMsg.append('\n');
        }

        String system = """
            You are a German-Vietnamese dictionary assistant.
            For each German word (with optional English meaning hint), provide a concise Vietnamese translation (1-5 words max).
            Return ONLY a valid JSON object: {"word_id": "vietnamese meaning", ...}
            Use natural Vietnamese. No explanations, no markdown.
            Example: {"123": "đi du lịch", "456": "ăn sáng", "789": "làm việc"}
            """;

        var response = llmClient.chatCompletion(
                List.of(new ChatMessage("system", system),
                        new ChatMessage("user", userMsg.toString())),
                null, 0.0, 800);

        return parseTranslationResponse(response.content(), words);
    }

    private Map<Long, String> parseTranslationResponse(String raw, List<Map<String, Object>> words) {
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start < 0 || end < 0) {
            log.warn("[LLM-VI] No JSON found in response: {}", raw.substring(0, Math.min(200, raw.length())));
            return Map.of();
        }
        try {
            Map<String, Object> parsed = objectMapper.readValue(
                    raw.substring(start, end + 1), new TypeReference<>() {});
            Map<Long, String> result = new LinkedHashMap<>();
            // Build valid word id set
            Set<Long> validIds = new HashSet<>();
            words.forEach(w -> validIds.add(((Number) w.get("id")).longValue()));

            for (Map.Entry<String, Object> e : parsed.entrySet()) {
                try {
                    long id = Long.parseLong(e.getKey());
                    if (!validIds.contains(id)) continue;
                    String meaning = Objects.toString(e.getValue(), "").trim();
                    if (!meaning.isBlank() && meaning.length() <= 100) {
                        result.put(id, meaning);
                    }
                } catch (NumberFormatException ignored) {}
            }
            return result;
        } catch (Exception e) {
            log.warn("[LLM-VI] Failed to parse JSON: {}", e.getMessage());
            return Map.of();
        }
    }

    // ── State helpers ─────────────────────────────────────────────────────────

    private String getState(String key) {
        return jdbc.query(
                "SELECT state_value FROM vocabulary_import_state WHERE source_name = ? AND state_key = ? LIMIT 1",
                rs -> rs.next() ? rs.getString("state_value") : null, SOURCE, key);
    }

    private void setState(String key, String value) {
        jdbc.update("""
            INSERT INTO vocabulary_import_state (source_name, state_key, state_value)
            VALUES (?, ?, ?)
            ON CONFLICT (source_name, state_key)
            DO UPDATE SET state_value = EXCLUDED.state_value, updated_at = CURRENT_TIMESTAMP
            """, SOURCE, key, value);
    }

    private Long parseLong(String s) {
        if (s == null || s.isBlank()) return null;
        try { return Long.parseLong(s.trim()); } catch (NumberFormatException e) { return null; }
    }
}
