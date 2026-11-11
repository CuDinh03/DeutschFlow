package com.deutschflow.ai.queue;

import com.deutschflow.speaking.entity.AiSpeakingSession;
import com.deutschflow.speaking.repository.AiSpeakingSessionRepository;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * {@code POST /api/jobs/interview-report} chỉ xếp job cho phiên luyện nói của CHÍNH người gọi.
 *
 * <p>Dùng QuotaService thật và KHÔNG khai {@code @MockBean}: lớp này phải dùng chung Spring context
 * với các IT {@code @SpringBootTest + @AutoConfigureMockMvc} khác — mỗi context riêng mở thêm một
 * pool kết nối và làm bộ IT chạm trần {@code max_connections} của Postgres trên CI. Chủ phiên được
 * cấp gói INTERNAL (không giới hạn) để qua cổng quota; người gọi còn lại KHÔNG có gói nào, nên nếu
 * cổng quota chạy trước bước kiểm sở hữu thì họ nhận 429 chứ không phải 404 — ca 404 vì vậy cũng
 * khẳng định thứ tự kiểm. Phiên seed KHÔNG có tin nhắn nào: nếu worker nền kịp claim job được chấp
 * nhận thì nó trả báo cáo rỗng mà không gọi AI.
 * Self-skips khi không có Postgres — xem {@link AbstractPostgresIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("interview-report: kiểm quyền sở hữu phiên trước khi xếp job")
class AiJobInterviewReportOwnershipIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private AiSpeakingSessionRepository sessionRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    private User owner;
    private User other;
    private Long sessionId;

    @BeforeEach
    void seed() {
        owner = upsert("aijob-report-owner@local.test");
        other = upsert("aijob-report-other@local.test");
        jdbcTemplate.update("""
                INSERT INTO user_subscriptions (user_id, plan_code, status, starts_at, ends_at)
                SELECT ?, 'INTERNAL', 'ACTIVE', NOW() - INTERVAL '1 hour', NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM user_subscriptions WHERE user_id = ? AND status = 'ACTIVE')
                """, owner.getId(), owner.getId());
        sessionId = sessionRepository.save(AiSpeakingSession.builder()
                .userId(owner.getId()).topic("IT interview report").sessionMode("INTERVIEW").build()).getId();
    }

    private User upsert(String email) {
        return userRepository.findByEmail(email).orElseGet(() -> userRepository.save(User.builder()
                .email(email).passwordHash("x").displayName(email).role(User.Role.STUDENT).build()));
    }

    private int interviewJobsOf(User u) {
        Integer n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM ai_jobs WHERE user_id = ? AND job_type = ?",
                Integer.class, u.getId(), AiJob.TYPE_INTERVIEW_REPORT);
        return n == null ? 0 : n;
    }

    private String body(Object rawSessionId) {
        return "{\"sessionId\":" + rawSessionId + "}";
    }

    @Test
    @DisplayName("chủ phiên → 202, có job mới mang sessionId đã chuẩn hoá")
    void ownerIsAccepted() throws Exception {
        int before = interviewJobsOf(owner);

        mockMvc.perform(post("/api/jobs/interview-report").with(user(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(body(sessionId)))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.jobId").isNumber());

        assertThat(interviewJobsOf(owner)).isEqualTo(before + 1);
        Long stored = jdbcTemplate.queryForObject(
                "SELECT (payload->>'sessionId')::bigint FROM ai_jobs WHERE user_id = ? AND job_type = ? "
                        + "ORDER BY id DESC LIMIT 1",
                Long.class, owner.getId(), AiJob.TYPE_INTERVIEW_REPORT);
        assertThat(stored).isEqualTo(sessionId);
    }

    @Test
    @DisplayName("người không sở hữu phiên → 404 (trước cổng quota), không có job mới")
    void nonOwnerGets404AndNoJob() throws Exception {
        int before = interviewJobsOf(other);

        mockMvc.perform(post("/api/jobs/interview-report").with(user(other))
                        .contentType(MediaType.APPLICATION_JSON).content(body(sessionId)))
                .andExpect(status().isNotFound());

        assertThat(interviewJobsOf(other)).isEqualTo(before);
    }

    @Test
    @DisplayName("phiên không tồn tại → 404 như trường hợp không sở hữu")
    void missingSessionGets404() throws Exception {
        int before = interviewJobsOf(owner);

        mockMvc.perform(post("/api/jobs/interview-report").with(user(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(body(Long.MAX_VALUE / 4)))
                .andExpect(status().isNotFound());

        assertThat(interviewJobsOf(owner)).isEqualTo(before);
    }

    @Test
    @DisplayName("sessionId không phải số nguyên dương → 400, không có job mới")
    void invalidSessionIdGets400() throws Exception {
        int before = interviewJobsOf(owner);

        for (String raw : new String[] {"\"abc\"", "1.5", "-3", "[1]", "null"}) {
            mockMvc.perform(post("/api/jobs/interview-report").with(user(owner))
                            .contentType(MediaType.APPLICATION_JSON).content(body(raw)))
                    .andExpect(status().isBadRequest());
        }

        assertThat(interviewJobsOf(owner)).isEqualTo(before);
    }
}
