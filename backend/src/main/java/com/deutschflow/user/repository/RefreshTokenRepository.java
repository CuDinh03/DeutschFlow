package com.deutschflow.user.repository;

import com.deutschflow.user.entity.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {
    Optional<RefreshToken> findByToken(String token);

    /**
     * Thu hồi MỌI refresh token còn sống của một người — buộc đăng nhập lại trên mọi thiết bị
     * (access token đang lưu hành vẫn dùng được tới hết TTL ngắn của nó, xem {@code app.jwt}).
     *
     * <p>Chỉ chạm dòng {@code revoked = false} và trả về số dòng vừa thu hồi: sổ hoạt động ghi
     * "đã cắt N phiên" phải là con số thật, không phải tổng cả token đã chết từ trước. Gọi lại
     * lần hai là 0 — idempotent, kết quả cuối vẫn là mọi token đều đã revoke.
     */
    @Modifying
    @Query("UPDATE RefreshToken r SET r.revoked = true WHERE r.user.id = :userId AND r.revoked = false")
    int revokeAllByUserId(Long userId);
}
