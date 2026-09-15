package com.deutschflow.examspeaking.metrics;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Wordlist Goethe chính thức đã re-parse (tài sản #352/#356):
 * {@code backend/src/main/resources/wordlists/goethe_official_wordlist.tsv} — cột cefr, lemma, example_de.
 * Dùng để đo phổ từ vựng (Wortschatz-Spektrum) theo đúng nguồn đề thi.
 */
@Component
@Slf4j
public class GoetheWordlist {

    private static final String RESOURCE = "wordlists/goethe_official_wordlist.tsv";
    /**
     * Bổ sung B2/C1 (audit 31/08 F-14): Goethe không công bố Wortliste trên B1, nên tầng này là danh sách
     * SUY TỪ TẦN SUẤT (de_50k, đã loại mọi từ A1–B1) — heuristic có ghi rõ trong file, không phải danh sách
     * chính thức. Chỉ điền vào chỗ trống ({@code putIfAbsent}), không bao giờ ghi đè cấp chính thức.
     */
    static final String SUPPLEMENT_RESOURCE = "wordlists/cefr_b2_c1_frequency.tsv";
    private final Map<String, String> levelByLemma = new HashMap<>();

    @PostConstruct
    public void load() {
        int official = loadResource(RESOURCE);
        if (official == 0) {
            log.warn("[ExamSpeaking] Goethe wordlist unavailable: lexical profiling degrades to TTR only");
        } else {
            log.info("[ExamSpeaking] Goethe wordlist loaded: {} lemmas", official);
        }
        int extra = loadResource(SUPPLEMENT_RESOURCE);
        if (extra > 0) {
            log.info("[ExamSpeaking] B2/C1 frequency supplement loaded: +{} lemmas (heuristic, xem file)", extra);
        }
    }

    /** @return số lemma mới thêm từ resource (0 khi thiếu file/lỗi đọc). Dòng bắt đầu bằng '#' là chú thích. */
    private int loadResource(String resource) {
        int added = 0;
        try (BufferedReader br = new BufferedReader(new InputStreamReader(
                new ClassPathResource(resource).getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            boolean header = true;
            while ((line = br.readLine()) != null) {
                if (line.startsWith("#")) {
                    continue;
                }
                if (header) {
                    header = false;
                    continue;
                }
                String[] cols = line.split("\t");
                if (cols.length < 2) {
                    continue;
                }
                String level = cols[0].trim().toUpperCase(Locale.ROOT);
                for (String key : normalizeLemma(cols[1])) {
                    if (levelByLemma.putIfAbsent(key, level) == null) {
                        added++;
                    }
                }
            }
        } catch (IOException e) {
            log.warn("[ExamSpeaking] wordlist {} unavailable ({})", resource, e.getMessage());
        }
        return added;
    }

    public int size() {
        return levelByLemma.size();
    }

    /**
     * Wortliste ghi danh từ KÈM mạo từ ("das Haus"), động từ phản thân kèm "sich", tính từ gốc kèm gạch
     * ("heutig-"). Trước bản vá 05/09 khoá tra là nguyên chuỗi → {@code levelOf("haus")} rỗng: danh từ
     * (nửa vốn từ) chưa bao giờ khớp và Wortschatz-Spektrum bị đo thấp. Trả về các khoá tra: cụm đã
     * bỏ mạo từ/sich/gạch, và từng từ ≥3 ký tự của cụm 2–3 từ; dòng lỗi (>3 từ) bị bỏ.
     */
    static java.util.List<String> normalizeLemma(String raw) {
        if (raw == null) {
            return java.util.List.of();
        }
        String s = raw.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
        s = s.replaceFirst("^(der|die|das|ein|eine|sich) ", "");
        s = s.replaceAll("-+$", "").trim();
        if (s.isEmpty()) {
            return java.util.List.of();
        }
        String[] words = s.split(" ");
        if (words.length > 3) {
            return java.util.List.of();
        }
        java.util.LinkedHashSet<String> keys = new java.util.LinkedHashSet<>();
        keys.add(s);
        if (words.length > 1) {
            for (String w : words) {
                if (w.length() >= 3) {
                    keys.add(w);
                }
            }
        }
        return java.util.List.copyOf(keys);
    }

    /** Tra lemma đúng; không có thì thử bỏ đuôi biến tố phổ biến (heuristic rẻ, đủ cho profile thống kê). */
    public Optional<String> levelOf(String token) {
        String t = token.toLowerCase(Locale.ROOT);
        String direct = levelByLemma.get(t);
        if (direct != null) {
            return Optional.of(direct);
        }
        for (String suffix : new String[]{"en", "est", "st", "es", "er", "em", "e", "n", "s", "t"}) {
            if (t.length() > suffix.length() + 2 && t.endsWith(suffix)) {
                String stem = t.substring(0, t.length() - suffix.length());
                String lv = levelByLemma.get(stem);
                if (lv != null) {
                    return Optional.of(lv);
                }
                lv = levelByLemma.get(stem + "en");
                if (lv != null) {
                    return Optional.of(lv);
                }
            }
        }
        return Optional.empty();
    }
}
