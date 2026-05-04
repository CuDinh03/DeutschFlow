package com.deutschflow.vocabulary.dto;

import java.util.List;

public record WordListItem(
        long id,
        String dtype,
        String baseForm,
        String cefrLevel,
        String phonetic,
        String meaning,
        String meaningEn,
        String example,
        String exampleDe,
        String exampleEn,
        String usageNote,
        String gender,
        String article,
        String genderColor,
        List<String> tags,
        WordNounDetails nounDetails,
        WordVerbDetails verbDetails,
        WordAdjectiveDetails adjectiveDetails
) {}

