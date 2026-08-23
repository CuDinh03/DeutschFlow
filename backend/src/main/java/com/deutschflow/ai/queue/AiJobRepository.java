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
     * Bulk-update status để tránh N+1 queries khi worker claim nhiều jobs.
     */
    @Modifying
    @Query("UPDATE AiJob j SET j.status = :status, j.updatedAt = CURRENT_TIMESTAMP WHERE j.id IN :ids")
    void bulkUpdateStatus(@Param("ids") List<Long> ids, @Param("status") String status);
}
