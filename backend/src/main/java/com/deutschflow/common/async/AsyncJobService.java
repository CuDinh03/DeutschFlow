package com.deutschflow.common.async;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AsyncJobService {

    private final AsyncJobRepository asyncJobRepository;
    private final AsyncJobSseService asyncJobSseService;

    @Transactional
    public AsyncJob createJob(String jobType) {
        AsyncJob job = AsyncJob.builder()
                .id(UUID.randomUUID())
                .jobType(jobType)
                .status(AsyncJob.Status.PENDING.name())
                .build();
        return asyncJobRepository.save(job);
    }

    @Transactional
    public void updateStatus(UUID jobId, AsyncJob.Status status) {
        asyncJobRepository.findById(jobId).ifPresent(job -> {
            job.setStatus(status.name());
            asyncJobRepository.save(job);
        });
    }

    @Transactional
    public void completeJob(UUID jobId, String resultPayload) {
        asyncJobRepository.findById(jobId).ifPresent(job -> {
            job.setStatus(AsyncJob.Status.COMPLETED.name());
            job.setResultPayload(resultPayload);
            asyncJobRepository.save(job);
            
            // Notify via SSE
            asyncJobSseService.completeJob(jobId, resultPayload);
        });
    }

    @Transactional
    public void failJob(UUID jobId, String errorMessage) {
        asyncJobRepository.findById(jobId).ifPresent(job -> {
            job.setStatus(AsyncJob.Status.FAILED.name());
            job.setErrorMessage(errorMessage);
            asyncJobRepository.save(job);
            log.error("Async Job {} failed. Error: {}", jobId, errorMessage);
            
            // Notify via SSE
            asyncJobSseService.failJob(jobId, errorMessage);
        });
    }

    @Transactional(readOnly = true)
    public Optional<AsyncJob> getJob(UUID jobId) {
        return asyncJobRepository.findById(jobId);
    }
}
