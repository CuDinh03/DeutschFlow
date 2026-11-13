package com.deutschflow.vocabulary.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class TopicKeywordRuleServiceTest {

    private TopicKeywordRuleService svc;

    @BeforeEach
    void setUp() {
        svc = new TopicKeywordRuleService(new ObjectMapper());
        ReflectionTestUtils.invokeMethod(svc, "load");
    }

    @Test
    void inferTags_matchesGermanStemInLemma() {
        Set<String> tax = Set.of("Reise", "Beruf");
        assertThat(svc.inferTags("Am Bahnhof warten.", "", tax)).containsExactly("Reise");
    }

    @Test
    void inferTags_matchesKeywordInMeaningSnippet() {
        Set<String> tax = Set.of("Essen");
        assertThat(svc.inferTags("Treffen", "Wir gehen ins Restaurant.", tax)).containsExactly("Essen");
    }

    @Test
    void inferTagsStrict_shortKeywordNeedsWholeWord() {
        Set<String> tax = Set.of("Essen", "Bildung", "Freizeit");
        // "ei" (Essen) nằm trong "Zeit" — bản cũ trúng nhầm, bản chặt thì không
        assertThat(svc.inferTags("Zeit", "thời gian", tax)).contains("Essen");
        assertThat(svc.inferTagsStrict("Zeit", "thời gian", tax)).isEmpty();
        assertThat(svc.inferTagsStrict("Kommunikation", "", tax)).isEmpty();      // "uni"
        // từ khoá ngắn đứng riêng vẫn trúng; từ khoá dài vẫn bắt từ ghép
        assertThat(svc.inferTagsStrict("Ei", "quả trứng", tax)).containsExactly("Essen");
        assertThat(svc.inferTagsStrict("Fußballverein", "", tax)).containsExactly("Freizeit");
    }
}
