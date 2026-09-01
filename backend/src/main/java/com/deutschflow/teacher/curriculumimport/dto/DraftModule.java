package com.deutschflow.teacher.curriculumimport.dto;

import java.util.List;

/**
 * One curriculum module in the preview — a Kapitel ({@code kind=CHAPTER}) or a review unit
 * ({@code kind=REVIEW}, e.g. a Plattform). Page numbers are the SOURCE BOOK's own numbering, which
 * is what a teacher holding the book reads; the PDF page offset is applied by the extractor.
 */
public record DraftModule(
        String clientId,
        String title,
        String kind,
        Integer sourcePageFrom,
        Integer sourcePageTo,
        List<DraftLesson> lessons) {

    public static final String KIND_CHAPTER = "CHAPTER";
    public static final String KIND_REVIEW = "REVIEW";
}
