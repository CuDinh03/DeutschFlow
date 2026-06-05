package com.deutschflow.video.controller;

import com.deutschflow.video.dto.VideoTimelineDto;
import com.deutschflow.video.service.VideoLessonService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Learning-video timelines (Phase A, in-app). M1: vocabulary by CEFR level.
 *
 * <ul>
 *   <li>GET /api/video-lessons/vocab?level=A1&amp;limit=8 — image + German narration + captions timeline</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/video-lessons")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class VideoLessonController {

    private final VideoLessonService videoLessonService;

    @GetMapping("/vocab")
    public ResponseEntity<VideoTimelineDto> vocab(
            @RequestParam(defaultValue = "A1") String level,
            @RequestParam(defaultValue = "8") int limit) {
        return ResponseEntity.ok(videoLessonService.buildVocabTimeline(level, limit));
    }
}
