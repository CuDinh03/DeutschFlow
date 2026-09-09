package com.deutschflow.common.minor;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.organization.entity.Organization;
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
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * DEC-22 — ĐƯỜNG GHI của {@link MinorLearnerService} trên PostgreSQL THẬT.
 *
 * <p><b>Ranh giới với {@code MinorFoundationIntegrationTest}:</b> ca kia soi V319 ở tầng schema
 * (cột, CHECK, index, trigger) và đọc trạng thái đồng ý từ những dòng nó tự chèn bằng SQL. Ca này
 * đi qua service, tức những thứ chỉ hỏng khi mã Java sai chứ schema vẫn đúng:
 * <ol>
 *   <li>{@code birth_date} là {@code updatable = false} trên entity, nên câu UPDATE tường minh phải
 *       THẬT SỰ ghi được cột — đổi sang {@code userRepository.save} thì bản ghi im lặng không thay
 *       đổi, schema vẫn hợp lệ, và không một unit test nào đỏ;</li>
 *   <li>chốt "chỉ ghi khi NULL" nằm trong mệnh đề {@code WHERE}, do PostgreSQL thi hành;</li>
 *   <li>đổi người liên lạc chính đâm vào {@code uq_student_guardians_primary} nếu Hibernate gửi
 *       INSERT trước UPDATE — đúng thứ tự mặc định của hàng đợi flush, và index thì vẫn đúng;</li>
 *   <li>{@code recordConsent} ghi qua JPA được, không chỉ qua SQL viết tay của test.</li>
 * </ol>
 */
