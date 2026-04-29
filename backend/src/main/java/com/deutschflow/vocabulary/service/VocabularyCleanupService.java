package com.deutschflow.vocabulary.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Cleanup utilities for imported vocabulary data.
 */
@Service
@RequiredArgsConstructor
public class VocabularyCleanupService {
    private final JdbcTemplate jdbcTemplate;

    public Map<String, Object> dbInfo() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("database", jdbcTemplate.queryForObject("SELECT DATABASE()", String.class));
        out.put("version", jdbcTemplate.queryForObject("SELECT VERSION()", String.class));
        out.put("host", jdbcTemplate.queryForObject("SELECT @@hostname", String.class));
        out.put("port", jdbcTemplate.queryForObject("SELECT @@port", Integer.class));
        out.put("currentUser", jdbcTemplate.queryForObject("SELECT CURRENT_USER()", String.class));
        out.put("sessionUser", jdbcTemplate.queryForObject("SELECT USER()", String.class));
        return out;
    }

    public Map<String, Object> searchWordsByBaseForm(String query, Integer limit) {
        String q = query == null ? "" : query.trim();
        int cap = (limit == null || limit < 1) ? 50 : Math.min(limit, 500);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("query", q);
        out.put("limit", cap);

        if (q.isBlank()) {
            out.put("items", List.of());
            return out;
        }

        String like = "%" + q + "%";
        List<Map<String, Object>> items = jdbcTemplate.query(
                """
                SELECT id, base_form, cefr_level, dtype
                FROM words
                WHERE base_form LIKE ?
                ORDER BY id ASC
                LIMIT ?
                """,
                new Object[]{like, cap},
                (rs, rowNum) -> Map.of(
                        "id", rs.getLong("id"),
                        "baseForm", rs.getString("base_form"),
                        "cefrLevel", rs.getString("cefr_level"),
                        "dtype", rs.getString("dtype")
                )
        );
        out.put("items", items);
        return out;
    }

    public Map<String, Object> sampleConcatenatedLemmas(Integer limit) {
        int cap = (limit == null || limit < 1) ? 50 : Math.min(limit, 500);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("limit", cap);
        Long total = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*)
                FROM words
                WHERE REGEXP_LIKE(base_form, '[[:lower:]][[:upper:]]', 'c')
                  AND base_form NOT LIKE '%% %%'
                  AND CHAR_LENGTH(base_form) >= 20
                """,
                Long.class
        );
        out.put("matchedTotal", total == null ? 0 : total);
        List<Map<String, Object>> items = jdbcTemplate.query(
                """
                SELECT id, base_form, cefr_level, dtype
                FROM words
                WHERE REGEXP_LIKE(base_form, '[[:lower:]][[:upper:]]', 'c')
                  AND base_form NOT LIKE '%% %%'
                  AND CHAR_LENGTH(base_form) >= 20
                ORDER BY id ASC
                LIMIT ?
                """,
                new Object[]{cap},
                (rs, rowNum) -> Map.of(
                        "id", rs.getLong("id"),
                        "baseForm", rs.getString("base_form"),
                        "cefrLevel", rs.getString("cefr_level"),
                        "dtype", rs.getString("dtype")
                )
        );
        out.put("items", items);
        return out;
    }

    @Transactional
    public Map<String, Object> updateWord(long wordId, Map<String, Object> body) {
        // Validate word exists
        Integer exists = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM words WHERE id = ?", Integer.class, wordId);
        if (exists == null || exists == 0) {
            throw new IllegalArgumentException("Word not found: " + wordId);
        }

        // Update words table
        String baseForm  = str(body.get("baseForm"));
        String cefrLevel = str(body.get("cefrLevel"));
        String dtype     = str(body.get("dtype"));
        String phonetic  = str(body.get("phonetic"));
        String usageNote = str(body.get("usageNote"));

        if (!baseForm.isBlank()) {
            jdbcTemplate.update("UPDATE words SET base_form = ?, updated_at = NOW() WHERE id = ?", baseForm, wordId);
        }
        if (!cefrLevel.isBlank()) {
            jdbcTemplate.update("UPDATE words SET cefr_level = ?, updated_at = NOW() WHERE id = ?", cefrLevel, wordId);
        }
        if (!dtype.isBlank()) {
            jdbcTemplate.update("UPDATE words SET dtype = ?, updated_at = NOW() WHERE id = ?", dtype, wordId);
        }
        // phonetic và usageNote có thể set về rỗng (xóa)
        if (body.containsKey("phonetic")) {
            jdbcTemplate.update("UPDATE words SET phonetic = NULLIF(?, ''), updated_at = NOW() WHERE id = ?", phonetic, wordId);
        }
        if (body.containsKey("usageNote")) {
            jdbcTemplate.update("UPDATE words SET usage_note = NULLIF(?, ''), updated_at = NOW() WHERE id = ?", usageNote, wordId);
        }

        // Update translations
        upsertTranslation(wordId, "vi", str(body.get("meaningVi")), str(body.get("exampleVi")));
        upsertTranslation(wordId, "en", str(body.get("meaningEn")), str(body.get("exampleEn")));
        upsertTranslation(wordId, "de", null, str(body.get("exampleDe")));

        // Update nouns (gender, plural)
        String gender = str(body.get("gender"));
        String plural  = str(body.get("pluralForm"));
        if ("Noun".equals(dtype.isBlank() ? jdbcTemplate.queryForObject("SELECT dtype FROM words WHERE id=?", String.class, wordId) : dtype)) {
            if (!gender.isBlank()) {
                jdbcTemplate.update("""
                    INSERT INTO nouns (id, gender, plural_form, noun_type)
                    VALUES (?, ?, NULLIF(?, ''), 'STARK')
                    ON DUPLICATE KEY UPDATE
                      gender = VALUES(gender),
                      plural_form = CASE WHEN ? != '' THEN ? ELSE plural_form END
                    """, wordId, gender, plural, plural, plural);
            }
        }

        return Map.of("wordId", wordId, "status", "OK");
    }

    private void upsertTranslation(long wordId, String locale, String meaning, String example) {
        if ((meaning == null || meaning.isBlank()) && (example == null || example.isBlank())) return;
        jdbcTemplate.update("""
            INSERT INTO word_translations (word_id, locale, meaning, example)
            VALUES (?, ?, COALESCE(NULLIF(?, ''), ''), NULLIF(?, ''))
            ON DUPLICATE KEY UPDATE
              meaning = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE meaning END,
              example = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE example END
            """,
            wordId, locale, meaning, example,
            meaning, meaning, meaning,
            example, example, example
        );
    }

    private static String str(Object v) {
        return v == null ? "" : String.valueOf(v).trim();
    }

    public Map<String, Object> debugTranslations(long wordId) {
        List<Map<String, Object>> rows = jdbcTemplate.query(
                """
                SELECT locale, meaning, example
                FROM word_translations
                WHERE word_id = ?
                ORDER BY locale ASC
                """,
                new Object[]{wordId},
                (rs, rowNum) -> Map.of(
                        "locale", rs.getString("locale"),
                        "meaning", rs.getString("meaning"),
                        "example", rs.getString("example")
                )
        );
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("wordId", wordId);
        out.put("rows", rows);
        return out;
    }

    /**
     * Deletes words whose {@code base_form} looks like concatenated multi-token text (e.g. "ausseinDieSchule..."),
     * typically caused by whitespace-stripping during import.
     */
    @Transactional
    public Map<String, Object> deleteConcatenatedLemmas(Integer limit, boolean dryRun) {
        int cap = (limit == null || limit < 1) ? 500 : Math.min(limit, 10_000);

        // Internal uppercase after lowercase strongly suggests concatenation, and we only target rows with no spaces.
        List<Long> ids = jdbcTemplate.query(
                """
                SELECT id
                FROM words
                WHERE REGEXP_LIKE(base_form, '[[:lower:]][[:upper:]]', 'c')
                  AND base_form NOT LIKE '%% %%'
                  AND CHAR_LENGTH(base_form) >= 20
                ORDER BY id ASC
                LIMIT ?
                """,
                new Object[]{cap},
                (rs, rowNum) -> rs.getLong("id")
        );

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("matched", ids.size());
        out.put("limit", cap);
        out.put("dryRun", dryRun);

        if (ids.isEmpty()) {
            out.put("deleted", 0);
            return out;
        }

        List<Map<String, Object>> sample = jdbcTemplate.query(
                """
                SELECT id, base_form, cefr_level, dtype
                FROM words
                WHERE id IN (%s)
                ORDER BY id ASC
                LIMIT 20
                """.formatted(ids.stream().map(x -> "?").reduce((a, b) -> a + "," + b).orElse("?")),
                ids.toArray(),
                (rs, rowNum) -> Map.of(
                        "id", rs.getLong("id"),
                        "baseForm", rs.getString("base_form"),
                        "cefrLevel", rs.getString("cefr_level"),
                        "dtype", rs.getString("dtype")
                )
        );
        out.put("sample", sample);

        if (dryRun) {
            out.put("deleted", 0);
            return out;
        }

        // Delete children first (no FK cascade assumed).
        String in = ids.stream().map(x -> "?").reduce((a, b) -> a + "," + b).orElse("?");
        Object[] args = ids.toArray();
        jdbcTemplate.update("DELETE FROM noun_declension_forms WHERE noun_id IN (" + in + ")", args);
        jdbcTemplate.update("DELETE FROM verb_conjugations WHERE verb_id IN (" + in + ")", args);
        jdbcTemplate.update("DELETE FROM nouns WHERE id IN (" + in + ")", args);
        jdbcTemplate.update("DELETE FROM verbs WHERE id IN (" + in + ")", args);
        jdbcTemplate.update("DELETE FROM adjectives WHERE id IN (" + in + ")", args);
        jdbcTemplate.update("DELETE FROM word_tags WHERE word_id IN (" + in + ")", args);
        jdbcTemplate.update("DELETE FROM word_translations WHERE word_id IN (" + in + ")", args);
        int deleted = jdbcTemplate.update("DELETE FROM words WHERE id IN (" + in + ")", args);

        out.put("deleted", deleted);
        return out;
    }
}

