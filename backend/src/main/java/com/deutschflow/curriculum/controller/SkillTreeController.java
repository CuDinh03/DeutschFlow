package com.deutschflow.curriculum.controller;

import com.deutschflow.curriculum.service.SkillTreeService;
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
}
