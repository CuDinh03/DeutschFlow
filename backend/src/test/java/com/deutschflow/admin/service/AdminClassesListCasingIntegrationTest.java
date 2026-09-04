package com.deutschflow.admin.service;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Regression guard for the admin "Lớp học" display bug (A-12, QA 2026-08-15).
 *
 * <p>{@code listClasses()} aliased columns as {@code AS teacherName}/{@code AS studentCount}
 * (unquoted), which PostgreSQL folds to lowercase labels {@code teachername}/{@code studentcount}.
 * Spring's {@code LinkedCaseInsensitiveMap} hides that server-side — {@code map.get("teacherName")}
 * still resolves — so the bug ONLY surfaces once the map is serialized to JSON (Jackson emits the
 * stored, lowercase key) and both admin FE pages (v1 + v2) read {@code c.teacherName}/{@code
 * c.studentCount} → every class showed "chưa phân công · 0 HV". Hence this asserts the serialized
 * JSON, not the map. Self-skips without a DB — see {@link AbstractPostgresIntegrationTest}.
 */
@SpringBootTest
@DisplayName("admin classes · listClasses serializes camelCase JSON keys")
class AdminClassesListCasingIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private AdminManagementService adminManagementService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @DisplayName("teacherName / studentCount reach the FE as camelCase, not lowercase (A-12)")
    void listClasses_jsonKeysAreCamelCase() throws Exception {
        long stamp = System.nanoTime();
        User teacher = userRepository.save(User.builder()
                .email("class-casing-teacher-" + stamp + "@local.test")
                .passwordHash("x").displayName("Cô Casing").role(User.Role.TEACHER).build());
        User student = userRepository.save(User.builder()
                .email("class-casing-student-" + stamp + "@local.test")
                .passwordHash("x").displayName("HV Casing").role(User.Role.STUDENT).build());

        jdbcTemplate.update("""
                INSERT INTO teacher_classes (teacher_id, name, invite_code, created_at)
                VALUES (?, ?, ?, NOW())
                """, teacher.getId(), "QA Casing Class " + stamp, "CASE" + stamp);
        Long classId = jdbcTemplate.queryForObject(
                "SELECT id FROM teacher_classes WHERE invite_code = ?", Long.class, "CASE" + stamp);
        jdbcTemplate.update(
                "INSERT INTO class_students (class_id, student_id, joined_at) VALUES (?, ?, NOW())",
                classId, student.getId());

        List<Map<String, Object>> classes = adminManagementService.listClasses();

        // The actual FE contract: JSON keys must be camelCase (Jackson emits the stored key case).
        String json = objectMapper.writeValueAsString(classes);
        assertThat(json)
                .as("A-12: FE reads c.teacherName / c.studentCount — JSON must use those exact keys")
                .contains("\"teacherName\"")
                .contains("\"studentCount\"")
                .doesNotContain("\"teachername\"")
                .doesNotContain("\"studentcount\"");

        Map<String, Object> seeded = classes.stream()
                .filter(c -> ((Number) c.get("id")).longValue() == classId)
                .findFirst().orElseThrow();
        assertThat(seeded.get("teacherName")).isEqualTo("Cô Casing");
        assertThat(((Number) seeded.get("studentCount")).longValue()).isEqualTo(1L);
    }
}
