package com.deutschflow.examspeaking.repository;

import com.deutschflow.examspeaking.entity.SpeakingExamErrorStat;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SpeakingExamErrorStatRepository extends JpaRepository<SpeakingExamErrorStat, Long> {

    Optional<SpeakingExamErrorStat> findByUserIdAndProviderAndLevelAndTeilNoAndErrorCode(
            Long userId, String provider, String level, int teilNo, String errorCode);

    List<SpeakingExamErrorStat> findByUserIdOrderByLastSeenAtDesc(Long userId);

    List<SpeakingExamErrorStat> findByUserIdAndProviderAndLevelOrderByLastSeenAtDesc(Long userId, String provider, String level);
}
