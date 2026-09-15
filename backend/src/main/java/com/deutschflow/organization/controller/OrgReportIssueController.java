package com.deutschflow.organization.controller;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.teacher.dto.ReportIssueDtos.ReportIssueSummaryDto;
import com.deutschflow.teacher.dto.ReportIssueDtos.RevokeReportIssueRequest;
import com.deutschflow.teacher.service.ReportIssueService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Sổ phiếu đánh giá TOÀN TRUNG TÂM (R5/R12, khuôn DEC-20 của {@link OrgCertificateRegistryController}):
 * OWNER/MANAGER xem danh sách (lọc theo lớp / học viên) và THU HỒI kèm lý do. Giáo viên vẫn là người
 * phát hành ({@code /api/teacher/...}); ở đây không có bước duyệt. orgId lấy từ principal, không nhận
 * từ client; phiếu của trung tâm khác ⇒ 404. Vết nằm trong service (cùng giao dịch với mutation).
 */
@RestController
@RequestMapping("/api/org/report-issues")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class OrgReportIssueController {

    private final ReportIssueService reportIssueService;

    /** Phong bì {@code {items, total, page, size}}; {@code classId}/{@code studentId} tuỳ chọn. */
    @GetMapping
    public Map<String, Object> list(@AuthenticationPrincipal User user,
                                    @RequestParam(required = false) Long classId,
                                    @RequestParam(required = false) Long studentId,
                                    @RequestParam(defaultValue = "0") int page,
                                    @RequestParam(defaultValue = "20") int size) {
        Long orgId = requireOrgId(user);
        return reportIssueService.listForOrg(user.getId(), orgId, classId, studentId, page, size);
    }

    /**
     * Thu hồi kèm lý do 5–300 ký tự (vào sổ hoạt động). Đã thu hồi rồi ⇒ 200 với dòng hiện tại
     * (idempotent). {@code required = false}: thân rỗng phải thành 400 "thiếu lý do", không phải 500.
     */
    @PostMapping("/{issueId}/revoke")
    public ReportIssueSummaryDto revoke(@AuthenticationPrincipal User user,
                                        @PathVariable Long issueId,
                                        @RequestBody(required = false) RevokeReportIssueRequest body) {
        Long orgId = requireOrgId(user);
        return reportIssueService.revokeByOrgAdmin(AuditActor.of(user), orgId, issueId,
                body == null ? null : body.reason());
    }

    private static Long requireOrgId(User user) {
        Long orgId = user == null ? null : user.getOrgId();
        if (orgId == null) {
            throw new ForbiddenException("Bạn không thuộc tổ chức nào");
        }
        return orgId;
    }
}
