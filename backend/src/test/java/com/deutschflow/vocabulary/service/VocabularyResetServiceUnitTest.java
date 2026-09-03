package com.deutschflow.vocabulary.service;

import com.deutschflow.common.exception.BadRequestException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Audit R-H1 (03/09/2026): reset từ vựng là thao tác hủy diệt — DELETE FROM words cascade xóa
 * spaced_repetition_schedule + user_word_progress của MỌI học viên. Hai bất biến phải giữ:
 * (1) không có confirm=RESET thì KHÔNG một câu SQL nào được chạy;
 * (2) bất kỳ bước reimport nào lỗi → transaction đánh dấu rollback-only, không commit nửa vời.
 * Gỡ guard hoặc gỡ rollBack() là các test dưới đây đỏ.
 */
@ExtendWith(MockitoExtension.class)
class VocabularyResetServiceUnitTest {

    @Mock
    private JdbcTemplate jdbcTemplate;
    @Mock
    private GoetheVocabularyAutoImportService goetheAuto;
    @Mock
    private GoetheOfficialWordlistImportService goetheOfficial;
    @Mock
    private WiktionaryEnrichmentBatchService wiktionary;

    private VocabularyResetService service;

    @BeforeEach
    void setUp() {
        service = Mockito.spy(new VocabularyResetService(
                jdbcTemplate, goetheAuto, goetheOfficial, wiktionary));
        // markRollbackOnly() thật ném NoTransactionException ngoài transaction — stub seam này
        // để unit test verify được "đã đánh dấu rollback" mà không dựng transaction thật.
        lenient().doNothing().when(service).markRollbackOnly();
    }

    @Test
    @DisplayName("thiếu/sai confirm → BadRequest và KHÔNG chạm một câu SQL nào")
    void resetRefusesWhenConfirmMissingOrWrong_andTouchesNothing() {
        for (String bad : new String[]{null, "", "reset", "RESET ", "DELETE"}) {
            assertThrows(BadRequestException.class, () -> service.resetAndReimport(bad, 100));
        }
        verifyNoInteractions(jdbcTemplate, goetheAuto, goetheOfficial, wiktionary);
        verify(service, never()).markRollbackOnly();
    }

    @Test
    @DisplayName("import Goethe official lỗi → ROLLED_BACK, các bước sau bị bỏ qua")
    void resetRollsBackEverything_whenGoetheOfficialImportFails() {
        when(goetheOfficial.importFromClasspathTsv())
                .thenThrow(new IllegalStateException("classpath TSV hỏng"));

        Map<String, Object> result = service.resetAndReimport(
                VocabularyResetService.CONFIRM_PHRASE, 100);

        assertEquals("ROLLED_BACK", result.get("status"));
        assertEquals("goetheOfficial", result.get("failedStep"));
        verify(service).markRollbackOnly();
        verifyNoInteractions(goetheAuto, wiktionary);
    }

    @Test
    @DisplayName("import Goethe auto lỗi → ROLLED_BACK, không chạy enrich")
    void resetRollsBackEverything_whenGoetheAutoImportFails() {
        when(goetheOfficial.importFromClasspathTsv()).thenReturn(Map.of("inserted", 10));
        when(goetheAuto.importGoetheVocabularyA1ToC1()).thenThrow(new RuntimeException("boom"));

        Map<String, Object> result = service.resetAndReimport(
                VocabularyResetService.CONFIRM_PHRASE, 100);

        assertEquals("ROLLED_BACK", result.get("status"));
        assertEquals("goetheAuto", result.get("failedStep"));
        verify(service).markRollbackOnly();
        verifyNoInteractions(wiktionary);
    }

    @Test
    @DisplayName("Wiktionary enrich lỗi → vẫn all-or-nothing: ROLLED_BACK")
    void resetRollsBackEverything_whenWiktionaryEnrichFails() {
        when(goetheOfficial.importFromClasspathTsv()).thenReturn(Map.of("inserted", 10));
        when(goetheAuto.importGoetheVocabularyA1ToC1()).thenReturn(Map.of("inserted", 20));
        when(wiktionary.runBatch(anyInt(), anyBoolean()))
                .thenThrow(new RuntimeException("Wiktionary API down"));

        Map<String, Object> result = service.resetAndReimport(
                VocabularyResetService.CONFIRM_PHRASE, 100);

        assertEquals("ROLLED_BACK", result.get("status"));
        assertEquals("wiktionaryEnrich", result.get("failedStep"));
        verify(service).markRollbackOnly();
    }

    @Test
    @DisplayName("đủ confirm + mọi bước OK → status=OK, không đánh dấu rollback")
    void resetRunsToCompletion_withValidConfirm() {
        when(goetheOfficial.importFromClasspathTsv()).thenReturn(Map.of("inserted", 10));
        when(goetheAuto.importGoetheVocabularyA1ToC1()).thenReturn(Map.of("inserted", 20));
        when(wiktionary.runBatch(anyInt(), anyBoolean())).thenReturn(Map.of("status", "OK"));
        lenient().when(jdbcTemplate.queryForObject(anyString(), eq(Long.class))).thenReturn(0L);
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class))).thenReturn(42);

        Map<String, Object> result = service.resetAndReimport(
                VocabularyResetService.CONFIRM_PHRASE, 100);

        assertEquals("OK", result.get("status"));
        verify(jdbcTemplate).update("DELETE FROM words");
        verify(service, never()).markRollbackOnly();
    }
}
