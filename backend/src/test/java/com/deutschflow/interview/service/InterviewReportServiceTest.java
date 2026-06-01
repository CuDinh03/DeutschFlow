package com.deutschflow.interview.service;

import com.deutschflow.interview.dto.InterviewReportDto;
import com.deutschflow.interview.entity.InterviewTurn;
import com.deutschflow.speaking.entity.AiSpeakingSession;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InterviewReportServiceTest {

    @Mock
    private InterviewPhaseEvaluationService phaseEvalService;
    @Mock
    private InterviewTurnPersistenceService turnPersistenceService;

    private InterviewReportService service;

    @BeforeEach
    void setUp() {
        service = new InterviewReportService(phaseEvalService, turnPersistenceService, new ObjectMapper());
    }

    @Test
    @DisplayName("parseLeadingNumber handles common LLM score formats")
    void parseLeadingNumberFormats() {
        assertThat(InterviewReportService.parseLeadingNumber("7.5/10")).isEqualByComparingTo("7.5");
        assertThat(InterviewReportService.parseLeadingNumber("8 / 10")).isEqualByComparingTo("8");
        assertThat(InterviewReportService.parseLeadingNumber("7,5")).isEqualByComparingTo("7.5");
        assertThat(InterviewReportService.parseLeadingNumber("kein Wert")).isNull();
        assertThat(InterviewReportService.parseLeadingNumber(null)).isNull();
    }

    @Test
    @DisplayName("the level-aware LLM evaluation is the primary score and verdict")
    void llmEvalIsPrimary() {
        AiSpeakingSession session = session("{\"overall_score\":\"8.0/10\",\"verdict\":\"PASS\"}");
        when(turnPersistenceService.getTurnsForSession(1L)).thenReturn(turns(4, true));
        when(phaseEvalService.getPhaseResults(1L)).thenReturn(List.of());

        InterviewReportDto r = service.buildStructuredReport(session);

        assertThat(r.verdict()).isEqualTo("PASS");
        assertThat(r.overallScore()).isEqualByComparingTo("8.0");
    }

    @Test
    @DisplayName("anti-sycophancy: a high LLM score with no concrete evidence is capped")
    void antiSycophancyBound() {
        AiSpeakingSession session = session("{\"overall_score\":\"9.0/10\",\"verdict\":\"PASS\"}");
        when(turnPersistenceService.getTurnsForSession(1L)).thenReturn(turns(4, false)); // no concrete examples
        when(phaseEvalService.getPhaseResults(1L)).thenReturn(List.of());

        InterviewReportDto r = service.buildStructuredReport(session);

        assertThat(r.overallScore()).isEqualByComparingTo("6.5");
    }

    @Test
    @DisplayName("too few substantive turns never PASS, regardless of LLM optimism")
    void tooFewTurnsNeverPass() {
        AiSpeakingSession session = session("{\"overall_score\":\"9.0/10\",\"verdict\":\"PASS\"}");
        when(turnPersistenceService.getTurnsForSession(1L)).thenReturn(turns(2, true));
        when(phaseEvalService.getPhaseResults(1L)).thenReturn(List.of());

        InterviewReportDto r = service.buildStructuredReport(session);

        assertThat(r.verdict()).isEqualTo("NOT_PASS");
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    private static AiSpeakingSession session(String reportJson) {
        AiSpeakingSession s = new AiSpeakingSession();
        s.setId(1L);
        s.setSessionMode("INTERVIEW");
        s.setInterviewReportJson(reportJson);
        s.setExperienceLevel("1-2Y");
        return s;
    }

    private static List<InterviewTurn> turns(int n, boolean concrete) {
        List<InterviewTurn> list = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            list.add(InterviewTurn.builder()
                    .sessionId(1L)
                    .turnIndex(i)
                    .phase("HARD_SKILLS")
                    .questionText("Frage " + i)
                    .userAnswer("Antwort " + i)
                    .answerAnalysisJson("{\"concreteExample\":" + concrete + "}")
                    .build());
        }
        return list;
    }
}
