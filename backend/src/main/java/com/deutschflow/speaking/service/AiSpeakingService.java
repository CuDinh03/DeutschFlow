package com.deutschflow.speaking.service;

import com.deutschflow.speaking.dto.AiSpeakingChatResponse;
import com.deutschflow.speaking.dto.AiSpeakingMessageDto;
import com.deutschflow.speaking.dto.AiSpeakingSessionDto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

public interface AiSpeakingService {

    AiSpeakingSessionDto createSession(Long userId, String topic, String cefrLevel);

    AiSpeakingChatResponse chat(Long userId, Long sessionId, String userMessage);

    /**
     * Streaming variant — pushes SSE events "token" and "done" via the emitter.
     *
     * @param streamCancelled when set to {@code true} (e.g. SSE timeout or client disconnect),
     *                        the Groq stream reader aborts without persisting partial output.
     */
    void chatStream(Long userId, Long sessionId, String userMessage, SseEmitter emitter,
                    AtomicBoolean streamCancelled);

    List<AiSpeakingMessageDto> getMessages(Long userId, Long sessionId);

    Page<AiSpeakingSessionDto> getSessions(Long userId, Pageable pageable);

    AiSpeakingSessionDto endSession(Long userId, Long sessionId);
}
