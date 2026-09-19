package com.deutschflow.user.onboarding.lifecycle;

import com.deutschflow.notification.NotificationType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Đợt 6 §4.7 — luật mốc của lifecycle là thuần (tuổi activation, giờ nhắc theo múi giờ). Sender và
 * JdbcTemplate mock; DB thật ở {@code OnboardingLifecycleDbTest}.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("OnboardingLifecycleService — cửa sổ mốc và giờ nhắc")
class OnboardingLifecycleServiceUnitTest {

    private static final ZoneId HCM = ZoneId.of("Asia/Ho_Chi_Minh");

    @Mock JdbcTemplate jdbc;
    @Mock OnboardingLifecycleSender sender;

    private OnboardingLifecycleService service() {
        return new OnboardingLifecycleService(jdbc, sender);
    }

    /** Một Instant mà giờ địa phương HCM = {@code hour}. */
    private static Instant atHcmHour(int hour) {
        return ZonedDateTime.of(2026, 9, 19, hour, 10, 0, 0, HCM).toInstant();
    }

    @Test
    @DisplayName("D0: kích hoạt ≤ 26 h gửi ngay bất kể giờ; ngoài 26 h không gửi D0")
    void d0AnyHour() {
        when(sender.sendOnce(anyLong(), anyString(), any(), any())).thenReturn(true);
        Instant now = atHcmHour(9); // không phải giờ nhắc
        int sent = service().processActivation(7L, now.minus(Duration.ofHours(2)), HCM, 18, now);
        assertThat(sent).isEqualTo(1);
        verify(sender).sendOnce(eq(7L), eq("D0"), eq(NotificationType.ONBOARDING_D0_WELCOME), any());

        int later = service().processActivation(7L, now.minus(Duration.ofHours(30)), HCM, 18, now);
        assertThat(later).isZero();
    }

