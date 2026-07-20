package com.deutschflow.material.repository;

import com.deutschflow.material.entity.AssignmentMaterial;
import com.deutschflow.material.entity.AssignmentMaterialId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AssignmentMaterialRepository extends JpaRepository<AssignmentMaterial, AssignmentMaterialId> {

    List<AssignmentMaterial> findByIdAssignmentIdOrderByOrderIndexAsc(Long assignmentId);

    boolean existsByIdAssignmentIdAndIdMaterialId(Long assignmentId, Long materialId);

    /** How many assignments a material is attached to — used to warn before archiving it. */
    long countByIdMaterialId(Long materialId);

    @Modifying
    long deleteByIdAssignmentIdAndIdMaterialId(Long assignmentId, Long materialId);

    @Query("SELECT COALESCE(MAX(am.orderIndex), -1) FROM AssignmentMaterial am WHERE am.id.assignmentId = :assignmentId")
    int findMaxOrderIndex(@Param("assignmentId") Long assignmentId);
}
