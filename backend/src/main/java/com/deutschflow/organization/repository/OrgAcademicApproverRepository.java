package com.deutschflow.organization.repository;

import com.deutschflow.organization.entity.OrgAcademicApprover;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
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

    /**
     * Thu hồi (soft) MỌI phân công đang hiệu lực của một người trong trung tâm — gọi khi thành viên
     * bị gỡ/rời org (security H1: quyền duyệt không được sống lâu hơn tư cách thành viên, và không
     * được "sống lại" nếu người đó quay lại org với vai trò khác). revokedBy null = thu hồi theo
     * vòng đời thành viên, không phải quyết định tay của giám đốc.
     */
    @Modifying
    @Query("""
            UPDATE OrgAcademicApprover a SET a.revokedAt = :now, a.revokedBy = :revokedBy
            WHERE a.orgId = :orgId AND a.userId = :userId AND a.revokedAt IS NULL
            """)
    int revokeAllActiveFor(@Param("orgId") Long orgId,
                           @Param("userId") Long userId,
                           @Param("now") LocalDateTime now,
                           @Param("revokedBy") Long revokedBy);
}
