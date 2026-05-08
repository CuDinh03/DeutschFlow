package com.deutschflow.curriculum.controller;

import com.deutschflow.curriculum.service.PlacementTestService;
import com.deutschflow.curriculum.service.SkillTreeService;
import com.deutschflow.curriculum.service.WhisperApiClient;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;

/**
 * REST controller for the Skill Tree (Cây Kỹ Năng).
 *
 * <h3>Endpoints:</h3>
 * <ul>
 *   <li>GET  /api/skill-tree/me     — Lấy toàn bộ cây kỹ năng của user</li>
 *   <li>POST /api/skill-tree/{id}/unlock — Mở khóa Nhánh phụ (SATELLITE_LEAF)</li>
 *   <li>POST /api/skill-tree/{id}/submit — Nộp bài cho một node</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/skill-tree")
@RequiredArgsConstructor
public class SkillTreeController {

    private final SkillTreeService skillTreeService;
    private final PlacementTestService placementTestService;
    private final WhisperApiClient whisperApiClient;

    // ─────────────────────────────────────────────────────────────
    // POST /api/skill-tree/placement-test — Tạo bài test xếp lớp
    // ─────────────────────────────────────────────────────────────

    @PostMapping("/placement-test")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> createPlacementTest(
            @AuthenticationPrincipal User user,
            @RequestBody Map<String, String> body
    ) {
        String claimedLevel = body.getOrDefault("claimedLevel", "A1");
        return ResponseEntity.ok(placementTestService.createTest(user.getId(), claimedLevel));
    }

    // ─────────────────────────────────────────────────────────────
    // POST /api/skill-tree/placement-test/{testId}/submit — Nộp bài
    // ─────────────────────────────────────────────────────────────

    @PostMapping("/placement-test/{testId}/submit")
    @PreAuthorize("isAuthenticated()")
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> submitPlacementTest(
            @AuthenticationPrincipal User user,
            @PathVariable String testId,
            @RequestBody Map<String, Object> body
    ) {
        Map<String, String> answers = (Map<String, String>) body.getOrDefault("answers", Map.of());
        return ResponseEntity.ok(placementTestService.submitTest(user.getId(), testId, answers));
    }

    // ─────────────────────────────────────────────────────────────
    // GET /api/skill-tree/me — Lấy toàn bộ Skill Tree + tiến độ
    // ─────────────────────────────────────────────────────────────

    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<Map<String, Object>>> getMySkillTree(
            @AuthenticationPrincipal User user
    ) {
        return ResponseEntity.ok(skillTreeService.getSkillTreeForUser(user.getId()));
    }

    // ─────────────────────────────────────────────────────────────
    // POST /api/skill-tree/{nodeId}/unlock — Mở khóa Nhánh phụ
    //
    // Luồng:
    //   Request → Check Cache DB → Nếu có → trả JSON ngay
    //                             → Nếu không → gọi Async LLM
    //                               → Bắn SSE về Client
    //                               → Lưu Cache vào DB
    // ─────────────────────────────────────────────────────────────

    @PostMapping(value = "/{nodeId}/unlock", produces = {
            MediaType.APPLICATION_JSON_VALUE,
            MediaType.TEXT_EVENT_STREAM_VALUE
    })
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> unlockNode(
            @AuthenticationPrincipal User user,
            @PathVariable long nodeId
    ) {
        Object result = skillTreeService.unlockSatelliteNode(user.getId(), nodeId);

        // Nếu cache HIT → trả JSON ngay lập tức
        if (result instanceof Map) {
            return ResponseEntity.ok(result);
        }

        // Nếu cache MISS → trả SseEmitter (text/event-stream)
        // Client sẽ nhận events: status → done/error
        if (result instanceof SseEmitter emitter) {
            return ResponseEntity.ok()
                    .contentType(MediaType.TEXT_EVENT_STREAM)
                    .body(emitter);
        }

        return ResponseEntity.internalServerError().build();
    }

    // ─────────────────────────────────────────────────────────────
    // GET /api/skill-tree/node/{nodeId}/session — Lấy nội dung bài học
    // Trả về toàn bộ content_json (all-in-one, ~30KB → Gzip ~5KB)
    // Frontend lưu vào Zustand store → phân phối zero-latency
    // ─────────────────────────────────────────────────────────────

    @GetMapping("/node/{nodeId}/session")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getNodeSession(
            @AuthenticationPrincipal User user,
            @PathVariable long nodeId
    ) {
        Map<String, Object> session = skillTreeService.getNodeSession(user.getId(), nodeId);
        return ResponseEntity.ok(session);
    }

    // ─────────────────────────────────────────────────────────────
    // POST /api/skill-tree/{nodeId}/submit — Nộp bài tập
    // ─────────────────────────────────────────────────────────────

    @PostMapping("/{nodeId}/submit")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> submitExercises(
            @AuthenticationPrincipal User user,
            @PathVariable long nodeId,
            @RequestBody Map<String, Object> answers
    ) {
        Map<String, Object> result = skillTreeService.submitNodeExercises(
                user.getId(), nodeId, answers);
        return ResponseEntity.ok(result);
    }

    // ─────────────────────────────────────────────────────────────
    // POST /api/skill-tree/evaluate-pronunciation — Đánh giá phát âm
    // ─────────────────────────────────────────────────────────────

    @PostMapping("/evaluate-pronunciation")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> evaluatePronunciation(
            @AuthenticationPrincipal User user,
            @RequestParam("audio") org.springframework.web.multipart.MultipartFile audio,
            @RequestParam("originalText") String originalText,
            @RequestParam(value = "focusPhonemes", required = false, defaultValue = "[]") String focusPhonemesJson
    ) {
        try {
            // Step 1: Transcribe audio via Whisper API (Java-native, no Python)
            String transcribed = whisperApiClient.transcribeText(
                    audio.getBytes(), audio.getOriginalFilename());
            
            // Step 2: Parse focus phonemes
            List<String> focusPhonemes = List.of();
            try {
                var node = new com.fasterxml.jackson.databind.ObjectMapper().readTree(focusPhonemesJson);
                if (node.isArray()) {
                    focusPhonemes = new java.util.ArrayList<>();
                    for (var el : node) focusPhonemes.add(el.asText());
                }
            } catch (Exception ignored) {}

            // Step 3: LLM evaluation
            Map<String, Object> result = skillTreeService.evaluatePronunciation(
                    user.getId(), originalText, transcribed, focusPhonemes);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Đánh giá thất bại: " + e.getMessage()));
        }
    }

    // ─────────────────────────────────────────────────────────────
    // POST /api/skill-tree/correct-writing — Sửa bài viết
    // ─────────────────────────────────────────────────────────────

    @PostMapping("/correct-writing")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> correctWriting(
            @AuthenticationPrincipal User user,
            @RequestBody Map<String, Object> request
    ) {
        String text = (String) request.get("text");
        String taskDe = (String) request.getOrDefault("taskDe", "");

        try {
            String prompt = String.format("""
                    Đóng vai giáo viên tiếng Đức. Học viên A1 viết bài sau:
                    
                    [Đề bài]: %s
                    [Bài viết]: %s
                    
                    Sửa lỗi và trả về JSON:
                    {
                      "corrected_text": "...",
                      "errors": [
                        {"original": "...", "corrected": "...", "type": "grammar|spelling|style", 
                         "explanation_vi": "giải thích bằng tiếng Việt"}
                      ],
                      "score": 0-100,
                      "feedback_vi": "nhận xét tổng quan bằng tiếng Việt"
                    }
                    CHỈ trả về JSON.
                    """, taskDe, text);

            var messages = List.of(
                    new com.deutschflow.speaking.ai.ChatMessage("system", "Bạn là giáo viên tiếng Đức. Trả lời bằng JSON."),
                    new com.deutschflow.speaking.ai.ChatMessage("user", prompt)
            );
            var result = skillTreeService.getGroqClient().chatCompletion(messages, null, 0.2, 2048);
            var parsed = new com.fasterxml.jackson.databind.ObjectMapper().readTree(result.content());
            return ResponseEntity.ok(new com.fasterxml.jackson.databind.ObjectMapper().convertValue(parsed, Map.class));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of(
                    "corrected_text", text,
                    "errors", List.of(),
                    "score", 0,
                    "feedback_vi", "Không thể sửa bài lúc này."
            ));
        }
    }
}
