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
            case USER_REGISTERED -> renderUserRegistered(p);
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

            // ── Class schedule changes ───────────────────────────────────────
            case CLASS_SESSION_SCHEDULED -> new RenderedContent(
                    "🗓️ Lịch học mới",
                    nonBlankOr(str(p, "message"),
                            "Lớp " + nonBlankOr(str(p, "className"), "của bạn") + " có buổi học mới."));
            case CLASS_SESSION_CANCELLED -> new RenderedContent(
                    "🚫 Buổi học bị huỷ",
                    nonBlankOr(str(p, "message"),
                            "Một buổi học của lớp " + nonBlankOr(str(p, "className"), "bạn") + " đã bị huỷ."));
            case CLASS_SESSION_RESCHEDULED -> new RenderedContent(
                    "🔄 Đổi lịch học",
                    nonBlankOr(str(p, "message"),
                            "Buổi học của lớp " + nonBlankOr(str(p, "className"), "bạn") + " đã thay đổi."));

            // ── v1.7 — Admin ops & audit ─────────────────────────────────────
            case ACCOUNT_DELETED -> new RenderedContent(
                    "🗑️ Xoá tài khoản",
                    who(p).isBlank() ? "Một người dùng đã xoá tài khoản."
                            : who(p) + " đã xoá tài khoản.");
            case ADMIN_LEARNER_SUBSCRIPTION_ENDED -> new RenderedContent(
                    "Gói học kết thúc",
                    "Gói " + nonBlankOr(str(p, "planCode"), "học") + " của "
                            + nonBlankOr(str(p, "learnerEmail"), "học viên") + " đã kết thúc ("
                            + endReasonLabel(str(p, "reason")) + ").");
            case ADMIN_SYSTEM_ALERT -> new RenderedContent(
                    "⚠️ " + nonBlankOr(str(p, "title"), "Cảnh báo hệ thống"),
                    nonBlankOr(str(p, "message"), "Có sự cố hệ thống cần kiểm tra."));
            case ADMIN_ORG_CREATED -> new RenderedContent(
                    "🏢 Tổ chức mới",
                    "Đã tạo tổ chức \"" + nonBlankOr(str(p, "orgName"), "(không tên)") + "\".");
            case ADMIN_ORG_INVOICE_PAID -> new RenderedContent(
                    "💰 Hoá đơn đã thanh toán",
                    "Hoá đơn " + nonBlankOr(str(p, "paymentCode"), "") + " của tổ chức \""
                            + nonBlankOr(str(p, "orgName"), "(không tên)") + "\" đã được thanh toán"
                            + amountSuffix(p) + ".");
        };
    }

    /**
     * "Đăng ký mới" distinguishes how the account was created (self-signup vs
     * created by staff), so the admin knows whether it's an organic signup.
     */
    private RenderedContent renderUserRegistered(Map<String, Object> p) {
        String who = who(p);
        String action = switch (str(p, "via").toUpperCase()) {
            case "ADMIN" -> " vừa được admin tạo tài khoản.";
            case "MANAGER", "OWNER" -> " vừa được trung tâm tạo tài khoản.";
            case "CSV" -> " vừa được nhập từ danh sách.";
            default -> " vừa tạo tài khoản.";
        };
        return new RenderedContent("Đăng ký mới",
                nonBlankOr(who.isBlank() ? "" : who + action, "Có người dùng mới đăng ký."));
    }

    /** "Name (email)" when present, else whichever half exists, else "". */
    private static String who(Map<String, Object> p) {
        String name = str(p, "displayName");
        String email = str(p, "email");
        if (!name.isBlank() && !email.isBlank()) return name + " (" + email + ")";
        return !name.isBlank() ? name : email;
    }

    private static String endReasonLabel(String reason) {
        return switch (reason == null ? "" : reason.toUpperCase()) {
            case "EXPIRED" -> "hết hạn";
            case "REFUNDED" -> "hoàn tiền";
            case "REVOKED" -> "thu hồi";
            case "CANCELLED", "CANCELED" -> "huỷ";
            default -> "kết thúc";
        };
    }

    /** " — 250.000₫" when a positive amountVnd is present, else "". */
    private static String amountSuffix(Map<String, Object> p) {
        Object raw = p.get("amountVnd");
        if (raw == null) return "";
        try {
            long amount = Long.parseLong(String.valueOf(raw));
            return amount > 0 ? " — " + String.format("%,d", amount).replace(',', '.') + "₫" : "";
        } catch (NumberFormatException e) {
            return "";
        }
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
