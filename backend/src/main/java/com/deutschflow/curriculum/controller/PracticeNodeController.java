package com.deutschflow.curriculum.controller;

import com.deutschflow.curriculum.service.PracticeNodeService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * REST controller for Practice Node system — 4 kỹ năng (Hören/Sprechen/Lesen/Schreiben).
 *
 * <h3>Endpoints:</h3>
 * <ul>
 *   <li>GET  /api/skill-tree/{nodeId}/practice            — Lấy 4 practice sessions</li>
 *   <li>GET  /api/skill-tree/practice/{sessionId}          — Lấy bài tập chi tiết</li>
 *   <li>POST /api/skill-tree/{nodeId}/practice/{skill}/start — Tạo practice session</li>
 *   <li>POST /api/skill-tree/{nodeId}/practice/{skill}/next  — Sinh thêm bài</li>
 *   <li>POST /api/skill-tree/practice/{sessionId}/submit     — Nộp bài</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/skill-tree")
@RequiredArgsConstructor
public class PracticeNodeController {

    private final PracticeNodeService practiceNodeService;

    // ─────────────────────────────────────────────────────────────
    // GET /api/skill-tree/{nodeId}/practice
    // Lấy danh sách 4 practice sessions (1 per skill) cho node này
    // ─────────────────────────────────────────────────────────────

    @GetMapping("/{nodeId}/practice")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> getPracticeSessions(
            @AuthenticationPrincipal User user,
            @PathVariable long nodeId
    ) {
        return ResponseEntity.ok(practiceNodeService.getPracticeSessionsForNode(user.getId(), nodeId));
    }

    // ─────────────────────────────────────────────────────────────
    // GET /api/skill-tree/practice/{sessionId}
    // Lấy bài tập chi tiết của 1 session cụ thể
    // ─────────────────────────────────────────────────────────────

    @GetMapping("/practice/{sessionId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> getSessionDetail(
            @AuthenticationPrincipal User user,
            @PathVariable long sessionId
    ) {
        return ResponseEntity.ok(practiceNodeService.getSessionDetail(user.getId(), sessionId));
    }

    // ─────────────────────────────────────────────────────────────
    // POST /api/skill-tree/{nodeId}/practice/{skillType}/start
    // Tạo practice session Gen-1 cho 1 kỹ năng cụ thể
    // (hoặc trả session đang active nếu đã có)
    // ─────────────────────────────────────────────────────────────

    @PostMapping("/{nodeId}/practice/{skillType}/start")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> startPracticeSession(
            @AuthenticationPrincipal User user,
            @PathVariable long nodeId,
            @PathVariable String skillType
    ) {
        // Check if there's an existing ACTIVE session
        if (practiceNodeService.hasPracticeSessions(user.getId(), nodeId)) {
            // Return existing sessions overview
            return ResponseEntity.ok(practiceNodeService.getPracticeSessionsForNode(user.getId(), nodeId));
        }

        // Generate first session
        Map<String, Object> result = practiceNodeService.generatePracticeSession(
                user.getId(), nodeId, skillType.toUpperCase(), 1);
        return ResponseEntity.ok(result);
    }

    // ─────────────────────────────────────────────────────────────
    // POST /api/skill-tree/{nodeId}/practice/{skillType}/next
    // Sinh Generation N+1 — bài tập mới, không trùng câu đã làm
    // ─────────────────────────────────────────────────────────────

    @PostMapping("/{nodeId}/practice/{skillType}/next")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> generateNextGeneration(
            @AuthenticationPrincipal User user,
            @PathVariable long nodeId,
            @PathVariable String skillType
    ) {
        Map<String, Object> result = practiceNodeService.generateNextGeneration(
                user.getId(), nodeId, skillType.toUpperCase());
        return ResponseEntity.ok(result);
    }

    // ─────────────────────────────────────────────────────────────
    // POST /api/skill-tree/practice/{sessionId}/submit
    // Nộp bài, tính điểm, ghi XP (30 XP/session)
    // ─────────────────────────────────────────────────────────────

    @PostMapping("/practice/{sessionId}/submit")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> submitPracticeSession(
            @AuthenticationPrincipal User user,
            @PathVariable long sessionId,
            @RequestBody Map<String, Object> answers
    ) {
        Map<String, Object> result = practiceNodeService.submitPracticeSession(
                user.getId(), sessionId, answers);
        return ResponseEntity.ok(result);
    }

    // ─────────────────────────────────────────────────────────────
    // POST /api/skill-tree/{nodeId}/practice/trigger-all
    // Manual trigger: sinh đồng thời 4 practice nodes (admin/debug)
    // ─────────────────────────────────────────────────────────────

    @PostMapping("/{nodeId}/practice/trigger-all")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> triggerAllPracticeNodes(
            @AuthenticationPrincipal User user,
            @PathVariable long nodeId
    ) {
        practiceNodeService.triggerAllPracticeNodes(user.getId(), nodeId);
        return ResponseEntity.accepted().body(Map.of(
                "message", "Đang sinh 4 practice nodes (Hören/Sprechen/Lesen/Schreiben)",
                "nodeId", nodeId
        ));
    }
}
