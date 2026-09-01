package com.deutschflow.teacher.curriculumimport.template;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

/**
 * A managed curriculum template: the pedagogical skeleton of a coursebook (chapter titles, learning
 * goals and topic labels per chapter, and each chapter's page span), loaded from a JSON resource.
 *
 * <p>It holds METADATA only — no exercises, transcripts, answer keys or artwork — which is what lets
 * the importer produce a full plan without ever shipping or transmitting the book itself.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record CurriculumTemplate(
        String id,
        String title,
        String level,
        Integer pageOffset,
        Integer defaultSessionsPerChapter,
        Integer defaultUnitsPerSession,
        List<TemplateUnit> units) {

    public int chapterCount() {
        return (int) units.stream().filter(TemplateUnit::isChapter).count();
    }

    public int reviewCount() {
        return (int) units.stream().filter(u -> !u.isChapter()).count();
    }
}
