package com.deutschflow.notification.service;

import com.deutschflow.notification.NotificationType;
import com.deutschflow.notification.dto.BroadcastNotificationRequest;
import com.deutschflow.notification.dto.BroadcastNotificationResponse;
import com.deutschflow.notification.dto.NotificationPageResponse;
import com.deutschflow.notification.entity.ScheduledBroadcast;
import com.deutschflow.notification.entity.UserNotification;
import com.deutschflow.notification.repository.ScheduledBroadcastRepository;
import com.deutschflow.notification.repository.UserNotificationRepository;
import com.deutschflow.notification.sse.NotificationUnreadPushCoordinator;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.springframework.data.domain.PageImpl;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserNotificationServiceUnitTest {

    @Mock UserNotificationRepository notificationRepository;
    @Mock UserRepository userRepository;
    @Mock NotificationUnreadPushCoordinator unreadPushCoordinator;
    @Mock JdbcTemplate jdbcTemplate;
    @Mock ScheduledBroadcastRepository scheduledBroadcastRepository;
    @Mock ExpoPushSenderService expoPushSenderService;
    @Spy NotificationContentRenderer contentRenderer = new NotificationContentRenderer();

    @InjectMocks
    UserNotificationService service;

    private static BroadcastNotificationRequest allAudience(String scheduledAt) {
        return new BroadcastNotificationRequest(
                null, "ALL", null, null, null,
                new BroadcastNotificationRequest.Payload("Title", "Body"),
                scheduledAt);
    }

    @Test
    @DisplayName("immediate broadcast fans out to active recipients and returns real count")
    void broadcast_immediate_deliversToActiveRecipients() {
        User active = org.mockito.Mockito.mock(User.class);
        when(active.getId()).thenReturn(42L);
        when(userRepository.findByActiveTrue()).thenReturn(List.of(active));

        BroadcastNotificationResponse response = service.broadcastToAudience(allAudience(null));

        assertThat(response.status()).isEqualTo("sent");
        assertThat(response.recipientCount()).isEqualTo(1);
        verify(notificationRepository).saveAll(any());
        verify(unreadPushCoordinator).afterCommit(42L);
        verify(scheduledBroadcastRepository, never()).save(any());
    }

    @Test
    @DisplayName("immediate broadcast sends an Expo push to recipients that have a push token")
    void broadcast_immediate_sendsExpoPush() {
        User active = org.mockito.Mockito.mock(User.class);
        when(active.getId()).thenReturn(42L);
        when(active.getPushToken()).thenReturn("ExponentPushToken[abc]");
        when(userRepository.findByActiveTrue()).thenReturn(List.of(active));

        service.broadcastToAudience(allAudience(null));

        // Regression: deliverBroadcast previously omitted the push fan-out, so admin
        // and scheduled broadcasts (which carry real title/body) never reached mobile.
        verify(expoPushSenderService).sendAsync(eq("ExponentPushToken[abc]"), eq("Title"), eq("Body"), any());
        // ...and prove the push text comes through the shared renderer, not raw payload reads.
        verify(contentRenderer).render(eq(NotificationType.ADMIN_BROADCAST), any());
    }

    @Test
    @DisplayName("push uses the SERVER-RENDERED title/body, not raw payload (LEVEL_UP: rendered != payload)")
    void insertForUser_pushesRenderedContent() {
        // LEVEL_UP payload has no title/body keys, so a passing assertion proves the renderer
        // (not the old raw-payload fallback) produced the push text.
        User user = org.mockito.Mockito.mock(User.class);
        when(user.getId()).thenReturn(7L);
        when(user.getPushToken()).thenReturn("ExponentPushToken[xyz]");
        when(notificationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("newLevel", 5);
        service.insertForUser(user, NotificationType.LEVEL_UP, payload);

        verify(expoPushSenderService).sendAsync(
                eq("ExponentPushToken[xyz]"), eq("⬆️ Lên cấp"), eq("Chúc mừng! Bạn đã lên Level 5!"), any());
    }

    @Test
    @DisplayName("listForRecipient renders server-side title/body onto each item (toDto)")
    void listForRecipient_rendersTitleBody() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("newLevel", 5);
        UserNotification row = UserNotification.builder()
                .id(1L)
                .recipient(org.mockito.Mockito.mock(User.class))
                .type(NotificationType.LEVEL_UP)
                .payload(payload)
                .createdAt(LocalDateTime.of(2026, 7, 1, 8, 0))
                .build();
        when(notificationRepository.findByRecipient_IdOrderByIdDesc(eq(1L), any()))
                .thenReturn(new PageImpl<>(List.of(row)));

        NotificationPageResponse resp = service.listForRecipient(1L, 0, 20, false);

        assertThat(resp.items()).hasSize(1);
        assertThat(resp.items().get(0).title()).isEqualTo("⬆️ Lên cấp");
        assertThat(resp.items().get(0).body()).isEqualTo("Chúc mừng! Bạn đã lên Level 5!");
        assertThat(resp.items().get(0).read()).isFalse();
    }

    @Test
    @DisplayName("broadcast with no matching recipients reports no_recipients")
    void broadcast_noRecipients_reportsStatus() {
        when(userRepository.findByActiveTrue()).thenReturn(List.of());

        BroadcastNotificationResponse response = service.broadcastToAudience(allAudience(null));

        assertThat(response.status()).isEqualTo("no_recipients");
        assertThat(response.recipientCount()).isZero();
        verify(notificationRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("future scheduledAt persists a PENDING ScheduledBroadcast instead of delivering")
    void broadcast_futureScheduledAt_isQueued() {
        String future = OffsetDateTime.now(ZoneOffset.UTC).plusHours(2).toString();

        BroadcastNotificationResponse response = service.broadcastToAudience(allAudience(future));

        assertThat(response.status()).isEqualTo("scheduled");
        assertThat(response.recipientCount()).isZero();
        verify(scheduledBroadcastRepository).save(any(ScheduledBroadcast.class));
        verify(notificationRepository, never()).saveAll(any());
        verify(userRepository, never()).findByActiveTrue();
    }

    @Test
    @DisplayName("past scheduledAt is delivered immediately, not queued")
    void broadcast_pastScheduledAt_deliversImmediately() {
        String past = OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(5).toString();
        User active = org.mockito.Mockito.mock(User.class);
        when(active.getId()).thenReturn(7L);
        when(userRepository.findByActiveTrue()).thenReturn(List.of(active));

        BroadcastNotificationResponse response = service.broadcastToAudience(allAudience(past));

        assertThat(response.status()).isEqualTo("sent");
        verify(scheduledBroadcastRepository, never()).save(any());
    }

    // ── v1.7 admin ops & audit notifications ─────────────────────────────

    private User activeAdmin(long id) {
        User admin = org.mockito.Mockito.mock(User.class);
        when(admin.isActive()).thenReturn(true);
        when(admin.getRole()).thenReturn(User.Role.ADMIN);
        when(admin.getId()).thenReturn(id);
        return admin;
    }

    /** One active admin recipient + pass-through save, shared by the audit-notification tests. */
    private void stubOneAdmin(long id) {
        User admin = activeAdmin(id); // build (and stub) the admin BEFORE the enclosing when(...)
        when(userRepository.findActiveIdsByRole("ADMIN")).thenReturn(List.of(id));
        when(userRepository.findById(id)).thenReturn(Optional.of(admin));
        when(notificationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    private UserNotification captureSaved() {
        ArgumentCaptor<UserNotification> cap = ArgumentCaptor.forClass(UserNotification.class);
        verify(notificationRepository).save(cap.capture());
        return cap.getValue();
    }

    @Test
    @DisplayName("onAccountProvisioned records the creation source (via) and notifies admins")
    void onAccountProvisioned_setsViaAndNotifiesAdmins() {
        stubOneAdmin(1L);

        service.onAccountProvisioned(42L, "new@x.com", "New User", "ADMIN");

        UserNotification saved = captureSaved();
        assertThat(saved.getType()).isEqualTo(NotificationType.USER_REGISTERED);
        assertThat(saved.getPayload())
                .containsEntry("via", "ADMIN")
                .containsEntry("email", "new@x.com")
                .containsEntry("newStudentId", 42L);
    }

    @Test
    @DisplayName("onAccountDeleted inserts ACCOUNT_DELETED for each active admin")
    void onAccountDeleted_notifiesAdmins() {
        stubOneAdmin(1L);

        service.onAccountDeleted(99L, "gone@x.com", "Gone");

        UserNotification saved = captureSaved();
        assertThat(saved.getType()).isEqualTo(NotificationType.ACCOUNT_DELETED);
        assertThat(saved.getPayload()).containsEntry("email", "gone@x.com");
    }

    @Test
    @DisplayName("onLearnerSubscriptionEnded resolves the learner email and notifies admins")
    void onLearnerSubscriptionEnded_notifiesAdmins() {
        stubOneAdmin(1L);
        User learner = org.mockito.Mockito.mock(User.class);
        when(learner.getEmail()).thenReturn("learner@x.com");
        when(userRepository.findById(99L)).thenReturn(Optional.of(learner));

        service.onLearnerSubscriptionEnded(99L, "PRO", "EXPIRED");

        UserNotification saved = captureSaved();
        assertThat(saved.getType()).isEqualTo(NotificationType.ADMIN_LEARNER_SUBSCRIPTION_ENDED);
        assertThat(saved.getPayload())
                .containsEntry("planCode", "PRO")
                .containsEntry("reason", "EXPIRED")
                .containsEntry("learnerEmail", "learner@x.com");
    }

    @Test
    @DisplayName("onSystemAlert inserts ADMIN_SYSTEM_ALERT with source + extra context")
    void onSystemAlert_notifiesAdmins() {
        stubOneAdmin(1L);

        service.onSystemAlert("AI_GRADING", "AI chấm bài thất bại", "Kiểm tra LLM.",
                Map.of("submissionId", 7L));

        UserNotification saved = captureSaved();
        assertThat(saved.getType()).isEqualTo(NotificationType.ADMIN_SYSTEM_ALERT);
        assertThat(saved.getPayload())
                .containsEntry("source", "AI_GRADING")
                .containsEntry("submissionId", 7L);
    }

    @Test
    @DisplayName("onOrgInvoicePaid inserts ADMIN_ORG_INVOICE_PAID with the amount")
    void onOrgInvoicePaid_notifiesAdmins() {
        stubOneAdmin(1L);

        service.onOrgInvoicePaid(5L, "ABC", "DFINV-1", 2_500_000L);

        UserNotification saved = captureSaved();
        assertThat(saved.getType()).isEqualTo(NotificationType.ADMIN_ORG_INVOICE_PAID);
        assertThat(saved.getPayload())
                .containsEntry("orgName", "ABC")
                .containsEntry("amountVnd", 2_500_000L);
    }

    @Test
    @DisplayName("no active admins → nothing is inserted")
    void noAdmins_insertsNothing() {
        when(userRepository.findActiveIdsByRole("ADMIN")).thenReturn(List.of());

        service.onAccountDeleted(99L, "gone@x.com", "Gone");

        verify(notificationRepository, never()).save(any());
    }

    @Test
    @DisplayName("parseScheduledAt handles offset, offset-less, blank, and malformed input")
    void parseScheduledAt_variants() {
        LocalDateTime fromOffset = UserNotificationService.parseScheduledAt("2030-01-01T10:00:00+02:00");
        assertThat(fromOffset).isEqualTo(LocalDateTime.of(2030, 1, 1, 8, 0)); // normalized to UTC

        LocalDateTime fromLocal = UserNotificationService.parseScheduledAt("2030-01-01T08:00:00");
        assertThat(fromLocal).isEqualTo(LocalDateTime.of(2030, 1, 1, 8, 0));

        assertThat(UserNotificationService.parseScheduledAt(null)).isNull();
        assertThat(UserNotificationService.parseScheduledAt("   ")).isNull();

        assertThatThrownBy(() -> UserNotificationService.parseScheduledAt("not-a-date"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("scheduledAt");
    }
}
