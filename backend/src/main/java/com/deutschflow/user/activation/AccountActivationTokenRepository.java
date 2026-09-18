package com.deutschflow.user.activation;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface AccountActivationTokenRepository extends JpaRepository<AccountActivationToken, Long> {

    /** Đường tra DUY NHẤT lúc kích hoạt — người dùng gửi token thô, ta băm rồi tìm. */
    Optional<AccountActivationToken> findByTokenHash(String tokenHash);

    /**
     * Học viên này còn lời mời nào chưa dùng và chưa hết hạn không. Dùng để KHÔNG phát token thứ hai
     * khi trung tâm nhập lại cùng một tệp CSV.
     */
    @Query("""
            SELECT COUNT(t) > 0 FROM AccountActivationToken t
             WHERE t.userId = :userId
               AND t.usedAt IS NULL
               AND t.expiresAt > CURRENT_TIMESTAMP
            """)
    boolean hasLiveToken(@Param("userId") Long userId);

    /**
     * Vô hiệu mọi lời mời chưa dùng của một học viên. Gọi khi phát lời mời mới: một tài khoản chỉ
     * nên có ĐÚNG MỘT liên kết sống, nếu không thì thu hồi một cái không có nghĩa lý gì.
     */
    @Modifying
    @Query("""
            UPDATE AccountActivationToken t
               SET t.usedAt = CURRENT_TIMESTAMP
             WHERE t.userId = :userId AND t.usedAt IS NULL
            """)
    int invalidateLiveTokens(@Param("userId") Long userId);
}
