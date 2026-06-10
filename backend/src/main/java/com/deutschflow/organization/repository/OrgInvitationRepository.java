package com.deutschflow.organization.repository;

import com.deutschflow.organization.entity.OrgInvitation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrgInvitationRepository extends JpaRepository<OrgInvitation, Long> {
    Optional<OrgInvitation> findByTokenAndStatus(String token, String status);
    List<OrgInvitation> findByOrgIdAndStatus(Long orgId, String status);
    boolean existsByOrgIdAndEmailAndStatus(Long orgId, String email, String status);
}
