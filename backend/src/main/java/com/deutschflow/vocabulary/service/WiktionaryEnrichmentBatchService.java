package com.deutschflow.vocabulary.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Batch enrich existing words from Wiktionary:
 * - Fill IPA into {@code words.phonetic} when missing
 * - Upsert {@code word_translations} for:
 *   - locale='en': meaning + example_en (if available)
 *   - locale='de': example_de (if available)
 *
 * Resume via {@code vocabulary_import_state}.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WiktionaryEnrichmentBatchService {

    private static final String SOURCE = "WIKTIONARY_ENRICH";

    private final JdbcTemplate jdbcTemplate;
    private final WiktionaryScraperService wiktionaryScraperService;

    @Value("${app.vocabulary.ipa-batch.words-per-run:200}")
    private int wordsPerRun;

    /** Giới trần mỗi request admin (scheduler gọi với batch nhỏ, không đụng giá trị lớn). */
    @Value("${app.vocabulary.wiktionary-enrich.admin-max-per-batch:10000}")
    private int adminMaxPerBatch;

    @Value("${app.vocabulary.ipa-batch.request-delay-ms:1000}")
    private long requestDelayMs;

    public Map<String, Object> enrichOne(long wordId) {
        String lemma = jdbcTemplate.query(
                "SELECT base_form FROM words WHERE id = ?",
                rs -> rs.next() ? rs.getString("base_form") : null,
                wordId
        );
        if (lemma == null || lemma.isBlank()) {
            return Map.of(
                    "source", SOURCE,
                    "wordId", wordId,
                    "status", "NOT_FOUND"
            );
        }

        String trimmed = lemma.trim();
        Optional<WiktionaryScraperService.WordData> maybe = wiktionaryScraperService.scrapeWord(trimmed);
        if (maybe.isEmpty()) {
            return Map.of(
                    "source", SOURCE,
                    "wordId", wordId,
                    "lemma", trimmed,
                    "status", "NO_DATA"
            );
        }

        WiktionaryScraperService.WordData data = maybe.get();
        int ipaFilled = 0;
        int enUpserts = 0;
        int deUpserts = 0;
        int lockRetries = 0;

        int attempts = 0;
        while (true) {
            attempts++;
            try {
                // IPA + usage_note
                String ipa = data.getIpa() == null ? null : data.getIpa().trim();
                String bracket = IpaNormalization.toBracketForm(ipa);
                String usageNote = data.getUsageNote();
                if ((bracket != null && !bracket.isBlank()) || (usageNote != null && !usageNote.isBlank())) {
                    int updated = jdbcTemplate.update(
                            """
                            UPDATE words SET
                              phonetic = CASE WHEN phonetic IS NULL OR TRIM(phonetic) = '' THEN ? ELSE phonetic END,
                              usage_note = CASE WHEN usage_note IS NULL OR TRIM(usage_note) = '' THEN ? ELSE usage_note END,
                              updated_at = NOW()
                            WHERE id = ?
                            """,
                            bracket,
                            usageNote,
                            wordId
                    );
                    if (updated > 0) ipaFilled++;
                }

                // Gender → chỉ lưu vào nouns table khi dtype = Noun
                String gender = data.getGender();
                String dtype = jdbcTemplate.query(
                        "SELECT dtype FROM words WHERE id = ?",
                        rs -> rs.next() ? rs.getString("dtype") : null,
                        wordId
                );
                if ("Noun".equals(dtype)) {
                    if (gender != null && !gender.isBlank()) {
                        jdbcTemplate.update(
                                """
                                INSERT INTO nouns (id, gender, noun_type)
                                VALUES (?, ?, 'STARK')
                                ON CONFLICT (id) DO UPDATE SET
                                  gender = CASE WHEN nouns.gender IS NULL THEN EXCLUDED.gender ELSE nouns.gender END
                                """,
                                wordId, gender
                        );
                        if (data.getPlural() != null && !data.getPlural().isBlank()) {
                            jdbcTemplate.update(
                                    "UPDATE nouns SET plural_form = COALESCE(NULLIF(plural_form,''), ?) WHERE id = ?",
                                    data.getPlural(), wordId
                            );
                        }
                    }
                } else {
                    // Xóa nouns record sai nếu tồn tại cho non-Noun word
                    jdbcTemplate.update("DELETE FROM nouns WHERE id = ?", wordId);
                }

                // Verb data từ Wiktionary (partizip2, auxiliary, separable)
                if ("Verb".equals(dtype)) {
                    String partizip2 = data.getPartizip2();
                    String auxiliary = data.getAuxiliaryVerb();
                    Boolean separable = data.getIsSeparable();
                    Boolean reflexive = data.getIsReflexive();
                    if (partizip2 != null || auxiliary != null || Boolean.TRUE.equals(separable)) {
                        jdbcTemplate.update(
                                """
                                INSERT INTO verbs (id, auxiliary_verb, partizip2, is_separable, is_irregular)
                                VALUES (?, COALESCE(NULLIF(TRIM(?), ''), 'HABEN'), COALESCE(NULLIF(TRIM(?), ''), 'n/a'), COALESCE(?, FALSE), FALSE)
                                ON CONFLICT (id) DO UPDATE SET
                                  auxiliary_verb = CASE WHEN EXCLUDED.auxiliary_verb IS NOT NULL THEN EXCLUDED.auxiliary_verb ELSE verbs.auxiliary_verb END,
                                  partizip2 = CASE WHEN (verbs.partizip2 IS NULL OR TRIM(verbs.partizip2) = '') AND EXCLUDED.partizip2 IS NOT NULL AND EXCLUDED.partizip2 <> 'n/a' THEN EXCLUDED.partizip2 ELSE verbs.partizip2 END,
                                  is_separable = CASE WHEN EXCLUDED.is_separable IS TRUE THEN TRUE ELSE verbs.is_separable END
                                """,
                                wordId, auxiliary, partizip2, separable
                        );
                    }
                }

                // EN meaning + example (if present)
                String meaningEn = data.getMeaning();
                String exampleEn = data.getExampleEn();
                if ((meaningEn != null && !meaningEn.isBlank()) || (exampleEn != null && !exampleEn.isBlank())) {
                    jdbcTemplate.update(
                            """
                            INSERT INTO word_translations (word_id, locale, meaning, example)
                            VALUES (?, 'en', COALESCE(NULLIF(?, ''), ''), NULLIF(?, ''))
                            ON CONFLICT (word_id, locale) DO UPDATE SET
                              meaning = CASE
                                WHEN word_translations.meaning IS NULL
                                  OR TRIM(word_translations.meaning) = ''
                                  OR LOWER(word_translations.meaning) LIKE 'not in wordlists/local_lexicon.tsv%'
                                  OR LOWER(word_translations.meaning) LIKE 'chưa có trong wordlists/local_lexicon.tsv%'
                                THEN EXCLUDED.meaning
                                ELSE word_translations.meaning
                              END,
                              example = CASE
                                WHEN word_translations.example IS NULL
                                  OR TRIM(word_translations.example) = ''
                                  OR LOWER(word_translations.example) LIKE 'beispiel: das wort%'
                                THEN EXCLUDED.example
                                ELSE word_translations.example
                              END
                            """,
                            wordId,
                            meaningEn == null ? "" : meaningEn.trim(),
                            exampleEn == null ? "" : exampleEn.trim()
                    );
                    enUpserts++;
                }

                // DE example (store in locale 'de' example, keep meaning empty)
                String exampleDe = data.getExampleDe();
                if (exampleDe != null && !exampleDe.isBlank()) {
                    jdbcTemplate.update(
                            """
                            INSERT INTO word_translations (word_id, locale, meaning, example)
                            VALUES (?, 'de', '', NULLIF(?, ''))
                            ON CONFLICT (word_id, locale) DO UPDATE SET
                              example = CASE WHEN word_translations.example IS NULL OR TRIM(word_translations.example) = '' THEN EXCLUDED.example ELSE word_translations.example END
                            """,
                            wordId,
                            exampleDe.trim()
                    );
                    deUpserts++;
                }
                break;
            } catch (DataAccessException dae) {
                if (isLockTimeout(dae) && attempts < 4) {
                    lockRetries++;
                    sleepQuietly(200L * attempts);
                    continue;
                }
                throw dae;
            }
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("source", SOURCE);
        out.put("wordId", wordId);
        out.put("lemma", trimmed);
        out.put("ipaFilled", ipaFilled);
        out.put("enUpserts", enUpserts);
        out.put("deUpserts", deUpserts);
        out.put("lockRetries", lockRetries);
        out.put("status", "OK");
        return out;
    }

    public Map<String, Object> runBatch(Integer limitOverride, boolean shouldResetCursor) {
        if (shouldResetCursor) {
            resetCursor();
        }

        int limit = limitOverride != null && limitOverride > 0
                ? Math.min(limitOverride, Math.max(1, adminMaxPerBatch))
                : wordsPerRun;
        Long lastId = parseLong(getState("last_processed_word_id"));
        if (lastId == null) lastId = 0L;

        List<Long> ids = jdbcTemplate.query(
                """
                SELECT w.id
                FROM words w
                WHERE w.id > ?
                  AND (
                       w.phonetic IS NULL OR TRIM(w.phonetic) = ''
                    OR NOT EXISTS (SELECT 1 FROM word_translations t WHERE t.word_id = w.id AND t.locale = 'en')
                    OR NOT EXISTS (SELECT 1 FROM word_translations t WHERE t.word_id = w.id AND t.locale = 'de')
                    OR EXISTS (
                      SELECT 1
                      FROM word_translations t_en
                      WHERE t_en.word_id = w.id
                        AND t_en.locale = 'en'
                        AND (
                             t_en.meaning IS NULL OR TRIM(t_en.meaning) = ''
                          OR LOWER(t_en.meaning) LIKE 'not in wordlists/local_lexicon.tsv%'
                          OR LOWER(t_en.meaning) LIKE 'chưa có trong wordlists/local_lexicon.tsv%'
                        )
                    )
                  )
                ORDER BY
                  CASE COALESCE(NULLIF(TRIM(w.cefr_level), ''), 'ZZ')
                    WHEN 'A1' THEN 1 WHEN 'A2' THEN 2 WHEN 'B1' THEN 3 WHEN 'B2' THEN 4
                    WHEN 'C1' THEN 5 WHEN 'C2' THEN 6
                    ELSE 99 END,
                  w.id ASC
                LIMIT ?
                """,
                (rs, rn) -> rs.getLong("id"),
                lastId,
                limit
        );

        int processed = 0;
        int ipaFilled = 0;
        int enUpserts = 0;
        int deUpserts = 0;
        int failed = 0;
        int lockRetries = 0;
        long maxSeen = lastId;

        for (Long id : ids) {
            processed++;
            String lemma = jdbcTemplate.query(
                    "SELECT base_form FROM words WHERE id = ?",
                    rs -> rs.next() ? rs.getString("base_form") : null,
                    id
            );
            if (lemma == null || lemma.isBlank()) {
                maxSeen = Math.max(maxSeen, id);
                setState("last_processed_word_id", String.valueOf(maxSeen));
                continue;
            }
            String trimmed = lemma.trim();

            try {
                Optional<WiktionaryScraperService.WordData> maybe = wiktionaryScraperService.scrapeWord(trimmed);
                if (maybe.isEmpty()) {
                    failed++;
                    maxSeen = Math.max(maxSeen, id);
                    setState("last_processed_word_id", String.valueOf(maxSeen));
                    sleepQuietly(requestDelayMs);
                    continue;
                }

                WiktionaryScraperService.WordData data = maybe.get();

                int attempts = 0;
                while (true) {
                    attempts++;
                    try {
                        // IPA + usage_note
                        String ipa = data.getIpa() == null ? null : data.getIpa().trim();
                        String bracket = IpaNormalization.toBracketForm(ipa);
                        String usageNote = data.getUsageNote();
                        if ((bracket != null && !bracket.isBlank()) || (usageNote != null && !usageNote.isBlank())) {
                            int updated = jdbcTemplate.update(
                                    """
                                    UPDATE words SET
                                      phonetic = CASE WHEN phonetic IS NULL OR TRIM(phonetic) = '' THEN ? ELSE phonetic END,
                                      usage_note = CASE WHEN usage_note IS NULL OR TRIM(usage_note) = '' THEN ? ELSE usage_note END,
                                      updated_at = NOW()
                                    WHERE id = ?
                                    """,
                                    bracket, usageNote, id
                            );
                            if (updated > 0) ipaFilled++;
                        }

                        // Gender → chỉ lưu vào nouns table khi dtype = Noun
                        String gender = data.getGender();
                        String dtype = jdbcTemplate.query(
                                "SELECT dtype FROM words WHERE id = ?",
                                rs -> rs.next() ? rs.getString("dtype") : null,
                                id
                        );
                        if ("Noun".equals(dtype)) {
                            if (gender != null && !gender.isBlank()) {
                                jdbcTemplate.update(
                                        """
                                        INSERT INTO nouns (id, gender, noun_type)
                                        VALUES (?, ?, 'STARK')
                                        ON CONFLICT (id) DO UPDATE SET
                                          gender = CASE WHEN nouns.gender IS NULL THEN EXCLUDED.gender ELSE nouns.gender END
                                        """,
                                        id, gender
                                );
                                if (data.getPlural() != null && !data.getPlural().isBlank()) {
                                    jdbcTemplate.update(
                                            "UPDATE nouns SET plural_form = COALESCE(NULLIF(plural_form,''), ?) WHERE id = ?",
                                            data.getPlural(), id
                                    );
                                }
                            }
                        } else {
                            // Xóa nouns record sai nếu tồn tại cho non-Noun word
                            jdbcTemplate.update("DELETE FROM nouns WHERE id = ?", id);
                        }

                        // Verb data từ Wiktionary
                        if ("Verb".equals(dtype)) {
                            String partizip2 = data.getPartizip2();
                            String auxiliary = data.getAuxiliaryVerb();
                            Boolean separable = data.getIsSeparable();
                            if (partizip2 != null || auxiliary != null || Boolean.TRUE.equals(separable)) {
                                jdbcTemplate.update(
                                        """
                                        INSERT INTO verbs (id, auxiliary_verb, partizip2, is_separable, is_irregular)
                                        VALUES (?, COALESCE(NULLIF(TRIM(?), ''), 'HABEN'), COALESCE(NULLIF(TRIM(?), ''), 'n/a'), COALESCE(?, FALSE), FALSE)
                                        ON CONFLICT (id) DO UPDATE SET
                                          auxiliary_verb = CASE WHEN EXCLUDED.auxiliary_verb IS NOT NULL THEN EXCLUDED.auxiliary_verb ELSE verbs.auxiliary_verb END,
                                          partizip2 = CASE WHEN (verbs.partizip2 IS NULL OR TRIM(verbs.partizip2) = '') AND EXCLUDED.partizip2 IS NOT NULL AND EXCLUDED.partizip2 <> 'n/a' THEN EXCLUDED.partizip2 ELSE verbs.partizip2 END,
                                          is_separable = CASE WHEN EXCLUDED.is_separable IS TRUE THEN TRUE ELSE verbs.is_separable END
                                        """,
                                        id, auxiliary, partizip2, separable
                                );
                            }
                        }

                        // EN meaning + example (if present)
                        String meaningEn = data.getMeaning();
                        String exampleEn = data.getExampleEn();
                        if ((meaningEn != null && !meaningEn.isBlank()) || (exampleEn != null && !exampleEn.isBlank())) {
                            jdbcTemplate.update(
                                    """
                                    INSERT INTO word_translations (word_id, locale, meaning, example)
                                    VALUES (?, 'en', COALESCE(NULLIF(?, ''), ''), NULLIF(?, ''))
                                    ON CONFLICT (word_id, locale) DO UPDATE SET
                                      meaning = CASE
                                        WHEN word_translations.meaning IS NULL
                                          OR TRIM(word_translations.meaning) = ''
                                          OR LOWER(word_translations.meaning) LIKE 'not in wordlists/local_lexicon.tsv%'
                                          OR LOWER(word_translations.meaning) LIKE 'chưa có trong wordlists/local_lexicon.tsv%'
                                        THEN EXCLUDED.meaning
                                        ELSE word_translations.meaning
                                      END,
                                      example = CASE
                                        WHEN word_translations.example IS NULL
                                          OR TRIM(word_translations.example) = ''
                                          OR LOWER(word_translations.example) LIKE 'beispiel: das wort%'
                                        THEN EXCLUDED.example
                                        ELSE word_translations.example
                                      END
                                    """,
                                    id,
                                    meaningEn == null ? "" : meaningEn.trim(),
                                    exampleEn == null ? "" : exampleEn.trim()
                            );
                            enUpserts++;
                        }

                        // DE example (store in locale 'de' example, keep meaning empty)
                        String exampleDe = data.getExampleDe();
                        if (exampleDe != null && !exampleDe.isBlank()) {
                            jdbcTemplate.update(
                                    """
                                    INSERT INTO word_translations (word_id, locale, meaning, example)
                                    VALUES (?, 'de', '', NULLIF(?, ''))
                                    ON CONFLICT (word_id, locale) DO UPDATE SET
                                      example = CASE WHEN word_translations.example IS NULL OR TRIM(word_translations.example) = '' THEN EXCLUDED.example ELSE word_translations.example END
                                    """,
                                    id,
                                    exampleDe.trim()
                            );
                            deUpserts++;
                        }
                        break;
                    } catch (DataAccessException dae) {
                        if (isLockTimeout(dae) && attempts < 4) {
                            lockRetries++;
                            sleepQuietly(200L * attempts);
                            continue;
                        }
                        throw dae;
                    }
                }

                maxSeen = Math.max(maxSeen, id);
                setState("last_processed_word_id", String.valueOf(maxSeen));
            } catch (Exception e) {
                log.warn("Wiktionary enrich failed for id={} lemma={}: {}", id, trimmed, e.getMessage());
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
        out.put("processed", processed);
        out.put("ipaFilled", ipaFilled);
        out.put("enUpserts", enUpserts);
        out.put("deUpserts", deUpserts);
        out.put("failed", failed);
        out.put("lockRetries", lockRetries);
        out.put("lastProcessedWordId", maxSeen);
        out.put("status", ids.isEmpty() ? "IDLE" : "OK");
        out.put("resetCursor", shouldResetCursor);
        return out;
    }

    public void resetCursor() {
        setState("last_processed_word_id", "0");
    }

    /**
     * Phase 2 Tier 2 — Enrich gender for Nouns that have no gender yet.
     * Idempotent: always fetches first N nouns missing gender (no cursor).
     * Calls Wiktionary for each and writes gender + plural_form to nouns table.
     */
    public Map<String, Object> runGenderOnlyBatch(Integer limitOverride) {
        int cap = Math.min(limitOverride != null && limitOverride > 0 ? limitOverride : 100, 500);

        // Count how many nouns still lack gender
        Integer remaining = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM nouns WHERE gender IS NULL",
                Integer.class);

        // Fetch nouns missing gender — A1/A2 first
        List<Map<String, Object>> targets = jdbcTemplate.queryForList(
                "SELECT w.id, w.base_form, w.cefr_level" +
                " FROM words w JOIN nouns n ON n.id = w.id" +
                " WHERE n.gender IS NULL" +
                " ORDER BY CASE COALESCE(w.cefr_level,'ZZ')" +
                "   WHEN 'A1' THEN 1 WHEN 'A2' THEN 2 WHEN 'B1' THEN 3" +
                "   WHEN 'B2' THEN 4 WHEN 'C1' THEN 5 WHEN 'C2' THEN 6 ELSE 99 END, w.id ASC" +
                " LIMIT " + cap);

        int genderFilled = 0;
        int pluralFilled = 0;
        int noData = 0;

        for (Map<String, Object> row : targets) {
            long id = ((Number) row.get("id")).longValue();
            String lemma = (String) row.get("base_form");
            if (lemma == null || lemma.isBlank()) continue;

            try {
                Optional<WiktionaryScraperService.WordData> maybe = wiktionaryScraperService.scrapeWord(lemma.trim());
                if (maybe.isEmpty()) { noData++; sleepQuietly(requestDelayMs); continue; }

                WiktionaryScraperService.WordData data = maybe.get();
                String gender = data.getGender();
                if (gender != null && !gender.isBlank()) {
                    jdbcTemplate.update(
                            "INSERT INTO nouns (id, gender, noun_type) VALUES (?, ?, 'STARK')" +
                            " ON CONFLICT (id) DO UPDATE SET" +
                            "   gender = CASE WHEN nouns.gender IS NULL THEN EXCLUDED.gender ELSE nouns.gender END",
                            id, gender);
                    genderFilled++;
                    if (data.getPlural() != null && !data.getPlural().isBlank()) {
                        jdbcTemplate.update(
                                "UPDATE nouns SET plural_form = COALESCE(NULLIF(plural_form,''), ?) WHERE id = ?",
                                data.getPlural(), id);
                        pluralFilled++;
                    }
                } else {
                    noData++;
                }
            } catch (Exception e) {
                log.warn("[GenderOnly] Failed id={} lemma={}: {}", id, lemma, e.getMessage());
                noData++;
            }
            sleepQuietly(requestDelayMs);
        }

        var out = new LinkedHashMap<String, Object>();
        out.put("source", "WIKTIONARY_GENDER_ONLY");
        out.put("processed", targets.size());
        out.put("genderFilled", genderFilled);
        out.put("pluralFilled", pluralFilled);
        out.put("noData", noData);
        out.put("remaining", remaining);
        out.put("status", targets.isEmpty() ? "IDLE" : "OK");
        return out;
    }

    /**
     * Phase 3 — Enrich words missing IPA phonetic OR EN meaning.
     * Idempotent: fetches first N words with missing data (no cursor needed).
     */
    public Map<String, Object> runMissingDataBatch(Integer limitOverride) {
        int cap = Math.min(limitOverride != null && limitOverride > 0 ? limitOverride : 100, 500);

        Integer remainingIpa = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM words WHERE phonetic IS NULL OR TRIM(phonetic) = ''",
                Integer.class);
        Integer remainingEn = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM words WHERE NOT EXISTS" +
                " (SELECT 1 FROM word_translations t WHERE t.word_id = words.id AND t.locale = 'en'" +
                "   AND t.meaning IS NOT NULL AND TRIM(t.meaning) <> '')",
                Integer.class);

        List<Long> ids = jdbcTemplate.query(
                "SELECT w.id FROM words w" +
                " WHERE (w.phonetic IS NULL OR TRIM(w.phonetic) = '')" +
                "    OR NOT EXISTS (SELECT 1 FROM word_translations t WHERE t.word_id = w.id" +
                "                   AND t.locale = 'en' AND t.meaning IS NOT NULL AND TRIM(t.meaning) <> '')" +
                " ORDER BY CASE COALESCE(w.cefr_level,'ZZ')" +
                "   WHEN 'A1' THEN 1 WHEN 'A2' THEN 2 WHEN 'B1' THEN 3" +
                "   WHEN 'B2' THEN 4 WHEN 'C1' THEN 5 WHEN 'C2' THEN 6 ELSE 99 END, w.id ASC" +
                " LIMIT " + cap,
                (rs, rn) -> rs.getLong("id"));

        int ipaFilled = 0;
        int enFilled = 0;
        int noData = 0;

        for (Long id : ids) {
            String lemma = jdbcTemplate.query(
                    "SELECT base_form FROM words WHERE id = ?",
                    rs -> rs.next() ? rs.getString("base_form") : null, id);
            if (lemma == null || lemma.isBlank()) continue;

            try {
                Optional<WiktionaryScraperService.WordData> maybe = wiktionaryScraperService.scrapeWord(lemma.trim());
                if (maybe.isEmpty()) { noData++; sleepQuietly(requestDelayMs); continue; }

                WiktionaryScraperService.WordData data = maybe.get();

                // IPA
                String ipa = data.getIpa();
                String bracket = IpaNormalization.toBracketForm(ipa == null ? null : ipa.trim());
                if (bracket != null && !bracket.isBlank()) {
                    int updated = jdbcTemplate.update(
                            "UPDATE words SET phonetic = CASE WHEN phonetic IS NULL OR TRIM(phonetic) = '' THEN ? ELSE phonetic END," +
                            " updated_at = NOW() WHERE id = ?",
                            bracket, id);
                    if (updated > 0) ipaFilled++;
                }

                // EN meaning
                String meaningEn = data.getMeaning();
                String exampleEn = data.getExampleEn();
                if (meaningEn != null && !meaningEn.isBlank()) {
                    jdbcTemplate.update(
                            "INSERT INTO word_translations (word_id, locale, meaning, example)" +
                            " VALUES (?, 'en', ?, NULLIF(?, ''))" +
                            " ON CONFLICT (word_id, locale) DO UPDATE SET" +
                            "   meaning = CASE WHEN word_translations.meaning IS NULL OR TRIM(word_translations.meaning) = ''" +
                            "   THEN EXCLUDED.meaning ELSE word_translations.meaning END," +
                            "   example = CASE WHEN word_translations.example IS NULL OR TRIM(word_translations.example) = ''" +
                            "   THEN EXCLUDED.example ELSE word_translations.example END",
                            id, meaningEn.trim(),
                            exampleEn == null ? "" : exampleEn.trim());
                    enFilled++;
                } else {
                    noData++;
                }
            } catch (Exception e) {
                log.warn("[MissingData] Failed id={} lemma={}: {}", id, lemma, e.getMessage());
                noData++;
            }
            sleepQuietly(requestDelayMs);
        }

        var out = new LinkedHashMap<String, Object>();
        out.put("source", "WIKTIONARY_MISSING_DATA");
        out.put("processed", ids.size());
        out.put("ipaFilled", ipaFilled);
        out.put("enFilled", enFilled);
        out.put("noData", noData);
        out.put("remainingIpa", remainingIpa);
        out.put("remainingEn", remainingEn);
        out.put("status", ids.isEmpty() ? "IDLE" : "OK");
        return out;
    }

    private Long parseLong(String s) {
        if (s == null || s.isBlank()) return null;
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

    private boolean isLockTimeout(Exception e) {
        Throwable cur = e;
        while (cur != null) {
            String msg = cur.getMessage();
            if (msg != null && msg.toLowerCase().contains("lock wait timeout exceeded")) {
                return true;
            }
            cur = cur.getCause();
        }
        return false;
    }

    private void sleepQuietly(long ms) {
        if (ms <= 0) return;
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}

