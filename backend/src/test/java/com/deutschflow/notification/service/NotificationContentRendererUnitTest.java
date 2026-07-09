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
    @DisplayName("class channel message shows the class name in the title and sender: preview in the body")
    void classChannelMessage_rendersClassAndSender() {
        RenderedContent c = renderer.render(NotificationType.CLASS_CHANNEL_MESSAGE,
                Map.of("className", "A1 Sáng", "senderName", "An", "preview", "chào cả lớp"));
        assertThat(c.title()).contains("A1 Sáng");
        assertThat(c.body()).isEqualTo("An: chào cả lớp");
    }

    @Test
    @DisplayName("class channel message falls back gracefully when class/sender names are absent")
    void classChannelMessage_fallsBackWhenNamesMissing() {
        RenderedContent c = renderer.render(NotificationType.CLASS_CHANNEL_MESSAGE,
                Map.of("preview", "hi"));
        assertThat(c.title()).contains("Chat lớp");
        assertThat(c.body()).isEqualTo("Thành viên: hi");
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
    @DisplayName("user registered distinguishes self-signup from staff-created (via)")
    void userRegistered_distinguishesSource() {
        RenderedContent self = renderer.render(NotificationType.USER_REGISTERED,
                Map.of("displayName", "An", "email", "an@x.com", "via", "SELF"));
        assertThat(self.title()).isEqualTo("Đăng ký mới");
        assertThat(self.body()).isEqualTo("An (an@x.com) vừa tạo tài khoản.");

        RenderedContent byAdmin = renderer.render(NotificationType.USER_REGISTERED,
                Map.of("displayName", "An", "email", "an@x.com", "via", "ADMIN"));
        assertThat(byAdmin.body()).contains("admin tạo");

        RenderedContent byOrg = renderer.render(NotificationType.USER_REGISTERED,
                Map.of("displayName", "An", "email", "an@x.com", "via", "MANAGER"));
        assertThat(byOrg.body()).contains("trung tâm");
    }

    @Test
    @DisplayName("account deleted names the user, with a safe fallback when identity is absent")
    void accountDeleted_rendersIdentity() {
        RenderedContent named = renderer.render(NotificationType.ACCOUNT_DELETED,
                Map.of("displayName", "Bình", "email", "binh@x.com"));
        assertThat(named.body()).isEqualTo("Bình (binh@x.com) đã xoá tài khoản.");

        RenderedContent empty = renderer.render(NotificationType.ACCOUNT_DELETED, Map.of());
        assertThat(empty.body()).isEqualTo("Một người dùng đã xoá tài khoản.");
    }

    @Test
    @DisplayName("subscription ended maps the reason to a Vietnamese label")
    void subscriptionEnded_labelsReason() {
        RenderedContent refunded = renderer.render(NotificationType.ADMIN_LEARNER_SUBSCRIPTION_ENDED,
                Map.of("planCode", "PRO", "learnerEmail", "c@x.com", "reason", "REFUNDED"));
        assertThat(refunded.body()).contains("PRO").contains("c@x.com").contains("hoàn tiền");

        RenderedContent expired = renderer.render(NotificationType.ADMIN_LEARNER_SUBSCRIPTION_ENDED,
                Map.of("planCode", "PRO", "reason", "EXPIRED"));
        assertThat(expired.body()).contains("hết hạn");
    }

    @Test
    @DisplayName("system alert surfaces the caller's title/message")
    void systemAlert_usesTitleMessage() {
        RenderedContent c = renderer.render(NotificationType.ADMIN_SYSTEM_ALERT,
                Map.of("title", "AI chấm bài thất bại", "message", "Kiểm tra cấu hình LLM."));
        assertThat(c.title()).contains("AI chấm bài thất bại");
        assertThat(c.body()).isEqualTo("Kiểm tra cấu hình LLM.");
    }

    @Test
    @DisplayName("org invoice paid formats a VND amount and names the org")
    void orgInvoicePaid_formatsAmount() {
        RenderedContent c = renderer.render(NotificationType.ADMIN_ORG_INVOICE_PAID,
                Map.of("orgName", "Trung tâm ABC", "paymentCode", "DFINV-1A2B", "amountVnd", 2500000L));
        assertThat(c.body()).contains("Trung tâm ABC").contains("DFINV-1A2B").contains("2.500.000₫");

        RenderedContent noAmount = renderer.render(NotificationType.ADMIN_ORG_INVOICE_PAID,
                Map.of("orgName", "Trung tâm ABC", "paymentCode", "DFINV-1A2B"));
        assertThat(noAmount.body()).doesNotContain("₫");
    }

    @Test
    @DisplayName("org created names the organization")
    void orgCreated_namesOrg() {
        RenderedContent c = renderer.render(NotificationType.ADMIN_ORG_CREATED,
                Map.of("orgName", "Trung tâm ABC", "slug", "abc"));
        assertThat(c.body()).contains("Trung tâm ABC");
    }

    @Test
    @DisplayName("class schedule events read the composed 'message', with safe fallbacks")
    void classScheduleEvents_useMessage() {
        RenderedContent scheduled = renderer.render(NotificationType.CLASS_SESSION_SCHEDULED,
                Map.of("className", "K30", "message", "Lớp K30 có buổi học mới: 06/07/2026 lúc 18:00, phòng P.302."));
        assertThat(scheduled.title()).contains("Lịch học mới");
        assertThat(scheduled.body()).contains("P.302").contains("18:00");

        RenderedContent cancelled = renderer.render(NotificationType.CLASS_SESSION_CANCELLED,
                Map.of("className", "K30", "message", "Buổi học lớp K30 06/07/2026 lúc 18:00 đã bị huỷ (nghỉ học)."));
        assertThat(cancelled.title()).contains("huỷ");
        assertThat(cancelled.body()).contains("nghỉ học");

        RenderedContent moved = renderer.render(NotificationType.CLASS_SESSION_RESCHEDULED,
                Map.of("className", "K30"));
        assertThat(moved.title()).contains("Đổi lịch");
        assertThat(moved.body()).contains("K30"); // fallback when no explicit message
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
