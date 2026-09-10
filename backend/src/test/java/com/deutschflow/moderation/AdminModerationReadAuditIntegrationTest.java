package com.deutschflow.moderation;

import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Predicate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Owner chốt 10/09/2026, quyết định 7 — admin ĐỌC hàng đợi kiểm duyệt ({@code GET /api/admin/moderation/reports},
 * trả về {@code snapshotBody} = nội dung tin nhắn riêng của người khác) và PHÁN QUYẾT một báo cáo
 * đều phải để lại vết mà giám đốc trung tâm của NGƯỜI BỊ TỐ CÁO đọc được — theo {@code org_id}
 * đóng băng trên dòng (V321), một vết cho mỗi trung tâm bị chạm.
 *
 * <p>Khuôn {@code AdminReadAuditIntegrationTest} (PR-0C): đi đúng chuỗi thật Spring Security →
 * controller → Postgres → {@code GET /api/org/audit-logs} của giám đốc; ba assert cách ly / đối
 * chứng (B không thấy; dòng B2C không lọt vào sổ A; vết không mang nội dung) để ca không thể xanh
 * khi sổ trung tâm biến thành sổ toàn nền tảng hay khi vết chép nhầm snapshot.
 *
 * <p>Tự bỏ qua khi không có Postgres — xem {@link AbstractPostgresIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Moderation: admin đọc/phán quyết báo cáo ⇒ vết rơi đúng sổ trung tâm của người bị tố cáo (10/09/2026)")
class AdminModerationReadAuditIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String ORG_LEDGER = "/api/org/audit-logs";
    private static final String REPORTS = "/api/admin/moderation/reports";
    private static final String EVENT_READ = "admin.moderation.reports.read";
    private static final String EVENT_RESOLVED = "admin.moderation.report.resolved";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private OrganizationRepository organizationRepo;
    @Autowired private OrgMemberRepository memberRepo;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    private Organization orgA;
    private Organization orgB;
    private User ownerA;
    private User ownerB;
    private User admin;

    /** Báo cáo về một giáo viên của A — org_id đóng băng = A. */
    private Long reportInA;
    /** Báo cáo về một người B2C — org_id NULL. Đối chứng: không được lọt vào sổ của A. */
    private Long reportB2c;
    private String secretSnapshot;
    private String secretDetails;

    @BeforeEach
    void seed() {
        orgA = newOrg("mod-a");
        orgB = newOrg("mod-b");
        ownerA = member(orgA, "OWNER");
        ownerB = member(orgB, "OWNER");
        admin = account(User.Role.ADMIN);
        User teacherA = member(orgA, "TEACHER");
        User reporter = account(User.Role.STUDENT);
        User b2cSubject = account(User.Role.STUDENT);

        // Dấu vân tay riêng để một lần LIKE trên toàn bảng audit_logs là kết luận được.
        secretSnapshot = "CT-SNAP-" + UUID.randomUUID();
        secretDetails = "CT-DETAILS-" + UUID.randomUUID();
        reportInA = insertReport(reporter, teacherA, orgA.getId(), secretSnapshot, secretDetails);
        reportB2c = insertReport(reporter, b2cSubject, null, "b2c-" + UUID.randomUUID(), null);

        assertThat(admin.getOrgId()).isNull(); // DEC-13: admin nền tảng không thuộc trung tâm nào
    }

    @Test
    @DisplayName("Admin mở hàng đợi ⇒ giám đốc A thấy MỘT vết đọc mang id báo cáo của A; B không thấy gì; vết không mang nội dung")
    void adminReadsQueue_traceLandsInOrgALedgerOnly_withoutContent() throws Exception {
        List<Long> returned = adminReadsQueue();
        assertThat(returned).contains(reportInA, reportB2c); // đối chứng: cả hai thật sự bị đọc

        Map<String, Object> trace = exactlyOne(tracesByAdmin(ownerA), t -> EVENT_READ.equals(t.get("eventName")));
        assertThat(num(trace.get("orgId"))).isEqualTo(orgA.getId());
        assertThat(trace.get("actorEmail")).isEqualTo(admin.getEmail());

        Map<String, Object> metadata = metadataOf(trace);
        assertThat(metadata).containsEntry("status", "ALL").containsKey("count").containsKey("reportIds");
        List<Long> ids = ((List<?>) metadata.get("reportIds")).stream().map(o -> ((Number) o).longValue()).toList();
        // Nhóm theo org_id đóng băng: vết của A chỉ mang id của A — dòng B2C (org NULL) đi vết khác.
        assertThat(ids).contains(reportInA).doesNotContain(reportB2c);
        assertThat(((Number) metadata.get("count")).intValue()).isEqualTo(ids.size());

        // Không nội dung: không snapshot, không details, không cả TÊN trường chứa nội dung.
        String raw = String.valueOf(trace.get("metadataJson"));
        assertThat(raw).doesNotContain(secretSnapshot).doesNotContain(secretDetails)
                .doesNotContain("snapshotBody").doesNotContain("\"details\"");
        assertThat(rowsContainingAnywhere(secretSnapshot)).isZero();
        assertThat(rowsContainingAnywhere(secretDetails)).isZero();

        // Cách ly: giám đốc B mở cùng endpoint và không thấy vết nào của admin.
        assertThat(tracesByAdmin(ownerB)).isEmpty();
    }

    @Test
    @DisplayName("Admin phán quyết báo cáo của A ⇒ vết resolved mang org_id đóng băng = A, target = id báo cáo; B không thấy")
    void resolve_traceCarriesFrozenOrgOfTheReport() throws Exception {
        mockMvc.perform(post(REPORTS + "/{id}/resolve", reportInA).param("status", "RESOLVED").with(user(admin)))
                .andExpect(status().isNoContent());

        Map<String, Object> trace = exactlyOne(tracesByAdmin(ownerA), t -> EVENT_RESOLVED.equals(t.get("eventName")));
        assertThat(trace.get("targetId")).isEqualTo(String.valueOf(reportInA));
        assertThat(num(trace.get("orgId"))).isEqualTo(orgA.getId());
        assertThat(metadataOf(trace)).containsEntry("status", "RESOLVED");
        assertThat(tracesByAdmin(ownerB)).isEmpty();

        // Phán quyết ĐÃ ghi thật — nếu không, ca chỉ chứng minh "có một vết".
        assertThat(jdbcTemplate.queryForObject(
                "SELECT status FROM content_reports WHERE id = ?", String.class, reportInA)).isEqualTo("RESOLVED");
    }

    @Test
    @DisplayName("Đối chứng: đọc lọc không chạm trung tâm nào (status=DISMISSED, rỗng) ⇒ sổ A im lặng, vết không org vẫn có ở nền tảng")
    void filteredReadTouchingNoOrg_staysOutOfOrgLedgers() throws Exception {
        mockMvc.perform(get(REPORTS).param("status", "DISMISSED").with(user(admin)))
                .andExpect(status().isOk());

        assertThat(tracesByAdmin(ownerA)).isEmpty();
        assertThat(tracesByAdmin(ownerB)).isEmpty();
        // "admin đã mở hàng đợi" vẫn là sự kiện — một vết không org, count 0, trên sổ toàn nền tảng.
        Long platformTraces = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM audit_logs WHERE event_name = ? AND actor_user_id = ? AND org_id IS NULL "
                        + "AND metadata_json ->> 'status' = 'DISMISSED' AND (metadata_json ->> 'count')::int = 0",
                Long.class, EVENT_READ, admin.getId());
        assertThat(platformTraces).isEqualTo(1L);
    }

    // ── thao tác của admin ──────────────────────────────────────────────────

    private List<Long> adminReadsQueue() throws Exception {
        String body = mockMvc.perform(get(REPORTS).with(user(admin)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        List<Map<String, Object>> reports = objectMapper.readValue(body, new TypeReference<>() {});
        return reports.stream().map(r -> num(r.get("id"))).toList();
    }

    // ── đọc sổ của giám đốc ─────────────────────────────────────────────────

    private List<Map<String, Object>> ledgerOf(User owner) throws Exception {
        String body = mockMvc.perform(get(ORG_LEDGER).with(user(owner)).param("size", "100"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        Map<String, Object> page = objectMapper.readValue(body, new TypeReference<>() {});
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) page.get("items");
        return items;
    }

    private List<Map<String, Object>> tracesByAdmin(User owner) throws Exception {
        return ledgerOf(owner).stream()
                .filter(t -> admin.getEmail().equals(t.get("actorEmail")))
                .toList();
    }

    private Map<String, Object> exactlyOne(List<Map<String, Object>> ledger, Predicate<Map<String, Object>> match) {
        List<Map<String, Object>> hits = ledger.stream().filter(match).toList();
        assertThat(hits)
                .as("sổ đang có các vết: %s", ledger.stream().map(t -> t.get("eventName")).toList())
                .hasSize(1);
        return hits.get(0);
    }

    private Map<String, Object> metadataOf(Map<String, Object> trace) throws Exception {
        return objectMapper.readValue(String.valueOf(trace.get("metadataJson")), new TypeReference<>() {});
    }

    private static Long num(Object jsonNumber) {
        return jsonNumber == null ? null : ((Number) jsonNumber).longValue();
    }

    private Long rowsContainingAnywhere(String needle) {
        return jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM audit_logs
                 WHERE COALESCE(CAST(metadata_json AS text), '') LIKE ?
                    OR COALESCE(target_id, '') LIKE ?
                    OR event_name LIKE ?
                """, Long.class, "%" + needle + "%", "%" + needle + "%", "%" + needle + "%");
    }

    // ── dựng cảnh ───────────────────────────────────────────────────────────

    private Long insertReport(User reporter, User subject, Long orgId, String snapshot, String details) {
        return jdbcTemplate.queryForObject(
                "INSERT INTO content_reports(reporter_id, reported_user_id, context, reason, details, snapshot_body, status, org_id) "
                        + "VALUES (?,?,?,?,?,?,?,?) RETURNING id",
                Long.class, reporter.getId(), subject.getId(), "USER", "HARASSMENT", details, snapshot, "PENDING", orgId);
    }

    private Organization newOrg(String slugPrefix) {
        return organizationRepo.save(Organization.builder()
                .name("TT " + UUID.randomUUID().toString().substring(0, 8))
                .slug(slugPrefix + "-" + UUID.randomUUID())
                .seatLimit(50)
                .status("ACTIVE")
                .build());
    }

    private User account(User.Role role) {
        return userRepository.save(User.builder()
                .email("mod-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("MOD " + role.name())
                .role(role)
                .build());
    }

    /** Thành viên ACTIVE của trung tâm với vai org đã cho ({@code org_members.role}). */
    private User member(Organization org, String orgRole) {
        User u = account(User.Role.TEACHER);
        u.setOrgId(org.getId());
        u = userRepository.save(u);

        OrgMember m = new OrgMember();
        m.setId(new OrgMemberId(org.getId(), u.getId()));
        m.setRole(orgRole);
        m.setStatus("ACTIVE");
        m.setJoinedAt(Instant.now());
        memberRepo.save(m);
        return u;
    }
}
