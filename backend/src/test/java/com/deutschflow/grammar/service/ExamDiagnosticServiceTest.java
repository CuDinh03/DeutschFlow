package com.deutschflow.grammar.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.grammar.dto.PracticeDtos;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.deutschflow.user.service.UserLearningProfileService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Kiểm tra đầu vào và cách chọn đề của bài chẩn đoán, không cần DB. */
class ExamDiagnosticServiceTest {

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final MockExamPracticeService practice = mock(MockExamPracticeService.class);
    private final UserLearningProfileService profiles = mock(UserLearningProfileService.class);
    private final ExamDiagnosticService service = new ExamDiagnosticService(jdbc, new ObjectMapper(), practice, profiles,
            mock(UserLearningProfileRepository.class));
    private final User user = user();

    private static User user() {
        User u = new User();
        u.setId(7L);
        return u;
    }

    private static PracticeDtos.Teil teil(String key, boolean checked) {
        PracticeDtos.Progress p = checked ? new PracticeDtos.Progress(Map.of(), true, 10.0, 25.0, 0, null, null) : null;
        return new PracticeDtos.Teil(key, key.substring(0, key.indexOf('-')), 1, null, 5, 25, 10, p);
    }

    private static PracticeDtos.Overview overview(long id, PracticeDtos.Teil... teile) {
        return new PracticeDtos.Overview(id, "Đề " + id, "B1", "TELC", "{}", List.of(teile));
    }

    @Test
    @DisplayName("Bắt đầu: phút mỗi ngày 10–240, ngày thi phải sau hôm nay; sai thì không ghi hồ sơ")
    void start_validates() {
        assertThatThrownBy(() -> service.start(user, LocalDate.now().plusDays(30), 5)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.start(user, LocalDate.now().plusDays(30), 300)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.start(user, LocalDate.now(), 30)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.start(user, null, 30)).isInstanceOf(BadRequestException.class);
        verify(profiles, never()).updateTargetDate(any(), any());
    }

    @Test
    @DisplayName("Chọn đề: ít Teil chẩn đoán đã luyện nhất; đề khoá hoặc thiếu Teil thì bỏ qua")
    void pickExam() {
        when(jdbc.queryForList(anyString(), eq(Long.class))).thenReturn(List.of(4L, 3L, 2L, 1L));
        when(practice.overview(user, 4L)).thenThrow(new RuntimeException("khoá"));
        when(practice.overview(user, 3L)).thenReturn(overview(3, teil("LESEN-1", true), teil("SPRACHBAUSTEINE-1", false), teil("HOEREN-1", false)));
        when(practice.overview(user, 2L)).thenReturn(overview(2, teil("LESEN-1", false), teil("HOEREN-1", false)));
        when(practice.overview(user, 1L)).thenReturn(overview(1, teil("LESEN-1", false), teil("SPRACHBAUSTEINE-1", false), teil("HOEREN-1", false)));
        assertThat(service.pickExam(user)).isEqualTo(1L);

        when(practice.overview(user, 1L)).thenReturn(overview(1, teil("LESEN-1", true), teil("SPRACHBAUSTEINE-1", false), teil("HOEREN-1", false)));
        // bằng nhau ⇒ đề mới nhất (3) — đề cũ nhất để dành cho đề full đầu tiên
        assertThat(service.pickExam(user)).isEqualTo(3L);
    }

    @Test
    @DisplayName("Tự đánh giá: chỉ Viết/Nói, mức 1–4; chưa bắt đầu thì báo lỗi")
    void saveSelf_validates() {
        assertThatThrownBy(() -> service.saveSelf(user, "LESEN", 2)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.saveSelf(user, "SCHREIBEN", 0)).isInstanceOf(BadRequestException.class);
        when(jdbc.update(anyString(), eq("SCHREIBEN"), eq(2), anyLong())).thenReturn(0);
        assertThatThrownBy(() -> service.saveSelf(user, "SCHREIBEN", 2)).isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("Chốt khi còn Teil chưa kiểm tra ⇒ báo phần còn thiếu, không ghi kết quả")
    void finish_requiresAllParts() {
        when(jdbc.queryForList(anyString(), anyLong())).thenReturn(List.of(Map.of(
                "exam_id", 3L, "self", "{\"SCHREIBEN\":2,\"SPRECHEN\":3}")));
        when(practice.overview(user, 3L)).thenReturn(overview(3, teil("LESEN-1", true), teil("SPRACHBAUSTEINE-1", false), teil("HOEREN-1", true)));
        assertThatThrownBy(() -> service.finish(user)).isInstanceOf(BadRequestException.class).hasMessageContaining("SPRACHBAUSTEINE-1");
        verify(jdbc, never()).update(org.mockito.ArgumentMatchers.contains("finished_at = now()"), any(), any());
    }
}
