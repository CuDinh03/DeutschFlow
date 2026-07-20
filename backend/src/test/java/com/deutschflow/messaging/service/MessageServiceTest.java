package com.deutschflow.messaging.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.messaging.dto.MessagingDtos.ConversationDto;
import com.deutschflow.messaging.dto.MessagingDtos.MessageDto;
import com.deutschflow.messaging.entity.Message;
import com.deutschflow.messaging.repository.MessageRepository;
import com.deutschflow.notification.NotificationType;
import com.deutschflow.notification.service.UserNotificationService;
import com.deutschflow.teacher.entity.ClassStudent;
import com.deutschflow.teacher.entity.ClassStudentId;
import com.deutschflow.teacher.entity.ClassTeacher;
import com.deutschflow.teacher.entity.ClassTeacherId;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import com.deutschflow.moderation.service.UserBlockService;
import com.deutschflow.moderation.service.WordFilterService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("MessageService — student↔teacher 1-1 messaging")
class MessageServiceTest {

    private static final long TEACHER = 1L;
    private static final long STUDENT = 2L;
    private static final long CLASS = 10L;

    @Mock private MessageRepository messageRepository;
    @Mock private ClassTeacherRepository classTeacherRepository;
    @Mock private ClassStudentRepository classStudentRepository;
    @Mock private UserRepository userRepository;
    @Mock private UserNotificationService notificationService;
    @Mock private com.deutschflow.notification.service.NotificationAutoAckService notificationAutoAckService;
    @Mock private com.deutschflow.common.transaction.RunAfterCommitService runAfterCommitService;
    @Mock private UserBlockService blockService;
    @Mock private WordFilterService wordFilter;

    @InjectMocks private MessageService service;

    @BeforeEach
    void stubModeration() {
        when(blockService.blockedIds(any())).thenReturn(java.util.Set.of());
    }

    private void shareClass(long teacherId, long studentId, long classId) {
        when(classTeacherRepository.findByIdTeacherId(teacherId))
                .thenReturn(List.of(ClassTeacher.builder().id(new ClassTeacherId(classId, teacherId)).role("PRIMARY").build()));
        when(classStudentRepository.findByIdStudentId(studentId))
                .thenReturn(List.of(ClassStudent.builder().id(ClassStudentId.builder().classId(classId).studentId(studentId).build()).build()));
    }

    @Test
    @DisplayName("send: teacher↔student cùng lớp → lưu + thông báo người nhận")
    void send_sharedClass_savesAndNotifies() {
        shareClass(TEACHER, STUDENT, CLASS);
        when(userRepository.findById(STUDENT)).thenReturn(Optional.of(User.builder().id(STUDENT).displayName("HV").build()));
        when(userRepository.findById(TEACHER)).thenReturn(Optional.of(User.builder().id(TEACHER).displayName("GV").build()));
        when(messageRepository.save(any(Message.class))).thenAnswer(inv -> {
            Message m = inv.getArgument(0);
            m.setId(99L);
            m.setCreatedAt(Instant.now());
            return m;
        });

        MessageDto dto = service.send(TEACHER, STUDENT, "  Chào em  ");

        assertThat(dto.id()).isEqualTo(99L);
        assertThat(dto.body()).isEqualTo("Chào em"); // trimmed
        assertThat(dto.mine()).isTrue();
        verify(notificationService).insertForUser(any(User.class), eq(NotificationType.NEW_MESSAGE), any());
    }

    @Test
    @DisplayName("send: KHÔNG chung lớp → Forbidden, không lưu, không thông báo")
    void send_noSharedClass_throwsForbidden() {
        when(classTeacherRepository.findByIdTeacherId(anyLong())).thenReturn(List.of());
        when(classStudentRepository.findByIdStudentId(anyLong())).thenReturn(List.of());

        assertThatThrownBy(() -> service.send(TEACHER, STUDENT, "hi"))
                .isInstanceOf(ForbiddenException.class);
        verify(messageRepository, never()).save(any());
        verify(notificationService, never()).insertForUser(any(), any(), any());
    }

    @Test
    @DisplayName("send: tự nhắn cho mình → BadRequest")
    void send_toSelf_throwsBadRequest() {
        assertThatThrownBy(() -> service.send(TEACHER, TEACHER, "hi"))
                .isInstanceOf(BadRequestException.class);
        verify(messageRepository, never()).save(any());
    }

