package com.deutschflow.grammar.dto;

import com.deutschflow.grammar.service.ExamScoringService;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Date;
import java.util.List;

/**
 * Result of a single attempt — response of {@code GET /api/mock-exams/attempts/{attemptId}/result}.
 * <p>
 * Same shape as {@link ExamAttemptDto} except the exam name key is {@code title} (the result query
 * selects {@code e.title} unaliased, whereas the history query aliases it {@code exam_title}).
 */
public record ExamResultDto(
        long id,
        @JsonProperty("exam_id") Long examId,
        String title,
        @JsonProperty("started_at") Date startedAt,
        @JsonProperty("finished_at") Date finishedAt,
        @JsonProperty("total_score") Integer totalScore,
        Boolean passed,
        String status,
        @JsonProperty("detailed_scores_json") String detailedScoresJson,
        @JsonProperty("weak_areas") String weakAreas,
        /**
         * Các ngưỡng đỗ độc lập của đề nhiều cổng (telc: viết 135/225, nói 45/75). Rỗng với đề
         * Goethe. Tính LẠI lúc đọc chứ không lưu: điểm cổng Nói đến từ module luyện thi nói, nên
         * một phiên thi nói sau khi nộp bài viết phải làm đổi kết luận ngay.
         *
         * <p>{@code NON_EMPTY}: đề Goethe không có cổng nào ⇒ khoá này vắng mặt hẳn, hình dạng JSON
         * của mọi đề đang chạy không đổi một byte nào.
         */
        @JsonInclude(JsonInclude.Include.NON_EMPTY)
        List<ExamScoringService.Gate> gates) {}
