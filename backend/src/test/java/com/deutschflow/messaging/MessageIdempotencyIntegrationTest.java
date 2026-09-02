package com.deutschflow.messaging;

import com.deutschflow.messaging.entity.ClassChannelMessage;
import com.deutschflow.messaging.entity.Message;
import com.deutschflow.messaging.repository.ClassChannelMessageRepository;
import com.deutschflow.messaging.repository.MessageRepository;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Kiểm ràng buộc idempotency V300 trên PostgreSQL THẬT (Flyway áp migration đầy đủ): UNIQUE index
 * bộ phận (sender_id, client_temp_id) WHERE client_temp_id IS NOT NULL trên cả hai bảng tin nhắn.
 * Đây là chốt chặn cuối cho cửa sổ đua hai request cùng key — tầng service chỉ TRA trước khi lưu
 * (không khoá), nên ngữ nghĩa index phải đúng: chặn trùng theo TỪNG người gửi, không chặn chéo
 * người gửi, và không đụng gì tới tin không có key (NULL không đếm).
 *
 * <p>Không dùng @Transactional cấp test: dữ liệu commit thật; mọi định danh (email, key) sinh
 * ngẫu nhiên theo lượt chạy để test chạy lại được trên DB local bền vững (DEUTSCHFLOW_IT_JDBC_URL).
 */
@SpringBootTest
class MessageIdempotencyIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private MessageRepository messageRepository;
    @Autowired private ClassChannelMessageRepository channelRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private TeacherClassRepository teacherClassRepository;

    private Long senderA;
    private Long senderB;

    @BeforeEach
    void seedUsers() {
        senderA = newUser("msgidem-a");
        senderB = newUser("msgidem-b");
    }

    @Test
    @DisplayName("messages: hai INSERT cùng (sender, clientTempId) → bản thứ hai bị index V300 chặn")
    void messages_duplicateSenderKey_rejectedByUniqueIndex() {
        String key = key();
        messageRepository.saveAndFlush(dm(senderA, senderB, "lần một", key));

        assertThatThrownBy(() -> messageRepository.saveAndFlush(dm(senderA, senderB, "lần hai (retry)", key)))
                .isInstanceOf(DataIntegrityViolationException.class);

        assertThat(messageRepository.findBySenderIdAndClientTempId(senderA, key))
                .isPresent()
                .get()
                .satisfies(m -> assertThat(m.getBody()).isEqualTo("lần một"));
    }

    @Test
    @DisplayName("messages: cùng key nhưng KHÁC người gửi → cả hai đều lưu được (unique theo từng sender)")
    void messages_sameKeyDifferentSenders_bothInsert() {
        String key = key();
        messageRepository.saveAndFlush(dm(senderA, senderB, "của A", key));
        messageRepository.saveAndFlush(dm(senderB, senderA, "của B", key));

        assertThat(messageRepository.findBySenderIdAndClientTempId(senderA, key)).isPresent();
        assertThat(messageRepository.findBySenderIdAndClientTempId(senderB, key)).isPresent();
    }

    @Test
    @DisplayName("messages: không có key (NULL) → gửi bao nhiêu cũng được, index bộ phận không đếm NULL")
    void messages_nullKeys_neverCollide() {
        Message first = messageRepository.saveAndFlush(dm(senderA, senderB, "không key 1", null));
        Message second = messageRepository.saveAndFlush(dm(senderA, senderB, "không key 2", null));

        assertThat(first.getId()).isNotEqualTo(second.getId());
    }

    @Test
    @DisplayName("class_channel_messages: hai INSERT cùng (sender, clientTempId) → bản thứ hai bị chặn")
    void classChannel_duplicateSenderKey_rejectedByUniqueIndex() {
        Long classId = teacherClassRepository.save(TeacherClass.builder()
                .teacherId(senderA)
                .name("Lớp IT idempotency")
                .inviteCode("msgidem-" + UUID.randomUUID())
                .createdAt(LocalDateTime.now())
                .build()).getId();
        String key = key();
        channelRepository.saveAndFlush(channelMsg(classId, senderB, "lần một", key));

        assertThatThrownBy(() -> channelRepository.saveAndFlush(channelMsg(classId, senderB, "lần hai", key)))
                .isInstanceOf(DataIntegrityViolationException.class);

        assertThat(channelRepository.findBySenderIdAndClientTempId(senderB, key))
                .isPresent()
                .get()
                .satisfies(m -> assertThat(m.getBody()).isEqualTo("lần một"));
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    private Long newUser(String prefix) {
        return userRepository.save(User.builder()
                .email(prefix + "-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("Msg Idem Tester")
                .role(User.Role.STUDENT)
                .build()).getId();
    }

    private static String key() {
        return "tmp-it-" + UUID.randomUUID();
    }

    private static Message dm(Long senderId, Long recipientId, String body, String clientTempId) {
        return Message.builder()
                .senderId(senderId)
                .recipientId(recipientId)
                .body(body)
                .clientTempId(clientTempId)
                .build();
    }

    private static ClassChannelMessage channelMsg(Long classId, Long senderId, String body, String clientTempId) {
        return ClassChannelMessage.builder()
                .classId(classId)
                .senderId(senderId)
                .body(body)
                .clientTempId(clientTempId)
                .build();
    }
}
