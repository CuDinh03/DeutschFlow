package com.deutschflow.common.async;

import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Optional;
import java.util.UUID;

/**
 * Đường đọc chung cho job nền (web luyện tập {@code GENERATE_PRACTICE*}, mobile thi thử
 * {@code FINISH_EXAM}). Cả hai endpoint chỉ trả job của CHÍNH người gọi hoặc của ADMIN; job của
 * người khác, job không tồn tại và job không creator đều là 404 (GAP-11 — trước đây chỉ cần đăng nhập
 * là đọc được {@code resultPayload} của bất kỳ UUID nào và chiếm được luồng SSE của chủ job).
 * Các luồng nhạy cảm hơn (PPTX giáo viên, nhập giáo trình) vẫn dùng endpoint riêng của chúng.
 */
@RestController
@RequestMapping("/api/async-jobs")
@RequiredArgsConstructor
public class AsyncJobController {

    private final AsyncJobSseService asyncJobSseService;
    private final AsyncJobService asyncJobService;

    @GetMapping(value = "/{jobId}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<SseEmitter> streamJobEvents(@AuthenticationPrincipal User user,
                                                      @PathVariable UUID jobId) {
        // Kiểm chủ job TRƯỚC khi đăng ký emitter — đăng ký rồi mới kiểm là đã chiếm được một chỗ nghe.
        Optional<AsyncJob> job = asyncJobService.getJobForUser(jobId, user);
        if (job.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(asyncJobSseService.register(jobId));
    }

    @GetMapping("/{jobId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<AsyncJob> getJob(@AuthenticationPrincipal User user, @PathVariable UUID jobId) {
        return asyncJobService.getJobForUser(jobId, user)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
