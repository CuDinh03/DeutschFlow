package com.deutschflow.examspeaking.repository;

import com.deutschflow.examspeaking.entity.SpeakingExamSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SpeakingExamSessionRepository extends JpaRepository<SpeakingExamSession, Long> {

    Optional<SpeakingExamSession> findByIdAndUserId(Long id, Long userId);

    List<SpeakingExamSession> findTop20ByUserIdOrderByCreatedAtDesc(Long userId);

    /** Phiên còn giữ audio của một người — dùng khi họ rút lại đồng ý hiệu chuẩn (purge). */
    List<SpeakingExamSession> findByUserIdAndRetainAudioTrue(Long userId);

    /**
     * Phiên kẹt GRADING mà job chấm đã chết: job FAILED, hoặc không còn tồn tại, hoặc phiên chẳng
     * có job id nào. Đường onFailure của worker đã flip đa số ngay lúc fail; query này cho sweep
     * định kỳ vớt phần rơi vãi (worker crash TRƯỚC saveFailed, job bị StaleAiJobExpirer đánh FAILED,
     * dữ liệu kẹt từ trước bản vá). Giới hạn tuổi tối thiểu vài phút để không đụng race với job
     * vừa enqueue xong chưa kịp claim.
     */
    @Query(
        value = """
            SELECT s.* FROM speaking_exam_sessions s
            LEFT JOIN ai_jobs j ON j.id = s.grading_job_id
            WHERE s.state = 'GRADING'
              AND s.updated_at <= NOW() - make_interval(mins => :minAgeMinutes)
              AND (s.grading_job_id IS NULL OR j.id IS NULL OR j.status = 'FAILED')
            ORDER BY s.id
            LIMIT 200
            """,
        nativeQuery = true
    )
    List<SpeakingExamSession> findStuckGradingWithDeadJob(@Param("minAgeMinutes") int minAgeMinutes);

    /**
     * Phiên GRADING mà job đã COMPLETED và kết quả ĐÃ nằm trong speaking_exam_results — di chứng
     * của bug persist không-atomic trước bản vá (result ghi xong, update session chết giữa chừng):
     * sửa đúng hướng là đẩy nốt sang RESULTS chứ không phải báo lỗi.
     */
    @Query(
        value = """
            SELECT s.* FROM speaking_exam_sessions s
            JOIN ai_jobs j ON j.id = s.grading_job_id
            JOIN speaking_exam_results r ON r.session_id = s.id
            WHERE s.state = 'GRADING'
              AND j.status = 'COMPLETED'
            ORDER BY s.id
            LIMIT 200
            """,
        nativeQuery = true
    )
    List<SpeakingExamSession> findStuckGradingWithCompletedResult();
}
