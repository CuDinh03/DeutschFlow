package com.deutschflow.organization.controller;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.teacher.service.RecordUnlockService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Mở khóa sửa hồi tố (PR-7, P07) — như bàn duyệt lịch: người gọi hợp lệ gồm giáo viên trưởng
 * được phân công, quyền thật kiểm trong service (assertAcademicApprover theo lớp).
 */
@RestController
@RequestMapping("/api/org/record-unlocks")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class OrgRecordUnlockController {

    private final RecordUnlockService unlockService;

    @PostMapping
    public RecordUnlockService.UnlockDto grant(@AuthenticationPrincipal User user,
                                               @RequestBody RecordUnlockService.GrantRequest req) {
        return unlockService.grant(user.getId(), requireOrgContext(user), req);
    }

    @GetMapping
    public List<RecordUnlockService.UnlockDto> listActive(@AuthenticationPrincipal User user,
                                                          @RequestParam Long classId) {
        return unlockService.listActive(user.getId(), requireOrgContext(user), classId);
    }

    private Long requireOrgContext(User user) {
        Long orgId = user.getOrgId();
        if (orgId == null) {
            throw new ForbiddenException("Bạn không thuộc tổ chức nào");
        }
        return orgId;
    }
}
