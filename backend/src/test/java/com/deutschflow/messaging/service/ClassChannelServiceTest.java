package com.deutschflow.messaging.service;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.messaging.dto.ClassChannelDtos.ClassMessageDto;
import com.deutschflow.messaging.entity.ClassChannelMessage;
import com.deutschflow.messaging.repository.ClassChannelMessageRepository;
import com.deutschflow.notification.service.UserNotificationService;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import com.deutschflow.moderation.service.UserBlockService;
import com.deutschflow.moderation.service.WordFilterService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ClassChannelServiceTest {

    @Mock private ClassChannelMessageRepository channelRepository;
    @Mock private ClassStudentRepository classStudentRepository;
    @Mock private ClassTeacherRepository classTeacherRepository;
    @Mock private TeacherClassRepository teacherClassRepository;
    @Mock private UserRepository userRepository;
    @Mock private WordFilterService wordFilter;
    @Mock private UserBlockService blockService;
    @Mock private UserNotificationService notificationService;

    private ClassChannelService service;

    private static final Long CLASS_ID = 10L;
    private static final Long STUDENT_A = 100L;   // caller (a student member)
    private static final Long STUDENT_B = 200L;   // another student
    private static final Long TEACHER_ID = 5L;

    @BeforeEach
    void setUp() {
        service = new ClassChannelService(
                channelRepository, classStudentRepository, classTeacherRepository, teacherClassRepository,
                userRepository, wordFilter, blockService, notificationService);
        lenient().when(blockService.blockedIds(any())).thenReturn(java.util.Set.of());
    }

    @Test
    @DisplayName("listMessages rejects a non-member")
    void listMessages_nonMember_throwsForbidden() {
        asNonMember(STUDENT_A);
        assertThatThrownBy(() -> service.listMessages(STUDENT_A, CLASS_ID))
                .isInstanceOf(ForbiddenException.class);
        verify(channelRepository, never()).findTop200ByClassIdOrderByIdDesc(any());
    }

    @Test
    @DisplayName("post rejects a non-member")
    void post_nonMember_throwsForbidden() {
        asNonMember(STUDENT_A);
        assertThatThrownBy(() -> service.post(STUDENT_A, CLASS_ID, "hi"))
                .isInstanceOf(ForbiddenException.class);
        verify(channelRepository, never()).save(any());
    }

    @Test
    @DisplayName("post fans a CLASS_CHANNEL_MESSAGE notification out to the other members")
    void post_notifiesOtherMembers() {
        asStudentMember(STUDENT_A);
        when(channelRepository.save(any(ClassChannelMessage.class))).thenAnswer(inv -> inv.getArgument(0));
        stubNames(STUDENT_A, "An");
        when(teacherClassRepository.findById(CLASS_ID))
                .thenReturn(Optional.of(TeacherClass.builder().id(CLASS_ID).name("A1 Sáng").build()));

        service.post(STUDENT_A, CLASS_ID, "  chào cả lớp  ");

        // Delivery is off-thread in UserNotificationService; the service only triggers it with the
        // resolved class name + sender name and a trimmed preview (never the sender's own id).
        verify(notificationService).notifyClassChannelMessage(
                eq(CLASS_ID), eq("A1 Sáng"), eq(STUDENT_A), eq("An"), eq("chào cả lớp"));
    }

    @Test
    @DisplayName("post never lets a notification failure break the send (best-effort)")
    void post_notificationFailure_doesNotBreakSend() {
        asStudentMember(STUDENT_A);
        when(channelRepository.save(any(ClassChannelMessage.class))).thenAnswer(inv -> inv.getArgument(0));
        stubNames(STUDENT_A, "An");
        when(teacherClassRepository.findById(CLASS_ID))
                .thenReturn(Optional.of(TeacherClass.builder().id(CLASS_ID).name("A1").build()));
        doThrow(new RuntimeException("push down")).when(notificationService)
                .notifyClassChannelMessage(any(), any(), any(), any(), any());

        // The post still returns the saved message even though notification dispatch threw.
        ClassMessageDto dto = service.post(STUDENT_A, CLASS_ID, "vẫn gửi được");

        assertThat(dto.body()).isEqualTo("vẫn gửi được");
        assertThat(dto.mine()).isTrue();
    }

    @Test
    @DisplayName("a student may delete their OWN message — soft delete keeps the row, hides body")
    void delete_ownMessage_asStudent_softDeletes() {
        asStudentMember(STUDENT_A);
        ClassChannelMessage own = msg(1L, STUDENT_A, "chào cả lớp");
        when(channelRepository.findById(1L)).thenReturn(Optional.of(own));
        stubNames(STUDENT_A, "An");

        ClassMessageDto dto = service.delete(STUDENT_A, CLASS_ID, 1L);

        assertThat(own.getDeletedAt()).isNotNull();
        assertThat(own.getDeletedBy()).isEqualTo(STUDENT_A);
        assertThat(own.getBody()).isEqualTo("chào cả lớp");  // original retained for audit
        assertThat(dto.deleted()).isTrue();
        assertThat(dto.body()).isNull();                     // never sent to clients
        assertThat(dto.canDelete()).isFalse();
        verify(channelRepository).save(own);
    }

    @Test
    @DisplayName("a student may NOT delete another student's message")
    void delete_othersMessage_asStudent_throwsForbidden() {
        asStudentMember(STUDENT_A);
        ClassChannelMessage others = msg(2L, STUDENT_B, "bài của B");
        when(channelRepository.findById(2L)).thenReturn(Optional.of(others));

        assertThatThrownBy(() -> service.delete(STUDENT_A, CLASS_ID, 2L))
                .isInstanceOf(ForbiddenException.class);
        assertThat(others.getDeletedAt()).isNull();
        verify(channelRepository, never()).save(any());
    }

    @Test
    @DisplayName("a teacher of the class may delete anyone's message (moderation)")
    void delete_anyMessage_asTeacher_softDeletes() {
        asTeacherMember(TEACHER_ID);
        ClassChannelMessage studentMsg = msg(3L, STUDENT_B, "spam");
        when(channelRepository.findById(3L)).thenReturn(Optional.of(studentMsg));
        stubNames(STUDENT_B, "B");

        ClassMessageDto dto = service.delete(TEACHER_ID, CLASS_ID, 3L);

        assertThat(studentMsg.getDeletedAt()).isNotNull();
        assertThat(studentMsg.getDeletedBy()).isEqualTo(TEACHER_ID);  // audit: teacher moderated
        assertThat(dto.deleted()).isTrue();
    }

    @Test
    @DisplayName("listMessages hides deleted bodies and marks canDelete correctly")
    void listMessages_deletedAndOwnFlags() {
        asStudentMember(STUDENT_A);
        ClassChannelMessage mine = msg(1L, STUDENT_A, "của tôi");
        ClassChannelMessage deleted = msg(2L, STUDENT_B, "đã xoá");
        deleted.setDeletedAt(Instant.now());
        deleted.setDeletedBy(TEACHER_ID);
        when(channelRepository.findTop200ByClassIdOrderByIdDesc(CLASS_ID))
                .thenReturn(List.of(deleted, mine));
        stubNames(STUDENT_A, "An");

        List<ClassMessageDto> out = service.listMessages(STUDENT_A, CLASS_ID);

        assertThat(out).hasSize(2);
        ClassMessageDto mineDto = out.stream().filter(d -> d.id().equals(1L)).findFirst().orElseThrow();
        ClassMessageDto delDto = out.stream().filter(d -> d.id().equals(2L)).findFirst().orElseThrow();
        assertThat(mineDto.mine()).isTrue();
        assertThat(mineDto.canDelete()).isTrue();         // own, not deleted
        assertThat(delDto.body()).isNull();               // deleted body hidden
        assertThat(delDto.deleted()).isTrue();
        assertThat(delDto.canDelete()).isFalse();          // already deleted
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    private void asNonMember(Long userId) {
        when(classStudentRepository.existsByIdClassIdAndIdStudentId(CLASS_ID, userId)).thenReturn(false);
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, userId)).thenReturn(false);
    }

    private void asStudentMember(Long userId) {
        when(classStudentRepository.existsByIdClassIdAndIdStudentId(CLASS_ID, userId)).thenReturn(true);
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, userId)).thenReturn(false);
    }

    private void asTeacherMember(Long userId) {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, userId)).thenReturn(true);
    }

    private void stubNames(Long userId, String name) {
        User u = new User();
        u.setId(userId);
        u.setDisplayName(name);
        when(userRepository.findAllById(anyIterable())).thenReturn(List.of(u));
    }

    private static ClassChannelMessage msg(Long id, Long senderId, String body) {
        return ClassChannelMessage.builder()
                .id(id).classId(CLASS_ID).senderId(senderId).body(body)
                .createdAt(Instant.now()).build();
    }
}
