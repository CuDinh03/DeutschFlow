package com.deutschflow.interview.repository;

import com.deutschflow.interview.entity.OccupationContentStatus;
import com.deutschflow.interview.entity.OccupationQuestion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface OccupationQuestionRepository extends JpaRepository<OccupationQuestion, String> {

    List<OccupationQuestion> findByOccupationCodeAndPhaseAndStatusIn(
            String occupationCode, String phase, Collection<OccupationContentStatus> statuses);

    List<OccupationQuestion> findByOccupationCodeOrderByCreatedAtAscIdAsc(String occupationCode);

    List<OccupationQuestion> findByStatusOrderByCreatedAtAscIdAsc(OccupationContentStatus status);

    /** Có dòng nào (kể cả REJECTED) — đã sinh rồi thì không tự sinh lại. */
    boolean existsByOccupationCode(String occupationCode);

    /** Câu chưa đủ hai bản dịch (V339), trừ câu đã từ chối — hàng dịch bù theo nghề. */
    @Query("SELECT q FROM OccupationQuestion q WHERE q.status <> :rejected "
            + "AND (q.questionVi IS NULL OR q.questionEn IS NULL) ORDER BY q.occupationCode, q.createdAt, q.id")
    List<OccupationQuestion> findUntranslated(@Param("rejected") OccupationContentStatus rejected);

    /**
     * Số phiên phỏng vấn theo từng nghề — nghề được chọn nhiều duyệt trước (quyết định 6).
     * Mỗi phần tử: {@code [occupation_code, count]}.
     */
    @Query(value = "SELECT occupation_code, COUNT(*) FROM ai_speaking_sessions "
            + "WHERE occupation_code IS NOT NULL GROUP BY occupation_code", nativeQuery = true)
    List<Object[]> countSessionsByOccupation();
}
