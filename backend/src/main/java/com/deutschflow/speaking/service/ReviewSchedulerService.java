package com.deutschflow.speaking.service;

import com.deutschflow.speaking.domain.GrammarErrorSeverity;
import com.deutschflow.speaking.entity.ErrorReviewTask;
import com.deutschflow.speaking.repository.ErrorReviewTaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ReviewSchedulerService {

    private final ErrorReviewTaskRepository taskRepository;

    /**
     * When the model reports a blocking or major structured error, queue a short rewrite review.
     */
    @Transactional
    public void onMajorObservation(Long userId, String errorCode, String severity) {
        if (errorCode == null || errorCode.isBlank()) {
            return;
        }
        String sev = GrammarErrorSeverity.normalizeToStored(severity);
        if (!GrammarErrorSeverity.BLOCKING.name().equals(sev) && !GrammarErrorSeverity.MAJOR.name().equals(sev)) {
            return;
        }
        LocalDateTime now = LocalDateTime.now();
        ErrorReviewTask task = ErrorReviewTask.builder()
                .userId(userId)
                .errorCode(errorCode.trim())
                .taskType("REWRITE")
                .dueAt(now.plusDays(1))
                .intervalDays(1)
                .status("PENDING")
                .createdAt(now)
                .build();
        taskRepository.save(task);
    }

    @Transactional(readOnly = true)
    public List<ErrorReviewTask> findDueTasks(Long userId, LocalDateTime now, int limit) {
        return taskRepository.findDueTasks(userId, "PENDING", now, PageRequest.of(0, limit));
    }

    @Transactional
    public void completeTask(Long userId, Long taskId, boolean passed) {
        ErrorReviewTask task = taskRepository.findById(taskId)
                .orElseThrow(() -> new com.deutschflow.common.exception.NotFoundException("Task not found"));
        if (!task.getUserId().equals(userId)) {
            throw new com.deutschflow.common.exception.NotFoundException("Task not found");
        }
        LocalDateTime now = LocalDateTime.now();
        long priorCompleted = taskRepository.countByUserIdAndErrorCodeAndStatus(
                userId, task.getErrorCode(), "COMPLETED");
        task.setStatus("COMPLETED");
        task.setCompletedAt(now);
        taskRepository.save(task);

        int nextInterval = passed
                ? (priorCompleted <= 0 ? 3 : priorCompleted == 1 ? 7 : 14)
                : 1;
        int days = passed ? nextInterval : 1;
        ErrorReviewTask follow = ErrorReviewTask.builder()
                .userId(userId)
                .errorCode(task.getErrorCode())
                .taskType("REWRITE")
                .dueAt(now.plusDays(days))
                .intervalDays(days)
                .status("PENDING")
                .createdAt(now)
                .build();
        taskRepository.save(follow);
    }

    /**
     * After grammar rows are marked RESOLVED from a repair drill, close pending review tasks and schedule follow-up.
     */
    @Transactional
    public void onRepairRecorded(Long userId, String errorCode, int rowsUpdated) {
        if (rowsUpdated <= 0 || errorCode == null || errorCode.isBlank()) {
            return;
        }
        String code = errorCode.trim();
        LocalDateTime now = LocalDateTime.now();
        long priorCompleted = taskRepository.countByUserIdAndErrorCodeAndStatus(userId, code, "COMPLETED");
        taskRepository.completePendingForUserAndCode(userId, code, now);
        int nextInterval = priorCompleted <= 0 ? 3 : priorCompleted == 1 ? 7 : 14;
        ErrorReviewTask follow = ErrorReviewTask.builder()
                .userId(userId)
                .errorCode(code)
                .taskType("REWRITE")
                .dueAt(now.plusDays(nextInterval))
                .intervalDays(nextInterval)
                .status("PENDING")
                .createdAt(now)
                .build();
        taskRepository.save(follow);
    }
}
