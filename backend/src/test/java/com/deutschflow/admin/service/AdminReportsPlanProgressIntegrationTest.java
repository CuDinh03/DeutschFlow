package com.deutschflow.admin.service;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * Regression guard for the admin "Báo cáo hệ thống" outage (A-11, QA 2026-08-15).
 *
 * <p>{@code learning_plans.plan_json} is {@code JSONB}; JdbcTemplate returns it as a
 * {@code PGobject}, so the old {@code (String) row.get("planJson")} cast in
 * {@link AdminManagementService#studentPlanProgress()} threw {@code ClassCastException} → 500 for
 * every student that had a plan → the whole reports page (a {@code Promise.all}) went down. A unit
 * test that mocks JdbcTemplate can never catch this (it never runs the real SQL), so this contract
 * runs against a real Postgres. Self-skips when no DB is available — see
 * {@link AbstractPostgresIntegrationTest}.
 */
@SpringBootTest
@DisplayName("admin reports · studentPlanProgress reads JSONB plan_json without 500")
class AdminReportsPlanProgressIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private AdminManagementService adminManagementService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("does not throw when a student has a JSONB learning plan (A-11)")
    void studentWithJsonbPlan_doesNotThrow() {
        User learner = userRepository.save(User.builder()
                .email("plan-progress-" + System.nanoTime() + "@local.test")
                .passwordHash("x")
                .displayName("Plan Progress QA")
                .role(User.Role.STUDENT)
                .build());

        jdbcTemplate.update("""
                INSERT INTO user_learning_profiles
                  (user_id, goal_type, target_level, sessions_per_week, minutes_per_session)
                VALUES (?, 'EXAM', 'B1', 3, 30)
                """, learner.getId());
        Long profileId = jdbcTemplate.queryForObject(
                "SELECT id FROM user_learning_profiles WHERE user_id = ?", Long.class, learner.getId());

        // A real JSONB value is what reproduces the PGobject cast — insert via CAST(? AS jsonb).
        jdbcTemplate.update("""
                INSERT INTO learning_plans
                  (user_id, profile_id, goal_type, target_level, current_level,
                   sessions_per_week, minutes_per_session, weekly_minutes, weeks_total, plan_json)
                VALUES (?, ?, 'EXAM', 'B1', 'A2', 3, 30, 90, 8, CAST(? AS jsonb))
                """,
                learner.getId(), profileId,
                "{\"sessionsPerWeek\":3,\"weeks\":[{\"sessions\":[\"s1\",\"s2\",\"s3\"]}]}");

        // The regression itself: the old (String) cast on the PGobject threw here.
        assertThatCode(adminManagementService::studentPlanProgress)
                .as("A-11: JSONB plan_json must not blow up studentPlanProgress()")
                .doesNotThrowAnyException();

        List<Map<String, Object>> rows = adminManagementService.studentPlanProgress();
        assertThat(rows).anySatisfy(row -> {
            assertThat(((Number) row.get("studentId")).longValue()).isEqualTo(learner.getId());
            // completedSessions=0 (no progress seeded) → progress 0, but the JSON WAS parsed.
            assertThat(row).containsKey("planProgressPercent");
        });
    }
}
