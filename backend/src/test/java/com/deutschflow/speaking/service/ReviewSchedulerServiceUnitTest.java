package com.deutschflow.speaking.service;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.speaking.entity.ErrorReviewTask;
import com.deutschflow.speaking.repository.ErrorReviewTaskRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReviewSchedulerServiceUnitTest {

    @Mock
    ErrorReviewTaskRepository taskRepository;

    @InjectMocks
    ReviewSchedulerService reviewSchedulerService;

    @Test
    void onMajorObservation_ignoresBlankCode() {
        reviewSchedulerService.onMajorObservation(1L, "   ", "MAJOR");
        verify(taskRepository, never()).save(any());
    }

    @Test
    void onMajorObservation_ignoresMinorSeverity() {
        reviewSchedulerService.onMajorObservation(1L, "VERB_WORD_ORDER", "MINOR");
        verify(taskRepository, never()).save(any());
    }

    @Test
    void onMajorObservation_savesRewriteTaskForMajor() {
        ArgumentCaptor<ErrorReviewTask> cap = ArgumentCaptor.forClass(ErrorReviewTask.class);
        reviewSchedulerService.onMajorObservation(3L, "CASE_NOM_ACC", "MAJOR");
        verify(taskRepository).save(cap.capture());
        assertEquals("CASE_NOM_ACC", cap.getValue().getErrorCode());
        assertEquals("REWRITE", cap.getValue().getTaskType());
        assertEquals(3L, cap.getValue().getUserId());
    }

    @Test
    void findDueTasks_delegatesToRepository() {
        LocalDateTime now = LocalDateTime.of(2026, 5, 1, 12, 0);
        reviewSchedulerService.findDueTasks(9L, now, 5);
        verify(taskRepository).findDueTasks(9L, "PENDING", now, PageRequest.of(0, 5));
    }

    @Test
    void completeTask_throwsWhenWrongUser() {
        ErrorReviewTask t = ErrorReviewTask.builder()
                .id(99L).userId(1L).errorCode("X").taskType("REWRITE").build();
        when(taskRepository.findById(99L)).thenReturn(Optional.of(t));

        assertThrows(NotFoundException.class, () -> reviewSchedulerService.completeTask(2L, 99L, true));

        verify(taskRepository, never()).save(any());
    }
}
