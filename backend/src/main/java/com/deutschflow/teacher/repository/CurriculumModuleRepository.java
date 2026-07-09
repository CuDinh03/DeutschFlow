package com.deutschflow.teacher.repository;

import com.deutschflow.teacher.entity.CurriculumModule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CurriculumModuleRepository extends JpaRepository<CurriculumModule, Long> {

    List<CurriculumModule> findByClassIdOrderByOrderIndexAsc(Long classId);

    boolean existsByIdAndClassId(Long id, Long classId);

    @Query("SELECT COALESCE(MAX(m.orderIndex), -1) FROM CurriculumModule m WHERE m.classId = :classId")
    int findMaxOrderIndex(@Param("classId") Long classId);
}
