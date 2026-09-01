package com.deutschflow.teacher.curriculumimport.template;

import com.deutschflow.teacher.curriculumimport.dto.DraftModule;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;
import java.util.Map;

/**
 * One unit of a template — a chapter (Kapitel) or a review unit (Plattform / Wiederholung).
 *
 * <p>{@code content} maps a content tag from the whitelist ({@code WORTSCHATZ}, {@code GRAMMATIK},
 * …) to that chapter's topic labels. Keeping the tag as the map key is what makes the three-session
 * split a data-driven rule instead of coursebook-specific code.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record TemplateUnit(
        Integer number,
        String title,
        String kind,
        Integer bookPageFrom,
        Integer bookPageTo,
        List<String> goals,
        Map<String, List<String>> content) {

    public boolean isChapter() {
        return !DraftModule.KIND_REVIEW.equalsIgnoreCase(kind);
    }

    public List<String> contentFor(String tag) {
        if (content == null) return List.of();
        List<String> v = content.get(tag);
        return v == null ? List.of() : v;
    }
}
