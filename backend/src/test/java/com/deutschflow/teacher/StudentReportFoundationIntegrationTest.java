package com.deutschflow.teacher;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.minor.ConsentDraft;
import com.deutschflow.common.minor.ConsentState;
import com.deutschflow.common.minor.MinorLearnerService;
import com.deutschflow.common.minor.StudentConsent;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.teacher.entity.AssignmentStatus;
import com.deutschflow.teacher.entity.StudentAssignment;
import com.deutschflow.teacher.entity.StudentReportIssue;
import com.deutschflow.teacher.repository.StudentAssignmentRepository;
import com.deutschflow.teacher.repository.StudentReportIssueRepository;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.testsupport.PostgresIntegrationDb;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import com.deutschflow.user.service.AccountDeletionService;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SimpleDriverDataSource;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * PR-R1 (owner chốt R2/R3/R6/R10/E6 ngày 10/09/2026) — nền dữ liệu "phiếu đánh giá gửi phụ huynh" trên
 * PostgreSQL THẬT. Những thứ chỉ DB thật mới chứng minh được, và đều là thứ không vá được sau khi pilot
 * đã có bài chấm đầu tiên:
 * <ol>
 *   <li>V323 áp SẠCH trên DB trắng; ba cột {@code ai_*} đúng kiểu; bảng phiếu, CHECK, index, FK đúng hình;</li>
 *   <li><b>backfill</b> thật sự chép đề xuất AI của dòng AI_GRADED và để NULL dòng EVALUATED — chứng minh
 *       bằng cách replay Flyway tới V322 trên một DB PHỤ, chèn dữ liệu "trước V323", rồi migrate tiếp;</li>
 *   <li>trigger bất biến của {@code student_report_issues}: chặn đúng nhóm cột nội dung, cho qua nhóm
 *       token/thu hồi/lượt xem, và KHÔNG chặn {@code ON DELETE CASCADE/SET NULL} (bẫy V319);</li>
 *   <li>CHECK scope đồng ý nhận {@code GUARDIAN_REPORT_SHARING} (R6) và vẫn từ chối giá trị lạ;</li>
 *   <li>entity mới ánh xạ đúng dưới {@code ddl-auto: validate} và các đường đọc của repository đúng nghĩa.</li>
 * </ol>
 *
 * <p>🪤 <b>Không đặt {@code @Transactional} lên lớp này</b> — trigger {@code RAISE EXCEPTION} huỷ transaction
 * đang mở; các ca "phải ném" cần mỗi câu lệnh chạy auto-commit riêng (cùng lý do
 * {@code MinorFoundationIntegrationTest}).
 */
