package com.deutschflow.teacher.curriculumimport;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.teacher.curriculumimport.dto.CurriculumTemplateSummary;
import com.deutschflow.teacher.curriculumimport.template.CurriculumTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Loads the managed curriculum templates shipped under {@code classpath:/curriculum-templates/}.
 *
 * <p>The catalog is a resource directory rather than a table on purpose: a template is versioned
 * editorial data, it changes with a release and not with a tenant, and keeping it in git means a
 * wrong chapter title is reviewable in a diff. It needs no migration and no per-environment seeding.
 *
 * <p>Templates are read once at construction. A malformed file is fatal at startup rather than a
 * surprise 500 the first time a teacher opens the import wizard.
 */
@Service
@Slf4j
public class CurriculumTemplateCatalog {

    private static final String LOCATION = "classpath*:/curriculum-templates/*.json";

    private final Map<String, CurriculumTemplate> byId;

    public CurriculumTemplateCatalog(ObjectMapper objectMapper) {
        this.byId = load(objectMapper);
        log.info("Curriculum template catalog loaded: {}", byId.keySet());
    }

    private static Map<String, CurriculumTemplate> load(ObjectMapper objectMapper) {
        Map<String, CurriculumTemplate> out = new LinkedHashMap<>();
        Resource[] resources;
        try {
            resources = new PathMatchingResourcePatternResolver().getResources(LOCATION);
        } catch (IOException e) {
            throw new IllegalStateException("Cannot scan " + LOCATION, e);
        }
        List<Resource> ordered = new ArrayList<>(List.of(resources));
        ordered.sort(Comparator.comparing(r -> String.valueOf(r.getFilename())));

        for (Resource r : ordered) {
            try (InputStream in = r.getInputStream()) {
                CurriculumTemplate t = objectMapper.readValue(in, CurriculumTemplate.class);
                if (t.id() == null || t.id().isBlank() || t.units() == null || t.units().isEmpty()) {
                    throw new IllegalStateException("Template " + r.getFilename() + " has no id or no units");
                }
                out.put(t.id(), t);
            } catch (IOException e) {
                throw new IllegalStateException("Cannot read curriculum template " + r.getFilename(), e);
            }
        }
        return Map.copyOf(out);
    }

    /** Every shipped template, as listed in the wizard's picker. */
    public List<CurriculumTemplateSummary> list() {
        return byId.values().stream()
                .map(t -> new CurriculumTemplateSummary(
                        t.id(),
                        t.title(),
                        t.level(),
                        t.chapterCount(),
                        t.reviewCount(),
                        t.defaultSessionsPerChapter() == null ? 3 : t.defaultSessionsPerChapter(),
                        t.defaultUnitsPerSession() == null ? 4 : t.defaultUnitsPerSession()))
                .toList();
    }

    /** The template with this id, or a 400 — an unknown id is client input, not a server fault. */
    public CurriculumTemplate require(String id) {
        CurriculumTemplate t = id == null ? null : byId.get(id);
        if (t == null) {
            throw new BadRequestException("Không tìm thấy giáo trình mẫu: " + id);
        }
        return t;
    }
}
