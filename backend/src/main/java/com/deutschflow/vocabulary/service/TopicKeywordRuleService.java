package com.deutschflow.vocabulary.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Cheap lemma/meaning keyword overlap against topic taxonomy (before LLM).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TopicKeywordRuleService {

    private final ObjectMapper objectMapper;

    private volatile Map<String, List<String>> keywordByTag = Map.of();

    @PostConstruct
    void load() {
        ClassPathResource res = new ClassPathResource("vocabulary/topic_keyword_rules.json");
        if (!res.exists()) {
            log.warn("topic_keyword_rules.json not found — keyword pass disabled");
            return;
        }
        try {
            String raw = res.getContentAsString(StandardCharsets.UTF_8);
            keywordByTag = objectMapper.readValue(raw, new TypeReference<>() {});
            log.info("Loaded topic keyword rules for {} taxonomy tags", keywordByTag.size());
        } catch (IOException e) {
            log.error("Cannot load topic_keyword_rules.json: {}", e.getMessage());
            keywordByTag = Map.of();
        }
    }

    /**
     * Infer up to 3 taxonomy tags from German lemma + optional meaning snippet.
     */
    public List<String> inferTags(String baseForm, String meaningSnippet, Set<String> validTaxonomyTags) {
        return infer(baseForm, meaningSnippet, validTaxonomyTags, false);
    }

    /**
     * Như {@link #inferTags} nhưng từ khoá NGẮN (≤ {@value #SHORT_KEYWORD_MAX} ký tự) phải khớp nguyên một
     * từ — "ei" (Essen) không còn trúng "Zeit", "uni" không trúng "Kommunikation". Từ khoá dài vẫn khớp
     * chuỗi con để bắt từ ghép ("Fußballverein" ⇒ "verein"). Dùng cho sổ từ của học viên (13/11/2026).
     */
    public List<String> inferTagsStrict(String baseForm, String meaningSnippet, Set<String> validTaxonomyTags) {
        return infer(baseForm, meaningSnippet, validTaxonomyTags, true);
    }

    static final int SHORT_KEYWORD_MAX = 4;

    private List<String> infer(String baseForm, String meaningSnippet, Set<String> validTaxonomyTags, boolean strict) {
        Map<String, List<String>> rules = keywordByTag;
        if (rules.isEmpty() || baseForm == null || baseForm.isBlank()) {
            return List.of();
        }
        String blob = (baseForm + " " + (meaningSnippet == null ? "" : meaningSnippet))
                .toLowerCase(Locale.ROOT);
        List<String> hits = new ArrayList<>();
        for (Map.Entry<String, List<String>> e : rules.entrySet()) {
            String tagName = e.getKey();
            if (!validTaxonomyTags.contains(tagName)) {
                continue;
            }
            List<String> kws = e.getValue();
            if (kws == null) {
                continue;
            }
            for (String kw : kws) {
                if (kw == null || kw.isBlank()) {
                    continue;
                }
                String k = kw.toLowerCase(Locale.ROOT).trim();
                if (strict && k.length() <= SHORT_KEYWORD_MAX ? containsWord(blob, k) : blob.contains(k)) {
                    hits.add(tagName);
                    break;
                }
            }
        }
        return hits.stream().distinct().limit(3).toList();
    }

    /** {@code kw} xuất hiện trong {@code blob} với hai đầu không phải chữ/số. */
    static boolean containsWord(String blob, String kw) {
        int from = 0;
        while (true) {
            int i = blob.indexOf(kw, from);
            if (i < 0) return false;
            int end = i + kw.length();
            boolean leftOk = i == 0 || !Character.isLetterOrDigit(blob.charAt(i - 1));
            boolean rightOk = end == blob.length() || !Character.isLetterOrDigit(blob.charAt(end));
            if (leftOk && rightOk) return true;
            from = i + 1;
        }
    }
}
