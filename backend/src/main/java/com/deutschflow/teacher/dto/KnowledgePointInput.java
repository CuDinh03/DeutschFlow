package com.deutschflow.teacher.dto;

/** One knowledge point in a create/update request. skillTag/contentTag are optional (nullable). */
public record KnowledgePointInput(
        String text,
        String skillTag,
        String contentTag
) {}
