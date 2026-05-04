package com.deutschflow.vocabulary.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Enrich nghĩa tiếng Việt cho từ trong DB bằng cách scrape Glosbe DE→VI.
 * URL: https://vi.glosbe.com/de/vi/{word}
 * Rate limit: 1 req/1.5s để tránh bị block.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GlosbeViEnrichmentService {

    private static final String SOURCE = "GLOSBE_VI_ENRICH";
    private static final String BASE_URL = "https://vi.glosbe.com/de/vi/";
    private static final String USER_AGENT =
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    private static final int TIMEOUT_MS = 12000;
    private static final long RATE_LIMIT_MS = 1500;

    private final JdbcTemplate jdbcTemplate;
    private final EnrichmentSuspendGate enrichmentSuspendGate;
    private long lastRequestTime = 0;

    @Value("${app.vocabulary.glosbe-vi.enabled:false}")
    private boolean enabled;

    @Value("${app.vocabulary.glosbe-vi.batch-size:30}")
    private int batchSize;

    /** Trần từ/request khi admin chạy batch tay (scheduler chỉ truyền {@link #batchSize}). */
    @Value("${app.vocabulary.glosbe-vi.admin-max-per-batch:10000}")
    private int adminMaxPerBatch;

    // ── Scheduled job ─────────────────────────────────────────────────────────

    @Scheduled(fixedDelayString = "${app.vocabulary.glosbe-vi.delay-ms:5000}")
    public void runScheduled() {
        if (!enabled || enrichmentSuspendGate.isEnrichmentSuspended()) {
            return;
        }
        try {
            Map<String, Object> result = runBatch(batchSize, false);
            String status = String.valueOf(result.getOrDefault("status", "?"));
            if ("IDLE".equals(status)) {
                // Reset cursor để chạy lại — nhiều từ vẫn chưa có nghĩa VI
                log.info("Glosbe VI: cursor exhausted, resetting to re-enrich missing words.");
                setState("last_processed_word_id", "0");
            } else {
                log.info("Glosbe VI enrich: processed={} viUpserts={} failed={} status={}",
                        result.get("processedRows"), result.get("viUpserts"), result.get("failed"), status);
            }
        } catch (Exception e) {
            log.warn("Glosbe VI enrich scheduler error: {}", e.getMessage());
        }
    }

    // ── Public API ────────────────────────────────────────────────────────────

    public Map<String, Object> runBatch(Integer limitOverride, boolean resetCursor) {
        if (resetCursor) setState("last_processed_word_id", "0");

        int limit = limitOverride != null && limitOverride > 0
                ? Math.min(limitOverride, Math.max(1, adminMaxPerBatch))
                : batchSize;
        Long lastId = parseLong(getState("last_processed_word_id"));
        if (lastId == null) lastId = 0L;

        // Lấy từ chưa có nghĩa VI (hoặc có placeholder)
        List<Long> ids = jdbcTemplate.query(
                """
                SELECT w.id
                FROM words w
                WHERE w.id > ?
                  AND NOT EXISTS (
                    SELECT 1 FROM word_translations t
                    WHERE t.word_id = w.id AND t.locale = 'vi'
                      AND t.meaning IS NOT NULL AND TRIM(t.meaning) != ''
                      AND LOWER(t.meaning) NOT LIKE 'not in wordlists%'
                      AND LOWER(t.meaning) NOT LIKE 'chưa có trong%'
                  )
                ORDER BY
                  CASE COALESCE(NULLIF(TRIM(w.cefr_level), ''), 'ZZ')
                    WHEN 'A1' THEN 1 WHEN 'A2' THEN 2 WHEN 'B1' THEN 3 WHEN 'B2' THEN 4 WHEN 'C1' THEN 5 WHEN 'C2' THEN 6
                    ELSE 99 END,
                  w.id ASC
                LIMIT ?
                """,
                (rs, rn) -> rs.getLong("id"),
                lastId, limit
        );

        int processed = 0, viUpserts = 0, failed = 0;
        long maxSeen = lastId;

        for (Long id : ids) {
            processed++;
            String lemma = jdbcTemplate.query(
                    "SELECT base_form FROM words WHERE id = ?",
                    rs -> rs.next() ? rs.getString("base_form") : null, id);
            if (lemma == null || lemma.isBlank()) {
                maxSeen = Math.max(maxSeen, id);
                setState("last_processed_word_id", String.valueOf(maxSeen));
                continue;
            }

            try {
                String meaning = scrapeViMeaning(lemma.trim());
                if (meaning != null && !meaning.isBlank()) {
                    jdbcTemplate.update(
                            """
                            INSERT INTO word_translations (word_id, locale, meaning, example)
                            VALUES (?, 'vi', ?, NULL)
                            ON CONFLICT (word_id, locale) DO UPDATE SET
                              meaning = CASE
                                WHEN word_translations.meaning IS NULL OR TRIM(word_translations.meaning) = ''
                                  OR LOWER(word_translations.meaning) LIKE 'not in wordlists%'
                                  OR LOWER(word_translations.meaning) LIKE 'chưa có trong%'
                                THEN EXCLUDED.meaning
                                ELSE word_translations.meaning
                              END
                            """,
                            id, meaning
                    );
                    viUpserts++;
                    log.debug("Glosbe VI: {} → {}", lemma, meaning);
                } else {
                    failed++;
                }
            } catch (Exception e) {
                log.warn("Glosbe VI failed for {}: {}", lemma, e.getMessage());
                failed++;
            }

            maxSeen = Math.max(maxSeen, id);
            setState("last_processed_word_id", String.valueOf(maxSeen));
            sleepQuietly(RATE_LIMIT_MS);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("source", SOURCE);
        out.put("processedRows", ids.size());
        out.put("processed", processed);
        out.put("viUpserts", viUpserts);
        out.put("failed", failed);
        out.put("lastProcessedWordId", maxSeen);
        out.put("status", ids.isEmpty() ? "IDLE" : "OK");
        return out;
    }

    public Map<String, Object> enrichOne(long wordId) {
        String lemma = jdbcTemplate.query(
                "SELECT base_form FROM words WHERE id = ?",
                rs -> rs.next() ? rs.getString("base_form") : null, wordId);
        if (lemma == null || lemma.isBlank()) {
            return Map.of("source", SOURCE, "wordId", wordId, "status", "NOT_FOUND");
        }
        try {
            String meaning = scrapeViMeaning(lemma.trim());
            if (meaning != null && !meaning.isBlank()) {
                jdbcTemplate.update(
                        """
                        INSERT INTO word_translations (word_id, locale, meaning, example)
                        VALUES (?, 'vi', ?, NULL)
                        ON CONFLICT (word_id, locale) DO UPDATE SET meaning = EXCLUDED.meaning
                        """, wordId, meaning);
                return Map.of("source", SOURCE, "wordId", wordId, "lemma", lemma, "meaning", meaning, "status", "OK");
            }
            return Map.of("source", SOURCE, "wordId", wordId, "lemma", lemma, "status", "NO_DATA");
        } catch (Exception e) {
            return Map.of("source", SOURCE, "wordId", wordId, "lemma", lemma, "status", "ERROR", "error", e.getMessage());
        }
    }

    // ── Scraper ───────────────────────────────────────────────────────────────

    private String scrapeViMeaning(String word) throws Exception {
        enforceRateLimit();
        String encoded = java.net.URLEncoder.encode(word, java.nio.charset.StandardCharsets.UTF_8)
                .replace("+", "%20");
        String url = BASE_URL + encoded;

        Document doc = Jsoup.connect(url)
                .userAgent(USER_AGENT)
                .header("Accept-Language", "vi,en;q=0.9")
                .timeout(TIMEOUT_MS)
                .get();

        List<String> meanings = new ArrayList<>();

        // Strategy 1: <strong> tags in translation section (most reliable)
        Elements strongs = doc.select("strong");
        for (Element s : strongs) {
            String text = s.text().trim();
            // Filter: Vietnamese text (contains Vietnamese chars or common words)
            if (looksVietnamese(text) && text.length() >= 2 && text.length() <= 80) {
                // Skip if it's the German word itself
                if (!text.equalsIgnoreCase(word) && !text.toLowerCase().contains(word.toLowerCase())) {
                    meanings.add(text);
                }
            }
        }

        // Strategy 2: translation list items
        if (meanings.isEmpty()) {
            Elements items = doc.select("li.translation__item, div.translation, span.translation");
            for (Element item : items) {
                String text = item.text().trim();
                if (looksVietnamese(text) && text.length() >= 2 && text.length() <= 80) {
                    meanings.add(text);
                }
            }
        }

        if (meanings.isEmpty()) return null;

        // Lấy tối đa 3 nghĩa, join bằng dấu phẩy
        List<String> deduped = meanings.stream().distinct().limit(3).toList();
        return String.join(", ", deduped);
    }

    private boolean looksVietnamese(String text) {
        if (text == null || text.isBlank()) return false;
        // Vietnamese-specific characters
        String vi = "àáâãèéêìíòóôõùúýăđơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ"
                + "ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝĂĐƠƯẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼẾỀỂỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪỬỮỰỲỴỶỸ";
        for (char c : text.toCharArray()) {
            if (vi.indexOf(c) >= 0) return true;
        }
        // Common Vietnamese words without diacritics
        String lower = text.toLowerCase();
        return lower.equals("học") || lower.equals("có") || lower.equals("là") || lower.equals("và")
                || lower.equals("không") || lower.equals("được") || lower.equals("của")
                || lower.contains(" ") && lower.length() > 3; // multi-word likely Vietnamese
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void enforceRateLimit() {
        long now = System.currentTimeMillis();
        long elapsed = now - lastRequestTime;
        if (elapsed < RATE_LIMIT_MS) {
            sleepQuietly(RATE_LIMIT_MS - elapsed);
        }
        lastRequestTime = System.currentTimeMillis();
    }

    private void sleepQuietly(long ms) {
        if (ms <= 0) return;
        try { Thread.sleep(ms); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
    }

    private Long parseLong(String s) {
        if (s == null || s.isBlank()) return null;
        try { return Long.parseLong(s.trim()); } catch (NumberFormatException e) { return null; }
    }

    private String getState(String key) {
        return jdbcTemplate.query(
                "SELECT state_value FROM vocabulary_import_state WHERE source_name = ? AND state_key = ? LIMIT 1",
                rs -> rs.next() ? rs.getString("state_value") : null, SOURCE, key);
    }

    private void setState(String key, String value) {
        jdbcTemplate.update(
                """
                INSERT INTO vocabulary_import_state (source_name, state_key, state_value)
                VALUES (?, ?, ?)
                ON CONFLICT (source_name, state_key)
                DO UPDATE SET state_value = EXCLUDED.state_value, updated_at = CURRENT_TIMESTAMP
                """, SOURCE, key, value);
    }
}
