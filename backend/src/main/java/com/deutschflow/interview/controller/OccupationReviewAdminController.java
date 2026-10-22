package com.deutschflow.interview.controller;

import com.deutschflow.interview.dto.OccupationContentReviewRequest;
import com.deutschflow.interview.dto.OccupationReviewDto;
import com.deutschflow.interview.entity.OccupationContentStatus;
import com.deutschflow.interview.service.OccupationQuestionTranslator;
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
    private final OccupationQuestionTranslator questionTranslator;

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

    /** K4: dịch bù câu lớp nghề sinh trước V339, mỗi lượt tối đa 10 nghề; gọi lại tới khi remaining = 0. */
    @PostMapping("/translations/backfill")
    public OccupationQuestionTranslator.BackfillResult backfillTranslations(
            @RequestParam(defaultValue = "10") int limit) {
        return questionTranslator.backfill(limit);
    }
}
