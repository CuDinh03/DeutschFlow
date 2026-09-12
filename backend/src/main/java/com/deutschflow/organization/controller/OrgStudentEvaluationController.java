package com.deutschflow.organization.controller;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.organization.dto.OrgStudentEvaluationDto;
import com.deutschflow.organization.service.OrgGuard;
import com.deutschflow.organization.service.OrgStudentEvaluationService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Hồ sơ đánh giá của một học viên, đọc từ phía trung tâm — R12, nửa còn thiếu bên cạnh sổ phiếu
 * {@link OrgReportIssueController}. Nghiệp vụ và phạm vi nằm ở {@link OrgStudentEvaluationService};
 * ở đây chỉ hai việc: xác định quyền, và GHI VẾT mỗi lượt đọc.
 *
 * <p><b>orgId lấy từ ngữ cảnh người gọi, không nhận qua tham số</b> — cùng khuôn
 * {@link OrgMinorMessageController} và {@link OrgAuditController}. Nhận orgId từ client là mở đường
 * cho một giám đốc đoán id của trung tâm khác.
 *
 * <p><b>Ghi vết FAIL-CLOSED, cố ý</b> (đúng khuôn {@link OrgMinorMessageController}): R12 phát biểu
 * "trung tâm đọc được hồ sơ đánh giá VÀ mọi lượt đọc đều để lại vết", nên một lượt đọc không ghi
 * được vết là một lượt đọc không được phép — không bọc try/catch để nuốt lỗi. Rủi ro thấp:
 * {@code org_id} ghi vào đã được {@link OrgGuard} chứng minh là trung tâm có thật với thành viên
 * ACTIVE, nên khoá ngoại {@code audit_logs.org_id → organizations(id)} (V315) không thể vỡ vì dữ liệu.
 *
 * <p>🪤 Vết ghi ở CONTROLLER chứ không trong service: đường đọc là
 * {@code @Transactional(readOnly = true)}, mà {@code AuditLogService} dùng chung connection qua
 * {@code DataSourceUtils} ⇒ INSERT bên trong sẽ nổ <em>"cannot execute INSERT in a read-only
 * transaction"</em>.
 *
 * <p>⛔ <b>Vết mang ĐỊNH DANH và SỐ LƯỢNG, không mang ĐIỂM SỐ.</b> Sổ hoạt động là thứ mọi
 * OWNER/MANAGER của trung tâm đọc được và không xoá được (append-only); chép điểm, nhận xét hay tỉ lệ
 * chuyên cần vào đó là nhân bản đúng dữ liệu mà endpoint này đang kiểm soát, sang một nơi không ai
 * rút lại được.
 */
@RestController
@RequestMapping("/api/org/students/{studentId}")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class OrgStudentEvaluationController {

    private final OrgStudentEvaluationService evaluationService;
    private final AuditLogService auditLogService;
    private final OrgGuard orgGuard;

    /**
     * Hồ sơ đánh giá qua mọi lớp của trung tâm mà học viên này từng ghi danh.
     *
     * <p>Vết ghi SAU khi đọc xong để mang được số lớp thật sự trả về — "ai đã mở hồ sơ của học viên
     * này" và "thấy bao nhiêu lớp" là hai nửa của cùng một câu.
     */
    @GetMapping("/evaluations")
    public List<OrgStudentEvaluationDto> evaluations(@AuthenticationPrincipal User user,
                                                     @PathVariable Long studentId) {
        Long orgId = requireAdminOrg(user);
        List<OrgStudentEvaluationDto> items = evaluationService.forStudent(orgId, studentId);

        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("studentUserId", studentId);
        metadata.put("classCount", items.size());
        auditLogService.log("org.student.evaluation.read", AuditActor.of(user),
                "USER", String.valueOf(studentId), orgId, metadata);
        return items;
    }

    /** OWNER/MANAGER của đúng trung tâm trong ngữ cảnh người gọi; xác minh lại từ {@code org_members}. */
    private Long requireAdminOrg(User user) {
        Long orgId = user == null ? null : user.getOrgId();
        if (orgId == null) {
            throw new ForbiddenException("Bạn không thuộc tổ chức nào");
        }
        orgGuard.assertOrgAdmin(user.getId(), orgId);
        return orgId;
    }
}
