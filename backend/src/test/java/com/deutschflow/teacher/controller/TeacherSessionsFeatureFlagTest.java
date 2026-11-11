package com.deutschflow.teacher.controller;

import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.audit.AuditOrgResolver;
import com.deutschflow.common.exception.GlobalExceptionHandler;
import com.deutschflow.teacher.service.TeacherSessionService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.http.server.PathContainer;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.util.pattern.PathPatternParser;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Cờ {@code app.features.teacher-sessions-enabled}: tắt → mọi endpoint buổi học 1:1 trả 404 và
 * không chạm service; bật → request đi tới controller như cũ. MockMvc standalone, không Spring
 * context — interceptor được gắn với đúng {@link TeacherSessionsFeatureInterceptor#PATH_PATTERNS}
 * mà {@code WebConfig} dùng.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("Cờ tắt buổi học 1:1 (/api/teacher-sessions/**)")
class TeacherSessionsFeatureFlagTest {

    @Mock private TeacherSessionService sessionService;
    @Mock private AuditLogService auditLogService;
    @Mock private AuditOrgResolver auditOrgResolver;

    private MockMvc mvc(boolean enabled) {
        return MockMvcBuilders
                .standaloneSetup(new TeacherSessionController(sessionService, auditLogService, auditOrgResolver))
                .addMappedInterceptors(TeacherSessionsFeatureInterceptor.PATH_PATTERNS,
                        new TeacherSessionsFeatureInterceptor(enabled))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    @DisplayName("cờ tắt → mọi endpoint của tính năng trả 404, service không được gọi")
    void disabled_everyEndpointIs404() throws Exception {
        MockMvc mvc = mvc(false);
        String bookBody = """
                {"teacherProfileId":1,"title":"Ôn B1","scheduledAt":"2030-01-01T10:00:00","durationMinutes":60}
                """;

        mvc.perform(post("/api/teacher-sessions").contentType(MediaType.APPLICATION_JSON).content(bookBody))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/teacher-sessions/my")).andExpect(status().isNotFound());
        mvc.perform(get("/api/teacher-sessions/teacher").param("profileId", "1")).andExpect(status().isNotFound());
        mvc.perform(patch("/api/teacher-sessions/5/status").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"CONFIRMED\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/teacher-sessions/5/review").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rating\":5}"))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/teacher-sessions/earnings").param("profileId", "1")).andExpect(status().isNotFound());
        mvc.perform(get("/api/teacher-sessions/admin/pending-payouts")).andExpect(status().isNotFound());
        mvc.perform(post("/api/teacher-sessions/admin/mark-paid").contentType(MediaType.APPLICATION_JSON)
                        .content("[1,2]"))
                .andExpect(status().isNotFound());

        verifyNoInteractions(sessionService);
    }

    @Test
    @DisplayName("cờ bật → request đi tới controller như cũ")
    void enabled_requestReachesController() throws Exception {
        when(sessionService.getPendingPayouts()).thenReturn(List.of());

        mvc(true).perform(get("/api/teacher-sessions/admin/pending-payouts")).andExpect(status().isOk());

        verify(sessionService).getPendingPayouts();
    }

    @Test
    @DisplayName("phạm vi chặn chỉ là /api/teacher-sessions — không chạm buổi dạy của lớp hay bảng công")
    void pathPatterns_coverOnlyTheFeature() {
        PathPatternParser parser = new PathPatternParser();

        assertThat(matchesAny(parser, "/api/teacher-sessions")).isTrue();
        assertThat(matchesAny(parser, "/api/teacher-sessions/my")).isTrue();
        assertThat(matchesAny(parser, "/api/teacher-sessions/admin/pending-payouts")).isTrue();

        assertThat(matchesAny(parser, "/api/teacher-sessions-export")).isFalse();
        assertThat(matchesAny(parser, "/api/v2/teacher/classes/1/sessions")).isFalse();
        assertThat(matchesAny(parser, "/api/v2/teacher/timesheet")).isFalse();
        assertThat(matchesAny(parser, "/api/teachers/1")).isFalse();
    }

    private static boolean matchesAny(PathPatternParser parser, String path) {
        return Arrays.stream(TeacherSessionsFeatureInterceptor.PATH_PATTERNS)
                .anyMatch(p -> parser.parse(p).matches(PathContainer.parsePath(path)));
    }
}
