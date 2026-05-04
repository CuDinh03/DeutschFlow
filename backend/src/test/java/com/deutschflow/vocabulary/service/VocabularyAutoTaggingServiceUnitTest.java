package com.deutschflow.vocabulary.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.jdbc.core.JdbcTemplate;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.deutschflow.common.quota.AiUsageLedgerService;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@ExtendWith(MockitoExtension.class)
class VocabularyAutoTaggingServiceUnitTest {
    @Mock org.springframework.jdbc.core.JdbcTemplate jdbc;
    @Mock com.deutschflow.speaking.ai.OpenAiChatClient llmClient;
    @Mock com.fasterxml.jackson.databind.ObjectMapper objectMapper;
    @Mock TagQueryService tagQueryService;
    @Mock TopicKeywordRuleService topicKeywordRuleService;
    @Mock com.deutschflow.common.quota.AiUsageLedgerService aiUsageLedgerService;

    @InjectMocks
    VocabularyAutoTaggingService service;

    @Test
    void serviceConstructedWithMocks() {
        assertNotNull(service);
    }
}
