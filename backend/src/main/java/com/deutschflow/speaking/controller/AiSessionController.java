package com.deutschflow.speaking.controller;

import com.deutschflow.speaking.dto.AiSpeakingChatRequest;
import com.deutschflow.speaking.dto.AiSpeakingChatResponse;
import com.deutschflow.speaking.dto.AiSpeakingMessageDto;
import com.deutschflow.speaking.dto.AiSpeakingSessionDto;
import com.deutschflow.speaking.dto.CreateSessionRequest;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.RateLimitExceededException;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.organization.service.OrgPoolGuard;
import com.deutschflow.speaking.ai.GroqWhisperClient.TranscribeResult;
import com.deutschflow.speaking.AiRateLimiterService;
import com.deutschflow.speaking.AiRateLimiterService.Bucket;
import com.deutschflow.speaking.dto.AiSpeakingQuotaDto;
import com.deutschflow.speaking.dto.TranscribeDto;
import com.deutschflow.speaking.service.AiSpeakingService;
import com.deutschflow.speaking.util.TranscribeUploads;
import com.deutschflow.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.io.InputStream;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

@Slf4j
@RestController
@RequestMapping("/api/ai-speaking")
@RequiredArgsConstructor
/** STUDENT là luồng chính; TEACHER/ADMIN vẫn cần dùng thử Speaking AI (trước đây hasRole STUDENT-only → 403). Khách quiz (ROLE_GUEST) không được. */
@PreAuthorize("hasAnyRole('STUDENT','TEACHER','ADMIN')")
public class AiSessionController {

    private static final long STT_ESTIMATED_TOKENS = 200L;

    private final AiSpeakingService aiSpeakingService;
    private final com.deutschflow.speaking.ai.GroqWhisperClient groqWhisperClient;
    private final QuotaService quotaService;
    private final OrgPoolGuard orgPoolGuard;
    private final AiRateLimiterService aiRateLimiterService;
    private final AiUsageLedgerService ledgerService;

    @Value("${app.speaking.sse-emitter-timeout-ms:180000}")
    private long sseEmitterTimeoutMs;

    @Value("${app.ai.transcribe.max-bytes:8388608}")
    private long transcribeMaxBytes;

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
        var auth = SecurityContextHolder.getContext().getAuthentication();
        log.info("AI speaking createSession request path=/api/ai-speaking/sessions userId={} email={} authorities={} role={} topic={} cefrLevel={} persona={} responseSchema={} sessionMode={} interviewPosition={} experienceLevel={} assignmentId={}",
                user != null ? user.getId() : null,
                user != null ? user.getEmail() : null,
                auth != null ? auth.getAuthorities() : null,
                user != null ? user.getRole() : null,
                request.topic(),
                request.cefrLevel(),
                request.persona(),
                request.responseSchema(),
                request.sessionMode(),
                request.interviewPosition(),
                request.experienceLevel(),
                request.assignmentId());
        return aiSpeakingService.createSession(
                user.getId(),
                request.topic(),
                request.cefrLevel(),
                request.persona(),
                request.responseSchema(),
                request.sessionMode(),
                request.interviewPosition(),
                request.experienceLevel(),
                request.assignmentId());
    }

    @PostMapping("/transcribe")
    public TranscribeDto transcribe(
            @AuthenticationPrincipal User user,
            @RequestParam("audio") MultipartFile file) throws IOException {
        quotaService.assertAllowed(user.getId(), Instant.now(), STT_ESTIMATED_TOKENS);
        orgPoolGuard.assertOrgPoolAvailable(user.getId(), STT_ESTIMATED_TOKENS);
        // Per-user request-rate guard on top of the quota wallet. Whisper costs ~$0.006/min and
        // the wallet's audit lags by one call; without this, a single tight loop could rack up
        // significant spend and pin the Whisper API before the quota even debits.
        requireAiBudget(Bucket.TRANSCRIBE, user.getId(), "Too many transcribe requests. Please slow down.");
        byte[] audio = readValidatedAudio(file);
        log.info("Transcribing audio file: {} ({} bytes)", file.getOriginalFilename(), audio.length);
        TranscribeResult stt = groqWhisperClient.transcribe(
                audio,
                file.getOriginalFilename(),
                "de",
                ""  // No context prompt for generic transcribe endpoint
        );
        ledgerService.recordStt(user.getId(), "STT_TRANSCRIBE", groqWhisperClient.getWhisperModel(), stt.durationSeconds());
        return new TranscribeDto(stt.text());
    }

    @PostMapping("/sessions/{id}/chat")
    public AiSpeakingChatResponse chat(
            @AuthenticationPrincipal User user,
            @PathVariable Long id,
            @RequestBody @Valid AiSpeakingChatRequest request) {
        requireAiBudget(Bucket.CHAT, user.getId(), "Too many chat turns. Please slow down.");
        return aiSpeakingService.chat(user.getId(), id, request.userMessage());
    }

    @PostMapping("/sessions/{id}/chat/stream")
    public SseEmitter chatStream(
            @AuthenticationPrincipal User user,
            @PathVariable Long id,
            @RequestBody @Valid AiSpeakingChatRequest request) {
        requireAiBudget(Bucket.CHAT, user.getId(), "Too many chat turns. Please slow down.");
        SseEmitter emitter = new SseEmitter(sseEmitterTimeoutMs);
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

        aiSpeakingService.chatStream(user.getId(), id, request.userMessage(), emitter, cancelled, request.streamAudio());
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

    /** Structured AI evaluation for a completed COMMUNICATION / LESSON session. */
    @GetMapping("/sessions/{id}/report")
    public com.deutschflow.speaking.dto.ConversationReportDto getConversationReport(
            @AuthenticationPrincipal User user,
            @PathVariable Long id) {
        requireAiBudget(Bucket.REPORT, user.getId(), "Too many report requests. Please slow down.");
        return aiSpeakingService.getConversationReport(user.getId(), id);
    }

    /** Throw 429 (with Retry-After) when this user has spent their per-window budget for {@code bucket}. */
    private void requireAiBudget(Bucket bucket, long userId, String message) {
        if (!aiRateLimiterService.allow(bucket, userId)) {
            throw new RateLimitExceededException(message, aiRateLimiterService.retryAfterSeconds(bucket));
        }
    }

    /**
     * Validate + bounded-read an uploaded audio multipart: reject non-audio content types and cap the
     * byte size at {@code app.ai.transcribe.max-bytes} (P1-15). The global multipart limit is a coarse
     * 10MB; this is the tighter, per-endpoint guard that previously existed only as dead code.
     */
    private byte[] readValidatedAudio(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Audio file is required.");
        }
        if (!TranscribeUploads.isAllowedAudioContentType(file.getContentType())) {
            throw new BadRequestException("Unsupported audio format. Allowed: webm, mp4, m4a, mpeg, ogg, wav.");
        }
        try (InputStream in = file.getInputStream()) {
            return TranscribeUploads.readAtMost(in, transcribeMaxBytes);
        } catch (IllegalArgumentException tooBig) {
            throw new BadRequestException("Audio file too large (max " + (transcribeMaxBytes / (1024 * 1024)) + "MB).");
        }
    }
}
