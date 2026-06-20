package com.deutschflow.video.controller;

import com.deutschflow.common.async.AsyncJob;
import com.deutschflow.common.async.AsyncJobService;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.organization.service.OrgPoolGuard;
import com.deutschflow.user.entity.User;
import com.deutschflow.video.dto.RenderStatusDto;
import com.deutschflow.video.dto.VideoTimelineDto;
import com.deutschflow.video.service.VideoLessonService;
import com.deutschflow.video.service.VideoRenderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
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

    private static final long LISTENING_ESTIMATED_TOKENS = 1_000L;

    private final VideoLessonService videoLessonService;
    private final VideoRenderService videoRenderService;
    private final AsyncJobService asyncJobService;
    private final QuotaService quotaService;
    private final OrgPoolGuard orgPoolGuard;

    @GetMapping("/vocab")
    public ResponseEntity<VideoTimelineDto> vocab(
            @RequestParam(defaultValue = "A1") String level,
            @RequestParam(defaultValue = "8") int limit) {
        return ResponseEntity.ok(videoLessonService.buildVocabTimeline(level, limit));
    }

    /** Timeline from the learner's SRS due cards — a review video of words due today. */
    @GetMapping("/vocab/due")
    public ResponseEntity<VideoTimelineDto> vocabDue(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "8") int limit) {
        return ResponseEntity.ok(videoLessonService.buildDueTimeline(user.getId(), limit));
    }

    /** Grammar-explainer video for a grammar case (text cards: rule + worked examples). */
    @GetMapping("/grammar/{caseId}")
    public ResponseEntity<VideoTimelineDto> grammar(
            @PathVariable long caseId,
            @RequestParam(defaultValue = "8") int limit) {
        return ResponseEntity.ok(videoLessonService.buildGrammarTimeline(caseId, limit));
    }

    /** Grammar video keyed by case name (e.g. "akkusativ") — convenient for the mobile grammar screen. */
    @GetMapping("/grammar/by-name/{caseName}")
    public ResponseEntity<VideoTimelineDto> grammarByName(
            @PathVariable String caseName,
            @RequestParam(defaultValue = "8") int limit) {
        return ResponseEntity.ok(videoLessonService.buildGrammarTimelineByName(caseName, limit));
    }

    /** Listening-practice video: an LLM-generated German dialogue on a topic (text cards). */
    @GetMapping("/listening")
    public ResponseEntity<VideoTimelineDto> listening(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "Alltag") String topic,
            @RequestParam(defaultValue = "A2") String level) {
        quotaService.assertAllowed(user.getId(), Instant.now(), LISTENING_ESTIMATED_TOKENS);
        orgPoolGuard.assertOrgPoolAvailable(user.getId(), LISTENING_ESTIMATED_TOKENS);
        return ResponseEntity.ok(videoLessonService.buildListeningTimeline(user.getId(), topic, level));
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
