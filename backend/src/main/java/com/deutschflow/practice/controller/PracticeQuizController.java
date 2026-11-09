package com.deutschflow.practice.controller;

import com.deutschflow.practice.dto.PracticeCatalogItemDto;
import com.deutschflow.practice.dto.PracticeGradeRequest;
import com.deutschflow.practice.dto.PracticeGradeResponse;
import com.deutschflow.practice.dto.PracticeQuizDto;
import com.deutschflow.practice.service.PracticeQuizService;
import com.deutschflow.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * A3 (09/11/2026): thư viện bài tập bổ trợ KHÔNG lộ đáp án trước khi nộp (web dùng). API cũ trong
 * {@link PracticeController} giữ nguyên để tương thích ngược.
 *
 * <ul>
 *   <li>GET  /api/practice/catalog            — danh sách, không có contentJson (chỉ đọc)</li>
 *   <li>GET  /api/practice/catalog/{id}       — đề đã ẩn đáp án (chỉ đọc)</li>
 *   <li>POST /api/practice/catalog/{id}/grade — nộp + server chấm; trả đúng/sai, đáp án, giải thích</li>
 * </ul>
 * GET không ghi DB và không gọi AI (QLT-21).
 */
@RestController
@RequestMapping("/api/practice/catalog")
@RequiredArgsConstructor
public class PracticeQuizController {

    private final PracticeQuizService quizService;

    @GetMapping
    public ResponseEntity<Page<PracticeCatalogItemDto>> catalog(
            @RequestParam(required = false) String exerciseType,
            @RequestParam(required = false) String cefrLevel,
            @RequestParam(required = false) String skillType,
            @PageableDefault(size = 20) Pageable pageable
    ) {
        return ResponseEntity.ok(quizService.catalog(exerciseType, cefrLevel, skillType, pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PracticeQuizDto> quiz(@PathVariable Long id) {
        return ResponseEntity.ok(quizService.quiz(id));
    }

    @PostMapping("/{id}/grade")
    public ResponseEntity<PracticeGradeResponse> grade(
            @AuthenticationPrincipal User user,
            @PathVariable Long id,
            @Valid @RequestBody PracticeGradeRequest request
    ) {
        return ResponseEntity.ok(quizService.grade(user.getId(), id, request));
    }
}
