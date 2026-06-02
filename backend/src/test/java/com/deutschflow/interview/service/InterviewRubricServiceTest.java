package com.deutschflow.interview.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class InterviewRubricServiceTest {

    @Test
    @DisplayName("exact level match")
    void exactLevelMatch() {
        assertThat(InterviewRubricService.levelRangeContains("B1", "B1")).isTrue();
        assertThat(InterviewRubricService.levelRangeContains("B1", "B2")).isFalse();
    }

    @Test
    @DisplayName("CEFR range covers levels between its bounds")
    void rangeMatch() {
        assertThat(InterviewRubricService.levelRangeContains("A2-B1", "B1")).isTrue();
        assertThat(InterviewRubricService.levelRangeContains("A2-B2", "B1")).isTrue();
        assertThat(InterviewRubricService.levelRangeContains("A2-B1", "B2")).isFalse();
        assertThat(InterviewRubricService.levelRangeContains("B1-C1", "A2")).isFalse();
    }

    @Test
    @DisplayName("an unscoped (null/blank) range matches any level")
    void nullOrBlankMatchesAny() {
        assertThat(InterviewRubricService.levelRangeContains(null, "A1")).isTrue();
        assertThat(InterviewRubricService.levelRangeContains("", "C1")).isTrue();
    }

    @Test
    @DisplayName("the literal 'ANY' sentinel (as used in the seed data) matches any level")
    void anySentinelMatchesAny() {
        assertThat(InterviewRubricService.levelRangeContains("ANY", "A1")).isTrue();
        assertThat(InterviewRubricService.levelRangeContains("ANY", "B1")).isTrue();
        assertThat(InterviewRubricService.levelRangeContains("ANY", "C2")).isTrue();
        assertThat(InterviewRubricService.levelRangeContains("any", "B2")).isTrue(); // case-insensitive
    }
}
