package com.deutschflow.teacher.controller;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.teacher.dto.ReportIssueDtos.IssueReportRequest;
import com.deutschflow.teacher.dto.ReportIssueDtos.ReportIssueDto;
import com.deutschflow.teacher.dto.ReportIssueDtos.ReportIssueSummaryDto;
import com.deutschflow.teacher.entity.StudentReportIssue;
import com.deutschflow.teacher.service.ReportIssueService;
import com.deutschflow.teacher.service.ReportPdfRenderer;
import com.deutschflow.user.entity.User;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Giáo viên phụ trách PHÁT HÀNH phiếu đánh giá gửi gia đình; giáo viên của lớp và OWNER/MANAGER của
 * trung tâm đọc lịch sử phiếu + tải PDF để tự gửi (R1: DeutschFlow không chạm địa chỉ phụ huynh).
 * Quyền chi tiết ở {@link ReportIssueService}; ở đây chỉ lọc vai nền tảng và ghi vết đường PDF.
 *
 * <p>Vết {@code report.issued} nằm TRONG giao dịch phát hành (service ghi). Riêng PDF: service là
 * {@code readOnly} nên vết {@code report.pdf_exported} ghi ở đây, FAIL-CLOSED — ghi vết hỏng thì PDF
 * không rời máy chủ (khuôn {@code OrgMinorMessageController}). Metadata mang định danh và cỡ file,
 * KHÔNG nội dung phiếu.
 */
@RestController
@RequestMapping("/api/teacher")
@PreAuthorize("hasAnyRole('TEACHER','OWNER','MANAGER')")
public class TeacherReportIssueController {

    private final ReportIssueService reportIssueService;
    private final ReportPdfRenderer pdfRenderer;
    private final AuditLogService auditLogService;
    private final String publicBaseUrl;

    public TeacherReportIssueController(ReportIssueService reportIssueService,
                                        ReportPdfRenderer pdfRenderer,
                                        AuditLogService auditLogService,
                                        @Value("${app.report.public-base-url:https://mydeutschflow.com}") String publicBaseUrl) {
        this.reportIssueService = reportIssueService;
        this.pdfRenderer = pdfRenderer;
        this.auditLogService = auditLogService;
        this.publicBaseUrl = publicBaseUrl.endsWith("/")
                ? publicBaseUrl.substring(0, publicBaseUrl.length() - 1) : publicBaseUrl;
    }

    /**
     * Phát hành (201). {@code required = false}: thân rỗng thành 400 "kỳ không hợp lệ" ở service, không 500.
     * 403 giáo viên không phụ trách / trung tâm khoá ghi ({@code ORG_READ_ONLY}); 404 học viên ngoài lớp;
     * 409 cổng đồng ý ({@code extensions.code}).
     */
    @PostMapping("/classes/{classId}/students/{studentId}/report-issues")
    @ResponseStatus(HttpStatus.CREATED)
    public ReportIssueDto issue(@AuthenticationPrincipal User user,
                                @PathVariable Long classId,
                                @PathVariable Long studentId,
                                @RequestBody(required = false) IssueReportRequest body) {
        return reportIssueService.issue(AuditActor.of(user), classId, studentId,
                body == null ? null : body.period(), body == null ? null : body.lang());
    }

    /** Lịch sử phiếu của học viên trong lớp (mọi kỳ, kể cả đã thu hồi), mới nhất trước. */
    @GetMapping("/classes/{classId}/students/{studentId}/report-issues")
    public List<ReportIssueSummaryDto> list(@AuthenticationPrincipal User user,
                                            @PathVariable Long classId,
                                            @PathVariable Long studentId) {
        return reportIssueService.listForStudentInClass(user.getId(), classId, studentId);
    }

    /**
     * PDF A4 dọc để trung tâm/giáo viên tự gửi (§5: phụ huynh chỉ In từ trang công khai, KHÔNG có nút
     * tải PDF ở phía phụ huynh — nên đường này yêu cầu đăng nhập). {@code no-store}: file mang điểm
     * của một học viên, không để proxy/trình duyệt giữ lại.
     */
    @GetMapping(value = "/report-issues/{issueId}/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    @ApiResponse(responseCode = "200", content = @Content(
            mediaType = MediaType.APPLICATION_PDF_VALUE,
            schema = @Schema(type = "string", format = "binary")))
    public ResponseEntity<byte[]> pdf(@AuthenticationPrincipal User user,
                                      @PathVariable Long issueId) throws IOException {
        StudentReportIssue issue = reportIssueService.findForExport(user.getId(), issueId);
        byte[] pdf = pdfRenderer.render(issue, publicBaseUrl + ReportIssueService.publicPathOf(issue));

        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("issueId", issue.getId());
        meta.put("classId", issue.getClassId());
        meta.put("studentUserId", issue.getStudentId());
        meta.put("orgId", issue.getOrgId());
        meta.put("period", issue.getPeriod().name());
        meta.put("lang", issue.getLang());
        meta.put("bytes", pdf.length);
        auditLogService.log(ReportIssueService.EVENT_PDF_EXPORTED, AuditActor.of(user),
                ReportIssueService.AUDIT_TARGET_TYPE, String.valueOf(issue.getId()), issue.getOrgId(), meta);

        String code = ReportIssueService.verificationCodeOf(issue.getToken());
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setCacheControl(CacheControl.noStore());
        headers.setContentDisposition(ContentDisposition.attachment()
                .filename("phieu-danh-gia-" + issue.getPeriod().name().toLowerCase() + "-" + (code == null ? issue.getId() : code) + ".pdf")
                .build());
        return new ResponseEntity<>(pdf, headers, HttpStatus.OK);
    }
}
