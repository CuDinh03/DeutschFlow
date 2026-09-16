package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.teacher.entity.AssignmentStatus;
import com.deutschflow.teacher.entity.StudentAssignment;
import com.deutschflow.teacher.repository.StudentAssignmentRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Đ9 — luật của cổng sở hữu, tách khỏi hai nơi gọi nó.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("SpeakingAssignmentLinkGuard: mối nối phiên nói ↔ dòng bài tập")
class SpeakingAssignmentLinkGuardTest {

    private static final long OWNER = 55L;
    private static final long INTRUDER = 56L;
    private static final long ROW_ID = 100L;

    @Mock StudentAssignmentRepository studentAssignmentRepository;

    private SpeakingAssignmentLinkGuard guard() {
        return new SpeakingAssignmentLinkGuard(studentAssignmentRepository);
    }

    private StudentAssignment rowOf(long studentId) {
        return StudentAssignment.builder()
                .id(ROW_ID).assignmentId(9L).studentId(studentId)
                .status(AssignmentStatus.PENDING).build();
    }

    private void stubRow(StudentAssignment row) {
        when(studentAssignmentRepository.findById(ROW_ID)).thenReturn(Optional.ofNullable(row));
    }

    // ── assertOwnedByCaller (đường TẠO phiên) ───────────────────────────────

    @Test
    @DisplayName("assignmentId rỗng = luyện tự do → không truy vấn gì, không chặn")
    void nullAssignmentId_isFreePractice() {
        assertThatCode(() -> guard().assertOwnedByCaller(OWNER, null)).doesNotThrowAnyException();
        verifyNoInteractions(studentAssignmentRepository);
    }

    @Test
    @DisplayName("dòng bài của chính người gọi → đi qua")
    void ownRow_passes() {
        stubRow(rowOf(OWNER));
        assertThatCode(() -> guard().assertOwnedByCaller(OWNER, ROW_ID)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("dòng bài của học viên khác → NotFoundException (404, không phải 403)")
    void foreignRow_throwsNotFound() {
        stubRow(rowOf(OWNER));
        assertThatThrownBy(() -> guard().assertOwnedByCaller(INTRUDER, ROW_ID))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("id không tồn tại → NotFoundException (fail-closed)")
    void missingRow_throwsNotFound() {
        stubRow(null);
        assertThatThrownBy(() -> guard().assertOwnedByCaller(OWNER, ROW_ID))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("dòng đã xoá mềm → NotFoundException")
    void deletedRow_throwsNotFound() {
        StudentAssignment deleted = rowOf(OWNER);
        deleted.setDeleted(true);
        stubRow(deleted);
        assertThatThrownBy(() -> guard().assertOwnedByCaller(OWNER, ROW_ID))
                .isInstanceOf(NotFoundException.class);
    }

    /**
     * Chủ phiên rỗng là dữ liệu hỏng, không phải "ai cũng được". So sánh ngược
     * ({@code row.getStudentId().equals(userId)}) sẽ cho qua ở đây — nên khoá lại bằng ca riêng.
     */
    @Test
    @DisplayName("người gọi rỗng → NotFoundException, không bao giờ mặc định cho qua")
    void nullCaller_throwsNotFound() {
        stubRow(rowOf(OWNER));
        assertThatThrownBy(() -> guard().assertOwnedByCaller(null, ROW_ID))
                .isInstanceOf(NotFoundException.class);
    }

    // ── loadOwnedForWrite (đường KẾT phiên) ─────────────────────────────────

    @Test
    @DisplayName("đường ghi: dòng của chính chủ phiên → trả về dòng đó")
    void loadForWrite_ownRow_returnsRow() {
        StudentAssignment row = rowOf(OWNER);
        stubRow(row);
        assertThat(guard().loadOwnedForWrite(OWNER, ROW_ID)).containsSame(row);
    }

    @Test
    @DisplayName("đường ghi: dòng của người khác → rỗng, KHÔNG ném (chấm nền chạy async)")
    void loadForWrite_foreignRow_returnsEmptyWithoutThrowing() {
        stubRow(rowOf(OWNER));
        assertThat(guard().loadOwnedForWrite(INTRUDER, ROW_ID)).isEmpty();
    }

    @Test
    @DisplayName("đường ghi: assignmentId rỗng → rỗng, không truy vấn")
    void loadForWrite_nullId_returnsEmpty() {
        assertThat(guard().loadOwnedForWrite(OWNER, null)).isEmpty();
        verifyNoInteractions(studentAssignmentRepository);
    }
}
