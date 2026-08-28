package com.deutschflow.user.onboarding.repository;

import com.deutschflow.user.onboarding.entity.GuestOnboardingSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface GuestOnboardingSessionRepository extends JpaRepository<GuestOnboardingSession, UUID> {

    /**
     * Gắn phiên vào một user — ATOMIC, đúng một người thắng (bất biến I-6).
     *
     * <p>Điều kiện {@code claimed_by_user_id IS NULL} nằm trong chính câu UPDATE
     * chứ không phải trong một lần đọc trước đó: hai request claim song song đều
     * đọc thấy NULL, nhưng chỉ một câu UPDATE khớp được hàng và trả về 1. Đọc rồi
     * ghi (check-then-act) là chỗ đua kinh điển và sẽ tạo hai hồ sơ.
     *
     * <p>Trả về số hàng bị đổi: 1 = thắng, 0 = đã bị người khác claim, hết hạn,
     * hoặc không tồn tại. Caller phân biệt ba ca đó bằng một lần đọc SAU khi thua.
     */
    // @Transactional ngay tại repository: @Modifying gọi ngoài transaction ném
    // TransactionRequiredException. Service đã @Transactional nên ở luồng thường nó
    // chỉ tham gia transaction sẵn có (propagation REQUIRED) — nhưng test gọi thẳng
    // repository thì không có, và đó chính là bẫy AiJobWorkerClaimIntegrationTest
    // từng dính.
    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE GuestOnboardingSession s
               SET s.claimedByUserId = :userId,
                   s.claimedAt = :now,
                   s.updatedAt = :now
             WHERE s.id = :id
               AND s.claimedByUserId IS NULL
               AND s.expiresAt > :now
            """)
    int claim(@Param("id") UUID id, @Param("userId") Long userId, @Param("now") Instant now);

    /** Phiên user này đã claim (nếu có) — để claim lại là no-op thay vì lỗi. */
    Optional<GuestOnboardingSession> findFirstByClaimedByUserId(Long userId);
}
