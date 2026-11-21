package com.deutschflow.examspeaking.session;

import com.deutschflow.examspeaking.dto.CreateExamSessionRequest;
import com.deutschflow.examspeaking.dto.ExamSessionView;
import com.deutschflow.examspeaking.entity.SpeakingExamSession;
import com.deutschflow.examspeaking.repository.SpeakingExamSessionRepository;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.ai.TokenUsage;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.doAnswer;

/**
 * Lưu ghi chú (Konzeptpapier) chạy chồng với vào thi / chọn chủ đề (19/11/2026).
 *
 * <p>Web và app đều TỰ LƯU ghi chú khi người học ngừng gõ, nên một lượt {@code PUT /notes} rất dễ
 * chạy cùng lúc với {@code advance} ("Vào thi ngay", hết giờ chuẩn bị) hoặc {@code choose}. Trước bản
 * vá, {@code saveNotes} nạp cả entity rồi lưu lại toàn bộ dòng (có khoá lạc quan {@code version}) ⇒
 * lệnh commit sau ném 409: hoặc ghi chú không lưu được, hoặc "Vào thi" / chọn chủ đề lỗi. Bản vá lưu
 * ghi chú bằng UPDATE riêng (không tăng version); ca 2 còn gác {@code @DynamicUpdate}: thiếu nó thì
 * {@code advance} ghi lại cột {@code notes_text} bằng bản đọc cũ.
 *
 * <p>Hai ca dựng đúng thứ tự xen kẽ đó trên MỘT luồng: giao dịch ngoài đọc phiên trước (bản cũ nằm
 * trong persistence context), một giao dịch REQUIRES_NEW commit thay đổi của "lệnh kia", rồi lệnh
 * đang xét chạy tiếp trong giao dịch ngoài.
 */
