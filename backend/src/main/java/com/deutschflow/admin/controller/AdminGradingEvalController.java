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
 * Admin: đo model AI nào chấm Schreiben chuẩn nhất so với điểm giám khảo (harness F1, khung AI tier).
 *
 * <p>Gọi AI thật (tốn token) ⇒ chỉ ADMIN, dùng one-off khi chọn model cho tầng chấm.
 *
 * <p>⚠️ So model LẠ thì phải truyền {@code maxTokens} tường minh: ứng viên mới dài dòng gấp 4–10×
 * {@code gpt-oss-120b} nên để ngân sách mặc định là biến phép đo thành "model nào ít bị cắt JSON
 * hơn" (số đo: {@code BAO_CAO_CONTRACT_TEST_TIER_2026-08-09.md}). Đọc {@code feedbackMissing} trong
 * kết quả TRƯỚC khi đọc MAE.
 */
@RestController
@RequestMapping("/api/admin/grading-eval")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminGradingEvalController {

    private final GradingEvalService gradingEvalService;

    /**
     * POST /api/admin/grading-eval — body:
     * {models?, tier?, maxTokens?, parallelism?, cases:[{topic?,essay,referenceScore}]}.
     */
    @PostMapping
    public GradingEvalResponse evaluate(@RequestBody GradingEvalRequest request) {
        return gradingEvalService.run(request);
    }

    /** Như trên nhưng trả CSV một dòng mỗi model — dán thẳng vào báo cáo calibration (F1.4). */
    @PostMapping(path = "/csv", produces = "text/csv;charset=UTF-8")
    public String evaluateCsv(@RequestBody GradingEvalRequest request) {
        return GradingEvalService.toCsv(gradingEvalService.run(request));
    }
}
