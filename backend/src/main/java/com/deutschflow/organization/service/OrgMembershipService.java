package com.deutschflow.organization.service;

import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;

/**
 * Single source of truth for keeping {@code org_members} and the denormalized
 * {@code users.org_id} fast-path in sync.
 *
 * <p>Invariant: {@code users.org_id == org_members.org_id} (ACTIVE) of that user.
 * All mutations to org membership flow through here so the invariant holds in one place.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OrgMembershipService {

    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String STATUS_REMOVED = "REMOVED";
    private static final Set<String> TEACHING_ROLES = Set.of("ADMIN", "TEACHER");

    private final OrgMemberRepository memberRepo;
    private final UserRepository userRepository;

    /**
     * Inserts a new org membership or reactivates an existing one, sets {@code users.org_id},
     * and promotes a global STUDENT to TEACHER when joining as ADMIN/TEACHER.
     */
    @Transactional
    public void upsertMember(Long orgId, Long userId, String role) {
        OrgMember member = memberRepo.findByIdOrgIdAndIdUserId(orgId, userId)
                .map(existing -> {
                    existing.setRole(role);
                    existing.setStatus(STATUS_ACTIVE);
                    return existing;
                })
                .orElseGet(() -> OrgMember.builder()
                        .id(new OrgMemberId(orgId, userId))
                        .role(role)
                        .status(STATUS_ACTIVE)
                        .build());
        memberRepo.save(member);

        User user = userRepository.findById(userId).orElseThrow();
        user.setOrgId(orgId);
        if (TEACHING_ROLES.contains(role) && user.getRole() == User.Role.STUDENT) {
            user.setRole(User.Role.TEACHER);
        }
        userRepository.save(user);
    }

    /**
     * Marks the membership REMOVED, clears {@code users.org_id} when it still points
     * at this org, and demotes the global role back to STUDENT when the user has no
     * remaining active teaching membership in any other org.
     */
    @Transactional
    public void removeMember(Long orgId, Long userId) {
        memberRepo.findByIdOrgIdAndIdUserId(orgId, userId).ifPresent(member -> {
            member.setStatus(STATUS_REMOVED);
            memberRepo.save(member);
        });

        userRepository.findById(userId).ifPresent(user -> {
            if (orgId.equals(user.getOrgId())) {
                user.setOrgId(null);
            }
            // Demote to STUDENT when no other active teaching membership remains
            if (user.getRole() == User.Role.TEACHER &&
                    !memberRepo.existsByIdUserIdAndRoleInAndStatus(userId, TEACHING_ROLES, STATUS_ACTIVE)) {
                log.info("Demoting user {} to STUDENT — no remaining active teaching membership", userId);
                user.setRole(User.Role.STUDENT);
            }
            userRepository.save(user);
        });
    }

    /** Counts ACTIVE members of the given role in the org (seat counting). */
    @Transactional(readOnly = true)
    public long countByRole(Long orgId, String role) {
        return memberRepo.countByIdOrgIdAndRoleAndStatus(orgId, role, STATUS_ACTIVE);
    }
}
