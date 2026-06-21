package com.deutschflow.organization.service;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.organization.dto.OrgClassDetailDto;
import com.deutschflow.organization.dto.OrgClassDto;
import com.deutschflow.organization.dto.OrgClassStudentDto;
import com.deutschflow.organization.dto.OrgMemberDto;
import com.deutschflow.organization.dto.OrgStudentClassDto;
import com.deutschflow.organization.dto.OrgSeatUsageDto;
import com.deutschflow.organization.dto.OrgStudentDetailDto;
import com.deutschflow.organization.dto.OrgSummaryDto;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.teacher.entity.ClassStudent;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassStudentRepository;
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
    private final ClassStudentRepository classStudentRepository;

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
     * Seat usage (B2B model §4, D8): seat = ACTIVE-student capacity. {@code remaining} is null
     * when the org is unlimited (seatLimit = 0). Teachers never consume seats.
     */
    @Transactional(readOnly = true)
    public OrgSeatUsageDto getSeatUsage(Long orgId) {
        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy tổ chức"));
        long used = membershipService.countByRole(orgId, ROLE_STUDENT);
        Long remaining = org.getSeatLimit() > 0 ? Math.max(0L, org.getSeatLimit() - used) : null;
        return new OrgSeatUsageDto(used, org.getSeatLimit(), remaining, org.getValidUntil());
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

    /**
     * Chi tiết một lớp thuộc tổ chức (B1.1): tên giáo viên + roster học viên (kèm skill_*).
     * 404 nếu lớp không tồn tại hoặc không thuộc {@code orgId} (chống IDOR — không lộ lớp org khác).
     */
    @Transactional(readOnly = true)
    public OrgClassDetailDto getClassDetail(Long orgId, Long classId) {
        TeacherClass tc = teacherClassRepository.findById(classId)
                .filter(c -> orgId.equals(c.getOrgId()))
                .orElseThrow(() -> new NotFoundException("Không tìm thấy lớp trong tổ chức"));

        String teacherName = tc.getTeacherId() == null ? null
                : userRepository.findById(tc.getTeacherId()).map(User::getDisplayName).orElse(null);

        List<ClassStudent> roster = classStudentRepository.findByIdClassId(classId);
        List<Long> studentIds = roster.stream().map(cs -> cs.getId().getStudentId()).toList();
        Map<Long, User> usersById = userRepository.findAllById(studentIds).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));

        List<OrgClassStudentDto> students = roster.stream()
                .map(cs -> {
                    User u = usersById.get(cs.getId().getStudentId());
                    return new OrgClassStudentDto(
                            cs.getId().getStudentId(),
                            u != null ? u.getEmail() : null,
                            u != null ? u.getDisplayName() : null,
                            cs.getJoinedAt(),
                            cs.getSkillHoren(),
                            cs.getSkillLesen(),
                            cs.getSkillSchreiben(),
                            cs.getSkillSprechen());
                })
                .toList();

        return new OrgClassDetailDto(
                tc.getId(), tc.getName(), tc.getInviteCode(), tc.getTeacherId(),
                teacherName, tc.getCreatedAt(), students.size(), students);
    }

    /**
     * Chi tiết một học viên thuộc tổ chức (B1.2): membership + các lớp đang theo học (lọc theo org).
     * 404 nếu user không phải thành viên {@code orgId} (chống IDOR — không lộ user org khác).
     */
    @Transactional(readOnly = true)
    public OrgStudentDetailDto getStudentDetail(Long orgId, Long userId) {
        OrgMember member = memberRepo.findByIdOrgIdAndIdUserId(orgId, userId)
                .orElseThrow(() -> new NotFoundException("Học viên không thuộc tổ chức"));
        User user = userRepository.findById(userId).orElse(null);

        List<Long> classIds = classStudentRepository.findByIdStudentId(userId).stream()
                .map(cs -> cs.getId().getClassId())
                .toList();
        List<OrgStudentClassDto> classes = teacherClassRepository.findAllById(classIds).stream()
                .filter(c -> orgId.equals(c.getOrgId()))
                .map(c -> new OrgStudentClassDto(c.getId(), c.getName()))
                .toList();

        return new OrgStudentDetailDto(
                member.getId().getUserId(),
                user != null ? user.getEmail() : null,
                user != null ? user.getDisplayName() : null,
                member.getRole(),
                member.getStatus(),
                member.getJoinedAt(),
                classes);
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
