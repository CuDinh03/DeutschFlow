package com.deutschflow.speaking.repository;

import com.deutschflow.speaking.entity.AiSpeakingMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AiSpeakingMessageRepository extends JpaRepository<AiSpeakingMessage, Long> {

    List<AiSpeakingMessage> findBySessionIdOrderByCreatedAtAsc(Long sessionId);

    List<AiSpeakingMessage> findTop10BySessionIdOrderByCreatedAtDesc(Long sessionId);

    Optional<AiSpeakingMessage> findFirstBySessionIdAndRoleOrderByCreatedAtDesc(
            Long sessionId,
            AiSpeakingMessage.MessageRole role);
}
