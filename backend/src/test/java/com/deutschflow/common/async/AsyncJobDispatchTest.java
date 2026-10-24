package com.deutschflow.common.async;

import com.deutschflow.speaking.exception.AiErrorCode;
import com.deutschflow.speaking.exception.AiServiceException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.task.TaskRejectedException;

import java.util.UUID;
import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class AsyncJobDispatchTest {

    private final AsyncJobService jobs = mock(AsyncJobService.class);
    private final UUID jobId = UUID.randomUUID();

    @Test
    @DisplayName("executor nhận việc ⇒ thân job chạy, job không bị đụng tới")
    void acceptedTask_runsAndLeavesJobAlone() {
        AtomicBoolean ran = new AtomicBoolean();

        AsyncJobDispatch.runOrFail(jobs, jobId, Runnable::run, () -> ran.set(true));

        assertThat(ran).isTrue();
        verify(jobs, never()).failJob(any(), anyString());
    }

    @Test
    @DisplayName("executor từ chối ⇒ job FAILED ngay bằng câu người đọc được, rồi ném AI_BUSY kèm Retry-After")
    void rejectedTask_failsJobThenThrowsBusy() {
        Executor full = task -> { throw new RejectedExecutionException("queue full"); };

        assertThatThrownBy(() -> AsyncJobDispatch.runOrFail(jobs, jobId, full, () -> { }))
                .isInstanceOfSatisfying(AiServiceException.class, ex -> {
                    assertThat(ex.getCode()).isEqualTo(AiErrorCode.AI_BUSY);
                    assertThat(ex.getRetryAfterSeconds()).isEqualTo(AsyncJobDispatch.BUSY_RETRY_AFTER_SECONDS);
                    assertThat(ex.getMessage()).isEqualTo(AsyncJobDispatch.BUSY_MESSAGE);
                });
        verify(jobs).failJob(jobId, AsyncJobDispatch.BUSY_MESSAGE);
    }

    @Test
    @DisplayName("TaskRejectedException của ThreadPoolTaskExecutor (Spring) cũng được bắt")
    void springTaskRejected_isHandledToo() {
        Executor full = task -> { throw new TaskRejectedException("aiExecutor full"); };

        assertThatThrownBy(() -> AsyncJobDispatch.runOrFail(jobs, jobId, full, () -> { }))
                .isInstanceOf(AiServiceException.class);
        verify(jobs).failJob(jobId, AsyncJobDispatch.BUSY_MESSAGE);
    }
}
