package com.deutschflow.speaking.service;

import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.gamification.service.XpService;
import com.deutschflow.interview.service.InterviewDomainCoordinator;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.AiResponseDto;
import com.deutschflow.speaking.contract.SpeakingSessionMode;
import com.deutschflow.speaking.entity.AiSpeakingSession;
import com.deutschflow.speaking.interview.InterviewStateCodec;
import com.deutschflow.speaking.metrics.SpeakingMetrics;
import com.deutschflow.speaking.repository.AiSpeakingSessionRepository;
import com.deutschflow.training.service.TrainingDatasetService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * Follow-up của PR #261 (R-G2a): turn parse-fail có {@code errors=[]} GIẢ — nếu vẫn được thu vào
 * dataset training thì model sẽ học "lượt lỗi = mẫu sạch", đúng loại sai lệch mà #261 đã chặn ở
 * adaptive engine. Test chốt: chỉ {@code reliableParse} (parse STRUCTURED) mới được ghi mẫu.
 */
@ExtendWith(MockitoExtension.class)
class TurnSideEffectsServiceTest {

    @Mock private AiSpeakingSessionRepository sessionRepository;
    @Mock private SpeakingMetrics speakingMetrics;
    @Mock private GrammarPersistenceService grammarPersistenceService;
    @Mock private LearningProgressService learningProgressService;
    @Mock private TurnEvaluatorService turnEvaluatorService;
    @Mock private AiUsageLedgerService aiUsageLedgerService;
    @Mock private TrainingDatasetService trainingDatasetService;
    @Mock private XpService xpService;
    @Mock private InterviewStateCodec interviewStateCodec;
    @Mock private InterviewDomainCoordinator interviewDomainCoordinator;
    @Mock private AiSpeakingSession session;

    private TurnSideEffectsService service;

    @BeforeEach
    void setUp() {
        service = new TurnSideEffectsService(
                sessionRepository, speakingMetrics, grammarPersistenceService, learningProgressService,
                turnEvaluatorService, aiUsageLedgerService, trainingDatasetService, xpService,
                interviewStateCodec, interviewDomainCoordinator);
    }

    @Test
    @DisplayName("parse tin cậy: turn ĐƯỢC thu vào dataset training")
    void reliableParse_recordsTrainingSample() {
        service.applyTurnSideEffects(prep(), "Hallo", parsed(), true, aiResult(), 42L,
                null, null, session, "SPEAKING_CHAT");

        verify(trainingDatasetService).recordConversationTurn(
                anyLong(), anyLong(), any(), any(), anyString(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("parse-fail: turn KHÔNG lọt vào dataset training — các side effect khác vẫn chạy")
    void unreliableParse_skipsTrainingSampleButKeepsOtherSideEffects() {
        service.applyTurnSideEffects(prep(), "Hallo", parsed(), false, aiResult(), 42L,
                null, null, session, "SPEAKING_CHAT");

        verify(trainingDatasetService, never()).recordConversationTurn(
                anyLong(), anyLong(), any(), any(), anyString(), any(), any(), any(), any());
        // Turn vẫn được đánh giá (TurnEvaluator tự xử lý cờ reliableParse — #261) và lưu session.
        verify(turnEvaluatorService).recordTurn(anyLong(), anyLong(), any(), any(),
                org.mockito.ArgumentMatchers.eq(false), any());
        verify(sessionRepository).save(session);
    }

    private AiSpeakingServiceImpl.SpeakingChatPrep prep() {
        return new AiSpeakingServiceImpl.SpeakingChatPrep(
                7L, 11L, null, "system-prompt", "A2", "Alltag",
                List.of(), 800, 4, null,
                SpeakingSessionMode.COMMUNICATION, null, null, Instant.now(), null);
    }

    private AiResponseDto parsed() {
        return new AiResponseDto("Hallo!", null, null, null, null, null, List.of(),
                null, null, null, List.of(), null);
    }

    private AiChatCompletionResult aiResult() {
        // usage=null ⇒ nhánh ledger tự bỏ qua — test này chỉ chốt hợp đồng thu mẫu training.
        return new AiChatCompletionResult("{}", null, "GROQ", "openai/gpt-oss-20b");
    }
}
