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
            ORDER BY created_at ASC
            LIMIT :limit
            FOR UPDATE SKIP LOCKED
            """,
        nativeQuery = true
    )
    List<AiJob> claimPendingJobs(@Param("limit") int limit);

    /**
     * Bulk-update status để tránh N+1 queries khi worker claim nhiều jobs.
     */
    @Modifying
    @Query("UPDATE AiJob j SET j.status = :status, j.updatedAt = CURRENT_TIMESTAMP WHERE j.id IN :ids")
    void bulkUpdateStatus(@Param("ids") List<Long> ids, @Param("status") String status);
}
