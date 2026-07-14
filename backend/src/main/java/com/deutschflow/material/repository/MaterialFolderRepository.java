package com.deutschflow.material.repository;

import com.deutschflow.material.entity.MaterialFolder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MaterialFolderRepository extends JpaRepository<MaterialFolder, Long> {

    /** PERSONAL folders of a teacher (uses partial index {@code idx_material_folders_personal}). */
    List<MaterialFolder> findByOwnerScopeAndTeacherIdOrderByOrderIndexAscNameAsc(
            String ownerScope, Long teacherId);

    /** ORG folders of an org (uses partial index {@code idx_material_folders_org}). */
    List<MaterialFolder> findByOwnerScopeAndOrgIdOrderByOrderIndexAscNameAsc(
            String ownerScope, Long orgId);
}
