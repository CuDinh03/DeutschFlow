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

    @Column(name = "push_token")
    private String pushToken;

    @Column(name = "push_platform", length = 10)
    private String pushPlatform;

    /** Primary org (B2B tenant). null = không thuộc org nào — giữ nguyên hành xử B2C. */
    @Column(name = "org_id")
    private Long orgId;

    /** Self-declared teaching center for non-org (free) teachers — feeds the D11 org-sales cluster signal. */
    @Column(name = "center_name")
    private String centerName;

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
