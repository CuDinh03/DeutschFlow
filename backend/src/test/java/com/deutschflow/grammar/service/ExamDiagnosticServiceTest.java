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
        when(practice.overview(user, 3L)).thenReturn(overview(3, teil("LESEN-1", true), teil("SPRACHBAUSTEINE-1", false), teil("HOEREN-1", false), teil("SCHREIBEN-1", false)));
        when(practice.overview(user, 2L)).thenReturn(overview(2, teil("LESEN-1", false), teil("HOEREN-1", false)));
        when(practice.overview(user, 1L)).thenReturn(overview(1, teil("LESEN-1", false), teil("SPRACHBAUSTEINE-1", false), teil("HOEREN-1", false), teil("SCHREIBEN-1", false)));
        assertThat(service.pickExam(user)).isEqualTo(1L);

        when(practice.overview(user, 1L)).thenReturn(overview(1, teil("LESEN-1", true), teil("SPRACHBAUSTEINE-1", false), teil("HOEREN-1", false), teil("SCHREIBEN-1", false)));
        // bằng nhau ⇒ đề mới nhất (3) — đề cũ nhất để dành cho đề full đầu tiên
        assertThat(service.pickExam(user)).isEqualTo(3L);
    }

    @Test
    @DisplayName("Chốt khi còn Teil chưa chấm ⇒ báo phần còn thiếu, không ghi kết quả")
    void finish_requiresAllParts() {
        when(jdbc.queryForList(anyString(), anyLong())).thenReturn(List.of(Map.of(
                "exam_id", 3L, "started_at", java.sql.Timestamp.from(java.time.Instant.now()))));
        when(practice.overview(user, 3L)).thenReturn(overview(3, teil("LESEN-1", true), teil("SPRACHBAUSTEINE-1", false),
                teil("HOEREN-1", true), teil("SCHREIBEN-1", true)));
        assertThatThrownBy(() -> service.finish(user)).isInstanceOf(BadRequestException.class).hasMessageContaining("SPRACHBAUSTEINE-1");

        // đủ bốn Teil nhưng chưa thi nói sau khi bắt đầu ⇒ báo thiếu phần Nói
        when(practice.overview(user, 3L)).thenReturn(overview(3, teil("LESEN-1", true), teil("SPRACHBAUSTEINE-1", true),
                teil("HOEREN-1", true), teil("SCHREIBEN-1", true)));
        assertThatThrownBy(() -> service.finish(user)).isInstanceOf(BadRequestException.class).hasMessageContaining("SPRECHEN");
        verify(jdbc, never()).update(org.mockito.ArgumentMatchers.contains("finished_at = now()"), any(), any());
    }

    private static final List<String> ALL = ExamDiagnosticScoring.TEILE;

    private static PracticeDtos.Teil scored(String key, double score, double max) {
        return new PracticeDtos.Teil(key, key.substring(0, key.indexOf('-')), 1, null, 5, max, 10,
                new PracticeDtos.Progress(Map.of(), true, score, max, 0, null, null));
    }

    private static PracticeDtos.Overview full(long id, List<String> checked) {
        return overview(id, ALL.stream().map(k -> teil(k, checked.contains(k))).toArray(PracticeDtos.Teil[]::new));
    }

    private void inProgress(long examId) {
        when(jdbc.queryForList(anyString(), anyLong())).thenReturn(List.of(Map.of(
                "exam_id", examId, "started_at", java.sql.Timestamp.from(java.time.Instant.now()))));
    }

    private void oralDone() {
        when(jdbc.queryForList(anyString(), anyLong(), anyString(), anyString(), any(java.sql.Timestamp.class)))
                .thenReturn(List.of(Map.of("session_id", 5L, "total_points", 60.0, "max_points", 75.0)));
    }

    @Test
    @DisplayName("Trạng thái: danh sách phần là đủ mọi Teil theo thứ tự thi thật; GET không ghi DB (QLT-21)")
    void view_listsAllTeile() {
        when(jdbc.queryForList(anyString(), anyLong())).thenReturn(List.of());
        assertThat(service.view(user).teile()).containsExactly(
                "LESEN-1", "LESEN-2", "LESEN-3", "SPRACHBAUSTEINE-1", "SPRACHBAUSTEINE-2",
                "HOEREN-1", "HOEREN-2", "HOEREN-3", "SCHREIBEN-1");
        inProgress(3);
        ExamDiagnosticService.View v = service.view(user);
        assertThat(v.status()).isEqualTo(ExamDiagnosticService.STATUS_IN_PROGRESS);
        assertThat(v.teile()).isEqualTo(ALL);
        assertThat(org.mockito.Mockito.mockingDetails(jdbc).getInvocations())
                .allSatisfy(i -> assertThat(i.getMethod().getName()).startsWith("query"));
        verify(practice, never()).overview(any(), anyLong());
    }

    @Test
    @DisplayName("Chọn đề: đề đủ chín Teil đứng trước đề chỉ có Teil 1, dù đề thiếu Teil mới hơn và chưa luyện gì")
    void pickExam_prefersCompleteExam() {
        when(jdbc.queryForList(anyString(), eq(Long.class))).thenReturn(List.of(4L, 3L, 2L));
        when(practice.overview(user, 4L)).thenReturn(overview(4, teil("LESEN-1", false), teil("SPRACHBAUSTEINE-1", false), teil("HOEREN-1", false), teil("SCHREIBEN-1", false)));
        when(practice.overview(user, 3L)).thenReturn(full(3, List.of("LESEN-1", "LESEN-2")));
        when(practice.overview(user, 2L)).thenReturn(full(2, List.of("LESEN-1")));
        assertThat(service.pickExam(user)).isEqualTo(2L);
    }

    @Test
    @DisplayName("Lượt bắt đầu từ bản ngắn: bốn Teil cũ đã chấm vẫn chưa chốt được, báo Teil mới đầu tiên còn thiếu")
    void finish_oldProgressMustContinue() {
        inProgress(3);
        oralDone();
        when(practice.overview(user, 3L)).thenReturn(full(3, ExamDiagnosticScoring.CORE_TEILE));
        assertThatThrownBy(() -> service.finish(user)).isInstanceOf(BadRequestException.class).hasMessageContaining("LESEN-2");
        verify(jdbc, never()).update(org.mockito.ArgumentMatchers.contains("finished_at = now()"), any(), any());
    }

    @Test
    @DisplayName("Chốt đủ chín Teil: kỹ năng gộp mọi Teil theo điểm, ghi tỉ lệ từng Teil cho lộ trình")
    void finish_allTeile() throws Exception {
        inProgress(3);
        oralDone();
        when(practice.overview(user, 3L)).thenReturn(overview(3,
                scored("LESEN-1", 25, 25), scored("LESEN-2", 10, 25), scored("LESEN-3", 15, 25),
                scored("SPRACHBAUSTEINE-1", 12, 15), scored("SPRACHBAUSTEINE-2", 6, 15),
                scored("HOEREN-1", 20, 25), scored("HOEREN-2", 5, 25), scored("HOEREN-3", 20, 25),
                scored("SCHREIBEN-1", 36, 45)));
        service.finish(user);

        org.mockito.ArgumentCaptor<String> json = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(jdbc).update(org.mockito.ArgumentMatchers.contains("finished_at = now()"), json.capture(), eq(7L));
        com.fasterxml.jackson.databind.JsonNode result = new ObjectMapper().readTree(json.getValue());
        assertThat(result.path("skills").path("LESEN").asInt()).isEqualTo(65);
        assertThat(result.path("skills").path("HOEREN").asInt()).isEqualTo(60);
        assertThat(result.path("skills").path("SCHREIBEN").asInt()).isEqualTo(80);
        assertThat(result.path("skills").path("SPRECHEN").asInt()).isEqualTo(80);
        assertThat(result.path("ratios").path("HOEREN").asDouble()).isEqualTo(0.6);
        assertThat(result.path("teile").size()).isEqualTo(9);
        assertThat(result.path("teile").path("HOEREN-2").asDouble()).isEqualTo(0.2);
        assertThat(result.path("oralSessionId").asLong()).isEqualTo(5L);
    }

    @Test
    @DisplayName("Đề đã chọn thiếu Teil 2/3 (lượt cũ): chốt với các Teil đề có; thiếu Teil lõi thì không chốt")
    void finish_examWithoutSomeTeile() {
        inProgress(3);
        oralDone();
        when(practice.overview(user, 3L)).thenReturn(overview(3, scored("LESEN-1", 10, 25), scored("SPRACHBAUSTEINE-1", 12, 15),
                scored("HOEREN-1", 20, 25), scored("SCHREIBEN-1", 33, 45)));
        service.finish(user);
        verify(jdbc).update(org.mockito.ArgumentMatchers.contains("finished_at = now()"), anyString(), eq(7L));

        when(practice.overview(user, 3L)).thenReturn(overview(3, scored("LESEN-1", 10, 25), scored("LESEN-2", 10, 25),
                scored("HOEREN-1", 20, 25), scored("SCHREIBEN-1", 33, 45)));
        assertThatThrownBy(() -> service.finish(user)).isInstanceOf(BadRequestException.class).hasMessageContaining("SPRACHBAUSTEINE-1");
    }

    @Test
    @DisplayName("Kết quả đã chốt của bài bản ngắn (không có tỉ lệ từng Teil) ⇒ shortForm, điểm cũ giữ nguyên")
    void view_shortFormResult() {
        java.sql.Timestamp now = java.sql.Timestamp.from(java.time.Instant.now());
        when(jdbc.queryForList(anyString(), anyLong())).thenReturn(List.of(Map.of("exam_id", 3L, "started_at", now, "finished_at", now,
                "result", "{\"ratios\":{\"LESEN\":0.4},\"skills\":{\"LESEN\":55,\"HOEREN\":80}}")));
        ExamDiagnosticService.View old = service.view(user);
        assertThat(old.status()).isEqualTo(ExamDiagnosticService.STATUS_DONE);
        assertThat(old.shortForm()).isTrue();
        assertThat(old.skills()).containsEntry("LESEN", 55).containsEntry("HOEREN", 80);

        when(jdbc.queryForList(anyString(), anyLong())).thenReturn(List.of(Map.of("exam_id", 3L, "started_at", now, "finished_at", now,
                "result", "{\"ratios\":{\"LESEN\":0.4},\"teile\":{\"LESEN-1\":0.4},\"skills\":{\"LESEN\":55}}")));
        assertThat(service.view(user).shortForm()).isFalse();
    }
}
