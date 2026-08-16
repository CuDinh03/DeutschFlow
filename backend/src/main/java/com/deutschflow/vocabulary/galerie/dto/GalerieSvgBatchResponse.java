package com.deutschflow.vocabulary.galerie.dto;

import java.util.List;

/**
 * Kết quả một lượt sinh artwork SVG (bước 2 pipeline — plan mục 12/18).
 *
 * @param requested số từ CONCEPT_READY được chọn vào lượt này
 * @param succeeded số từ đã có artwork lưu S3 + status = QA_PENDING
 * @param failed    số từ lỗi (API/sanitizer/refusal) — status trả về CONCEPT_READY, lượt sau retry
 * @param remaining số từ CONCEPT_READY còn chờ sinh sau lượt này
 * @param failures  tối đa 20 lỗi đầu để admin soi nhanh
 */
public record GalerieSvgBatchResponse(
        int requested,
        int succeeded,
        int failed,
        int remaining,
        List<FailureDetail> failures
) {
    public record FailureDetail(long wordId, String baseForm, String error) {}
}
