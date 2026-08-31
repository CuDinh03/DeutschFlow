package com.deutschflow.organization.dto;

import java.util.List;

/**
 * Nhập bản NHÁP giáo trình từ JSON có cấu trúc — đường nhận bộ giáo trình thật (P03):
 * nhập → trung tâm kiểm tra/biên tập → publish → gán lớp. Luôn tạo bộ mới + phiên bản 1 DRAFT.
 * Giới hạn kích thước được validate ở service (không tin dữ liệu ngoài).
 */
public record ImportCurriculumRequest(
        String name,
        String cefrLevel,
        String description,
        String sourceNote,
        List<ImportLektion> lektionen
) {
    public record ImportLektion(
            String title,
            String description,
            List<CurriculumItemInput> items,
            List<CurriculumObjectiveInput> objectives
    ) {}
}
