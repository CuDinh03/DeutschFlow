package com.deutschflow.user.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.user.dto.SessionCompleteResponse;
import com.deutschflow.user.entity.LearningPlan;
import com.deutschflow.user.entity.LearningSessionProgress;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.LearningPlanRepository;
import com.deutschflow.user.repository.LearningSessionAttemptRepository;
import com.deutschflow.user.repository.LearningSessionProgressRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * A2 (09/11/2026): {@code POST /sessions/complete} không được tin số liệu client. Mỗi buổi COMPLETED
 * = +20 XP tuần ({@code StudentDashboardService.computeWeeklyXp}), nên COMPLETED chỉ được ghi khi có
 * lần nộp đạt do server chấm, và chỉ ghi một lần.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class LearningSessionProgressServiceUnitTest {

    @Mock LearningSessionProgressRepository progressRepository;
    @Mock StoredLearningPlanSupport storedLearningPlanSupport;
    @Mock LearningSessionAttemptRepository attemptRepository;
    @Mock LearningPlanRepository planRepository;

    private LearningSessionProgressService service;
    private User user;

    private static final int WEEK = 2;
    private static final int SESSION = 3;

    @BeforeEach
    void setUp() {
        service = new LearningSessionProgressService(
                progressRepository, storedLearningPlanSupport, attemptRepository, planRepository);
        user = User.builder().email("s@test.com").passwordHash("x").displayName("S")
                .role(User.Role.STUDENT).build();
        user.setId(7L);
        LearningPlan plan = new LearningPlan();
        plan.setMinutesPerSession(20); // trần timeSeconds = 20 × 60 × 3 = 3600
        when(planRepository.findByUserId(7L)).thenReturn(Optional.of(plan));
        when(progressRepository.findByUserIdAndWeekNumberAndSessionIndex(7L, WEEK, SESSION))
                .thenReturn(Optional.empty());
        when(progressRepository.save(any(LearningSessionProgress.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private LearningSessionProgress savedProgress() {
        ArgumentCaptor<LearningSessionProgress> cap = ArgumentCaptor.forClass(LearningSessionProgress.class);
        verify(progressRepository).save(cap.capture());
        return cap.getValue();
    }

    @Test
    void completeWithoutAnySubmit_isNotCompleted_andWritesNothing() {
        when(attemptRepository.maxScorePercent(7L, WEEK, SESSION)).thenReturn(null);

        SessionCompleteResponse res = service.completeFromClient(user, WEEK, SESSION, 1.0, 600.0);

        assertThat(res.completed()).isFalse();
        assertThat(res.reason()).isEqualTo(SessionCompleteResponse.REASON_NO_PASSING_SUBMIT);
        assertThat(res.status()).isEqualTo("NOT_STARTED");
        verify(progressRepository, never()).save(any());
    }

    @Test
    void completeWithOnlyFailingSubmit_isNotCompleted_andKeepsInProgress() {
        LearningSessionProgress inProgress = LearningSessionProgress.builder()
                .user(user).weekNumber(WEEK).sessionIndex(SESSION)
                .status(LearningSessionProgress.Status.IN_PROGRESS).build();
        when(progressRepository.findByUserIdAndWeekNumberAndSessionIndex(7L, WEEK, SESSION))
                .thenReturn(Optional.of(inProgress));
        when(attemptRepository.maxScorePercent(7L, WEEK, SESSION)).thenReturn(59);

        SessionCompleteResponse res = service.completeFromClient(user, WEEK, SESSION, 100.0, 600.0);

        assertThat(res.completed()).isFalse();
        assertThat(res.status()).isEqualTo("IN_PROGRESS");
        assertThat(res.scorePercent()).isEqualTo(59);
        assertThat(inProgress.getStatus()).isEqualTo(LearningSessionProgress.Status.IN_PROGRESS);
        verify(progressRepository, never()).save(any());
    }

    @Test
    void completeWithPassingSubmit_ignoresClientAbilityScore_usesServerScore() {
        when(attemptRepository.maxScorePercent(7L, WEEK, SESSION)).thenReturn(80);

        SessionCompleteResponse res = service.completeFromClient(user, WEEK, SESSION, 9999.0, 900.0);

        assertThat(res.completed()).isTrue();
        assertThat(res.reason()).isEqualTo(SessionCompleteResponse.REASON_COMPLETED);
        LearningSessionProgress p = savedProgress();
        assertThat(p.getStatus()).isEqualTo(LearningSessionProgress.Status.COMPLETED);
        assertThat(p.getAbilityScore()).isEqualTo(80.0); // NOT the client's 9999
        assertThat(p.getTimeSeconds()).isEqualTo(900.0);
        assertThat(p.getCompletedAt()).isNotNull();
    }

    @Test
    void timeSeconds_isClampedToZeroAndThreeTimesSessionDuration() {
        when(attemptRepository.maxScorePercent(7L, WEEK, SESSION)).thenReturn(100);

        SessionCompleteResponse tooLong = service.completeFromClient(user, WEEK, SESSION, null, 999_999.0);
        assertThat(tooLong.timeSeconds()).isEqualTo(3600.0);

        assertThat(LearningSessionProgressService.clampTimeSeconds(-50.0, 20)).isEqualTo(0.0);
        assertThat(LearningSessionProgressService.clampTimeSeconds(0.0, 20)).isEqualTo(0.0);
        assertThat(LearningSessionProgressService.clampTimeSeconds(1200.0, 20)).isEqualTo(1200.0);
        assertThat(LearningSessionProgressService.clampTimeSeconds(null, 20)).isNull();
        assertThat(LearningSessionProgressService.clampTimeSeconds(Double.NaN, 20)).isNull();
    }

    @Test
    void timeSecondsCap_fallsBackToDefaultDuration_whenPlanMissing() {
        when(planRepository.findByUserId(7L)).thenReturn(Optional.empty());
        when(attemptRepository.maxScorePercent(7L, WEEK, SESSION)).thenReturn(100);

        SessionCompleteResponse res = service.completeFromClient(user, WEEK, SESSION, null, 999_999.0);

        assertThat(res.timeSeconds())
                .isEqualTo(LearningSessionProgressService.DEFAULT_SESSION_MINUTES * 60.0 * 3);
    }

    @Test
    void completeTwice_writesOnce_andKeepsCompletedAt_soWeeklyXpIsAwardedOnce() {
        when(attemptRepository.maxScorePercent(7L, WEEK, SESSION)).thenReturn(100);

        SessionCompleteResponse first = service.completeFromClient(user, WEEK, SESSION, null, 600.0);
        LearningSessionProgress stored = savedProgress();
        LocalDateTime firstCompletedAt = stored.getCompletedAt();
        when(progressRepository.findByUserIdAndWeekNumberAndSessionIndex(7L, WEEK, SESSION))
                .thenReturn(Optional.of(stored));

        SessionCompleteResponse second = service.completeFromClient(user, WEEK, SESSION, 50.0, 3000.0);

        assertThat(first.reason()).isEqualTo(SessionCompleteResponse.REASON_COMPLETED);
        assertThat(second.completed()).isTrue();
        assertThat(second.reason()).isEqualTo(SessionCompleteResponse.REASON_ALREADY_COMPLETED);
        verify(progressRepository, times(1)).save(any());
        // completed_at không dời → dashboard không đếm buổi này vào tuần khác (+20 XP lần hai).
        assertThat(stored.getCompletedAt()).isEqualTo(firstCompletedAt);
        assertThat(stored.getTimeSeconds()).isEqualTo(600.0);
    }

    @Test
    void markCompletedByServer_isIdempotent() {
        LearningSessionProgress done = LearningSessionProgress.builder()
                .user(user).weekNumber(WEEK).sessionIndex(SESSION)
                .status(LearningSessionProgress.Status.COMPLETED)
                .completedAt(LocalDateTime.of(2026, 11, 1, 10, 0)).build();
        when(progressRepository.findByUserIdAndWeekNumberAndSessionIndex(7L, WEEK, SESSION))
                .thenReturn(Optional.of(done));

        service.markCompletedByServer(user, WEEK, SESSION, 100);

        verify(progressRepository, never()).save(any());
        assertThat(done.getCompletedAt()).isEqualTo(LocalDateTime.of(2026, 11, 1, 10, 0));
    }

    @Test
    void markCompletedByServer_firstTime_storesServerScore() {
        service.markCompletedByServer(user, WEEK, SESSION, 100);

        LearningSessionProgress p = savedProgress();
        assertThat(p.getStatus()).isEqualTo(LearningSessionProgress.Status.COMPLETED);
        assertThat(p.getAbilityScore()).isEqualTo(100.0);
    }

    @Test
    void invalidWeekOrSession_isRejected() {
        assertThatThrownBy(() -> service.completeFromClient(user, 0, 1, null, null))
                .isInstanceOf(BadRequestException.class);
    }
}
