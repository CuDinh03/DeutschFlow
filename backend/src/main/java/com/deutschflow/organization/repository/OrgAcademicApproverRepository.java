package com.deutschflow.organization.repository;

import com.deutschflow.organization.entity.OrgAcademicApprover;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OrgAcademicApproverRepository extends JpaRepository<OrgAcademicApprover, Long> {

    List<OrgAcademicApprover> findByOrgIdAndRevokedAtIsNullOrderByGrantedAtAsc(Long orgId);

    /**
     * Người này có phân công duyệt học vụ ĐANG hiệu lực phủ lớp {@code classId} không:
     * scope ORG phủ mọi lớp của trung tâm; scope CLASS phải đúng lớp. {@code classId} null
     * (thao tác học vụ mức trung tâm) → chỉ scope ORG đạt.
     */
    @Query("""
            SELECT COUNT(a) > 0 FROM OrgAcademicApprover a
            WHERE a.orgId = :orgId AND a.userId = :userId AND a.revokedAt IS NULL
              AND (a.scope = 'ORG' OR (a.scope = 'CLASS' AND :classId IS NOT NULL AND a.classId = :classId))
            """)
    boolean hasActiveApproval(@Param("orgId") Long orgId,
                              @Param("userId") Long userId,
                              @Param("classId") Long classId);

    boolean existsByOrgIdAndUserIdAndScopeAndRevokedAtIsNull(Long orgId, Long userId, String scope);

    boolean existsByOrgIdAndUserIdAndScopeAndClassIdAndRevokedAtIsNull(Long orgId, Long userId, String scope, Long classId);
}
