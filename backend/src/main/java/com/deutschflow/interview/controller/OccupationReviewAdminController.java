package com.deutschflow.interview.controller;

import com.deutschflow.interview.dto.OccupationContentReviewRequest;
import com.deutschflow.interview.dto.OccupationReviewDto;
import com.deutschflow.interview.entity.OccupationContentStatus;
import com.deutschflow.interview.service.OccupationReviewService;
import com.deutschflow.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Hàng duyệt lớp câu hỏi theo nghề (đợt 2b A + B + E). Người duyệt ngôn ngữ đọc câu hỏi và từ
 * chuyên môn do AI tạo, sửa lời nếu cần, rồi Duyệt hoặc Từ chối.
 */
@RestController
@RequestMapping("/api/admin/occupations")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class OccupationReviewAdminController {

    private final OccupationReviewService reviewService;

    @GetMapping("/review-queue")
    public List<OccupationReviewDto> queue(
            @RequestParam(defaultValue = "AI_GENERATED") OccupationContentStatus status) {
        return reviewService.queue(status);
    }

    @PostMapping("/questions/{id}/review")
    public OccupationReviewDto.QuestionItem reviewQuestion(@PathVariable String id,
                                                           @RequestBody @Valid OccupationContentReviewRequest req,
                                                           @AuthenticationPrincipal User actor) {
        return reviewService.reviewQuestion(id, req, actor);
    }

    @PostMapping("/terms/{id}/review")
    public OccupationReviewDto.TermItem reviewTerm(@PathVariable Long id,
                                                   @RequestBody @Valid OccupationContentReviewRequest req,
                                                   @AuthenticationPrincipal User actor) {
        return reviewService.reviewTerm(id, req, actor);
    }

    @PostMapping("/{code}/generate")
    public OccupationReviewDto generate(@PathVariable String code, @AuthenticationPrincipal User actor) {
        return reviewService.generate(code, actor);
    }
}
