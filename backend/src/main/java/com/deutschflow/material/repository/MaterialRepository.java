package com.deutschflow.material.repository;

import com.deutschflow.material.entity.Material;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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

    // ------------------------------------------------------------- filtered search (Materials Library)
    // Native queries because the tag filter uses Postgres `@>` containment (hits the GIN index
    // idx_materials_tags — `= ANY(tags)` would NOT) and title uses ILIKE — neither is expressible as a
    // derived method. Nullable text params are wrapped in CAST(:x AS text) so a bound Java null doesn't
    // trip "could not determine data type of parameter"; folderId is a Long (integer) so needs no cast.

    /** PERSONAL branch of the filtered list. Any null filter arg is treated as "no filter". */
    @Query(value = """
            SELECT * FROM materials
            WHERE owner_scope = 'PERSONAL' AND teacher_id = :teacherId AND status = :status
              AND (CAST(:query AS text) IS NULL OR title ILIKE '%' || :query || '%')
              AND (CAST(:kind  AS text) IS NULL OR kind = :kind)
              AND (CAST(:tag   AS text) IS NULL OR tags @> ARRAY[:tag]::text[])
              AND (:folderId IS NULL OR folder_id = :folderId)
            ORDER BY created_at DESC
            """, nativeQuery = true)
    List<Material> searchPersonal(@Param("teacherId") Long teacherId, @Param("status") String status,
            @Param("query") String query, @Param("kind") String kind,
            @Param("tag") String tag, @Param("folderId") Long folderId);

    /** ORG branch of the filtered list. Any null filter arg is treated as "no filter". */
    @Query(value = """
            SELECT * FROM materials
            WHERE owner_scope = 'ORG' AND org_id = :orgId AND status = :status
              AND (CAST(:query AS text) IS NULL OR title ILIKE '%' || :query || '%')
              AND (CAST(:kind  AS text) IS NULL OR kind = :kind)
              AND (CAST(:tag   AS text) IS NULL OR tags @> ARRAY[:tag]::text[])
              AND (:folderId IS NULL OR folder_id = :folderId)
            ORDER BY created_at DESC
            """, nativeQuery = true)
    List<Material> searchOrg(@Param("orgId") Long orgId, @Param("status") String status,
            @Param("query") String query, @Param("kind") String kind,
            @Param("tag") String tag, @Param("folderId") Long folderId);
}
