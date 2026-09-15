package com.deutschflow.common.async;

import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AsyncJobService {

    private final AsyncJobRepository asyncJobRepository;
    private final AsyncJobSseService asyncJobSseService;

    /**
     * Loại job có endpoint đọc RIÊNG kiểm phạm vi ủy quyền HIỆN TẠI (giáo viên còn dạy lớp, còn đọc được
     * tài liệu): {@code /api/v2/teacher/materials/jobs/*} và {@code .../curriculum-imports/jobs/*}.
     * {@code createdByUserId} là giá trị đóng băng lúc tạo job, nên endpoint chung không phục vụ các
     * loại này kể cả cho chính creator — tránh việc giáo viên đã bị gỡ khỏi lớp vẫn đọc lại bản nháp
     * giáo án qua đường chung. ADMIN không bị giới hạn.
     */
    static final Set<String> SCOPED_JOB_TYPES = Set.of("GENERATE_PPTX", "CURRICULUM_IMPORT_PREVIEW");

    /**
     * Tạo job nền gắn với người yêu cầu. {@code createdByUserId} là căn cứ DUY NHẤT để đường đọc
     * ({@code GET /api/async-jobs/{id}}, SSE, các endpoint job riêng) quyết định ai được xem kết quả.
     * Vì vậy không còn overload "không creator": một job vô chủ sẽ không ai đọc được ngoài ADMIN
     * (xem {@link #canRead}) — tốt hơn là để cả hệ thống đọc được nó (GAP-11).
     */
    @Transactional
    public AsyncJob createJob(String jobType, Long createdByUserId) {
        AsyncJob job = AsyncJob.builder()
                .id(UUID.randomUUID())
                .jobType(jobType)
                .status(AsyncJob.Status.PENDING.name())
                .createdByUserId(createdByUserId)
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

    /**
     * Đường đọc KHÔNG kiểm quyền — chỉ dành cho worker nội bộ và các service đã tự kiểm chủ job
     * (vd. {@code CurriculumImportService.requireOwnJob}). API người dùng phải dùng
     * {@link #getJobForUser(UUID, User)}.
     */
    @Transactional(readOnly = true)
    public Optional<AsyncJob> getJob(UUID jobId) {
        return asyncJobRepository.findById(jobId);
    }

    /**
     * Đường đọc CÓ kiểm quyền cho API người dùng: chỉ trả job khi {@code user} là chủ job hoặc ADMIN.
     * Job không tồn tại, job của người khác và job không creator đều trả rỗng để controller trả 404 —
     * không trả 403, vì 403 xác nhận job của người khác có tồn tại (cùng cách với
     * {@code CurriculumImportService.requireOwnJob}).
     */
    @Transactional(readOnly = true)
    public Optional<AsyncJob> getJobForUser(UUID jobId, User user) {
        if (user == null) {
            return Optional.empty();
        }
        return asyncJobRepository.findById(jobId)
                .filter(job -> canRead(job, user))
                .filter(job -> user.getRole() == User.Role.ADMIN || !SCOPED_JOB_TYPES.contains(job.getJobType()));
    }

    /** ADMIN đọc mọi job; người khác chỉ đọc job mình tạo. Job không creator: chỉ ADMIN. */
    public static boolean canRead(AsyncJob job, User user) {
        if (job == null || user == null) {
            return false;
        }
        if (user.getRole() == User.Role.ADMIN) {
            return true;
        }
        return job.getCreatedByUserId() != null && job.getCreatedByUserId().equals(user.getId());
    }
}
