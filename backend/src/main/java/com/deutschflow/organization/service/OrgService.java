package com.deutschflow.organization.service;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.organization.dto.OrgClassDto;
import com.deutschflow.organization.dto.OrgMemberDto;
import com.deutschflow.organization.dto.OrgSummaryDto;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Read-side org administration: org summary, member listing, and the read-only
 * class roster scoped to {@code teacher_classes.org_id}.
 *
 * <p>Authorization is enforced by the caller ({@code OrgController} via
 * {@link OrgGuard}); this service trusts the {@code orgId} it receives.
 */
@Service
@RequiredArgsConstructor
public class OrgService {

    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String ROLE_TEACHER = "TEACHER";
    private static final String ROLE_STUDENT = "STUDENT";

    private final OrgMembershipService membershipService;
    private final OrgMemberRepository memberRepo;
    private final OrganizationRepository organizationRepository;
    private final TeacherClassRepository teacherClassRepository;
    private final UserRepository userRepository;

    /** Org dashboard: plan, seat usage, and teacher/student head counts. */
    @Transactional(readOnly = true)
    public OrgSummaryDto getSummary(Long orgId) {
        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy tổ chức"));
        long teacherCount = membershipService.countByRole(orgId, ROLE_TEACHER);
        long studentCount = membershipService.countByRole(orgId, ROLE_STUDENT);
        return new OrgSummaryDto(
                org.getName(),
                org.getPlanCode(),
                studentCount,            // seat used = active students
                org.getSeatLimit(),
                teacherCount,
                studentCount);
    }

    /**
     * Lists ACTIVE members, optionally filtered by role. User email/displayName are
     * batch-resolved to avoid N+1 lookups.
     */
    @Transactional(readOnly = true)
    public List<OrgMemberDto> listMembers(Long orgId, String roleOrNull) {
        List<OrgMember> members = (roleOrNull == null || roleOrNull.isBlank())
                ? memberRepo.findByIdOrgIdAndStatus(orgId, STATUS_ACTIVE)
                : memberRepo.findByIdOrgIdAndRoleAndStatus(orgId, roleOrNull, STATUS_ACTIVE);

        List<Long> userIds = members.stream()
                .map(m -> m.getId().getUserId())
                .toList();
        Map<Long, User> usersById = userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));

        return members.stream()
                .map(m -> toMemberDto(m, usersById.get(m.getId().getUserId())))
                .toList();
    }

    /** Read-only org class roster, paginated, queried by {@code teacher_classes.org_id}. */
    @Transactional(readOnly = true)
    public Page<OrgClassDto> listClasses(Long orgId, Pageable pageable) {
        return teacherClassRepository.findByOrgId(orgId, pageable).map(this::toClassDto);
    }

    private OrgMemberDto toMemberDto(OrgMember member, User user) {
        String email = user != null ? user.getEmail() : null;
        String displayName = user != null ? user.getDisplayName() : null;
        return new OrgMemberDto(
                member.getId().getUserId(),
                email,
                displayName,
                member.getRole(),
                member.getStatus(),
                member.getJoinedAt());
    }

    private OrgClassDto toClassDto(TeacherClass tc) {
        return new OrgClassDto(
                tc.getId(),
                tc.getName(),
                tc.getInviteCode(),
                tc.getTeacherId(),
                tc.getCreatedAt());
    }
}
