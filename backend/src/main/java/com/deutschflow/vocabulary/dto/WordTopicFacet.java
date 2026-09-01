package com.deutschflow.vocabulary.dto;

/** Một chủ đề trong bộ lọc: tên canonical (dùng làm tham số {@code tag}) + nhãn đã dịch + số từ. */
public record WordTopicFacet(String name, String label, long count) {}
