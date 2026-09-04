package com.deutschflow.common.audit;

import com.deutschflow.user.entity.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Audit F-M4 (03/09/2026): 32 call site của console admin truyền thẳng {@code null} làm
 * {@code actor_user_id}, nên mỗi vết chỉ có email. Hệ quả: không join được sang bảng
 * {@code users}, và một tài khoản đổi email là mọi vết cũ của họ thành mồ côi — trong khi
 * {@code JwtAuthFilter} vốn đặt principal chính là entity {@link User}, id luôn nằm sẵn ở đó.
 *
 * <p>Bài này khoá hành vi của {@link AuditActor#ofAuthentication} — chỗ duy nhất còn quyết định
 * danh tính actor cho toàn bộ các call site đó.
 */
@DisplayName("AuditActor.ofAuthentication (F-M4)")
class AuditActorTest {

    private static Authentication auth(Object principal, String... authorities) {
        return new UsernamePasswordAuthenticationToken(
                principal, null, List.of(authorities).stream().map(SimpleGrantedAuthority::new).toList());
    }

    @Test
    @DisplayName("principal là entity User → lấy được id thật, email và vai trò từ users.role")
    void realPrincipalYieldsRealId() {
        User admin = User.builder().id(7L).email("admin@x.com").displayName("Admin")
                .passwordHash("h").role(User.Role.ADMIN).build();

        AuditActor actor = AuditActor.ofAuthentication(auth(admin, "ROLE_ADMIN"));

        assertThat(actor.id()).isEqualTo(7L);
        assertThat(actor.email()).isEqualTo("admin@x.com");
        assertThat(actor.role()).isEqualTo("ADMIN");
    }

    @Test
    @DisplayName("vai trò lấy từ users.role, không phải authority đầu tiên")
    void roleComesFromTheUserRecordNotTheAuthorityList() {
        User teacher = User.builder().id(8L).email("t@x.com").displayName("T")
                .passwordHash("h").role(User.Role.TEACHER).build();

        // Authority đầu danh sách cố tình KHÔNG phải vai trò — cách cũ (authorities.iterator().next())
        // sẽ ghi "ROLE_SCOPE_X" vào cột actor_role.
        AuditActor actor = AuditActor.ofAuthentication(auth(teacher, "ROLE_SCOPE_X", "ROLE_TEACHER"));

        assertThat(actor.role()).isEqualTo("TEACHER");
    }

    @Test
    @DisplayName("principal không phải entity của mình (vd @WithMockUser) → vẫn có email + vai trò, id null")
    void foreignPrincipalFallsBackToAuthenticationFields() {
        AuditActor actor = AuditActor.ofAuthentication(auth("someone@x.com", "ROLE_ADMIN"));

        assertThat(actor.id()).isNull();
        assertThat(actor.email()).isEqualTo("someone@x.com");
        assertThat(actor.role()).isEqualTo("ROLE_ADMIN");
    }

    @Test
    @DisplayName("không có Authentication → actor rỗng, không nổ NPE")
    void nullAuthenticationIsSafe() {
        AuditActor actor = AuditActor.ofAuthentication(null);

        assertThat(actor.id()).isNull();
        assertThat(actor.email()).isNull();
        assertThat(actor.role()).isNull();
    }

    @Test
    @DisplayName("Authentication không có authority nào → vai trò null, không nổ")
    void emptyAuthoritiesIsSafe() {
        AuditActor actor = AuditActor.ofAuthentication(
                new UsernamePasswordAuthenticationToken("x@x.com", null, List.of()));

        assertThat(actor.role()).isNull();
        assertThat(actor.email()).isEqualTo("x@x.com");
    }
}
