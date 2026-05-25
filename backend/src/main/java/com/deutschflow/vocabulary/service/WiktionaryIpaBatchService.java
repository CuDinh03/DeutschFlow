package com.deutschflow.vocabulary.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Batch làm đầy {@code words.phonetic} (IPA) từ Wiktionary, có resume qua {@code vocabulary_import_state}.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WiktionaryIpaBatchService {

    private static final String SOURCE = "WIKTIONARY_IPA";

    private final JdbcTemplate jdbcTemplate;
    private final WiktionaryScraperService wiktionaryScraperService;

    @Value("${app.vocabulary.ipa-batch.words-per-run:200}")
    private int wordsPerRun;

    @Value("${app.vocabulary.ipa-batch.request-delay-ms:1000}")
    private long requestDelayMs;

    @Transactional
    public Map<String, Object> runBatch(Integer limitOverride, boolean shouldResetCursor) {
        if (shouldResetCursor) {
            resetCursor();
        }

        int limit = limitOverride != null && limitOverride > 0 ? Math.min(limitOverride, 2000) : wordsPerRun;

        Long lastId = parseLong(getState("last_processed_word_id"));
        if (lastId == null) {
            lastId = 0L;
        }

        List<Long> ids = jdbcTemplate.query(
                """
                SELECT w.id FROM words w
                WHERE w.id > ?
                  AND (w.phonetic IS NULL OR TRIM(w.phonetic) = '')
                ORDER BY w.id ASC
                LIMIT ?
                """,
                (rs, rn) -> rs.getLong("id"),
                lastId,
                limit
        );

        int ok = 0;
        int failed = 0;
        long maxSeen = lastId;

        for (Long id : ids) {
            String lemma = jdbcTemplate.query(
                    "SELECT base_form FROM words WHERE id = ?",
                    rs -> rs.next() ? rs.getString("base_form") : null,
                    id
            );
            if (lemma == null || lemma.isBlank()) {
                continue;
            }
            try {
                Optional<WiktionaryScraperService.WordData> data = wiktionaryScraperService.scrapeWord(lemma.trim());
                String ipa = data.map(WiktionaryScraperService.WordData::getIpa).map(String::trim).filter(s -> !s.isEmpty()).orElse(null);
                String bracket = IpaNormalization.toBracketForm(ipa);
                if (bracket != null) {
                    jdbcTemplate.update(
                            "UPDATE words SET phonetic = ?, updated_at = NOW() WHERE id = ?",
                            bracket,
                            id
                    );
                    ok++;
                } else {
                    failed++;
                }
                maxSeen = Math.max(maxSeen, id);
                setState("last_processed_word_id", String.valueOf(maxSeen));
            } catch (Exception e) {
                log.warn("IPA batch failed for id={} lemma={}: {}", id, lemma, e.getMessage());
                failed++;
                maxSeen = Math.max(maxSeen, id);
                setState("last_processed_word_id", String.valueOf(maxSeen));
            }
            sleepQuietly(requestDelayMs);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("source", SOURCE);
        out.put("requestedLimit", limit);
        out.put("processedRows", ids.size());
        out.put("ipaFilled", ok);
        out.put("ipaMissing", failed);
        out.put("lastProcessedWordId", maxSeen);
        out.put("status", ids.isEmpty() ? "IDLE" : "OK");
        out.put("resetCursor", shouldResetCursor);
        return out;
    }

    public void resetCursor() {
        setState("last_processed_word_id", "0");
    }

    private Long parseLong(String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        try {
            return Long.parseLong(s.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private String getState(String key) {
        return jdbcTemplate.query(
                "SELECT state_value FROM vocabulary_import_state WHERE source_name = ? AND state_key = ? LIMIT 1",
                rs -> rs.next() ? rs.getString("state_value") : null,
                SOURCE,
                key
        );
    }

    private void setState(String key, String value) {
        jdbcTemplate.update(
                """
                INSERT INTO vocabulary_import_state (source_name, state_key, state_value)
                VALUES (?, ?, ?)
                ON CONFLICT (source_name, state_key)
                DO UPDATE SET state_value = EXCLUDED.state_value, updated_at = CURRENT_TIMESTAMP
                """,
                SOURCE,
                key,
                value
        );
    }

    private void sleepQuietly(long ms) {
        if (ms <= 0) {
            return;
        }
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
