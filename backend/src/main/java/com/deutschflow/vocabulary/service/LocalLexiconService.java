package com.deutschflow.vocabulary.service;

import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Từ điển cục bộ (TSV trên classpath), không gọi API. Bổ sung/ghi đè bằng cách sửa {@code wordlists/local_lexicon.tsv}.
 */
@Service
@Slf4j
public class LocalLexiconService {

    public record LocalEntry(String lemma, String vi, String en, String ipa, String exampleDe) {}

    private final Map<String, LocalEntry> byLemma = new ConcurrentHashMap<>();

    @Value("${app.vocabulary.local-lexicon.resource:wordlists/local_lexicon.tsv}")
    private String resourcePath;

    @Getter
    private int loadedEntries;

    @PostConstruct
    void load() {
        ClassPathResource res = new ClassPathResource(resourcePath);
        if (!res.exists()) {
            log.warn("Local lexicon not found at classpath:{} — lookups will be empty", resourcePath);
            return;
        }
        try (BufferedReader br = new BufferedReader(new InputStreamReader(res.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            boolean first = true;
            while ((line = br.readLine()) != null) {
                if (first) {
                    first = false;
                    if (line.toLowerCase(Locale.ROOT).startsWith("lemma")) {
                        continue;
                    }
                }
                if (line.isBlank() || line.startsWith("#")) {
                    continue;
                }
                String[] p = line.split("\t");
                if (p.length < 3) {
                    continue;
                }
                String lemma = p[0].trim();
                if (lemma.isEmpty()) {
                    continue;
                }
                String vi = p[1].trim();
                String en = p[2].trim();
                String ipa = p.length > 3 ? p[3].trim() : "";
                String ex = p.length > 4 ? p[4].trim() : "";
                String key = lemma.toLowerCase(Locale.ROOT);
                byLemma.put(key, new LocalEntry(lemma, vi, en, ipa.isEmpty() ? null : ipa, ex.isEmpty() ? null : ex));
            }
            loadedEntries = byLemma.size();
            log.info("Loaded {} entries from classpath:{}", loadedEntries, resourcePath);
        } catch (IOException e) {
            throw new IllegalStateException("Cannot read local lexicon: " + resourcePath, e);
        }
    }

    public Optional<LocalEntry> lookup(String baseForm) {
        if (baseForm == null || baseForm.isBlank()) {
            return Optional.empty();
        }
        return Optional.ofNullable(byLemma.get(baseForm.trim().toLowerCase(Locale.ROOT)));
    }
}
