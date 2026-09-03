package com.deutschflow.teacher.controller;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.teacher.dto.TimesheetPeriodDtos.OrgTimesheetDto;
import com.deutschflow.teacher.dto.TimesheetPeriodDtos.PeriodDto;
import com.deutschflow.teacher.dto.TimesheetPeriodDtos.ReviewRequest;
import com.deutschflow.teacher.service.TimesheetPeriodService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

/**
 * Duyệt và tổng hợp bảng công toàn tổ chức — dành cho OWNER/MANAGER.
 *
 * <p><b>Ghi chú về ranh giới:</b> {@code OrgTeachingController} tự mô tả là read-only by design —
 * mọi thao tác GHI của nghiệp vụ giảng dạy nằm ở {@code /api/v2/teacher/**}. Controller này là
 * <b>ngoại lệ ghi đầu tiên</b> trên surface {@code /api/org}, và có chủ ý: duyệt bảng công là hành
 * động của quản lý đối với dữ liệu của người khác, không thể đặt sau cổng {@code hasRole('TEACHER')}.
 * Phạm vi ghi được giới hạn chặt ở chuyển trạng thái kỳ công — không sửa được số liệu bên dưới.
 *
 * <p>Theo đúng quy ước của surface: class chỉ gắn {@code isAuthenticated()}, phân quyền thật do
 * {@code OrgGuard.assertOrgAdmin} thực hiện trong service (đọc {@code org_members} từ DB, không tin
 * claim {@code orgRole} trong JWT). {@code orgId} luôn lấy từ principal, không nhận từ client.
 *
 * <p>Dùng {@code assertOrgAdmin} (OWNER|MANAGER) chứ không phải {@code assertOrgFinance} (OWNER-only):
 * bảng công chỉ chứa SỐ BUỔI/SỐ PHÚT, không có đơn giá hay thành tiền, nên đây là dữ liệu vận hành
 * của MANAGER. Nếu sau này gắn tiền vào thì phải đổi sang {@code assertOrgFinance}.
 *
 * <p><b>Ngoại lệ: {@code /lock} là OWNER-only</b> ({@code assertOrgOwner} trong service). Khoá kỳ là
 * chữ ký chốt sổ cuối cùng — số sau đó rời hệ thống thành tiền lương — nên nó thuộc giám đốc trung
 * tâm, không phải người duyệt hằng ngày. Duyệt/trả lại vẫn là việc của MANAGER.
 */
@RestController
@RequestMapping("/api/org/timesheet")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class OrgTimesheetController {

    private final TimesheetPeriodService periodService;
    private final AuditLogService auditLogService;

    @GetMapping
    public OrgTimesheetDto summary(
            @AuthenticationPrincipal User actor,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return periodService.orgSummary(actor.getId(), requireOrgId(actor), from, to);
    }

    /** Xuất CSV cho kế toán — điểm kết thúc của luồng, vì hệ không tính tiền. */
    @GetMapping("/export.csv")
    public ResponseEntity<String> exportCsv(
            @AuthenticationPrincipal User actor,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        Long orgId = requireOrgId(actor);
        String csv = periodService.exportOrgCsv(actor.getId(), orgId, from, to);
        // Audit R-M8 (03/09/2026): xuất chấm công toàn bộ giáo viên là dữ liệu payroll-adjacent (tên
        // thật + số giờ + đơn giá). Trước đây không để lại vết nào — khác hẳn hai export PII nền tảng
        // (training-dataset, marketing leads) đã ghi vết ở B4b cùng lý do "ai đã tải, bao nhiêu, khi
        // nào". Ghi Ở CONTROLLER vì exportOrgCsv là @Transactional(readOnly=true) — audit INSERT
        // trong tx read-only sẽ nổ (đúng lý do TrainingDatasetController cũng audit ở controller).
        auditLogService.log("admin.org.timesheet.exported", AuditActor.of(actor),
                "ORG_TIMESHEET", String.valueOf(orgId),
                java.util.Map.of("from", String.valueOf(from), "to", String.valueOf(to)));
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "csv", java.nio.charset.StandardCharsets.UTF_8))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"cham-cong-" + from + "_" + to + ".csv\"")
                .body(csv);
    }

    @PostMapping("/periods/{periodId}/approve")
    public PeriodDto approve(@AuthenticationPrincipal User actor, @PathVariable Long periodId) {
        return periodService.approve(AuditActor.of(actor), requireOrgId(actor), periodId);
    }

    @PostMapping("/periods/{periodId}/reject")
    public PeriodDto reject(@AuthenticationPrincipal User actor,
                            @PathVariable Long periodId,
                            @RequestBody ReviewRequest req) {
        return periodService.reject(AuditActor.of(actor), requireOrgId(actor), periodId, req.reason());
    }

    /** OWNER-only (xem javadoc class): giám đốc trung tâm là người chốt sổ cuối cùng. */
    @PostMapping("/periods/{periodId}/lock")
    public PeriodDto lock(@AuthenticationPrincipal User actor, @PathVariable Long periodId) {
        return periodService.lock(AuditActor.of(actor), requireOrgId(actor), periodId);
    }

    /** orgId luôn từ principal — không nhận từ client để tránh giả mạo tổ chức. */
    private Long requireOrgId(User user) {
        Long orgId = user.getOrgId();
        if (orgId == null) throw new ForbiddenException("Bạn không thuộc tổ chức nào");
        return orgId;
    }
}
