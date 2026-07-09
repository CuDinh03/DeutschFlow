package com.deutschflow.material.repository;

import com.deutschflow.material.entity.LessonMaterial;
import com.deutschflow.material.entity.LessonMaterialId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LessonMaterialRepository extends JpaRepository<LessonMaterial, LessonMaterialId> {

    List<LessonMaterial> findByIdLessonIdOrderByOrderIndexAsc(Long lessonId);

    boolean existsByIdLessonIdAndIdMaterialId(Long lessonId, Long materialId);

    @Modifying
    long deleteByIdLessonIdAndIdMaterialId(Long lessonId, Long materialId);

    @Query("SELECT COALESCE(MAX(lm.orderIndex), -1) FROM LessonMaterial lm WHERE lm.id.lessonId = :lessonId")
    int findMaxOrderIndex(@Param("lessonId") Long lessonId);
}
