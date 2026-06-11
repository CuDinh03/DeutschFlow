package com.deutschflow.admin.controller;

import com.deutschflow.teacher.dto.GradingEvalRequest;
import com.deutschflow.teacher.dto.GradingEvalResponse;
import com.deutschflow.teacher.service.GradingEvalService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin: đo model AI nào chấm Schreiben chuẩn nhất so với điểm giám khảo (checklist — chọn model chấm).
 *
 * <p>Gọi AI thật (tốn token) ⇒ chỉ ADMIN, dùng one-off để chọn/tinh chỉnh {@code GROQ_GRADING_MODEL}.
 */
@RestController
@RequestMapping("/api/admin/grading-eval")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminGradingEvalController {

    private final GradingEvalService gradingEvalService;

    /** POST /api/admin/grading-eval — body: {models?, cases:[{topic?,essay,referenceScore}]}. */
    @PostMapping
    public GradingEvalResponse evaluate(@RequestBody GradingEvalRequest request) {
        return gradingEvalService.run(request);
    }
}
