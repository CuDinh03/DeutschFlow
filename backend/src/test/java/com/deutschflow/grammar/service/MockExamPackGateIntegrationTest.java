package com.deutschflow.grammar.service;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.common.quota.QuotaSnapshot;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Cổng gói ở ĐƯỜNG LÀM BÀI trên PostgreSQL thật.
 *
 * <p>Vì sao cần DB thật chứ không mock JdbcTemplate: bản vá này thêm một câu SQL mới nối
 * {@code mock_exam_packs} với {@code mock_exams} theo {@code (cefr_level, exam_format)}. Rủi ro thật
 * nằm ở chính câu SQL đó — tên cột ({@code is_active} chứ không phải {@code active}),
 * {@code requires_paid}, và việc quan hệ đề↔bộ là quan hệ SUY RA, không có bảng nối. Mock
 * JdbcTemplate sẽ trả con số ta tự đặt và không chứng minh được gì trong số đó.
 *
 * <p>{@link QuotaService} thì mock: ở đây ta kiểm truy vấn và quyết định khoá/mở, không kiểm cách
 * gói của người dùng được suy ra (đã có {@code MockExamPackServiceTest} phủ).
 *
 * <p>Dùng cấp <b>C2</b> cho mọi dữ liệu dựng sẵn: A1–C1 đã có bộ đề seed từ V217/V312, nên C2 là
 * vùng trống duy nhất không làm nhiễu và không bị nhiễu.
 */
@SpringBootTest
@DisplayName("Cổng gói khi vào làm bài (MockExamPackService.assertExamUnlocked)")
class MockExamPackGateIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final long UID = 990_317L;
    private static final String LEVEL = "C2";
    private static final String FORMAT = "GOETHE";

    @MockBean private QuotaService quotaService;

    @Autowired private MockExamPackService service;
    @Autowired private JdbcTemplate jdbc;

    @AfterEach
    void cleanUp() {
        jdbc.update("DELETE FROM mock_exam_packs WHERE cefr_level = ?", LEVEL);
        jdbc.update("DELETE FROM mock_exams WHERE cefr_level = ?", LEVEL);
    }

    private long newExam() {
        return jdbc.queryForObject("""
            INSERT INTO mock_exams (cefr_level, exam_format, title, sections_json, is_active)
            VALUES (?, ?, 'Đề C2 dựng cho test cổng gói', '{"sections":[]}'::jsonb, TRUE)
            RETURNING id
            """, Long.class, LEVEL, FORMAT);
    }

    private void newPack(boolean requiresPaid) {
        jdbc.update("""
            INSERT INTO mock_exam_packs (title, cefr_level, exam_format, requires_paid, is_active, sort_order)
            VALUES ('Bộ đề C2 dựng cho test', ?, ?, ?, TRUE, 99)
            """, LEVEL, FORMAT, requiresPaid);
    }

    private void planIs(String planCode) {
        when(quotaService.getSnapshotReadOnly(anyLong(), any()))
                .thenReturn(new QuotaSnapshot(planCode, false, null, null, 0L, 0L, 0L, 0L, 0L, null, null));
    }

    @Test
    @DisplayName("gói miễn phí gọi thẳng examId của đề thuộc bộ trả phí → 403, không mở được nội dung đề")
    void freeUser_paidExam_isForbidden() {
        long examId = newExam();
        newPack(true);
        planIs("FREE");

        assertThatThrownBy(() -> service.assertExamUnlocked(UID, examId))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("Nâng cấp gói");
    }

    @Test
    @DisplayName("gói trả phí mở khoá chính đề đó")
    void paidUser_sameExam_passes() {
        long examId = newExam();
        newPack(true);
        planIs("PRO");

        assertThatCode(() -> service.assertExamUnlocked(UID, examId)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("bộ đề không đòi trả phí thì không hỏi tới gói của người dùng")
    void freePack_doesNotAskForPlan() {
        long examId = newExam();
        newPack(false);

        assertThatCode(() -> service.assertExamUnlocked(UID, examId)).doesNotThrowAnyException();
        verify(quotaService, never()).getSnapshotReadOnly(anyLong(), any(Instant.class));
    }

    @Test
    @DisplayName("đề đã tắt (is_active = FALSE) không bị cổng này biến thành 403 — 404 là việc của đường gọi")
    void inactiveExam_passesTheGate() {
        long examId = newExam();
        newPack(true);
        jdbc.update("UPDATE mock_exams SET is_active = FALSE WHERE id = ?", examId);

        assertThatCode(() -> service.assertExamUnlocked(UID, examId)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("đề không tồn tại cũng đi qua cổng")
    void unknownExam_passesTheGate() {
        assertThatCode(() -> service.assertExamUnlocked(UID, -1L)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("bộ đề đã tắt không còn khoá đề của nó")
    void inactivePack_doesNotLock() {
        long examId = newExam();
        newPack(true);
        jdbc.update("UPDATE mock_exam_packs SET is_active = FALSE WHERE cefr_level = ?", LEVEL);

        assertThatCode(() -> service.assertExamUnlocked(UID, examId)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("đề B1 seed sẵn vẫn bị khoá với gói miễn phí — quan hệ suy ra theo cấp+hệ hoạt động trên dữ liệu thật")
    void seededB1Exam_isLockedForFreeUser() {
        Long seededB1 = jdbc.queryForObject("""
            SELECT id FROM mock_exams
            WHERE cefr_level = 'B1' AND exam_format = 'GOETHE' AND is_active = TRUE
            ORDER BY id LIMIT 1
            """, Long.class);
        assertThat(seededB1).isNotNull();
        planIs("FREE");

        assertThatThrownBy(() -> service.assertExamUnlocked(UID, seededB1))
                .isInstanceOf(ForbiddenException.class);
    }
}