@SpringBootTest
@DisplayName("Nền dữ liệu học viên chưa thành niên — Integration (DEC-22, V319)")
class MinorLearnerFoundationIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private MinorLearnerService service;
    @Autowired private UserRepository userRepository;
    @Autowired private OrganizationRepository organizationRepo;
    @Autowired private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("Ghi được ngày sinh dù cột updatable=false; lần hai KHÔNG ghi đè")
    void birthDate_writtenOnce_neverOverwritten() {
        Organization org = org();
        User manager = user(org);
        User student = user(org);
        LocalDate real = LocalDate.now(MinorPolicy.ZONE).minusYears(14).minusMonths(6);

        assertThat(service.recordBirthDate(student.getId(), real, manager.getId(), org.getId(), actor(manager)))
                .isTrue();
        // Đối chứng dương: cột thật sự đổi. updatable=false + save() sẽ cho ca này NULL.
        assertThat(birthDateOf(student.getId())).isEqualTo(real);
        assertThat(service.statusOf(student.getId())).isEqualTo(MinorPolicy.Status.MINOR_LEGAL);

        LocalDate forged = LocalDate.now(MinorPolicy.ZONE).minusYears(25);
        assertThat(service.recordBirthDate(student.getId(), forged, manager.getId(), org.getId(), actor(manager)))
                .isFalse();
        // Hạ tuổi một em 14 thành 25 là mở khoá đường gửi giọng nói ra ngoài — phải bất động.
        assertThat(birthDateOf(student.getId())).isEqualTo(real);
        assertThat(service.statusOf(student.getId())).isEqualTo(MinorPolicy.Status.MINOR_LEGAL);
    }

    @Test
    @DisplayName("Ai ghi / lúc nào được lưu lại — không có hai cột đó thì 'tuổi lúc thu bản ghi âm' không chứng minh được")
    void birthDate_recordsProvenance() {
        Organization org = org();
        User manager = user(org);
        User student = user(org);

        service.recordBirthDate(student.getId(), LocalDate.of(2012, 3, 4), manager.getId(),
                org.getId(), actor(manager));

        assertThat(jdbcTemplate.queryForObject(
                "SELECT birth_date_recorded_by FROM users WHERE id = ?", Long.class, student.getId()))
                .isEqualTo(manager.getId());
        assertThat(jdbcTemplate.queryForObject(
                "SELECT birth_date_recorded_at FROM users WHERE id = ?", Instant.class, student.getId()))
                .isNotNull();
    }

    @Test
    @DisplayName("🪤 Đổi người liên lạc chính KHÔNG đâm vào uq_student_guardians_primary")
    void changingPrimaryGuardian_doesNotViolatePartialUniqueIndex() {
        Organization org = org();
        User student = user(org);
        User manager = user(org);

        StudentGuardian first = service.recordGuardian(student.getId(), org.getId(),
                new GuardianDraft("Mẹ A", StudentGuardian.Relationship.MOTHER, "0900000001", null, true),
                actor(manager));
        // Nếu Hibernate gửi INSERT trước UPDATE thì dòng dưới ném DataIntegrityViolationException.
        StudentGuardian second = service.recordGuardian(student.getId(), org.getId(),
                new GuardianDraft("Bố B", StudentGuardian.Relationship.FATHER, null, "bo.b@test.local", true),
                actor(manager));

        List<StudentGuardian> all = service.guardiansOf(student.getId());
        assertThat(all).hasSize(2);
        assertThat(all.get(0).getId()).isEqualTo(second.getId());
        assertThat(all.get(0).isPrimary()).isTrue();
        assertThat(all).filteredOn(StudentGuardian::isPrimary).hasSize(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT is_primary FROM student_guardians WHERE id = ?", Boolean.class, first.getId()))
                .isFalse();
    }

    @Test
    @DisplayName("recordConsent ghi qua JPA được, và thu hồi là GHI THÊM chứ không phải sửa")
    void recordConsent_persistsThroughJpa_andRevokeAppends() {
        Organization org = org();
        User student = user(org);
        User manager = user(org);
        Instant signedYesterday = Instant.now().minus(1, ChronoUnit.DAYS);

        service.recordConsent(student.getId(), org.getId(), new ConsentDraft(
                StudentConsent.Scope.AI_PROCESSING, StudentConsent.Action.GRANTED, null,
                StudentConsent.Method.PAPER, "v1", signedYesterday, null), actor(manager));
        assertThat(service.consentStatus(student.getId(), StudentConsent.Scope.AI_PROCESSING).isEffective())
                .isTrue();

        service.recordConsent(student.getId(), org.getId(), new ConsentDraft(
                StudentConsent.Scope.AI_PROCESSING, StudentConsent.Action.REVOKED, null,
                StudentConsent.Method.PHONE, "v1", Instant.now(), null), actor(manager));

        assertThat(service.consentStatus(student.getId(), StudentConsent.Scope.AI_PROCESSING))
                .isEqualTo(ConsentState.REVOKED);
        // Bằng chứng cũ KHÔNG bị xoá — đó là điểm khác biệt với V284.
        assertThat(service.consentLedger(student.getId())).hasSize(2);
        // Phạm vi khác không bị kéo theo: mỗi scope hỏi và trả lời độc lập.
        assertThat(service.consentStatus(student.getId(), StudentConsent.Scope.AUDIO_RECORDING))
                .isEqualTo(ConsentState.NEVER_RECORDED);
    }

    // ── fixtures ────────────────────────────────────────────────────────────

    private Organization org() {
        return organizationRepo.save(Organization.builder()
                .name("TT " + UUID.randomUUID().toString().substring(0, 8))
                .slug("minor-" + UUID.randomUUID())
                .seatLimit(50)
                .status("ACTIVE")
                .build());
    }

    private User user(Organization org) {
        return userRepository.save(User.builder()
                .email("minor-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("Minor IT")
                .role(User.Role.STUDENT)
                .orgId(org.getId())
                .build());
    }

    private AuditActor actor(User u) {
        return new AuditActor(u.getId(), u.getEmail(), "MANAGER");
    }

    private LocalDate birthDateOf(Long userId) {
        return jdbcTemplate.queryForObject(
                "SELECT birth_date FROM users WHERE id = ?", LocalDate.class, userId);
    }
}