    @Test
    @DisplayName("D1: 24–48 h, đúng giờ nhắc, CHƯA học lại ⇒ gửi; đã học lại ⇒ không")
    void d1OnlyWhenIdle() {
        when(sender.sendOnce(anyLong(), anyString(), any(), any())).thenReturn(true);
        Instant now = atHcmHour(20);
        Instant activated = now.minus(Duration.ofHours(30));
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq(7L), any(Timestamp.class))).thenReturn(0);
        assertThat(service().processActivation(7L, activated, HCM, 20, now)).isEqualTo(1);
        verify(sender).sendOnce(eq(7L), eq("D1"), eq(NotificationType.ONBOARDING_D1_NEXT_LESSON), any());

        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq(8L), any(Timestamp.class))).thenReturn(3);
        assertThat(service().processActivation(8L, activated, HCM, 20, now)).isZero();
        verify(sender, never()).sendOnce(eq(8L), anyString(), any(), any());
    }

    @Test
    @DisplayName("Không đúng giờ nhắc ⇒ D1/D3/D7 không gửi (D0 vẫn gửi nếu trong 26 h)")
    void reminderHourGate() {
        Instant now = atHcmHour(9);
        assertThat(service().processActivation(7L, now.minus(Duration.ofHours(30)), HCM, 20, now)).isZero();
        assertThat(service().processActivation(7L, now.minus(Duration.ofHours(80)), HCM, 20, now)).isZero();
        assertThat(service().processActivation(7L, now.minus(Duration.ofHours(170)), HCM, 20, now)).isZero();
        verify(sender, never()).sendOnce(anyLong(), anyString(), any(), any());
    }

    @Test
    @DisplayName("Giờ nhắc tính theo múi giờ người dùng: 20h Berlin ≠ 20h HCM")
    void hourIsPerUserZone() {
        when(sender.sendOnce(anyLong(), anyString(), any(), any())).thenReturn(true);
        when(jdbc.queryForObject(anyString(), eq(Integer.class), anyString(), anyLong(), any(Timestamp.class))).thenReturn(1);
        ZoneId berlin = ZoneId.of("Europe/Berlin");
        Instant now = ZonedDateTime.of(2026, 9, 19, 20, 5, 0, 0, berlin).toInstant(); // 01:05 HCM hôm sau
        Instant activated = now.minus(Duration.ofHours(80));
        assertThat(service().processActivation(7L, activated, berlin, 20, now)).isEqualTo(1);
        assertThat(service().processActivation(8L, activated, HCM, 20, now)).isZero();
    }

    @Test
    @DisplayName("D3: tin theo số ngày có học; D7: tổng kết x/7")
    void d3AndD7Copy() {
        when(sender.sendOnce(anyLong(), anyString(), any(), any())).thenReturn(true);
        when(jdbc.queryForObject(anyString(), eq(Integer.class), anyString(), anyLong(), any(Timestamp.class))).thenReturn(3);
        Instant now = atHcmHour(18);
        ArgumentCaptor<Map<String, Object>> payload = ArgumentCaptor.forClass(Map.class);

        service().processActivation(7L, now.minus(Duration.ofHours(75)), HCM, 18, now);
        verify(sender).sendOnce(eq(7L), eq("D3"), eq(NotificationType.ONBOARDING_D3_CHECKIN), payload.capture());
        assertThat(payload.getValue().get("activeDays")).isEqualTo(3);
        assertThat((String) payload.getValue().get("message")).contains("3 ngày");

        service().processActivation(9L, now.minus(Duration.ofHours(170)), HCM, 18, now);
        verify(sender).sendOnce(eq(9L), eq("D7"), eq(NotificationType.ONBOARDING_D7_SUMMARY), payload.capture());
        assertThat((String) payload.getValue().get("message")).contains("3/7 ngày");
    }

    @Test
    @DisplayName("Trial: T0 (ENDED) gửi bất kể giờ; T3 (ACTIVE) chỉ đúng giờ nhắc, câu có ngày hết hạn thật")
    void trialMessages() {
        when(sender.sendOnce(anyLong(), anyString(), any(), any())).thenReturn(true);
        Instant now = atHcmHour(9);
        Instant endsAt = ZonedDateTime.of(2026, 9, 21, 10, 0, 0, 0, HCM).toInstant();
        assertThat(service().processTrial(7L, "ENDED", endsAt, HCM, 18, now)).isEqualTo(1);
        verify(sender).sendOnce(eq(7L), eq("T0"), eq(NotificationType.TRIAL_ENDED), any());

        assertThat(service().processTrial(8L, "ACTIVE", endsAt, HCM, 18, now)).isZero();

        ArgumentCaptor<Map<String, Object>> payload = ArgumentCaptor.forClass(Map.class);
        assertThat(service().processTrial(8L, "ACTIVE", endsAt, HCM, 18, atHcmHour(18))).isEqualTo(1);
        verify(sender).sendOnce(eq(8L), eq("T3"), eq(NotificationType.TRIAL_ENDING_SOON), payload.capture());
        assertThat((String) payload.getValue().get("message")).contains("21/09/2026").doesNotContain("7 ngày");
    }

    @Test
    @DisplayName("hourOf/zoneOf: NULL hoặc lạ rơi về 18h / Asia/Ho_Chi_Minh")
    void defaults() {
        assertThat(OnboardingLifecycleService.hourOf(null)).isEqualTo(18);
        assertThat(OnboardingLifecycleService.hourOf((short) 20)).isEqualTo(20);
        assertThat(OnboardingLifecycleService.hourOf(99)).isEqualTo(18);
        assertThat(OnboardingLifecycleService.zoneOf("Europe/Berlin")).isEqualTo(ZoneId.of("Europe/Berlin"));
        assertThat(OnboardingLifecycleService.zoneOf("Mars/Olympus")).isEqualTo(HCM);
        assertThat(OnboardingLifecycleService.zoneOf(null)).isEqualTo(HCM);
    }
}
