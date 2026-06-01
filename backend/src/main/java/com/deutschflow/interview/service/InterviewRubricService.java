package com.deutschflow.interview.service;

import com.deutschflow.interview.entity.InterviewRubricTemplate;
import com.deutschflow.interview.repository.InterviewRubricTemplateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Resolves the correct rubric template for a given industry and phase.
 * Supports runtime lookup so prompt builders can inject live criteria and weights.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class InterviewRubricService {

    private final InterviewRubricTemplateRepository rubricRepository;

    public Optional<InterviewRubricTemplate> findOverallRubric(String industry) {
        Optional<InterviewRubricTemplate> found = rubricRepository
                .findFirstByIndustryAndPhaseAndActiveTrue(industry, "OVERALL");
        if (found.isEmpty()) {
            log.debug("No OVERALL rubric for industry '{}', using Education fallback", industry);
            found = rubricRepository.findFirstByIndustryAndPhaseAndActiveTrue("Education / Career", "OVERALL");
        }
        return found;
    }

    public Optional<InterviewRubricTemplate> findPhaseRubric(String industry, String phase) {
        return findPhaseRubric(industry, phase, null);
    }

    /**
     * Level-aware rubric lookup: among the active templates for this industry+phase, prefer one whose
     * {@code level_range} (e.g. "A2-B1") covers the candidate's CEFR level, so a B2 candidate is judged
     * against B2 expectations and an A2 candidate against A2 expectations. Falls back to the first
     * active template (level-agnostic) when no level match exists.
     */
    public Optional<InterviewRubricTemplate> findPhaseRubric(String industry, String phase, String cefrLevel) {
        List<InterviewRubricTemplate> candidates =
                rubricRepository.findByIndustryAndPhaseAndActiveTrue(industry, phase);
        if (candidates.isEmpty()) {
            return rubricRepository.findFirstByIndustryAndPhaseAndActiveTrue(industry, phase);
        }
        if (cefrLevel != null && !cefrLevel.isBlank()) {
            String level = cefrLevel.trim().toUpperCase(Locale.ROOT);
            Optional<InterviewRubricTemplate> levelMatch = candidates.stream()
                    .filter(t -> levelRangeContains(t.getLevelRange(), level))
                    .findFirst();
            if (levelMatch.isPresent()) {
                return levelMatch;
            }
        }
        return Optional.of(candidates.get(0));
    }

    /** True if a level range like "A2-B1" or "B1" covers the given CEFR level. */
    static boolean levelRangeContains(String range, String level) {
        if (range == null || range.isBlank()) {
            return true; // unscoped rubric matches any level
        }
        String r = range.trim().toUpperCase(Locale.ROOT);
        if (r.contains(level)) {
            return true;
        }
        String[] parts = r.split("[-–]");
        if (parts.length == 2) {
            int lo = cefrOrdinal(parts[0].trim());
            int hi = cefrOrdinal(parts[1].trim());
            int lv = cefrOrdinal(level);
            return lv >= 0 && lo >= 0 && hi >= 0 && lv >= lo && lv <= hi;
        }
        return false;
    }

    private static int cefrOrdinal(String cefr) {
        return switch (cefr) {
            case "A1" -> 0;
            case "A2" -> 1;
            case "B1" -> 2;
            case "B2" -> 3;
            case "C1" -> 4;
            case "C2" -> 5;
            default -> -1;
        };
    }

    /**
     * Returns formatted criteria text for injection into prompts.
     * Delegates schema parsing to the caller; this method returns raw JSON strings.
     */
    public record RubricSnapshot(Long templateId, int version, String criteriaJson, String weightJson) {}

    public Optional<RubricSnapshot> snapshotForIndustry(String industry) {
        return findOverallRubric(industry)
                .map(t -> new RubricSnapshot(t.getId(), t.getVersion(), t.getCriteriaJson(), t.getWeightJson()));
    }
}
