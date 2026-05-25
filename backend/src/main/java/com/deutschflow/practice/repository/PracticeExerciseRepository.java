package com.deutschflow.practice.repository;

import com.deutschflow.practice.entity.PracticeExercise;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PracticeExerciseRepository extends JpaRepository<PracticeExercise, Long> {
    Page<PracticeExercise> findByIsActiveTrue(Pageable pageable);
    Page<PracticeExercise> findByCefrLevelAndIsActiveTrue(String cefrLevel, Pageable pageable);
    Page<PracticeExercise> findBySkillTypeAndIsActiveTrue(String skillType, Pageable pageable);
    Page<PracticeExercise> findByExerciseTypeAndIsActiveTrue(String exerciseType, Pageable pageable);
    Page<PracticeExercise> findByExerciseTypeAndCefrLevelAndIsActiveTrue(String exerciseType, String cefrLevel, Pageable pageable);
}
