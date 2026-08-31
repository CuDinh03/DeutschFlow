package com.deutschflow.organization;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.organization.dto.AcademicApproverDto;
import com.deutschflow.organization.dto.GrantAcademicApproverRequest;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.organization.service.OrgAcademicApproverService;
import com.deutschflow.organization.service.OrgGuard;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * PR-2 (GĐ1): người duyệt học vụ trên PostgreSQL thật — V291 áp được, ma trận 4 vai
 * (OWNER/MANAGER/TEACHER được gán/TEACHER thường), phạm vi ORG vs CLASS, gán/thu hồi OWNER-only
 * kể cả gọi service trực tiếp (nền AC19: giáo viên trưởng không tự mở rộng quyền).
 */
@SpringBootTest
@DisplayName("Org academic approver Integration Tests (V291, P01/D13)")
class OrgAcademicApproverIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private OrgAcademicApproverService service;
    @Autowired private OrgGuard orgGuard;
    @Autowired private OrganizationRepository organizationRepo;
    @Autowired private OrgMemberRepository memberRepo;
    @Autowired private UserRepository userRepository;
    @Autowired private TeacherClassRepository classRepo;

    @Test
    @DisplayName("OWNER luôn có quyền duyệt; MANAGER/TEACHER chưa gán thì không — tách học vụ khỏi quản trị")
    void defaultMatrix_ownerOnly() {
        Fixture f = fixture();

        orgGuard.assertAcademicApprover(f.owner.getId(), f.org.getId(), f.classA.getId()); // no throw
        orgGuard.assertAcademicApprover(f.owner.getId(), f.org.getId(), null);             // mức trung tâm

        assertThatThrownBy(() -> orgGuard.assertAcademicApprover(f.manager.getId(), f.org.getId(), f.classA.getId()))
                .isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> orgGuard.assertAcademicApprover(f.teacher.getId(), f.org.getId(), f.classA.getId()))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("scope ORG phủ mọi lớp trung tâm; scope CLASS chỉ đúng lớp được giao (§6 'đúng phạm vi')")
    void scopeCoverage() {
        Fixture f = fixture();
        service.grant(f.owner.getId(), f.org.getId(),
                new GrantAcademicApproverRequest(f.teacher.getId(), "ORG", null));
        service.grant(f.owner.getId(), f.org.getId(),
                new GrantAcademicApproverRequest(f.teacher2.getId(), "CLASS", f.classA.getId()));

        // ORG-scope: mọi lớp + mốc mức trung tâm
        orgGuard.assertAcademicApprover(f.teacher.getId(), f.org.getId(), f.classA.getId());
        orgGuard.assertAcademicApprover(f.teacher.getId(), f.org.getId(), f.classB.getId());
        orgGuard.assertAcademicApprover(f.teacher.getId(), f.org.getId(), null);

        // CLASS-scope: đúng lớp A; lớp B và mốc trung tâm thì không
        orgGuard.assertAcademicApprover(f.teacher2.getId(), f.org.getId(), f.classA.getId());
        assertThatThrownBy(() -> orgGuard.assertAcademicApprover(f.teacher2.getId(), f.org.getId(), f.classB.getId()))
                .isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> orgGuard.assertAcademicApprover(f.teacher2.getId(), f.org.getId(), null))
                .isInstanceOf(ForbiddenException.class);

        List<AcademicApproverDto> listed = service.list(f.manager.getId(), f.org.getId()); // admin xem được
        assertThat(listed).hasSize(2);
        assertThat(listed).anySatisfy(d -> {
            assertThat(d.scope()).isEqualTo("CLASS");
            assertThat(d.className()).isEqualTo(f.classA.getName());
        });
    }

    @Test
    @DisplayName("gán/thu hồi là OWNER-only; validate mục tiêu gán (STUDENT/OWNER/lớp khác org/trùng)")
    void grantValidationAndOwnerOnly() {
        Fixture f = fixture();

        // MANAGER gán → Forbidden (kể cả gọi service trực tiếp)
        assertThatThrownBy(() -> service.grant(f.manager.getId(), f.org.getId(),
                new GrantAcademicApproverRequest(f.teacher.getId(), "ORG", null)))
                .isInstanceOf(ForbiddenException.class);

        // STUDENT / OWNER làm mục tiêu → BadRequest
        assertThatThrownBy(() -> service.grant(f.owner.getId(), f.org.getId(),
                new GrantAcademicApproverRequest(f.student.getId(), "ORG", null)))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.grant(f.owner.getId(), f.org.getId(),
                new GrantAcademicApproverRequest(f.owner.getId(), "ORG", null)))
                .isInstanceOf(BadRequestException.class);

        // scope CLASS với lớp thuộc org KHÁC → NotFound (không lộ tồn tại)
        Fixture other = fixture();
        assertThatThrownBy(() -> service.grant(f.owner.getId(), f.org.getId(),
                new GrantAcademicApproverRequest(f.teacher.getId(), "CLASS", other.classA.getId())))
                .isInstanceOf(NotFoundException.class);

        // scope ORG kèm classId / scope lạ → BadRequest
        assertThatThrownBy(() -> service.grant(f.owner.getId(), f.org.getId(),
                new GrantAcademicApproverRequest(f.teacher.getId(), "ORG", f.classA.getId())))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.grant(f.owner.getId(), f.org.getId(),
                new GrantAcademicApproverRequest(f.teacher.getId(), "GLOBAL", null)))
                .isInstanceOf(BadRequestException.class);

        // trùng phân công đang hiệu lực → Conflict
        service.grant(f.owner.getId(), f.org.getId(),
                new GrantAcademicApproverRequest(f.teacher.getId(), "ORG", null));
        assertThatThrownBy(() -> service.grant(f.owner.getId(), f.org.getId(),
                new GrantAcademicApproverRequest(f.teacher.getId(), "ORG", null)))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    @DisplayName("thu hồi soft: quyền mất ngay, gán lại được (unique chỉ chặn dòng đang hiệu lực), thu hồi lần 2 → 409")
    void revokeLifecycle() {
        Fixture f = fixture();
        AcademicApproverDto granted = service.grant(f.owner.getId(), f.org.getId(),
                new GrantAcademicApproverRequest(f.teacher.getId(), "ORG", null));
        orgGuard.assertAcademicApprover(f.teacher.getId(), f.org.getId(), f.classA.getId());

        // MANAGER thu hồi → Forbidden
        assertThatThrownBy(() -> service.revoke(f.manager.getId(), f.org.getId(), granted.id()))
                .isInstanceOf(ForbiddenException.class);

        service.revoke(f.owner.getId(), f.org.getId(), granted.id());
        assertThatThrownBy(() -> orgGuard.assertAcademicApprover(f.teacher.getId(), f.org.getId(), f.classA.getId()))
                .isInstanceOf(ForbiddenException.class);
        assertThat(service.list(f.owner.getId(), f.org.getId())).isEmpty();

        assertThatThrownBy(() -> service.revoke(f.owner.getId(), f.org.getId(), granted.id()))
                .isInstanceOf(ConflictException.class);

        // Gán lại sau thu hồi: partial unique chỉ chặn dòng đang hiệu lực
        AcademicApproverDto regranted = service.grant(f.owner.getId(), f.org.getId(),
                new GrantAcademicApproverRequest(f.teacher.getId(), "ORG", null));
        assertThat(regranted.id()).isNotEqualTo(granted.id());
        orgGuard.assertAcademicApprover(f.teacher.getId(), f.org.getId(), f.classB.getId());
    }

    @Test
    @DisplayName("cách ly trung tâm: thu hồi phân công của org khác bằng id đoán → NotFound; org khác không thấy danh sách")
    void crossOrgIsolation() {
        Fixture a = fixture();
        Fixture b = fixture();
        AcademicApproverDto granted = service.grant(a.owner.getId(), a.org.getId(),
                new GrantAcademicApproverRequest(a.teacher.getId(), "ORG", null));

        assertThatThrownBy(() -> service.revoke(b.owner.getId(), b.org.getId(), granted.id()))
                .isInstanceOf(NotFoundException.class);
        assertThat(service.list(b.owner.getId(), b.org.getId())).isEmpty();
    }

    // ── fixtures ────────────────────────────────────────────────────────────

    private record Fixture(Organization org, User owner, User manager, User teacher, User teacher2,
                           User student, TeacherClass classA, TeacherClass classB) {}

    private Fixture fixture() {
        Organization org = organizationRepo.save(Organization.builder()
                .name("TT " + UUID.randomUUID().toString().substring(0, 8))
                .slug("org-" + UUID.randomUUID())
                .seatLimit(50)
                .status("ACTIVE")
                .build());
        User owner = member(org, "OWNER", User.Role.TEACHER);
        User manager = member(org, "MANAGER", User.Role.TEACHER);
        User teacher = member(org, "TEACHER", User.Role.TEACHER);
        User teacher2 = member(org, "TEACHER", User.Role.TEACHER);
        User student = member(org, "STUDENT", User.Role.STUDENT);
        TeacherClass classA = newClass(teacher.getId(), org.getId());
        TeacherClass classB = newClass(teacher2.getId(), org.getId());
        return new Fixture(org, owner, manager, teacher, teacher2, student, classA, classB);
    }

    private User member(Organization org, String orgRole, User.Role userRole) {
        User u = userRepository.save(User.builder()
                .email("oaa-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("Approver Tester " + orgRole)
                .role(userRole)
                .build());
        OrgMember m = new OrgMember();
        m.setId(new OrgMemberId(org.getId(), u.getId()));
        m.setRole(orgRole);
        m.setStatus("ACTIVE");
        m.setJoinedAt(Instant.now());
        memberRepo.save(m);
        return u;
    }

    private TeacherClass newClass(Long teacherId, Long orgId) {
        return classRepo.save(TeacherClass.builder()
                .teacherId(teacherId)
                .orgId(orgId)
                .name("A1 — " + UUID.randomUUID().toString().substring(0, 8))
                .inviteCode("INV-" + UUID.randomUUID())
                .createdAt(LocalDateTime.now())
                .build());
    }
}
