package com.deutschflow.grammar.dto;

import java.util.List;
import java.util.Map;

/**
 * Body of {@code PATCH /api/mock-exams/attempts/{attemptId}/draft}.
 * <p>
 * {@code baseVersion} is the optimistic-lock token: the save only applies when it matches the
 * server's current {@code draft_version}, so a stale device can never silently overwrite a
 * newer draft (it gets 409 + the newer server draft to reconcile against instead).
 */
public record ExamDraftSaveRequest(
        Map<String, Object> answers,
        Integer sectionIndex,
        Integer questionIndex,
        Long baseVersion,
        // B3 (09/11/2026, V374): câu "đánh dấu xem lại". null (mobile/client cũ) = giữ giá trị đang lưu.
        List<String> flags) {
    public ExamDraftSaveRequest(Map<String, Object> answers, Integer sectionIndex, Integer questionIndex,
                                Long baseVersion) {
        this(answers, sectionIndex, questionIndex, baseVersion, null);
    }
}
