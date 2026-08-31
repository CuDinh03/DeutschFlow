package com.deutschflow.examspeaking.session;

import com.deutschflow.ai.queue.AiJob;
import com.deutschflow.ai.queue.AiJobRepository;
import com.deutschflow.ai.queue.AiJobWorker;
import com.deutschflow.ai.queue.StaleAiJobMaintenance;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.examspeaking.dto.CreateExamSessionRequest;
import com.deutschflow.examspeaking.dto.ExamSessionView;
import com.deutschflow.examspeaking.entity.SpeakingExamSession;
import com.deutschflow.examspeaking.repository.SpeakingExamSessionRepository;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.ChatMessage;
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

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;

/**
 * Đường THẤT BẠI của chấm nền (gói vá F-01/F-02/F-04/F-19 phía backend):
 *
 * <ul>
 *   <li>job chấm lỗi → worker saveFailed + onFailure → phiên GRADING_FAILED (không kẹt GRADING);</li>
 *   <li>regrade từ GRADING_FAILED → job mới → chấm lại ra RESULTS; trạng thái khác → 409;</li>
 *   <li>sweeper vớt phiên GRADING có job chết (kể cả dữ liệu kẹt từ trước bản vá) và đẩy nốt
 *       phiên đã có kết quả đầy đủ sang RESULTS;</li>
 *   <li>lease PROCESSING: job mồ côi quá hạn bị đánh FAILED, job đang chạy được để yên.</li>
 * </ul>
 *
 * LLM giả lập theo ca: "chết" (ném) cho nhánh fail, JSON hợp lệ cho nhánh chấm lại. Phiên mock đi
 * bằng advance() im lặng (không lượt nói) — đường nhanh nhất tới GRADING, không đụng STT.
 */
