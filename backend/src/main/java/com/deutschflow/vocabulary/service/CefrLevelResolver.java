package com.deutschflow.vocabulary.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Nguồn sự thật DUY NHẤT cho {@code words.cefr_level}.
 *
 * <p>Trước 14/08/2026 mỗi trình import tự đoán cấp độ: {@code GoetheVocabularyAutoImportService} gán theo
 * VỊ TRÍ trong danh sách (500 từ đầu = A1, …), {@code OfficialCefrVocabularyImportService} gán theo DẢI TẦN SUẤT
 * (hạng 3.000–7.000 = B2, …) rồi nhồi từ vào cấp nào còn thiếu quota. Kết quả: 407/643 lemma Goethe A1 bị đẩy lên
 * B1, 29% kho mang cấp hoàn toàn ngẫu nhiên. Xem {@code BAO_CAO_PHAN_CAP_TU_VUNG_2026-08-14.md}.
 *
 * <p>Nguyên tắc ở đây: <b>chỉ wordlist chính thức mới được quyết định cấp độ.</b> Từ không nằm trong wordlist nào
 * thì {@link #resolve(String)} trả {@link Optional#empty()} — nghĩa là CHƯA PHÂN CẤP ({@code cefr_level = NULL}),
 * chứ không đoán. Tần suất chỉ dùng để chọn từ nào vào kho, không bao giờ dùng để gán cấp.
 *
 * <p>Các wordlist Goethe là cộng dồn (danh sách B1 chứa cả từ A1/A2), nên khi một lemma xuất hiện ở nhiều danh sách
 * thì cấp đúng là cấp <b>THẤP NHẤT</b> — tức cấp mà người học gặp từ này lần đầu.
 */
@Service
@Slf4j
public class CefrLevelResolver {

    /** Wordlist Goethe chính thức trích từ PDF: mỗi dòng {@code cefr\tlemma\tví dụ}. */
    @Value("${app.vocabulary.cefr-sources.official-tsv:wordlists/goethe_official_wordlist.tsv}")
    private String officialTsv;

    /** Goethe-Zertifikat A1 Wortliste (bản Anki, TSV — cột 2 là lemma). */
    @Value("${app.vocabulary.cefr-sources.a1-anki-tsv:wordlists/cefr_a1_patsy.txt}")
    private String a1AnkiTsv;

    /** Goethe-Zertifikat B1 Wortliste (mỗi dòng một lemma) — cộng dồn A1–B1. */
    @Value("${app.vocabulary.cefr-sources.b1-list:wordlists/goethe_sorted.txt}")
    private String b1List;

    /** Danh sách bổ sung theo cấp, mỗi dòng một lemma. Để trống = chưa có nguồn cho cấp đó. */
    @Value("${app.vocabulary.cefr-sources.a2-list:}")
    private String a2List;

    @Value("${app.vocabulary.cefr-sources.b2-list:}")
    private String b2List;

    @Value("${app.vocabulary.cefr-sources.c1-list:}")
    private String c1List;

    @Value("${app.vocabulary.cefr-sources.c2-list:}")
    private String c2List;

    private volatile Map<String, GradedLemma> levelByLemma;

    /** Lemma đã có cấp chính thức: {@code lemma} là dạng hiển thị (giữ hoa/thường của nguồn). */
    public record GradedLemma(String lemma, String level) {}

    /** Cấp CEFR chính thức của lemma, hoặc rỗng khi không wordlist nào nhắc tới nó. */
    public Optional<String> resolve(String lemma) {
        String key = normalizeLemma(lemma);
        if (key.isEmpty()) {
            return Optional.empty();
        }
        return Optional.ofNullable(index().get(key)).map(GradedLemma::level);
    }

    /** Toàn bộ lemma có cấp chính thức, sắp theo cấp rồi theo lemma — nguồn cho import. */
    public List<GradedLemma> gradedLemmas() {
        List<GradedLemma> out = new ArrayList<>(index().values());
        out.sort(Comparator.comparingInt((GradedLemma g) -> rank(g.level())).thenComparing(GradedLemma::lemma));
        return out;
    }

    /** Số lemma mỗi cấp trong các wordlist đang nạp — dùng cho báo cáo import/admin. */
    public Map<String, Integer> countsByLevel() {
        Map<String, Integer> out = new LinkedHashMap<>();
        for (String level : LEVEL_ORDER) {
            out.put(level, 0);
        }
        for (GradedLemma graded : index().values()) {
            out.merge(graded.level(), 1, Integer::sum);
        }
        return out;
    }

    /** Nạp lại wordlist (sau khi thay file trên classpath trong lúc chạy). */
    public void reload() {
        levelByLemma = null;
        index();
    }

    private Map<String, GradedLemma> index() {
        Map<String, GradedLemma> cached = levelByLemma;
        if (cached != null) {
            return cached;
        }
        synchronized (this) {
            if (levelByLemma == null) {
                levelByLemma = buildIndex();
            }
            return levelByLemma;
        }
    }

    private Map<String, GradedLemma> buildIndex() {
        Map<String, GradedLemma> index = new LinkedHashMap<>();

        // TSV chính thức mang cấp riêng cho từng dòng — nguồn chính xác nhất.
        for (Map.Entry<String, String> e : parseOfficialTsv(officialTsv).entrySet()) {
            putLowestLevel(index, e.getKey(), e.getValue());
        }
        for (String lemma : parseAnkiTsvLemmas(a1AnkiTsv)) {
            putLowestLevel(index, lemma, "A1");
        }
        putListIfConfigured(index, a2List, "A2");
        // Wortliste B1 cộng dồn A1–B1: chỉ những lemma chưa có cấp thấp hơn mới thành B1.
        putListIfConfigured(index, b1List, "B1");
        putListIfConfigured(index, b2List, "B2");
        putListIfConfigured(index, c1List, "C1");
        putListIfConfigured(index, c2List, "C2");

        Map<String, Integer> perLevel = new LinkedHashMap<>();
        for (GradedLemma graded : index.values()) {
            perLevel.merge(graded.level(), 1, Integer::sum);
        }
        log.info("CEFR wordlists loaded: {} lemma — {}", index.size(), perLevel);
        return Collections.unmodifiableMap(index);
    }

    private void putListIfConfigured(Map<String, GradedLemma> index, String location, String level) {
        if (location == null || location.isBlank()) {
            return;
        }
        for (String lemma : parsePlainLemmaList(location)) {
            putLowestLevel(index, lemma, level);
        }
    }

    /** Wordlist cộng dồn ⇒ giữ cấp THẤP NHẤT (cấp người học gặp từ này lần đầu). */
    private void putLowestLevel(Map<String, GradedLemma> index, String lemma, String level) {
        String key = normalizeLemma(lemma);
        String display = displayLemma(lemma);
        if (key.isEmpty() || display.isEmpty() || !ALLOWED.contains(level)) {
            return;
        }
        GradedLemma current = index.get(key);
        if (current == null || rank(level) < rank(current.level())) {
            index.put(key, new GradedLemma(display, level));
        }
    }

    private Map<String, String> parseOfficialTsv(String location) {
        Map<String, String> out = new LinkedHashMap<>();
        for (String raw : readLines(location)) {
            String line = raw.trim();
            if (line.isEmpty() || line.startsWith("cefr\t")) {
                continue;
            }
            String[] parts = line.split("\t", 3);
            if (parts.length < 2) {
                continue;
            }
            String level = parts[0].trim().toUpperCase(Locale.ROOT);
            if (!ALLOWED.contains(level)) {
                continue;
            }
            out.merge(parts[1], level, (a, b) -> rank(a) <= rank(b) ? a : b);
        }
        return out;
    }

    /** Bản Anki của Wortliste A1: cột 1 là id, cột 2 là lemma ("die Ansage, -n", "an sein", …). */
    private List<String> parseAnkiTsvLemmas(String location) {
        List<String> out = new ArrayList<>();
        for (String raw : readLines(location)) {
            String line = raw.trim();
            if (line.isEmpty()) {
                continue;
            }
            String[] cols = line.split("\t");
            if (cols.length < 2) {
                continue;
            }
            out.add(cols[1]);
        }
        return out;
    }

    private List<String> parsePlainLemmaList(String location) {
        List<String> out = new ArrayList<>();
        for (String raw : readLines(location)) {
            String line = raw.trim();
            if (!line.isEmpty()) {
                out.add(line);
            }
        }
        return out;
    }

    private List<String> readLines(String location) {
        try {
            return List.of(ClasspathWordlistReader.readUtf8(location).split("\\R"));
        } catch (RuntimeException e) {
            log.warn("CEFR wordlist not readable ({}) — bỏ qua nguồn này: {}", location, e.getMessage());
            return List.of();
        }
    }

    /**
     * Dạng hiển thị của lemma: bỏ mạo từ, đuôi số nhiều/chia động từ sau dấu phẩy, ghi chú trong ngoặc —
     * nhưng GIỮ hoa/thường của nguồn ("die Ansage, -n" → "Ansage").
     */
    static String displayLemma(String raw) {
        if (raw == null) {
            return "";
        }
        String s = Normalizer.normalize(raw.trim(), Normalizer.Form.NFKC);
        s = s.replaceAll("\\(.*?\\)", " ");
        s = s.replaceAll("\\[.*?\\]", " ");
        s = s.split(",")[0];
        s = s.split("/")[0];
        s = s.replaceAll("\\s+", " ").trim();
        s = s.replaceAll("^(?i)(der|die|das|ein|eine)\\s+", "");
        return s.replaceAll("[^\\p{L}\\- ]", "").replaceAll("\\s{2,}", " ").trim();
    }

    /** Khoá so khớp với {@code words.base_form} — như {@link #displayLemma} nhưng hạ chữ thường. */
    static String normalizeLemma(String raw) {
        return displayLemma(raw).toLowerCase(Locale.ROOT);
    }

    static final List<String> LEVEL_ORDER = List.of("A1", "A2", "B1", "B2", "C1", "C2");
    private static final Set<String> ALLOWED = Set.of("A1", "A2", "B1", "B2", "C1", "C2");

    private static int rank(String cefr) {
        int i = LEVEL_ORDER.indexOf(cefr == null ? "" : cefr.toUpperCase(Locale.ROOT));
        return i < 0 ? Integer.MAX_VALUE : i;
    }
}
