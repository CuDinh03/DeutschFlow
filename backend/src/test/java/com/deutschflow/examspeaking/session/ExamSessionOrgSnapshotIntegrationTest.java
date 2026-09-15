package com.deutschflow.examspeaking.session;

import com.deutschflow.examspeaking.dto.CreateExamSessionRequest;
import com.deutschflow.examspeaking.entity.SpeakingExamSession;
import com.deutschflow.examspeaking.repository.SpeakingExamSessionRepository;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
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
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.when;

/**
 * V320 §1 trên PostgreSQL THẬT: phiên thi nói MỚI mang {@code org_id} TƯỜNG MINH lúc tạo.
 *
 * <p>Trước bản vá, entity không có trường {@code orgId} nên cột chỉ được backfill cho dòng cũ, còn
 * mọi phiên mới đều NULL — {@code MinorAudioOrgSnapshotResolver} rơi xuống sổ đồng ý/giám hộ, và vết
 * dọn 30 ngày sau ra {@code org_id} NULL nên giám đốc không thấy. Không unit test nào bắt được điều
 * đó: builder có gán hay không, Hibernate có ghi cột hay không, chỉ DB thật mới trả lời.
 *
 * <p>Cấu hình giống hệt {@code ExamSessionFlowIntegrationTest} (cùng thuộc tính, cùng MockBean) để
 * hai lớp dùng chung một Spring context khi chạy cùng nhau.
 */
@SpringBootTest
@TestPropertySource(properties = {
        "app.examspeaking.allow-text-turns-in-mock=true",
        "app.examspeaking.grading-passes=1"
})
@DisplayName("speaking_exam_sessions.org_id — ảnh chụp trung tâm lúc tạo phiên (V320 §1)")
class ExamSessionOrgSnapshotIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private ExamSessionService sessionService;
    @Autowired private SpeakingExamSessionRepository sessionRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private OrganizationRepository organizationRepository;
    @Autowired private OrgMemberRepository orgMemberRepository;
    @Autowired private JdbcTemplate jdbcTemplate;
    @MockBean private OpenAiChatClient chatClient;

    @BeforeEach
    void llmGia() {
        when(chatClient.chatCompletionForTier(any(), any(), anyDouble(), anyInt(), anyBoolean())).thenAnswer(inv -> {
            List<ChatMessage> msgs = inv.getArgument(0);
            String user = msgs.get(msgs.size() - 1).content();
            String all = msgs.stream().map(ChatMessage::content).reduce("", (a, b) -> a + "\n" + b);
            return new AiChatCompletionResult(ExamSessionFlowIntegrationTest.fakeLlm(user, all),
                    TokenUsage.exact(120, 40, 160), "test", "fake-model");
        });
    }

    @Test
    @DisplayName("học viên thuộc trung tâm → phiên mới mang org_id của đúng trung tâm đó")
    void hocVienTrungTam_phienMangOrgId() {
        Organization org = org();
        long userId = student(org);
        membership(org, userId, "ACTIVE");

        long sessionId = create(userId);

        assertThat(orgIdOf(sessionId)).isEqualTo(org.getId());
    }

    @Test
    @DisplayName("học viên B2C → org_id NULL")
    void hocVienB2C_orgIdNull() {
        long userId = student(null);

        long sessionId = create(userId);

        assertThat(orgIdOf(sessionId)).isNull();
    }

    @Test
    @DisplayName("đã rời trung tâm (membership LEFT) → org_id NULL — chỉ membership ACTIVE mới tính")
    void daRoiTrungTam_orgIdNull() {
        Organization org = org();
        long userId = student(null);
        membership(org, userId, "LEFT");

        long sessionId = create(userId);

        assertThat(orgIdOf(sessionId)).isNull();
    }

    @Test
    @DisplayName("ảnh chụp KHÔNG trôi: rời trung tâm sau khi thi, cột vẫn giữ; save() từ mã cũng không ghi đè")
    void anhChupKhongTroi() {
        Organization org = org();
        long userId = student(org);
        membership(org, userId, "ACTIVE");
        long sessionId = create(userId);

        // Đúng kịch bản V320 §1 mô tả: 30 ngày sau, em ấy đã rời trung tâm — users.org_id về NULL.
        jdbcTemplate.update("UPDATE org_members SET status = 'LEFT', left_at = now() WHERE org_id = ? AND user_id = ?",
                org.getId(), userId);
        jdbcTemplate.update("UPDATE users SET org_id = NULL WHERE id = ?", userId);
        assertThat(orgIdOf(sessionId)).as("ảnh chụp không phụ thuộc users.org_id hôm nay").isEqualTo(org.getId());

        // Và updatable=false là thật: một lượt save đổi trường khác (kèm cố tình xoá orgId trên entity)
        // không chạm được cột — bỏ updatable=false thì ca này đỏ ngay.
        SpeakingExamSession s = sessionRepository.findById(sessionId).orElseThrow();
        s.setOrgId(null);
        s.setNotesText("ghi chú sau khi rời trung tâm");
        sessionRepository.saveAndFlush(s);
        assertThat(orgIdOf(sessionId)).as("updatable=false phải giữ ảnh chụp qua mọi lượt save").isEqualTo(org.getId());
    }

    // ── helpers ─────────────────────────────────────────────────────────────────────────────

    private Organization org() {
        return organizationRepository.save(Organization.builder()
                .name("TT " + UUID.randomUUID().toString().substring(0, 8))
                .slug("exam-org-" + UUID.randomUUID())
                .seatLimit(50)
                .status("ACTIVE")
                .build());
    }

    /** Học viên có ngân sách AI cá nhân (kênh 1 — STUDENT thuộc trung tâm vẫn tiêu ví cá nhân). */
    private long student(Organization org) {
        User u = userRepository.save(User.builder()
                .email("exam-org-it-" + UUID.randomUUID() + "@local.test")
                .passwordHash("$2a$10$h").displayName("Exam Org IT").role(User.Role.STUDENT)
                .orgId(org == null ? null : org.getId())
                .build());
        jdbcTemplate.update("INSERT INTO user_subscriptions (user_id, plan_code, status, starts_at, ends_at) VALUES (?, 'PRO', 'ACTIVE', ?, NULL)",
                u.getId(), Timestamp.from(Instant.parse("2026-01-01T00:00:00Z")));
        jdbcTemplate.update("INSERT INTO user_ai_token_wallets (user_id, balance, last_accrual_local_date) VALUES (?, ?, NULL)",
                u.getId(), 1_000_000L);
        return u.getId();
    }

    private void membership(Organization org, long userId, String status) {
        orgMemberRepository.save(OrgMember.builder()
                .id(new OrgMemberId(org.getId(), userId))
                .role("STUDENT")
                .status(status)
                .leftAt("ACTIVE".equals(status) ? null : Instant.now())
                .build());
    }

    private long create(long userId) {
        return sessionService.create(userId, new CreateExamSessionRequest("GOETHE", "A1", "DRILL", 2)).id();
    }

    private Long orgIdOf(long sessionId) {
        return jdbcTemplate.queryForObject("SELECT org_id FROM speaking_exam_sessions WHERE id = ?", Long.class, sessionId);
    }
}
