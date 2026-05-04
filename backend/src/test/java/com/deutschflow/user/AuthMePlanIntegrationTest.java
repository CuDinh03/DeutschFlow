package com.deutschflow.user;

import com.deutschflow.common.security.JwtService;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AuthMePlanIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void plan_without_subscription_reconcilesToDefault_and_returnsBasic() throws Exception {
        User u = student("plan-default@test.com");

        String bearer = jwtService.generateAccessToken(u);

        mockMvc.perform(get("/api/auth/me/plan").header("Authorization", "Bearer " + bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.planCode").value("DEFAULT"))
                .andExpect(jsonPath("$.tier").value("BASIC"))
                .andExpect(jsonPath("$.startsAtUtc").exists())
                .andExpect(jsonPath("$.endsAtUtc").value(nullValue()));
    }

    @Test
    void plan_activePro_returnsPremiumTier() throws Exception {
        User u = student("plan-pro@test.com");
        int inserted = jdbcTemplate.update("""
                        INSERT INTO user_subscriptions (user_id, plan_code, status, starts_at)
                        VALUES (?, 'PRO', 'ACTIVE', ?)
                        """,
                u.getId(), Timestamp.valueOf("2020-01-01 00:00:00"));
        assertThat(inserted).isEqualTo(1);

        mockMvc.perform(get("/api/auth/me/plan").header("Authorization", "Bearer " + jwtService.generateAccessToken(u)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.planCode").value("PRO"))
                .andExpect(jsonPath("$.tier").value("PREMIUM"))
                .andExpect(jsonPath("$.startsAtUtc").exists())
                .andExpect(jsonPath("$.endsAtUtc").value(nullValue()));
    }

    @Test
    void publicTier_mapsInternalToUltra_forLabels() {
        assertThat(QuotaService.publicTier("INTERNAL")).isEqualTo("ULTRA");
        assertThat(QuotaService.publicTier("ULTRA")).isEqualTo("ULTRA");
        assertThat(QuotaService.publicTier("PRO")).isEqualTo("PREMIUM");
    }

    private User student(String email) {
        User saved = userRepository.save(User.builder()
                .email(email)
                .passwordHash("$2a$10$hashhashhashhashhashhashhashhash")
                .displayName("Plan Test")
                .role(User.Role.STUDENT)
                .build());
        userRepository.flush();
        return saved;
    }
}
