package com.deutschflow.examspeaking.session;

import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.repository.OrgMemberRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

/**
 * V320 §1 — cột {@code speaking_exam_sessions.org_id} là ẢNH CHỤP lúc tạo phiên, và phép chụp lấy từ
 * {@code org_members} ACTIVE vai STUDENT chứ không từ {@code users.org_id}. Ca ở đây khoá ba luật của
 * {@link ExamSessionService#orgSnapshotFor(long)}; việc giá trị đó THẬT SỰ nằm trong cột do
 * {@code ExamSessionOrgSnapshotIntegrationTest} chứng minh trên Postgres.
 *
 * <p>Không có Spring context: chỉ mock repository membership, mọi cộng tác viên khác của service để
 * null vì hàm chụp không chạm tới chúng.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ExamSessionService — ảnh chụp org_id lúc tạo phiên thi nói (V320 §1)")
class ExamSessionOrgSnapshotTest {

    private static final long USER = 42L;

    @Mock private OrgMemberRepository orgMembers;
    @InjectMocks private ExamSessionService service;

    @Test
    @DisplayName("một membership STUDENT ACTIVE → org_id của đúng trung tâm đó")
    void motMembership_traOrgId() {
        when(orgMembers.findByIdUserIdAndRoleAndStatus(USER, "STUDENT", "ACTIVE"))
                .thenReturn(List.of(member(7L)));

        assertThat(service.orgSnapshotFor(USER)).isEqualTo(7L);
    }

    @Test
    @DisplayName("không membership nào (B2C) → null")
    void khongMembership_traNull() {
        when(orgMembers.findByIdUserIdAndRoleAndStatus(USER, "STUDENT", "ACTIVE")).thenReturn(List.of());

        assertThat(service.orgSnapshotFor(USER)).isNull();
    }

    @Test
    @DisplayName("hai membership STUDENT ACTIVE là dữ liệu lệch → null, KHÔNG đoán bừa một trung tâm")
    void haiMembership_traNull() {
        // Chọn bừa org 7 hay 9 đều có thể đặt vết dọn 30 ngày sau vào sổ của bên không hề giữ bản
        // ghi âm; null + cảnh báo là câu trả lời trung thực duy nhất.
        when(orgMembers.findByIdUserIdAndRoleAndStatus(USER, "STUDENT", "ACTIVE"))
                .thenReturn(List.of(member(7L), member(9L)));

        assertThat(service.orgSnapshotFor(USER)).isNull();
    }

    @Test
    @DisplayName("hỏi ĐÚNG org_members theo (user, STUDENT, ACTIVE) — và chỉ hỏi một lần")
    void hoiDungNguon() {
        when(orgMembers.findByIdUserIdAndRoleAndStatus(USER, "STUDENT", "ACTIVE")).thenReturn(List.of());

        service.orgSnapshotFor(USER);

        verify(orgMembers).findByIdUserIdAndRoleAndStatus(USER, "STUDENT", "ACTIVE");
        verifyNoMoreInteractions(orgMembers);
    }

    private static OrgMember member(long orgId) {
        return OrgMember.builder().id(new OrgMemberId(orgId, USER)).role("STUDENT").status("ACTIVE").build();
    }
}
