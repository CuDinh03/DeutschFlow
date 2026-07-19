package com.deutschflow.notification.service;

import com.deutschflow.notification.NotificationType;
import com.deutschflow.notification.repository.UserNotificationRepository;
import com.deutschflow.notification.sse.NotificationUnreadPushCoordinator;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Method;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("NotificationAutoAckService — tự đánh dấu đã đọc theo ngữ cảnh nghiệp vụ")
class NotificationAutoAckServiceUnitTest {

    @Mock private UserNotificationRepository repository;
    @Mock private NotificationUnreadPushCoordinator coordinator;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private NotificationAutoAckService service() {
        return new NotificationAutoAckService(repository, coordinator, objectMapper);
    }

    @Test
    @DisplayName("ackByContext: khớp payload → UPDATE + đẩy SSE unread")
    void ackByContext_updatesAndPushesUnread() throws Exception {
        when(repository.markReadByContext(anyLong(), any(), any(), any())).thenReturn(2);
        Map<String, Object> match = new LinkedHashMap<>();
        match.put("assignmentId", 55L);
        match.put("studentId", 7L);

        service().ackByContext(9L, Set.of(NotificationType.QUIZ_SUBMISSION_RECEIVED), match);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Collection<String>> typesCap = ArgumentCaptor.forClass(Collection.class);
        ArgumentCaptor<String> jsonCap = ArgumentCaptor.forClass(String.class);
        verify(repository).markReadByContext(eq(9L), typesCap.capture(), jsonCap.capture(), any(LocalDateTime.class));
        assertThat(typesCap.getValue()).containsExactly("QUIZ_SUBMISSION_RECEIVED");

        // Giá trị số phải là jsonb NUMBER (không phải chuỗi) để khớp payload được ghi bằng Long.
        JsonNode json = objectMapper.readTree(jsonCap.getValue());
        assertThat(json.get("assignmentId").isNumber()).isTrue();
        assertThat(json.get("assignmentId").asLong()).isEqualTo(55L);
        assertThat(json.get("studentId").asLong()).isEqualTo(7L);

        verify(coordinator).afterCommit(9L);
    }

    @Test
    @DisplayName("ackByContext: 0 dòng khớp → KHÔNG đẩy SSE")
    void ackByContext_noRows_doesNotPush() {
        when(repository.markReadByContext(anyLong(), any(), any(), any())).thenReturn(0);

        service().ackByContext(9L, Set.of(NotificationType.NEW_MESSAGE), Map.of("senderId", 3L));

        verify(coordinator, never()).afterCommit(anyLong());
    }

    @Test
    @DisplayName("ackByContext: recipient null / types rỗng / match rỗng → no-op")
    void ackByContext_guardsNoOp() {
        service().ackByContext(null, Set.of(NotificationType.NEW_MESSAGE), Map.of("senderId", 3L));
        service().ackByContext(9L, Set.of(), Map.of("senderId", 3L));
        service().ackByContext(9L, Set.of(NotificationType.NEW_MESSAGE), Map.of());

        verifyNoInteractions(repository);
        verifyNoInteractions(coordinator);
    }

    @Test
    @DisplayName("ackByContext: repository ném lỗi → nuốt (best-effort), không đẩy SSE, không ném ngược")
    void ackByContext_repoThrows_swallowed() {
        when(repository.markReadByContext(anyLong(), any(), any(), any()))
                .thenThrow(new RuntimeException("db down"));

        // Không được ném ra ngoài.
        service().ackByContext(9L, Set.of(NotificationType.NEW_MESSAGE), Map.of("senderId", 3L));

        verify(coordinator, never()).afterCommit(anyLong());
    }

    @Test
    @DisplayName("ackByType: có dòng → UPDATE theo type + đẩy SSE")
    void ackByType_updatesAndPushes() {
        when(repository.markReadByType(anyLong(), any(), any())).thenReturn(1);

        service().ackByType(9L, Set.of(NotificationType.REVIEW_DUE, NotificationType.STREAK_REMINDER));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Collection<String>> typesCap = ArgumentCaptor.forClass(Collection.class);
        verify(repository).markReadByType(eq(9L), typesCap.capture(), any(LocalDateTime.class));
        assertThat(typesCap.getValue())
                .containsExactlyInAnyOrder("REVIEW_DUE", "STREAK_REMINDER");
        verify(coordinator).afterCommit(9L);
    }

    @Test
    @DisplayName("ackByType: 0 dòng → KHÔNG đẩy SSE")
    void ackByType_noRows_doesNotPush() {
        when(repository.markReadByType(anyLong(), any(), any())).thenReturn(0);

        service().ackByType(9L, Set.of(NotificationType.REVIEW_DUE));

        verify(coordinator, never()).afterCommit(anyLong());
    }

    // ── Propagation guard ──────────────────────────────────────────────────────
    // Cả 2 method được gọi qua RunAfterCommitService — tức từ afterCompletion của tx nghiệp vụ vừa commit.
    // Với @Transactional mặc định (REQUIRED) chúng THAM GIA tx đã hoàn tất → UPDATE không được commit và
    // SSE bắn STATUS_UNKNOWN (bị bỏ). Bắt buộc REQUIRES_NEW để mở tx vật lý mới. Unit test thường bỏ qua
    // propagation (gọi trực tiếp, không qua proxy) nên guard này chống hồi quy annotation.

    @Test
    @DisplayName("ackByContext PHẢI là @Transactional(REQUIRES_NEW)")
    void ackByContext_isRequiresNew() throws Exception {
        assertRequiresNew("ackByContext", Long.class, Set.class, Map.class);
    }

    @Test
    @DisplayName("ackByType PHẢI là @Transactional(REQUIRES_NEW)")
    void ackByType_isRequiresNew() throws Exception {
        assertRequiresNew("ackByType", Long.class, Set.class);
    }

    private static void assertRequiresNew(String methodName, Class<?>... paramTypes) throws NoSuchMethodException {
        Method m = NotificationAutoAckService.class.getMethod(methodName, paramTypes);
        Transactional tx = m.getAnnotation(Transactional.class);
        assertThat(tx).as("%s must be @Transactional", methodName).isNotNull();
        assertThat(tx.propagation())
                .as("%s must use REQUIRES_NEW (invoked after commit via RunAfterCommitService)", methodName)
                .isEqualTo(Propagation.REQUIRES_NEW);
    }
}
