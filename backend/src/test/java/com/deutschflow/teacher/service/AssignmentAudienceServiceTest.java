package com.deutschflow.teacher.service;

import com.deutschflow.teacher.entity.ClassAssignment;
import com.deutschflow.teacher.entity.ClassAssignmentRecipient;
import com.deutschflow.teacher.repository.ClassAssignmentRecipientRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.when;

/** Ma trận "học viên có được thấy bài này không" (PR-8, P06/AC14). */
@ExtendWith(MockitoExtension.class)
@DisplayName("AssignmentAudienceService")
class AssignmentAudienceServiceTest {

    @Mock private ClassAssignmentRecipientRepository recipientRepo;

    private AssignmentAudienceService service;

    @BeforeEach
    void setUp() {
        service = new AssignmentAudienceService(recipientRepo);
    }

    private static ClassAssignment assignment(long id, String status) {
        return ClassAssignment.builder().id(id).classId(1L).topic("Bài " + id).status(status).build();
    }

    private static ClassAssignmentRecipient recipient(long assignmentId, long studentId) {
        return ClassAssignmentRecipient.builder()
                .id(new ClassAssignmentRecipient.Id(assignmentId, studentId)).build();
    }

    @Test
    @DisplayName("P06: bài DRAFT vô hình với mọi học viên — kể cả người trong danh sách nhận")
    void draft_invisibleToEveryone() {
        when(recipientRepo.findByIdAssignmentIdIn(anyCollection()))
                .thenReturn(List.of(recipient(1, 9)));

        List<ClassAssignment> out = service.visibleTo(9L, List.of(assignment(1, "DRAFT")));

        assertThat(out).isEmpty();
    }

    @Test
    @DisplayName("AC14: bài có người nhận chỉ hiện với đúng người đó; bài không recipients = cả lớp")
    void recipients_targetOnly() {
        when(recipientRepo.findByIdAssignmentIdIn(anyCollection()))
                .thenReturn(List.of(recipient(1, 9))); // bài 1 chỉ giao học viên 9; bài 2 cả lớp

        List<ClassAssignment> both = List.of(assignment(1, "PUBLISHED"), assignment(2, "PUBLISHED"));

        assertThat(service.visibleTo(9L, both)).extracting(ClassAssignment::getId).containsExactly(1L, 2L);
        assertThat(service.visibleTo(10L, both)).extracting(ClassAssignment::getId).containsExactly(2L);
    }

    @Test
    @DisplayName("Danh sách rỗng trả rỗng, không chạm repo")
    void empty_shortCircuits() {
        assertThat(service.visibleTo(9L, List.of())).isEmpty();
    }
}
