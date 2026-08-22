package com.deutschflow.examspeaking.repository;

import com.deutschflow.examspeaking.entity.SpeakingExamTask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SpeakingExamTaskRepository extends JpaRepository<SpeakingExamTask, Long> {

    /** Đề của hệ đó hoặc đề dùng chung (provider NULL). */
    @Query("""
            SELECT t FROM SpeakingExamTask t
            WHERE t.level = :level AND t.teilNo = :teilNo AND t.archetype = :archetype
              AND t.status = 'APPROVED'
              AND (t.provider IS NULL OR t.provider = :provider)
            """)
    List<SpeakingExamTask> findApproved(@Param("provider") String provider,
                                        @Param("level") String level,
                                        @Param("teilNo") int teilNo,
                                        @Param("archetype") String archetype);
}
