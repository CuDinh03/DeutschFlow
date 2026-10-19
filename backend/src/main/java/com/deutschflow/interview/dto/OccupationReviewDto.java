package com.deutschflow.interview.dto;

import com.deutschflow.interview.entity.OccupationQuestion;
import com.deutschflow.interview.entity.OccupationTerm;

import java.util.List;

/** Một nghề trong hàng duyệt lớp nghề (đợt 2b A + B + E): câu hỏi + từ chuyên môn đang chờ duyệt. */
public record OccupationReviewDto(
        String code,
        String nameDe,
        String nameVi,
        String workplace,
        /** Số phiên phỏng vấn đã chọn nghề này — nghề được chọn nhiều duyệt trước (quyết định 6). */
        long sessionCount,
        List<QuestionItem> questions,
        List<TermItem> terms
) {
    public record QuestionItem(String id, String topicKey, String questionDe, String difficulty,
                               String status, String sourceModel) {
        public static QuestionItem from(OccupationQuestion q) {
            return new QuestionItem(q.getId(), q.getTopicKey(), q.getQuestionDe(), q.getDifficulty(),
                    q.getStatus().name(), q.getSourceModel());
        }
    }

    public record TermItem(Long id, String termDe, String meaningEn, String meaningVi, String exampleDe,
                           String status, String sourceModel) {
        public static TermItem from(OccupationTerm t) {
            return new TermItem(t.getId(), t.getTermDe(), t.getMeaningEn(), t.getMeaningVi(), t.getExampleDe(),
                    t.getStatus().name(), t.getSourceModel());
        }
    }
}
