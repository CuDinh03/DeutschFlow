package com.deutschflow.notification.service;

import com.deutschflow.notification.NotificationType;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Single source of truth for the human-readable {@code title}/{@code body} of a
 * notification, derived from its {@link NotificationType} + freeform payload.
 *
 * <p>Historically each client (web bell, web inboxes, mobile) reconstructed this
 * text from the type+payload independently, so the content was never recorded
 * server-side, push fell back to the raw enum name, and any unmapped type
 * surfaced as e.g. "QUIZ SUBMISSION RECEIVED". Rendering here — on read and at
 * push time — makes the content recorded once, consistent across every surface
 * (including OS push), and meaningful for types a given client doesn't know.
 *
 * <p>Vietnamese-first, matching the existing in-app wording. Pure (no deps) so it
 * is trivially unit-testable and safe to call on every row in a list response.
 */
@Component
public class NotificationContentRenderer {

    /** Rendered, ready-to-display notification content. */
    public record RenderedContent(String title, String body) {}

    public RenderedContent render(NotificationType type, Map<String, Object> payloadOrNull) {
        Map<String, Object> p = payloadOrNull != null ? payloadOrNull : Map.of();
        return switch (type) {
            case USER_REGISTERED -> new RenderedContent(
                    "Đăng ký mới",
                    nonBlankOr(str(p, "displayName") + " (" + str(p, "email") + ") vừa tạo tài khoản.",
                            "Có học viên mới đăng ký."));
            case LEARNER_PLAN_UPDATED -> new RenderedContent(
                    "Cập nhật gói học",
                    "Gói học của bạn đã được cập nhật thành " + str(p, "planCode") + ".");
            case ADMIN_LEARNER_PLAN_CHANGED -> new RenderedContent(
                    "Thay đổi gói học viên",
                    "Admin gán gói " + str(p, "planCode") + " cho " + str(p, "learnerEmail")
                            + " (bởi " + str(p, "actingAdminEmail") + ").");
            case ADMIN_LEARNER_SUBSCRIBED -> new RenderedContent(
                    "Học viên đăng ký gói",
                    "Học viên " + str(p, "learnerEmail") + " vừa đăng ký thành công gói "
                            + str(p, "planCode") + "!");
            case ACHIEVEMENT_UNLOCKED -> new RenderedContent(
                    "🏆 Thành tích mới",
                    "Bạn đã mở khóa huy hiệu \"" + str(p, "achievementName") + "\"! +"
                            + intStr(p, "xpReward") + " XP");
            case LEVEL_UP -> new RenderedContent(
                    "⬆️ Lên cấp",
                    "Chúc mừng! Bạn đã lên Level " + str(p, "newLevel") + "!");
            case REVIEW_DUE -> new RenderedContent(
                    "📚 Ôn tập hôm nay",
                    nonBlankOr(str(p, "message"),
                            "Có " + intStr(p, "dueCount") + " thẻ cần ôn tập hôm nay"));
            case STREAK_REMINDER -> new RenderedContent(
                    "🔥 Chuỗi học tập",
                    nonBlankOr(str(p, "message"), "Đừng quên học hôm nay!"));
            case NEW_ASSIGNMENT -> new RenderedContent(
                    "📝 Bài tập mới",
                    "Thầy/Cô " + nonBlankOr(str(p, "teacherName"), "giáo viên") + " vừa giao bài tập "
                            + str(p, "quizTitle") + " cho lớp " + str(p, "classroomName") + ".");
            case JOIN_REQUEST_APPROVED -> new RenderedContent(
                    "✅ Được duyệt vào lớp",
                    "Yêu cầu vào lớp " + str(p, "className") + " đã được chấp thuận! Chào mừng bạn.");
            case JOIN_REQUEST_REJECTED -> new RenderedContent(
                    "❌ Yêu cầu vào lớp",
                    "Yêu cầu vào lớp " + str(p, "className") + " đã bị từ chối.");
            case ADDED_TO_CLASS -> new RenderedContent(
                    "🎓 Thêm vào lớp",
                    "Giáo viên " + nonBlankOr(str(p, "teacherName"), "của bạn") + " đã thêm bạn vào lớp "
                            + str(p, "className") + ".");
            case ASSIGNMENT_GRADED -> renderAssignmentGraded(p);
            case NEW_CLASS_ASSIGNMENT -> new RenderedContent(
                    "📋 Bài tập mới",
                    "Lớp " + str(p, "className") + " có bài tập mới: " + str(p, "topic"));
            case CLASS_STUDENT_ADDED -> new RenderedContent(
                    "Thêm học sinh vào lớp",
                    "Đã thêm học sinh " + str(p, "studentName") + " vào lớp " + str(p, "className") + ".");
            case CLASS_STUDENT_REMOVED -> new RenderedContent(
                    "Xóa học sinh khỏi lớp",
                    "Đã xóa học sinh " + str(p, "studentName") + " khỏi lớp " + str(p, "className") + ".");
            case CLASS_JOIN_REQUEST_CREATED -> new RenderedContent(
                    "Yêu cầu tham gia lớp",
                    nonBlankOr(str(p, "studentName"), "Một học sinh") + " yêu cầu tham gia lớp "
                            + str(p, "className") + ".");
            case QUIZ_SUBMISSION_RECEIVED -> renderQuizSubmission(p);
            case ADMIN_BROADCAST -> new RenderedContent(
                    nonBlankOr(str(p, "title"), "Thông báo từ hệ thống"),
                    str(p, "body"));
            case TEACHER_ANNOUNCEMENT -> new RenderedContent(
                    "📢 Thông báo từ giáo viên",
                    firstNonBlank(str(p, "message"), str(p, "body"), str(p, "title"),
                            "Bạn có thông báo mới từ giáo viên."));
            case NEW_MESSAGE -> new RenderedContent(
                    "💬 Tin nhắn mới",
                    nonBlankOr(str(p, "senderName"), "Ai đó") + ": " + str(p, "preview"));
        };
    }

    private RenderedContent renderAssignmentGraded(Map<String, Object> p) {
        String typeLabel = "SPEAKING".equals(str(p, "assignmentType")) ? "nói" : "tập";
        Object score = p.get("score");
        // Scores are on a 0–100 scale (AI + teacher grading). Render scale-agnostically
        // (matching the prior web wording) — never a fixed "/10" denominator.
        String scorePart = score != null ? " — Điểm: " + score + "." : ".";
        return new RenderedContent(
                "✅ Bài đã chấm",
                "Bài " + typeLabel + " của bạn đã được chấm" + scorePart + " Xem phản hồi.");
    }

    private RenderedContent renderQuizSubmission(Map<String, Object> p) {
        String student = nonBlankOr(str(p, "studentName"), "học sinh");
        String className = str(p, "className");
        String body = "Có bài cần xem từ " + student + (className.isBlank() ? "" : " · " + className);
        return new RenderedContent("📥 Bài cần xem", body);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private static String str(Map<String, Object> p, String key) {
        Object v = p.get(key);
        return v == null ? "" : String.valueOf(v);
    }

    /** String value for a numeric key, defaulting to "0" when absent/blank. */
    private static String intStr(Map<String, Object> p, String key) {
        String s = str(p, key);
        return s.isBlank() ? "0" : s;
    }

    private static String nonBlankOr(String value, String fallback) {
        return value != null && !value.isBlank() ? value : fallback;
    }

    private static String firstNonBlank(String... candidates) {
        for (String c : candidates) {
            if (c != null && !c.isBlank()) {
                return c;
            }
        }
        return "";
    }
}
