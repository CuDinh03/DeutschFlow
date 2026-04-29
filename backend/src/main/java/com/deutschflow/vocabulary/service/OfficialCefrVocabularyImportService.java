package com.deutschflow.vocabulary.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Import ~10k lemma với CEFR từ wordlist theo cấp (URL hoặc file classpath). Dedup: giữ cấp cao nhất.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OfficialCefrVocabularyImportService {

    private static final String TAG_NAME = "CEFR_CURATED";
    private static final String SOURCE_A1 =
            "https://raw.githubusercontent.com/patsytau/anki_german_a1_vocab/main/Goethe%20Institute%20A1%20Wordlist.txt";
    private static final String SOURCE_B1_GOETHE =
            "https://raw.githubusercontent.com/kennethsible/goethe-wortliste/main/sorted.txt";
    private static final String SOURCE_FREQ =
            "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/de/de_50k.txt";

    private static final List<String> LEVEL_ORDER = List.of("A1", "A2", "B1", "B2", "C1");

    private final JdbcTemplate jdbcTemplate;
    private final GoetheVocabularyAutoImportService goetheVocabularyAutoImportService;

    @Value("${app.vocabulary.cefr-curated.target-total:10000}")
    private int targetTotal;

    @Value("${app.vocabulary.cefr-curated.quota-a1:2000}")
    private int quotaA1;

    @Value("${app.vocabulary.cefr-curated.quota-a2:2000}")
    private int quotaA2;

    @Value("${app.vocabulary.cefr-curated.quota-b1:2000}")
    private int quotaB1;

    @Value("${app.vocabulary.cefr-curated.quota-b2:2000}")
    private int quotaB2;

    @Value("${app.vocabulary.cefr-curated.quota-c1:2000}")
    private int quotaC1;

    @Value("${app.vocabulary.cefr-curated.url-a1:}")
    private String urlA1;

    @Value("${app.vocabulary.cefr-curated.url-a2:}")
    private String urlA2;

    @Value("${app.vocabulary.cefr-curated.url-b1:}")
    private String urlB1;

    @Value("${app.vocabulary.cefr-curated.url-b2:}")
    private String urlB2;

    @Value("${app.vocabulary.cefr-curated.url-c1:}")
    private String urlC1;

    @Value("${app.vocabulary.cefr-curated.fallback-frequency-url:}")
    private String fallbackFrequencyUrl;

    @Value("${app.vocabulary.cefr-curated.enrich-after-upsert:true}")
    private boolean enrichAfterUpsert;

    @Value("${app.vocabulary.cefr-curated.deepl-max-chars-per-run:450000}")
    private long deeplMaxCharsPerRun;

    @Value("${app.vocabulary.cefr-curated.use-remote-sources:false}")
    private boolean useRemoteSources;

    @Value("${app.vocabulary.cefr-curated.classpath-a1:wordlists/cefr_a1_patsy.txt}")
    private String classpathA1;

    @Value("${app.vocabulary.cefr-curated.classpath-b1:wordlists/goethe_sorted.txt}")
    private String classpathB1;

    @Value("${app.vocabulary.cefr-curated.classpath-freq:wordlists/de_50k.txt}")
    private String classpathFreq;

    @Value("${app.vocabulary.cefr-curated.classpath-a2:}")
    private String classpathA2;

    @Value("${app.vocabulary.cefr-curated.classpath-b2:}")
    private String classpathB2;

    @Value("${app.vocabulary.cefr-curated.classpath-c1:}")
    private String classpathC1;

    @Value("${app.vocabulary.goethe.enrich-source:local_only}")
    private String goetheEnrichSource;

    private final HttpClient httpClient = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NORMAL).build();

    /**
     * Import ~10k lemma; enrich (DeepL/local) theo {@link #enrichAfterUpsert}.
     */
    @Transactional
    public Map<String, Object> importCuratedCefrVocabulary() {
        return importCuratedCefrVocabulary(enrichAfterUpsert);
    }

    /**
     * @param enrichAfterUpsertForThisRun ghi đè cờ global (dùng khi bootstrap: false để tránh gọi DeepL lúc start).
     */
    @Transactional
    public Map<String, Object> importCuratedCefrVocabulary(boolean enrichAfterUpsertForThisRun) {
        String freqBody = useRemoteSources
                ? fetchText(blank(fallbackFrequencyUrl) ? SOURCE_FREQ : fallbackFrequencyUrl)
                : ClasspathWordlistReader.readUtf8(classpathFreq);
        List<String> freqWords = parseFrequency(freqBody);

        List<String> a1Words = parseGoetheStyle(
                useRemoteSources ? fetchText(blank(urlA1) ? SOURCE_A1 : urlA1) : ClasspathWordlistReader.readUtf8(classpathA1)
        );
        List<String> b1Words = parseGoetheStyle(
                useRemoteSources ? fetchText(blank(urlB1) ? SOURCE_B1_GOETHE : urlB1) : ClasspathWordlistReader.readUtf8(classpathB1)
        );

        List<String> a2Words;
        if (!useRemoteSources) {
            a2Words = !blank(classpathA2)
                    ? parseGoetheStyle(ClasspathWordlistReader.readUtf8(classpathA2))
                    : slice(freqWords, 0, 3000);
        } else if (!blank(urlA2)) {
            a2Words = parseGoetheStyle(fetchText(urlA2));
        } else {
            a2Words = slice(freqWords, 0, 3000);
        }

        List<String> b2Words;
        if (!useRemoteSources) {
            b2Words = !blank(classpathB2)
                    ? parseGoetheStyle(ClasspathWordlistReader.readUtf8(classpathB2))
                    : slice(freqWords, 3000, 7000);
        } else if (!blank(urlB2)) {
            b2Words = parseGoetheStyle(fetchText(urlB2));
        } else {
            b2Words = slice(freqWords, 3000, 7000);
        }

        List<String> c1Words;
        if (!useRemoteSources) {
            c1Words = !blank(classpathC1)
                    ? parseGoetheStyle(ClasspathWordlistReader.readUtf8(classpathC1))
                    : slice(freqWords, 7000, freqWords.size());
        } else if (!blank(urlC1)) {
            c1Words = parseGoetheStyle(fetchText(urlC1));
        } else {
            c1Words = slice(freqWords, 7000, freqWords.size());
        }

        Map<String, String> keyToLevel = new LinkedHashMap<>();
        Map<String, String> keyToDisplay = new LinkedHashMap<>();

        mergeLevel(keyToLevel, keyToDisplay, a1Words, "A1");
        mergeLevel(keyToLevel, keyToDisplay, a2Words, "A2");
        mergeLevel(keyToLevel, keyToDisplay, b1Words, "B1");
        mergeLevel(keyToLevel, keyToDisplay, b2Words, "B2");
        mergeLevel(keyToLevel, keyToDisplay, c1Words, "C1");

        Map<String, Integer> quotas = Map.of(
                "A1", quotaA1,
                "A2", quotaA2,
                "B1", quotaB1,
                "B2", quotaB2,
                "C1", quotaC1
        );

        Map<String, List<String>> byLevel = new LinkedHashMap<>();
        for (String lv : LEVEL_ORDER) {
            byLevel.put(lv, new ArrayList<>());
        }
        for (Map.Entry<String, String> e : keyToLevel.entrySet()) {
            String k = e.getKey();
            String lv = e.getValue();
            byLevel.computeIfAbsent(lv, x -> new ArrayList<>()).add(keyToDisplay.getOrDefault(k, k));
        }
        for (List<String> list : byLevel.values()) {
            list.sort(Comparator.naturalOrder());
        }

        List<LemmaEntry> toInsert = new ArrayList<>();
        Set<String> globalUsed = new LinkedHashSet<>();

        for (String lv : LEVEL_ORDER) {
            int cap = quotas.getOrDefault(lv, 2000);
            int addedForLevel = 0;
            for (String lemma : byLevel.getOrDefault(lv, List.of())) {
                if (toInsert.size() >= targetTotal) {
                    break;
                }
                if (addedForLevel >= cap) {
                    break;
                }
                String norm = normalizeLemma(lemma);
                if (norm.isEmpty()) {
                    continue;
                }
                if (!globalUsed.add(norm)) {
                    continue;
                }
                toInsert.add(new LemmaEntry(lemma.trim(), lv));
                addedForLevel++;
            }
        }

        if (toInsert.size() < targetTotal) {
            Map<String, Integer> pickedByLevel = countByLevel(toInsert);
            for (String w : freqWords) {
                if (toInsert.size() >= targetTotal) {
                    break;
                }
                String nk = normalizeLemma(w);
                if (nk.isEmpty() || globalUsed.contains(nk)) {
                    continue;
                }
                String deficitLevel = firstDeficitLevel(pickedByLevel, quotas);
                if (deficitLevel == null) {
                    break;
                }
                globalUsed.add(nk);
                toInsert.add(new LemmaEntry(w.trim(), deficitLevel));
                pickedByLevel.merge(deficitLevel, 1, Integer::sum);
            }
        }

        long tagId = ensureTag();
        int inserted = 0;
        int updated = 0;
        long charsUsed = 0;
        boolean doEnrich = enrichAfterUpsertForThisRun;
        boolean countDeeplBudget = enrichAfterUpsertForThisRun && !"local_only".equalsIgnoreCase(goetheEnrichSource);

        for (LemmaEntry e : toInsert) {
            if (doEnrich && countDeeplBudget && charsUsed >= deeplMaxCharsPerRun) {
                log.warn("DeepL budget per run exceeded ({} chars); stopping enrich for remainder", deeplMaxCharsPerRun);
                doEnrich = false;
            }
            UpsertResult upsert = upsertLemma(e.lemma(), e.cefr(), tagId);
            if (upsert.inserted()) {
                inserted++;
            } else {
                updated++;
            }
            if (doEnrich) {
                if (countDeeplBudget) {
                    charsUsed += estimateEnrichChars(e.lemma());
                }
                goetheVocabularyAutoImportService.enrichLemma(upsert.wordId(), e.lemma());
            }
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("source", "CEFR_CURATED");
        out.put("targetTotal", targetTotal);
        out.put("pickedTotal", toInsert.size());
        out.put("inserted", inserted);
        out.put("updated", updated);
        out.put("levelCounts", countByLevel(toInsert));
        out.put("deeplCharsEstimated", charsUsed);
        out.put(
                "note",
                useRemoteSources
                        ? "CEFR theo wordlist (HTTP) + dedup cấp cao nhất; pad từ de_50k nếu thiếu."
                        : "CEFR theo file classpath (offline) + dedup cấp cao nhất; pad từ de_50k nếu thiếu."
        );
        out.put("useRemoteSources", useRemoteSources);
        out.put("enrichAfterUpsertApplied", enrichAfterUpsertForThisRun);
        return out;
    }

    @Transactional
    public Map<String, Object> importFromClasspathSample() throws IOException {
        var res = new ClassPathResource("wordlists/cefr_import_sample.csv");
        long tagId = ensureTag();
        int n = 0;
        try (BufferedReader br = new BufferedReader(new InputStreamReader(res.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            boolean first = true;
            while ((line = br.readLine()) != null) {
                if (first) {
                    first = false;
                    continue;
                }
                if (line.isBlank()) {
                    continue;
                }
                String[] p = line.split(",");
                if (p.length < 2) {
                    continue;
                }
                String lemma = p[0].trim();
                String cefr = p[1].trim().toUpperCase(Locale.ROOT);
                UpsertResult r = upsertLemma(lemma, cefr, tagId);
                if (enrichAfterUpsert) {
                    goetheVocabularyAutoImportService.enrichLemma(r.wordId(), lemma);
                }
                n++;
            }
        }
        return Map.of("imported", n, "source", "classpath:wordlists/cefr_import_sample.csv");
    }

    private Map<String, Integer> countByLevel(List<LemmaEntry> list) {
        return list.stream().collect(Collectors.groupingBy(LemmaEntry::cefr, Collectors.summingInt(x -> 1)));
    }

    private String firstDeficitLevel(Map<String, Integer> picked, Map<String, Integer> quotas) {
        for (String lv : LEVEL_ORDER) {
            int q = quotas.getOrDefault(lv, 0);
            int p = picked.getOrDefault(lv, 0);
            if (p < q) {
                return lv;
            }
        }
        return null;
    }

    private long estimateEnrichChars(String lemma) {
        return lemma.length() * 40L + 200L;
    }

    private void mergeLevel(
            Map<String, String> keyToLevel,
            Map<String, String> keyToDisplay,
            List<String> words,
            String level
    ) {
        for (String w : words) {
            String key = normalizeLemma(w);
            if (key.isEmpty()) {
                continue;
            }
            String cur = keyToLevel.get(key);
            if (cur == null || rank(level) > rank(cur)) {
                keyToLevel.put(key, level);
                keyToDisplay.put(key, cleanDisplayLemma(w));
            }
        }
    }

    private String cleanDisplayLemma(String w) {
        if (w == null) {
            return "";
        }
        String s = w.trim();
        s = s.replaceAll("\\[.*?\\]", "").trim();
        s = s.split(",")[0].trim();
        if (s.length() > 100) {
            s = s.substring(0, 100);
        }
        return s;
    }

    private static int rank(String cefr) {
        if (cefr == null) {
            return 0;
        }
        return switch (cefr.toUpperCase(Locale.ROOT)) {
            case "A1" -> 1;
            case "A2" -> 2;
            case "B1" -> 3;
            case "B2" -> 4;
            case "C1" -> 5;
            case "C2" -> 6;
            default -> 0;
        };
    }

    private List<String> slice(List<String> all, int from, int to) {
        List<String> out = new ArrayList<>();
        int end = Math.min(to, all.size());
        for (int i = from; i < end; i++) {
            out.add(all.get(i));
        }
        return out;
    }

    private UpsertResult upsertLemma(String baseForm, String cefrLevel, long tagId) {
        Long existingId = jdbcTemplate.query(
                "SELECT id FROM words WHERE LOWER(base_form) = LOWER(?) LIMIT 1",
                rs -> rs.next() ? rs.getLong("id") : null,
                baseForm
        );
        String dtype = inferDtype(baseForm);
        String normalizedCefr = normalizeCefr(cefrLevel);
        if (existingId == null) {
            jdbcTemplate.update(
                    """
                    INSERT INTO words (dtype, base_form, cefr_level, created_at, updated_at)
                    VALUES (?, ?, ?, NOW(), NOW())
                    """,
                    dtype, baseForm, normalizedCefr
            );
            Long newId = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
            attachTag(newId, tagId);
            return new UpsertResult(newId, true);
        }
        jdbcTemplate.update(
                "UPDATE words SET cefr_level = ?, dtype = ?, updated_at = NOW() WHERE id = ?",
                normalizedCefr, dtype, existingId
        );
        attachTag(existingId, tagId);
        return new UpsertResult(existingId, false);
    }

    private String normalizeCefr(String cefr) {
        String u = cefr == null ? "A1" : cefr.trim().toUpperCase(Locale.ROOT);
        return switch (u) {
            case "A1", "A2", "B1", "B2", "C1", "C2" -> u;
            default -> "A1";
        };
    }

    private String inferDtype(String word) {
        String w = word.toLowerCase(Locale.ROOT);
        if (w.endsWith("en") || w.endsWith("eln") || w.endsWith("ern") || w.endsWith("ieren")) {
            return "Verb";
        }
        return "Noun";
    }

    private void attachTag(long wordId, long tagId) {
        jdbcTemplate.update("INSERT IGNORE INTO word_tags (word_id, tag_id) VALUES (?, ?)", wordId, tagId);
    }

    private long ensureTag() {
        jdbcTemplate.update(
                "INSERT INTO tags (name, color) VALUES (?, ?) ON DUPLICATE KEY UPDATE color = VALUES(color)",
                TAG_NAME,
                "#0d9488"
        );
        Long id = jdbcTemplate.query(
                "SELECT id FROM tags WHERE name = ? LIMIT 1",
                rs -> rs.next() ? rs.getLong("id") : null,
                TAG_NAME
        );
        if (id == null) {
            throw new IllegalStateException("Cannot resolve tag " + TAG_NAME);
        }
        return id;
    }

    private String normalizeLemma(String raw) {
        if (raw == null) {
            return "";
        }
        String s = Normalizer.normalize(raw.trim(), Normalizer.Form.NFKC);
        s = s.replaceAll("^\\(.*\\)\\s*", "");
        s = s.replaceAll("\\s*\\[.*?\\]\\s*", "");
        s = s.replaceAll("^(der|die|das|ein|eine)\\s+", "");
        s = s.split(",")[0].trim();
        s = s.replaceAll("[^\\p{L}\\-]", "").trim();
        return s.toLowerCase(Locale.ROOT);
    }

    private List<String> parseGoetheStyle(String body) {
        List<String> out = new ArrayList<>();
        for (String raw : body.split("\\R")) {
            String line = raw == null ? "" : raw.trim();
            if (line.isBlank()) {
                continue;
            }
            String cleaned = line
                    .replaceAll("\\(.*?\\)", "")
                    .replaceAll("[0-9]", "")
                    .trim();
            if (cleaned.isBlank()) {
                continue;
            }
            String token = cleaned.split(",")[0].trim();
            token = token.replaceAll("^(der|die|das|ein|eine)\\s+", "").trim();
            token = token.split("/")[0].trim();
            // Heuristic: many sources contain phrases/sentences; keep lemma-like prefix.
            // Preserve spaces (e.g. "sich freuen") and avoid concatenation like "ausseinDieSchule...".
            String[] words = token.split("\\s+");
            if (words.length >= 3) {
                token = "sich".equalsIgnoreCase(words[0]) && words[1].length() >= 2
                        ? (words[0] + " " + words[1])
                        : words[0];
            }
            token = token.replaceAll("[^\\p{L}\\-\\s]", " ").replaceAll("\\s{2,}", " ").trim();
            if (token.isBlank() || token.length() < 2 || token.endsWith("-")) {
                continue;
            }
            out.add(token);
        }
        return out;
    }

    private List<String> parseFrequency(String body) {
        List<String> out = new ArrayList<>();
        for (String raw : body.split("\\R")) {
            String line = raw == null ? "" : raw.trim();
            if (line.isBlank()) {
                continue;
            }
            String[] parts = line.split("\\s+");
            if (parts.length < 1) {
                continue;
            }
            String token = parts[0].trim().replaceAll("[^\\p{L}\\-]", "");
            if (token.length() < 2 || token.endsWith("-")) {
                continue;
            }
            out.add(token);
        }
        return out;
    }

    private String fetchText(String url) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Accept", "text/plain,text/csv,*/*")
                    .header("User-Agent", "DeutschFlow/1.0 (CEFR curated import)")
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("HTTP " + response.statusCode() + " for " + url);
            }
            return response.body();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        } catch (IOException e) {
            throw new IllegalStateException("Fetch failed: " + url, e);
        }
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    private record LemmaEntry(String lemma, String cefr) {}

    private record UpsertResult(long wordId, boolean inserted) {}
}
