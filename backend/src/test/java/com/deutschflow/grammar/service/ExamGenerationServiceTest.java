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
        when(jdbc.queryForList(anyString(), eq(1L), eq("A1"), eq("GOETHE")))
            .thenReturn(List.of(
                row(1L, null),
                row(2L, "2026-05-01"),
                row(3L, "2026-05-10")
            ));

        Optional<Long> result = service.recommendExamId(1L, "A1", "GOETHE");

        assertTrue(result.isPresent());
        assertEquals(1L, result.get());
    }

    @Test
    @DisplayName("recommends least recently attempted exam")
    void recommendExamId_allAttempted_returnsOldest() {
        when(jdbc.queryForList(anyString(), eq(1L), eq("A1"), eq("GOETHE")))
            .thenReturn(List.of(
                row(2L, "2026-03-01"),
                row(3L, "2026-04-01"),
                row(1L, "2026-05-01")
            ));

        Optional<Long> result = service.recommendExamId(1L, "A1", "GOETHE");

        assertTrue(result.isPresent());
        assertEquals(2L, result.get(), "Should recommend oldest-attempted exam");
    }

    @Test
    @DisplayName("returns empty when no active exams exist")
    void recommendExamId_noExams_returnsEmpty() {
        when(jdbc.queryForList(anyString(), eq(1L), eq("A1"), eq("TELC")))
            .thenReturn(List.of());

        Optional<Long> result = service.recommendExamId(1L, "A1", "TELC");

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
        when(jdbc.queryForList(anyString(), eq(5L), eq("A1"), eq("GOETHE"))).thenReturn(expectedStats);

        var stats = service.getUserExamStats(5L, "A1", "GOETHE");

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

        var coverage = service.getExamCoverage("A1", null);

        assertEquals("A1", coverage.cefrLevel());
        assertNull(coverage.examFormat());
        assertEquals(3, coverage.totalExams());
        assertEquals(3, coverage.exams().size());
        assertEquals(1L, coverage.exams().get(0).id());
        assertEquals("Set 1", coverage.exams().get(0).title());
        assertEquals(true, coverage.exams().get(0).isActive());
        assertEquals(50L, coverage.exams().get(0).attemptCount());
    }

    // ── Tách kỳ thi (09/11/2026): đề Goethe và telc không được trộn khi chọn đề ─────────────

    @Test
    @DisplayName("recommend SQL always filters by exam_format")
    void recommendSqlFiltersByFormat() {
        when(jdbc.queryForList(anyString(), eq(1L), eq("B1"), eq("TELC"))).thenReturn(List.of(row(9L, null)));

        service.recommendExamId(1L, "B1", "TELC");

        verify(jdbc).queryForList(argThat((String sql) -> sql.contains("UPPER(e.exam_format) = ?")),
                eq(1L), eq("B1"), eq("TELC"));
    }

    @Test
    @DisplayName("stats SQL always filters by exam_format")
    void statsSqlFiltersByFormat() {
        when(jdbc.queryForList(anyString(), eq(1L), eq("B1"), eq("GOETHE"))).thenReturn(List.of());

        service.getUserExamStats(1L, "B1", "GOETHE");

        verify(jdbc).queryForList(argThat((String sql) -> sql.contains("UPPER(e.exam_format) = ?")),
                eq(1L), eq("B1"), eq("GOETHE"));
    }

    @Test
    @DisplayName("coverage filtered by a format passes it to SQL")
    void coverageFilteredByFormat() {
        when(jdbc.queryForList(anyString(), eq("B1"), eq("TELC"))).thenReturn(List.of());

        var coverage = service.getExamCoverage("B1", "telc");

        assertEquals("TELC", coverage.examFormat());
        verify(jdbc).queryForList(argThat((String sql) -> sql.contains("UPPER(exam_format) = ?")), eq("B1"), eq("TELC"));
    }

    @Test
    @DisplayName("normalizeFormat maps client/profile spellings and rejects others")
    void normalizeFormat() {
        assertEquals(Optional.of("TELC"), ExamGenerationService.normalizeFormat("telc"));
        assertEquals(Optional.of("TELC"), ExamGenerationService.normalizeFormat(" TELC "));
        assertEquals(Optional.of("GOETHE"), ExamGenerationService.normalizeFormat("Goethe-Zertifikat"));
        assertEquals(Optional.empty(), ExamGenerationService.normalizeFormat("ÖSD"));
        assertEquals(Optional.empty(), ExamGenerationService.normalizeFormat(""));
        assertEquals(Optional.empty(), ExamGenerationService.normalizeFormat(null));
    }

    @Test
    @DisplayName("resolveExamFormat: request wins without touching the DB")
    void resolveRequestWins() {
        assertEquals("GOETHE", service.resolveExamFormat(1L, "B1", "goethe"));
        verifyNoInteractions(jdbc);
    }

    @Test
    @DisplayName("resolveExamFormat: profile exam_type used when no request")
    void resolveFromProfile() {
        when(jdbc.queryForList(contains("user_learning_profiles"), eq(String.class), eq(1L)))
            .thenReturn(List.of("TELC"));

        assertEquals("TELC", service.resolveExamFormat(1L, "B1", null));
    }

    @Test
    @DisplayName("resolveExamFormat: falls back to the format of the latest attempt at that level")
    void resolveFromHistory() {
        when(jdbc.queryForList(contains("user_learning_profiles"), eq(String.class), eq(1L)))
            .thenReturn(java.util.Collections.singletonList(null));
        when(jdbc.queryForList(contains("mock_exam_attempts"), eq(String.class), eq(1L), eq("B1")))
            .thenReturn(List.of("GOETHE"));

        assertEquals("GOETHE", service.resolveExamFormat(1L, "B1", ""));
    }

    @Test
    @DisplayName("resolveExamFormat: no hint ⇒ TELC when the level has telc exams, else GOETHE")
    void resolveDefault() {
        when(jdbc.queryForList(contains("user_learning_profiles"), eq(String.class), anyLong()))
            .thenReturn(List.of());
        when(jdbc.queryForList(contains("mock_exam_attempts"), eq(String.class), anyLong(), anyString()))
            .thenReturn(List.of());
        when(jdbc.queryForObject(contains("COUNT(*)"), eq(Integer.class), eq("B1"))).thenReturn(4);
        when(jdbc.queryForObject(contains("COUNT(*)"), eq(Integer.class), eq("A1"))).thenReturn(0);

        assertEquals("TELC", service.resolveExamFormat(1L, "B1", null));
        assertEquals("GOETHE", service.resolveExamFormat(1L, "A1", null));
    }
}
