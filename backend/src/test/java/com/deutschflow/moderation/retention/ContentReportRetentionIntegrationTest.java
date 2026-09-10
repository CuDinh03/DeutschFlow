package com.deutschflow.moderation.retention;

import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.moderation.retention.ContentReportRetentionService.Tally;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Owner chốt 10/09/2026, quyết định 5 + B4 — hạn lưu NỘI DUNG báo cáo 90 ngày sau phán quyết:
 * xoá {@code snapshot_body} + {@code details}, GIỮ dòng, đóng dấu {@code content_purged_at};
 * PENDING không dọn nhưng tồn đọng > 30 ngày phải được đếm.
 *
 * <p>Ba dòng dựng cảnh: RESOLVED 100 ngày (quá hạn), RESOLVED 10 ngày (chưa), PENDING 100 ngày
 * (không bao giờ). Service dựng TAY với cờ dry-run từng ca — không cần hai Spring context chỉ để
 * lật một boolean. {@code now} ghim cứng nên ca không tự đỏ theo lịch.
 *
 * <p>Tự bỏ qua khi không có Postgres — xem {@link AbstractPostgresIntegrationTest}.
 */
@SpringBootTest
@DisplayName("ContentReportRetention: 90 ngày sau phán quyết xoá nội dung, giữ dòng; PENDING nguyên (10/09/2026)")
class ContentReportRetentionIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final Instant NOW = Instant.parse("2026-09-10T22:00:00Z");
    private static final int RETENTION_DAYS = 90;
    private static final Instant CUTOFF = NOW.minus(RETENTION_DAYS, ChronoUnit.DAYS);

    @Autowired private JdbcTemplate jdbc;
    @Autowired private AuditLogService auditLogService;
    @Autowired private UserRepository userRepository;
    @Autowired private ObjectMapper objectMapper;

    private String marker;
    private Long resolvedOld;
    private Long resolvedRecent;
    private Long pendingOld;

    @BeforeEach
    void seedThreeReports() {
        User reporter = newUser();
        User subject = newUser();
        marker = UUID.randomUUID().toString();
        resolvedOld = insert(reporter, subject, "RESOLVED", NOW.minus(101, ChronoUnit.DAYS), NOW.minus(100, ChronoUnit.DAYS),
                "old-" + marker, "d-old-" + marker);
        resolvedRecent = insert(reporter, subject, "RESOLVED", NOW.minus(11, ChronoUnit.DAYS), NOW.minus(10, ChronoUnit.DAYS),
                "recent-" + marker, "d-recent-" + marker);
        pendingOld = insert(reporter, subject, "PENDING", NOW.minus(100, ChronoUnit.DAYS), null,
                "pending-" + marker, "d-pending-" + marker);
    }

    private ContentReportRetentionService service(boolean dryRun) {
        return new ContentReportRetentionService(jdbc, auditLogService, RETENTION_DAYS, dryRun, 500, 5000);
    }

    @Test
    @DisplayName("dry-run (mặc định): đếm đúng số ứng viên + tồn đọng PENDING, KHÔNG đổi dòng nào, vết mang tên .previewed")
    void dryRun_countsAndTracesButChangesNothing() throws Exception {
        long expectedDue = dueCount(); // đếm độc lập bằng SQL của ca test, không qua service

        Tally tally = service(true).purgeOnce(NOW);

        assertThat(tally.dryRun()).isTrue();
        assertThat(tally.cutoff()).isEqualTo(CUTOFF);
        assertThat(tally.candidates()).isEqualTo(expectedDue).isGreaterThanOrEqualTo(1L);
        assertThat(tally.purged()).isZero();
        assertThat(tally.pendingBacklogOver30d()).isGreaterThanOrEqualTo(1L); // pendingOld tồn đọng 100 ngày

        assertIntact(resolvedOld, "old-" + marker, "d-old-" + marker);
        assertIntact(resolvedRecent, "recent-" + marker, "d-recent-" + marker);
        assertIntact(pendingOld, "pending-" + marker, "d-pending-" + marker);

        Map<String, Object> trace = latestTrace(ContentReportRetentionService.EVENT_PREVIEWED);
        assertThat(trace.get("actor_role")).isEqualTo("SYSTEM");
        assertThat(trace.get("org_id")).isNull(); // job nền tảng
        Map<String, Object> metadata = metadata(trace);
        assertThat(((Number) metadata.get("candidates")).longValue()).isEqualTo(expectedDue);
        assertThat(((Number) metadata.get("purged")).longValue()).isZero();
        assertThat(metadata).containsEntry("dryRun", true).containsEntry("retentionDays", RETENTION_DAYS)
                .containsKey("pendingBacklogOver30d");
        // ⛔ Chỉ số lượng — không nội dung, không id.
        assertThat(String.valueOf(trace.get("metadata_json"))).doesNotContain(marker);
    }

    @Test
    @DisplayName("dọn thật: CHỈ dòng RESOLVED quá 90 ngày bị NULL nội dung + content_purged_at; dòng còn; RESOLVED mới và PENDING nguyên")
    void realRun_purgesOnlyResolvedPastCutoff_keepsRowsAndPending() throws Exception {
        long expectedDue = dueCount();

        Tally tally = service(false).purgeOnce(NOW);

        assertThat(tally.dryRun()).isFalse();
        assertThat(tally.candidates()).isEqualTo(expectedDue).isGreaterThanOrEqualTo(1L);
        assertThat(tally.purged()).isEqualTo(expectedDue);

        Map<String, Object> old = row(resolvedOld);
        assertThat(old).as("dòng phải CÒN — chỉ xoá nội dung").isNotNull();
        assertThat(old.get("snapshot_body")).isNull();
        assertThat(old.get("details")).isNull();
        assertThat(old.get("status")).isEqualTo("RESOLVED");
        assertThat(old.get("reporter_id")).isNotNull();
        assertThat(instantOf(old.get("content_purged_at"))).isEqualTo(NOW);

        assertIntact(resolvedRecent, "recent-" + marker, "d-recent-" + marker);
        assertIntact(pendingOld, "pending-" + marker, "d-pending-" + marker);

        Map<String, Object> trace = latestTrace(ContentReportRetentionService.EVENT_PURGED);
        Map<String, Object> metadata = metadata(trace);
        assertThat(((Number) metadata.get("purged")).longValue()).isEqualTo(expectedDue);
        assertThat(metadata).containsEntry("dryRun", false);

        // Lượt hai không đụng lại dòng đã dọn (vị từ loại content_purged_at IS NOT NULL) — dấu giữ mốc cũ.
        Tally second = service(false).purgeOnce(NOW.plus(1, ChronoUnit.DAYS));
        assertThat(second.candidates()).isEqualTo(dueCount());
        assertThat(instantOf(row(resolvedOld).get("content_purged_at"))).isEqualTo(NOW);
    }

    // ── truy vấn thẳng DB ───────────────────────────────────────────────────

    /** Cùng vị từ với partial index V321, viết lại độc lập trong ca test. */
    private long dueCount() {
        Long n = jdbc.queryForObject(
                "SELECT count(*) FROM content_reports WHERE status IN ('RESOLVED','DISMISSED') "
                        + "AND content_purged_at IS NULL AND (snapshot_body IS NOT NULL OR details IS NOT NULL) "
                        + "AND resolved_at < ?",
                Long.class, CUTOFF.atOffset(ZoneOffset.UTC));
        return n == null ? 0L : n;
    }

    /** pgjdbc trả timestamptz về {@code java.sql.Timestamp} qua ColumnMapRowMapper; quy về Instant một chỗ. */
    private static Instant instantOf(Object dbValue) {
        if (dbValue instanceof java.sql.Timestamp ts) {
            return ts.toInstant();
        }
        if (dbValue instanceof OffsetDateTime odt) {
            return odt.toInstant();
        }
        throw new AssertionError("content_purged_at phải là mốc thời gian, nhận: " + dbValue);
    }

    private Map<String, Object> row(Long id) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT reporter_id, status, snapshot_body, details, content_purged_at FROM content_reports WHERE id = ?", id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private void assertIntact(Long id, String snapshot, String details) {
        Map<String, Object> r = row(id);
        assertThat(r).isNotNull();
        assertThat(r.get("snapshot_body")).isEqualTo(snapshot);
        assertThat(r.get("details")).isEqualTo(details);
        assertThat(r.get("content_purged_at")).isNull();
    }

    private Map<String, Object> latestTrace(String event) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT actor_role, org_id, CAST(metadata_json AS text) AS metadata_json FROM audit_logs "
                        + "WHERE event_name = ? ORDER BY id DESC LIMIT 1", event);
        assertThat(rows).as("phải có vết %s", event).hasSize(1);
        return rows.get(0);
    }

    private Map<String, Object> metadata(Map<String, Object> trace) throws Exception {
        return objectMapper.readValue(String.valueOf(trace.get("metadata_json")), new TypeReference<>() {});
    }

    // ── dựng cảnh ───────────────────────────────────────────────────────────

    private Long insert(User reporter, User subject, String status, Instant createdAt, Instant resolvedAt,
                        String snapshot, String details) {
        return jdbc.queryForObject(
                "INSERT INTO content_reports(reporter_id, reported_user_id, context, reason, details, snapshot_body, "
                        + "status, created_at, resolved_at) VALUES (?,?,?,?,?,?,?,?,?) RETURNING id",
                Long.class, reporter.getId(), subject.getId(), "USER", "SPAM", details, snapshot, status,
                createdAt.atOffset(ZoneOffset.UTC), resolvedAt == null ? null : resolvedAt.atOffset(ZoneOffset.UTC));
    }

    private User newUser() {
        return userRepository.save(User.builder()
                .email("ret-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("Retention Tester")
                .role(User.Role.STUDENT)
                .build());
    }
}
