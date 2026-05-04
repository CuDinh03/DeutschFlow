package com.deutschflow.vocabulary.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guards LLM JSON → tag assignment filtering (canonical taxonomy labels only).
 */
class VocabularyAutoTaggingServiceParseResponseTest {

    @Test
    void parseResponse_stripsMarkdownFences_invalidTags_unknownKeys() {
        JdbcTemplate jdbc = Mockito.mock(JdbcTemplate.class);
        OpenAiChatClient llm = Mockito.mock(OpenAiChatClient.class);
        AiUsageLedgerService ledger = Mockito.mock(AiUsageLedgerService.class);
        TagQueryService tags = Mockito.mock(TagQueryService.class);
        TopicKeywordRuleService kw = Mockito.mock(TopicKeywordRuleService.class);

        var svc = new VocabularyAutoTaggingService(
                jdbc, llm, new ObjectMapper(), tags, kw, ledger);

        List<String> taxonomy = List.of("Reise", "Beruf");

        String raw = """
                Here is JSON:
                {"123": ["Reise", "NotATag"], "notANumber": ["Reise"], "456": ["beruf"], "777": ["Beruf"]}
                """;

        @SuppressWarnings("unchecked")
        Map<Long, List<String>> out = (Map<Long, List<String>>) ReflectionTestUtils.invokeMethod(
                svc, "parseResponse", raw, taxonomy);

        assertThat(out).containsExactly(
                Map.entry(123L, List.of("Reise")),
                Map.entry(777L, List.of("Beruf")));
    }
}
