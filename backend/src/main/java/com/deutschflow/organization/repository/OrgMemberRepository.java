package com.deutschflow.organization.repository;

import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface OrgMemberRepository extends JpaRepository<OrgMember, OrgMemberId> {
    List<OrgMember> findByIdOrgIdAndStatus(Long orgId, String status);
    List<OrgMember> findByIdOrgIdAndRoleAndStatus(Long orgId, String role, String status);
    Optional<OrgMember> findByIdOrgIdAndIdUserId(Long orgId, Long userId);
    long countByIdOrgIdAndRoleAndStatus(Long orgId, String role, String status);
    boolean existsByIdUserIdAndRoleInAndStatus(Long userId, Collection<String> roles, String status);

    /** True if the user has a membership of the given status in ANY org other than {@code orgId}
     *  (enforces "1 staff – 1 org at a time": B2B model §4 decision 1). */
    boolean existsByIdUserIdAndStatusAndIdOrgIdNot(Long userId, String status, Long orgId);
}
