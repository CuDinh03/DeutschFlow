package com.deutschflow.video.controller;

import com.deutschflow.common.async.AsyncJob;
import com.deutschflow.common.async.AsyncJobService;
import com.deutschflow.video.dto.RenderStatusDto;
import com.deutschflow.video.dto.VideoTimelineDto;
import com.deutschflow.video.service.VideoLessonService;
import com.deutschflow.video.service.VideoRenderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.UUID;

/**
 * Learning-video endpoints.
 *
 * <ul>
 *   <li>GET  /api/video-lessons/vocab?level=A1&amp;limit=8 — Phase A timeline (image + narration + captions)</li>
 *   <li>POST /api/video-lessons/vocab/render — Phase B: start an async .mp4 render, returns a jobId</li>
 *   <li>GET  /api/video-lessons/render/{jobId} — poll render status / final video URL</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/video-lessons")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class VideoLessonController {

    private final VideoLessonService videoLessonService;
    private final VideoRenderService videoRenderService;
    private final AsyncJobService asyncJobService;

    @GetMapping("/vocab")
    public ResponseEntity<VideoTimelineDto> vocab(
            @RequestParam(defaultValue = "A1") String level,
            @RequestParam(defaultValue = "8") int limit) {
        return ResponseEntity.ok(videoLessonService.buildVocabTimeline(level, limit));
    }

    /** Phase B — start an async .mp4 render of the vocab timeline; poll {@code GET /render/{jobId}}. */
    @PostMapping("/vocab/render")
    public ResponseEntity<Map<String, String>> renderVocab(
            @RequestParam(defaultValue = "A1") String level,
            @RequestParam(defaultValue = "8") int limit) {
        if (!videoRenderService.isFfmpegAvailable()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Video rendering (ffmpeg) is not available");
        }
        AsyncJob job = asyncJobService.createJob("VIDEO_RENDER_VOCAB");
        videoRenderService.renderVocabAsync(job.getId(), level, Math.min(Math.max(limit, 1), 10));
        return ResponseEntity.accepted().body(Map.of("jobId", job.getId().toString()));
    }

    @GetMapping("/render/{jobId}")
    public ResponseEntity<RenderStatusDto> renderStatus(@PathVariable UUID jobId) {
        AsyncJob job = asyncJobService.getJob(jobId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Render job not found"));
        String url = AsyncJob.Status.COMPLETED.name().equals(job.getStatus()) ? job.getResultPayload() : null;
        return ResponseEntity.ok(new RenderStatusDto(job.getStatus(), url, job.getErrorMessage()));
    }
}
