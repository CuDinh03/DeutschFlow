package com.deutschflow.speaking.service;

import com.deutschflow.gamification.service.XpService;
import com.deutschflow.speaking.entity.AiSpeakingSession;
import com.deutschflow.speaking.entity.AiSpeakingSession.SessionStatus;
import com.deutschflow.speaking.repository.AiSpeakingSessionRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Audit speaking 24/07 — R-M7: ending an already-ended session that already has a report must NOT
 * re-run the end-of-session evaluation LLM (re-debiting quota) or re-award completion side effects.
 * The auto-close on CLOSING_FAREWELL sets ENDED at chat time WITHOUT a report, so that first real
 * end must still generate one — the guard keys on ENDED + report-present, not ENDED alone.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SessionLifecycleReEndDedupTest {

    @Mock TransactionTemplate transactionTemplate;
    @Mock AiSpeakingSessionRepository sessionRepository;
    @Mock XpService xpService;
    @Mock InterviewEvaluationService interviewEvaluationService;
    @Mock ConversationEvaluationService conversationEvaluationService;
    @Mock com.deutschflow.interview.service.InterviewDomainCoordinator interviewDomainCoordinator;
    @Mock com.deutschflow.teacher.service.TeacherAiGradingService teacherAiGradingService;

    private static final Long USER = 1L;
    private static final Long SESSION = 7L;

    private SessionLifecycleService service() {
        // Run the callback inline so loadSessionForUser executes against the mocked repository.
        when(transactionTemplate.execute(any())).thenAnswer(inv ->
                inv.getArgument(0, TransactionCallback.class).doInTransaction(null));
        return new SessionLifecycleService(transactionTemplate, sessionRepository, xpService,
                interviewEvaluationService, conversationEvaluationService,
                interviewDomainCoordinator, teacherAiGradingService);
    }

    private AiSpeakingSession session(SessionStatus status, String report) {
        AiSpeakingSession s = AiSpeakingSession.builder()
                .userId(USER).sessionMode("COMMUNICATION").status(status).build();
        s.setId(SESSION);
        s.setInterviewReportJson(report);
        return s;
    }

    @Test
    @DisplayName("already ENDED + report present → short-circuits: no LLM report, no XP, no auto-grade")
    void reEndWithReportDoesNothingExpensive() {
        AiSpeakingSession ended = session(SessionStatus.ENDED, "{\"already\":\"graded\"}");
        when(sessionRepository.findById(SESSION)).thenReturn(Optional.of(ended));

        AiSpeakingSession out = service().closeSession(USER, SESSION);

        assertThat(out).isSameAs(ended);
        verifyNoInteractions(interviewEvaluationService, conversationEvaluationService,
                teacherAiGradingService);
        verify(xpService, never()).awardSessionComplete(anyLong(), anyLong());
        // Never flipped status or saved again.
        verify(sessionRepository, never()).save(any());
    }

    @Test
    @DisplayName("ENDED but NO report yet (auto-close on CLOSING_FAREWELL) → still generates the report")
    void reEndWithoutReportStillGenerates() {
        AiSpeakingSession endedNoReport = session(SessionStatus.ENDED, null);
        when(sessionRepository.findById(SESSION)).thenReturn(Optional.of(endedNoReport));
        when(conversationEvaluationService.generateReport(any(), anyLong())).thenReturn("{\"report\":\"ok\"}");
        when(sessionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service().closeSession(USER, SESSION);

        // The first real end must still produce the report + completion side effects.
        verify(conversationEvaluationService).generateReport(any(), anyLong());
        verify(xpService).awardSessionComplete(USER, SESSION);
    }
}
