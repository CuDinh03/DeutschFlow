package com.deutschflow.organization;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
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
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * C6 (kế hoạch B2B §8) — sổ hoạt động theo TỔ CHỨC, trên PostgreSQL thật.
 *
 * <p>Ba thứ phải đúng cùng lúc và chỉ DB thật mới chứng minh được:
 * <ol>
 *   <li>migration V315 áp được TRÊN bảng đang có trigger append-only của V303;</li>
 *   <li>vết mới tự mang {@code org_id} của actor mà không điểm gọi nào phải sửa;</li>
 *   <li><b>trigger vẫn còn sống sau khi migration chạy</b> — V315 buộc phải gỡ nó để backfill, quên
 *       gắn lại là bảng mất tính bất biến trong im lặng.</li>
 * </ol>
 */
@SpringBootTest
@DisplayName("Org audit log Integration Tests (C6, V315)")
class OrgAuditLogIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private AuditLogService auditLogService;
    @Autowired private OrganizationRepository organizationRepo;
    @Autowired private OrgMemberRepository memberRepo;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("Vết của trung tâm A không lọt sang sổ của trung tâm B, và ngược lại")
    void orgScopedRead_isolatesTenants() {
        Organization orgA = org();
        Organization orgB = org();
        User ownerA = member(orgA, "OWNER");
        User ownerB = member(orgB, "OWNER");
        String evtA = "TEST_A_" + UUID.randomUUID();
        String evtB = "TEST_B_" + UUID.randomUUID();

        auditLogService.log(evtA, actor(ownerA), "ORG", String.valueOf(orgA.getId()), Map.of("k", "v"));
        auditLogService.log(evtB, actor(ownerB), "ORG", String.valueOf(orgB.getId()), Map.of("k", "v"));

        assertThat(eventNames(orgA.getId())).contains(evtA).doesNotContain(evtB);
        assertThat(eventNames(orgB.getId())).contains(evtB).doesNotContain(evtA);
    }

    @Test
    @DisplayName("Actor không thuộc trung tâm nào (B2C, job nền) ⇒ org_id NULL, không lọt vào sổ trung tâm nào")
    void b2cActorAndSystemActor_stayOutOfOrgLedger() {
        Organization org = org();
        member(org, "OWNER");
        User b2c = userRepository.save(User.builder()
                .email("c6-b2c-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("B2C")
                .role(User.Role.STUDENT)
                .build());
        String evtB2c = "TEST_B2C_" + UUID.randomUUID();
        String evtSystem = "TEST_SYS_" + UUID.randomUUID();

        auditLogService.log(evtB2c, actor(b2c), "USER", String.valueOf(b2c.getId()), null);
        auditLogService.log(evtSystem, null, "SYSTEM", null, null);

        assertThat(orgIdOf(evtB2c)).isNull();
        assertThat(orgIdOf(evtSystem)).isNull();
        assertThat(eventNames(org.getId())).doesNotContain(evtB2c, evtSystem);
        // Sổ của ADMIN hệ thống vẫn thấy đủ — org chỉ là bộ lọc, không phải bộ xoá.
        assertThat(adminEventNames(evtB2c)).contains(evtB2c);
    }

    @Test
    @DisplayName("org_id là ẢNH CHỤP lúc ghi: actor rời trung tâm rồi thì vết cũ VẪN thuộc trung tâm cũ")
    void orgId_isSnapshotAtWriteTime() {
        Organization org = org();
        User owner = member(org, "OWNER");
        String evt = "TEST_SNAP_" + UUID.randomUUID();

        auditLogService.log(evt, actor(owner), "ORG", String.valueOf(org.getId()), null);

        owner.setOrgId(null); // rời trung tâm
        userRepository.save(owner);

        assertThat(eventNames(org.getId())).contains(evt);
        assertThat(orgIdOf(evt)).isEqualTo(org.getId());
    }

    @Test
    @DisplayName("Bộ lọc q/cat vẫn chạy TRONG phạm vi một trung tâm, không mở rộng ra ngoài")
    void filters_stayInsideOrgScope() {
        Organization orgA = org();
        Organization orgB = org();
        User ownerA = member(orgA, "OWNER");
        User ownerB = member(orgB, "OWNER");
        String shared = "SHARED_" + UUID.randomUUID();

        auditLogService.log(shared, actor(ownerA), "ORG", "a-1", null);
        auditLogService.log(shared, actor(ownerB), "ORG", "b-1", null);

        Map<String, Object> pageA = auditLogService.readOrgAuditLogs(orgA.getId(), shared, "ORG", 0, 50);
        assertThat((Long) pageA.get("total")).isEqualTo(1L);

        Map<String, Object> wrongCat = auditLogService.readOrgAuditLogs(orgA.getId(), shared, "USER", 0, 50);
        assertThat((Long) wrongCat.get("total")).isZero();
    }

    @Test
    @DisplayName("V315 gỡ trigger để backfill rồi GẮN LẠI — bảng vẫn append-only sau migration")
    void immutabilityTrigger_survivesTheBackfillMigration() {
        Organization org = org();
        User owner = member(org, "OWNER");
        String evt = "TEST_IMMUT_" + UUID.randomUUID();
        auditLogService.log(evt, actor(owner), "ORG", String.valueOf(org.getId()), null);

        assertThatThrownBy(() -> jdbcTemplate.update(
                "UPDATE audit_logs SET event_name = 'HACKED' WHERE event_name = ?", evt))
                .hasMessageContaining("append-only");

        assertThatThrownBy(() -> jdbcTemplate.update(
                "DELETE FROM audit_logs WHERE event_name = ?", evt))
                .hasMessageContaining("append-only");

        // Đối chứng dương: vết vẫn còn nguyên sau hai lần thử phá.
        assertThat(orgIdOf(evt)).isEqualTo(org.getId());
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private Organization org() {
        return organizationRepo.save(Organization.builder()
                .name("TT " + UUID.randomUUID().toString().substring(0, 8))
                .slug("c6-" + UUID.randomUUID())
                .seatLimit(50)
                .status("ACTIVE")
                .build());
    }

    private User member(Organization org, String orgRole) {
        User u = userRepository.save(User.builder()
                .email("c6-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("C6 " + orgRole)
                .role(User.Role.TEACHER)
                .orgId(org.getId())
                .build());
        OrgMember m = new OrgMember();
        m.setId(new OrgMemberId(org.getId(), u.getId()));
        m.setRole(orgRole);
        m.setStatus("ACTIVE");
        m.setJoinedAt(Instant.now());
        memberRepo.save(m);
        return u;
    }

    private static AuditActor actor(User u) {
        return new AuditActor(u.getId(), u.getEmail(), "OWNER");
    }

    @SuppressWarnings("unchecked")
    private List<String> eventNames(Long orgId) {
        Map<String, Object> page = auditLogService.readOrgAuditLogs(orgId, null, null, 0, 100);
        return ((List<com.deutschflow.common.audit.AuditLogDto>) page.get("items"))
                .stream().map(com.deutschflow.common.audit.AuditLogDto::eventName).toList();
    }

    @SuppressWarnings("unchecked")
    private List<String> adminEventNames(String q) {
        Map<String, Object> page = auditLogService.readAuditLogs(q, null, 0, 100);
        return ((List<com.deutschflow.common.audit.AuditLogDto>) page.get("items"))
                .stream().map(com.deutschflow.common.audit.AuditLogDto::eventName).toList();
    }

    private Long orgIdOf(String eventName) {
        return jdbcTemplate.queryForObject(
                "SELECT org_id FROM audit_logs WHERE event_name = ?", Long.class, eventName);
    }
}
