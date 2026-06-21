package com.deutschflow.organization.service;

import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.organization.dto.FreeTeacherDto;
import com.deutschflow.organization.dto.OrgMemberDto;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Platform-admin teacher operations that sit OUTSIDE a single org's self-service (B2B model §3/§6):
 * <ul>
 *   <li>list "free teachers" — {@code TEACHER} with no ACTIVE org membership (derived, no flag);</li>
 *   <li>break-glass view of a teacher who belongs to a center — default-hidden per §3, so every
 *       access writes an {@code audit_logs} row.</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminTeacherService {

    private static final String EVENT_BREAK_GLASS = "ORG_TEACHER_BREAK_GLASS_VIEW";
    private static final String TARGET_TYPE = "ORG_TEACHER";
    private static final Set<String> TEACHING_ROLES = Set.of("OWNER", "MANAGER", "TEACHER");

    private final UserRepository userRepository;
    private final OrgMemberRepository orgMemberRepository;
    private final OrganizationRepository organizationRepository;
    private final AuditLogService auditLogService;

    /** Active TEACHERs with no ACTIVE org membership (derived via {@code users.org_id IS NULL}). */
    @Transactional(readOnly = true)
    public List<FreeTeacherDto> listFreeTeachers() {
        return userRepository.findByRoleAndOrgIdIsNullAndActiveTrue(User.Role.TEACHER).stream()
                .map(u -> new FreeTeacherDto(u.getId(), u.getEmail(), u.getDisplayName()))
                .toList();
    }

    /**
     * Break-glass: platform-admin views an org-affiliated teacher's detail. Default-hidden (§3), so
     * EVERY call writes an audit row (actor, target, org). 404 when the user is not a teaching
     * member of that org (so the audit row is never written for a miss / fishing attempt).
     */
    @Transactional
    public OrgMemberDto breakGlassViewTeacher(Long orgId, Long userId, User actor) {
        OrgMember member = orgMemberRepository.findByIdOrgIdAndIdUserId(orgId, userId)
                .filter(m -> TEACHING_ROLES.contains(m.getRole()))
                .orElseThrow(() -> new NotFoundException("Giáo viên không thuộc tổ chức này"));
        User teacher = userRepository.findById(userId).orElse(null);

        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("orgId", orgId);
        meta.put("orgRole", member.getRole());
        meta.put("status", member.getStatus());
        organizationRepository.findById(orgId).ifPresent(o -> meta.put("orgName", o.getName()));
        auditLogService.log(
                EVENT_BREAK_GLASS,
                actor.getId(),
                actor.getEmail(),
                actor.getRole() != null ? actor.getRole().name() : null,
                TARGET_TYPE,
                String.valueOf(userId),
                meta);

        return new OrgMemberDto(
                userId,
                teacher != null ? teacher.getEmail() : null,
                teacher != null ? teacher.getDisplayName() : null,
                member.getRole(),
                member.getStatus(),
                member.getJoinedAt());
    }
}
