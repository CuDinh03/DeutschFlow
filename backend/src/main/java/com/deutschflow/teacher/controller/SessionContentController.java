package com.deutschflow.teacher.controller;

import com.deutschflow.teacher.dto.ConfirmSessionContentsRequest;
import com.deutschflow.teacher.dto.PlanSessionContentsRequest;
import com.deutschflow.teacher.dto.SessionContentsDto;
import com.deutschflow.teacher.service.SessionContentService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Phân bổ nội dung theo buổi + xác nhận thực tế (PR-4, spec §5/AC06–AC08). Quyền lớp kiểm trong
 * service qua session→class (khuôn ClassScheduleController).
 */
@RestController
@RequestMapping("/api/v2/teacher/class-schedule/sessions/{sessionId}/contents")
@PreAuthorize("hasRole('TEACHER')")
@RequiredArgsConstructor
public class SessionContentController {

    private final SessionContentService sessionContentService;

    @GetMapping
    public SessionContentsDto list(@AuthenticationPrincipal User user, @PathVariable Long sessionId) {
        return sessionContentService.list(user.getId(), sessionId);
    }

    @PutMapping
    public SessionContentsDto plan(@AuthenticationPrincipal User user,
                                   @PathVariable Long sessionId,
                                   @RequestBody PlanSessionContentsRequest req) {
        return sessionContentService.plan(user.getId(), sessionId, req);
    }

    @PostMapping("/confirm")
    public SessionContentsDto confirm(@AuthenticationPrincipal User user,
                                      @PathVariable Long sessionId,
                                      @RequestBody ConfirmSessionContentsRequest req) {
        return sessionContentService.confirm(user.getId(), sessionId, req);
    }
}
