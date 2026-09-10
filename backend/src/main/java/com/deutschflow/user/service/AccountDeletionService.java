package com.deutschflow.user.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Permanently deletes a learner account and all associated data.
 *
 * Most child tables reference users(id) with ON DELETE CASCADE, so deleting the
 * users row removes them automatically. A handful of tables use a plain (non
 * cascading) FK and would otherwise block the delete — those are removed first,
 * in dependency order, within the same transaction.
 *
 * Required for App Store Guideline 5.1.1(v): in-app account deletion.
 *
 * <p>Thành viên trung tâm KHÔNG đi qua được đường này — xem {@link AccountDeletionGuard} (D6).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AccountDeletionService {

    private final JdbcTemplate jdbc;
    private final AccountDeletionGuard deletionGuard;

    /** Tables with a non-cascading FK to users(id) that must be cleared first. */
    private static final String[] NON_CASCADING_BY_USER_ID = {
            "b1_assessment_states",
            "learner_phase_states",
            "learning_review_items",
            "grammar_feedback_events",
            "placement_test_sessions",
    };

    @Transactional
    public void deleteAccount(long userId) {
        // D6 (owner chốt 08/09/2026) — chốt đặt Ở ĐÂY chứ không ở controller: đây là chỗ DUY NHẤT
        // xoá dòng users, nên mọi đường xoá tài khoản về sau đều chịu chung một hàng rào. Ném 409
        // kèm hướng dẫn cụ thể; @Transactional nên không có gì bị xoá dở.
        deletionGuard.assertDeletable(userId);
        // Table name is concatenated from the compile-time constant array above (never user input),
        // so this is not an injection vector; the userId is always a bound parameter.
        for (String table : NON_CASCADING_BY_USER_ID) {
            jdbc.update("DELETE FROM " + table + " WHERE user_id = ?", userId);
        }
        // teacher_sessions references the learner via student_id (non-cascading).
        jdbc.update("DELETE FROM teacher_sessions WHERE student_id = ?", userId);

        // Direct messages (V228): sender_id AND recipient_id are both NOT NULL, non-cascading FKs —
        // so a learner who has EITHER sent OR received a DM blocks the users delete. A conversation is
        // the (sender, recipient) pair, so removing the account removes its threads on both sides —
        // consistent with the erasure request. (Added after V228 introduced this FK; the previous
        // "everything else cascades" assumption was wrong and broke App Store 5.1.1(v).)
        jdbc.update("DELETE FROM messages WHERE sender_id = ? OR recipient_id = ?", userId, userId);

        // Class channel messages (V241): remove the user's own posts (sender_id, NOT NULL). Where the
        // user had moderated someone ELSE's message (deleted_by, nullable), keep that message but unlink
        // the reference so the channel's audit trail survives without pointing at a deleted user.
        jdbc.update("DELETE FROM class_channel_messages WHERE sender_id = ?", userId);
        jdbc.update("UPDATE class_channel_messages SET deleted_by = NULL WHERE deleted_by = ?", userId);

        // Báo cáo nội dung (V244/V321, owner chốt 10/09/2026 — B1): người BỊ TỐ CÁO xoá tài khoản thì
        // ẨN DANH nội dung (snapshot_body + details) nhưng GIỮ dòng và GIỮ reporter_id — bằng chứng
        // "đã có báo cáo, đã xử lý thế nào" thuộc về hàng đợi kiểm duyệt, còn nội dung là dữ liệu
        // của người vừa thực thi quyền xoá. Phải chạy TRƯỚC `DELETE FROM users`: FK reported_user_id
        // là SET NULL, xoá xong thì không còn tra được dòng nào là của người này nữa.
        // COALESCE giữ mốc cũ nếu job hạn lưu đã dọn trước; NULL rồi thì gán NULL lần nữa vô hại.
        // Người này ở vai NGƯỜI TỐ CÁO thì không cần lệnh nào: FK reporter_id SET NULL (V321).
        jdbc.update("UPDATE content_reports SET snapshot_body = NULL, details = NULL, "
                + "content_purged_at = COALESCE(content_purged_at, now()) WHERE reported_user_id = ?", userId);

        // Remaining FKs cascade (ON DELETE CASCADE) or set null on this delete.
        // NOTE (teacher/org offboarding — separate follow-up): authorship/audit columns on
        // materials/quiz/skill/org tables (created_by, teacher_id, invited_by, attached_by) use
        // non-cascading FKs to users(id). A learner never populates them, so learner deletion is
        // clean; but a TEACHER/ADMIN self-deleting could still FK-fail on authored content. That
        // path needs a dedicated offboarding design and is out of scope for the 5.1.1(v) learner fix.
        int rows = jdbc.update("DELETE FROM users WHERE id = ?", userId);
        log.info("Account deletion completed for userId={} (rows={})", userId, rows);
    }
}
