package com.deutschflow.examspeaking.repository;

import com.deutschflow.examspeaking.entity.SpeakingExamResult;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SpeakingExamResultRepository extends JpaRepository<SpeakingExamResult, Long> {

    Optional<SpeakingExamResult> findBySessionId(Long sessionId);

    List<SpeakingExamResult> findTop20ByUserIdOrderByCreatedAtDesc(Long userId);

    List<SpeakingExamResult> findTop200ByOrderByCreatedAtDesc();

    List<SpeakingExamResult> findTop200ByProviderAndLevelOrderByCreatedAtDesc(String provider, String level);
}
