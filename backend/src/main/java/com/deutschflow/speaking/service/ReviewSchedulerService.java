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
        scheduleTask(userId, errorCode.trim(), "REWRITE", 1, LocalDateTime.now());
    }

    @Transactional
    public void importReviewErrors(Long userId, List<String> errorCodes, String taskType) {
        if (errorCodes == null || errorCodes.isEmpty()) {
            return;
        }
        String normalizedTaskType = (taskType == null || taskType.isBlank()) ? "REWRITE" : taskType.trim().toUpperCase();
        LocalDateTime now = LocalDateTime.now();
        int offset = 0;
        for (String raw : errorCodes) {
            String code = normalizeErrorCode(raw);
            if (code.isBlank()) {
                continue;
            }
            scheduleTask(userId, code, normalizedTaskType, Math.max(1, offset == 0 ? 1 : 3), now.plusMinutes(offset * 2L));
            offset++;
        }
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
        scheduleTask(userId, task.getErrorCode(), "REWRITE", days, now);
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
        scheduleTask(userId, code, "REWRITE", nextInterval, now);
    }

    private void scheduleTask(Long userId, String errorCode, String taskType, int dueDays, LocalDateTime createdAt) {
        ErrorReviewTask task = ErrorReviewTask.builder()
                .userId(userId)
                .errorCode(errorCode)
                .taskType(taskType)
                .dueAt(createdAt.plusDays(dueDays))
                .intervalDays(dueDays)
                .status("PENDING")
                .createdAt(createdAt)
                .build();
        taskRepository.save(task);
    }

    private String normalizeErrorCode(String raw) {
        if (raw == null) {
            return "";
        }
        String code = raw.trim();
        if (code.isBlank()) {
            return "";
        }
        int pipeIdx = code.indexOf('|');
        if (pipeIdx >= 0) {
            code = code.substring(0, pipeIdx).trim();
        }
        int colonIdx = code.indexOf(':');
        if (colonIdx >= 0 && colonIdx < code.length() - 1) {
            String suffix = code.substring(colonIdx + 1).trim();
            if (!suffix.isBlank()) {
                code = suffix;
            }
        }
        return code.replaceAll("\\s+", "_").toUpperCase();
    }
}
