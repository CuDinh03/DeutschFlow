package com.deutschflow.notification.service;

import com.deutschflow.notification.NotificationType;
import com.deutschflow.notification.entity.UserNotification;
import com.deutschflow.notification.repository.UserNotificationRepository;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * F-QA-01 (QA prod Track A 02/09/2026): chấm LẠI một bài đã final không được phát thêm thông báo
 * "✅ Bài đã chấm" — 3 lần sửa điểm trong 1 phút từng tạo 3 dòng hộp thư với dãy điểm dao động
 * 75→80→90, trái lời hứa "announced to the student exactly once" của {@code AssignmentStatus}.
 *
 * <p>Chạy trên Postgres thật vì phần dễ vỡ nằm trong SQL, không phải Java:
 * {@link UserNotificationRepository#refreshLatestByContext} là native query dùng jsonb containment
 * ({@code @>}) + UPDATE-qua-subselect {@code LIMIT 1} — những thứ H2/mock không kiểm được.
 * Tự skip khi không có Postgres — xem {@link AbstractPostgresIntegrationTest}.
 */
@SpringBootTest
@DisplayName("F-QA-01: regrade gộp về một dòng thông báo (refresh tại chỗ trên Postgres thật)")
class AssignmentRegradeNotificationIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private UserNotificationService service;

    @Autowired
    private UserNotificationRepository notificationRepository;

    @Autowired
    private UserRepository userRepository;

    private long studentId;

    @BeforeEach
    void seedStudent() {
        studentId = userRepository.save(User.builder()
                .email("regrade-notify-" + System.nanoTime() + "@local.test")
                .passwordHash("x")
                .displayName("Regrade QA")
                .role(User.Role.STUDENT)
                .build()).getId();
    }

    private List<UserNotification> gradedRows() {
        return notificationRepository
                .findByRecipient_IdOrderByIdDesc(studentId, PageRequest.of(0, 50))
                .getContent().stream()
                .filter(n -> n.getType() == NotificationType.ASSIGNMENT_GRADED)
                .toList();
    }

    @Test
    @DisplayName("kịch bản QA 75→80→90: chấm đầu 1 dòng, mỗi regrade cập nhật TẠI CHỖ — tổng vẫn 1 dòng, điểm mới nhất, unread lại")
    void regrade_refreshesSingleRowInsteadOfAppending() {
        // Lần chấm đầu: đúng một dòng "✅ Bài đã chấm".
        service.onAssignmentGraded(studentId, "ASSIGNMENT", 10L, 75, "lần đầu");
        // Một bài KHÁC của cùng học viên — chứng minh match không vơ nhầm bài.
        service.onAssignmentGraded(studentId, "ASSIGNMENT", 99L, 50, "bài khác");
        assertThat(gradedRows()).hasSize(2);

        // Học viên đã đọc thông báo cũ → regrade phải trả nó về CHƯA ĐỌC.
        service.markAllRead(studentId);

        // Regrade 2 lần liên tiếp (QA thấy 3 tin/1 phút khi sửa 75→80→90).
        service.onAssignmentRegraded(studentId, "ASSIGNMENT", 10L, 80, "sửa lần 1");
        service.onAssignmentRegraded(studentId, "ASSIGNMENT", 10L, 90, "sửa lần 2");

        List<UserNotification> rows = gradedRows();
        // KHÔNG có dòng mới: vẫn đúng 2 dòng (bài 10 + bài 99), không phải 4.
        assertThat(rows).hasSize(2);

        UserNotification refreshed = rows.stream()
                .filter(n -> Integer.valueOf(10).equals(asInt(n.getPayload().get("referenceId"))))
                .findFirst().orElseThrow();
        // Payload mang ĐIỂM HIỆN TẠI + cờ updated (renderer đổi copy thành "Điểm đã được cập nhật");
        // các điểm trung gian 75/80 không còn dấu vết — không lộ lịch sử dao động.
        assertThat(asInt(refreshed.getPayload().get("score"))).isEqualTo(90);
        assertThat(refreshed.getPayload().get("feedback")).isEqualTo("sửa lần 2");
        assertThat(refreshed.getPayload().get("updated")).isEqualTo(Boolean.TRUE);
        assertThat(refreshed.getReadAt()).as("regrade phải trả dòng về chưa đọc để chuông báo").isNull();

        // Bài 99 không liên quan phải nguyên vẹn: điểm cũ, không cờ updated, vẫn ĐÃ đọc.
        UserNotification untouched = rows.stream()
                .filter(n -> Integer.valueOf(99).equals(asInt(n.getPayload().get("referenceId"))))
                .findFirst().orElseThrow();
        assertThat(asInt(untouched.getPayload().get("score"))).isEqualTo(50);
        assertThat(untouched.getPayload()).doesNotContainKey("updated");
        assertThat(untouched.getReadAt()).isNotNull();
    }

    @Test
    @DisplayName("dữ liệu spam trước fix (2 dòng trùng một bài): chỉ dòng MỚI NHẤT được refresh, dòng cũ để job dọn")
    void regrade_touchesOnlyTheLatestDuplicate() {
        // Tái hiện hộp thư thời còn bug: 2 dòng "Bài đã chấm" cho CÙNG một bài.
        service.onAssignmentGraded(studentId, "ASSIGNMENT", 10L, 75, "spam cũ 1");
        service.onAssignmentGraded(studentId, "ASSIGNMENT", 10L, 80, "spam cũ 2");

        service.onAssignmentRegraded(studentId, "ASSIGNMENT", 10L, 90, "chốt");

        List<UserNotification> rows = gradedRows();
        assertThat(rows).hasSize(2); // không thêm dòng thứ 3
        // findByRecipient_IdOrderByIdDesc: rows.get(0) là dòng mới nhất.
        assertThat(asInt(rows.get(0).getPayload().get("score"))).isEqualTo(90);
        assertThat(rows.get(0).getPayload().get("updated")).isEqualTo(Boolean.TRUE);
        assertThat(asInt(rows.get(1).getPayload().get("score"))).isEqualTo(75);
        assertThat(rows.get(1).getPayload()).doesNotContainKey("updated");
    }

    @Test
    @DisplayName("hộp thư không còn dòng của bài (job dọn đã thu hồi) → regrade chèn đúng MỘT dòng 'đã cập nhật'")
    void regrade_withNoPriorRow_insertsSingleUpdatedRow() {
        service.onAssignmentRegraded(studentId, "ASSIGNMENT", 10L, 90, "sửa sau khi dọn");

        List<UserNotification> rows = gradedRows();
        assertThat(rows).hasSize(1);
        assertThat(asInt(rows.get(0).getPayload().get("score"))).isEqualTo(90);
        assertThat(rows.get(0).getPayload().get("updated")).isEqualTo(Boolean.TRUE);
        assertThat(rows.get(0).getReadAt()).isNull();
    }

    /** jsonb đọc lại trả số dạng Integer/Long tuỳ độ lớn — quy về Integer để so sánh ổn định. */
    private static Integer asInt(Object value) {
        return value instanceof Number n ? n.intValue() : null;
    }
}
