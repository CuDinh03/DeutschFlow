package com.deutschflow.teacher.curriculumimport.dto;

/** One "Ich kann …" statement on a draft lesson (German, observable, CEFR-tagged). */
public record DraftCanDoStatement(String text, String cefrLevel, String skillTag) {}
