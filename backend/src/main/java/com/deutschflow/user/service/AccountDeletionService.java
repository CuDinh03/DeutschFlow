package com.deutschflow.user.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Permanently deletes a learner account and all associated data.
 *
 * Most child tables reference users(id) with ON DELETE CASCADE, so deleting the
 * users row removes them automatically. A handful of tables use a plain (non
 * cascading) FK and would otherwise block the delete — those are removed first,
 * in dependency order, within the same transaction.
 *
 * Required for App Store Guideline 5.1.1(v): in-app account deletion.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AccountDeletionService {

    private final JdbcTemplate jdbc;

    /** Tables with a non-cascading FK to users(id) that must be cleared first. */
    private static final String[] NON_CASCADING_BY_USER_ID = {
            "b1_assessment_states",
            "learner_phase_states",
            "learning_review_items",
            "grammar_feedback_events",
            "placement_test_sessions",
    };

    @Transactional
    public void deleteAccount(long userId) {
        for (String table : NON_CASCADING_BY_USER_ID) {
            jdbc.update("DELETE FROM " + table + " WHERE user_id = ?", userId);
        }
        // teacher_sessions references the learner via student_id (non-cascading).
        jdbc.update("DELETE FROM teacher_sessions WHERE student_id = ?", userId);

        // Remaining FKs cascade (ON DELETE CASCADE) or set null on this delete.
        int rows = jdbc.update("DELETE FROM users WHERE id = ?", userId);
        log.info("Account deletion completed for userId={} (rows={})", userId, rows);
    }
}
