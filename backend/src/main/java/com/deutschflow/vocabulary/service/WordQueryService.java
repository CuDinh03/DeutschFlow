package com.deutschflow.vocabulary.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.vocabulary.dto.WordCoverageHistoryResponse;
import com.deutschflow.vocabulary.dto.WordCoverageResponse;
import com.deutschflow.vocabulary.dto.WordAdjectiveDetails;
import com.deutschflow.vocabulary.dto.WordListItem;
import com.deutschflow.vocabulary.dto.WordListResponse;
import com.deutschflow.vocabulary.dto.WordNounDeclensionItem;
import com.deutschflow.vocabulary.dto.WordNounDetails;
import com.deutschflow.vocabulary.dto.WordTranslationCoverageHistoryResponse;
import com.deutschflow.vocabulary.dto.WordTranslationCoverageResponse;
import com.deutschflow.vocabulary.dto.WordVerbConjugationItem;
import com.deutschflow.vocabulary.dto.WordVerbDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class WordQueryService {

    private final JdbcTemplate jdbcTemplate;
    private final GenderColorService genderColorService;

    private static final Set<String> ALLOWED_DTYPES = Set.of("Noun", "Verb", "Adjective", "Word");
    private static final Set<String> ALLOWED_GENDERS = Set.of("DER", "DIE", "DAS");
    private static final Set<String> ALLOWED_CEFR = Set.of("A1", "A2", "B1", "B2", "C1", "C2");
    /** Lowercase lemma only between slashes — not real IPA (from old backfill). */
    private static final Pattern PSEUDO_IPA_LEMMA = Pattern.compile("^/[a-zA-ZäöüÄÖÜß\\s\\-]+/$");

    public WordListResponse listWords(String cefr,
                                     String q,
                                     String tag,
                                     String dtype,
                                     String gender,
                                     String locale,
                                     int page,
                                     int size) {
        String normalizedLocale = (locale == null || locale.isBlank()) ? "vi" : locale.trim().toLowerCase(Locale.ROOT);
        String normalizedCefr = (cefr == null || cefr.isBlank()) ? null : cefr.trim().toUpperCase(Locale.ROOT);
        String normalizedDtype = (dtype == null || dtype.isBlank()) ? null : dtype.trim();
        String query = (q == null || q.isBlank()) ? null : q.trim();
        String normalizedTag = (tag == null || tag.isBlank()) ? null : tag.trim();
        String normalizedGender = (gender == null || gender.isBlank()) ? null : gender.trim().toUpperCase(Locale.ROOT);

        if (normalizedDtype != null && !ALLOWED_DTYPES.contains(normalizedDtype)) {
            throw new BadRequestException("Invalid dtype");
        }
        if (normalizedCefr != null && !ALLOWED_CEFR.contains(normalizedCefr)) {
            throw new BadRequestException("Invalid cefr");
        }
        if (normalizedGender != null && !ALLOWED_GENDERS.contains(normalizedGender)) {
            throw new BadRequestException("Invalid gender");
        }
        if (page < 0) page = 0;
        if (size < 1) size = 20;
        if (size > 100) size = 100;

        List<Object> filterParams = new ArrayList<>();
        StringBuilder where = new StringBuilder(" WHERE 1=1 ");

        if (normalizedCefr != null) {
            // Cumulative mode: A2 includes A1+A2, B1 includes A1+A2+B1, ...
            where.append("""
                    AND FIELD(w.cefr_level, 'A1','A2','B1','B2','C1','C2') > 0
                    AND FIELD(w.cefr_level, 'A1','A2','B1','B2','C1','C2')
                        <= FIELD(?, 'A1','A2','B1','B2','C1','C2')
                    """);
            filterParams.add(normalizedCefr);
        }

        if (normalizedDtype != null) {
            where.append(" AND w.dtype = ? ");
            filterParams.add(normalizedDtype);
            if ("Noun".equals(normalizedDtype)) {
                where.append(" AND n.gender IN ('DER','DIE','DAS') ");
            }
        }

        if (query != null) {
            where.append(" AND w.base_form LIKE ? ");
            filterParams.add("%" + query + "%");
        }

        if (normalizedTag != null) {
            where.append("""
                     AND EXISTS (
                       SELECT 1
                       FROM word_tags wt_filter
                       JOIN tags tg_filter ON tg_filter.id = wt_filter.tag_id
                       WHERE wt_filter.word_id = w.id AND tg_filter.name = ?
                     )
                    """);
            filterParams.add(normalizedTag);
        }

        if (normalizedGender != null) {
            where.append(" AND n.gender = ? ");
            filterParams.add(normalizedGender);
        }

        long total = jdbcTemplate.queryForObject(
                "SELECT COUNT(DISTINCT w.id) FROM words w LEFT JOIN nouns n ON n.id = w.id" + where,
                filterParams.toArray(),
                Long.class
        );

        int offset = page * size;
        List<Object> queryParams = new ArrayList<>();
        queryParams.add(normalizedLocale);
        queryParams.addAll(filterParams);

        String sql = """
                SELECT
                  w.id,
                  w.dtype,
                  w.base_form,
                  w.cefr_level,
                  w.phonetic,
                  w.usage_note,
                  COALESCE(t_loc.meaning, t_en.meaning, t_de.meaning) AS meaning,
                  t_en.meaning AS meaning_en,
                  COALESCE(t_loc.example, t_en.example) AS example,
                  t_de.example AS example_de,
                  t_en.example AS example_en,
                  n.gender,
                  GROUP_CONCAT(DISTINCT tg_all.name ORDER BY tg_all.name SEPARATOR '|') AS tags
                FROM words w
                LEFT JOIN word_translations t_loc
                  ON t_loc.word_id = w.id AND t_loc.locale = ?
                LEFT JOIN word_translations t_de
                  ON t_de.word_id = w.id AND t_de.locale = 'de'
                LEFT JOIN word_translations t_en
                  ON t_en.word_id = w.id AND t_en.locale = 'en'
                LEFT JOIN nouns n
                  ON n.id = w.id
                LEFT JOIN word_tags wt_all
                  ON wt_all.word_id = w.id
                LEFT JOIN tags tg_all
                  ON tg_all.id = wt_all.tag_id
                """ + where + """
                GROUP BY
                  w.id, w.dtype, w.base_form, w.cefr_level, w.phonetic, w.usage_note,
                  t_loc.meaning, t_en.meaning, t_de.meaning,
                  t_loc.example, t_en.example, t_de.example, n.gender
                ORDER BY
                  FIELD(w.cefr_level, 'A1','A2','B1','B2','C1','C2'),
                  w.base_form
                LIMIT ? OFFSET ?
                """;
        queryParams.add(size);
        queryParams.add(offset);

        List<WordListItem> items = jdbcTemplate.query(sql, queryParams.toArray(), (rs, rowNum) -> {
            long id = rs.getLong("id");
            String rsDtype = rs.getString("dtype");
            String baseForm = rs.getString("base_form");
            String cefrLevel = rs.getString("cefr_level");
            String phonetic = rs.getString("phonetic");
            String usageNote = rs.getString("usage_note");
            String meaning = rs.getString("meaning");
            String meaningEn = rs.getString("meaning_en");
            String example = rs.getString("example");
            String exampleDe = rs.getString("example_de");
            String exampleEn = rs.getString("example_en");
            String nounGender = rs.getString("gender");
            String tagsRaw = rs.getString("tags");

            String article = null;
            String genderColor = null;
            if (nounGender != null) {
                article = switch (nounGender) {
                    case "DER" -> "der";
                    case "DIE" -> "die";
                    case "DAS" -> "das";
                    default -> null;
                };
                genderColor = genderColorService.colorForNounGender(nounGender);
            }

            WordNounDetails nounDetails = loadNounDetails(id);
            WordVerbDetails verbDetails = loadVerbDetails(id);
            WordAdjectiveDetails adjectiveDetails = loadAdjectiveDetails(id);
            String normalizedPhonetic = normalizePhonetic(phonetic, baseForm);
            String normalizedUsageNote = normalizeUsageNote(usageNote, rsDtype, baseForm, article);
            String cleanedMeaning = sanitizeMeaning(meaning, baseForm);
            String cleanedMeaningEn = sanitizeMeaning(meaningEn, baseForm);
            String cleanedExample = sanitizeExampleText(example);
            String cleanedExampleDe = sanitizeExampleText(exampleDe);
            String cleanedExampleEn = sanitizeExampleText(exampleEn);
            if (cleanedExampleEn != null && cleanedExampleDe != null && cleanedExampleEn.trim().equalsIgnoreCase(cleanedExampleDe.trim())) {
                cleanedExampleEn = null;
            }

            return new WordListItem(
                    id,
                    rsDtype,
                    baseForm,
                    cefrLevel,
                    normalizedPhonetic,
                    cleanedMeaning,
                    cleanedMeaningEn,
                    cleanedExample,
                    cleanedExampleDe,
                    cleanedExampleEn,
                    normalizedUsageNote,
                    nounGender,
                    article,
                    genderColor,
                    parseTags(tagsRaw),
                    nounDetails,
                    verbDetails,
                    adjectiveDetails
            );
        });

        return new WordListResponse(items, page, size, total);
    }

    public WordCoverageResponse coverage() {
        WordCoverageResponse snapshot = computeCoverage(LocalDate.now());
        saveCoverageSnapshot(snapshot);
        return snapshot;
    }

    public WordCoverageHistoryResponse coverageHistory(int days) {
        if (days < 1 || days > 3650) {
            throw new BadRequestException("days must be between 1 and 3650");
        }
        // Ensure we always have today's data persisted for dashboard usage.
        coverage();

        LocalDate from = LocalDate.now().minusDays(days - 1L);
        List<WordCoverageResponse> items = jdbcTemplate.query("""
                SELECT
                  snapshot_date,
                  total_words,
                  noun_words,
                  noun_rows,
                  noun_with_gender,
                  noun_der,
                  noun_die,
                  noun_das,
                  noun_coverage_percent,
                  verb_words,
                  verb_rows,
                  verb_coverage_percent
                FROM word_coverage_daily
                WHERE snapshot_date >= ?
                ORDER BY snapshot_date ASC
                """, new Object[]{java.sql.Date.valueOf(from)}, (rs, rowNum) -> new WordCoverageResponse(
                rs.getDate("snapshot_date").toLocalDate(),
                rs.getLong("total_words"),
                rs.getLong("noun_words"),
                rs.getLong("noun_rows"),
                rs.getLong("noun_with_gender"),
                rs.getLong("noun_der"),
                rs.getLong("noun_die"),
                rs.getLong("noun_das"),
                rs.getDouble("noun_coverage_percent"),
                rs.getLong("verb_words"),
                rs.getLong("verb_rows"),
                rs.getDouble("verb_coverage_percent")
        ));
        return new WordCoverageHistoryResponse(days, items);
    }

    public WordTranslationCoverageResponse translationCoverage() {
        WordTranslationCoverageResponse snapshot = computeTranslationCoverage(LocalDate.now());
        saveTranslationCoverageSnapshot(snapshot);
        return snapshot;
    }

    public WordTranslationCoverageHistoryResponse translationCoverageHistory(int days) {
        if (days < 1 || days > 3650) {
            throw new BadRequestException("days must be between 1 and 3650");
        }
        translationCoverage();

        LocalDate from = LocalDate.now().minusDays(days - 1L);
        List<WordTranslationCoverageResponse> items = jdbcTemplate.query("""
                SELECT
                  snapshot_date,
                  total_words,
                  words_with_de,
                  words_with_vi,
                  words_with_en,
                  words_with_all_locales,
                  de_coverage_percent,
                  vi_coverage_percent,
                  en_coverage_percent,
                  all_locales_coverage_percent
                FROM word_translation_coverage_daily
                WHERE snapshot_date >= ?
                ORDER BY snapshot_date ASC
                """, new Object[]{java.sql.Date.valueOf(from)}, (rs, rowNum) -> new WordTranslationCoverageResponse(
                rs.getDate("snapshot_date").toLocalDate(),
                rs.getLong("total_words"),
                rs.getLong("words_with_de"),
                rs.getLong("words_with_vi"),
                rs.getLong("words_with_en"),
                rs.getLong("words_with_all_locales"),
                rs.getDouble("de_coverage_percent"),
                rs.getDouble("vi_coverage_percent"),
                rs.getDouble("en_coverage_percent"),
                rs.getDouble("all_locales_coverage_percent")
        ));
        return new WordTranslationCoverageHistoryResponse(days, items);
    }

    private WordCoverageResponse computeCoverage(LocalDate date) {
        Long totalWords = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM words", Long.class);
        Long nounWords = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM words WHERE dtype = 'Noun'", Long.class);
        Long nounRows = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM nouns", Long.class);
        Long nounWithGender = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM nouns WHERE gender IN ('DER','DIE','DAS')", Long.class);
        Long nounDer = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM nouns WHERE gender = 'DER'", Long.class);
        Long nounDie = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM nouns WHERE gender = 'DIE'", Long.class);
        Long nounDas = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM nouns WHERE gender = 'DAS'", Long.class);

        Long verbWords = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM words WHERE dtype = 'Verb'", Long.class);
        Long verbRows = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM verbs", Long.class);

        long totalWordsV = totalWords == null ? 0L : totalWords;
        long nounWordsV = nounWords == null ? 0L : nounWords;
        long nounRowsV = nounRows == null ? 0L : nounRows;
        long nounWithGenderV = nounWithGender == null ? 0L : nounWithGender;
        long nounDerV = nounDer == null ? 0L : nounDer;
        long nounDieV = nounDie == null ? 0L : nounDie;
        long nounDasV = nounDas == null ? 0L : nounDas;
        long verbWordsV = verbWords == null ? 0L : verbWords;
        long verbRowsV = verbRows == null ? 0L : verbRows;

        double nounCoveragePercent = nounWordsV == 0L ? 0.0 : round2((nounWithGenderV * 100.0) / nounWordsV);
        double verbCoveragePercent = verbWordsV == 0L ? 0.0 : round2((verbRowsV * 100.0) / verbWordsV);

        return new WordCoverageResponse(
                date,
                totalWordsV,
                nounWordsV,
                nounRowsV,
                nounWithGenderV,
                nounDerV,
                nounDieV,
                nounDasV,
                nounCoveragePercent,
                verbWordsV,
                verbRowsV,
                verbCoveragePercent
        );
    }

    private WordTranslationCoverageResponse computeTranslationCoverage(LocalDate date) {
        Long totalWords = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM words", Long.class);
        Long wordsWithDe = jdbcTemplate.queryForObject("""
                SELECT COUNT(DISTINCT w.id)
                FROM words w
                JOIN word_translations wt ON wt.word_id = w.id
                WHERE wt.locale = 'de' AND wt.meaning IS NOT NULL AND TRIM(wt.meaning) <> ''
                """, Long.class);
        Long wordsWithVi = jdbcTemplate.queryForObject("""
                SELECT COUNT(DISTINCT w.id)
                FROM words w
                JOIN word_translations wt ON wt.word_id = w.id
                WHERE wt.locale = 'vi' AND wt.meaning IS NOT NULL AND TRIM(wt.meaning) <> ''
                """, Long.class);
        Long wordsWithEn = jdbcTemplate.queryForObject("""
                SELECT COUNT(DISTINCT w.id)
                FROM words w
                JOIN word_translations wt ON wt.word_id = w.id
                WHERE wt.locale = 'en' AND wt.meaning IS NOT NULL AND TRIM(wt.meaning) <> ''
                """, Long.class);
        Long wordsWithAllLocales = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM (
                  SELECT w.id
                  FROM words w
                  JOIN word_translations wt ON wt.word_id = w.id
                  WHERE wt.locale IN ('de', 'vi', 'en')
                    AND wt.meaning IS NOT NULL
                    AND TRIM(wt.meaning) <> ''
                  GROUP BY w.id
                  HAVING COUNT(DISTINCT wt.locale) = 3
                ) x
                """, Long.class);

        long totalWordsV = totalWords == null ? 0L : totalWords;
        long wordsWithDeV = wordsWithDe == null ? 0L : wordsWithDe;
        long wordsWithViV = wordsWithVi == null ? 0L : wordsWithVi;
        long wordsWithEnV = wordsWithEn == null ? 0L : wordsWithEn;
        long wordsWithAllLocalesV = wordsWithAllLocales == null ? 0L : wordsWithAllLocales;

        double deCoveragePercent = totalWordsV == 0L ? 0.0 : round2((wordsWithDeV * 100.0) / totalWordsV);
        double viCoveragePercent = totalWordsV == 0L ? 0.0 : round2((wordsWithViV * 100.0) / totalWordsV);
        double enCoveragePercent = totalWordsV == 0L ? 0.0 : round2((wordsWithEnV * 100.0) / totalWordsV);
        double allLocalesCoveragePercent = totalWordsV == 0L ? 0.0 : round2((wordsWithAllLocalesV * 100.0) / totalWordsV);

        return new WordTranslationCoverageResponse(
                date,
                totalWordsV,
                wordsWithDeV,
                wordsWithViV,
                wordsWithEnV,
                wordsWithAllLocalesV,
                deCoveragePercent,
                viCoveragePercent,
                enCoveragePercent,
                allLocalesCoveragePercent
        );
    }

    private void saveCoverageSnapshot(WordCoverageResponse snapshot) {
        jdbcTemplate.update("""
                INSERT INTO word_coverage_daily (
                  snapshot_date,
                  total_words,
                  noun_words,
                  noun_rows,
                  noun_with_gender,
                  noun_der,
                  noun_die,
                  noun_das,
                  noun_coverage_percent,
                  verb_words,
                  verb_rows,
                  verb_coverage_percent
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                  total_words = VALUES(total_words),
                  noun_words = VALUES(noun_words),
                  noun_rows = VALUES(noun_rows),
                  noun_with_gender = VALUES(noun_with_gender),
                  noun_der = VALUES(noun_der),
                  noun_die = VALUES(noun_die),
                  noun_das = VALUES(noun_das),
                  noun_coverage_percent = VALUES(noun_coverage_percent),
                  verb_words = VALUES(verb_words),
                  verb_rows = VALUES(verb_rows),
                  verb_coverage_percent = VALUES(verb_coverage_percent),
                  updated_at = CURRENT_TIMESTAMP
                """,
                java.sql.Date.valueOf(snapshot.date()),
                snapshot.totalWords(),
                snapshot.nounWords(),
                snapshot.nounRows(),
                snapshot.nounWithGender(),
                snapshot.nounDer(),
                snapshot.nounDie(),
                snapshot.nounDas(),
                snapshot.nounCoveragePercent(),
                snapshot.verbWords(),
                snapshot.verbRows(),
                snapshot.verbCoveragePercent()
        );
    }

    private void saveTranslationCoverageSnapshot(WordTranslationCoverageResponse snapshot) {
        jdbcTemplate.update("""
                INSERT INTO word_translation_coverage_daily (
                  snapshot_date,
                  total_words,
                  words_with_de,
                  words_with_vi,
                  words_with_en,
                  words_with_all_locales,
                  de_coverage_percent,
                  vi_coverage_percent,
                  en_coverage_percent,
                  all_locales_coverage_percent
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                  total_words = VALUES(total_words),
                  words_with_de = VALUES(words_with_de),
                  words_with_vi = VALUES(words_with_vi),
                  words_with_en = VALUES(words_with_en),
                  words_with_all_locales = VALUES(words_with_all_locales),
                  de_coverage_percent = VALUES(de_coverage_percent),
                  vi_coverage_percent = VALUES(vi_coverage_percent),
                  en_coverage_percent = VALUES(en_coverage_percent),
                  all_locales_coverage_percent = VALUES(all_locales_coverage_percent),
                  updated_at = CURRENT_TIMESTAMP
                """,
                java.sql.Date.valueOf(snapshot.date()),
                snapshot.totalWords(),
                snapshot.wordsWithDe(),
                snapshot.wordsWithVi(),
                snapshot.wordsWithEn(),
                snapshot.wordsWithAllLocales(),
                snapshot.deCoveragePercent(),
                snapshot.viCoveragePercent(),
                snapshot.enCoveragePercent(),
                snapshot.allLocalesCoveragePercent()
        );
    }

    private List<String> parseTags(String tagsRaw) {
        if (tagsRaw == null || tagsRaw.isBlank()) {
            return Collections.emptyList();
        }
        return Arrays.stream(tagsRaw.split("\\|"))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .toList();
    }

    private WordNounDetails loadNounDetails(long wordId) {
        List<WordNounDetails> nounRows = jdbcTemplate.query("""
                SELECT plural_form, genitive_form, noun_type
                FROM nouns
                WHERE id = ?
                """, new Object[]{wordId}, (rs, rowNum) -> new WordNounDetails(
                rs.getString("plural_form"),
                rs.getString("genitive_form"),
                rs.getString("noun_type"),
                Collections.emptyList()
        ));
        if (nounRows.isEmpty()) {
            return null;
        }

        List<WordNounDeclensionItem> declensions = jdbcTemplate.query("""
                SELECT kasus, numerus, form
                FROM noun_declension_forms
                WHERE noun_id = ?
                ORDER BY FIELD(kasus, 'NOMINATIV','AKKUSATIV','DATIV','GENITIV'),
                         FIELD(numerus, 'SINGULAR','PLURAL')
                """, new Object[]{wordId}, (rs, rowNum) -> new WordNounDeclensionItem(
                rs.getString("kasus"),
                rs.getString("numerus"),
                rs.getString("form")
        ));

        WordNounDetails head = nounRows.get(0);
        return new WordNounDetails(head.pluralForm(), head.genitiveForm(), head.nounType(), declensions);
    }

    private WordVerbDetails loadVerbDetails(long wordId) {
        List<WordVerbDetails> verbRows = jdbcTemplate.query("""
                SELECT auxiliary_verb, partizip2, is_separable, prefix, is_irregular
                FROM verbs
                WHERE id = ?
                """, new Object[]{wordId}, (rs, rowNum) -> new WordVerbDetails(
                rs.getString("auxiliary_verb"),
                rs.getString("partizip2"),
                rs.getBoolean("is_separable"),
                rs.getString("prefix"),
                rs.getBoolean("is_irregular"),
                Collections.emptyList()
        ));
        if (verbRows.isEmpty()) {
            return null;
        }

        List<WordVerbConjugationItem> conjugations = jdbcTemplate.query("""
                SELECT tense, pronoun, form
                FROM verb_conjugations
                WHERE verb_id = ?
                ORDER BY FIELD(tense, 'PRASENS','PRATERITUM','PERFEKT','FUTUR1','KONJUNKTIV2','IMPERATIV'),
                         FIELD(pronoun, 'ICH','DU','ER_SIE_ES','WIR','IHR','SIE_FORMAL')
                """, new Object[]{wordId}, (rs, rowNum) -> new WordVerbConjugationItem(
                rs.getString("tense"),
                rs.getString("pronoun"),
                rs.getString("form")
        ));

        WordVerbDetails head = verbRows.get(0);
        return new WordVerbDetails(
                head.auxiliaryVerb(),
                head.partizip2(),
                head.isSeparable(),
                head.prefix(),
                head.isIrregular(),
                conjugations
        );
    }

    private WordAdjectiveDetails loadAdjectiveDetails(long wordId) {
        List<WordAdjectiveDetails> rows = jdbcTemplate.query("""
                SELECT comparative, superlative, is_irregular
                FROM adjectives
                WHERE id = ?
                """, new Object[]{wordId}, (rs, rowNum) -> new WordAdjectiveDetails(
                rs.getString("comparative"),
                rs.getString("superlative"),
                rs.getBoolean("is_irregular")
        ));
        return rows.isEmpty() ? null : rows.get(0);
    }

    private String normalizePhonetic(String phonetic, String baseForm) {
        if (phonetic == null || phonetic.isBlank()) {
            return null;
        }
        String t = phonetic.trim();
        if (isPseudoIpa(t, baseForm)) {
            return null;
        }
        return t;
    }

    private boolean isPseudoIpa(String phonetic, String baseForm) {
        if (phonetic == null || baseForm == null) {
            return true;
        }
        if (PSEUDO_IPA_LEMMA.matcher(phonetic).matches()) {
            return true;
        }
        if (phonetic.startsWith("/") && phonetic.endsWith("/") && phonetic.length() >= 3) {
            String inner = phonetic.substring(1, phonetic.length() - 1).trim().toLowerCase(Locale.ROOT);
            return inner.equals(baseForm.trim().toLowerCase(Locale.ROOT));
        }
        return false;
    }

    private String sanitizeMeaning(String meaning, String baseForm) {
        if (meaning == null || meaning.isBlank()) {
            return null;
        }
        String m = meaning.trim();
        if (baseForm != null && m.equalsIgnoreCase(baseForm.trim())) {
            return null;
        }
        if (isPlaceholderMeaningOrExample(m)) {
            return null;
        }
        return m;
    }

    private String sanitizeExampleText(String example) {
        if (example == null || example.isBlank()) {
            return null;
        }
        String e = example.trim();
        if (isPlaceholderMeaningOrExample(e)) {
            return null;
        }
        return e;
    }

    private boolean isPlaceholderMeaningOrExample(String text) {
        if (text == null) {
            return true;
        }
        String x = text.toLowerCase(Locale.ROOT);
        return x.contains("goethe-derived vocabulary")
                || x.contains("tu vung goethe")
                || x.contains("not in wordlists/local_lexicon.tsv")
                || x.contains("chưa có trong wordlists/local_lexicon.tsv")
                || x.startsWith("beispiel: das wort")
                || x.equals("goethe-derived vocabulary");
    }

    private String normalizeUsageNote(String usageNote, String dtype, String baseForm, String article) {
        if (usageNote != null && !usageNote.isBlank()) {
            String u = usageNote.trim();
            if (looksLikeLegacyAsciiUsage(u)) {
                return defaultUsageNote(dtype, baseForm, article);
            }
            return u;
        }
        return defaultUsageNote(dtype, baseForm, article);
    }

    private boolean looksLikeLegacyAsciiUsage(String usageNote) {
        return usageNote.startsWith("Danh tu tieng")
                || usageNote.startsWith("Dong tu tieng")
                || usageNote.startsWith("Tinh tu tieng")
                || usageNote.startsWith("Hoc tu nay theo cum tu");
    }

    private String defaultUsageNote(String dtype, String baseForm, String article) {
        if ("Noun".equals(dtype)) {
            String articleText = article == null ? "mạo từ phù hợp" : article;
            return "Danh từ tiếng Đức. Luôn học kèm mạo từ (" + articleText + "), số nhiều và ngữ cảnh câu.";
        }
        if ("Verb".equals(dtype)) {
            return "Động từ tiếng Đức. Dùng theo ngôi (ich/du/er-sie-es/wir/ihr/sie) và chú ý trợ động từ khi chia Perfekt.";
        }
        if ("Adjective".equals(dtype)) {
            return "Tính từ tiếng Đức. Biến đổi đuôi theo mạo từ, giống, cách (Kasus) và số.";
        }
        String term = (baseForm == null || baseForm.isBlank()) ? "từ" : baseForm;
        return "Từ vựng " + term + " dùng theo ngữ cảnh giao tiếp; ưu tiên học cùng cụm từ và câu ví dụ.";
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}

