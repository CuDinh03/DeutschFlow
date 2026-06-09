package com.deutschflow.speaking.service;

import com.deutschflow.speaking.ai.AiResponseParser;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.interview.InterviewOrchestrator;
import com.deutschflow.speaking.interview.InterviewSpeechSanitizer;
import com.deutschflow.speaking.interview.InterviewStateCodec;
import com.deutschflow.speaking.metrics.SpeakingMetrics;
import com.deutschflow.speaking.repository.AiSpeakingMessageRepository;
import com.deutschflow.speaking.repository.AiSpeakingSessionRepository;
import com.deutschflow.speaking.repository.UserGrammarErrorRepository;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.concurrent.Executor;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@ExtendWith(MockitoExtension.class)
class AiSpeakingServiceImplUnitTest {
    @Mock TransactionTemplate transactionTemplate;
    @Mock AiSpeakingSessionRepository sessionRepository;
    @Mock AiSpeakingMessageRepository messageRepository;
    @Mock UserLearningProfileRepository profileRepository;
    @Mock UserGrammarErrorRepository grammarErrorRepository;
    @Mock OpenAiChatClient openAiChatClient;
    @Mock AiResponseParser responseParser;
    @Mock ObjectMapper objectMapper;
    @Mock SpeakingMetrics speakingMetrics;
    @Mock AdaptivePolicyService adaptivePolicyService;
    @Mock InterviewOrchestrator interviewOrchestrator;
    @Mock InterviewStateCodec interviewStateCodec;
    @Mock InterviewSpeechSanitizer interviewSpeechSanitizer;
    @Mock com.deutschflow.system.service.SystemConfigService systemConfigService;
    @Mock Executor speakingStreamExecutor;
    @Mock SessionLifecycleService sessionLifecycleService;
    @Mock LearningProgressService learningProgressService;
    @Mock ChatPrepService chatPrepService;
    @Mock TurnSideEffectsService turnSideEffectsService;

    @InjectMocks
    AiSpeakingServiceImpl service;

    @Test
    void serviceConstructedWithMocks() {
        assertNotNull(service);
    }
}
