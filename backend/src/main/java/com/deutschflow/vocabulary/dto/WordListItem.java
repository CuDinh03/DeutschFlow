package com.deutschflow.vocabulary.dto;

public record WordListItem(
        long id,
        String dtype,
        String baseForm,
        String cefrLevel,
        String meaning,
        String example,
        String gender,
        String article,
        String genderColor
) {}

