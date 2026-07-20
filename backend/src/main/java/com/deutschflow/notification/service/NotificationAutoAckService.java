package com.deutschflow.notification.service;

import com.deutschflow.notification.NotificationType;
import com.deutschflow.notification.repository.UserNotificationRepository;
import com.deutschflow.notification.sse.NotificationUnreadPushCoordinator;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Đánh dấu ĐÃ ĐỌC thông báo theo NGỮ CẢNH NGHIỆP VỤ, thay vì chờ người dùng bấm chuông.
 *
 * <p><b>Bối cảnh.</b> Trạng thái đã-đọc ({@code user_notifications.read_at}) trước đây chỉ được đặt
 * qua đúng 2 endpoint UI (bấm 1 dòng / "đọc tất cả"). Không luồng nghiệp vụ nào — chấm bài, duyệt yêu
 * cầu vào lớp, mở thread tin nhắn… — đánh dấu thông báo liên quan là đã đọc, nên giáo viên chấm xong
 * bài mà chuông vẫn báo "📥 Bài cần xem". Service này là cầu nối duy nhất: các service nghiệp vụ gọi
 * {@link #ackByContext} SAU KHI hành động "tiêu thụ" thông báo đã hoàn tất.
 *
 * <p><b>Thiết kế.</b>
 * <ul>
 *   <li>Được caller gọi qua {@link com.deutschflow.common.transaction.RunAfterCommitService} — chạy
 *       trong transaction RIÊNG sau khi tx nghiệp vụ commit, nên (a) hành động rollback thì không ack
 *       oan và (b) lỗi ack không bao giờ poison tx nghiệp vụ.</li>
 *   <li>So khớp payload bằng jsonb containment ({@code @>}) — chỉ đọc đúng thông báo thuộc ngữ cảnh.</li>
 *   <li>Idempotent ({@code read_at IS NULL}): gọi lặp là vô hại (0 dòng).</li>
 *   <li>Best-effort: mọi lỗi được nuốt + log, không ném ngược cho caller.</li>
 * </ul>
 * Sau khi ack thành công, đẩy SSE {@code unreadCount} qua {@link NotificationUnreadPushCoordinator} để
 * mọi client (web bell, mobile badge) tự cập nhật mà không cần thao tác thêm.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationAutoAckService {

    private final UserNotificationRepository notificationRepository;
    private final NotificationUnreadPushCoordinator unreadPushCoordinator;
    private final ObjectMapper objectMapper;

    /**
     * Đánh dấu đã đọc mọi thông báo CHƯA đọc của {@code recipientId}, thuộc một trong {@code types},
     * có payload CHỨA tất cả cặp key/value trong {@code match} (jsonb containment).
     *
     * @param match các cặp so khớp; giá trị số nên dùng {@link Long} để khớp đúng kiểu jsonb number
     *              (payload được ghi bằng Long → jsonb number).
     */
    // REQUIRES_NEW: các caller gọi method này qua RunAfterCommitService — tức từ afterCompletion của tx
    // nghiệp vụ vừa commit, lúc connection vẫn còn bound. Với REQUIRED, method sẽ THAM GIA tx đã hoàn tất
    // đó (không mở tx mới): UPDATE không được Spring commit và unreadPushCoordinator.afterCommit bắn với
    // STATUS_UNKNOWN nên SSE bị bỏ; trên caller readOnly còn ném "cannot UPDATE in read-only tx". REQUIRES_NEW
    // mở tx vật lý mới (giống StudentCompetencyService.applyGradingResult chạy cùng ngữ cảnh afterCommit).
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void ackByContext(Long recipientId, Set<NotificationType> types, Map<String, Object> match) {
        if (recipientId == null || types == null || types.isEmpty() || match == null || match.isEmpty()) {
            return;
        }
        try {
            String matchJson = objectMapper.writeValueAsString(match);
            int rows = notificationRepository.markReadByContext(
                    recipientId, typeNames(types), matchJson, LocalDateTime.now());
            if (rows > 0) {
                unreadPushCoordinator.afterCommit(recipientId);
                log.debug("[notif-ack] {} rows read for user={} types={} match={}", rows, recipientId, types, match);
            }
        } catch (JsonProcessingException e) {
            log.warn("[notif-ack] cannot serialize match {} for user={}: {}", match, recipientId, e.toString());
        } catch (RuntimeException e) {
            log.warn("[notif-ack] ackByContext failed for user={} types={}: {}", recipientId, types, e.toString());
        }
    }

    /**
     * Biến thể không lọc payload: đánh dấu đã đọc mọi thông báo chưa đọc thuộc {@code types}. Dùng cho
     * các loại nên đọc theo TYPE bất kể payload — ví dụ nhắc ôn tập {@code REVIEW_DUE}/{@code STREAK_REMINDER}
     * khi học viên đã học trong ngày.
     */
    // REQUIRES_NEW — xem chú thích ở {@link #ackByContext}: chạy sau commit qua RunAfterCommitService nên
    // phải mở tx vật lý mới, nếu không SSE bị bỏ và UPDATE không được commit.
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void ackByType(Long recipientId, Set<NotificationType> types) {
        if (recipientId == null || types == null || types.isEmpty()) {
            return;
        }
        try {
            int rows = notificationRepository.markReadByType(recipientId, typeNames(types), LocalDateTime.now());
            if (rows > 0) {
                unreadPushCoordinator.afterCommit(recipientId);
                log.debug("[notif-ack] {} rows read by type for user={} types={}", rows, recipientId, types);
            }
        } catch (RuntimeException e) {
            log.warn("[notif-ack] ackByType failed for user={} types={}: {}", recipientId, types, e.toString());
        }
    }

    private static List<String> typeNames(Set<NotificationType> types) {
        return types.stream().map(Enum::name).toList();
    }
}
