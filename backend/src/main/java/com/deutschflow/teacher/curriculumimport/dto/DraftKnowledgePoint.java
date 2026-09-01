package com.deutschflow.teacher.curriculumimport.dto;

/**
 * One knowledge point on a draft lesson. {@code skillTag} / {@code contentTag} are the same
 * whitelisted vocabularies {@code ClassLessonService} enforces on write — a draft that would be
 * rejected at commit time must never reach the preview.
 */
public record DraftKnowledgePoint(String text, String skillTag, String contentTag) {}
