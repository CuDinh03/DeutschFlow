package com.deutschflow.practice.dto;

/**
 * A3: một thẻ trong thư viện bài tập bổ trợ — KHÔNG có {@code contentJson} (đề + đáp án).
 * Trang danh sách chỉ cần bấy nhiêu; đề lấy riêng qua {@link PracticeQuizDto} (đã ẩn đáp án).
 */
public record PracticeCatalogItemDto(
        Long id,
        String exerciseType,
        String cefrLevel,
        String skillType,
        String examName,
        String sourceName,
        String sourceUrl,
        Integer xpReward
) {
    public static PracticeCatalogItemDto from(PracticeExerciseDto dto) {
        return new PracticeCatalogItemDto(dto.getId(), dto.getExerciseType(), dto.getCefrLevel(),
                dto.getSkillType(), dto.getExamName(), dto.getSourceName(), dto.getSourceUrl(),
                dto.getXpReward());
    }
}
