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
import static org.mockito.ArgumentMatchers.contains;
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
    @Spy com.fasterxml.jackson.databind.ObjectMapper objectMapper = new com.fasterxml.jackson.databind.ObjectMapper();
    /** Guard THẬT (mỗi test một instance mới → cửa sổ sạch) — mock trả false mặc định sẽ chặn nhầm mọi lượt gửi. */
    @Spy BroadcastDedupeGuard dedupeGuard = new BroadcastDedupeGuard(300);

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

    // ── C1/F-M9 + R-M6: cửa sổ chống gửi-trùng ─────────────────────────────────────

    @Test
    @DisplayName("C1: broadcast giống hệt lần hai trong cửa sổ dedupe → 409, KHÔNG fan-out lần nữa")
    void broadcast_duplicateWithinWindow_throwsConflict() {
        User active = org.mockito.Mockito.mock(User.class);
        when(active.getId()).thenReturn(42L);
        when(userRepository.findByActiveTrue()).thenReturn(List.of(active));

        service.broadcastToAudience(allAudience(null)); // lượt đầu: gửi thật

        assertThatThrownBy(() -> service.broadcastToAudience(allAudience(null)))
                .isInstanceOf(com.deutschflow.common.exception.ConflictException.class)
                .hasMessageContaining("trùng lặp");
        // Fan-out chỉ xảy ra ĐÚNG MỘT lần — double-click không thành hai lượt push toàn hệ.
        verify(notificationRepository, org.mockito.Mockito.times(1)).saveAll(any());
    }

    @Test
    @DisplayName("R-M6: cùng (windowId, kind) bảo trì lần hai trong cửa sổ → bỏ qua ÊM (trả 0, không ném)")
    void maintenanceBroadcast_duplicateWindowKind_skipsSilently() {
        User active = org.mockito.Mockito.mock(User.class);
        when(active.getId()).thenReturn(42L);
        when(userRepository.findByActiveTrue()).thenReturn(List.of(active));
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("kind", "UPDATED");
        payload.put("windowId", 7L);
        payload.put("title", "Bảo trì hệ thống");

        int first = service.broadcastSystemMaintenance(payload, false);
        int second = service.broadcastSystemMaintenance(payload, false);

        assertThat(first).isEqualTo(1);
        assertThat(second).isZero(); // PATCH đổi giờ liên tiếp không thành chuỗi push lặp
        verify(notificationRepository, org.mockito.Mockito.times(1)).saveAll(any());
    }

    @Test
    @DisplayName("R-M6: kind khác nhau của cùng window là các mốc vòng đời — không chặn lẫn nhau")
    void maintenanceBroadcast_differentKinds_bothSend() {
        User active = org.mockito.Mockito.mock(User.class);
        when(active.getId()).thenReturn(42L);
        when(userRepository.findByActiveTrue()).thenReturn(List.of(active));
        Map<String, Object> scheduled = new LinkedHashMap<>(Map.of("kind", "SCHEDULED", "windowId", 7L, "title", "T"));
        Map<String, Object> updated = new LinkedHashMap<>(Map.of("kind", "UPDATED", "windowId", 7L, "title", "T"));

        assertThat(service.broadcastSystemMaintenance(scheduled, false)).isEqualTo(1);
        assertThat(service.broadcastSystemMaintenance(updated, false)).isEqualTo(1);
        verify(notificationRepository, org.mockito.Mockito.times(2)).saveAll(any());
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
        // B3: fan-out đi qua Expo batch API — một sendBatchAsync mang message đã render.
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ExpoPushSenderService.PushMessage>> pushCaptor =
                ArgumentCaptor.forClass((Class) List.class);
        verify(expoPushSenderService).sendBatchAsync(pushCaptor.capture());
        assertThat(pushCaptor.getValue()).singleElement().satisfies(msg -> {
            assertThat(msg.token()).isEqualTo("ExponentPushToken[abc]");
            assertThat(msg.title()).isEqualTo("Title");
            assertThat(msg.body()).isEqualTo("Body");
        });
        // ...and prove the push text comes through the shared renderer, not raw payload reads.
        verify(contentRenderer).render(eq(NotificationType.ADMIN_BROADCAST), any());
    }

    @Test
    @DisplayName("B3: fan-out cả lớp = MỘT findAllById + MỘT sendBatchAsync (không sendAsync lẻ nào)")
    void classFanOut_batchesRecipientLoadAndPush() {
        when(jdbcTemplate.queryForList(contains("class_students"), eq(Long.class), eq(10L)))
                .thenReturn(List.of(200L, 300L));
        when(jdbcTemplate.queryForList(contains("class_teachers"), eq(Long.class), eq(10L)))
                .thenReturn(List.of());
        User u200 = activeUser(200L);
        when(u200.getPushToken()).thenReturn("ExponentPushToken[a]");
        User u300 = activeUser(300L);
        when(u300.getPushToken()).thenReturn("ExponentPushToken[b]");
        when(userRepository.findAllById(any())).thenReturn(List.of(u200, u300));

        service.notifyClassChannelMessage(10L, "A1", 100L, "An", "hi");

        verify(userRepository, org.mockito.Mockito.times(1)).findAllById(any());
        verify(userRepository, never()).findById(any());
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ExpoPushSenderService.PushMessage>> pushCaptor =
                ArgumentCaptor.forClass((Class) List.class);
        verify(expoPushSenderService, org.mockito.Mockito.times(1)).sendBatchAsync(pushCaptor.capture());
        assertThat(pushCaptor.getValue()).hasSize(2);
        verify(expoPushSenderService, never()).sendAsync(any(), any(), any(), any());
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
    @DisplayName("notifyClassChannelMessage fans out to every OTHER active member (students + teachers), excluding the sender")
    void notifyClassChannelMessage_fansOutExcludingSender() {
        long senderId = 100L;
        when(jdbcTemplate.queryForList(contains("class_students"), eq(Long.class), eq(10L)))
                .thenReturn(List.of(100L, 200L, 300L));
        when(jdbcTemplate.queryForList(contains("class_teachers"), eq(Long.class), eq(10L)))
                .thenReturn(List.of(5L));
        // Build the recipient mocks BEFORE stubbing findAllById — activeUser() itself calls when(),
        // and nesting that inside a when(...).thenReturn(...) argument trips Mockito's strict
        // UnfinishedStubbing check. B3: fan-out nạp người nhận bằng MỘT findAllById.
        User u200 = activeUser(200L);
        User u300 = activeUser(300L);
        User u5 = activeUser(5L);
        when(userRepository.findAllById(any())).thenReturn(List.of(u200, u300, u5));

        service.notifyClassChannelMessage(10L, "A1 Sáng", senderId, "An", "chào cả lớp");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<UserNotification>> captor = ArgumentCaptor.forClass(List.class);
        verify(notificationRepository).saveAll(captor.capture());
        List<Long> recipientIds = captor.getValue().stream().map(n -> n.getRecipient().getId()).toList();
        assertThat(recipientIds).containsExactlyInAnyOrder(200L, 300L, 5L);
        assertThat(recipientIds).doesNotContain(senderId);
        assertThat(captor.getValue()).allSatisfy(n -> {
            assertThat(n.getType()).isEqualTo(NotificationType.CLASS_CHANNEL_MESSAGE);
            assertThat(n.getPayload()).containsEntry("className", "A1 Sáng");
            assertThat(n.getPayload()).containsEntry("preview", "chào cả lớp");
        });
    }

    @Test
    @DisplayName("notifyClassChannelMessage with no other members inserts nothing")
    void notifyClassChannelMessage_soleMember_insertsNothing() {
        when(jdbcTemplate.queryForList(contains("class_students"), eq(Long.class), eq(10L)))
                .thenReturn(List.of(100L));
        when(jdbcTemplate.queryForList(contains("class_teachers"), eq(Long.class), eq(10L)))
                .thenReturn(List.of());

        service.notifyClassChannelMessage(10L, "A1", 100L, "An", "hi");

        verify(notificationRepository, never()).saveAll(any());
    }

    private static User activeUser(long id) {
        User u = org.mockito.Mockito.mock(User.class);
        when(u.getId()).thenReturn(id);
        when(u.isActive()).thenReturn(true);
        return u;
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

    // ── F-QA-01: chấm lại không phát thêm thông báo — cập nhật tại chỗ ───

    @Test
    @DisplayName("F-QA-01: onAssignmentRegraded cập nhật TẠI CHỖ dòng cũ — không insert dòng mới, không push Expo")
    void onAssignmentRegraded_refreshesInPlace_noNewRowNoPush() {
        User student = org.mockito.Mockito.mock(User.class);
        when(student.isActive()).thenReturn(true);
        when(userRepository.findById(200L)).thenReturn(Optional.of(student));
        when(notificationRepository.refreshLatestByContext(eq(200L), eq("ASSIGNMENT_GRADED"), any(), any()))
                .thenReturn(1);

        service.onAssignmentRegraded(200L, "ASSIGNMENT", 10L, 90, "sửa lại");

        ArgumentCaptor<String> matchCap = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> payloadCap = ArgumentCaptor.forClass(String.class);
        verify(notificationRepository).refreshLatestByContext(
                eq(200L), eq("ASSIGNMENT_GRADED"), matchCap.capture(), payloadCap.capture());
        // Khớp đúng bài (type + referenceId), payload mới mang điểm hiện tại + cờ updated.
        assertThat(matchCap.getValue()).contains("\"assignmentType\":\"ASSIGNMENT\"").contains("\"referenceId\":10");
        assertThat(payloadCap.getValue()).contains("\"score\":90").contains("\"updated\":true");
        // Không có dòng mới (hết spam 3-tin/1-phút), không push Expo cho lần sửa — chỉ badge SSE.
        verify(notificationRepository, never()).save(any());
        verify(expoPushSenderService, never()).sendAsync(any(), any(), any(), any());
        verify(unreadPushCoordinator).afterCommit(200L);
    }

    @Test
    @DisplayName("F-QA-01: hộp thư không còn dòng của bài → onAssignmentRegraded chèn MỘT dòng 'đã cập nhật' (kèm push copy mới)")
    void onAssignmentRegraded_noPriorRow_insertsSingleUpdatedRow() {
        User student = activeUser(200L);
        when(student.getPushToken()).thenReturn("ExponentPushToken[r]");
        when(userRepository.findById(200L)).thenReturn(Optional.of(student));
        when(notificationRepository.refreshLatestByContext(eq(200L), eq("ASSIGNMENT_GRADED"), any(), any()))
                .thenReturn(0);
        when(notificationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.onAssignmentRegraded(200L, "ASSIGNMENT", 10L, 90, "sửa lại");

        UserNotification saved = captureSaved();
        assertThat(saved.getType()).isEqualTo(NotificationType.ASSIGNMENT_GRADED);
        assertThat(saved.getPayload())
                .containsEntry("referenceId", 10L)
                .containsEntry("score", 90)
                .containsEntry("updated", true);
        // Push (nếu có token) phải mang copy regrade, không phải "✅ Bài đã chấm" lần nữa.
        verify(expoPushSenderService).sendAsync(
                eq("ExponentPushToken[r]"),
                eq("🔄 Điểm đã được cập nhật"),
                eq("Điểm bài tập của bạn đã được cập nhật — Điểm: 90. Xem phản hồi."),
                any());
    }

    @Test
    @DisplayName("F-QA-01: học viên không còn active → onAssignmentRegraded không làm gì")
    void onAssignmentRegraded_inactiveStudent_doesNothing() {
        User student = org.mockito.Mockito.mock(User.class);
        when(student.isActive()).thenReturn(false);
        when(userRepository.findById(200L)).thenReturn(Optional.of(student));

        service.onAssignmentRegraded(200L, "ASSIGNMENT", 10L, 90, "sửa lại");

        verify(notificationRepository, never()).refreshLatestByContext(org.mockito.ArgumentMatchers.anyLong(), any(), any(), any());
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
