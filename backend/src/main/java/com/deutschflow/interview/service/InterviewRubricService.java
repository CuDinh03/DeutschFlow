package com.deutschflow.interview.service;

import com.deutschflow.interview.entity.InterviewRubricTemplate;
import com.deutschflow.interview.repository.InterviewRubricTemplateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

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
        return rubricRepository.findFirstByIndustryAndPhaseAndActiveTrue(industry, phase);
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