    @Test
    @DisplayName("getThread: cùng lớp → trả thread + đánh dấu đã đọc")
    void getThread_marksRead() {
        shareClass(TEACHER, STUDENT, CLASS);
        Message m = Message.builder().id(1L).senderId(STUDENT).recipientId(TEACHER).body("hỏi bài").createdAt(Instant.now()).build();
        when(messageRepository.findBySenderIdAndRecipientIdOrSenderIdAndRecipientIdOrderByIdAsc(TEACHER, STUDENT, STUDENT, TEACHER))
                .thenReturn(List.of(m));

        List<MessageDto> thread = service.getThread(TEACHER, STUDENT);

        assertThat(thread).hasSize(1);
        assertThat(thread.get(0).mine()).isFalse(); // sent by the student
        verify(messageRepository).markThreadRead(eq(TEACHER), eq(STUDENT), any(Instant.class));
    }

    @Test
    @DisplayName("getThread(afterId): chỉ trả tin mới hơn cursor + vẫn đánh dấu đã đọc")
    void getThread_delta_returnsOnlyNewerAndStillMarksRead() {
        shareClass(TEACHER, STUDENT, CLASS);
        Message newer = Message.builder().id(6L).senderId(STUDENT).recipientId(TEACHER).body("tin mới").createdAt(Instant.now()).build();
        when(messageRepository.findThreadAfter(TEACHER, STUDENT, 5L)).thenReturn(List.of(newer));

        List<MessageDto> delta = service.getThread(TEACHER, STUDENT, 5L);

        assertThat(delta).extracting(MessageDto::id).containsExactly(6L);
        // Delta path must NOT hit the full-thread query, and must still mark the whole incoming side read.
        verify(messageRepository).findThreadAfter(TEACHER, STUDENT, 5L);
        verify(messageRepository, never())
                .findBySenderIdAndRecipientIdOrSenderIdAndRecipientIdOrderByIdAsc(anyLong(), anyLong(), anyLong(), anyLong());
        verify(messageRepository).markThreadRead(eq(TEACHER), eq(STUDENT), any(Instant.class));
    }

    @Test
    @DisplayName("getThread(afterId=null): về đúng đường full thread")
    void getThread_nullAfterId_usesFullThread() {
        shareClass(TEACHER, STUDENT, CLASS);
        when(messageRepository.findBySenderIdAndRecipientIdOrSenderIdAndRecipientIdOrderByIdAsc(TEACHER, STUDENT, STUDENT, TEACHER))
                .thenReturn(List.of());

        service.getThread(TEACHER, STUDENT, null);

        verify(messageRepository).findBySenderIdAndRecipientIdOrSenderIdAndRecipientIdOrderByIdAsc(TEACHER, STUDENT, STUDENT, TEACHER);
        verify(messageRepository, never()).findThreadAfter(anyLong(), anyLong(), anyLong());
    }

    @Test
    @DisplayName("listConversations: gộp theo counterpart + đếm chưa đọc")
    void listConversations_groupsAndCountsUnread() {
        // recent desc: latest first. Two from STUDENT→me unread, one from me→STUDENT.
        Message newest = Message.builder().id(3L).senderId(STUDENT).recipientId(TEACHER).body("mới nhất").createdAt(Instant.now()).build();
        Message mid = Message.builder().id(2L).senderId(TEACHER).recipientId(STUDENT).body("tôi trả lời").createdAt(Instant.now()).build();
        Message old = Message.builder().id(1L).senderId(STUDENT).recipientId(TEACHER).body("cũ").createdAt(Instant.now()).build();
        when(messageRepository.findTop300BySenderIdOrRecipientIdOrderByIdDesc(TEACHER, TEACHER))
                .thenReturn(List.of(newest, mid, old));
        when(userRepository.findAllById(any()))
                .thenReturn(List.of(User.builder().id(STUDENT).displayName("HV Hai").email("hv@x").build()));

        List<ConversationDto> convos = service.listConversations(TEACHER);

        assertThat(convos).hasSize(1);
        ConversationDto c = convos.get(0);
        assertThat(c.userId()).isEqualTo(STUDENT);
        assertThat(c.displayName()).isEqualTo("HV Hai");
        assertThat(c.lastMessage()).isEqualTo("mới nhất"); // newest preserved
        assertThat(c.unread()).isEqualTo(2L); // ids 3 + 1 (to TEACHER, unread); mid was sent BY teacher
    }
}
