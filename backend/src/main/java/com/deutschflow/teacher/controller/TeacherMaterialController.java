package com.deutschflow.teacher.controller;

import com.deutschflow.common.async.AsyncJob;
import com.deutschflow.common.async.AsyncJobService;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.organization.service.OrgPoolGuard;
import com.deutschflow.teacher.service.DocumentParsingService;
import com.deutschflow.teacher.service.PptxStore;
import com.deutschflow.teacher.service.TeacherLessonPlanService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/v2/teacher/materials")
@RequiredArgsConstructor
@Slf4j
public class TeacherMaterialController {

    private final TeacherLessonPlanService lessonPlanService;
    private final DocumentParsingService documentParsingService;
    private final AsyncJobService asyncJobService;
    private final com.deutschflow.common.async.AsyncJobSseService asyncJobSseService;
    private final PptxStore pptxStore;
    private final OrgPoolGuard orgPoolGuard;
    private final com.deutschflow.common.quota.FreeTierGuard freeTierGuard;

    private static final long MAX_FILE_SIZE = 20L * 1024 * 1024; // 20MB

    /**
     * Ước lượng token cho 1 lần tạo PPTX (Gemini multimodal đọc tài liệu + sinh slide) —
     * dùng để hard-cap pool token cấp-org TRƯỚC khi chạy job async. Tính nhỉnh để bảo vệ
     * biên lợi nhuận: PPTX là tính năng AI đắt nhất và không đi qua QuotaService như speaking.
     */
    private static final long PPTX_ESTIMATED_TOKENS = 40_000L;

    @PostMapping("/generate-pptx")
    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<?> generatePptxAsync(@AuthenticationPrincipal User user,
                                               @RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "File is empty"));
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            return ResponseEntity.badRequest().body(Map.of("error", "File quá lớn. Tối đa 20MB."));
        }

        String originalFilename = file.getOriginalFilename();
        if (originalFilename != null) {
            String lower = originalFilename.toLowerCase();
            if (!lower.endsWith(".pdf") && !lower.endsWith(".docx")) {
                return ResponseEntity.badRequest().body(Map.of("error", "Chỉ hỗ trợ định dạng PDF và DOCX."));
            }
        }

        // Hard-cap pool token cấp-org: chặn (429) tạo PPTX khi tổ chức đã dùng hết ngân sách
        // token AI tháng này. Giáo viên B2C / org chưa cấu hình pool luôn được cho qua.
        orgPoolGuard.assertOrgPoolAvailable(user != null ? user.getId() : null, PPTX_ESTIMATED_TOKENS);
        // Gói miễn phí (GV tự do, non-org): cap PPTX theo ngày — bảo vệ biên lợi nhuận (D6).
        freeTierGuard.assertAndConsume(
                user != null ? user.getId() : null,
                user != null ? user.getOrgId() : null,
                com.deutschflow.common.quota.FreeTierGuard.FEATURE_PPTX);

        try {
            String mimeType = documentParsingService.determineMimeType(file);
            byte[] fileBytes;

            if (mimeType != null && mimeType.contains("wordprocessingml")) {
                // Gemini 1.5 Flash không hỗ trợ file DOCX dạng inlineData,
                // do đó ta bóc tách text tĩnh và gửi dưới dạng text/plain
                String extractedText = documentParsingService.extractTextFallback(file);
                if (extractedText == null || extractedText.isEmpty()) {
                    return ResponseEntity.badRequest().body(Map.of("error", "Không thể trích xuất nội dung từ file Word"));
                }
                fileBytes = extractedText.getBytes(java.nio.charset.StandardCharsets.UTF_8);
                mimeType = "text/plain";
            } else {
                fileBytes = file.getBytes();
                // Gemini inlineData limit: ~20MB raw (base64 overhead ~33%)
                // Warn if PDF is too large for inline upload
                if (fileBytes.length > 15 * 1024 * 1024) {
                    log.warn("PDF file size {}MB may exceed Gemini inlineData limit. Consider using File API.",
                            fileBytes.length / 1024 / 1024);
                }
            }

            // Tạo AsyncJob — ghi lại owner để SSE/download check
            AsyncJob job = asyncJobService.createJob("GENERATE_PPTX", user != null ? user.getId() : null);
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
                    "message", "Processing started. Please connect to SSE at /api/v2/teacher/materials/jobs/" + jobId + "/sse for real-time updates."
            ));

        } catch (IOException e) {
            log.error("Failed to read uploaded file", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Lỗi đọc file: " + e.getMessage()));
        }
    }

    @GetMapping("/jobs/{jobId}/sse")
    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<org.springframework.web.servlet.mvc.method.annotation.SseEmitter> subscribeToJob(
            @AuthenticationPrincipal User user, @PathVariable UUID jobId) {
        assertOwnsJob(user, jobId);
        log.info("Client subscribed to SSE for AsyncJob: {}", jobId);
        org.springframework.web.servlet.mvc.method.annotation.SseEmitter emitter = asyncJobSseService.register(jobId);
        return ResponseEntity.ok()
                .header("X-Accel-Buffering", "no")
                .header("Cache-Control", "no-cache")
                .body(emitter);
    }

    @GetMapping("/jobs/{jobId}")
    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<?> getJobStatus(@AuthenticationPrincipal User user, @PathVariable UUID jobId) {
        Optional<AsyncJob> jobOpt = asyncJobService.getJob(jobId);

        if (jobOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        AsyncJob job = jobOpt.get();
        assertOwnsJob(user, job);
        return ResponseEntity.ok(Map.of(
                "jobId", job.getId(),
                "status", job.getStatus(),
                "resultPayload", job.getResultPayload() != null ? job.getResultPayload() : "",
                "errorMessage", job.getErrorMessage() != null ? job.getErrorMessage() : ""
        ));
    }

    /**
     * One-time download endpoint.
     * Trả về file PPTX từ in-memory store rồi XÓA ngay — không lưu vào DB.
     * Nếu gọi lần 2 sẽ trả 404 (đã bị xóa sau lần download đầu tiên).
     */
    @GetMapping("/jobs/{jobId}/download")
    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<byte[]> downloadPptx(@AuthenticationPrincipal User user, @PathVariable UUID jobId) {
        assertOwnsJob(user, jobId);
        PptxStore.PptxFile pptxFile = pptxStore.getAndRemove(jobId);

        if (pptxFile == null) {
            log.warn("Download requested for job {} but file not found in store (already downloaded or expired)", jobId);
            return ResponseEntity.notFound().build();
        }

        String safeFileName = pptxFile.fileName()
                .replaceAll("[^\\w\\s\\-.]", "_")
                .replaceAll("\\s+", "_");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.presentationml.presentation"));
        headers.setContentDisposition(
                ContentDisposition.attachment()
                        .filename(safeFileName, StandardCharsets.UTF_8)
                        .build());
        headers.setContentLength(pptxFile.bytes().length);

        log.info("Serving PPTX download for job {} ({} bytes) — removing from store", jobId, pptxFile.bytes().length);
        return new ResponseEntity<>(pptxFile.bytes(), headers, HttpStatus.OK);
    }

    private void assertOwnsJob(User user, UUID jobId) {
        if (user == null) return;
        asyncJobService.getJob(jobId).ifPresent(job -> assertOwnsJob(user, job));
    }

    private void assertOwnsJob(User user, AsyncJob job) {
        if (job.getCreatedByUserId() == null) return;
        if (!job.getCreatedByUserId().equals(user.getId())) {
            throw new ForbiddenException("Bạn không có quyền truy cập job này");
        }
    }
}
