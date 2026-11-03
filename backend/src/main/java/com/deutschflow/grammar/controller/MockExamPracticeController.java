package com.deutschflow.grammar.controller;

import com.deutschflow.common.async.AsyncJob;
import com.deutschflow.common.async.AsyncJobDispatch;
import com.deutschflow.common.async.AsyncJobService;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.grammar.dto.PracticeDtos;
import com.deutschflow.grammar.service.AiExamEvaluatorService;
import com.deutschflow.grammar.service.ExamScoringService;
import com.deutschflow.grammar.service.MockExamPracticeService;
import com.deutschflow.organization.service.OrgPoolGuard;
import com.deutschflow.user.entity.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.Executor;

/**
 * Luyện đề telc (03/11/2026). Làm từng Teil, kiểm tra xong có phân tích từng câu; Viết chấm bằng AI
 * có chỉ lỗi trong bài. Không tạo lượt thi — kết quả không vào lịch sử thi thử.
 */
@RestController
@RequestMapping("/api/mock-exams/practice")
@PreAuthorize("isAuthenticated()")
public class MockExamPracticeController {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(MockExamPracticeController.class);
    /** Chấm có chỉ lỗi dài hơn chấm thi thử (prompt + annotations + bài đã sửa). */
    private static final long WRITING_AI_ESTIMATED_TOKENS = 3_500L;
    private static final int MAX_WRITING_CHARS = 4_000;

    private final MockExamPracticeService practice;
    private final ExamScoringService scoring;
    private final AiExamEvaluatorService evaluator;
    private final AsyncJobService jobs;
    private final Executor aiExecutor;
    private final QuotaService quotaService;
    private final OrgPoolGuard orgPoolGuard;
    private final ObjectMapper om;

    public MockExamPracticeController(MockExamPracticeService practice, ExamScoringService scoring,
                                      AiExamEvaluatorService evaluator, AsyncJobService jobs,
                                      @Qualifier("aiExecutor") Executor aiExecutor, QuotaService quotaService,
                                      OrgPoolGuard orgPoolGuard, ObjectMapper om) {
        this.practice = practice;
        this.scoring = scoring;
        this.evaluator = evaluator;
        this.jobs = jobs;
        this.aiExecutor = aiExecutor;
        this.quotaService = quotaService;
        this.orgPoolGuard = orgPoolGuard;
        this.om = om;
    }

    /** Client hỏi trước khi hiện lối vào "Luyện đề" — không bao giờ 403, chỉ trả bật/tắt. */
    @GetMapping("/access")
    public PracticeDtos.Access access(@AuthenticationPrincipal User user) {
        return new PracticeDtos.Access(practice.hasAccess(user));
    }

    @GetMapping("/{examId}")
    public PracticeDtos.Overview overview(@PathVariable long examId, @AuthenticationPrincipal User user) {
        return practice.overview(user, examId);
    }

    @PutMapping("/{examId}/teile/{teilKey}/draft")
    public PracticeDtos.Progress saveDraft(@PathVariable long examId, @PathVariable String teilKey,
                                           @RequestBody PracticeDtos.SaveRequest body,
                                           @AuthenticationPrincipal User user) {
        return practice.saveDraft(user, examId, teilKey, body.answers(), body.elapsedSeconds());
    }

    @PostMapping("/{examId}/teile/{teilKey}/check")
    public PracticeDtos.Progress check(@PathVariable long examId, @PathVariable String teilKey,
                                       @RequestBody PracticeDtos.SaveRequest body,
                                       @AuthenticationPrincipal User user) {
        return practice.check(user, examId, teilKey, body.answers(), body.elapsedSeconds());
    }

    @DeleteMapping("/{examId}/teile/{teilKey}")
    public ResponseEntity<Void> reset(@PathVariable long examId, @PathVariable String teilKey,
                                      @AuthenticationPrincipal User user) {
        practice.reset(user, examId, teilKey);
        return ResponseEntity.noContent().build();
    }

    /**
     * Chấm bài Viết bằng AI: trả 202 + jobId ngay, client poll {@code GET /api/async-jobs/{id}} như
     * nộp bài thi thử. Quota kiểm đồng bộ để báo hết lượt ngay, không đợi luồng nền.
     */
    @PostMapping("/{examId}/schreiben")
    public ResponseEntity<PracticeDtos.JobAccepted> gradeWriting(@PathVariable long examId,
                                                                 @RequestBody PracticeDtos.WritingRequest body,
                                                                 @AuthenticationPrincipal User user) {
        String text = body.text() == null ? "" : body.text().trim();
        if (text.isEmpty()) throw new BadRequestException("Bài viết đang trống.");
        if (text.length() > MAX_WRITING_CHARS) throw new BadRequestException("Bài viết quá dài.");
        MockExamPracticeService.WritingTask task = practice.writingTask(user, examId, scoring);

        long uid = user.getId();
        quotaService.assertAllowed(uid, Instant.now(), WRITING_AI_ESTIMATED_TOKENS);
        orgPoolGuard.assertOrgPoolAvailable(uid, WRITING_AI_ESTIMATED_TOKENS);

        AsyncJob job = jobs.createJob("PRACTICE_SCHREIBEN", uid);
        AsyncJobDispatch.runOrFail(jobs, job.getId(), aiExecutor, () -> {
            try {
                jobs.updateStatus(job.getId(), AsyncJob.Status.PROCESSING);
                Map<String, Object> eval = evaluator.evaluateSchreibenPractice(uid, text, task.prompt(), task.level());
                practice.saveWriting(uid, examId, text, body.elapsedSeconds(), eval);
                jobs.completeJob(job.getId(), om.writeValueAsString(eval));
            } catch (Exception e) {
                jobs.failJob(job.getId(), e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName());
                log.error("[Practice] Chấm Viết lỗi exam={} uid={}: {}", examId, uid, e.getMessage(), e);
            }
        });
        return ResponseEntity.accepted().body(new PracticeDtos.JobAccepted(job.getId().toString(),
                AsyncJob.Status.PENDING.name()));
    }
}
