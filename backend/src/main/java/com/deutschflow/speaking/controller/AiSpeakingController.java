package com.deutschflow.speaking.controller;

import com.deutschflow.speaking.RateLimiterService;
import com.deutschflow.speaking.ai.GroqWhisperClient;
import com.deutschflow.speaking.dto.*;
import com.deutschflow.speaking.exception.AiServiceException;
import com.deutschflow.speaking.service.AiSpeakingService;
import com.deutschflow.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * REST controller for the DeutschFlow AI Speaking Practice feature.
 *
 * <p>All endpoints require a valid JWT token (enforced by {@code JwtAuthFilter}).
 */
@RestController
@RequestMapping("/api/ai-speaking")
@RequiredArgsConstructor
public class AiSpeakingController {

    private static final List<Pattern> PROMPT_INJECTION_PATTERNS = List.of(
            Pattern.compile("ignore\\s+(previous|all)\\s+instructions", Pattern.CASE_INSENSITIVE),
            Pattern.compile("you\\s+are\\s+now", Pattern.CASE_INSENSITIVE),
            Pattern.compile("disregard\\s+(all|previous|your)", Pattern.CASE_INSENSITIVE),
            Pattern.compile("forget\\s+(everything|all|your)", Pattern.CASE_INSENSITIVE),
            Pattern.compile("act\\s+as\\s+(if|a|an)", Pattern.CASE_INSENSITIVE),
            Pattern.compile("new\\s+instructions?:", Pattern.CASE_INSENSITIVE),
            Pattern.compile("system\\s*prompt", Pattern.CASE_INSENSITIVE)
    );

    private final AiSpeakingService aiSpeakingService;
    private final RateLimiterService rateLimiterService;
    private final GroqWhisperClient whisperClient;

    /**
     * POST /api/ai-speaking/sessions — Create a new speaking practice session.
     */
    @PostMapping("/sessions")
    @ResponseStatus(HttpStatus.CREATED)
    public AiSpeakingSessionDto createSession(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody(required = false) CreateSessionRequest request) {
        String topic     = request != null ? request.topic()     : null;
        String cefrLevel = request != null ? request.cefrLevel() : null;
        return aiSpeakingService.createSession(user.getId(), topic, cefrLevel);
    }

    /**
     * POST /api/ai-speaking/sessions/{sessionId}/chat — Send a message and receive AI feedback.
     */
    @PostMapping("/sessions/{sessionId}/chat")
    public ResponseEntity<?> chat(
            @AuthenticationPrincipal User user,
            @PathVariable Long sessionId,
            @Valid @RequestBody AiSpeakingChatRequest request) {

        // Rate limiting check
        if (!rateLimiterService.checkAndRecord(user.getId())) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(Map.of("error", "Rate limit exceeded. Please wait before sending more messages."));
        }

        // Prompt injection guard
        if (containsPromptInjection(request.userMessage())) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Message contains disallowed content."));
        }

        AiSpeakingChatResponse response = aiSpeakingService.chat(user.getId(), sessionId, request.userMessage());
        return ResponseEntity.ok(response);
    }

    /**
     * POST /api/ai-speaking/sessions/{sessionId}/chat/stream — SSE streaming chat.
     * Pushes "token" events (content deltas) and a final "done" event with full metadata.
     */
    @PostMapping(value = "/sessions/{sessionId}/chat/stream",
                 produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter chatStream(
            @AuthenticationPrincipal User user,
            @PathVariable Long sessionId,
            @Valid @RequestBody AiSpeakingChatRequest request) {

        if (!rateLimiterService.checkAndRecord(user.getId())) {
            SseEmitter emitter = new SseEmitter(0L);
            try {
                emitter.send(SseEmitter.event().name("error")
                        .data("Rate limit exceeded. Please wait before sending more messages."));
                emitter.complete();
            } catch (Exception ignored) { }
            return emitter;
        }

        if (containsPromptInjection(request.userMessage())) {
            SseEmitter emitter = new SseEmitter(0L);
            try {
                emitter.send(SseEmitter.event().name("error")
                        .data("Message contains disallowed content."));
                emitter.complete();
            } catch (Exception ignored) { }
            return emitter;
        }

        SseEmitter emitter = new SseEmitter(60_000L);
        // Run in separate thread so controller returns immediately
        new Thread(() ->
                aiSpeakingService.chatStream(user.getId(), sessionId, request.userMessage(), emitter))
                .start();
        return emitter;
    }

    /**
     * GET /api/ai-speaking/sessions/{sessionId}/messages — Get conversation history.
     */
    @GetMapping("/sessions/{sessionId}/messages")
    public List<AiSpeakingMessageDto> getMessages(
            @AuthenticationPrincipal User user,
            @PathVariable Long sessionId) {
        return aiSpeakingService.getMessages(user.getId(), sessionId);
    }

    /**
     * GET /api/ai-speaking/sessions — Get paginated list of user's sessions.
     */
    @GetMapping("/sessions")
    public Page<AiSpeakingSessionDto> getSessions(
            @AuthenticationPrincipal User user,
            @PageableDefault(size = 10) Pageable pageable) {
        return aiSpeakingService.getSessions(user.getId(), pageable);
    }

    /**
     * PATCH /api/ai-speaking/sessions/{sessionId}/end — End a speaking session.
     */
    @PatchMapping("/sessions/{sessionId}/end")
    public AiSpeakingSessionDto endSession(
            @AuthenticationPrincipal User user,
            @PathVariable Long sessionId) {
        return aiSpeakingService.endSession(user.getId(), sessionId);
    }

    /**
     * POST /api/ai-speaking/transcribe — Transcribe audio via Groq Whisper STT.
     * Accepts multipart audio file (webm, mp4, wav); returns { "transcript": "..." }.
     */
    @PostMapping(value = "/transcribe", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> transcribe(
            @AuthenticationPrincipal User user,
            @RequestParam("audio") MultipartFile audio) {
        if (!rateLimiterService.checkAndRecord(user.getId())) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(Map.of("error", "Rate limit exceeded."));
        }
        try {
            String transcript = whisperClient.transcribe(
                    audio.getBytes(),
                    audio.getOriginalFilename() != null ? audio.getOriginalFilename() : "voice.webm",
                    "de");
            return ResponseEntity.ok(Map.of("transcript", transcript));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Handle AiServiceException → 503 Service Unavailable.
     */
    @ExceptionHandler(AiServiceException.class)
    public ResponseEntity<Map<String, String>> handleAiServiceException(AiServiceException ex) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of("error", ex.getMessage()));
    }

    // --- Private helpers ---

    private boolean containsPromptInjection(String message) {
        if (message == null) return false;
        return PROMPT_INJECTION_PATTERNS.stream()
                .anyMatch(pattern -> pattern.matcher(message).find());
    }
}
