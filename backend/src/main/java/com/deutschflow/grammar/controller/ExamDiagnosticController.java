package com.deutschflow.grammar.controller;

import com.deutschflow.grammar.service.ExamDiagnosticService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

/**
 * Bài chẩn đoán đầu vào của Luyện thi (đợt (f)). Các Teil làm qua đường luyện đề (kiểm tra / chấm
 * Viết bằng AI), phần Nói là lượt thi thử phần nói; ở đây chỉ bắt đầu, xem trạng thái, chốt.
 */
@RestController
@RequestMapping("/api/exam-diagnostic")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class ExamDiagnosticController {

    private final ExamDiagnosticService service;

    public record StartRequest(LocalDate targetDate, Integer dailyMinutes) {}

    @GetMapping
    public ExamDiagnosticService.View view(@AuthenticationPrincipal User user) {
        return service.view(user);
    }

    @PostMapping("/start")
    public ExamDiagnosticService.View start(@AuthenticationPrincipal User user, @RequestBody StartRequest body) {
        return service.start(user, body.targetDate(), body.dailyMinutes());
    }

    @PostMapping("/finish")
    public ExamDiagnosticService.View finish(@AuthenticationPrincipal User user) {
        return service.finish(user);
    }
}
