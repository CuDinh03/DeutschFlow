package com.deutschflow.organization;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogDto;
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

    // ── DEC-13 (V317): trung tâm BỊ TÁC ĐỘNG thắng trung tâm của NGƯỜI THAO TÁC ──────────────

    @Test
    @DisplayName("orgId truyền vào THẮNG users.org_id của actor — vết theo ĐỐI TƯỢNG, không theo người")
    void explicitOrgId_beatsActorOrgId() {
        // Cảnh có thật: TEACHER được phép thuộc nhiều trung tâm (owner chốt 09/09/2026), users.org_id
        // chỉ giữ trung tâm CHÍNH. Thao tác trên lớp của trung tâm phụ phải rơi vào sổ của trung tâm
        // phụ, nếu không giám đốc B không bao giờ thấy ai đã đụng vào lớp của mình.
        Organization homeOrg = org();
        Organization touchedOrg = org();
        User teacher = member(homeOrg, "TEACHER");
        String evt = "TEST_EXPLICIT_" + UUID.randomUUID();

        auditLogService.log(evt, actor(teacher, "TEACHER"), "CLASS", "c-1", touchedOrg.getId(), null);

        // Cảnh đã dựng đúng: users.org_id của actor VẪN là trung tâm chính, không bị test sửa lén.
        assertThat(userRepository.findById(teacher.getId()).orElseThrow().getOrgId())
                .isEqualTo(homeOrg.getId());

        assertThat(orgIdOf(evt)).isEqualTo(touchedOrg.getId());
        assertThat(eventNames(touchedOrg.getId())).contains(evt);
        assertThat(eventNames(homeOrg.getId())).doesNotContain(evt);
    }

    @Test
    @DisplayName("🔴 Admin nền tảng (users.org_id NULL) truyền orgId ⇒ giám đốc ĐÚNG trung tâm đọc được, trung tâm khác không")
    void platformAdminTrace_landsInTouchedOrgLedgerOnly() {
        // Đây là ca mà cả V317 lẫn overload mới sinh ra để chữa (DEC-13): admin nền tảng không bao
        // giờ là thành viên trung tâm ⇒ users.org_id NULL ⇒ trước bản vá, mọi thao tác admin trên
        // trung tâm rơi vào org_id NULL và bộ lọc `AND org_id = ?` của giám đốc loại sạch.
        Organization orgA = org();
        Organization orgB = org();
        member(orgA, "OWNER");
        member(orgB, "OWNER");
        User platformAdmin = platformAdmin();
        String evtWith = "TEST_ADMIN_ON_A_" + UUID.randomUUID();
        String evtWithout = "TEST_ADMIN_NOORG_" + UUID.randomUUID();

        auditLogService.log(evtWith, actor(platformAdmin, "ADMIN"), "ORG",
                String.valueOf(orgA.getId()), orgA.getId(), Map.of("action", "seat.changed"));
        // Đối chứng ÂM trên cùng một actor: bỏ orgId thì vết tụt lại vào vùng NULL như trước bản vá.
        // Không có nó, ca trên vẫn xanh kể cả khi tham số orgId bị bỏ qua và org_id được suy ra
        // bằng một đường nào khác.
        auditLogService.log(evtWithout, actor(platformAdmin, "ADMIN"), "ORG",
                String.valueOf(orgA.getId()), null, null);

        assertThat(platformAdmin.getOrgId()).isNull();
        assertThat(orgIdOf(evtWith)).isEqualTo(orgA.getId());
        assertThat(orgIdOf(evtWithout)).isNull();

        assertThat(eventNames(orgA.getId())).contains(evtWith).doesNotContain(evtWithout);
        assertThat(eventNames(orgB.getId())).doesNotContain(evtWith, evtWithout);
        // Sổ toàn nền tảng vẫn thấy cả hai — org là bộ lọc, không phải bộ xoá.
        assertThat(adminEventNames(evtWith)).contains(evtWith);
    }

    @Test
    @DisplayName("V317 cũng gỡ trigger để backfill — bảng PHẢI còn append-only sau khi migration chạy")
    void immutabilityTrigger_survivesV317Backfill() {
        // V317 lặp lại vũ điệu của V315 (DROP TRIGGER → 3 UPDATE → CREATE TRIGGER). Đây là chốt duy
        // nhất bắt được lỗi "quên gắn lại trigger": bảng mất tính bất biến TRONG IM LẶNG, không log,
        // không test nào khác đỏ.
        assertThat(jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM pg_trigger
                 WHERE tgrelid = 'audit_logs'::regclass
                   AND tgname = 'trg_audit_logs_immutable'
                   AND NOT tgisinternal
                """, Long.class)).isEqualTo(1L);

        Organization org = org();
        User owner = member(org, "OWNER");
        String evt = "TEST_IMMUT_317_" + UUID.randomUUID();
        auditLogService.log(evt, actor(owner), "ORG", String.valueOf(org.getId()), org.getId(), null);

        // Sửa đúng CỘT mà V317 ghi đè — nếu trigger chỉ còn chặn vài cột thì ca của V315 vẫn xanh.
        assertThatThrownBy(() -> jdbcTemplate.update(
                "UPDATE audit_logs SET org_id = NULL WHERE event_name = ?", evt))
                .hasMessageContaining("append-only");

        assertThatThrownBy(() -> jdbcTemplate.update(
                "DELETE FROM audit_logs WHERE event_name = ?", evt))
                .hasMessageContaining("append-only");

        assertThat(orgIdOf(evt)).isEqualTo(org.getId());
    }

    @Test
    @DisplayName("Backfill V317 chừa dòng target_id không phải số ('glosbe-vi', 'ALL') và dòng trỏ tới trung tâm đã xoá")
    void v317Backfill_skipsNonNumericTargets_andDeadOrgReferences() {
        // Tiền đề: V317 đã áp thật (index của nó tồn tại). Không có assert này thì mọi khẳng định
        // dưới đây vẫn xanh trên một DB chưa chạy migration.
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM pg_indexes WHERE indexname = 'idx_audit_logs_org_target_created'",
                Long.class)).isEqualTo(1L);

        User platformAdmin = platformAdmin(); // org_id NULL ⇒ vết ghi ra có org_id NULL, đúng diện backfill
        Organization liveOrg = org();
        Long deadOrgId = deletedOrgId();

        String evtGlosbe = "TEST_BF_GLOSBE_" + UUID.randomUUID();
        String evtAll = "TEST_BF_ALL_" + UUID.randomUUID();
        String evtDeadOrg = "TEST_BF_DEAD_" + UUID.randomUUID();
        String evtLiveOrg = "TEST_BF_LIVE_" + UUID.randomUUID();
        String evtUserAll = "TEST_BF_USER_ALL_" + UUID.randomUUID();

        // Dữ liệu thật có những target_id này (xem chú thích BẪY 2 trong V317).
        auditLogService.log(evtGlosbe, actor(platformAdmin, "ADMIN"), "ORG", "glosbe-vi", null, null);
        auditLogService.log(evtAll, actor(platformAdmin, "ADMIN"), "ORG_TIMESHEET", "ALL", null, null);
        auditLogService.log(evtDeadOrg, actor(platformAdmin, "ADMIN"), "ORG",
                String.valueOf(deadOrgId), null, null);
        auditLogService.log(evtLiveOrg, actor(platformAdmin, "ADMIN"), "ORG",
                String.valueOf(liveOrg.getId()), null, null);
        auditLogService.log(evtUserAll, actor(platformAdmin, "ADMIN"), "USER", "SINGLE_USER", null, null);

        // (1) Bộ lọc của backfill KHÔNG chọn ba dòng độc, nhưng CÓ chọn dòng hợp lệ — đối chứng dương
        //     này là thứ ngăn ca trở nên rỗng nếu ai đó siết vị từ tới mức không chọn gì nữa.
        assertThat(branchOneMatches(evtGlosbe)).isZero();
        assertThat(branchOneMatches(evtAll)).isZero();
        assertThat(branchOneMatches(evtDeadOrg)).isZero();
        assertThat(branchOneMatches(evtLiveOrg)).isEqualTo(1L);
        assertThat(branchThreeMatches(evtUserAll)).isZero();

        // (2) Chạy LẠI đúng câu UPDATE của V317, thu hẹp vào các dòng độc: phải trả 0 và KHÔNG NÉM.
        //     Bỏ `~ '^[0-9]+$'` ⇒ "invalid input syntax for type bigint"; bỏ EXISTS ⇒ vi phạm khoá
        //     ngoại. Cả hai đều làm Flyway đứng và BACKEND KHÔNG BOOT.
        assertThat(replayBranchOne(evtGlosbe)).isZero();
        assertThat(replayBranchOne(evtAll)).isZero();
        assertThat(replayBranchOne(evtDeadOrg)).isZero();
        assertThat(replayBranchThree(evtUserAll)).isZero();

        // (3) Ba dòng độc vẫn nguyên org_id NULL, không bị dán nhầm vào trung tâm nào.
        assertThat(orgIdOf(evtGlosbe)).isNull();
        assertThat(orgIdOf(evtAll)).isNull();
        assertThat(orgIdOf(evtDeadOrg)).isNull();
        assertThat(eventNames(liveOrg.getId())).doesNotContain(evtGlosbe, evtAll, evtDeadOrg);
    }

    @Test
    @DisplayName("AuditLogDto mang đúng orgId — cả trên sổ trung tâm lẫn sổ toàn nền tảng")
    void dto_carriesOrgId() {
        Organization org = org();
        User owner = member(org, "OWNER");
        User platformAdmin = platformAdmin();
        String evtOrg = "TEST_DTO_ORG_" + UUID.randomUUID();
        String evtFallback = "TEST_DTO_FALLBACK_" + UUID.randomUUID();

        auditLogService.log(evtOrg, actor(platformAdmin, "ADMIN"), "ORG",
                String.valueOf(org.getId()), org.getId(), null);
        auditLogService.log(evtFallback, actor(owner), "USER", String.valueOf(owner.getId()), null, null);

        // Sổ toàn nền tảng: orgId là thứ DUY NHẤT cho biết thao tác đã chạm vào trung tâm nào.
        assertThat(adminDto(evtOrg).orgId()).isEqualTo(org.getId());
        // Vết của người trong trung tâm vẫn suy từ actor như cũ — không phải NULL.
        assertThat(adminDto(evtFallback).orgId()).isEqualTo(org.getId());

        // Sổ của giám đốc: cùng một giá trị, không suy lại lúc đọc.
        AuditLogDto fromOrgLedger = orgDto(org.getId(), evtOrg);
        assertThat(fromOrgLedger.orgId()).isEqualTo(org.getId());
        assertThat(fromOrgLedger.eventName()).isEqualTo(evtOrg);
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

    /** Admin nền tảng theo DEC-13: KHÔNG bao giờ là thành viên trung tâm ⇒ {@code users.org_id} NULL. */
    private User platformAdmin() {
        return userRepository.save(User.builder()
                .email("c6-admin-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("C6 ADMIN")
                .role(User.Role.ADMIN)
                .build());
    }

    /** Id của một trung tâm ĐÃ BỊ XOÁ — nhánh backfill trỏ vào đây sẽ vi phạm khoá ngoại. */
    private Long deletedOrgId() {
        Organization doomed = org();
        Long id = doomed.getId();
        organizationRepo.deleteById(id);
        organizationRepo.flush();
        return id;
    }

    private static AuditActor actor(User u) {
        return new AuditActor(u.getId(), u.getEmail(), "OWNER");
    }

    private static AuditActor actor(User u, String role) {
        return new AuditActor(u.getId(), u.getEmail(), role);
    }

    // ── replay của V317: nguyên văn vị từ trong migration, chỉ thu hẹp theo event_name ────────
    //
    // 🪤 Cố ý KHÔNG đụng tới nhánh 2 (metadata_json ? 'orgId'): toán tử jsonb `?` sẽ bị driver JDBC
    // hiểu nhầm là placeholder. Nhánh 1 và 3 đã phủ đủ hai cái bẫy cần chốt (target_id không phải
    // số, và trung tâm đã xoá).

    private static final String BRANCH_ONE_PREDICATE = """
             WHERE  a.org_id IS NULL
               AND  a.target_type IN ('ORG', 'ORG_TIMESHEET')
               AND  a.target_id ~ '^[0-9]+$'
               AND  EXISTS (SELECT 1 FROM organizations o WHERE o.id = CAST(a.target_id AS BIGINT))
               AND  a.event_name = ?
            """;

    private static final String BRANCH_THREE_PREDICATE = """
             WHERE  a.org_id IS NULL
               AND  a.target_type = 'USER'
               AND  a.target_id ~ '^[0-9]+$'
               AND  u.id = CAST(a.target_id AS BIGINT)
               AND  u.org_id IS NOT NULL
               AND  a.event_name = ?
            """;

    /** Bao nhiêu dòng LỌT vào nhánh 1 của backfill — 0 nghĩa là migration chừa dòng đó ra. */
    private Long branchOneMatches(String eventName) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM audit_logs a" + BRANCH_ONE_PREDICATE, Long.class, eventName);
    }

    private Long branchThreeMatches(String eventName) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM audit_logs a, users u" + BRANCH_THREE_PREDICATE,
                Long.class, eventName);
    }

    /** Chạy lại UPDATE thật của nhánh 1. Phải trả 0 và không ném — nếu ném, Flyway sẽ đứng. */
    private int replayBranchOne(String eventName) {
        return jdbcTemplate.update(
                "UPDATE audit_logs a SET org_id = CAST(a.target_id AS BIGINT)"
                        + BRANCH_ONE_PREDICATE, eventName);
    }

    private int replayBranchThree(String eventName) {
        return jdbcTemplate.update(
                "UPDATE audit_logs a SET org_id = u.org_id FROM users u" + BRANCH_THREE_PREDICATE,
                eventName);
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

    @SuppressWarnings("unchecked")
    private AuditLogDto adminDto(String eventName) {
        Map<String, Object> page = auditLogService.readAuditLogs(eventName, null, 0, 100);
        return ((List<AuditLogDto>) page.get("items")).stream()
                .filter(d -> eventName.equals(d.eventName()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("không thấy vết " + eventName + " trên sổ nền tảng"));
    }

    @SuppressWarnings("unchecked")
    private AuditLogDto orgDto(Long orgId, String eventName) {
        Map<String, Object> page = auditLogService.readOrgAuditLogs(orgId, eventName, null, 0, 100);
        return ((List<AuditLogDto>) page.get("items")).stream()
                .filter(d -> eventName.equals(d.eventName()))
                .findFirst()
                .orElseThrow(() -> new AssertionError(
                        "không thấy vết " + eventName + " trên sổ của trung tâm " + orgId));
    }

    private Long orgIdOf(String eventName) {
        return jdbcTemplate.queryForObject(
                "SELECT org_id FROM audit_logs WHERE event_name = ?", Long.class, eventName);
    }
}
