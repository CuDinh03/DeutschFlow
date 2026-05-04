package com.deutschflow.speaking.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.deutschflow.speaking.repository.AiSpeakingSessionRepository;
import com.deutschflow.speaking.repository.AiSpeakingMessageRepository;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.deutschflow.speaking.repository.UserGrammarErrorRepository;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.ai.SystemPromptBuilder;
import com.deutschflow.speaking.ai.AiResponseParser;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.deutschflow.speaking.repository.UserErrorObservationRepository;
import com.deutschflow.speaking.repository.UserErrorSkillRepository;
import com.deutschflow.user.repository.UserLearningProgressRepository;
import com.deutschflow.user.repository.UserRepository;
import com.deutschflow.speaking.metrics.SpeakingMetrics;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.training.service.TrainingDatasetService;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@ExtendWith(MockitoExtension.class)
class AiSpeakingServiceImplUnitTest {
    @Mock com.deutschflow.speaking.repository.AiSpeakingSessionRepository sessionRepository;
    @Mock com.deutschflow.speaking.repository.AiSpeakingMessageRepository messageRepository;
    @Mock com.deutschflow.user.repository.UserLearningProfileRepository profileRepository;
    @Mock com.deutschflow.speaking.repository.UserGrammarErrorRepository grammarErrorRepository;
    @Mock com.deutschflow.speaking.ai.OpenAiChatClient openAiChatClient;
    @Mock com.deutschflow.speaking.ai.SystemPromptBuilder promptBuilder;
    @Mock com.deutschflow.speaking.ai.AiResponseParser responseParser;
    @Mock com.fasterxml.jackson.databind.ObjectMapper objectMapper;
    @Mock com.deutschflow.speaking.repository.UserErrorObservationRepository userErrorObservationRepository;
    @Mock com.deutschflow.speaking.repository.UserErrorSkillRepository userErrorSkillRepository;
    @Mock com.deutschflow.user.repository.UserLearningProgressRepository progressRepository;
    @Mock com.deutschflow.user.repository.UserRepository userRepository;
    @Mock ReviewSchedulerService reviewSchedulerService;
    @Mock com.deutschflow.speaking.metrics.SpeakingMetrics speakingMetrics;
    @Mock AdaptivePolicyService adaptivePolicyService;
    @Mock TurnEvaluatorService turnEvaluatorService;
    @Mock com.deutschflow.common.quota.QuotaService quotaService;
    @Mock com.deutschflow.common.quota.AiUsageLedgerService aiUsageLedgerService;
    @Mock com.deutschflow.training.service.TrainingDatasetService trainingDatasetService;

    @InjectMocks
    AiSpeakingServiceImpl service;

    @Test
    void serviceConstructedWithMocks() {
        assertNotNull(service);
    }
}
