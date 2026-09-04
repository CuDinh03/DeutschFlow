package com.deutschflow.organization.dto;

import java.util.List;

/** Thay toàn bộ mục nội dung bắt buộc của một Lektion DRAFT (empty list = xoá hết). */
public record ReplaceItemsRequest(List<CurriculumItemInput> items) {}
