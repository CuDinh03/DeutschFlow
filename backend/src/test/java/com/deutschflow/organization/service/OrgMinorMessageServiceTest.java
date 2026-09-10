package com.deutschflow.organization.service;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.minor.MinorLearnerService;
import com.deutschflow.common.minor.MinorPolicy;
import com.deutschflow.messaging.entity.Message;
import com.deutschflow.messaging.repository.MessageRepository;
import com.deutschflow.organization.dto.OrgMinorMessageDtos.MinorThreadDto;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Cổng phạm vi của đường "giám đốc đọc tin nhắn riêng của học viên chưa thành niên"
 * (AC-ORG-CT-10, DEC-22 mục 18c).
 *
 * <p>Hai thứ được chốt ở đây vì cả hai đều là loại lỗi KHÔNG làm đỏ bất kỳ ca nào khác:
 * <ul>
 *   <li>ma trận quyết định của {@code assertReadableSubject} — đặc biệt nhánh {@code UNKNOWN}, nơi
 *       "nới nhẹ cho tiện" sẽ mở quyền đọc lên toàn bộ học viên chưa khai ngày sinh mà không có
 *       triệu chứng nào nhìn thấy được;</li>
 *   <li>đường đọc KHÔNG gọi {@code markThreadRead}. Một lần thêm nhầm sẽ âm thầm xoá bằng chứng
 *       "học viên chưa từng mở tin này" và không ai phát hiện cho tới khi cần đến bằng chứng đó.</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("OrgMinorMessageService Unit Tests (AC-ORG-CT-10)")
class OrgMinorMessageServiceTest {

    private static final Long ORG_ID = 7L;
    private static final Long STUDENT_ID = 101L;
    private static final Long TEACHER_ID = 202L;

    @Mock private JdbcTemplate jdbcTemplate;
    @Mock private MessageRepository messageRepository;
    @Mock private MinorLearnerService minorLearnerService;
    @Mock private UserRepository userRepository;

    private OrgMinorMessageService service() {
        return new OrgMinorMessageService(jdbcTemplate, messageRepository, minorLearnerService,
                new MinorPolicy(16, 18), userRepository);
    }

    // ── Ma trận quyết định thuần ────────────────────────────────────────────

    @Nested
    @DisplayName("assertReadableSubject — ai nằm trong phạm vi đọc")
    class ReadableSubject {

        @ParameterizedTest
        @EnumSource(MinorPolicy.Status.class)
        @DisplayName("Không phải học viên ACTIVE của trung tâm ⇒ chặn với MỌI nhóm tuổi")
        void outsider_alwaysForbidden(MinorPolicy.Status status) {
            assertThatThrownBy(() -> OrgMinorMessageService.assertReadableSubject(STUDENT_ID, false, status))
                    .isInstanceOf(ForbiddenException.class)
                    .hasMessageContaining("trung tâm của bạn");
        }

        @Test
        @DisplayName("Học viên chưa thành niên của trung tâm ⇒ cho đọc (cả hai mức tuổi)")
        void minorOfOrg_allowed() {
            assertThatCode(() -> OrgMinorMessageService.assertReadableSubject(
                    STUDENT_ID, true, MinorPolicy.Status.MINOR_LEGAL)).doesNotThrowAnyException();
            assertThatCode(() -> OrgMinorMessageService.assertReadableSubject(
                    STUDENT_ID, true, MinorPolicy.Status.MINOR_CENTER_POLICY)).doesNotThrowAnyException();
        }

        @Test
        @DisplayName("Học viên ĐÃ THÀNH NIÊN của chính trung tâm đó ⇒ vẫn chặn")
        void adultOfOrg_forbidden() {
            assertThatThrownBy(() -> OrgMinorMessageService.assertReadableSubject(
                    STUDENT_ID, true, MinorPolicy.Status.ADULT))
                    .isInstanceOf(ForbiddenException.class);
        }

        @Test
        @DisplayName("🔴 UNKNOWN (chưa khai ngày sinh) ⇒ CHẶN, và nói rõ phải bổ sung ngày sinh")
        void unknownAge_failsClosedTowardsPrivacy() {
            // Fail-closed ở đây quay về phía QUYỀN RIÊNG TƯ, ngược hướng MinorGate (chỗ đó
            // fail-closed là KHÔNG GỬI dữ liệu đi). Chưa xác lập được là trẻ em thì chưa có căn cứ
            // cho người thứ ba đọc tin nhắn riêng — và trên production đang có hàng chục tài khoản
            // thiếu ngày sinh, nên nhánh này quyết định mặc định là ĐÓNG hay MỞ.
            assertThatThrownBy(() -> OrgMinorMessageService.assertReadableSubject(
                    STUDENT_ID, true, MinorPolicy.Status.UNKNOWN))
                    .isInstanceOf(ForbiddenException.class)
                    .hasMessageContaining("ngày sinh");
        }
    }