@SpringBootTest
@DisplayName("Nền phiếu đánh giá gửi phụ huynh — Integration (V323, R2/R3/R6/R10/E6)")
class StudentReportFoundationIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private JdbcTemplate jdbc;
    @Autowired private UserRepository userRepository;
    @Autowired private OrganizationRepository organizationRepo;
    @Autowired private StudentReportIssueRepository issueRepository;
    @Autowired private StudentAssignmentRepository studentAssignmentRepository;
    @Autowired private MinorLearnerService minorLearnerService;
    @Autowired private AccountDeletionService accountDeletionService;
    @Autowired private TransactionTemplate transactionTemplate;

    // ── 1. Migration ────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("V323 áp sạch trên DB trắng")
    class MigrationApplied {

        @Test
        @DisplayName("V323 có trong flyway_schema_history với success=true, và KHÔNG migration nào thất bại")
        void v323_appliedSuccessfully_andNothingFailed() {
            // Cố ý KHÔNG khẳng định V323 là bản mới nhất — ca như thế đỏ ngay khi đợt sau thêm V324.
            assertThat(jdbc.queryForObject(
                    "SELECT COUNT(*) FROM flyway_schema_history WHERE version = '323' AND success", Long.class))
                    .as("V323 phải có mặt và success — 0 nghĩa là DB này chưa chạy migration")
                    .isEqualTo(1L);
            List<String> failed = jdbc.queryForList(
                    "SELECT version FROM flyway_schema_history WHERE NOT success", String.class);
            assertThat(failed).as("migration thất bại còn sót trong lịch sử").isEmpty();
        }
    }

    // ── 2. Hình dạng schema ─────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Hình dạng schema — cột, CHECK, index, FK")
    class SchemaShape {

        @Test
        @DisplayName("student_assignments có ba cột ai_* ĐÚNG KIỂU; class_students.reserved_until là TIMESTAMPTZ")
        void newColumns_exist_withRightTypes() {
            assertThat(columnType("student_assignments", "ai_score")).isEqualTo("integer");
            assertThat(columnType("student_assignments", "ai_feedback")).isEqualTo("text");
            assertThat(columnType("student_assignments", "ai_graded_at")).isEqualTo("timestamp with time zone");
            assertThat(columnType("class_students", "reserved_until")).isEqualTo("timestamp with time zone");
        }

        @Test
        @DisplayName("chk_student_assignments_ai_score chặn 101, cho qua 100")
        void aiScoreCheck_isEnforced() {
            Fixture f = fixture(null);
            assertThatThrownBy(() -> jdbc.update(
                    "INSERT INTO student_assignments(assignment_id, student_id, status, ai_score) VALUES (?, ?, 'AI_GRADED', 101)",
                    f.assignmentId, f.student.getId()))
                    .hasMessageContaining("chk_student_assignments_ai_score");
            assertThatCode(() -> jdbc.update(
                    "INSERT INTO student_assignments(assignment_id, student_id, status, ai_score) VALUES (?, ?, 'AI_GRADED', 100)",
                    f.assignmentId, f.student.getId()))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("student_report_issues tồn tại với payload jsonb, mốc TIMESTAMPTZ, đủ CHECK và UNIQUE token")
        void reportIssues_tableShape() {
            assertThat(tableExists("student_report_issues")).isTrue();
            assertThat(columnType("student_report_issues", "payload_json")).isEqualTo("jsonb");
            assertThat(columnType("student_report_issues", "issued_at")).isEqualTo("timestamp with time zone");
            assertThat(columnType("student_report_issues", "token_expires_at")).isEqualTo("timestamp with time zone");
            assertThat(columnType("student_report_issues", "last_viewed_at")).isEqualTo("timestamp with time zone");

            // CHECK nằm trong khối DO $$ IF NOT EXISTS — gõ sai tên bảng cũng không làm migration đỏ, chỉ
            // lặng lẽ không tạo gì. Chỉ chốt này bắt được.
            assertThat(checkConstraintExists("chk_student_report_issues_period")).isTrue();
            assertThat(checkConstraintExists("chk_student_report_issues_lang")).isTrue();
            assertThat(checkConstraintExists("chk_student_report_issues_revoke_pair")).isTrue();
            assertThat(checkConstraintExists("chk_student_report_issues_view_count")).isTrue();
            assertThat(jdbc.queryForObject(
                    "SELECT COUNT(*) FROM pg_constraint WHERE conname = 'uq_student_report_issues_token' AND contype = 'u'",
                    Long.class)).isEqualTo(1L);
        }

        @Test
        @DisplayName("Đủ BỐN index; index org và index token còn hiệu lực là index MỘT PHẦN đúng như thiết kế")
        void reportIssues_indexes() {
            assertThat(indexExists("idx_student_report_issues_class_period")).isTrue();
            assertThat(indexExists("idx_student_report_issues_student")).isTrue();
            assertThat(indexExists("idx_student_report_issues_org")).isTrue();
            assertThat(indexExists("idx_student_report_issues_active_token")).isTrue();
            assertThat(indexDefinition("idx_student_report_issues_org")).contains("WHERE").contains("org_id IS NOT NULL");
            assertThat(indexDefinition("idx_student_report_issues_active_token")).contains("WHERE").contains("revoked_at IS NULL");
        }

        @Test
        @DisplayName("FK: student_id/class_id CASCADE (xoá tài khoản mang theo phiếu), org_id/issued_by/revoked_by SET NULL")
        void reportIssues_fkDeleteRules() {
            Map<String, String> rules = fkDeleteRules("student_report_issues");
            // c = CASCADE, n = SET NULL (pg_constraint.confdeltype). AccountDeletionServiceDbTest chỉ đếm
            // 'a','r','d' là chặn xoá — hai luật này giữ bảng mới ngoài danh sách đó.
            assertThat(rules).containsEntry("student_id", "c").containsEntry("class_id", "c")
                    .containsEntry("org_id", "n").containsEntry("issued_by", "n").containsEntry("revoked_by", "n");
        }

        @Test
        @DisplayName("CHECK period/lang chặn giá trị lạ (WEEKLY, fr)")
        void periodAndLangChecks_areEnforced() {
            Fixture f = fixture(null);
            assertThatThrownBy(() -> insertIssue(f.classId, f.student.getId(), null, f.teacher.getId(),
                    "WEEKLY", "vi", token()))
                    .hasMessageContaining("chk_student_report_issues_period");
            assertThatThrownBy(() -> insertIssue(f.classId, f.student.getId(), null, f.teacher.getId(),
                    "FINAL", "fr", token()))
                    .hasMessageContaining("chk_student_report_issues_lang");
            assertThatCode(() -> insertIssue(f.classId, f.student.getId(), null, f.teacher.getId(),
                    "FINAL", "de", token()))
                    .doesNotThrowAnyException();
        }
    }

    // ── 3. Scope đồng ý mới (R6) ────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("student_consents nhận GUARDIAN_REPORT_SHARING, vẫn từ chối giá trị lạ (R6)")
    class ConsentScope {

        @Test
        @DisplayName("INSERT scope GUARDIAN_REPORT_SHARING được; MARKETING vẫn bị chk_student_consents_scope chặn")
        void newScope_accepted_unknownScope_rejected() {
            User student = student(null);
            assertThatCode(() -> insertConsent(student.getId(), "GUARDIAN_REPORT_SHARING"))
                    .doesNotThrowAnyException();
            // Đối chứng: DROP + ADD lại CHECK không được làm nó lỏng đi.
            assertThatThrownBy(() -> insertConsent(student.getId(), "MARKETING"))
                    .hasMessageContaining("chk_student_consents_scope");
            assertThatCode(() -> insertConsent(student.getId(), "AUDIO_RECORDING"))
                    .as("bốn scope cũ vẫn phải qua").doesNotThrowAnyException();
        }

        @Test
        @DisplayName("Ghi qua MinorLearnerService (enum Java) rồi đọc lại trạng thái = GRANTED")
        void newScope_roundTripsThroughService() {
            Organization org = org();
            User student = student(org);
            User manager = student(org);
            assertThat(minorLearnerService.consentStatus(student.getId(), StudentConsent.Scope.GUARDIAN_REPORT_SHARING))
                    .isEqualTo(ConsentState.NEVER_RECORDED);

            minorLearnerService.recordConsent(student.getId(), org.getId(), new ConsentDraft(
                    StudentConsent.Scope.GUARDIAN_REPORT_SHARING, StudentConsent.Action.GRANTED, null,
                    StudentConsent.Method.PAPER, "v1", Instant.now().minus(1, ChronoUnit.DAYS), null),
                    new AuditActor(manager.getId(), manager.getEmail(), "MANAGER"));

            assertThat(minorLearnerService.consentStatus(student.getId(), StudentConsent.Scope.GUARDIAN_REPORT_SHARING))
                    .isEqualTo(ConsentState.GRANTED);
            // Phạm vi khác không bị kéo theo — mỗi scope là một dòng đời riêng.
            assertThat(minorLearnerService.consentStatus(student.getId(), StudentConsent.Scope.AUDIO_RECORDING))
                    .isEqualTo(ConsentState.NEVER_RECORDED);
        }
    }

    // ── 4. Ảnh chụp bất biến (R2) ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("🔴 student_report_issues BẤT BIẾN — trigger còn sống và chặn đúng nhóm cột")
    class ImmutableSnapshot {

        @Test
        @DisplayName("Trigger trg_student_report_issues_immutable tồn tại, BEFORE UPDATE, có WHEN pg_trigger_depth() = 0")
        void trigger_isInstalled_withDepthGuard() {
            String def = jdbc.queryForObject("""
                    SELECT pg_get_triggerdef(oid) FROM pg_trigger
                     WHERE tgrelid = 'student_report_issues'::regclass
                       AND tgname = 'trg_student_report_issues_immutable'
                       AND NOT tgisinternal
                    """, String.class);
            assertThat(def).contains("BEFORE UPDATE").contains("pg_trigger_depth() = 0");
            // KHÔNG chặn DELETE: xoá tài khoản phải mang phiếu đi.
            assertThat(def).doesNotContain("DELETE");
        }

        @Test
        @DisplayName("UPDATE bất kỳ cột NỘI DUNG nào (payload, tên, kỳ, ngôn ngữ, lớp, học viên, mốc phát hành, snapshot) ⇒ NÉM; dòng nguyên vẹn")
        void frozenColumns_cannotBeUpdated() {
            Fixture f = fixture(null);
            Fixture other = fixture(null);
            long id = insertIssue(f.classId, f.student.getId(), null, f.teacher.getId(), "MIDTERM", "vi", token());

            List<Object[]> attempts = List.of(
                    new Object[]{"payload_json", "UPDATE student_report_issues SET payload_json = '{\"comment\":\"da sua\"}'::jsonb WHERE id = ?", new Object[]{id}},
                    new Object[]{"student_name_snapshot", "UPDATE student_report_issues SET student_name_snapshot = 'Ke Gia Mao' WHERE id = ?", new Object[]{id}},
                    new Object[]{"period", "UPDATE student_report_issues SET period = 'FINAL' WHERE id = ?", new Object[]{id}},
                    new Object[]{"lang", "UPDATE student_report_issues SET lang = 'en' WHERE id = ?", new Object[]{id}},
                    new Object[]{"class_id", "UPDATE student_report_issues SET class_id = ? WHERE id = ?", new Object[]{other.classId, id}},
                    new Object[]{"student_id", "UPDATE student_report_issues SET student_id = ? WHERE id = ?", new Object[]{other.student.getId(), id}},
                    new Object[]{"issued_at", "UPDATE student_report_issues SET issued_at = now() - interval '1 day' WHERE id = ?", new Object[]{id}},
                    // Ngoài danh sách bắt buộc của thiết kế: danh sách TRẮNG đóng băng luôn mọi snapshot.
                    new Object[]{"org_name_snapshot", "UPDATE student_report_issues SET org_name_snapshot = 'TT Khac' WHERE id = ?", new Object[]{id}},
                    new Object[]{"issued_by_name_snapshot", "UPDATE student_report_issues SET issued_by_name_snapshot = 'Ai Do' WHERE id = ?", new Object[]{id}},
                    // Trộn một cột được phép với một cột bị khoá ⇒ vẫn chặn cả câu.
                    new Object[]{"view_count + lang", "UPDATE student_report_issues SET view_count = 5, lang = 'de' WHERE id = ?", new Object[]{id}});
            for (Object[] a : attempts) {
                String label = (String) a[0];
                String sql = (String) a[1];
                Object[] args = (Object[]) a[2];
                assertThatThrownBy(() -> jdbc.update(sql, args))
                        .as("UPDATE " + label + " phải bị trigger chặn")
                        .hasMessageContaining("trg_student_report_issues_immutable");
            }

            // Đối chứng dương: không chỉ "câu lệnh ném" mà dữ liệu thật sự chưa kịp đổi.
            Map<String, Object> row = jdbc.queryForMap(
                    "SELECT period, lang, class_id, student_id, view_count, payload_json::text AS payload FROM student_report_issues WHERE id = ?", id);
            assertThat(row.get("period")).isEqualTo("MIDTERM");
            assertThat(row.get("lang")).isEqualTo("vi");
            assertThat(((Number) row.get("class_id")).longValue()).isEqualTo(f.classId);
            assertThat(((Number) row.get("student_id")).longValue()).isEqualTo(f.student.getId());
            assertThat(((Number) row.get("view_count")).intValue()).isZero();
            assertThat((String) row.get("payload")).contains("\"Tot\"");
        }

        @Test
        @DisplayName("UPDATE nhóm token / thu hồi / lượt xem ⇒ QUA; UPDATE không đổi gì cũng qua")
        void mutableColumns_canBeUpdated() {
            Fixture f = fixture(null);
            long id = insertIssue(f.classId, f.student.getId(), null, f.teacher.getId(), "MIDTERM", "vi", token());

            assertThatCode(() -> jdbc.update(
                    "UPDATE student_report_issues SET view_count = view_count + 1, last_viewed_at = now() WHERE id = ?", id))
                    .doesNotThrowAnyException();
            String rotated = token();
            assertThatCode(() -> jdbc.update(
                    "UPDATE student_report_issues SET token = ?, token_expires_at = now() + interval '30 days' WHERE id = ?", rotated, id))
                    .doesNotThrowAnyException();
            // Khác student_consents (chặn theo THAO TÁC), trigger này chặn theo NỘI DUNG: câu UPDATE không
            // đổi gì thì đi qua — Hibernate merge() một entity không đổi không được phép nổ.
            assertThatCode(() -> jdbc.update("UPDATE student_report_issues SET id = id WHERE id = ?", id))
                    .doesNotThrowAnyException();
            assertThatCode(() -> jdbc.update(
                    "UPDATE student_report_issues SET revoked_at = now(), revoked_by = ?, revoke_reason = 'OWNER' WHERE id = ?",
                    f.teacher.getId(), id))
                    .doesNotThrowAnyException();

            Map<String, Object> row = jdbc.queryForMap(
                    "SELECT token, view_count, revoke_reason, revoked_at FROM student_report_issues WHERE id = ?", id);
            assertThat(row.get("token")).isEqualTo(rotated);
            assertThat(((Number) row.get("view_count")).intValue()).isEqualTo(1);
            assertThat(row.get("revoke_reason")).isEqualTo("OWNER");
            assertThat(row.get("revoked_at")).isNotNull();
        }

        @Test
        @DisplayName("Thu hồi không có mã lý do ⇒ chk_student_report_issues_revoke_pair chặn")
        void revokeWithoutReason_isRejected() {
            Fixture f = fixture(null);
            long id = insertIssue(f.classId, f.student.getId(), null, f.teacher.getId(), "MIDTERM", "vi", token());
            assertThatThrownBy(() -> jdbc.update("UPDATE student_report_issues SET revoked_at = now() WHERE id = ?", id))
                    .hasMessageContaining("chk_student_report_issues_revoke_pair");
        }

        @Test
        @DisplayName("🪤 Xoá NGƯỜI PHÁT HÀNH / NGƯỜI THU HỒI: FK SET NULL đi qua trigger (depth > 0), phiếu CÒN, tên snapshot còn")
        void deletingIssuerOrRevoker_setsNull_keepsIssue() {
            // Người phát hành là một tài khoản KHÁC chủ lớp — xoá chủ lớp thì lớp (và phiếu) đi theo CASCADE,
            // không phải ca này. Đây là chính bẫy V319: `UPDATE ONLY … SET issued_by = NULL` do khoá ngoại
            // sinh ra CHẠM cột nằm ngoài danh sách trắng; thiếu WHEN thì xoá tài khoản giáo viên đổ.
            Fixture f = fixture(null);
            User issuer = student(null);
            User revoker = student(null);
            long id = insertIssue(f.classId, f.student.getId(), null, issuer.getId(), "MIDTERM", "vi", token());
            jdbc.update("UPDATE student_report_issues SET revoked_at = now(), revoked_by = ?, revoke_reason = 'OWNER' WHERE id = ?",
                    revoker.getId(), id);

            assertThatCode(() -> jdbc.update("DELETE FROM users WHERE id = ?", issuer.getId())).doesNotThrowAnyException();
            assertThatCode(() -> jdbc.update("DELETE FROM users WHERE id = ?", revoker.getId())).doesNotThrowAnyException();

            Map<String, Object> row = jdbc.queryForMap(
                    "SELECT issued_by, issued_by_name_snapshot, revoked_by, revoked_at FROM student_report_issues WHERE id = ?", id);
            assertThat(row.get("issued_by")).isNull();
            assertThat(row.get("issued_by_name_snapshot")).isEqualTo("Co Lan");
            assertThat(row.get("revoked_by")).isNull();
            assertThat(row.get("revoked_at")).as("mốc thu hồi ở lại dù người thu hồi đã đi").isNotNull();
        }

        @Test
        @DisplayName("🔴 Xoá tài khoản HỌC VIÊN mang theo phiếu (CASCADE) — không bị trigger chặn; cả qua AccountDeletionService")
        void deletingStudent_cascadesIssues() {
            Fixture f = fixture(null);
            long id = insertIssue(f.classId, f.student.getId(), null, f.teacher.getId(), "MIDTERM", "vi", token());
            insertIssue(f.classId, f.student.getId(), null, f.teacher.getId(), "FINAL", "vi", token());

            // Đường thật của App Store 5.1.1(v): học viên B2C (không thuộc trung tâm — AccountDeletionGuard D6).
            assertThatCode(() -> accountDeletionService.deleteAccount(f.student.getId())).doesNotThrowAnyException();

            assertThat(userRepository.findById(f.student.getId())).isEmpty();
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM student_report_issues WHERE id = ?", Long.class, id)).isZero();
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM student_report_issues WHERE student_id = ?", Long.class, f.student.getId())).isZero();
            // Lớp và giáo viên không bị kéo theo.
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM teacher_classes WHERE id = ?", Long.class, f.classId)).isEqualTo(1L);
        }

        @Test
        @DisplayName("Xoá LỚP mang theo phiếu (CASCADE)")
        void deletingClass_cascadesIssues() {
            Fixture f = fixture(null);
            long id = insertIssue(f.classId, f.student.getId(), null, f.teacher.getId(), "MIDTERM", "vi", token());
            assertThatCode(() -> jdbc.update("DELETE FROM teacher_classes WHERE id = ?", f.classId)).doesNotThrowAnyException();
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM student_report_issues WHERE id = ?", Long.class, id)).isZero();
        }

        @Test
        @DisplayName("Token UNIQUE toàn bảng — kể cả khi phiếu cũ đã thu hồi, token không cấp lại được")
        void token_isUnique_evenAfterRevoke() {
            Fixture f = fixture(null);
            String t = token();
            long first = insertIssue(f.classId, f.student.getId(), null, f.teacher.getId(), "MIDTERM", "vi", t);
            jdbc.update("UPDATE student_report_issues SET revoked_at = now(), revoke_reason = 'SUPERSEDED' WHERE id = ?", first);
            assertThatThrownBy(() -> insertIssue(f.classId, f.student.getId(), null, f.teacher.getId(), "MIDTERM", "vi", t))
                    .hasMessageContaining("uq_student_report_issues_token");
        }
    }

    // ── 5. Backfill (R3) — replay Flyway trên DB PHỤ ─────────────────────────────────────────

    @Nested
    @DisplayName("Backfill V323: dòng AI_GRADED chép sang ai_*, dòng EVALUATED/SUBMITTED để NULL")
    class Backfill {

        /**
         * Không kiểm backfill được trên DB của context — Flyway đã áp V323 trước khi test chạy. Cách duy nhất
         * trung thực: tạo một DB phụ, migrate tới ĐÚNG V322, chèn dữ liệu "trước V323" rồi migrate tiếp —
         * chính cổng fresh-migration thu nhỏ. Cùng cấu hình Flyway với application-test.yml.
         */
        @Test
        @DisplayName("Replay V1→V322 trên DB phụ, chèn AI_GRADED/EVALUATED/SUBMITTED, lên V323 ⇒ chỉ AI_GRADED có ai_*")
        void v323Backfill_copiesAiGradedProposal_leavesOthersNull() {
            boolean canCreateDb = Boolean.TRUE.equals(jdbc.queryForObject(
                    "SELECT rolcreatedb OR rolsuper FROM pg_roles WHERE rolname = current_user", Boolean.class));
            if (!canCreateDb) {
                // CI (DEUTSCHFLOW_IT_REQUIRE_DB=true) phải có quyền này — thiếu là ĐỎ, không phải skip.
                assertThat(PostgresIntegrationDb.databaseIsMandatory())
                        .as("CI cần CREATE DATABASE để kiểm backfill V323").isFalse();
                Assumptions.assumeTrue(false, "Không có quyền CREATE DATABASE — bỏ qua ca replay backfill");
            }
            PostgresIntegrationDb.Config main = PostgresIntegrationDb.resolve();
            String sideDb = "v323bf_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
            String sideUrl = replaceDatabase(main.jdbcUrl(), sideDb);
            jdbc.execute("CREATE DATABASE " + sideDb);
            try {
                Flyway.configure()
                        .dataSource(sideUrl, main.username(), main.password())
                        .locations("classpath:db/migration")
                        .baselineOnMigrate(true)
                        .encoding("UTF-8")
                        .target("322")
                        .load()
                        .migrate();
                JdbcTemplate side = new JdbcTemplate(new SimpleDriverDataSource(
                        new org.postgresql.Driver(), sideUrl, main.username(), main.password()));
                assertThat(side.queryForObject(
                        "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'student_assignments' AND column_name = 'ai_score'",
                        Long.class)).as("ở V322 chưa được có ai_score — nếu có thì target không hoạt động").isZero();

                String tag = UUID.randomUUID().toString().substring(0, 8);
                Long teacherId = side.queryForObject(
                        "INSERT INTO users(email, password_hash, display_name, role) VALUES (?, 'x', 'GV', 'TEACHER') RETURNING id",
                        Long.class, "bf-gv-" + tag + "@test.local");
                Long studentId = side.queryForObject(
                        "INSERT INTO users(email, password_hash, display_name, role) VALUES (?, 'x', 'HV', 'STUDENT') RETURNING id",
                        Long.class, "bf-hv-" + tag + "@test.local");
                Long classId = side.queryForObject(
                        "INSERT INTO teacher_classes(teacher_id, name, invite_code, created_at) VALUES (?, 'B1 bf', ?, now()) RETURNING id",
                        Long.class, teacherId, "INV-" + tag);
                Long assignmentId = side.queryForObject(
                        "INSERT INTO class_assignments(class_id, topic, created_at) VALUES (?, 'Brief', now()) RETURNING id",
                        Long.class, classId);
                Long aiGraded = side.queryForObject(
                        "INSERT INTO student_assignments(assignment_id, student_id, status, score, feedback, graded_at) "
                                + "VALUES (?, ?, 'AI_GRADED', 82, 'gut', now()) RETURNING id", Long.class, assignmentId, studentId);
                Long evaluated = side.queryForObject(
                        "INSERT INTO student_assignments(assignment_id, student_id, status, score, feedback, graded_at) "
                                + "VALUES (?, ?, 'EVALUATED', 90, 'GV: sehr gut', now()) RETURNING id", Long.class, assignmentId, studentId);
                Long submitted = side.queryForObject(
                        "INSERT INTO student_assignments(assignment_id, student_id, status) VALUES (?, ?, 'SUBMITTED') RETURNING id",
                        Long.class, assignmentId, studentId);

                Flyway.configure()
                        .dataSource(sideUrl, main.username(), main.password())
                        .locations("classpath:db/migration")
                        .baselineOnMigrate(true)
                        .encoding("UTF-8")
                        .load()
                        .migrate();
                assertThat(side.queryForObject(
                        "SELECT COUNT(*) FROM flyway_schema_history WHERE version = '323' AND success", Long.class)).isEqualTo(1L);

                Map<String, Object> ai = side.queryForMap(
                        "SELECT score, ai_score, ai_feedback, ai_graded_at, graded_at FROM student_assignments WHERE id = ?", aiGraded);
                assertThat(((Number) ai.get("ai_score")).intValue()).isEqualTo(82);
                assertThat(ai.get("ai_feedback")).isEqualTo("gut");
                assertThat(ai.get("ai_graded_at")).as("ai_graded_at backfill từ graded_at").isNotNull();
                assertThat(((Number) ai.get("score")).intValue()).as("score không bị đụng").isEqualTo(82);

                Map<String, Object> ev = side.queryForMap(
                        "SELECT score, ai_score, ai_feedback, ai_graded_at FROM student_assignments WHERE id = ?", evaluated);
                assertThat(ev.get("ai_score")).as("điểm AI của bài đã chốt đã mất — KHÔNG dựng lại").isNull();
                assertThat(ev.get("ai_feedback")).isNull();
                assertThat(ev.get("ai_graded_at")).isNull();
                assertThat(((Number) ev.get("score")).intValue()).isEqualTo(90);

                Map<String, Object> sub = side.queryForMap(
                        "SELECT ai_score, ai_feedback FROM student_assignments WHERE id = ?", submitted);
                assertThat(sub.get("ai_score")).isNull();
                assertThat(sub.get("ai_feedback")).isNull();
            } finally {
                jdbc.execute("DROP DATABASE IF EXISTS " + sideDb + " WITH (FORCE)");
            }
        }
    }

    // ── 6. Ánh xạ JPA (ddl-auto: validate) và đường đọc repository ──────────────────────────

    @Nested
    @DisplayName("Entity mới ánh xạ đúng; repository đọc đúng nghĩa")
    class JpaMapping {

        @Test
        @DisplayName("StudentAssignment.applyAiProposal ghi ai_* + score/feedback + AI_GRADED xuống DB")
        void studentAssignment_persistsAiColumns() {
            Fixture f = fixture(null);
            StudentAssignment sa = StudentAssignment.builder()
                    .assignmentId(f.assignmentId).studentId(f.student.getId())
                    .status(AssignmentStatus.SUBMITTED).submissionContent("Hallo").build();
            sa.applyAiProposal(82, "gut");
            Long id = studentAssignmentRepository.save(sa).getId();

            Map<String, Object> row = jdbc.queryForMap(
                    "SELECT status, score, feedback, ai_score, ai_feedback, ai_graded_at FROM student_assignments WHERE id = ?", id);
            assertThat(row.get("status")).isEqualTo(AssignmentStatus.AI_GRADED);
            assertThat(((Number) row.get("score")).intValue()).isEqualTo(82);
            assertThat(row.get("feedback")).isEqualTo("gut");
            assertThat(((Number) row.get("ai_score")).intValue()).isEqualTo(82);
            assertThat(row.get("ai_feedback")).isEqualTo("gut");
            assertThat(row.get("ai_graded_at")).isNotNull();
            assertThat(studentAssignmentRepository.findById(id).orElseThrow().getAiScore()).isEqualTo(82);
        }

        @Test
        @DisplayName("Phiếu: save → findActiveByToken; recordView tăng nguyên tử; revoke + save → hết hiệu lực, lượt xem KHÔNG bị save() ghi đè")
        void reportIssue_roundTrip_activeTokenViewRevoke() {
            Organization org = org();
            Fixture f = fixture(org);
            String t = token();
            StudentReportIssue saved = issueRepository.save(StudentReportIssue.builder()
                    .classId(f.classId).studentId(f.student.getId()).orgId(org.getId())
                    .period(StudentReportIssue.Period.MIDTERM).lang(StudentReportIssue.LANG_VI)
                    .payload(Map.of("skills", Map.of("horen", 8.5), "comment", "Tốt"))
                    .orgNameSnapshot(org.getName()).studentNameSnapshot("Nguyễn Đức")
                    .issuedBy(f.teacher.getId()).issuedByNameSnapshot("Cô Lan")
                    .token(t).tokenExpiresAt(Instant.now().plus(30, ChronoUnit.DAYS))
                    .build());
            assertThat(saved.getId()).isNotNull();
            assertThat(saved.getIssuedAt()).isNotNull();

            assertThat(issueRepository.findActiveByToken(t, Instant.now())).isPresent();
            assertThat(issueRepository.findByClassIdAndStudentIdAndPeriodAndRevokedAtIsNull(
                    f.classId, f.student.getId(), StudentReportIssue.Period.MIDTERM)).hasSize(1);
            assertThat(issueRepository.findByClassIdAndPeriodOrderByIssuedAtDesc(f.classId, StudentReportIssue.Period.MIDTERM))
                    .extracting(StudentReportIssue::getId).containsExactly(saved.getId());
            assertThat(issueRepository.findByStudentIdOrderByIssuedAtDesc(f.student.getId()))
                    .extracting(StudentReportIssue::getId).containsExactly(saved.getId());
            // JSONB round-trip: đọc lại đúng cấu trúc, không phải chuỗi.
            StudentReportIssue reloaded = issueRepository.findById(saved.getId()).orElseThrow();
            assertThat(reloaded.getPayload()).containsEntry("comment", "Tốt");
            assertThat(reloaded.getPayload().get("skills")).isInstanceOf(Map.class);

            // Hai lượt mở — bộ đếm tăng ở DB, không qua entity.
            Integer updated = transactionTemplate.execute(s -> issueRepository.recordView(saved.getId(), Instant.now()));
            assertThat(updated).isEqualTo(1);
            transactionTemplate.execute(s -> issueRepository.recordView(saved.getId(), Instant.now()));
            assertThat(jdbc.queryForObject("SELECT view_count FROM student_report_issues WHERE id = ?", Integer.class, saved.getId()))
                    .isEqualTo(2);

            // Thu hồi qua entity (đối tượng `saved` vẫn mang viewCount = 0 cũ) rồi save(): trigger cho qua,
            // và view_count KHÔNG bị ghi đè về 0 vì cột đó là updatable = false.
            assertThat(saved.revoke(f.teacher.getId(), StudentReportIssue.REVOKE_BY_TEACHER, Instant.now())).isTrue();
            assertThat(saved.revoke(f.teacher.getId(), StudentReportIssue.REVOKE_BY_OWNER, Instant.now()))
                    .as("lần thu hồi đầu thắng — gọi lại là no-op").isFalse();
            assertThatCode(() -> issueRepository.save(saved)).doesNotThrowAnyException();

            assertThat(issueRepository.findActiveByToken(t, Instant.now())).isEmpty();
            assertThat(issueRepository.findByClassIdAndStudentIdAndPeriodAndRevokedAtIsNull(
                    f.classId, f.student.getId(), StudentReportIssue.Period.MIDTERM)).isEmpty();
            Map<String, Object> row = jdbc.queryForMap(
                    "SELECT revoke_reason, revoked_by, view_count FROM student_report_issues WHERE id = ?", saved.getId());
            assertThat(row.get("revoke_reason")).isEqualTo("TEACHER");
            assertThat(((Number) row.get("revoked_by")).longValue()).isEqualTo(f.teacher.getId());
            assertThat(((Number) row.get("view_count")).intValue()).as("save() không được ghi đè bộ đếm").isEqualTo(2);
            assertThatThrownBy(() -> saved.rotateToken(token(), Instant.now().plus(1, ChronoUnit.DAYS)))
                    .isInstanceOf(IllegalStateException.class);
        }

        @Test
        @DisplayName("Token hết hạn ⇒ findActiveByToken rỗng dù chưa thu hồi; xoay token ⇒ token cũ chết, token mới sống")
        void expiredToken_isNotActive_andRotationWorks() {
            Fixture f = fixture(null);
            String old = token();
            StudentReportIssue issue = issueRepository.save(StudentReportIssue.builder()
                    .classId(f.classId).studentId(f.student.getId())
                    .period(StudentReportIssue.Period.FINAL)
                    .payload(Map.of("comment", "x"))
                    .studentNameSnapshot("HV")
                    .token(old).tokenExpiresAt(Instant.now().minus(1, ChronoUnit.HOURS))
                    .build());
            assertThat(issue.getLang()).as("mặc định vi (R8)").isEqualTo(StudentReportIssue.LANG_VI);
            assertThat(issueRepository.findActiveByToken(old, Instant.now())).isEmpty();
            assertThat(issue.isActiveAt(Instant.now())).isFalse();

            String fresh = token();
            issue.rotateToken(fresh, Instant.now().plus(30, ChronoUnit.DAYS));
            issueRepository.save(issue);
            assertThat(issueRepository.findActiveByToken(old, Instant.now())).isEmpty();
            assertThat(issueRepository.findActiveByToken(fresh, Instant.now())).isPresent();
        }
    }

    // ── helpers ─────────────────────────────────────────────────────────────────────────────

    /** Giáo viên + lớp + một bài tập + một học viên (B2C khi {@code org} null) — đủ để chèn student_assignments/phiếu. */
    private record Fixture(User teacher, User student, Long classId, Long assignmentId) {}

    private Fixture fixture(Organization org) {
        User teacher = userRepository.save(User.builder()
                .email("r1-gv-" + UUID.randomUUID() + "@test.local").passwordHash("x")
                .displayName("GV phieu").role(User.Role.TEACHER)
                .orgId(org == null ? null : org.getId()).build());
        User student = student(org);
        Long classId = jdbc.queryForObject(
                "INSERT INTO teacher_classes(teacher_id, name, invite_code, created_at, org_id) VALUES (?, ?, ?, now(), ?) RETURNING id",
                Long.class, teacher.getId(), "B1 · phieu", "INV-" + UUID.randomUUID(), org == null ? null : org.getId());
        Long assignmentId = jdbc.queryForObject(
                "INSERT INTO class_assignments(class_id, topic, created_at) VALUES (?, 'Brief', now()) RETURNING id",
                Long.class, classId);
        return new Fixture(teacher, student, classId, assignmentId);
    }

    private User student(Organization org) {
        return userRepository.save(User.builder()
                .email("r1-hv-" + UUID.randomUUID() + "@test.local").passwordHash("x")
                .displayName("HV phieu").role(User.Role.STUDENT)
                .orgId(org == null ? null : org.getId()).build());
    }

    private Organization org() {
        return organizationRepo.save(Organization.builder()
                .name("TT " + UUID.randomUUID().toString().substring(0, 8))
                .slug("r1-" + UUID.randomUUID())
                .seatLimit(50)
                .status("ACTIVE")
                .build());
    }

    private static String token() {
        return "tk-" + UUID.randomUUID().toString().replace("-", "");
    }

    /** Chèn một phiếu bằng SQL — ném nguyên vẹn lỗi DB để ca "phải bị chặn" bắt được. */
    private long insertIssue(Long classId, Long studentId, Long orgId, Long issuedBy,
                             String period, String lang, String token) {
        Long id = jdbc.queryForObject("""
                INSERT INTO student_report_issues
                    (class_id, student_id, org_id, period, lang, payload_json, org_name_snapshot,
                     student_name_snapshot, issued_by, issued_by_name_snapshot, token, token_expires_at)
                VALUES (?, ?, ?, ?, ?, CAST(? AS jsonb), 'TT Test', 'Nguyen Duc', ?, 'Co Lan', ?, now() + interval '30 days')
                RETURNING id
                """, Long.class, classId, studentId, orgId, period, lang,
                "{\"skills\":{\"horen\":8.5},\"comment\":\"Tot\"}", issuedBy, token);
        return id == null ? -1L : id;
    }

    private void insertConsent(Long studentUserId, String scope) {
        jdbc.update("""
                INSERT INTO student_consents
                    (student_user_id, scope, action, method, terms_version, effective_at)
                VALUES (?, ?, 'GRANTED', 'PAPER', 'r1-v1', now())
                """, studentUserId, scope);
    }

    static String replaceDatabase(String jdbcUrl, String dbName) {
        int q = jdbcUrl.indexOf('?');
        String base = q < 0 ? jdbcUrl : jdbcUrl.substring(0, q);
        String query = q < 0 ? "" : jdbcUrl.substring(q);
        int slash = base.lastIndexOf('/');
        return base.substring(0, slash + 1) + dbName + query;
    }

    private String columnType(String table, String column) {
        return jdbc.queryForObject("""
                SELECT data_type FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = ? AND column_name = ?
                """, String.class, table, column);
    }

    private boolean tableExists(String table) {
        Long n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ?",
                Long.class, table);
        return n != null && n == 1L;
    }

    private boolean checkConstraintExists(String name) {
        Long n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM pg_constraint WHERE conname = ? AND contype = 'c'", Long.class, name);
        return n != null && n == 1L;
    }

    private boolean indexExists(String name) {
        Long n = jdbc.queryForObject("SELECT COUNT(*) FROM pg_indexes WHERE indexname = ?", Long.class, name);
        return n != null && n == 1L;
    }

    private String indexDefinition(String name) {
        return jdbc.queryForObject("SELECT indexdef FROM pg_indexes WHERE indexname = ?", String.class, name);
    }

    /** {@code column → confdeltype} (c = CASCADE, n = SET NULL, a = NO ACTION, r = RESTRICT, d = SET DEFAULT). */
    private Map<String, String> fkDeleteRules(String table) {
        return jdbc.query("""
                SELECT att.attname AS col, con.confdeltype::text AS rule
                  FROM pg_constraint con
                  JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
                 WHERE con.conrelid = ?::regclass AND con.contype = 'f'
                """, rs -> {
            Map<String, String> m = new java.util.HashMap<>();
            while (rs.next()) {
                m.put(rs.getString("col"), rs.getString("rule"));
            }
            return m;
        }, table);
    }
}
