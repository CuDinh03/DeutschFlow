package com.deutschflow.teacher.controller;

import com.deutschflow.common.async.AsyncJob;
import com.deutschflow.common.async.AsyncJobService;
import com.deutschflow.teacher.service.DocumentParsingService;
import com.deutschflow.teacher.service.TeacherLessonPlanService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/teacher/materials")
@RequiredArgsConstructor
@Slf4j
public class TeacherMaterialController {

    private final TeacherLessonPlanService lessonPlanService;
    private final DocumentParsingService documentParsingService;
    private final AsyncJobService asyncJobService;
    private final com.deutschflow.common.async.AsyncJobSseService asyncJobSseService;

    @PostMapping("/generate-pptx")
    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<?> generatePptxAsync(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "File is empty"));
        }

        try {
            byte[] fileBytes = file.getBytes();
            String mimeType = documentParsingService.determineMimeType(file);

            // Tạo AsyncJob
            AsyncJob job = asyncJobService.createJob("GENERATE_PPTX");
            UUID jobId = job.getId();

            // Set MDC (Mapped Diagnostic Context)
            MDC.put("jobId", jobId.toString());
            log.info("Received request to generate PPTX from file: {}. JobId: {}", file.getOriginalFilename(), jobId);
            MDC.clear();

            // Gọi phương thức Async (Spring sẽ dùng TaskExecutor và chạy ở background)
            // LƯU Ý: Phải gọi thông qua proxy (từ một bean khác) để @Async hoạt động.
            lessonPlanService.processDocumentToPptxAsync(jobId, fileBytes, mimeType);

            return ResponseEntity.accepted().body(Map.of(
                    "jobId", jobId,
                    "status", job.getStatus(),
                    "message", "Processing started. Please connect to SSE at /api/teacher/materials/jobs/" + jobId + "/sse for real-time updates."
            ));

        } catch (IOException e) {
            log.error("Failed to read uploaded file", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Lỗi đọc file: " + e.getMessage()));
        }
    }

    @GetMapping("/jobs/{jobId}/sse")
    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    public org.springframework.web.servlet.mvc.method.annotation.SseEmitter subscribeToJob(@PathVariable UUID jobId) {
        log.info("Client subscribed to SSE for AsyncJob: {}", jobId);
        return asyncJobSseService.register(jobId);
    }

    @GetMapping("/jobs/{jobId}")
    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<?> getJobStatus(@PathVariable UUID jobId) {
        Optional<AsyncJob> jobOpt = asyncJobService.getJob(jobId);
        
        if (jobOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        
        AsyncJob job = jobOpt.get();
        return ResponseEntity.ok(Map.of(
                "jobId", job.getId(),
                "status", job.getStatus(),
                "resultPayload", job.getResultPayload() != null ? job.getResultPayload() : "",
                "errorMessage", job.getErrorMessage() != null ? job.getErrorMessage() : ""
        ));
    }
}
