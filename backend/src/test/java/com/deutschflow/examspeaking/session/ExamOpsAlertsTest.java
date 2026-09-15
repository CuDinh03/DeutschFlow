package com.deutschflow.examspeaking.session;

import com.deutschflow.examspeaking.api.model.Ergebnisbogen;
import com.deutschflow.examspeaking.api.model.ExamProvider;
import com.deutschflow.examspeaking.api.model.RubricRef;
import com.deutschflow.examspeaking.config.ExamSpeakingProperties;
import com.deutschflow.notification.service.UserNotificationService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/** F-07: cảnh báo admin khi chấm thiếu tín hiệu / job chết; throttle theo loại; lỗi gửi không lan ra luồng chấm. */
class ExamOpsAlertsTest {

    private final UserNotificationService notifications = mock(UserNotificationService.class);
    private final ExamOpsAlerts alerts = new ExamOpsAlerts(notifications,
            new ExamSpeakingProperties(false, 2, 400, 700, 1800, 0.3));

    private static Ergebnisbogen.CriterionResult c(boolean scored) {
        return new Ergebnisbogen.CriterionResult("X", "", scored ? "B" : null, scored ? 3 : 0, 4, scored, "medium", List.of());
    }

    private static Ergebnisbogen sheet(int scored, int unscored, boolean llmInvalid) {
        List<Ergebnisbogen.CriterionResult> crit = new java.util.ArrayList<>();
        for (int i = 0; i < scored; i++) crit.add(c(true));
        for (int i = 0; i < unscored; i++) crit.add(c(false));
        List<Ergebnisbogen.Msg> notes = llmInvalid ? List.of(Ergebnisbogen.Msg.of("llmInvalidTeil", "teil", 1)) : List.of();
        return new Ergebnisbogen(new RubricRef(ExamProvider.GOETHE, "B1", 1),
                List.of(new Ergebnisbogen.PartResult(1, crit, 3, 4, false, null)), List.of(),
                50, 50, 50, 100, 100, false, "", List.of(), List.of(), 2, null, notes);
    }

    @Test
    @DisplayName("dưới ngưỡng unscored và không có Teil hỏng → im lặng; ≥30% hoặc llmInvalidTeil → cảnh báo")
    void lowSignalThreshold() {
        alerts.lowSignal(1L, sheet(9, 1, false));
        verify(notifications, never()).onSystemAlert(anyString(), anyString(), anyString(), any());

        alerts.lowSignal(2L, sheet(6, 4, false));
        ArgumentCaptor<Map<String, Object>> extra = ArgumentCaptor.forClass(Map.class);
        verify(notifications).onSystemAlert(eq(ExamOpsAlerts.SOURCE), anyString(), anyString(), extra.capture());
        assertThat(extra.getValue()).containsEntry("sessionId", 2L).containsEntry("unscored", 4L).containsEntry("total", 10L);
    }

    @Test
    @DisplayName("throttle: cùng loại trong 10′ chỉ gửi một lần; loại khác vẫn gửi")
    void throttlePerKind() {
        Instant t0 = Instant.parse("2026-09-05T10:00:00Z");
        assertThat(alerts.allow("failed:JOB_FAILED", t0)).isTrue();
        assertThat(alerts.allow("failed:JOB_FAILED", t0.plusSeconds(60))).isFalse();
        assertThat(alerts.allow("failed:QUOTA_EXCEEDED", t0.plusSeconds(60))).isTrue();
        assertThat(alerts.allow("failed:JOB_FAILED", t0.plusSeconds(601))).isTrue();

        alerts.lowSignal(3L, sheet(1, 9, true));
        alerts.lowSignal(4L, sheet(1, 9, true));
        verify(notifications, times(1)).onSystemAlert(anyString(), anyString(), anyString(), any());
    }

    @Test
    @DisplayName("kênh thông báo ném lỗi → nuốt, không lan sang luồng chấm")
    void notificationFailureSwallowed() {
        doThrow(new RuntimeException("db down")).when(notifications).onSystemAlert(anyString(), anyString(), anyString(), any());
        alerts.gradingFailed(7L, 99L, "JOB_FAILED", "provider down");
        verify(notifications).onSystemAlert(anyString(), anyString(), anyString(), any());
    }
}
