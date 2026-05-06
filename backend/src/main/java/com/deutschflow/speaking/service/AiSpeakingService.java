package com.deutschflow.speaking.service;

import com.deutschflow.speaking.dto.AiSpeakingChatResponse;
import com.deutschflow.speaking.dto.AiSpeakingMessageDto;
import com.deutschflow.speaking.dto.AiSpeakingSessionDto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Adaptive AI speaking sessions (structured JSON tutor turns, persistence, quotas).
 */
public interface AiSpeakingService {

    AiSpeakingSessionDto createSession(Long userId, String topic, String cefrLevel, String persona,
                                       String responseSchema, String sessionMode,
                                       String interviewPosition, String experienceLevel);

    AiSpeakingChatResponse chat(Long userId, Long sessionId, String userMessage);

    void chatStream(
            Long userId,
            Long sessionId,
            String userMessage,
            SseEmitter emitter,
            AtomicBoolean streamCancelled);

    List<AiSpeakingMessageDto> getMessages(Long userId, Long sessionId);

    Page<AiSpeakingSessionDto> getSessions(Long userId, Pageable pageable);

    AiSpeakingSessionDto endSession(Long userId, Long sessionId);
}