@SpringBootTest
@TestPropertySource(properties = {
        "app.examspeaking.allow-text-turns-in-mock=true",
        "app.examspeaking.grading-passes=1",
        // Đẩy 2 job quét định kỳ ra xa vô hạn: IT gọi tay đúng entry point (đi qua proxy + ShedLock);
        // nếu để scheduler nền cũng chạy, lockAtLeastFor=30s làm lời gọi tay bị skip im lặng → flaky.
        "app.ai-jobs.processing-sweep-initial-delay-ms=86400000",
        "app.examspeaking.stuck-sweep-initial-delay-ms=86400000"
})
class ExamGradingFailurePathIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private ExamSessionService sessionService;
    // Gọi bean LOGIC, không gọi entry point @Scheduled+@SchedulerLock: DB Testcontainers dùng chung
    // giữa mọi Spring context của suite CI, scheduler nền của context khác giữ khoá ShedLock
    // (lockAtLeastFor 30s) làm lời gọi tay bị skip im lặng → đỏ chỉ trên CI.
    @Autowired private ExamGradingStuckSweepService sweeper;
    @Autowired private AiJobWorker worker;
    @Autowired private StaleAiJobMaintenance maintenance;
    @Autowired private AiJobRepository aiJobRepository;
    @Autowired private SpeakingExamSessionRepository sessionRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbcTemplate;
    @MockBean private OpenAiChatClient chatClient;

    private long userId;

    @BeforeEach
    void seedUserWithBudget() {
        User u = userRepository.save(User.builder()
                .email("exam-fail-it-" + System.nanoTime() + "@local.test")
                .passwordHash("$2a$10$h").displayName("Exam Fail IT").role(User.Role.STUDENT).build());
        userId = u.getId();
        jdbcTemplate.update("INSERT INTO user_subscriptions (user_id, plan_code, status, starts_at, ends_at) VALUES (?, 'PRO', 'ACTIVE', ?, NULL)",
                userId, Timestamp.from(Instant.parse("2026-01-01T00:00:00Z")));
        jdbcTemplate.update("INSERT INTO user_ai_token_wallets (user_id, balance, last_accrual_local_date) VALUES (?, ?, NULL)",
                userId, 1_000_000L);
    }

    // Re-stub giữa chừng PHẢI dùng kiểu do…().when(mock): `when(mock.call(any…))` thực thi stub
    // ĐANG CÓ ngay trong lời gọi when() với toàn matchers/null — answer cũ NPE (msgs null) hoặc
    // thenThrow cũ ném thẳng vào test.
    private void llmDead() {
        org.mockito.Mockito.doThrow(new RuntimeException("provider down (IT)"))
                .when(chatClient).chatCompletionForTier(any(), any(), anyDouble(), anyInt(), anyBoolean());
    }

    private void llmHealthy() {
        org.mockito.Mockito.doAnswer(inv -> {
            List<ChatMessage> msgs = inv.getArgument(0);
            String user = msgs.get(msgs.size() - 1).content();
            return new AiChatCompletionResult(
                    ExamSessionFlowIntegrationTest.fakeLlm(user, user), TokenUsage.exact(120, 40, 160), "test", "fake-model");
        }).when(chatClient).chatCompletionForTier(any(), any(), anyDouble(), anyInt(), anyBoolean());
    }

    /**
     * Phiên MOCK tới GRADING nhanh: MỘT lượt nói thật ở Teil 1 (bắt buộc — Teil im lặng được code
     * chấm 0 điểm KHÔNG qua LLM từ vá N1c-1, nên phiên câm hoàn toàn sẽ "chấm thành công" mà không
     * đụng provider), phần còn lại advance. LLM phải đang HEALTHY lúc nộp lượt (submit gọi
     * interlocutor.reply); ca fail chỉ giả chết SAU đó, trước khi job chấm được xử lý.
     */
    private ExamSessionView mockWithOneTurnToGrading() {
        ExamSessionView s = sessionService.create(userId, new CreateExamSessionRequest("GOETHE", "A1", "MOCK", null));
        sessionService.submitTextTurn(userId, s.id(),
                "Ich heiße Minh, ich bin 24 Jahre alt und komme aus Vietnam. Ich wohne in Hanoi und bin Student.");
        while (!SpeakingExamSession.STATE_GRADING.equals(s.state())) {
            s = sessionService.advance(userId, s.id());
        }
        assertThat(s.gradingJobId()).isNotNull();
        return s;
    }

    /** Worker @Scheduled(2s) cũng chạy nền trong context IT — chờ trạng thái đích thay vì đoán ai xử job trước. */
    private void awaitState(long sessionId, String expected) throws InterruptedException {
        long deadline = System.currentTimeMillis() + 20_000;
        while (System.currentTimeMillis() < deadline) {
            String state = jdbcTemplate.queryForObject(
                    "SELECT state FROM speaking_exam_sessions WHERE id = ?", String.class, sessionId);
            if (expected.equals(state)) {
                return;
            }
            Thread.sleep(150);
        }
        assertThat(jdbcTemplate.queryForObject(
                "SELECT state FROM speaking_exam_sessions WHERE id = ?", String.class, sessionId))
                .as("phiên %s phải đạt trạng thái %s trong 20s", sessionId, expected)
                .isEqualTo(expected);
    }

    @Test
    @DisplayName("F-01: job chấm lỗi → GRADING_FAILED (không kẹt GRADING); regrade → job mới → RESULTS; regrade sau RESULTS → 409")
    void failedGradingFlipsSessionAndRegradeRecovers() throws Exception {
        // MỌI Teil phải có lời nói: Teil im lặng được code chấm 0 điểm với scored=true (N1c-1),
        // nên chỉ cần MỘT Teil im lặng là grade() không bao giờ rơi vào "scored == 0" và sẽ phát
        // hành phiếu dù LLM chết. Nói 1 lượt mỗi Teil → khi provider chết, cả 3 Teil đều unscored
        // → handler ném. LLM sống lúc nộp lượt; giả chết TRƯỚC advance cuối (advance không gọi
        // LLM) — đóng cửa race với worker nền tick 2s: bất kể ai claim job, chấm đều fail.
        llmHealthy();
        ExamSessionView s = sessionService.create(userId, new CreateExamSessionRequest("GOETHE", "A1", "MOCK", null));
        sessionService.submitTextTurn(userId, s.id(),
                "Ich heiße Minh, ich bin 24 Jahre alt und komme aus Vietnam. Ich wohne in Hanoi und bin Student.");
        sessionService.advance(userId, s.id());
        sessionService.submitTextTurn(userId, s.id(), "Was trinken Sie gern zum Frühstück?");
        sessionService.advance(userId, s.id());
        sessionService.submitTextTurn(userId, s.id(), "Können Sie bitte die Tür öffnen?");
        llmDead();
        ExamSessionView graded = sessionService.advance(userId, s.id());
        assertThat(graded.state()).isEqualTo(SpeakingExamSession.STATE_GRADING);
        assertThat(graded.gradingJobId()).isNotNull();
        long firstJobId = graded.gradingJobId();

        worker.processPendingJobs();
        awaitState(s.id(), SpeakingExamSession.STATE_GRADING_FAILED);
        AiJob firstJob = aiJobRepository.findById(firstJobId).orElseThrow();
        assertThat(firstJob.getStatus()).isEqualTo(AiJob.STATUS_FAILED);
        assertThat(sessionService.get(userId, s.id()).state()).isEqualTo(SpeakingExamSession.STATE_GRADING_FAILED);

        // Chấm lại: LLM sống lại → job MỚI, quay về GRADING, worker chấm ra RESULTS.
        llmHealthy();
        ExamSessionView after = sessionService.regrade(userId, s.id());
        assertThat(after.state()).isEqualTo(SpeakingExamSession.STATE_GRADING);
        assertThat(after.gradingJobId()).isNotEqualTo(firstJobId);

        worker.processPendingJobs();
        awaitState(s.id(), SpeakingExamSession.STATE_RESULTS);
        assertThat(sessionService.result(userId, s.id()).total()).isNotNull();

        // Đã có phiếu thì không chấm lại nữa (đường regrade chỉ dành cho phiên chấm lỗi).
        assertThatThrownBy(() -> sessionService.regrade(userId, s.id())).isInstanceOf(ConflictException.class);
    }

    @Test
    @DisplayName("regrade khi phiên chưa từng chấm lỗi (IN_PART) → 409, không enqueue gì")
    void regradeRejectedOutsideFailedState() {
        llmHealthy();
        ExamSessionView s = sessionService.create(userId, new CreateExamSessionRequest("GOETHE", "A1", "MOCK", null));
        long jobsBefore = aiJobRepository.count();
        assertThatThrownBy(() -> sessionService.regrade(userId, s.id())).isInstanceOf(ConflictException.class);
        assertThat(aiJobRepository.count()).isEqualTo(jobsBefore);
    }

    @Test
    @DisplayName("Sweeper: GRADING + job FAILED (kẹt kiểu trước bản vá) → GRADING_FAILED; GRADING + job COMPLETED + result → RESULTS; job PENDING được để yên")
    void sweeperRescuesStuckSessions() throws Exception {
        // (A) GRADING + job FAILED — giả dữ liệu kẹt từ trước bản vá (onFailure chưa tồn tại khi đó).
        llmHealthy();
        ExamSessionView a = mockWithOneTurnToGrading();
        awaitState(a.id(), SpeakingExamSession.STATE_RESULTS); // worker nền chấm xong phiên A trước đã
        jdbcTemplate.update("UPDATE speaking_exam_sessions SET state = 'GRADING' WHERE id = ?", a.id());
        jdbcTemplate.update("UPDATE ai_jobs SET status = 'FAILED', error_msg = 'IT: gia lap job chet' WHERE id = ?",
                a.gradingJobId());
        jdbcTemplate.update("UPDATE speaking_exam_sessions SET updated_at = NOW() - make_interval(mins => 10) WHERE id = ?", a.id());
        // Phiên A có result row (worker đã chấm) — nhưng job FAILED nên nhánh dead-job thắng? KHÔNG:
        // nhánh completed-result đòi job COMPLETED. A rơi đúng nhánh dead-job → GRADING_FAILED.

        // (B) di chứng persist không-atomic: GRADING + job COMPLETED + result đã ghi → phải về RESULTS.
        ExamSessionView b = mockWithOneTurnToGrading();
        awaitState(b.id(), SpeakingExamSession.STATE_RESULTS);
        jdbcTemplate.update("UPDATE speaking_exam_sessions SET state = 'GRADING', updated_at = NOW() - make_interval(mins => 10) WHERE id = ?", b.id());

        // (C) GRADING + job PENDING còn tươi (giả enqueue xong chưa claim) — sweep không được đụng.
        ExamSessionView c = mockWithOneTurnToGrading();
        awaitState(c.id(), SpeakingExamSession.STATE_RESULTS);
        jdbcTemplate.update("UPDATE speaking_exam_sessions SET state = 'GRADING', updated_at = NOW() - make_interval(mins => 10) WHERE id = ?", c.id());
        jdbcTemplate.update("UPDATE ai_jobs SET status = 'PENDING', updated_at = NOW() WHERE id = ?", c.gradingJobId());

        sweeper.sweepStuckGradingSessions();

        assertThat(state(a.id())).isEqualTo(SpeakingExamSession.STATE_GRADING_FAILED);
        assertThat(state(b.id())).isEqualTo(SpeakingExamSession.STATE_RESULTS);
        assertThat(state(c.id())).isEqualTo(SpeakingExamSession.STATE_GRADING);
    }

    @Test
    @DisplayName("F-02: lease PROCESSING — job mồ côi quá 30' bị đánh FAILED kèm STALE_PROCESSING_EXPIRED; job đang chạy được để yên")
    void staleProcessingLeaseExpiresOrphans() {
        AiJob orphan = aiJobRepository.save(AiJob.builder()
                .jobType("UNKNOWN_TYPE_FOR_TEST").userId(userId).status(AiJob.STATUS_PROCESSING)
                .payload(Map.of("x", 1)).build());
        AiJob active = aiJobRepository.save(AiJob.builder()
                .jobType("UNKNOWN_TYPE_FOR_TEST").userId(userId).status(AiJob.STATUS_PROCESSING)
                .payload(Map.of("x", 2)).build());
        jdbcTemplate.update("UPDATE ai_jobs SET updated_at = NOW() - make_interval(mins => 40) WHERE id = ?",
                orphan.getId());

        maintenance.expireStaleProcessing();

        AiJob deadJob = aiJobRepository.findById(orphan.getId()).orElseThrow();
        assertThat(deadJob.getStatus()).isEqualTo(AiJob.STATUS_FAILED);
        assertThat(deadJob.getErrorMsg()).contains("STALE_PROCESSING_EXPIRED");
        assertThat(aiJobRepository.findById(active.getId()).orElseThrow().getStatus())
                .isEqualTo(AiJob.STATUS_PROCESSING);
    }

    private String state(long sessionId) {
        return sessionRepository.findById(sessionId).orElseThrow().getState();
    }
}
