package com.deutschflow.vocabulary.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class GoetheVocabularyAutoImportService {
    private static final String GOETHE_B1_SORTED_URL =
            "https://raw.githubusercontent.com/kennethsible/goethe-wortliste/main/sorted.txt";
    private static final String DE_FREQ_50K_URL =
            "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/de/de_50k.txt";
    private static final String GOETHE_AUTO_TAG = "GOETHE_AUTO";

    // Cumulative targets requested by user
    private static final int TARGET_A1_TOTAL = 500;
    private static final int TARGET_A2_TOTAL = 1000;
    private static final int TARGET_B1_TOTAL = 2000;
    private static final int TARGET_B2_TOTAL = 4000;
    private static final int TARGET_C1_TOTAL = 8000;

    private final JdbcTemplate jdbcTemplate;
    private final WiktionaryScraperService wiktionaryScraperService;
    private final DeepLTranslationService deepLTranslationService;
    private final LocalLexiconService localLexiconService;

    /**
     * {@code classpath} — đọc {@code wordlists/goethe_sorted.txt} và {@code wordlists/de_50k.txt} trong JAR;
     * {@code remote} — tải từ GitHub (HTTP).
     */
    @Value("${app.vocabulary.goethe.wordlist-source:classpath}")
    private String wordlistSource;

    /**
     * {@code local_only} — chỉ dùng {@code local_lexicon.tsv}, không DeepL/Wiktionary;
     * {@code online} — DeepL + tuỳ chọn Wiktionary theo cờ bên dưới.
     */
    @Value("${app.vocabulary.goethe.enrich-source:local_only}")
    private String enrichSource;

    @Value("${app.vocabulary.goethe.enrich-with-deepl:true}")
    private boolean enrichWithDeepl;

    @Value("${app.vocabulary.goethe.enrich-with-wiktionary:false}")
    private boolean enrichWithWiktionary;

    @Transactional
    public Map<String, Object> importGoetheVocabularyA1ToC1() {
        List<String> goetheCore = parseGoetheB1(loadGoetheListRaw());
        List<String> frequency = parseFrequency(loadFreqListRaw());

        LinkedHashMap<String, String> unique = new LinkedHashMap<>();
        for (String w : goetheCore) {
            putUniqueIgnoreCase(unique, w);
        }
        for (String w : frequency) {
            putUniqueIgnoreCase(unique, w);
        }
        List<String> ordered = new ArrayList<>(unique.values());

        if (ordered.size() < TARGET_B2_TOTAL) {
            throw new IllegalStateException(
                    "Vocabulary source too small. Need at least " + TARGET_B2_TOTAL + " words, got " + ordered.size()
            );
        }

        long tagId = ensureGoetheAutoTag();
        clearManagedTagMappings(tagId);

        int inserted = 0;
        int updated = 0;
        int unchanged = 0;
        int duplicatesSkipped = 0;
        int managedUniqueCount = 0;
        Map<String, Integer> levelInserted = new LinkedHashMap<>(Map.of(
                "A1", 0, "A2", 0, "B1", 0, "B2", 0, "C1", 0
        ));
        Map<String, Integer> levelUpdated = new LinkedHashMap<>(Map.of(
                "A1", 0, "A2", 0, "B1", 0, "B2", 0, "C1", 0
        ));
        Map<String, Integer> levelUnchanged = new LinkedHashMap<>(Map.of(
                "A1", 0, "A2", 0, "B1", 0, "B2", 0, "C1", 0
        ));

        for (String word : ordered) {
            if (managedUniqueCount >= TARGET_C1_TOTAL) break;
            String level = levelForIndex(managedUniqueCount);

            UpsertResult rs = upsertWord(word, level, tagId);
            boolean newlyTagged = attachWordToTag(rs.wordId(), tagId);
            if (!newlyTagged) {
                duplicatesSkipped++;
                continue;
            }
            managedUniqueCount++;
            if (rs.inserted()) {
                inserted++;
                levelInserted.put(level, levelInserted.get(level) + 1);
            } else if (rs.updated()) {
                updated++;
                levelUpdated.put(level, levelUpdated.get(level) + 1);
            } else {
                unchanged++;
                levelUnchanged.put(level, levelUnchanged.get(level) + 1);
            }
        }

        Map<String, Integer> managedPerLevel = managedCountsByLevel(tagId);
        Map<String, Integer> managedCumulative = cumulativeCounts(managedPerLevel);
        validateMinimums(managedCumulative);

        Map<String, Object> globalPerLevel = jdbcTemplate.query(
                """
                SELECT cefr_level, COUNT(*) AS total
                FROM words
                WHERE cefr_level IN ('A1','A2','B1','B2','C1')
                GROUP BY cefr_level
                """,
                rs -> {
                    Map<String, Object> out = new LinkedHashMap<>();
                    while (rs.next()) {
                        out.put(rs.getString("cefr_level"), rs.getLong("total"));
                    }
                    return out;
                }
        );

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("source", "Goethe B1 core + German frequency extension");
        response.put("goetheCoreWords", goetheCore.size());
        response.put("collectedWords", ordered.size());
        response.put("importTarget", TARGET_C1_TOTAL);
        response.put("managedUniqueImported", managedUniqueCount);
        response.put("duplicatesSkipped", duplicatesSkipped);
        response.put("inserted", inserted);
        response.put("updated", updated);
        response.put("unchanged", unchanged);
        response.put("insertedByLevel", levelInserted);
        response.put("updatedByLevel", levelUpdated);
        response.put("unchangedByLevel", levelUnchanged);
        response.put("managedLevelCounts", managedPerLevel);
        response.put("managedCumulativeCounts", managedCumulative);
        response.put("globalDbCountsByLevel", globalPerLevel);
        response.put("targets", Map.of(
                "A1", TARGET_A1_TOTAL,
                "A2", TARGET_A2_TOTAL,
                "B1", TARGET_B1_TOTAL,
                "B2", TARGET_B2_TOTAL,
                "C1", TARGET_C1_TOTAL
        ));
        response.put("note", "Cumulative targets are guaranteed for GOETHE_AUTO managed vocabulary.");
        return response;
    }

    protected UpsertResult upsertWord(String baseForm, String level, long tagId) {
        Long existingId = jdbcTemplate.query(
                "SELECT id FROM words WHERE LOWER(base_form) = LOWER(?) LIMIT 1",
                rs -> rs.next() ? rs.getLong("id") : null,
                baseForm
        );

        if (existingId == null) {
            String dtype = inferDtype(baseForm);
            jdbcTemplate.update(
                    """
                    INSERT INTO words (dtype, base_form, cefr_level, created_at, updated_at)
                    VALUES (?, ?, ?, NOW(), NOW())
                    """,
                    dtype, baseForm, level
            );
            Long newId = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
            enrichGoetheWord(newId, baseForm);
            return new UpsertResult(newId, true, false);
        }

        String currentLevel = jdbcTemplate.queryForObject(
                "SELECT cefr_level FROM words WHERE id = ?",
                String.class,
                existingId
        );
        if (isManagedWord(existingId, tagId)) {
            enrichGoetheWord(existingId, baseForm);
            return new UpsertResult(existingId, false, false);
        }
        if (!level.equalsIgnoreCase(String.valueOf(currentLevel))) {
            jdbcTemplate.update("UPDATE words SET cefr_level = ?, updated_at = NOW() WHERE id = ?", level, existingId);
            enrichGoetheWord(existingId, baseForm);
            return new UpsertResult(existingId, false, true);
        }

        enrichGoetheWord(existingId, baseForm);
        return new UpsertResult(existingId, false, false);
    }

    private String loadGoetheListRaw() {
        if ("remote".equalsIgnoreCase(wordlistSource)) {
            return fetchText(GOETHE_B1_SORTED_URL);
        }
        return ClasspathWordlistReader.readUtf8("wordlists/goethe_sorted.txt");
    }

    private String loadFreqListRaw() {
        if ("remote".equalsIgnoreCase(wordlistSource)) {
            return fetchText(DE_FREQ_50K_URL);
        }
        return ClasspathWordlistReader.readUtf8("wordlists/de_50k.txt");
    }

    /**
     * DeepL (lemma DE→VI/EN) + optional Wiktionary (IPA, example, EN gloss), hoặc chỉ {@link LocalLexiconService}.
     * Persist UTF-8 Vietnamese usage notes and real example sentences for UI/hover.
     */
    private void enrichGoetheWord(long wordId, String baseForm) {
        if ("local_only".equalsIgnoreCase(enrichSource)) {
            enrichFromLocalLexicon(wordId, baseForm);
            return;
        }

        Optional<WiktionaryScraperService.WordData> wikt = Optional.empty();
        if (enrichWithWiktionary) {
            try {
                wikt = wiktionaryScraperService.scrapeWord(baseForm);
            } catch (Exception e) {
                log.warn("Wiktionary enrichment failed for {}: {}", baseForm, e.getMessage());
            }
        }

        String dtype = jdbcTemplate.queryForObject("SELECT dtype FROM words WHERE id = ?", String.class, wordId);

        String ipa = wikt.map(WiktionaryScraperService.WordData::getIpa).map(String::trim).filter(s -> !s.isEmpty()).orElse(null);
        ipa = formatIpa(ipa);

        String wGender = wikt.map(WiktionaryScraperService.WordData::getGender).orElse(null);
        if ("Noun".equals(dtype) && wGender != null) {
            ensureNounRow(wordId, wGender, wikt.map(WiktionaryScraperService.WordData::getPlural).orElse(null));
        }

        String usageNote = buildUsageNoteUtf8(dtype, wGender, baseForm);
        if (ipa != null) {
            jdbcTemplate.update(
                    "UPDATE words SET phonetic = ?, usage_note = ?, updated_at = NOW() WHERE id = ?",
                    ipa, usageNote, wordId
            );
        } else {
            jdbcTemplate.update(
                    "UPDATE words SET usage_note = ?, updated_at = NOW() WHERE id = ?",
                    usageNote, wordId
            );
        }

        String viMeaning = null;
        String enMeaning = null;
        if (enrichWithDeepl) {
            viMeaning = deepLTranslationService.translate(baseForm, "VI").orElse(null);
            sleepMs(40);
            enMeaning = deepLTranslationService.translate(baseForm, "EN").orElse(null);
            sleepMs(40);
        }
        if (viMeaning == null || viMeaning.isBlank()) {
            viMeaning = null;
        }
        if (enMeaning == null || enMeaning.isBlank()) {
            enMeaning = wikt.map(WiktionaryScraperService.WordData::getMeaning).filter(s -> !s.isBlank()).orElse(null);
        }

        String exampleDe = wikt.map(WiktionaryScraperService.WordData::getExampleDe)
                .filter(s -> !s.isBlank() && s.length() <= 500)
                .orElse(null);

        String exampleVi = null;
        if (exampleDe != null && enrichWithDeepl) {
            exampleVi = deepLTranslationService.translate(exampleDe, "VI").orElse(null);
            sleepMs(40);
        }
        if (exampleVi == null || exampleVi.isBlank()) {
            exampleVi = null;
        }

        String exampleEn = wikt.map(WiktionaryScraperService.WordData::getExampleEn).filter(s -> !s.isBlank()).orElse(null);
        if (exampleEn == null && exampleDe != null && enrichWithDeepl) {
            exampleEn = deepLTranslationService.translate(exampleDe, "EN").orElse(null);
            sleepMs(40);
        }
        if (exampleEn == null || exampleEn.isBlank()) {
            exampleEn = null;
        }

        String deMeaning = wikt.map(WiktionaryScraperService.WordData::getMeaning).filter(s -> !s.isBlank()).orElse(enMeaning);
        upsertTranslation(wordId, "vi", viMeaning, exampleVi);
        upsertTranslation(wordId, "en", enMeaning, exampleEn);
        upsertTranslation(wordId, "de", deMeaning, exampleDe);
    }

    private void enrichFromLocalLexicon(long wordId, String baseForm) {
        String dtype = jdbcTemplate.queryForObject("SELECT dtype FROM words WHERE id = ?", String.class, wordId);
        Optional<LocalLexiconService.LocalEntry> lex = localLexiconService.lookup(baseForm);

        String ipa = lex.map(LocalLexiconService.LocalEntry::ipa)
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(IpaNormalization::toBracketForm)
                .orElse(null);

        String usageNote = buildUsageNoteUtf8(dtype, null, baseForm);
        if (ipa != null) {
            jdbcTemplate.update(
                    "UPDATE words SET phonetic = ?, usage_note = ?, updated_at = NOW() WHERE id = ?",
                    ipa, usageNote, wordId
            );
        } else {
            jdbcTemplate.update(
                    "UPDATE words SET usage_note = ?, updated_at = NOW() WHERE id = ?",
                    usageNote, wordId
            );
        }

        if (lex.isEmpty()) {
            return;
        }

        String viMeaning = lex.map(LocalLexiconService.LocalEntry::vi).filter(s -> !s.isBlank()).orElse(null);
        String enMeaning = lex.map(LocalLexiconService.LocalEntry::en).filter(s -> !s.isBlank()).orElse(null);
        String exampleDe = lex.map(LocalLexiconService.LocalEntry::exampleDe).filter(s -> !s.isBlank() && s.length() <= 500).orElse(null);

        upsertTranslation(wordId, "vi", viMeaning, null);
        upsertTranslation(wordId, "en", enMeaning, null);
        upsertTranslation(wordId, "de", null, exampleDe);
    }

    private void ensureNounRow(long wordId, String gender, String plural) {
        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM nouns WHERE id = ?", Integer.class, wordId);
        if (count != null && count > 0) {
            jdbcTemplate.update(
                    "UPDATE nouns SET gender = ?, plural_form = COALESCE(?, plural_form) WHERE id = ?",
                    gender, plural, wordId
            );
        } else {
            jdbcTemplate.update(
                    """
                    INSERT INTO nouns (id, gender, plural_form, genitive_form, noun_type)
                    VALUES (?, ?, ?, NULL, 'STARK')
                    """,
                    wordId, gender, plural
            );
        }
    }

    private String formatIpa(String ipa) {
        return IpaNormalization.toBracketForm(ipa);
    }

    /** Gọi sau khi upsert từ (import CEFR curated hoặc Goethe). */
    public void enrichLemma(long wordId, String baseForm) {
        enrichGoetheWord(wordId, baseForm);
    }

    private String buildUsageNoteUtf8(String dtype, String wGender, String baseForm) {
        String article = null;
        if (wGender != null) {
            article = switch (wGender) {
                case "DER" -> "der";
                case "DIE" -> "die";
                case "DAS" -> "das";
                default -> null;
            };
        }
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

    private void sleepMs(long ms) {
        if (ms <= 0) {
            return;
        }
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private void upsertTranslation(Long wordId, String locale, String meaning, String example) {
        jdbcTemplate.update(
                """
                INSERT INTO word_translations (word_id, locale, meaning, example)
                VALUES (?, ?, COALESCE(?, ''), ?)
                ON DUPLICATE KEY UPDATE
                  meaning = CASE
                    WHEN (meaning IS NULL OR TRIM(meaning) = '' OR meaning LIKE 'Not in wordlists/local_lexicon.tsv%%' OR meaning LIKE 'Chưa có trong wordlists/local_lexicon.tsv%%')
                      AND (? IS NOT NULL AND TRIM(?) <> '')
                    THEN ?
                    ELSE meaning
                  END,
                  example = CASE
                    WHEN (example IS NULL OR TRIM(example) = '' OR example LIKE 'Beispiel: Das Wort %%')
                      AND (? IS NOT NULL AND TRIM(?) <> '')
                    THEN ?
                    ELSE example
                  END
                """,
                wordId,
                locale,
                meaning,
                example,
                meaning, meaning, meaning,
                example, example, example
        );
    }

    private static final java.util.Set<String> KNOWN_ADJECTIVES = java.util.Set.of(
        "alt","neu","gut","groß","klein","lang","kurz","jung","warm","kalt",
        "schnell","langsam","laut","leise","billig","teuer","schwer","leicht",
        "dunkel","hell","schön","hübsch","hässlich","sauber","schmutzig",
        "voll","leer","offen","richtig","falsch","einfach","schwierig",
        "möglich","nötig","wichtig","interessant","langweilig","lustig",
        "traurig","froh","glücklich","müde","krank","gesund","stark","schwach",
        "breit","schmal","hoch","tief","nah","weit","früh","spät","fertig",
        "bereit","bekannt","beliebt","typisch","normal","natürlich","direkt",
        "genau","sicher","gefährlich","ruhig","lecker","süß","sauer","bitter",
        "salzig","scharf","weich","hart","nass","trocken","frisch","modern",
        "international","national","lokal","sozial","politisch","technisch",
        "digital","öffentlich","privat","persönlich","offiziell","professionell",
        "praktisch","positiv","negativ","aktiv","passiv","kreativ","intelligent",
        "ehrlich","freundlich","höflich","grob","nett","böse","lieb","streng",
        "riesig","winzig","dick","dünn","flach","rund","gerade","bunt","grau"
    );

    private String inferDtype(String word) {
        if (word == null || word.isBlank()) return "Word";
        String w = word.trim();
        String wl = w.toLowerCase(Locale.ROOT);

        if (!Character.isUpperCase(w.charAt(0))) {
            if (wl.endsWith("ieren") || wl.endsWith("eln") || wl.endsWith("ern")) return "Verb";
            if (wl.endsWith("en") && w.length() > 3) {
                if (!wl.equals("oben") && !wl.equals("unten") && !wl.equals("neben")
                        && !wl.equals("zwischen") && !wl.equals("innen") && !wl.equals("außen")
                        && !wl.equals("hinten") && !wl.equals("vorne") && !wl.equals("daneben")) {
                    return "Verb";
                }
            }
            if (wl.endsWith("ig") || wl.endsWith("lich") || wl.endsWith("isch")
                    || wl.endsWith("los") || wl.endsWith("sam") || wl.endsWith("bar")
                    || wl.endsWith("haft") || wl.endsWith("voll") || wl.endsWith("reich")
                    || wl.endsWith("arm") || wl.endsWith("frei") || wl.endsWith("fähig")) {
                return "Adjective";
            }
            if (KNOWN_ADJECTIVES.contains(wl)) return "Adjective";
        }
        if (Character.isUpperCase(w.charAt(0))) return "Noun";
        return "Word";
    }

    private List<String> parseGoetheB1(String body) {
        List<String> out = new ArrayList<>();
        for (String raw : body.split("\\R")) {
            String line = normalizeRaw(raw);
            if (line.isBlank()) continue;
            String cleaned = line
                    .replaceAll("\\(.*?\\)", "")
                    .replaceAll("[0-9]", "")
                    .trim();
            if (cleaned.isBlank()) continue;
            String token = cleaned.split(",")[0].trim();
            token = token.replaceAll("^(der|die|das|ein|eine)\\s+", "");
            token = token.split("/")[0].trim();
            String[] words = token.split("\\s+");
            if (words.length >= 3) {
                token = "sich".equalsIgnoreCase(words[0]) && words[1].length() >= 2
                        ? (words[0] + " " + words[1])
                        : words[0];
            }
            token = token.replaceAll("[^\\p{L}\\-\\s]", " ").replaceAll("\\s{2,}", " ").trim();
            if (token.isBlank()) continue;
            if (token.endsWith("-")) continue;
            if (token.length() < 2) continue;
            out.add(token);
        }
        return out;
    }

    private List<String> parseFrequency(String body) {
        List<String> out = new ArrayList<>();
        for (String raw : body.split("\\R")) {
            String line = normalizeRaw(raw);
            if (line.isBlank()) continue;
            String[] parts = line.split("\\s+");
            if (parts.length < 1) continue;
            String token = parts[0].trim();
            token = token.replaceAll("[^\\p{L}\\-]", "");
            if (token.length() < 2) continue;
            if (token.endsWith("-")) continue;
            out.add(token);
        }
        return out;
    }

    private String normalizeRaw(String raw) {
        String s = raw == null ? "" : raw.trim();
        s = Normalizer.normalize(s, Normalizer.Form.NFKC);
        return s;
    }

    private void putUniqueIgnoreCase(LinkedHashMap<String, String> unique, String word) {
        if (word == null || word.isBlank()) return;
        String key = word.toLowerCase(Locale.ROOT);
        unique.putIfAbsent(key, word);
    }

    private String levelForIndex(int index) {
        if (index < TARGET_A1_TOTAL) return "A1";
        if (index < TARGET_A2_TOTAL) return "A2";
        if (index < TARGET_B1_TOTAL) return "B1";
        if (index < TARGET_B2_TOTAL) return "B2";
        return "C1";
    }

    private long ensureGoetheAutoTag() {
        jdbcTemplate.update(
                "INSERT INTO tags (name, color) VALUES (?, ?) ON DUPLICATE KEY UPDATE color = VALUES(color)",
                GOETHE_AUTO_TAG,
                "#7c3aed"
        );
        Long id = jdbcTemplate.query(
                "SELECT id FROM tags WHERE name = ? LIMIT 1",
                rs -> rs.next() ? rs.getLong("id") : null,
                GOETHE_AUTO_TAG
        );
        if (id == null) {
            throw new IllegalStateException("Cannot resolve tag id for " + GOETHE_AUTO_TAG);
        }
        return id;
    }

    private void clearManagedTagMappings(long tagId) {
        jdbcTemplate.update("DELETE FROM word_tags WHERE tag_id = ?", tagId);
    }

    private boolean attachWordToTag(long wordId, long tagId) {
        int changed = jdbcTemplate.update(
                "INSERT IGNORE INTO word_tags (word_id, tag_id) VALUES (?, ?)",
                wordId,
                tagId
        );
        return changed > 0;
    }

    private boolean isManagedWord(long wordId, long tagId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM word_tags WHERE word_id = ? AND tag_id = ?",
                Integer.class,
                wordId,
                tagId
        );
        return count != null && count > 0;
    }

    private Map<String, Integer> managedCountsByLevel(long tagId) {
        Map<String, Integer> out = new LinkedHashMap<>();
        out.put("A1", 0);
        out.put("A2", 0);
        out.put("B1", 0);
        out.put("B2", 0);
        out.put("C1", 0);
        Map<String, Integer> result = jdbcTemplate.query(
                """
                SELECT w.cefr_level, COUNT(*) AS total
                FROM words w
                JOIN word_tags wt ON wt.word_id = w.id
                WHERE wt.tag_id = ?
                  AND w.cefr_level IN ('A1','A2','B1','B2','C1')
                GROUP BY w.cefr_level
                """,
                rs -> {
                    Map<String, Integer> m = new LinkedHashMap<>();
                    while (rs.next()) {
                        m.put(rs.getString("cefr_level"), rs.getInt("total"));
                    }
                    return m;
                },
                tagId
        );
        out.putAll(result);
        return out;
    }

    private Map<String, Integer> cumulativeCounts(Map<String, Integer> levelCounts) {
        int a1 = levelCounts.getOrDefault("A1", 0);
        int a2 = a1 + levelCounts.getOrDefault("A2", 0);
        int b1 = a2 + levelCounts.getOrDefault("B1", 0);
        int b2 = b1 + levelCounts.getOrDefault("B2", 0);
        int c1 = b2 + levelCounts.getOrDefault("C1", 0);
        Map<String, Integer> out = new LinkedHashMap<>();
        out.put("A1", a1);
        out.put("A2", a2);
        out.put("B1", b1);
        out.put("B2", b2);
        out.put("C1", c1);
        return out;
    }

    private void validateMinimums(Map<String, Integer> cumulative) {
        Map<String, Integer> targets = new LinkedHashMap<>();
        targets.put("A1", TARGET_A1_TOTAL);
        targets.put("A2", TARGET_A2_TOTAL);
        targets.put("B1", TARGET_B1_TOTAL);
        targets.put("B2", TARGET_B2_TOTAL);

        List<String> errors = new ArrayList<>();
        for (Map.Entry<String, Integer> entry : targets.entrySet()) {
            int actual = cumulative.getOrDefault(entry.getKey(), 0);
            if (actual < entry.getValue()) {
                errors.add(entry.getKey() + ": " + actual + "/" + entry.getValue());
            }
        }
        if (!errors.isEmpty()) {
            throw new IllegalStateException("Import finished but minimum targets not met: " + String.join(", ", errors));
        }
    }

    private String fetchText(String url) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Accept", "text/plain")
                    .header("User-Agent", "DeutschFlow/1.0")
                    .GET()
                    .build();
            HttpClient client = HttpClient.newHttpClient();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("Fetch failed: " + url + " status " + response.statusCode());
            }
            return response.body();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Failed to fetch remote vocabulary source: " + url, e);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to fetch remote vocabulary source: " + url, e);
        }
    }

    protected record UpsertResult(long wordId, boolean inserted, boolean updated) {}
}

