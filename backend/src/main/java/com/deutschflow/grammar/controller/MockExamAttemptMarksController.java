package com.deutschflow.grammar.controller;

import com.deutschflow.grammar.dto.PracticeDtos;
import com.deutschflow.grammar.service.MockExamAttemptMarksService;
import com.deutschflow.user.entity.User;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Đánh dấu bài đọc theo lượt thi thử (đợt 2, 10/11/2026). Lúc đang thi: chỉ màu/gạch chân/gạch bỏ đáp án;
 * xem lại sau khi nộp: sửa được đủ công cụ. Luật ở {@link MockExamAttemptMarksService}.
 */
@RestController
@RequestMapping("/api/mock-exams/attempts")
@PreAuthorize("isAuthenticated()")
public class MockExamAttemptMarksController {

    private final MockExamAttemptMarksService marks;

    public MockExamAttemptMarksController(MockExamAttemptMarksService marks) {
        this.marks = marks;
    }

    /** Chưa có ⇒ gói rỗng. Lượt của người khác ⇒ 404. */
    @GetMapping("/{attemptId}/teile/{teilKey}/marks")
    public PracticeDtos.Marks marks(@PathVariable long attemptId, @PathVariable String teilKey,
                                    @AuthenticationPrincipal User user) {
        return marks.marks(user.getId(), attemptId, teilKey);
    }

    /** Ghi đè cả gói. Gói sai ⇒ 400; lượt đã huỷ ⇒ 409. */
    @PutMapping("/{attemptId}/teile/{teilKey}/marks")
    public PracticeDtos.Marks save(@PathVariable long attemptId, @PathVariable String teilKey,
                                   @RequestBody PracticeDtos.MarksRequest body,
                                   @AuthenticationPrincipal User user) {
        return marks.save(user.getId(), attemptId, teilKey, body == null ? null : body.marks());
    }
}
