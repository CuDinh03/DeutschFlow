package com.deutschflow.examspeaking.repository;

import com.deutschflow.examspeaking.entity.SpeakingExamSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SpeakingExamSessionRepository extends JpaRepository<SpeakingExamSession, Long> {

    Optional<SpeakingExamSession> findByIdAndUserId(Long id, Long userId);

    List<SpeakingExamSession> findTop20ByUserIdOrderByCreatedAtDesc(Long userId);
}
