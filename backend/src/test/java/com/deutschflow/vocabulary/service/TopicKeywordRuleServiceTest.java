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
}
