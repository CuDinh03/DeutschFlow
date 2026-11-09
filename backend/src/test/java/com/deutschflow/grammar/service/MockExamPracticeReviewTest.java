package com.deutschflow.grammar.service;

import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.user.entity.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** B3: ngữ cảnh xem lại của lượt thi thử — chỉ chủ lượt (404), chỉ sau khi nộp (409). */
@DisplayName("MockExamPracticeService.attemptReview — quyền và trạng thái lượt")
class MockExamPracticeReviewTest {

    private static final String SECTIONS = """
            {"sections":[{"name":"LESEN","teile":[{"teil":2,"type":"MULTIPLE_CHOICE","items":[
              {"id":"LV2-6","correct":"a","options":{"a":"x","b":"y"}}]}]},
             {"name":"SCHREIBEN","teile":[{"teil":1}]}]}
            """;

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final MockExamPracticeService service = new MockExamPracticeService(jdbc, new ObjectMapper(),
            mock(ExamQuestionSanitizer.class), mock(MockExamPackService.class));
    private final User user = User.builder().id(42L).email("a@test.local").role(User.Role.STUDENT).build();

    private void attempt(String status) {
        when(jdbc.queryForList(anyString(), eq(9L), eq(42L))).thenReturn(status == null ? List.of()
                : List.of(Map.of("exam_id", 7L, "status", status, "answers", "{\"LV2-6\":\"b\"}", "sections_json", SECTIONS)));
    }

    @Test
    void khongPhaiCuaMinh_404() {
        attempt(null);
        assertThatThrownBy(() -> service.attemptReview(user, 9L, "LESEN-2")).isInstanceOf(NotFoundException.class);
    }

    @Test
    void dangLam_409() {
        attempt("IN_PROGRESS");
        assertThatThrownBy(() -> service.attemptReview(user, 9L, "LESEN-2")).isInstanceOf(ConflictException.class);
    }

    @Test
    void daHuy_404() {
        attempt("CANCELLED");
        assertThatThrownBy(() -> service.attemptReview(user, 9L, "LESEN-2")).isInstanceOf(NotFoundException.class);
    }

    @Test
    void daNop_traNgucanh_vaVietKhongHoiDuoc() {
        attempt("COMPLETED");
        var ctx = service.attemptReview(user, 9L, "LESEN-2");
        assertThat(ctx.examId()).isEqualTo(7L);
        assertThat(ctx.answers()).containsEntry("LV2-6", "b");
        assertThat(ctx.teil()).containsKey("items");

        attempt("PARTIAL");
        assertThat(service.attemptReview(user, 9L, "LESEN-2").teilKey()).isEqualTo("LESEN-2");
        assertThatThrownBy(() -> service.attemptReview(user, 9L, "SCHREIBEN-1")).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.attemptReview(user, 9L, "LESEN-9")).isInstanceOf(NotFoundException.class);
    }
}
