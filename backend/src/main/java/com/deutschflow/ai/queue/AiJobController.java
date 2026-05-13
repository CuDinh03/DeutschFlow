package com.deutschflow.ai.queue;

import com.deutschflow.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Map;

/**
 * Controller cho AI Job Queue.
 *
 * POST /api/jobs/pronunciation-eval  — Submit job (trả về jobId ngay)
 * GET  /api/jobs/{jobId}/sse         — Mở SSE stream, nhận kết quả khi Worker xong
 * GET  /api/jobs/{jobId}/status      — Fallback polling nếu SSE không dùng được
 */
@RestController
@RequestMapping("/api/jobs")
@RequiredArgsConstructor
@Slf4j
@PreAuthorize("isAuthenticated()")
public class AiJobController {

    private final AiJobRepository aiJobRepository;
    private final AiJobSseRegistry sseRegistry;

    // ──────────────────────────────────────────────────────────────
    // Submit pronunciation evaluation job
    // ──────────────────────────────────────────────────────────────

    @PostMapping("/pronunciation-eval")
    public ResponseEntity<Map<String, Object>> submitPronunciationEval(
            @AuthenticationPrincipal User user,
            @RequestBody Map<String, Object> body) {

        String originalText = (String) body.get("originalText");
        if (originalText == null || originalText.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "originalText is required"));
        }

        AiJob job = AiJob.builder()
                .jobType(AiJob.TYPE_PRONUNCIATION_EVAL)
                .userId(user.getId())
                .payload(body)
                .build();

        AiJob saved = aiJobRepository.save(job);
        log.info("[Job] Queued PRONUNCIATION_EVAL jobId={} userId={}", saved.getId(), user.getId());

        return ResponseEntity.accepted().body(Map.of(
                "jobId", saved.getId(),
                "status", AiJob.STATUS_PENDING
        ));
    }

    // ──────────────────────────────────────────────────────────────
    // Submit interview report job
    // ──────────────────────────────────────────────────────────────

    @PostMapping("/interview-report")
    public ResponseEntity<Map<String, Object>> submitInterviewReport(
            @AuthenticationPrincipal User user,
            @RequestBody Map<String, Object> body) {

        Object sessionId = body.get("sessionId");
        if (sessionId == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "sessionId is required"));
        }

        AiJob job = AiJob.builder()
                .jobType(AiJob.TYPE_INTERVIEW_REPORT)
                .userId(user.getId())
                .payload(body)
                .build();

        AiJob saved = aiJobRepository.save(job);
        log.info("[Job] Queued INTERVIEW_REPORT jobId={} userId={}", saved.getId(), user.getId());

        return ResponseEntity.accepted().body(Map.of(
                "jobId", saved.getId(),
                "status", AiJob.STATUS_PENDING
        ));
    }

    // ──────────────────────────────────────────────────────────────
    // SSE Stream — Frontend subscribe để nhận kết quả ngay khi Worker xong
    // ──────────────────────────────────────────────────────────────

    @GetMapping(value = "/{jobId}/sse", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter subscribeJobResult(
            @AuthenticationPrincipal User user,
            @PathVariable Long jobId) {

        // Kiểm tra job thuộc về user này
        AiJob job = aiJobRepository.findById(jobId)
                .orElseThrow(() -> new IllegalArgumentException("Job không tìm thấy: " + jobId));

        if (!job.getUserId().equals(user.getId())) {
            throw new SecurityException("Không có quyền truy cập job này");
        }

        // Nếu job đã COMPLETED (worker xong trước khi client connect), trả ngay
        if (AiJob.STATUS_COMPLETED.equals(job.getStatus()) && job.getResult() != null) {
            SseEmitter immediate = new SseEmitter(0L);
            try {
                immediate.send(SseEmitter.event().name("result").data(job.getResult()));
                immediate.complete();
            } catch (Exception e) {
                immediate.completeWithError(e);
            }
            return immediate;
        }

        // Nếu FAILED, trả lỗi ngay
        if (AiJob.STATUS_FAILED.equals(job.getStatus())) {
            SseEmitter errEmitter = new SseEmitter(0L);
            try {
                errEmitter.send(SseEmitter.event().name("error").data(
                        job.getErrorMsg() != null ? job.getErrorMsg() : "Xử lý thất bại"
                ));
                errEmitter.complete();
            } catch (Exception e) {
                errEmitter.completeWithError(e);
            }
            return errEmitter;
        }

        // Job vẫn PENDING/PROCESSING → đăng ký SSE, Worker sẽ push khi xong
        log.info("[SSE] Client subscribed for jobId={} userId={}", jobId, user.getId());
        return sseRegistry.register(jobId);
    }

    // ──────────────────────────────────────────────────────────────
    // Fallback polling endpoint
    // ──────────────────────────────────────────────────────────────

    @GetMapping("/{jobId}/status")
    public ResponseEntity<Map<String, Object>> getJobStatus(
            @AuthenticationPrincipal User user,
            @PathVariable Long jobId) {

        return aiJobRepository.findById(jobId)
                .filter(j -> j.getUserId().equals(user.getId()))
                .map(j -> ResponseEntity.ok(Map.<String, Object>of(
                        "jobId",  j.getId(),
                        "status", j.getStatus(),
                        "result", j.getResult() != null ? j.getResult() : Map.of(),
                        "error",  j.getErrorMsg() != null ? j.getErrorMsg() : ""
                )))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
