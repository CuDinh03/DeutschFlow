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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Mở rộng kho từ vựng lên ~10k lemma. <b>Cấp độ CEFR chỉ do {@link CefrLevelResolver} quyết định</b> (wordlist
 * chính thức); bảng tần suất chỉ chọn từ nào vào kho. Từ ngoài wordlist ⇒ {@code cefr_level = NULL} (chưa phân cấp).
 *
 * <p>Trước 14/08/2026 lớp này gán cấp theo dải tần suất (hạng 3.000–7.000 = B2…) rồi nhồi từ vào cấp còn thiếu
 * quota — 29% kho mang cấp ngẫu nhiên. Xem {@code BAO_CAO_PHAN_CAP_TU_VUNG_2026-08-14.md}.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OfficialCefrVocabularyImportService {

    private static final String TAG_NAME = "CEFR_CURATED";
    private static final String SOURCE_FREQ =
            "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/de/de_50k.txt";

    private final JdbcTemplate jdbcTemplate;
    private final GoetheVocabularyAutoImportService goetheVocabularyAutoImportService;
    private final CefrLevelResolver cefrLevelResolver;

    /** Trần số lemma trong kho (lemma có cấp luôn được nạp trước, phần còn lại lấy theo tần suất). */
    @Value("${app.vocabulary.cefr-curated.target-total:10000}")
    private int targetTotal;

    @Value("${app.vocabulary.cefr-curated.fallback-frequency-url:}")
    private String fallbackFrequencyUrl;

    @Value("${app.vocabulary.cefr-curated.enrich-after-upsert:true}")
    private boolean enrichAfterUpsert;

    @Value("${app.vocabulary.cefr-curated.deepl-max-chars-per-run:450000}")
    private long deeplMaxCharsPerRun;

    @Value("${app.vocabulary.cefr-curated.use-remote-sources:false}")
    private boolean useRemoteSources;

    @Value("${app.vocabulary.cefr-curated.classpath-freq:wordlists/de_50k.txt}")
    private String classpathFreq;

    @Value("${app.vocabulary.goethe.enrich-source:local_only}")
    private String goetheEnrichSource;

    private final HttpClient httpClient = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NORMAL).build();

    /**
     * Import ~10k lemma; enrich (DeepL/local) theo {@link #enrichAfterUpsert}.
     */
    public Map<String, Object> importCuratedCefrVocabulary() {
        return importCuratedCefrVocabulary(enrichAfterUpsert);
    }

    /**
     * @param enrichAfterUpsertForThisRun ghi đè cờ global (dùng khi bootstrap: false để tránh gọi DeepL lúc start).
     */
    public Map<String, Object> importCuratedCefrVocabulary(boolean enrichAfterUpsertForThisRun) {
        // Cấp độ CHỈ đến từ wordlist chính thức (CefrLevelResolver). Bảng tần suất de_50k chỉ quyết định
        // từ nào được đưa vào kho — không bao giờ quyết định cấp độ (xem BAO_CAO_PHAN_CAP_TU_VUNG_2026-08-14.md).
        List<CefrLevelResolver.GradedLemma> graded = cefrLevelResolver.gradedLemmas();

        // Ứng viên vào kho: lemma có cấp trước, rồi từ theo tần suất cho tới khi đủ targetTotal.
        Map<String, String> candidates = new LinkedHashMap<>();
        for (CefrLevelResolver.GradedLemma g : graded) {
            String key = CefrLevelResolver.normalizeLemma(g.lemma());
            if (!key.isEmpty()) {
                candidates.putIfAbsent(key, g.lemma());
            }
        }
        int gradedCandidates = candidates.size();

        List<String> freqWords = loadFrequencyWords();
        for (String w : freqWords) {
            if (candidates.size() >= targetTotal) {
                break;
            }
            String key = CefrLevelResolver.normalizeLemma(w);
            if (!key.isEmpty()) {
                candidates.putIfAbsent(key, w.trim());
            }
        }

        long tagId = ensureTag();
        int inserted = 0;
        int updated = 0;
        int ungraded = 0;
        long charsUsed = 0;
        boolean doEnrich = enrichAfterUpsertForThisRun;
        boolean countDeeplBudget = enrichAfterUpsertForThisRun && !"local_only".equalsIgnoreCase(goetheEnrichSource);
        Map<String, Integer> levelCounts = new LinkedHashMap<>();

        for (String lemma : candidates.values()) {
            String level = cefrLevelResolver.resolve(lemma).orElse(null);
            if (level == null) {
                ungraded++;
            } else {
                levelCounts.merge(level, 1, Integer::sum);
            }
            if (doEnrich && countDeeplBudget && charsUsed >= deeplMaxCharsPerRun) {
                log.warn("DeepL budget per run exceeded ({} chars); stopping enrich for remainder", deeplMaxCharsPerRun);
                doEnrich = false;
            }
            UpsertResult upsert = upsertLemma(lemma, level, tagId);
            if (upsert.inserted()) {
                inserted++;
            } else {
                updated++;
            }
            if (doEnrich) {
                if (countDeeplBudget) {
                    charsUsed += estimateEnrichChars(lemma);
                }
                goetheVocabularyAutoImportService.enrichLemma(upsert.wordId(), lemma);
            }
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("source", "CEFR_CURATED");
        out.put("targetTotal", targetTotal);
        out.put("pickedTotal", candidates.size());
        out.put("gradedFromWordlists", gradedCandidates);
        out.put("ungraded", ungraded);
        out.put("inserted", inserted);
        out.put("updated", updated);
        out.put("levelCounts", levelCounts);
        out.put("deeplCharsEstimated", charsUsed);
        out.put("note", "Cấp độ chỉ lấy từ wordlist chính thức; từ ngoài wordlist để CHƯA PHÂN CẤP (cefr_level = NULL).");
        out.put("useRemoteSources", useRemoteSources);
        out.put("enrichAfterUpsertApplied", enrichAfterUpsertForThisRun);
        return out;
    }

    /**
     * Gán lại cấp độ cho TOÀN BỘ bảng {@code words} theo wordlist chính thức: từ nào không có trong wordlist
     * nào sẽ về {@code NULL} (chưa phân cấp). Chỉ chạy khi ADMIN gọi — không chạy lúc khởi động.
     */
    @Transactional
    public Map<String, Object> reclassifyAllWords() {
        Long totalWords = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM words", Long.class);

        // Xoá sạch cấp cũ TRƯỚC (trong cùng transaction) rồi gán lại theo wordlist: cách duy nhất để
        // những cấp bịa từ thời heuristic biến mất, chứ nâng-cấp-dần thì chúng sống mãi.
        int cleared = jdbcTemplate.update(
                "UPDATE words SET cefr_level = NULL, updated_at = NOW() WHERE cefr_level IS NOT NULL");

        List<CefrLevelResolver.GradedLemma> graded = cefrLevelResolver.gradedLemmas();
        List<Object[]> batchArgs = new ArrayList<>(graded.size());
        for (CefrLevelResolver.GradedLemma g : graded) {
            batchArgs.add(new Object[]{g.level(), g.lemma()});
        }
        int[] affected = jdbcTemplate.batchUpdate(
                "UPDATE words SET cefr_level = ?, updated_at = NOW() WHERE LOWER(base_form) = LOWER(?)",
                batchArgs
        );
        int gradedRows = 0;
        int lemmasNotInCatalog = 0;
        for (int n : affected) {
            gradedRows += Math.max(n, 0);
            if (n == 0) {
                lemmasNotInCatalog++;
            }
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("totalWords", totalWords == null ? 0L : totalWords);
        out.put("clearedStaleLevels", cleared);
        out.put("gradedRows", gradedRows);
        out.put("wordlistLemmas", graded.size());
        out.put("lemmasNotInCatalog", lemmasNotInCatalog);
        out.put("wordlistCounts", cefrLevelResolver.countsByLevel());
        out.put("note", "Từ ngoài wordlist chính thức để NULL (chưa phân cấp) — không đoán cấp.");
        return out;
    }

    /** Bảng tần suất — chỉ để chọn từ vào kho, KHÔNG dùng để gán cấp. */
    private List<String> loadFrequencyWords() {
        String freqBody = useRemoteSources
                ? fetchText(blank(fallbackFrequencyUrl) ? SOURCE_FREQ : fallbackFrequencyUrl)
                : ClasspathWordlistReader.readUtf8(classpathFreq);
        return parseFrequency(freqBody);
    }

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

    private long estimateEnrichChars(String lemma) {
        return lemma.length() * 40L + 200L;
    }

    private UpsertResult upsertLemma(String baseForm, String cefrLevel, long tagId) {
        Long existingId = jdbcTemplate.query(
                "SELECT id FROM words WHERE LOWER(base_form) = LOWER(?) LIMIT 1",
                rs -> rs.next() ? rs.getLong("id") : null,
                baseForm
        );
        String dtype = inferDtype(baseForm);
        // null = wordlist chính thức không nhắc tới từ này ⇒ CHƯA PHÂN CẤP, không đoán.
        String normalizedCefr = normalizeCefr(cefrLevel);
        if (existingId == null) {
            Long newId = jdbcTemplate.queryForObject(
                    """
                    INSERT INTO words (dtype, base_form, cefr_level, created_at, updated_at)
                    VALUES (?, ?, ?, NOW(), NOW())
                    RETURNING id
                    """,
                    Long.class,
                    dtype, baseForm, normalizedCefr
            );
            attachTag(newId, tagId);
            return new UpsertResult(newId, true);
        }
        if (normalizedCefr != null) {
            jdbcTemplate.update(
                    "UPDATE words SET cefr_level = ?, dtype = ?, updated_at = NOW() WHERE id = ?",
                    normalizedCefr, dtype, existingId
            );
        } else {
            // Không có cấp chính thức: chỉ cập nhật dtype, giữ nguyên cefr_level hiện có.
            // Dọn cấp cũ sai là việc của reclassifyAllWords() — chạy có chủ đích, không tự động.
            jdbcTemplate.update("UPDATE words SET dtype = ?, updated_at = NOW() WHERE id = ?", dtype, existingId);
        }
        attachTag(existingId, tagId);
        return new UpsertResult(existingId, false);
    }

    /** null/không hợp lệ ⇒ null (chưa phân cấp). Trước 14/08/2026 hàm này trả "A1" nên A1 thành thùng rác. */
    private String normalizeCefr(String cefr) {
        if (cefr == null || cefr.isBlank()) {
            return null;
        }
        String u = cefr.trim().toUpperCase(Locale.ROOT);
        return switch (u) {
            case "A1", "A2", "B1", "B2", "C1", "C2" -> u;
            default -> null;
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
        jdbcTemplate.update("INSERT INTO word_tags (word_id, tag_id) VALUES (?, ?) ON CONFLICT (word_id, tag_id) DO NOTHING", wordId, tagId);
    }

    private long ensureTag() {
        jdbcTemplate.update(
                "INSERT INTO tags (name, color) VALUES (?, ?) ON CONFLICT (name) DO UPDATE SET color = EXCLUDED.color",
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


    private record UpsertResult(long wordId, boolean inserted) {}
}
