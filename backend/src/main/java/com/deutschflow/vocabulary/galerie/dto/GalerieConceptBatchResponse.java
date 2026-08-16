package com.deutschflow.vocabulary.galerie.dto;

import java.util.List;

/**
 * Kết quả một lượt sinh visualConcept.
 *
 * @param requested số từ được chọn vào lượt này
 * @param succeeded số từ đã ghi family + concept (image_status = CONCEPT_READY)
 * @param failed    số từ lỗi (LLM/parse) — KHÔNG ghi gì, lượt sau tự retry vì concept vẫn NULL
 * @param remaining số từ đủ điều kiện còn thiếu concept sau lượt này
 * @param failures  tối đa 20 lỗi đầu để admin soi nhanh
 */
public record GalerieConceptBatchResponse(
        int requested,
        int succeeded,
        int failed,
        int remaining,
        List<FailureDetail> failures
) {
    public record FailureDetail(long wordId, String baseForm, String error) {}
}
