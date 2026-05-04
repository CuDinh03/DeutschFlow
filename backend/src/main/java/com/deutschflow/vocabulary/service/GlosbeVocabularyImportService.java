package com.deutschflow.vocabulary.service;

import com.deutschflow.vocabulary.dto.GlosbeLexicalEntry;
import com.deutschflow.vocabulary.dto.WordNounDeclensionItem;
import com.deutschflow.vocabulary.dto.WordVerbConjugationItem;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class GlosbeVocabularyImportService {

    private static final String SOURCE_NAME = "GLOSBE_DE_VI";
    private static final String SOURCE_TAG = "GLOSBE_AUTO";
    private static final int DEFAULT_MAX_PAGES = 200;
    private static final int DEFAULT_MAX_WORDS = 0; // 0 => unlimited
    private static final int DEFAULT_TIMEOUT_SECONDS = 20;

    private final JdbcTemplate jdbcTemplate;
    private final GlosbeHtmlParser parser;
    private final ObjectMapper objectMapper;

    @Value("${app.vocabulary.glosbe.base-url:https://vi.glosbe.com/de/vi}")
    private String startUrl;

    @Value("${app.vocabulary.glosbe.max-pages-per-run:50}")
    private int maxPagesPerRun;

    @Value("${app.vocabulary.glosbe.max-words-per-run:500}")
    private int maxWordsPerRun;

    @Value("${app.vocabulary.glosbe.request-delay-ms:400}")
    private long requestDelayMs;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(DEFAULT_TIMEOUT_SECONDS))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    @Transactional
    public Map<String, Object> importIncremental() {
        return importFromGlosbe(Math.max(1, maxPagesPerRun), Math.max(0, maxWordsPerRun));
    }

    @Transactional
    public Map<String, Object> importFromGlosbe(Integer maxPagesInput, Integer maxWordsInput) {
        int pageBudget = maxPagesInput == null || maxPagesInput <= 0 ? DEFAULT_MAX_PAGES : maxPagesInput;
        int maxWords = maxWordsInput == null || maxWordsInput < 0 ? DEFAULT_MAX_WORDS : maxWordsInput;

        String cursor = getState("cursor_url");
        String currentUrl = (cursor == null || cursor.isBlank()) ? startUrl : cursor;
        Set<String> queuedWordLinks = new LinkedHashSet<>();
        Set<String> visitedPages = new LinkedHashSet<>();
        long sourceTagId = ensureSourceTag();

        int pagesVisited = 0;
        int inserted = 0;
        int updated = 0;
        int unchanged = 0;
        int errors = 0;
        int processed = 0;
        List<Map<String, Object>> sampleMissing = new ArrayList<>();

        while (currentUrl != null && pagesVisited < pageBudget) {
            if (visitedPages.contains(currentUrl)) {
                break;
            }
            visitedPages.add(currentUrl);
            pagesVisited++;

            Document page;
            try {
                page = fetchDocument(currentUrl);
            } catch (Exception ex) {
                errors++;
                saveImportError(currentUrl, null, "PAGE_FETCH_ERROR", ex.getMessage(), Map.of("page", currentUrl));
                break;
            }

            queuedWordLinks.addAll(parser.parseWordLinks(page, "https://vi.glosbe.com"));
            String next = parser.parseNextPageLink(page);
            setState("cursor_url", currentUrl);
            setState("last_seen_next_url", next);

            List<String> batch = queuedWordLinks.stream().limit(80).toList();
            queuedWordLinks.removeAll(batch);

            for (String wordUrl : batch) {
                if (maxWords > 0 && processed >= maxWords) {
                    currentUrl = next;
                    setState("cursor_url", currentUrl == null ? startUrl : currentUrl);
                    return buildResponse(
                            pagesVisited, processed, inserted, updated, unchanged, errors, sampleMissing,
                            currentUrl, maxWords, true
                    );
                }
                if (isProcessedUrl(wordUrl)) {
                    continue;
                }
                processed++;
                try {
                    Document wordDoc = fetchDocument(wordUrl);
                    GlosbeLexicalEntry entry = parser.parseDetail(wordDoc, wordUrl);
                    if (entry == null || entry.baseForm() == null || entry.baseForm().isBlank()) {
                        errors++;
                        markProcessedUrl(wordUrl, "invalid_entry");
                        saveImportError(wordUrl, null, "PARSE_EMPTY", "Cannot parse lexical entry", null);
                        continue;
                    }
                    UpsertOutcome outcome = upsertEntry(entry, sourceTagId);
                    if (outcome.inserted) {
                        inserted++;
                    } else if (outcome.updated) {
                        updated++;
                    } else {
                        unchanged++;
                    }
                    if (!entry.missingFields().isEmpty() && sampleMissing.size() < 30) {
                        sampleMissing.add(Map.of(
                                "word", entry.baseForm(),
                                "missingFields", entry.missingFields(),
                                "sourceUrl", wordUrl
                        ));
                    }
                    markProcessedUrl(wordUrl, "ok");
                } catch (Exception ex) {
                    errors++;
                    saveImportError(wordUrl, null, "WORD_IMPORT_ERROR", ex.getMessage(), Map.of("url", wordUrl));
                    markProcessedUrl(wordUrl, "failed");
                }
                sleepQuietly(requestDelayMs);
            }

            currentUrl = next;
            setState("cursor_url", currentUrl == null ? startUrl : currentUrl);
        }

        if (currentUrl == null) {
            setState("cursor_url", startUrl);
        }
        return buildResponse(
                pagesVisited, processed, inserted, updated, unchanged, errors, sampleMissing,
                currentUrl, maxWords, false
        );
    }

    private UpsertOutcome upsertEntry(GlosbeLexicalEntry entry, long sourceTagId) {
        Long existingId = jdbcTemplate.query(
                "SELECT id FROM words WHERE LOWER(base_form) = LOWER(?) LIMIT 1",
                rs -> rs.next() ? rs.getLong("id") : null,
                entry.baseForm().trim()
        );
        boolean inserted = false;
        boolean updated = false;
        long wordId;
        if (existingId == null) {
            wordId = jdbcTemplate.queryForObject(
                    """
                    INSERT INTO words (dtype, base_form, cefr_level, phonetic, usage_note, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, NOW(), NOW())
                    RETURNING id
                    """,
                    Long.class,
                    normalizeDtype(entry.dtype()),
                    entry.baseForm().trim(),
                    normalizeCefr(entry.cefrLevel()),
                    trimNullable(entry.phonetic()),
                    trimNullable(entry.usageNote())
            );
            inserted = true;
        } else {
            wordId = existingId;
            int changed = jdbcTemplate.update(
                    """
                    UPDATE words
                    SET dtype = ?, cefr_level = ?, phonetic = COALESCE(NULLIF(?, ''), phonetic),
                        usage_note = COALESCE(NULLIF(?, ''), usage_note), updated_at = NOW()
                    WHERE id = ?
                    """,
                    normalizeDtype(entry.dtype()),
                    normalizeCefr(entry.cefrLevel()),
                    trimNullable(entry.phonetic()),
                    trimNullable(entry.usageNote()),
                    wordId
            );
            updated = changed > 0;
        }

        upsertTranslation(wordId, "de", trimNullable(entry.meaningDe()), trimNullable(entry.exampleDe()));
        upsertTranslation(wordId, "vi", trimNullable(entry.meaningVi()), trimNullable(entry.exampleVi()));
        upsertTranslation(wordId, "en", trimNullable(entry.meaningVi()), trimNullable(entry.exampleVi()));

        upsertNounDetails(wordId, entry);
        upsertVerbDetails(wordId, entry);
        attachWordToTag(wordId, sourceTagId);
        setState("last_success_word", entry.baseForm());
        setState("last_success_url", entry.sourceUrl());
        if (!entry.missingFields().isEmpty()) {
            setState("last_missing_fields", String.join(",", entry.missingFields()));
        }
        return new UpsertOutcome(inserted, !inserted && updated);
    }

    private void upsertNounDetails(long wordId, GlosbeLexicalEntry entry) {
        if (!"Noun".equals(normalizeDtype(entry.dtype()))) {
            return;
        }
        if (entry.gender() == null || entry.gender().isBlank()) {
            return;
        }
        Integer exists = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM nouns WHERE id = ?", Integer.class, wordId);
        if (exists != null && exists > 0) {
            jdbcTemplate.update(
                    """
                    UPDATE nouns
                    SET gender = ?, plural_form = COALESCE(NULLIF(?, ''), plural_form),
                        genitive_form = COALESCE(NULLIF(?, ''), genitive_form),
                        noun_type = COALESCE(NULLIF(?, ''), noun_type)
                    WHERE id = ?
                    """,
                    entry.gender(),
                    trimNullable(entry.nounPlural()),
                    trimNullable(entry.nounGenitive()),
                    normalizeNounType(entry.nounType()),
                    wordId
            );
        } else {
            jdbcTemplate.update(
                    """
                    INSERT INTO nouns (id, gender, plural_form, genitive_form, noun_type)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    wordId,
                    entry.gender(),
                    trimNullable(entry.nounPlural()),
                    trimNullable(entry.nounGenitive()),
                    normalizeNounType(entry.nounType())
            );
        }
        for (WordNounDeclensionItem declension : entry.nounDeclensions()) {
            if (declension == null || declension.form() == null || declension.form().isBlank()) continue;
            jdbcTemplate.update(
                    """
                    INSERT INTO noun_declension_forms (noun_id, kasus, numerus, form)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT (noun_id, kasus, numerus) DO UPDATE SET form = EXCLUDED.form
                    """,
                    wordId,
                    normalizeKasus(declension.kasus()),
                    normalizeNumerus(declension.numerus()),
                    declension.form().trim()
            );
        }
    }

    private void upsertVerbDetails(long wordId, GlosbeLexicalEntry entry) {
        if (!"Verb".equals(normalizeDtype(entry.dtype()))) {
            return;
        }
        if ((entry.verbPartizip2() == null || entry.verbPartizip2().isBlank()) && entry.verbConjugations().isEmpty()) {
            return;
        }
        String partizip2 = entry.verbPartizip2() == null || entry.verbPartizip2().isBlank() ? "n/a" : entry.verbPartizip2().trim();
        Integer exists = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM verbs WHERE id = ?", Integer.class, wordId);
        if (exists != null && exists > 0) {
            jdbcTemplate.update(
                    """
                    UPDATE verbs
                    SET auxiliary_verb = ?, partizip2 = ?, is_separable = ?, prefix = ?, is_irregular = ?
                    WHERE id = ?
                    """,
                    normalizeAuxiliary(entry.verbAuxiliary()),
                    partizip2,
                    entry.verbSeparable() != null && entry.verbSeparable(),
                    trimNullable(entry.verbPrefix()),
                    entry.verbIrregular() != null && entry.verbIrregular(),
                    wordId
            );
        } else {
            jdbcTemplate.update(
                    """
                    INSERT INTO verbs (id, auxiliary_verb, partizip2, is_separable, prefix, is_irregular)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    wordId,
                    normalizeAuxiliary(entry.verbAuxiliary()),
                    partizip2,
                    entry.verbSeparable() != null && entry.verbSeparable(),
                    trimNullable(entry.verbPrefix()),
                    entry.verbIrregular() != null && entry.verbIrregular()
            );
        }

        for (WordVerbConjugationItem row : entry.verbConjugations()) {
            if (row == null || row.form() == null || row.form().isBlank()) continue;
            if (row.pronoun() == null || row.pronoun().isBlank()) continue;
            jdbcTemplate.update(
                    """
                    INSERT INTO verb_conjugations (verb_id, tense, pronoun, form)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT (verb_id, tense, pronoun) DO UPDATE SET form = EXCLUDED.form
                    """,
                    wordId,
                    normalizeTense(row.tense()),
                    normalizePronoun(row.pronoun()),
                    row.form().trim()
            );
        }
    }

    private void upsertTranslation(long wordId, String locale, String meaning, String example) {
        if (meaning == null || meaning.isBlank()) {
            return;
        }
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM word_translations WHERE word_id = ? AND locale = ?",
                Integer.class, wordId, locale
        );
        if (count != null && count > 0) {
            jdbcTemplate.update(
                    """
                    UPDATE word_translations
                    SET meaning = COALESCE(NULLIF(?, ''), meaning),
                        example = COALESCE(NULLIF(?, ''), example)
                    WHERE word_id = ? AND locale = ?
                    """,
                    meaning, example, wordId, locale
            );
        } else {
            jdbcTemplate.update(
                    "INSERT INTO word_translations (word_id, locale, meaning, example) VALUES (?, ?, ?, ?)",
                    wordId, locale, meaning, example
            );
        }
    }

    protected Document fetchDocument(String url) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Accept", "text/html,application/xhtml+xml")
                .header("User-Agent", "DeutschFlow/1.0 (Glosbe ingestion)")
                .timeout(Duration.ofSeconds(DEFAULT_TIMEOUT_SECONDS))
                .GET()
                .build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException("Failed to fetch " + url + ", status=" + response.statusCode());
        }
        return Jsoup.parse(response.body(), url);
    }

    private Map<String, Object> buildResponse(
            int pagesVisited,
            int processed,
            int inserted,
            int updated,
            int unchanged,
            int errors,
            List<Map<String, Object>> sampleMissing,
            String nextCursor,
            int maxWords,
            boolean reachedWordLimit
    ) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("source", SOURCE_NAME);
        result.put("startUrl", startUrl);
        result.put("pagesVisited", pagesVisited);
        result.put("processedWords", processed);
        result.put("inserted", inserted);
        result.put("updated", updated);
        result.put("unchanged", unchanged);
        result.put("errors", errors);
        result.put("maxWords", maxWords);
        result.put("reachedWordLimit", reachedWordLimit);
        result.put("nextCursor", nextCursor == null ? startUrl : nextCursor);
        result.put("missingFieldSamples", sampleMissing);
        result.put("status", errors > 0 ? "PARTIAL_SUCCESS" : "OK");
        return result;
    }

    private boolean isProcessedUrl(String url) {
        Integer count = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM vocabulary_import_state
                WHERE source_name = ? AND state_key = ?
                """,
                Integer.class,
                SOURCE_NAME,
                processedKey(url)
        );
        return count != null && count > 0;
    }

    private void markProcessedUrl(String url, String status) {
        setState(processedKey(url), status);
    }

    private String processedKey(String url) {
        return "processed_url::" + Integer.toHexString(url.toLowerCase(Locale.ROOT).hashCode());
    }

    private String getState(String key) {
        return jdbcTemplate.query(
                "SELECT state_value FROM vocabulary_import_state WHERE source_name = ? AND state_key = ? LIMIT 1",
                rs -> rs.next() ? rs.getString("state_value") : null,
                SOURCE_NAME,
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
                SOURCE_NAME,
                key,
                value
        );
    }

    private void saveImportError(String sourceUrl, String baseForm, String errorType, String errorMessage, Map<String, Object> payload) {
        jdbcTemplate.update(
                """
                INSERT INTO vocabulary_import_errors (source_name, source_url, base_form, error_type, error_message, payload_json)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                SOURCE_NAME,
                sourceUrl,
                baseForm,
                errorType,
                errorMessage == null ? null : limit(errorMessage, 500),
                toJson(payload)
        );
    }

    private String toJson(Map<String, Object> payload) {
        if (payload == null || payload.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            return "{\"serializationError\":true}";
        }
    }

    private long ensureSourceTag() {
        jdbcTemplate.update(
                """
                INSERT INTO tags (name, color) VALUES (?, ?)
                ON CONFLICT (name) DO UPDATE SET color = EXCLUDED.color
                """,
                SOURCE_TAG,
                "#14b8a6"
        );
        Long id = jdbcTemplate.query(
                "SELECT id FROM tags WHERE name = ? LIMIT 1",
                rs -> rs.next() ? rs.getLong("id") : null,
                SOURCE_TAG
        );
        if (id == null) {
            throw new IllegalStateException("Cannot resolve tag id for " + SOURCE_TAG);
        }
        return id;
    }

    private void attachWordToTag(long wordId, long tagId) {
        jdbcTemplate.update(
                "INSERT INTO word_tags (word_id, tag_id) VALUES (?, ?) ON CONFLICT (word_id, tag_id) DO NOTHING",
                wordId, tagId
        );
    }

    private String normalizeDtype(String dtype) {
        if (dtype == null) return "Word";
        return switch (dtype) {
            case "Noun", "Verb", "Adjective", "Word" -> dtype;
            default -> "Word";
        };
    }

    private String normalizeCefr(String cefrLevel) {
        if (cefrLevel == null) return "A1";
        String normalized = cefrLevel.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "A1", "A2", "B1", "B2", "C1", "C2" -> normalized;
            default -> "A1";
        };
    }

    private String normalizeNounType(String nounType) {
        if (nounType == null || nounType.isBlank()) return "STARK";
        String normalized = nounType.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "STARK", "SCHWACH", "GEMISCHT" -> normalized;
            default -> "STARK";
        };
    }

    private String normalizeKasus(String kasus) {
        if (kasus == null || kasus.isBlank()) return "NOMINATIV";
        String normalized = kasus.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "NOMINATIV", "AKKUSATIV", "DATIV", "GENITIV" -> normalized;
            default -> "NOMINATIV";
        };
    }

    private String normalizeNumerus(String numerus) {
        if (numerus == null || numerus.isBlank()) return "SINGULAR";
        String normalized = numerus.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "SINGULAR", "PLURAL" -> normalized;
            default -> "SINGULAR";
        };
    }

    private String normalizeTense(String tense) {
        if (tense == null || tense.isBlank()) return "PRASENS";
        String normalized = tense.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "PRASENS", "PRATERITUM", "PERFEKT", "FUTUR1", "KONJUNKTIV2", "IMPERATIV" -> normalized;
            default -> "PRASENS";
        };
    }

    private String normalizePronoun(String pronoun) {
        if (pronoun == null || pronoun.isBlank()) return "ICH";
        String normalized = pronoun.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "ICH", "DU", "ER_SIE_ES", "WIR", "IHR", "SIE_FORMAL" -> normalized;
            default -> "ICH";
        };
    }

    private String normalizeAuxiliary(String auxiliary) {
        if (auxiliary == null || auxiliary.isBlank()) return "HABEN";
        String normalized = auxiliary.trim().toUpperCase(Locale.ROOT);
        return "SEIN".equals(normalized) ? "SEIN" : "HABEN";
    }

    private String trimNullable(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String limit(String raw, int maxLen) {
        if (raw == null) return null;
        return raw.length() <= maxLen ? raw : raw.substring(0, maxLen);
    }

    private void sleepQuietly(long ms) {
        if (ms <= 0) return;
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private record UpsertOutcome(boolean inserted, boolean updated) {
    }
}