@SpringBootTest
@TestPropertySource(properties = "app.ai-jobs.scheduled-enabled=false")
class ExamSessionNotesConcurrencyIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private ExamSessionService sessionService;
    @Autowired private SpeakingExamSessionRepository sessionRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private PlatformTransactionManager txManager;
    @MockBean private OpenAiChatClient chatClient;

    private long userId;

    @BeforeEach
    void seedUser() {
        User u = userRepository.save(User.builder()
                .email("exam-notes-it-" + System.nanoTime() + "@local.test")
                .passwordHash("$2a$10$h").displayName("Exam Notes IT").role(User.Role.STUDENT).build());
        userId = u.getId();
        jdbcTemplate.update("INSERT INTO user_subscriptions (user_id, plan_code, status, starts_at, ends_at) VALUES (?, 'PRO', 'ACTIVE', ?, NULL)",
                userId, Timestamp.from(Instant.parse("2026-01-01T00:00:00Z")));
        jdbcTemplate.update("INSERT INTO user_ai_token_wallets (user_id, balance, last_accrual_local_date) VALUES (?, ?, NULL)",
                userId, 1_000_000L);
        doAnswer(inv -> new AiChatCompletionResult("{\"reply_de\":\"Ja, gern.\"}", TokenUsage.exact(10, 5, 15), "test", "fake-model"))
                .when(chatClient).chatCompletionForTier(any(), any(), anyDouble(), anyInt(), anyBoolean());
    }

    private TransactionTemplate tx() {
        return new TransactionTemplate(txManager);
    }

    private TransactionTemplate txNew() {
        TransactionTemplate t = new TransactionTemplate(txManager);
        t.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        return t;
    }

    private long newMockInPrep() {
        ExamSessionView s = sessionService.create(userId, new CreateExamSessionRequest("GOETHE", "B1", "MOCK", null));
        assertThat(s.state()).isEqualTo(SpeakingExamSession.STATE_PREP);
        return s.id();
    }

    private Map<String, Object> row(long id) {
        return jdbcTemplate.queryForMap("SELECT state, current_part, notes_text FROM speaking_exam_sessions WHERE id = ?", id);
    }

    @Test
    @DisplayName("lưu ghi chú sau khi phiên vừa sang IN_PART: không lỗi, không kéo phiên về PREP")
    void saveNotesDoesNotRevertOrConflictWithConcurrentAdvance() {
        long id = newMockInPrep();

        ExamSessionView view = tx().execute(st -> {
            // Lệnh lưu ghi chú đã đọc phiên khi còn PREP…
            sessionRepository.findByIdAndUserId(id, userId).orElseThrow();
            // …thì "Vào thi" commit trước (đổi trạng thái, tăng version như mọi lượt save có khoá lạc quan).
            txNew().executeWithoutResult(st2 -> jdbcTemplate.update(
                    "UPDATE speaking_exam_sessions SET state = 'IN_PART', current_part = 1, version = version + 1 WHERE id = ?", id));
            return sessionService.saveNotes(userId, id, "Homeoffice: Zeit sparen");
        });

        assertThat(view.notesText()).isEqualTo("Homeoffice: Zeit sparen");
        assertThat(view.state()).isEqualTo(SpeakingExamSession.STATE_IN_PART);
        Map<String, Object> r = row(id);
        assertThat(r.get("state")).isEqualTo(SpeakingExamSession.STATE_IN_PART);
        assertThat(((Number) r.get("current_part")).intValue()).isEqualTo(1);
        assertThat(r.get("notes_text")).isEqualTo("Homeoffice: Zeit sparen");
    }

    @Test
    @DisplayName("vào thi sau khi ghi chú vừa được lưu: advance không xoá ghi chú")
    void advanceDoesNotOverwriteNotesSavedConcurrently() {
        long id = newMockInPrep();

        tx().executeWithoutResult(st -> {
            // "Vào thi" đã đọc phiên khi ghi chú còn trống…
            sessionRepository.findByIdAndUserId(id, userId).orElseThrow();
            // …thì lượt tự lưu ghi chú commit trước.
            txNew().executeWithoutResult(st2 -> sessionService.saveNotes(userId, id, "aber: allein"));
            ExamSessionView v = sessionService.advance(userId, id);
            // Snapshot trả cho client cũng mang ghi chú mới (thẻ đề trong phòng thi hiện từ đây).
            assertThat(v.notesText()).isEqualTo("aber: allein");
        });

        Map<String, Object> r = row(id);
        assertThat(r.get("state")).isEqualTo(SpeakingExamSession.STATE_IN_PART);
        assertThat(r.get("notes_text")).isEqualTo("aber: allein");
    }

    @Test
    @DisplayName("chọn chủ đề sau khi ghi chú vừa được lưu: giữ cả chủ đề lẫn ghi chú, không lỗi")
    void chooseDoesNotConflictWithNotesSavedConcurrently() {
        ExamSessionView s = sessionService.create(userId, new CreateExamSessionRequest("GOETHE", "B1", "MOCK", null));
        ExamSessionView.PrepMaterial choice = s.prepMaterials().stream()
                .filter(ExamSessionView.PrepMaterial::choiceRequired).findFirst().orElseThrow();

        ExamSessionView v = tx().execute(st -> {
            sessionRepository.findByIdAndUserId(s.id(), userId).orElseThrow();
            txNew().executeWithoutResult(st2 -> sessionService.saveNotes(userId, s.id(), "Thema 2: Pro und Contra"));
            return sessionService.choose(userId, s.id(), choice.teilNo(), 1);
        });

        assertThat(v.notesText()).isEqualTo("Thema 2: Pro und Contra");
        assertThat(v.prepMaterials().stream().filter(m -> m.teilNo() == choice.teilNo()).findFirst().orElseThrow().chosenIndex())
                .isEqualTo(1);
        assertThat(row(s.id()).get("notes_text")).isEqualTo("Thema 2: Pro und Contra");
        ExamSessionView reread = sessionService.get(userId, s.id());
        assertThat(reread.prepMaterials().stream().filter(m -> m.teilNo() == choice.teilNo()).findFirst().orElseThrow().chosenIndex())
                .isEqualTo(1);
    }

    @Test
    @DisplayName("ghi chú cắt ở 4000 ký tự; null xoá ghi chú; phiên của người khác → 404")
    void saveNotesKeepsContract() {
        long id = newMockInPrep();

        assertThat(sessionService.saveNotes(userId, id, "x".repeat(5000)).notesText()).hasSize(4000);
        assertThat(sessionService.saveNotes(userId, id, null).notesText()).isNull();
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> sessionService.saveNotes(userId + 999_999, id, "lạ"))
                .isInstanceOf(com.deutschflow.common.exception.NotFoundException.class);
        assertThat(row(id).get("notes_text")).isNull();
    }
}
