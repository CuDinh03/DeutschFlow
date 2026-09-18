package com.deutschflow.user.activation;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * Một lời mời đặt mật khẩu lần đầu (Q-09, owner chốt 14/09/2026). Sinh ra khi trung tâm nhập CSV
 * roster và dòng đó TẠO MỚI một tài khoản.
 *
 * <p><b>{@code tokenHash} là SHA-256, không phải token.</b> Bản thô tồn tại đúng một lần — trong
 * email gửi đi — và không bao giờ quay lại cơ sở dữ liệu hay log. Xem lập luận đầy đủ ở V331.
 *
 * <p><b>Dùng một lần</b> qua {@code usedAt}: đặt mật khẩu xong là liên kết chết. Không dùng cờ
 * boolean vì "lúc nào" là thứ người vận hành sẽ cần khi có khiếu nại ("em bảo chưa hề bấm").
 */
@Entity
@Table(name = "account_activation_tokens")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AccountActivationToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private Long userId;

    /** Trung tâm phát ra lời mời; NULL khi trung tâm đã bị xoá (token vẫn dùng được). */
    @Column(name = "org_id", updatable = false)
    private Long orgId;

    @Column(name = "token_hash", nullable = false, updatable = false, length = 64)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false, updatable = false)
    private Instant expiresAt;

    @Column(name = "used_at")
    private Instant usedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
