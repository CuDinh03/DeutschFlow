package com.deutschflow.ai.queue;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AiJobRepository extends JpaRepository<AiJob, Long> {

    /**
     * Claim tối đa {@code limit} job PENDING bằng FOR UPDATE SKIP LOCKED.
     * Các worker chạy song song sẽ không tranh giành cùng một job.
     */
    @Query(
        value = """
            SELECT * FROM ai_jobs
            WHERE status = 'PENDING'
              AND created_at > NOW() - make_interval(days => :maxAgeDays)
            ORDER BY created_at ASC
            LIMIT :limit
            FOR UPDATE SKIP LOCKED
            """,
        nativeQuery = true
    )
    List<AiJob> claimPendingJobs(@Param("limit") int limit, @Param("maxAgeDays") int maxAgeDays);

    /**
     * Đánh dấu FAILED mọi job còn PENDING nhưng đã quá hạn — bù cho bộ lọc tuổi ở
     * {@link #claimPendingJobs}: nếu chỉ lọc mà không dọn thì job quá hạn kẹt PENDING vĩnh viễn.
     * Điều kiện ở đây (<=) và điều kiện claim (>) bù trừ khít nhau, không để lọt khoảng nào.
     */
    @Modifying
    @Query(
        value = """
            UPDATE ai_jobs
            SET status = 'FAILED', error_msg = :reason, updated_at = NOW()
            WHERE status = 'PENDING'
              AND created_at <= NOW() - make_interval(days => :maxAgeDays)
            """,
        nativeQuery = true
    )
    int expireStalePending(@Param("maxAgeDays") int maxAgeDays, @Param("reason") String reason);

    /**
     * Đánh dấu FAILED job kẹt PROCESSING quá lâu — lease ngầm cho worker. PROCESSING chỉ được set
     * lúc claim và không có heartbeat, nên job PROCESSING mà {@code updated_at} đứng yên quá
     * {@code maxMinutes} nghĩa là worker đã chết giữa chừng (restart/deploy blue-green cắt ngang);
     * không có ai quay lại xử lý nó — trước bản vá này nó nằm PROCESSING vĩnh viễn, ngoài tầm cả
     * claim (chỉ PENDING) lẫn {@link #expireStalePending} (cũng chỉ PENDING).
     * Ngưỡng phải RỘNG hơn nhiều so với một lần xử lý thật (chấm mock dài nhất cỡ vài phút).
     */
    @Modifying
    @Query(
        value = """
            UPDATE ai_jobs
            SET status = 'FAILED', error_msg = :reason, updated_at = NOW()
            WHERE status = 'PROCESSING'
              AND updated_at <= NOW() - make_interval(mins => :maxMinutes)
            """,
        nativeQuery = true
    )
    int expireStaleProcessing(@Param("maxMinutes") int maxMinutes, @Param("reason") String reason);

    /**
     * Bulk-update status để tránh N+1 queries khi worker claim nhiều jobs.
     */
    @Modifying
    @Query("UPDATE AiJob j SET j.status = :status, j.updatedAt = CURRENT_TIMESTAMP WHERE j.id IN :ids")
    void bulkUpdateStatus(@Param("ids") List<Long> ids, @Param("status") String status);
}
