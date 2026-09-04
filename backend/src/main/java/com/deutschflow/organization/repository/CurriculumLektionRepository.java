package com.deutschflow.organization.repository;

import com.deutschflow.organization.entity.CurriculumLektion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CurriculumLektionRepository extends JpaRepository<CurriculumLektion, Long> {

    List<CurriculumLektion> findByVersionIdOrderByOrderIndexAsc(Long versionId);

    long countByVersionId(Long versionId);

    @Query("SELECT COALESCE(MAX(l.orderIndex), -1) FROM CurriculumLektion l WHERE l.versionId = :versionId")
    int findMaxOrderIndex(@Param("versionId") Long versionId);
}
