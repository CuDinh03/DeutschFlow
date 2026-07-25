package com.deutschflow.interview.service;

import com.deutschflow.interview.entity.InterviewRubricTemplate;
import com.deutschflow.interview.repository.InterviewRubricTemplateRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * Phase rubrics must actually reach the prompt: before this, only the industry OVERALL rubric was
 * ever snapshotted, so an admin editing HARD_SKILLS criteria or weights changed nothing observable.
 */
@ExtendWith(MockitoExtension.class)
class InterviewRubricSnapshotTest {

    private static final String INDUSTRY = "IT / Software";

    @Mock
    private InterviewRubricTemplateRepository repository;

    private InterviewRubricService service;

    @BeforeEach
    void setUp() {
        service = new InterviewRubricService(repository);
    }

    @Test
    @DisplayName("the phase rubric wins over the industry OVERALL rubric")
    void phaseRubricPreferredOverOverall() {
        when(repository.findByIndustryAndPhaseAndActiveTrue(INDUSTRY, "HARD_SKILLS"))
                .thenReturn(List.of(template(7L, "HARD_SKILLS", "{\"technical_depth\":0.30}")));

        var snapshot = service.snapshotForPhase(INDUSTRY, "HARD_SKILLS", "B1");

        assertThat(snapshot).isPresent();
        assertThat(snapshot.get().templateId()).isEqualTo(7L);
        assertThat(snapshot.get().weightJson()).contains("technical_depth");
    }

    @Test
    @DisplayName("no phase template → falls back to the industry OVERALL rubric")
    void fallsBackToOverallWhenPhaseHasNoTemplate() {
        when(repository.findByIndustryAndPhaseAndActiveTrue(INDUSTRY, "INTRO")).thenReturn(List.of());
        when(repository.findFirstByIndustryAndPhaseAndActiveTrue(INDUSTRY, "INTRO")).thenReturn(Optional.empty());
        when(repository.findFirstByIndustryAndPhaseAndActiveTrue(INDUSTRY, "OVERALL"))
                .thenReturn(Optional.of(template(1L, "OVERALL", "{\"relevance\":0.15}")));

        var snapshot = service.snapshotForPhase(INDUSTRY, "INTRO", "B1");

        assertThat(snapshot).isPresent();
        assertThat(snapshot.get().templateId()).isEqualTo(1L);
        assertThat(snapshot.get().weightJson()).contains("relevance");
    }

    @Test
    @DisplayName("the level-aware pick still applies within a phase")
    void levelAwarePickWithinPhase() {
        when(repository.findByIndustryAndPhaseAndActiveTrue(INDUSTRY, "HARD_SKILLS")).thenReturn(List.of(
                template(10L, "HARD_SKILLS", "{\"a\":1}", "A1-A2"),
                template(11L, "HARD_SKILLS", "{\"b\":1}", "B1-B2")));

        assertThat(service.snapshotForPhase(INDUSTRY, "HARD_SKILLS", "B2"))
                .get().extracting(InterviewRubricService.RubricSnapshot::templateId).isEqualTo(11L);
    }

    private static InterviewRubricTemplate template(Long id, String phase, String weightJson) {
        return template(id, phase, weightJson, "ANY");
    }

    private static InterviewRubricTemplate template(Long id, String phase, String weightJson, String levelRange) {
        InterviewRubricTemplate t = new InterviewRubricTemplate();
        t.setId(id);
        t.setIndustry(INDUSTRY);
        t.setRoleGroup("IT");
        t.setLevelRange(levelRange);
        t.setPhase(phase);
        t.setCriteriaJson("[{\"key\":\"technical_depth\"}]");
        t.setWeightJson(weightJson);
        t.setVersion(1);
        t.setActive(true);
        return t;
    }
}
