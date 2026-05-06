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
    private boolean isActive = true;

    @Column(name = "notification_timezone", length = 50)
    @Builder.Default
    private String notificationTimezone = "Asia/Ho_Chi_Minh";

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    // --- UserDetails Implementation ---

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        // Đảm bảo có prefix ROLE_ để khớp với hasRole() trong SecurityConfig
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
        return true; // Mặc định là không hết hạn
    }

    @Override
    public boolean isAccountNonLocked() {
        return true; // Mặc định là không bị khóa
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true; // Mặc định mật khẩu không hết hạn
    }

    @Override
    public boolean isEnabled() {
        return isActive;
    }

    // --- Enums ---
    public enum Role   { STUDENT, TEACHER, ADMIN }
    public enum Locale { vi, en, de }
}