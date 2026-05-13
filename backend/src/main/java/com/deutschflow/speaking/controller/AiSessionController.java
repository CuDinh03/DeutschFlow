package com.deutschflow.speaking.controller;

import com.deutschflow.speaking.dto.AiSpeakingChatRequest;
import com.deutschflow.speaking.dto.AiSpeakingChatResponse;
import com.deutschflow.speaking.dto.AiSpeakingMessageDto;
import com.deutschflow.speaking.dto.AiSpeakingSessionDto;
import com.deutschflow.speaking.dto.CreateSessionRequest;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.speaking.dto.AiSpeakingQuotaDto;
import com.deutschflow.speaking.service.AiSpeakingService;
import com.deutschflow.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

@Slf4j
@RestController
@RequestMapping("/api/ai-speaking")
@RequiredArgsConstructor
/** STUDENT là luồng chính; TEACHER/ADMIN vẫn cần dùng thử Speaking AI (trước đây hasRole STUDENT-only → 403). Khách quiz (ROLE_GUEST) không được. */
@PreAuthorize("hasAnyRole('STUDENT','TEACHER','ADMIN')")
public class AiSessionController {

    private final AiSpeakingService aiSpeakingService;
    private final com.deutschflow.speaking.ai.GroqWhisperClient groqWhisperClient;
    private final QuotaService quotaService;

    @GetMapping("/quota")
    public AiSpeakingQuotaDto quota(@AuthenticationPrincipal User user) {
        var s = quotaService.getSnapshotReadOnly(user.getId(), Instant.now());
        boolean can = s.unlimitedInternal() || s.remainingSpendable() > 0L;
        return new AiSpeakingQuotaDto(can, s.remainingSpendable(), s.planCode());
    }

    @PostMapping("/sessions")
    public AiSpeakingSessionDto createSession(
            @AuthenticationPrincipal User user,
            @RequestBody @Valid CreateSessionRequest request) {
        log.info("User {} creating new AI speaking session for topic: {}", user.getId(), request.topic());
        return aiSpeakingService.createSession(
                user.getId(),
                request.topic(),
                request.cefrLevel(),
                request.persona(),
                request.responseSchema(),
                request.sessionMode(),
                request.interviewPosition(),
                request.experienceLevel());
    }

    @PostMapping("/transcribe")
    public Map<String, String> transcribe(
            @RequestParam("audio") MultipartFile file) throws IOException {
        log.info("Transcribing audio file: {} ({} bytes)", file.getOriginalFilename(), file.getSize());
        String transcript = groqWhisperClient.transcribe(
                file.getBytes(),
                file.getOriginalFilename(),
                "de",
                ""  // No context prompt for generic transcribe endpoint
        );
        return Map.of("transcript", transcript);
    }

    @PostMapping("/sessions/{id}/chat")
    public AiSpeakingChatResponse chat(
            @AuthenticationPrincipal User user,
            @PathVariable Long id,
            @RequestBody @Valid AiSpeakingChatRequest request) {
        return aiSpeakingService.chat(user.getId(), id, request.userMessage());
    }

    @PostMapping("/sessions/{id}/chat/stream")
    public SseEmitter chatStream(
            @AuthenticationPrincipal User user,
            @PathVariable Long id,
            @RequestBody @Valid AiSpeakingChatRequest request) {
        SseEmitter emitter = new SseEmitter(120_000L);
        AtomicBoolean cancelled = new AtomicBoolean(false);
        
        emitter.onCompletion(() -> cancelled.set(true));
        emitter.onTimeout(() -> {
            log.warn("SSE Timeout for session {}", id);
            cancelled.set(true);
        });
        emitter.onError(e -> {
            log.error("SSE Error for session {}: {}", id, e.getMessage());
            cancelled.set(true);
        });

        aiSpeakingService.chatStream(user.getId(), id, request.userMessage(), emitter, cancelled);
        return emitter;
    }

    @GetMapping("/sessions/{id}/messages")
    public List<AiSpeakingMessageDto> getMessages(
            @AuthenticationPrincipal User user,
            @PathVariable Long id) {
        return aiSpeakingService.getMessages(user.getId(), id);
    }

    @GetMapping("/sessions")
    public Page<AiSpeakingSessionDto> getSessions(
            @AuthenticationPrincipal User user,
            Pageable pageable) {
        return aiSpeakingService.getSessions(user.getId(), pageable);
    }

    @PatchMapping("/sessions/{id}/end")
    public AiSpeakingSessionDto endSession(
            @AuthenticationPrincipal User user,
            @PathVariable Long id) {
        return aiSpeakingService.endSession(user.getId(), id);
    }
}
