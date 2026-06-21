package com.deutschflow.material.repository;

import com.deutschflow.material.entity.Material;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MaterialRepository extends JpaRepository<Material, Long> {

    /** PERSONAL materials of a teacher (uses partial index {@code idx_mat_personal}). */
    List<Material> findByOwnerScopeAndTeacherIdAndStatusOrderByCreatedAtDesc(
            String ownerScope, Long teacherId, String status);

    /** ORG materials of an org (uses partial index {@code idx_mat_org}). */
    List<Material> findByOwnerScopeAndOrgIdAndStatusOrderByCreatedAtDesc(
            String ownerScope, Long orgId, String status);
}
