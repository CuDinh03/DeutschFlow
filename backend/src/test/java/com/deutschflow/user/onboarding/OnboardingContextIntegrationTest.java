package com.deutschflow.user.onboarding;

import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * {@code GET /api/onboarding/context} trên Postgres THẬT, với {@code QuotaService} thật. Test đơn vị
 * mock {@code QuotaService} nên không thấy được lỗi 500 trên production: giao dịch chỉ đọc của service
 * chặn câu UPDATE đối soát gói. Lớp này không đặt {@code @Transactional} để giao dịch của service là
 * giao dịch ngoài cùng, đúng như khi chạy thật.
 *
 * Self-skips khi không có Postgres — xem {@link AbstractPostgresIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("GET /api/onboarding/context — Postgres thật")
class OnboardingContextIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String CONTEXT = "/api/onboarding/context";

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private OrganizationRepository organizationRepo;
    @Autowired private OrgMemberRepository memberRepo;
    @Autowired private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("Người tự đăng ký: 200, cửa SELF, không có trung tâm")
    void selfAccount() throws Exception {
        User student = student(User.CreatedVia.SELF);

        mockMvc.perform(get(CONTEXT).with(user(student)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accountSource").value("SELF"))
                .andExpect(jsonPath("$.hasPlan").value(false))
                .andExpect(jsonPath("$.trial.isTrial").value(false));
    }

    @Test
    @DisplayName("Học viên nhập từ danh sách trung tâm: 200, cửa ORG_ROSTER, có tên trung tâm")
    void rosterStudent() throws Exception {
        Organization org = organizationRepo.save(Organization.builder()
                .name("TT onboarding " + UUID.randomUUID().toString().substring(0, 8))
                .slug("onb-it-" + UUID.randomUUID())
                .seatLimit(50)
                .status("ACTIVE")
                .build());
        User student = student(User.CreatedVia.CSV);
        memberRepo.save(OrgMember.builder()
                .id(new OrgMemberId(org.getId(), student.getId()))
                .role("STUDENT")
                .status("ACTIVE")
                .joinedAt(Instant.now())
                .build());

        mockMvc.perform(get(CONTEXT).with(user(student)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accountSource").value("ORG_ROSTER"))
                .andExpect(jsonPath("$.hasPlan").value(false))
                .andExpect(jsonPath("$.org.name").value(org.getName()));
    }

    @Test
    @DisplayName("Gói dùng thử đã hết hạn: 200 và việc đối soát được lưu lại")
    void reconcilesExpiredTrial() throws Exception {
        User student = student(User.CreatedVia.SELF);
        Instant now = Instant.now();
        jdbcTemplate.update("""
                        INSERT INTO user_subscriptions (user_id, plan_code, status, starts_at, ends_at, source)
                        VALUES (?, 'FREE', 'ACTIVE', ?, ?, 'TRIAL')
                        """,
                student.getId(), Timestamp.from(now.minus(8, ChronoUnit.DAYS)),
                Timestamp.from(now.minus(1, ChronoUnit.DAYS)));

        mockMvc.perform(get(CONTEXT).with(user(student)))
                .andExpect(status().isOk());

        assertThat(jdbcTemplate.queryForObject(
                "SELECT status FROM user_subscriptions WHERE user_id = ?", String.class, student.getId()))
                .isEqualTo("ENDED");
    }

    private User student(User.CreatedVia createdVia) {
        return userRepository.save(User.builder()
                .email("onb-it-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("Onboarding IT")
                .role(User.Role.STUDENT)
                .createdVia(createdVia)
                .build());
    }
}
