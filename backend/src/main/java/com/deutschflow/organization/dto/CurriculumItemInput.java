package com.deutschflow.organization.dto;

/** Input một mục nội dung bắt buộc của Lektion (PUT thay toàn bộ danh sách — bản DRAFT). */
public record CurriculumItemInput(
        String text,
        String skillTag,
        String contentTag,
        Integer estimatedMinutes
) {}
