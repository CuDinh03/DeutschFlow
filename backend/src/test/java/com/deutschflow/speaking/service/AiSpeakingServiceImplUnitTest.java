package com.deutschflow.speaking.service;

import com.deutschflow.ai.rag.service.KnowledgeBaseService;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.speaking.ai.AiResponseParser;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.ai.SystemPromptBuilder;
import com.deutschflow.speaking.interview.InterviewAnswerAnalyzer;
import com.deutschflow.speaking.interview.InterviewOrchestrator;
import com.deutschflow.speaking.interview.InterviewSpeechSanitizer;
import com.deutschflow.speaking.interview.InterviewStateCodec;
import com.deutschflow.speaking.metrics.SpeakingMetrics;
import com.deutschflow.speaking.repository.AiSpeakingMessageRepository;
import com.deutschflow.speaking.repository.AiSpeakingSessionRepository;
import com.deutschflow.speaking.repository.UserErrorObservationRepository;
import com.deutschflow.speaking.repository.UserErrorSkillRepository;
import com.deutschflow.speaking.repository.UserGrammarErrorRepository;
import com.deutschflow.gamification.service.XpService;
import com.deutschflow.teacher.service.TeacherAiGradingService;
import com.deutschflow.training.service.TrainingDatasetService;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.deutschflow.user.repository.UserLearningProgressRepository;
import com.deutschflow.user.repository.UserRepository;
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
    @Mock SystemPromptBuilder promptBuilder;
    @Mock AiResponseParser responseParser;
    @Mock ObjectMapper objectMapper;
    @Mock UserErrorObservationRepository userErrorObservationRepository;
    @Mock UserErrorSkillRepository userErrorSkillRepository;
    @Mock UserLearningProgressRepository progressRepository;
    @Mock UserRepository userRepository;
    @Mock ReviewSchedulerService reviewSchedulerService;
    @Mock SpeakingMetrics speakingMetrics;
    @Mock AdaptivePolicyService adaptivePolicyService;
    @Mock TurnEvaluatorService turnEvaluatorService;
    @Mock QuotaService quotaService;
    @Mock AiUsageLedgerService aiUsageLedgerService;
    @Mock TrainingDatasetService trainingDatasetService;
    @Mock XpService xpService;
    @Mock InterviewEvaluationService interviewEvaluationService;
    @Mock InterviewOrchestrator interviewOrchestrator;
    @Mock InterviewAnswerAnalyzer interviewAnswerAnalyzer;
    @Mock InterviewStateCodec interviewStateCodec;
    @Mock InterviewSpeechSanitizer interviewSpeechSanitizer;
    @Mock com.deutschflow.system.service.SystemConfigService systemConfigService;
    @Mock KnowledgeBaseService knowledgeBaseService;
    @Mock TeacherAiGradingService teacherAiGradingService;
    @Mock Executor speakingStreamExecutor;

    @InjectMocks
    AiSpeakingServiceImpl service;

    @Test
    void serviceConstructedWithMocks() {
        assertNotNull(service);
    }
}
