package com.deutschflow.speaking.service;

import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.AiParseOutcome;
import com.deutschflow.speaking.ai.AiParseStatus;
import com.deutschflow.speaking.ai.AiResponseParser;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.dto.AiSpeakingChatResponse;
import com.deutschflow.speaking.interview.InterviewOrchestrator;
import com.deutschflow.speaking.interview.InterviewStateCodec;
import com.deutschflow.speaking.metrics.SpeakingMetrics;
import com.deutschflow.speaking.repository.AiSpeakingMessageRepository;
import com.deutschflow.speaking.repository.AiSpeakingSessionRepository;
import com.deutschflow.speaking.repository.UserGrammarErrorRepository;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
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
    @Mock AdaptiveEngineService adaptiveEngineService;
    @Mock ConversationEvaluationService conversationEvaluationService;
    @Mock InterviewOrchestrator interviewOrchestrator;
    @Mock InterviewStateCodec interviewStateCodec;
    @Mock com.deutschflow.system.service.SystemConfigService systemConfigService;
    @Mock SessionTurnGuard sessionTurnGuard;
    @Mock com.deutschflow.interview.service.InterviewDomainCoordinator interviewDomainCoordinator;
    @Mock SessionLifecycleService sessionLifecycleService;
    @Mock LearningProgressService learningProgressService;
    @Mock ChatPrepService chatPrepService;
    @Mock TurnSideEffectsService turnSideEffectsService;
    @Mock ChatCompletionService chatCompletionService;
    @Mock SpeakingStreamService speakingStreamService;
    @Mock SpeakingChatIdempotencyService chatIdempotencyService;

    @InjectMocks
    AiSpeakingServiceImpl service;

    private static AiSpeakingChatResponse response(String speech) {
        return new AiSpeakingChatResponse(
                42L, 7L, speech, null, null, null, null,
                List.of(), null, null, null, null, List.of(),
                "V1", null, false, null, null);
    }

    // ── R-M5 ordering invariants (locked after the SP-D adversarial review) ──

    @Test
    @DisplayName("idempotency hit → replays cached, NEVER touches turn-guard / prep / LLM / remember")
    void idempotentReplayShortCircuitsBeforeEverything() {
        AiSpeakingChatResponse cached = response("Guten Tag (cached)");
        when(chatIdempotencyService.lookup(1L, 7L, "t-x-1")).thenReturn(Optional.of(cached));

        AiSpeakingChatResponse out = service.chat(1L, 7L, "Hallo", "t-x-1");

        assertThat(out).isSameAs(cached);
        // The whole point: a replay costs nothing downstream of the lookup (no LLM, no quota, no
        // org-token reservation which lives inside prepareSpeakingChatTurn).
        verify(sessionTurnGuard, never()).tryAcquire(anyLong());
        verifyNoInteractions(chatPrepService, chatCompletionService);
        verify(chatIdempotencyService, never()).remember(anyLong(), anyLong(), any(), any());
    }

    @Test
    @DisplayName("lost the turn-guard race (409) → NEVER releases the in-flight holder's lock")
    void failedAcquireDoesNotReleaseSomeoneElsesLock() {
        when(chatIdempotencyService.lookup(1L, 7L, "t-x-1")).thenReturn(Optional.empty());
        when(sessionTurnGuard.tryAcquire(7L)).thenReturn(false); // another request holds it

        assertThatThrownBy(() -> service.chat(1L, 7L, "Hallo", "t-x-1"))
                .isInstanceOf(ConflictException.class);

        // Releasing here would wipe the OTHER caller's lock → concurrent double-charge.
        verify(sessionTurnGuard, never()).release(anyLong());
    }

    @Test
    @DisplayName("successful turn → caches the response for replay AND releases only the lock it took")
    void successRemembersAndReleasesOwnLock() {
        when(chatIdempotencyService.lookup(1L, 7L, "t-x-1")).thenReturn(Optional.empty());
        when(sessionTurnGuard.tryAcquire(7L)).thenReturn(true);

        // chatInner: prep TX → prep, LLM, parse, finalize TX → response. Mock the two TX executes to
        // return canned values so we exercise chat()'s orchestration without the full persistence chain.
        var prep = org.mockito.Mockito.mock(AiSpeakingServiceImpl.SpeakingChatPrep.class);
        AiSpeakingChatResponse produced = response("Hallo!");
        when(transactionTemplate.execute(any(TransactionCallback.class))).thenReturn(prep, produced);
        when(chatCompletionService.runChatCompletion(prep))
                .thenReturn(org.mockito.Mockito.mock(AiChatCompletionResult.class));
        when(chatCompletionService.parseAndPostProcess(any(), eq("Hallo"), eq(prep)))
                .thenReturn(new AiParseOutcome(null, AiParseStatus.STRUCTURED));

        AiSpeakingChatResponse out = service.chat(1L, 7L, "Hallo", "t-x-1");

        assertThat(out).isSameAs(produced);
        verify(chatIdempotencyService).remember(1L, 7L, "t-x-1", produced);
        verify(sessionTurnGuard, times(1)).release(7L);
    }

    @Test
    @DisplayName("null clientTurnId (legacy client) still runs the turn normally")
    void nullClientTurnIdRunsNormally() {
        when(chatIdempotencyService.lookup(1L, 7L, null)).thenReturn(Optional.empty());
        when(sessionTurnGuard.tryAcquire(7L)).thenReturn(true);
        var prep = org.mockito.Mockito.mock(AiSpeakingServiceImpl.SpeakingChatPrep.class);
        when(transactionTemplate.execute(any(TransactionCallback.class))).thenReturn(prep, response("ok"));
        when(chatCompletionService.runChatCompletion(prep))
                .thenReturn(org.mockito.Mockito.mock(AiChatCompletionResult.class));
        when(chatCompletionService.parseAndPostProcess(any(), any(), eq(prep)))
                .thenReturn(new AiParseOutcome(null, AiParseStatus.STRUCTURED));

        service.chat(1L, 7L, "Hallo", null);

        verify(sessionTurnGuard, times(1)).tryAcquire(7L);
        verify(sessionTurnGuard, times(1)).release(7L);
    }
}
