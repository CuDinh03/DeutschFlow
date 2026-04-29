package com.deutschflow.speaking.service;

import com.deutschflow.speaking.dto.AiSpeakingChatResponse;
import com.deutschflow.speaking.dto.AiSpeakingMessageDto;
import com.deutschflow.speaking.dto.AiSpeakingSessionDto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface AiSpeakingService {

    AiSpeakingSessionDto createSession(Long userId, String topic);

    AiSpeakingChatResponse chat(Long userId, Long sessionId, String userMessage);

    List<AiSpeakingMessageDto> getMessages(Long userId, Long sessionId);

    Page<AiSpeakingSessionDto> getSessions(Long userId, Pageable pageable);

    AiSpeakingSessionDto endSession(Long userId, Long sessionId);
}
