package com.deutschflow.user.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User implements UserDetails {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "phone_number", unique = true, length = 15)
    private String phoneNumber;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "display_name", nullable = false)
    private String displayName;

    /** URL public của ảnh đại diện tự tải lên (S3 prefix avatar/); null = chưa đặt. */
    @Column(name = "avatar_url", length = 500)
    private String avatarUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Locale locale = Locale.vi;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private boolean active = true;

    @Column(name = "notification_timezone", length = 50)
    @Builder.Default
    private String notificationTimezone = "Asia/Ho_Chi_Minh";

    // push_token identifies a DEVICE, not this account, so it is mutated out-of-band by native
    // queries (AuthService.savePushToken / clearPushToken*) whenever a device is re-assigned or a
    // session ends. updatable=false keeps Hibernate from ever writing these columns during an
    // entity merge: the @AuthenticationPrincipal is a User entity cached ~60s (JwtAuthFilter), so a
    // save(principal) on any endpoint (updateProfile/updateLocale/…) would otherwise resurrect a
    // stale token that another request already cleared — re-leaking notifications to a logged-out
    // device. Reads stay live because senders load the recipient fresh (UserNotificationService).
    @Column(name = "push_token", updatable = false)
    private String pushToken;

    @Column(name = "push_platform", length = 10, updatable = false)
    private String pushPlatform;

    /** Primary org (B2B tenant). null = không thuộc org nào — giữ nguyên hành xử B2C. */
    @Column(name = "org_id")
    private Long orgId;

    /** Self-declared teaching center for non-org (free) teachers — feeds the D11 org-sales cluster signal. */
    @Column(name = "center_name")
    private String centerName;

    /**
     * Ngày sinh — nền của mọi chốt vị thành niên (DEC-22). Xem {@code MinorPolicy}: cờ "chưa thành
     * niên" được TÍNH LÚC ĐỌC chứ không lưu cột, nên đây là nguồn sự thật duy nhất.
     *
     * <p>🪤 {@code updatable = false} CÓ CHỦ ĐÍCH, cùng lý do đã phải vá cho {@code push_token}:
     * {@code JwtAuthFilter} cache principal 60 giây, nên một {@code save(principal)} ở endpoint bất
     * kỳ sẽ ghi đè bằng ảnh chụp cũ. Ghi ngày sinh đi đường riêng có kiểm quyền và có ghi vết.
     */
    @Column(name = "birth_date", updatable = false)
    private java.time.LocalDate birthDate;

    /** Lúc ngày sinh được ghi. {@code users} không có {@code updated_at} nên không có cột này thì
     *  một lần sửa sẽ viết lại hồi tố "tuổi tại thời điểm ghi" của mọi bản ghi quá khứ. */
    @Column(name = "birth_date_recorded_at", updatable = false)
    private java.time.Instant birthDateRecordedAt;

    /** Ai ghi ngày sinh — trung tâm nhập hộ thì phải truy được về người nhập. */
    @Column(name = "birth_date_recorded_by", updatable = false)
    private Long birthDateRecordedBy;

    /** Nguồn tạo tài khoản (provenance, B2B model §2.2). Chỉ mô tả NGUỒN — KHÔNG ảnh hưởng quyền/sở hữu. */
    @Enumerated(EnumType.STRING)
    @Column(name = "created_via", length = 16)
    private CreatedVia createdVia;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return active;
    }

    /**
     * Platform identity. STUDENT/TEACHER/ADMIN are the original tiers; MANAGER/OWNER are first-class
     * org-admin identities (2026-06-22): a centre manager/owner is no longer modelled as a TEACHER.
     * They are strictly administrative — they do NOT inherit TEACHER capabilities (no role hierarchy).
     * Org-scoped authorization still flows through {@code OrgGuard} reading {@code org_members}.
     */
    public enum Role { STUDENT, TEACHER, MANAGER, OWNER, ADMIN }
    public enum Locale { vi, en, de }
    /** Provenance: nguồn tạo tài khoản. ADMIN/OWNER/MANAGER = được cấp; SELF = tự đăng ký; CSV = import roster. */
    public enum CreatedVia { ADMIN, OWNER, MANAGER, SELF, CSV }
}
