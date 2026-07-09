package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.teacher.dto.CreateModuleRequest;
import com.deutschflow.teacher.dto.CurriculumModuleDto;
import com.deutschflow.teacher.dto.ReorderModulesRequest;
import com.deutschflow.teacher.dto.UpdateModuleRequest;
import com.deutschflow.teacher.entity.CurriculumModule;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.CurriculumModuleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CurriculumModuleServiceTest {

    @Mock private CurriculumModuleRepository moduleRepository;
    @Mock private ClassTeacherRepository classTeacherRepository;
    @Mock private ClassStudentRepository classStudentRepository;

    private CurriculumModuleService service;

    private static final Long TEACHER_ID = 100L;
    private static final Long STUDENT_ID = 200L;
    private static final Long CLASS_ID = 10L;
    private static final Long MODULE_ID = 1L;

    @BeforeEach
    void setUp() {
        service = new CurriculumModuleService(moduleRepository, classTeacherRepository, classStudentRepository);
    }

    @Test
    @DisplayName("create appends with next order_index and trims title")
    void create_appendsNextOrder() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);
        when(moduleRepository.findMaxOrderIndex(CLASS_ID)).thenReturn(1);
        when(moduleRepository.save(any())).thenAnswer(inv -> {
            CurriculumModule m = inv.getArgument(0);
            m.setId(MODULE_ID);
            return m;
        });

        CurriculumModuleDto dto = service.create(TEACHER_ID, CLASS_ID, new CreateModuleRequest("  Modul 1  "));

        ArgumentCaptor<CurriculumModule> captor = ArgumentCaptor.forClass(CurriculumModule.class);
        verify(moduleRepository).save(captor.capture());
        assertThat(captor.getValue().getOrderIndex()).isEqualTo(2);
        assertThat(captor.getValue().getTitle()).isEqualTo("Modul 1");
        assertThat(dto.title()).isEqualTo("Modul 1");
    }

    @Test
    @DisplayName("create rejects a blank title")
    void create_rejectsBlankTitle() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);
        assertThatThrownBy(() -> service.create(TEACHER_ID, CLASS_ID, new CreateModuleRequest("   ")))
                .isInstanceOf(BadRequestException.class);
        verify(moduleRepository, never()).save(any());
    }

    @Test
    @DisplayName("create rejects when the teacher does not own the class")
    void create_rejectsNonOwner() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(false);
        assertThatThrownBy(() -> service.create(TEACHER_ID, CLASS_ID, new CreateModuleRequest("M")))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("update rejects a module belonging to a different class")
    void update_rejectsCrossClass() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);
        CurriculumModule m = CurriculumModule.builder().id(MODULE_ID).classId(99L).orderIndex(0).title("X").build();
        when(moduleRepository.findById(MODULE_ID)).thenReturn(java.util.Optional.of(m));

        assertThatThrownBy(() -> service.update(TEACHER_ID, CLASS_ID, MODULE_ID, new UpdateModuleRequest("Y")))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("update throws when the module does not exist")
    void update_missingModule() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);
        when(moduleRepository.findById(MODULE_ID)).thenReturn(java.util.Optional.empty());

        assertThatThrownBy(() -> service.update(TEACHER_ID, CLASS_ID, MODULE_ID, new UpdateModuleRequest("Y")))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("reorder rewrites order_index according to the given list")
    void reorder_rewritesOrder() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);
        CurriculumModule a = CurriculumModule.builder().id(1L).classId(CLASS_ID).orderIndex(0).title("A").build();
        CurriculumModule b = CurriculumModule.builder().id(2L).classId(CLASS_ID).orderIndex(1).title("B").build();
        when(moduleRepository.findByClassIdOrderByOrderIndexAsc(CLASS_ID))
                .thenReturn(List.of(a, b))
                .thenReturn(List.of(b, a));
        when(moduleRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.reorder(TEACHER_ID, CLASS_ID, new ReorderModulesRequest(List.of(2L, 1L)));

        assertThat(b.getOrderIndex()).isZero();
        assertThat(a.getOrderIndex()).isEqualTo(1);
    }

    @Test
    @DisplayName("reorder rejects a mismatched id set")
    void reorder_rejectsMismatch() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);
        CurriculumModule a = CurriculumModule.builder().id(1L).classId(CLASS_ID).orderIndex(0).title("A").build();
        when(moduleRepository.findByClassIdOrderByOrderIndexAsc(CLASS_ID)).thenReturn(List.of(a));

        assertThatThrownBy(() -> service.reorder(TEACHER_ID, CLASS_ID, new ReorderModulesRequest(List.of(1L, 99L))))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("reorder rejects a duplicate id that omits another (same length) without corrupting order_index")
    void reorder_rejectsDuplicatePermutation() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);
        CurriculumModule a = CurriculumModule.builder().id(1L).classId(CLASS_ID).orderIndex(0).title("A").build();
        CurriculumModule b = CurriculumModule.builder().id(2L).classId(CLASS_ID).orderIndex(1).title("B").build();
        CurriculumModule c = CurriculumModule.builder().id(3L).classId(CLASS_ID).orderIndex(2).title("C").build();
        when(moduleRepository.findByClassIdOrderByOrderIndexAsc(CLASS_ID)).thenReturn(List.of(a, b, c));

        // [1,2,2] has the right length and only known ids, but is not a permutation (omits 3).
        assertThatThrownBy(() -> service.reorder(TEACHER_ID, CLASS_ID, new ReorderModulesRequest(List.of(1L, 2L, 2L))))
                .isInstanceOf(BadRequestException.class);
        // No order_index was mutated (guard runs before the write loop).
        assertThat(c.getOrderIndex()).isEqualTo(2);
        verify(moduleRepository, never()).save(any());
    }

    @Test
    @DisplayName("listForStudent rejects a non-member")
    void listForStudent_rejectsNonMember() {
        when(classStudentRepository.existsByIdClassIdAndIdStudentId(CLASS_ID, STUDENT_ID)).thenReturn(false);
        assertThatThrownBy(() -> service.listForStudent(STUDENT_ID, CLASS_ID))
                .isInstanceOf(NotFoundException.class);
    }
}
