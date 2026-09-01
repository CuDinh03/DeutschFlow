package com.deutschflow.teacher.curriculumimport;

import com.deutschflow.common.async.AsyncJob;
import com.deutschflow.common.async.AsyncJobService;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.teacher.curriculumimport.dto.CurriculumImportCommitRequest;
import com.deutschflow.teacher.curriculumimport.dto.CurriculumImportCommitResult;
import com.deutschflow.teacher.curriculumimport.dto.CurriculumImportConfig;
import com.deutschflow.teacher.curriculumimport.dto.CurriculumTemplateSummary;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Importing a coursebook's structure into a class's teaching plan.
 *
 * <p>The flow is deliberately two-phase. {@code POST …/preview} only ANALYSES — it returns a job
 * whose result is a draft, and touches no curriculum row. {@code POST …/commit} writes, and only
 * what the teacher sends back after reviewing. Nothing is imported without that second call.
 */
@RestController
@RequestMapping("/api/v2/teacher")
@PreAuthorize("hasRole('TEACHER')")
@RequiredArgsConstructor
public class CurriculumImportController {

    private final CurriculumTemplateCatalog templateCatalog;
    private final CurriculumImportService importService;
    private final CurriculumImportCommitService commitService;
    private final AsyncJobService asyncJobService;

    /** The managed curriculum templates a teacher can expand into a plan. */
    @GetMapping("/curriculum-templates")
    public ResponseEntity<List<CurriculumTemplateSummary>> templates() {
        return ResponseEntity.ok(templateCatalog.list());
    }

    /** Starts the analysis. 202 + a job id; the draft arrives as the job's result. */
    @PostMapping("/classes/{classId}/curriculum-imports/preview")
    public ResponseEntity<Map<String, Object>> preview(
            @AuthenticationPrincipal User user,
            @PathVariable Long classId,
            @RequestBody CurriculumImportConfig config) {
        UUID jobId = importService.startPreview(user, classId, config);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("jobId", jobId);
        body.put("status", AsyncJob.Status.PENDING.name());
        return ResponseEntity.accepted().body(body);
    }

    /**
     * Polls one preview job.
     *
     * <p>Deliberately not the shared {@code /api/async-jobs/{id}} endpoint: that one authorises any
     * authenticated caller, and a draft carries a class's teaching plan. Ownership is checked here
     * the same way the material generator checks its jobs.
     */
    @GetMapping("/classes/{classId}/curriculum-imports/jobs/{jobId}")
    public ResponseEntity<Map<String, Object>> job(
            @AuthenticationPrincipal User user,
            @PathVariable Long classId,
            @PathVariable UUID jobId) {
        AsyncJob job = asyncJobService.getJob(jobId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy tiến trình phân tích."));
        if (job.getCreatedByUserId() != null && !job.getCreatedByUserId().equals(user.getId())) {
            throw new ForbiddenException("Bạn không có quyền truy cập tiến trình này.");
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("jobId", job.getId());
        body.put("status", job.getStatus());
        body.put("resultPayload", job.getResultPayload());
        body.put("errorMessage", job.getErrorMessage());
        return ResponseEntity.ok(body);
    }

    /** Writes the approved draft. Idempotent on {@code idempotencyKey}; all-or-nothing. */
    @PostMapping("/classes/{classId}/curriculum-imports/commit")
    public ResponseEntity<CurriculumImportCommitResult> commit(
            @AuthenticationPrincipal User user,
            @PathVariable Long classId,
            @RequestBody CurriculumImportCommitRequest request) {
        return ResponseEntity.ok(commitService.commit(user, classId, request));
    }
}
