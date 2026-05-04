package com.deutschflow.speaking.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.jdbc.core.JdbcTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.ai.WeeklyRubricPromptBuilder;
import com.deutschflow.speaking.ai.WeeklyRubricParser;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.user.repository.UserLearningProfileRepository;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@ExtendWith(MockitoExtension.class)
class WeeklySpeakingServiceUnitTest {
    @Mock org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;
    @Mock com.fasterxml.jackson.databind.ObjectMapper objectMapper;
    @Mock com.deutschflow.speaking.ai.OpenAiChatClient openAiChatClient;
    @Mock com.deutschflow.speaking.ai.WeeklyRubricPromptBuilder weeklyRubricPromptBuilder;
    @Mock com.deutschflow.speaking.ai.WeeklyRubricParser weeklyRubricParser;
    @Mock com.deutschflow.common.quota.QuotaService quotaService;
    @Mock com.deutschflow.common.quota.AiUsageLedgerService aiUsageLedgerService;
    @Mock WeeklyCompanionRollupService weeklyCompanionRollupService;
    @Mock com.deutschflow.user.repository.UserLearningProfileRepository userLearningProfileRepository;

    @InjectMocks
    WeeklySpeakingService service;

    @Test
    void serviceConstructedWithMocks() {
        assertNotNull(service);
    }
}
