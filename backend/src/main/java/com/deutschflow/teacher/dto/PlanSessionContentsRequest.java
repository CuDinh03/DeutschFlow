package com.deutschflow.teacher.dto;

import java.util.List;

/**
 * Đặt kế hoạch nội dung cho một buổi: THAY toàn bộ các dòng PLANNED thường của buổi (dòng đã
 * xác nhận và dòng CHUYỂN TIẾP từ buổi trước được giữ nguyên — phần dở luôn đứng đầu, AC06/spec §5).
 */
public record PlanSessionContentsRequest(List<PlanEntry> items) {

    /** curriculumItemId chỉ hợp lệ khi lesson là bài giáo trình và item thuộc đúng Lektion của bài. */
    public record PlanEntry(Long classLessonId, Long curriculumItemId, Integer plannedMinutes, String note) {}
}
