package com.deutschflow.user.service;

import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Timestamp;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * G-09 / D6 trên Postgres THẬT — cửa hậu "xoá tài khoản = xoá dữ liệu của trung tâm".
 *
 * <p>Mock không kiểm được thứ quan trọng nhất ở đây: {@code teacher_classes.teacher_id → users(id)
 * ON DELETE CASCADE} (V196). Chính ràng buộc đó biến một lệnh xoá tài khoản giáo viên thành lệnh
 * xoá cả cây lớp học — đi vòng qua chốt 409 của {@code ClassDeletionGuard}. Ca cuối cùng chứng minh
 * đúng đường cascade đó là có thật.
 */
@SpringBootTest
@DisplayName("Xoá tài khoản khi còn dính trung tâm (D6)")
class AccountDeletionOrgGuardIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private AccountDeletionService accountDeletionService;

    private static final String EMAIL_PREFIX = "acctdel-it-";
    private static final String SLUG_PREFIX = "acctdel-it-";

    @AfterEach
    void tearDown() {
        String owned = "(SELECT id FROM users WHERE email LIKE '" + EMAIL_PREFIX + "%')";
        jdbcTemplate.update("DELETE FROM class_teachers WHERE teacher_id IN " + owned);
        jdbcTemplate.update("DELETE FROM teacher_classes WHERE teacher_id IN " + owned);
        jdbcTemplate.update("DELETE FROM org_members WHERE user_id IN " + owned);
        jdbcTemplate.update("DELETE FROM users WHERE email LIKE '" + EMAIL_PREFIX + "%'");
        jdbcTemplate.update("DELETE FROM organizations WHERE slug LIKE '" + SLUG_PREFIX + "%'");
    }

    // ------------------------------------------------------------------ helpers

    private Long newUser(String tag) {
        return userRepository.save(User.builder()
                .email(EMAIL_PREFIX + tag + "-" + System.nanoTime() + "@test.com")
                .passwordHash("$2a$10$h").displayName("Xoá TK IT")
                .role(User.Role.STUDENT).build()).getId();
    }

    private Long newOrg(String name) {
        Timestamp now = Timestamp.from(Instant.now());
        return jdbcTemplate.queryForObject("""
                INSERT INTO organizations (name, slug, status, seat_limit, created_at, updated_at)
                VALUES (?, ?, 'ACTIVE', 0, ?, ?) RETURNING id
                """, Long.class, name, SLUG_PREFIX + System.nanoTime(), now, now);
    }

    private void member(Long orgId, Long userId, String role, String status) {
        jdbcTemplate.update("""
                INSERT INTO org_members (org_id, user_id, role, status, joined_at)
                VALUES (?, ?, ?, ?, now())
                """, orgId, userId, role, status);
    }

    /** Lớp của trung tâm do {@code teacherId} phụ trách chính. */
    private Long orgClass(Long orgId, Long teacherId) {
        Timestamp now = Timestamp.from(Instant.now());
        return jdbcTemplate.queryForObject("""
                INSERT INTO teacher_classes (teacher_id, name, invite_code, created_at, updated_at, org_id)
                VALUES (?, 'Lớp A1.1', ?, ?, ?, ?) RETURNING id
                """, Long.class, teacherId, "IT" + System.nanoTime(), now, now, orgId);
    }

    private boolean userExists(Long userId) {
        Integer n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM users WHERE id = ?", Integer.class, userId);
        return n != null && n > 0;
    }

    // ------------------------------------------------------------------ ca kiểm

    @Test
    @DisplayName("người dùng thường (không thuộc trung tâm) vẫn tự xoá được tài khoản")
    void plainLearner_stillDeletable() {
        Long userId = newUser("plain");

        accountDeletionService.deleteAccount(userId);

        assertThat(userExists(userId)).isFalse();
    }

    @Test
    @DisplayName("học viên ACTIVE của trung tâm → 409, tài khoản CÒN NGUYÊN, chỉ dẫn cách rời")
    void activeStudentMember_blocked() {
        Long orgId = newOrg("Trung tâm Beta");
        Long userId = newUser("student");
        member(orgId, userId, "STUDENT", "ACTIVE");

        assertThatThrownBy(() -> accountDeletionService.deleteAccount(userId))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("Trung tâm Beta")
                .hasMessageContaining("Rời trung tâm");

        assertThat(userExists(userId)).isTrue();
    }

    @Test
    @DisplayName("giáo viên còn phụ trách lớp của trung tâm → 409 nêu SỐ LỚP; lớp không mất")
    void activeTeacherWithClasses_blocked() {
        Long orgId = newOrg("Trung tâm Gamma");
        Long teacherId = newUser("teacher");
        member(orgId, teacherId, "TEACHER", "ACTIVE");
        Long classId = orgClass(orgId, teacherId);

        assertThatThrownBy(() -> accountDeletionService.deleteAccount(teacherId))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("giáo viên")
                .hasMessageContaining("1 lớp")
                .hasMessageContaining("bàn giao");

        assertThat(userExists(teacherId)).isTrue();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM teacher_classes WHERE id = ?", Integer.class, classId)).isOne();
    }

    @Test
    @DisplayName("giám đốc → 409 đòi chuyển quyền sở hữu trước")
    void owner_blockedWithTransferInstruction() {
        Long orgId = newOrg("Trung tâm Delta");
        Long ownerId = newUser("owner");
        member(orgId, ownerId, "OWNER", "ACTIVE");

        assertThatThrownBy(() -> accountDeletionService.deleteAccount(ownerId))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("chuyển quyền sở hữu");
    }

    @Test
    @DisplayName("membership REVOKED và không còn lớp nào → xoá được (chốt không nhốt người đã rời)")
    void formerMemberWithoutClasses_deletable() {
        Long orgId = newOrg("Trung tâm Epsilon");
        Long userId = newUser("former");
        member(orgId, userId, "STUDENT", "REVOKED");

        assertThatCode(() -> accountDeletionService.deleteAccount(userId)).doesNotThrowAnyException();

        assertThat(userExists(userId)).isFalse();
    }

    @Test
    @DisplayName("đã rời trung tâm nhưng còn đứng tên lớp của trung tâm → vẫn chặn")
    void formerMemberStillOwningOrgClass_blocked() {
        Long orgId = newOrg("Trung tâm Zeta");
        Long teacherId = newUser("former-teacher");
        member(orgId, teacherId, "TEACHER", "LEFT");
        orgClass(orgId, teacherId);

        assertThatThrownBy(() -> accountDeletionService.deleteAccount(teacherId))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("không còn là thành viên")
                .hasMessageContaining("1 lớp");
    }

    @Test
    @DisplayName("BẰNG CHỨNG cửa hậu: xoá users CÓ cascade sang teacher_classes (V196)")
    void deletingUserCascadesClasses_proofOfBackdoor() {
        Long orgId = newOrg("Trung tâm Eta");
        Long teacherId = newUser("cascade-proof");
        Long classId = orgClass(orgId, teacherId);
        // Không có membership, không đi qua nhánh chặn nào — xoá thẳng dòng users như trước đây.
        jdbcTemplate.update("DELETE FROM teacher_classes WHERE id = ?", classId);
        Long keptClass = orgClass(orgId, teacherId);
        jdbcTemplate.update("DELETE FROM class_teachers WHERE teacher_id = ?", teacherId);

        jdbcTemplate.update("DELETE FROM users WHERE id = ?", teacherId);

        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM teacher_classes WHERE id = ?", Integer.class, keptClass))
                .as("teacher_classes.teacher_id là ON DELETE CASCADE — xoá tài khoản giáo viên là "
                        + "xoá cả lớp, đó chính là cửa hậu mà chốt D6 bịt")
                .isZero();
    }
}
