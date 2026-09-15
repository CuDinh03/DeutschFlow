package com.deutschflow.user.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * D6 — luật "thành viên trung tâm không tự xoá tài khoản" ở dạng quyết định thuần. Phần SQL
 * (membership ACTIVE, đếm lớp của trung tâm) do {@code AccountDeletionOrgGuardIntegrationTest}
 * phủ trên Postgres thật.
 */
@DisplayName("AccountDeletionGuard — luật chặn xoá tài khoản (D6)")
class AccountDeletionGuardTest {

    private static AccountDeletionGuard.Membership member(String role) {
        return new AccountDeletionGuard.Membership(7L, role, "Trung tâm Alpha");
    }

    @Test
    @DisplayName("không thuộc trung tâm nào và không đứng tên lớp nào → xoá được")
    void noOrgNoClasses_allowed() {
        assertThat(AccountDeletionGuard.blockReason(null, 0)).isNull();
    }

    @Test
    @DisplayName("học viên trung tâm → chặn, nói rõ hồ sơ học tập và ĐƯỜNG RỜI trung tâm")
    void student_blockedWithExit() {
        String msg = AccountDeletionGuard.blockReason(member("STUDENT"), 0);
        assertThat(msg).isNotNull();
        assertThat(msg)
                .contains("học viên")
                .contains("Trung tâm Alpha")
                .contains("Rời trung tâm")
                .contains("gỡ bạn khỏi danh");
    }

    @Test
    @DisplayName("giáo viên còn phụ trách lớp → chặn, nêu SỐ LỚP và những gì sẽ mất theo")
    void teacherWithClasses_blockedWithConsequence() {
        String msg = AccountDeletionGuard.blockReason(member("TEACHER"), 3);
        assertThat(msg)
                .contains("giáo viên")
                .contains("3 lớp")
                .contains("điểm danh")
                .contains("bài học viên đã nộp")
                .contains("bàn giao");
    }

    @Test
    @DisplayName("giáo viên không còn lớp nào → vẫn chặn, nhưng KHÔNG doạ mất lớp")
    void teacherWithoutClasses_blockedWithoutClassWarning() {
        String msg = AccountDeletionGuard.blockReason(member("TEACHER"), 0);
        assertThat(msg).contains("giáo viên").contains("Rời trung tâm");
        assertThat(msg).doesNotContain("lớp của trung tâm");
    }

    @Test
    @DisplayName("giám đốc → chặn kèm yêu cầu CHUYỂN QUYỀN SỞ HỮU (không phải chỉ 'rời trung tâm')")
    void owner_mustTransferOwnership() {
        String msg = AccountDeletionGuard.blockReason(member("OWNER"), 0);
        assertThat(msg).contains("giám đốc").contains("chuyển quyền sở hữu");
    }

    @Test
    @DisplayName("quản lý được gọi đúng tên vai trò")
    void manager_labelled() {
        assertThat(AccountDeletionGuard.blockReason(member("MANAGER"), 0)).contains("quản lý");
    }

    @Test
    @DisplayName("đã rời trung tâm nhưng còn đứng tên lớp của trung tâm → vẫn chặn (cửa hậu cascade)")
    void formerMemberStillOwningOrgClasses_blocked() {
        String msg = AccountDeletionGuard.blockReason(null, 2);
        assertThat(msg)
                .isNotNull()
                .contains("không còn là thành viên")
                .contains("2 lớp");
    }
}
