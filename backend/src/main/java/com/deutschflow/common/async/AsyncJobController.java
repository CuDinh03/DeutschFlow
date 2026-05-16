package com.deutschflow.common.async;

import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.UUID;

@RestController
@RequestMapping("/api/async-jobs")
@RequiredArgsConstructor
public class AsyncJobController {

    private final AsyncJobSseService asyncJobSseService;
    private final AsyncJobService asyncJobService;

    @GetMapping(value = "/{jobId}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<SseEmitter> streamJobEvents(@PathVariable UUID jobId) {
        return ResponseEntity.ok(asyncJobSseService.register(jobId));
    }

    @GetMapping("/{jobId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getJob(@PathVariable UUID jobId) {
        return asyncJobService.getJob(jobId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