    // ── Hành vi của đường đọc ───────────────────────────────────────────────

    @Nested
    @DisplayName("readThread — đường đọc")
    @MockitoSettings(strictness = Strictness.LENIENT)
    class ReadThread {

        @Test
        @DisplayName("🔴 Đọc xong KHÔNG đánh dấu đã đọc — markThreadRead không bao giờ được gọi")
        void neverMarksThreadRead() {
            allowSubject(MinorPolicy.Status.MINOR_LEGAL);
            when(messageRepository.findBySenderIdAndRecipientIdOrSenderIdAndRecipientIdOrderByIdAsc(
                    STUDENT_ID, TEACHER_ID, TEACHER_ID, STUDENT_ID))
                    .thenReturn(List.of(message(1L, TEACHER_ID, STUDENT_ID, "Em nộp bài chưa?")));
            when(userRepository.findById(anyLong())).thenReturn(Optional.of(account("Ai đó")));

            MinorThreadDto thread = service().readThread(ORG_ID, STUDENT_ID, TEACHER_ID);

            assertThat(thread.messages()).hasSize(1);
            assertThat(thread.messages().get(0).body()).isEqualTo("Em nộp bài chưa?");
            assertThat(thread.minorStatus()).isEqualTo("MINOR_LEGAL");
            verify(messageRepository, never()).markThreadRead(any(), any(), any());
        }

        @Test
        @DisplayName("Tuổi hỏi MinorLearnerService (đọc DB), không suy từ principal")
        void agesLoadedFromDatabase() {
            allowSubject(MinorPolicy.Status.MINOR_CENTER_POLICY);
            when(messageRepository.findBySenderIdAndRecipientIdOrSenderIdAndRecipientIdOrderByIdAsc(
                    STUDENT_ID, TEACHER_ID, TEACHER_ID, STUDENT_ID))
                    .thenReturn(List.of(message(1L, STUDENT_ID, TEACHER_ID, "Dạ rồi ạ")));
            when(userRepository.findById(anyLong())).thenReturn(Optional.of(account("Ai đó")));

            service().readThread(ORG_ID, STUDENT_ID, TEACHER_ID);

            verify(minorLearnerService).statusOf(STUDENT_ID);
        }

        @Test
        @DisplayName("Không có tin nhắn nào giữa hai người ⇒ 404, không trả danh tính đối tác")
        void emptyThread_isNotFound_soIdsCannotBeProbed() {
            allowSubject(MinorPolicy.Status.MINOR_LEGAL);
            when(messageRepository.findBySenderIdAndRecipientIdOrSenderIdAndRecipientIdOrderByIdAsc(
                    STUDENT_ID, TEACHER_ID, TEACHER_ID, STUDENT_ID)).thenReturn(List.of());

            assertThatThrownBy(() -> service().readThread(ORG_ID, STUDENT_ID, TEACHER_ID))
                    .isInstanceOf(NotFoundException.class);
            // Danh tính chỉ được tra SAU khi đã chứng minh có hội thoại thật.
            verify(userRepository, never()).findById(TEACHER_ID);
        }

        @Test
        @DisplayName("Học viên của trung tâm KHÁC ⇒ chặn TRƯỚC khi chạm bảng messages")
        void otherOrgStudent_blockedBeforeReadingMessages() {
            when(jdbcTemplate.queryForObject(anyString(), eq(Boolean.class), any(), any()))
                    .thenReturn(false);
            when(minorLearnerService.statusOf(STUDENT_ID)).thenReturn(MinorPolicy.Status.MINOR_LEGAL);

            assertThatThrownBy(() -> service().readThread(ORG_ID, STUDENT_ID, TEACHER_ID))
                    .isInstanceOf(ForbiddenException.class);
            verify(messageRepository, never())
                    .findBySenderIdAndRecipientIdOrSenderIdAndRecipientIdOrderByIdAsc(
                            any(), any(), any(), any());
        }

        private void allowSubject(MinorPolicy.Status status) {
            when(jdbcTemplate.queryForObject(anyString(), eq(Boolean.class), any(), any()))
                    .thenReturn(true);
            when(minorLearnerService.statusOf(STUDENT_ID)).thenReturn(status);
        }
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private static Message message(Long id, Long from, Long to, String body) {
        return Message.builder().id(id).senderId(from).recipientId(to).body(body)
                .createdAt(Instant.now()).build();
    }

    private static User account(String name) {
        return User.builder().id(999L).email("x@test.local").passwordHash("x")
                .displayName(name).role(User.Role.TEACHER).build();
    }
}
