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
    private final Map<String, String> levelByLemma = new HashMap<>();

    @PostConstruct
    public void load() {
        try (BufferedReader br = new BufferedReader(new InputStreamReader(
                new ClassPathResource(RESOURCE).getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            boolean header = true;
            while ((line = br.readLine()) != null) {
                if (header) {
                    header = false;
                    continue;
                }
                String[] cols = line.split("\t");
                if (cols.length < 2) {
                    continue;
                }
                String lemma = cols[1].trim().toLowerCase(Locale.ROOT);
                String level = cols[0].trim().toUpperCase(Locale.ROOT);
                if (!lemma.isEmpty()) {
                    levelByLemma.putIfAbsent(lemma, level);
                }
            }
            log.info("[ExamSpeaking] Goethe wordlist loaded: {} lemmas", levelByLemma.size());
        } catch (IOException e) {
            log.warn("[ExamSpeaking] Goethe wordlist unavailable ({}): lexical profiling degrades to TTR only", e.getMessage());
        }
    }

    public int size() {
        return levelByLemma.size();
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
