package com.deutschflow.grammar.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcOperations;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@DisplayName("Exam Generation Service")
@ExtendWith(MockitoExtension.class)
class ExamGenerationServiceTest {

    @Mock
    private JdbcOperations jdbc;

    private ExamGenerationService service;

    @BeforeEach
    void setUp() {
        service = new ExamGenerationService(jdbc);
    }

    private static Map<String, Object> row(long id, String lastAttempt) {
        Map<String, Object> m = new java.util.HashMap<>();
        m.put("id", id);
        m.put("last_attempt", lastAttempt);
        return m;
    }

    private static Map<String, Object> statsRow(long examId, String title, long totalAttempts, Object bestScore) {
        Map<String, Object> m = new java.util.HashMap<>();
        m.put("exam_id", examId);
        m.put("title", title);
        m.put("total_attempts", totalAttempts);
        m.put("best_score", bestScore);
        return m;
    }

    @Test
    @DisplayName("recommends exam that user has never attempted first")
    void recommendExamId_neverAttempted_returnsFirstExam() {
        when(jdbc.queryForList(anyString(), eq(1L), eq("A1")))
            .thenReturn(List.of(
                row(1L, null),
                row(2L, "2026-05-01"),
                row(3L, "2026-05-10")
            ));

        Optional<Long> result = service.recommendExamId(1L, "A1");

        assertTrue(result.isPresent());
        assertEquals(1L, result.get());
    }

    @Test
    @DisplayName("recommends least recently attempted exam")
    void recommendExamId_allAttempted_returnsOldest() {
        when(jdbc.queryForList(anyString(), eq(1L), eq("A1")))
            .thenReturn(List.of(
                row(2L, "2026-03-01"),
                row(3L, "2026-04-01"),
                row(1L, "2026-05-01")
            ));

        Optional<Long> result = service.recommendExamId(1L, "A1");

        assertTrue(result.isPresent());
        assertEquals(2L, result.get(), "Should recommend oldest-attempted exam");
    }

    @Test
    @DisplayName("returns empty when no active exams exist")
    void recommendExamId_noExams_returnsEmpty() {
        when(jdbc.queryForList(anyString(), eq(1L), eq("A1")))
            .thenReturn(List.of());

        Optional<Long> result = service.recommendExamId(1L, "A1");

        assertFalse(result.isPresent());
    }

    @Test
    @DisplayName("returns user exam stats with attempt counts")
    void getUserExamStats_returnsStatsForAllVariants() {
        var expectedStats = List.of(
            statsRow(1L, "Set 1", 3L, 85),
            statsRow(2L, "Set 2", 1L, 72),
            statsRow(3L, "Set 3", 0L, null)
        );
        when(jdbc.queryForList(anyString(), eq(5L), eq("A1"))).thenReturn(expectedStats);

        var stats = service.getUserExamStats(5L, "A1");

        assertEquals(3, stats.size());
        assertEquals(3L, stats.get(0).get("total_attempts"));
        assertEquals(0L, stats.get(2).get("total_attempts"));
    }

    @Test
    @DisplayName("returns exam coverage with total count")
    void getExamCoverage_returnsCorrectStructure() {
        var exams = List.of(
            Map.<String, Object>of("id", 1L, "title", "Set 1", "is_active", true, "attempt_count", 50L),
            Map.<String, Object>of("id", 2L, "title", "Set 2", "is_active", true, "attempt_count", 10L),
            Map.<String, Object>of("id", 3L, "title", "Set 3", "is_active", true, "attempt_count", 0L)
        );
        when(jdbc.queryForList(anyString(), eq("A1"))).thenReturn(exams);

        var coverage = service.getExamCoverage("A1");

        assertEquals("A1", coverage.get("cefrLevel"));
        assertEquals(3, coverage.get("totalExams"));
        assertEquals(exams, coverage.get("exams"));
    }
}
