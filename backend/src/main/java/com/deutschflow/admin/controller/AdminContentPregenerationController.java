package com.deutschflow.admin.controller;

import com.deutschflow.curriculum.service.SkillTreeContentPregenerationService;
import com.deutschflow.curriculum.service.SkillTreeContentPregenerationService.PregenerateRequest;
import com.deutschflow.curriculum.service.SkillTreeContentPregenerationService.PregenerateResult;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin: sinh TRƯỚC nội dung bài học cho các node còn rỗng (F3.4b — quyết định #15).
 *
 * <p>Gọi AI thật và chạy hàng chục giây mỗi node ⇒ chỉ ADMIN, chạy tay ngoài giờ cao điểm.
 * Luôn chạy {@code dryRun=true} trước để xem đúng những node nào sẽ bị đụng tới.
 *
 * <p>Model lấy từ tầng {@code CONTENT_BATCH} (env {@code AI_LLM_TIER_CONTENT_BATCH_MODEL}) — TÁCH
 * khỏi tầng {@code CONTENT} của đường unlock, nên đặt model chậm-mà-tốt ở đây không làm học viên
 * phải chờ. Endpoint chỉ LẤP node rỗng, không bao giờ ghi đè nội dung đã có.
 */
@RestController
@RequestMapping("/api/admin/skill-tree/pregenerate")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminContentPregenerationController {

    private final SkillTreeContentPregenerationService pregenerationService;

    /** POST — body: {industry?, cefrLevel?, limit?, dryRun?}. */
    @PostMapping
    public PregenerateResult pregenerate(@AuthenticationPrincipal User admin,
                                         @RequestBody(required = false) PregenerateRequest request) {
        return pregenerationService.run(admin.getId(),
                request == null ? new PregenerateRequest(null, null, null, true) : request);
    }
}
