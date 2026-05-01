package com.deutschflow.speaking.repository;

import com.deutschflow.speaking.entity.AiSpeakingSession;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AiSpeakingSessionRepository extends JpaRepository<AiSpeakingSession, Long> {

    Page<AiSpeakingSession> findByUserId(Long userId, Pageable pageable);

    List<AiSpeakingSession> findTop7ByUserIdOrderByStartedAtDesc(Long userId);
}
