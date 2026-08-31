package com.deutschflow.organization.dto;

import java.util.List;

/** Thay toàn bộ mục tiêu của một Lektion DRAFT (empty list = xoá hết). */
public record ReplaceObjectivesRequest(List<CurriculumObjectiveInput> objectives) {}
