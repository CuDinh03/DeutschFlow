package com.deutschflow.notification.service;

import com.deutschflow.notification.NotificationType;
import com.deutschflow.notification.service.NotificationContentRenderer.RenderedContent;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class NotificationContentRendererUnitTest {

    private final NotificationContentRenderer renderer = new NotificationContentRenderer();

    @Test
    @DisplayName("admin broadcast surfaces the exact title/body the admin typed")
    void adminBroadcast_usesPayloadTitleBody() {
        RenderedContent c = renderer.render(NotificationType.ADMIN_BROADCAST,
                Map.of("title", "Bảo trì hệ thống", "body", "App sẽ tạm dừng lúc 2h sáng."));
        assertThat(c.title()).isEqualTo("Bảo trì hệ thống");
        assertThat(c.body()).isEqualTo("App sẽ tạm dừng lúc 2h sáng.");
    }

    @Test
    @DisplayName("teacher announcement reads the 'message' key (key-drift tolerated)")
    void teacherAnnouncement_readsMessageKey() {
        RenderedContent c = renderer.render(NotificationType.TEACHER_ANNOUNCEMENT,
                Map.of("message", "Mai nghỉ học nhé các em."));
        assertThat(c.body()).isEqualTo("Mai nghỉ học nhé các em.");
        assertThat(c.title()).contains("giáo viên");
    }

    @Test
    @DisplayName("structured-only types render a meaningful Vietnamese sentence")
    void levelUp_rendersFromStructuredPayload() {
        RenderedContent c = renderer.render(NotificationType.LEVEL_UP,
                Map.of("oldLevel", 4, "newLevel", 5, "totalXp", 1200));
        assertThat(c.body()).isEqualTo("Chúc mừng! Bạn đã lên Level 5!");
    }

    @Test
    @DisplayName("assignment graded shows a 0-100 score scale-agnostically (no fixed denominator)")
    void assignmentGraded_includesScore() {
        // Scores are on a 0–100 scale; the body must NOT impose a "/10" (or any) denominator,
        // matching the prior scale-agnostic web wording.
        RenderedContent withScore = renderer.render(NotificationType.ASSIGNMENT_GRADED,
                Map.of("assignmentType", "SPEAKING", "score", 85));
        assertThat(withScore.body()).contains("nói").contains("Điểm: 85.");
        assertThat(withScore.body()).doesNotContain("/10").doesNotContain("/100");

        RenderedContent noScore = renderer.render(NotificationType.ASSIGNMENT_GRADED,
                new LinkedHashMap<>(Map.of("assignmentType", "WRITING")));
        assertThat(noScore.body()).contains("tập").doesNotContain("Điểm");
    }

    @Test
    @DisplayName("missing payload keys never throw and never emit 'null'")
    void emptyPayload_isSafe() {
        for (NotificationType type : NotificationType.values()) {
            RenderedContent c = renderer.render(type, Map.of());
            assertThat(c.title()).isNotBlank();
            assertThat(c.body()).doesNotContain("null");
            assertThat(c.title()).doesNotContain("null");
        }
    }

    @Test
    @DisplayName("no type renders as a raw enum string (underscores)")
    void noType_rendersRawEnum() {
        for (NotificationType type : NotificationType.values()) {
            RenderedContent c = renderer.render(type, Map.of());
            // The old client fallback showed e.g. "QUIZ SUBMISSION RECEIVED"; the
            // server renderer must always provide a friendly title instead.
            assertThat(c.title()).doesNotContain("_");
            assertThat(c.title()).isNotEqualTo(type.name());
            assertThat(c.title()).isNotEqualTo(type.name().replace('_', ' '));
        }
    }
}
