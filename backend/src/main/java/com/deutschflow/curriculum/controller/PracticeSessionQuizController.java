package com.deutschflow.curriculum.controller;

import com.deutschflow.curriculum.service.PracticeSessionQuizService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * A3 (09/11/2026): API luyện kỹ năng KHÔNG lộ đáp án trước khi trả lời (web dùng; mobile chưa gọi
 * luồng này). API cũ trong {@link PracticeNodeController} giữ nguyên để tương thích ngược.
 *
 * <ul>
 *   <li>GET  /api/skill-tree/practice/{sessionId}/quiz   — đề đã ẩn đáp án (chỉ đọc)</li>
 *   <li>POST /api/skill-tree/practice/{sessionId}/check  — chấm câu vừa trả lời (không ghi DB)</li>
 *   <li>GET  /api/skill-tree/practice/{sessionId}/review — đáp án + giải thích sau khi nộp (chỉ đọc; 409 nếu chưa nộp)</li>
 * </ul>
 * GET không ghi DB và không gọi AI (QLT-21: phiên hỗ trợ chỉ-đọc của admin chặn GET có ghi).
 */
@RestController
@RequestMapping("/api/skill-tree/practice")
@RequiredArgsConstructor
public class PracticeSessionQuizController {

    private final PracticeSessionQuizService quizService;

    @GetMapping("/{sessionId}/quiz")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> quiz(
            @AuthenticationPrincipal User user,
            @PathVariable long sessionId
    ) {
        return ResponseEntity.ok(quizService.quiz(user.getId(), sessionId));
    }

    @PostMapping("/{sessionId}/check")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> check(
            @AuthenticationPrincipal User user,
            @PathVariable long sessionId,
            @RequestBody Map<String, Object> body
    ) {
        @SuppressWarnings("unchecked")
        Map<String, Object> answers = body != null && body.get("answers") instanceof Map<?, ?> m
                ? (Map<String, Object>) m : Map.of();
        return ResponseEntity.ok(quizService.check(user.getId(), sessionId, answers));
    }

    @GetMapping("/{sessionId}/review")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> review(
            @AuthenticationPrincipal User user,
            @PathVariable long sessionId
    ) {
        return ResponseEntity.ok(quizService.review(user.getId(), sessionId));
    }
}
