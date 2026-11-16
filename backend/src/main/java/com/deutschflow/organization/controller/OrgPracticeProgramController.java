package com.deutschflow.organization.controller;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.organization.dto.PracticeProgramDtos.PracticeModeDto;
import com.deutschflow.organization.dto.PracticeProgramDtos.ProgramDto;
import com.deutschflow.organization.dto.PracticeProgramDtos.SaveRequest;
import com.deutschflow.organization.service.ClassPracticeProgramService;
import com.deutschflow.organization.service.OrgGuard;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Chương trình luyện của lớp (đặc tả luyendeu ORG-50/51) cho OWNER/MANAGER, và cờ "chỉ nói" của chính
 * học viên (ORG-65). orgId luôn lấy từ principal + kiểm lại membership trong DB; lớp khác org ⇒ 404.
 */
@RestController
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class OrgPracticeProgramController {

    private final OrgGuard orgGuard;
    private final ClassPracticeProgramService programService;

    /** 204 khi lớp chưa khai chương trình. */
    @GetMapping("/api/org/classes/{classId}/practice-program")
    public ResponseEntity<ProgramDto> get(@AuthenticationPrincipal User user, @PathVariable Long classId) {
        return programService.get(requireOrgAdmin(user), classId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PutMapping("/api/org/classes/{classId}/practice-program")
    public ProgramDto save(@AuthenticationPrincipal User user, @PathVariable Long classId,
                           @RequestBody SaveRequest req) {
        Long orgId = requireOrgAdmin(user);
        orgGuard.assertOrgWritable(orgId);
        return programService.save(orgId, classId, req, AuditActor.of(user));
    }

    /** Màn luyện nói hỏi: có ẩn ô gõ không. Không lộ lớp hay chương trình nào, chỉ một cờ. */
    @GetMapping("/api/practice-program/me")
    public PracticeModeDto me(@AuthenticationPrincipal User user) {
        return new PracticeModeDto(programService.isSpeakOnly(user.getId()));
    }

    private Long requireOrgAdmin(User user) {
        Long orgId = user.getOrgId();
        if (orgId == null) {
            throw new ForbiddenException("Bạn không thuộc tổ chức nào");
        }
        orgGuard.assertOrgAdmin(user.getId(), orgId);
        return orgId;
    }
}
