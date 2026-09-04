package com.deutschflow.teacher.dto;

import com.deutschflow.teacher.entity.AssignmentStatus;
import com.deutschflow.teacher.entity.ClassAssignment;
import com.deutschflow.teacher.entity.StudentAssignment;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * F01 — hợp đồng công bố điểm cho học viên: {@link StudentAssignmentDto#forStudent} là mapper duy
 * nhất của các surface student. Điểm/nhận xét chỉ được công bố khi bài đã final
 * ({@link AssignmentStatus#isFinal}); trước đó score là đề xuất AI chưa ai duyệt và feedback có thể
 * là thông điệp lỗi vận hành (GRADING_FAILED).
 */
class StudentAssignmentDtoTest {

    private static StudentAssignment row(String status) {
        return StudentAssignment.builder()
                .id(5L)
                .assignmentId(1L)
                .studentId(200L)
                .status(status)
                .score(87)
                .feedback("nhận xét")
                .submittedAt(LocalDateTime.of(2026, 8, 30, 10, 0))
                .createdAt(LocalDateTime.of(2026, 8, 29, 10, 0))
                .submissionContent("bài làm")
                .build();
    }

    private static ClassAssignment classAssignment() {
        ClassAssignment ca = new ClassAssignment();
        ca.setId(1L);
        ca.setTopic("Brief schreiben");
        ca.setDescription("Viết thư 80 từ");
        ca.setAssignmentType("WRITING");
        return ca;
    }

    @ParameterizedTest
    @ValueSource(strings = {AssignmentStatus.EVALUATED, AssignmentStatus.GRADED})
    @DisplayName("bài đã final: điểm và nhận xét được công bố nguyên vẹn")
    void finalGrade_isPublished(String status) {
        StudentAssignmentDto dto = StudentAssignmentDto.forStudent(
                row(status), classAssignment(), "https://signed.example/file");

        assertThat(dto.teacherScore()).isEqualTo(87);
        assertThat(dto.teacherFeedback()).isEqualTo("nhận xét");
        assertThat(dto.status()).isEqualTo(status);
        assertThat(dto.topic()).isEqualTo("Brief schreiben");
        // URL file dùng bản caller ĐÃ KÝ LẠI (bucket private), không phải URL trần lưu trong DB.
        assertThat(dto.submissionFileUrl()).isEqualTo("https://signed.example/file");
    }

    @ParameterizedTest
    @ValueSource(strings = {
            AssignmentStatus.PENDING,
            AssignmentStatus.SUBMITTED,
            AssignmentStatus.AI_GRADED,
            AssignmentStatus.GRADING_FAILED
    })
    @DisplayName("bài chưa final: score/feedback bị che, status và bài làm của chính mình vẫn thấy")
    void unconfirmedGrade_isMasked(String status) {
        StudentAssignmentDto dto = StudentAssignmentDto.forStudent(
                row(status), classAssignment(), "https://signed.example/file");

        assertThat(dto.teacherScore()).isNull();
        assertThat(dto.teacherFeedback()).isNull();
        assertThat(dto.status()).isEqualTo(status);            // UI vẫn render "chờ chấm"
        assertThat(dto.submissionContent()).isEqualTo("bài làm"); // dữ liệu của chính học viên
    }

    @Test
    @DisplayName("ClassAssignment null (bài gốc đã xoá) không làm vỡ mapping")
    void nullClassAssignment_usesDefaults() {
        StudentAssignmentDto dto = StudentAssignmentDto.forStudent(row(AssignmentStatus.EVALUATED), null, null);

        assertThat(dto.topic()).isEmpty();
        assertThat(dto.assignmentType()).isEqualTo("GENERAL");
        assertThat(dto.dueDate()).isNull();
        assertThat(dto.teacherScore()).isEqualTo(87);
    }
}
