package com.deutschflow.user.service;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration coverage for {@link AccountDeletionService} against a real PostgreSQL.
 *
 * <p>Regression for the App Store 5.1.1(v) delete-account bug: the service was written before V228
 * ({@code messages}) and V241 ({@code class_channel_messages}) added non-cascading FKs to
 * {@code users(id)}, so deleting a learner who had ever sent/received a DM or posted in a class
 * channel threw a Postgres FK violation and rolled the whole delete back.
 *
 * <p>NOTE ON NAMING: this is a Testcontainers-backed test but is named {@code *Test} (not {@code *IT})
 * on purpose. In this project's pom, Surefire's default includes only match {@code *Test}/{@code *Tests}
 * and Failsafe includes only {@code *IntegrationTest}/{@code *ContractTest} — so {@code *IT} classes run
 * in NEITHER stage (they are orphaned). Naming it {@code *Test} makes it run in the Unit Tests CI stage
 * (which has Docker on ubuntu-latest) on every push/PR. Proper CI-stage cleanup is a Phase 2 item.
 */
@SpringBootTest
@DisplayName("Account deletion — DB coverage (App Store 5.1.1(v) FK)")
class AccountDeletionServiceDbTest extends AbstractPostgresIntegrationTest {

    @Autowired private AccountDeletionService accountDeletionService;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbc;

    @Test
    @DisplayName("deletes a learner who sent + received DMs and posted/moderated class-channel messages")
    void deletesLearnerWithMessagingHistory() {
        User learner = newUser(User.Role.STUDENT);
        User teacher = newUser(User.Role.TEACHER);
        User other = newUser(User.Role.STUDENT);

        // Direct messages: learner as sender AND as recipient (both non-cascading FKs).
        jdbc.update("INSERT INTO messages(sender_id, recipient_id, body) VALUES (?,?,?)",
                learner.getId(), teacher.getId(), "learner → teacher");
        jdbc.update("INSERT INTO messages(sender_id, recipient_id, body) VALUES (?,?,?)",
                teacher.getId(), learner.getId(), "teacher → learner");

        Long classId = jdbc.queryForObject(
                "INSERT INTO teacher_classes(teacher_id, name, invite_code, created_at) "
                        + "VALUES (?,?,?, now()) RETURNING id",
                Long.class, teacher.getId(), "K30 · B1", "INV-" + UUID.randomUUID());

        // Class-channel message posted BY the learner (sender_id, NOT NULL) → must be removed.
        jdbc.update("INSERT INTO class_channel_messages(class_id, sender_id, body) VALUES (?,?,?)",
                classId, learner.getId(), "learner's post");
        // Another member's message that the learner had moderated (deleted_by) → must survive, unlinked.
        jdbc.update("INSERT INTO class_channel_messages(class_id, sender_id, body, deleted_at, deleted_by) "
                        + "VALUES (?,?,?, now(), ?)",
                classId, other.getId(), "moderated post", learner.getId());

        accountDeletionService.deleteAccount(learner.getId());

        assertThat(userRepository.findById(learner.getId())).isEmpty();
        assertThat(countMessagesTouching(learner.getId())).isZero();
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM class_channel_messages WHERE sender_id = ?", Integer.class, learner.getId()))
                .isZero();
        // The moderated message stays, with the deleted_by reference cleared.
        assertThat(jdbc.queryForObject(
                "SELECT deleted_by FROM class_channel_messages WHERE class_id = ? AND sender_id = ?",
                Long.class, classId, other.getId()))
                .isNull();
        // Bystanders untouched.
        assertThat(userRepository.findById(teacher.getId())).isPresent();
        assertThat(userRepository.findById(other.getId())).isPresent();
    }

    /**
     * Regression net: every non-cascading FK to {@code users(id)} on a "subject" column (a column
     * that identifies the account owner) MUST be cleared by {@link AccountDeletionService} before the
     * users row is deleted — otherwise self-serve deletion FK-fails for real users. When a future
     * migration adds such an FK, this test fails and points at the exact table.column to handle.
     *
     * <p>Authorship/audit columns (created_by, invited_by, deleted_by, attached_by, teacher_id) are
     * intentionally exempt: they are the separate teacher/org-offboarding follow-up, not learner data.
     */
    @Test
    @DisplayName("no non-cascading users FK on a subject column is left unhandled by the service")
    void allSubjectColumnFksAreHandled() {
        Set<String> subjectColumns = Set.of("user_id", "student_id", "sender_id", "recipient_id");
        Set<String> handledByService = Set.of(
                "b1_assessment_states.user_id",
                "learner_phase_states.user_id",
                "learning_review_items.user_id",
                "grammar_feedback_events.user_id",
                "placement_test_sessions.user_id",
                "teacher_sessions.student_id",
                "messages.sender_id",
                "messages.recipient_id",
                "class_channel_messages.sender_id");

        // confdeltype: a=NO ACTION, r=RESTRICT, d=SET DEFAULT (all block a delete); c=CASCADE, n=SET NULL (safe).
        List<String> allNonCascadingFks = jdbc.queryForList(
                "SELECT con.conrelid::regclass::text || '.' || att.attname "
                        + "FROM pg_constraint con "
                        + "JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey) "
                        + "WHERE con.contype = 'f' AND con.confrelid = 'users'::regclass "
                        + "AND con.confdeltype IN ('a','r','d')",
                String.class);

        List<String> unhandledSubjectFks = allNonCascadingFks.stream()
                .filter(tc -> subjectColumns.contains(tc.substring(tc.indexOf('.') + 1)))
                .filter(tc -> !handledByService.contains(tc))
                .sorted()
                .toList();

        assertThat(unhandledSubjectFks)
                .as("Non-cascading users FK on a subject column not cleared by AccountDeletionService "
                        + "→ self-serve delete will FK-fail. Add a DELETE for each to AccountDeletionService "
                        + "(and to handledByService here).")
                .isEmpty();
    }

    private User newUser(User.Role role) {
        return userRepository.save(User.builder()
                .email("del-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("Delete Tester")
                .role(role)
                .build());
    }

    private Integer countMessagesTouching(long userId) {
        return jdbc.queryForObject(
                "SELECT count(*) FROM messages WHERE sender_id = ? OR recipient_id = ?",
                Integer.class, userId, userId);
    }
}
