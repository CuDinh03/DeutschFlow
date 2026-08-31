package com.deutschflow.organization.dto;

/** Input một mục tiêu "Ich kann …" của Lektion (PUT thay toàn bộ danh sách — bản DRAFT). */
public record CurriculumObjectiveInput(
        String text,
        String cefrLevel,
        String skillTag
) {}
