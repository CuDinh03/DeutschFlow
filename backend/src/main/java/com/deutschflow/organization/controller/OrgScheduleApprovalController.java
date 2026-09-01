package com.deutschflow.organization.controller;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.teacher.dto.ScheduleChangeRequestDto;
import com.deutschflow.teacher.service.ScheduleChangeRequestService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Duyệt thay đổi lịch của trung tâm (PR-5, spec §4/D13). Tách khỏi {@code OrgTeachingController}
 * (read-only by design): đây là bề mặt GHI, và người gọi hợp lệ gồm cả GIÁO VIÊN TRƯỞNG được phân
 * công (org-member role TEACHER) — không đi qua requireOrgAdmin. Quyền thật kiểm trong service:
 * assertAcademicApprover theo từng lớp, đề xuất chạm cuối tuần đòi OWNER (AC19/AC20/AC23).
 */
@RestController
@RequestMapping("/api/org/schedule/change-requests")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class OrgScheduleApprovalController {

    private final ScheduleChangeRequestService changeRequestService;

    /** Hàng chờ PENDING — đã lọc theo quyền duyệt của người xem (OWNER tất; scope CLASS lớp mình). */
    @GetMapping
    public List<ScheduleChangeRequestDto> pending(@AuthenticationPrincipal User user) {
        return changeRequestService.listPendingForOrg(user.getId(), requireOrgContext(user));
    }

    @PostMapping("/{requestId}/approve")
    public ScheduleChangeRequestDto approve(@AuthenticationPrincipal User user, @PathVariable Long requestId) {
        return changeRequestService.approve(user.getId(), requireOrgContext(user), requestId);
    }

    public record RejectBody(String reason) {}

    @PostMapping("/{requestId}/reject")
    public ScheduleChangeRequestDto reject(@AuthenticationPrincipal User user, @PathVariable Long requestId,
                                           @RequestBody RejectBody body) {
        return changeRequestService.reject(user.getId(), requireOrgContext(user), requestId,
                body == null ? null : body.reason());
    }

    /** orgId từ principal — mọi guard vai trò chi tiết nằm trong service (approver/OWNER theo lớp). */
    private Long requireOrgContext(User user) {
        Long orgId = user.getOrgId();
        if (orgId == null) {
            throw new ForbiddenException("Bạn không thuộc tổ chức nào");
        }
        return orgId;
    }
}
