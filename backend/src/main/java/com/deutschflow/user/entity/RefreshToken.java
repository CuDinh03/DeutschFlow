package com.deutschflow.user.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "refresh_tokens")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, unique = true, length = 512)
    private String token;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(nullable = false)
    @Builder.Default
    private boolean revoked = false;

    /**
     * Lúc phiên này qua bước 2FA (V369). NULL = phiên không qua 2FA. Refresh xoay vòng CHÉP nguyên giá trị
     * sang dòng mới (không đặt lại "bây giờ"), nên tuổi 2FA của một phiên không bao giờ được gia hạn ngầm.
     */
    @Column(name = "mfa_verified_at")
    private java.time.Instant mfaVerifiedAt;
}
