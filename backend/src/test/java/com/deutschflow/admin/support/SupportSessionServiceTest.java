package com.deutschflow.admin.support;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.audit.AuditOrgResolver;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.security.JwtService;
import com.deutschflow.common.security.support.SupportSessionRevocationEvent;
import com.deutschflow.common.transaction.RunAfterCommitService;
import com.deutschflow.notification.NotificationType;
import com.deutschflow.notification.service.UserNotificationService;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.user.entity.RefreshToken;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.mfa.AdminMfaPolicy;
import com.deutschflow.user.repository.RefreshTokenRepository;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("SupportSessionService — mở / đổi mã / đóng phiên hỗ trợ")
class SupportSessionServiceTest {

    @Mock private SupportSessionStore store;
    @Mock private SupportSessionVerifier verifier;
    @Mock private UserRepository userRepository;
    @Mock private OrgMemberRepository orgMemberRepository;
    @Mock private RefreshTokenRepository refreshTokenRepository;
    @Mock private JwtService jwtService;
    @Mock private AuditLogService auditLogService;
    @Mock private AuditOrgResolver auditOrgResolver;
    @Mock private UserNotificationService notifications;
    @Mock private RunAfterCommitService runAfterCommit;
    @Mock private AdminMfaPolicy adminMfaPolicy;
    @Mock private PlatformTransactionManager txManager;

    private SupportSessionService service;

    private static final String REASON = "Người dùng báo lỗi không thấy bài tập";

    private static User user(long id, User.Role role, boolean active) {
        return User.builder().id(id).email("u" + id + "@df.test").displayName("U" + id).passwordHash("h")
                .role(role).locale(User.Locale.vi).active(active).build();
    }

    private final User admin = user(1L, User.Role.ADMIN, true);
    private final User student = user(9L, User.Role.STUDENT, true);

    @BeforeEach
    void setUp() {
        service = new SupportSessionService(store, verifier, userRepository, orgMemberRepository,
                refreshTokenRepository, jwtService, auditLogService, auditOrgResolver, notifications,
                runAfterCommit, adminMfaPolicy, txManager, true);
        when(adminMfaPolicy.maxSessionAge()).thenReturn(Duration.ofHours(12));
        when(userRepository.findById(1L)).thenReturn(Optional.of(admin));
        when(userRepository.findById(9L)).thenReturn(Optional.of(student));
        // RunAfterCommitService giả: chạy ngay.
        doAnswer(inv -> {
            ((Runnable) inv.getArgument(0)).run();
            return null;
        }).when(runAfterCommit).run(any());
    }

    private SupportSessionStore.SessionRow created(long id) {
        Instant now = Instant.now();
        return new SupportSessionStore.SessionRow(id, 1L, 9L, REASON, now, now.plusSeconds(1800), null, null);
    }

    @Nested
    @DisplayName("start")
    class Start {

        @Test
        @DisplayName("hợp lệ → mã bàn giao 43 ký tự base64url, DB chỉ giữ SHA-256, vết started, báo người dùng")
        void happyPath() {
            when(store.insert(eq(1L), eq(9L), eq(REASON), anyString())).thenReturn(created(77L));
            when(auditOrgResolver.forUser(9L)).thenReturn(5L);

            var r = service.start(admin, 9L, "  " + REASON + "  ");

            assertThat(r.sessionId()).isEqualTo(77L);
            assertThat(r.handoffCode()).matches("[A-Za-z0-9_-]{43}");
            ArgumentCaptor<String> hash = ArgumentCaptor.forClass(String.class);
            verify(store).insert(eq(1L), eq(9L), eq(REASON), hash.capture());
            assertThat(hash.getValue()).isEqualTo(SupportSessionService.sha256Hex(r.handoffCode()))
                    .isNotEqualTo(r.handoffCode());
            verify(store).lockAdminRow(1L);
            ArgumentCaptor<Map<String, Object>> meta = ArgumentCaptor.forClass(Map.class);
            verify(auditLogService).log(eq("support_session.started"), eq(AuditActor.of(admin)), eq("USER"),
                    eq("9"), eq(5L), meta.capture());
            assertThat(meta.getValue()).containsEntry("sessionId", 77L).containsEntry("reason", REASON);
            ArgumentCaptor<Map<String, Object>> payload = ArgumentCaptor.forClass(Map.class);
            verify(notifications).deliverToUser(eq(9L), eq(NotificationType.ADMIN_SUPPORT_VIEW), payload.capture());
            assertThat(payload.getValue()).containsKey("viewedAt").doesNotContainKey("reason")
                    .doesNotContainValue(admin.getEmail());
        }

        @Test
        @DisplayName("lý do < 15 hoặc > 500 ký tự → 400 SUPPORT_REASON_INVALID")
        void reasonLength() {
            assertCode(() -> service.start(admin, 9L, "quá ngắn"), HttpStatus.BAD_REQUEST,
                    SupportSessionException.REASON_INVALID);
            assertCode(() -> service.start(admin, 9L, null), HttpStatus.BAD_REQUEST,
                    SupportSessionException.REASON_INVALID);
            assertCode(() -> service.start(admin, 9L, "x".repeat(501)), HttpStatus.BAD_REQUEST,
                    SupportSessionException.REASON_INVALID);
            verify(store, never()).insert(anyLong(), anyLong(), anyString(), anyString());
        }

        @Test
        @DisplayName("đích là ADMIN → 403 SUPPORT_TARGET_FORBIDDEN")
        void adminTarget() {
            when(userRepository.findById(2L)).thenReturn(Optional.of(user(2L, User.Role.ADMIN, true)));
            assertCode(() -> service.start(admin, 2L, REASON), HttpStatus.FORBIDDEN,
                    SupportSessionException.TARGET_FORBIDDEN);
        }

        @Test
        @DisplayName("TEACHER / MANAGER / OWNER là đích hợp lệ")
        void nonAdminRolesAllowed() {
            for (User.Role role : List.of(User.Role.TEACHER, User.Role.MANAGER, User.Role.OWNER)) {
                when(userRepository.findById(3L)).thenReturn(Optional.of(user(3L, role, true)));
                when(store.insert(eq(1L), eq(3L), eq(REASON), anyString())).thenReturn(created(80L));
                assertThat(service.start(admin, 3L, REASON).sessionId()).isEqualTo(80L);
            }
        }

        @Test
        @DisplayName("đích bị khoá → 409 SUPPORT_TARGET_INACTIVE")
        void inactiveTarget() {
            when(userRepository.findById(3L)).thenReturn(Optional.of(user(3L, User.Role.STUDENT, false)));
            assertCode(() -> service.start(admin, 3L, REASON), HttpStatus.CONFLICT,
                    SupportSessionException.TARGET_INACTIVE);
        }

        @Test
        @DisplayName("tự xem chính mình → 403; đích không tồn tại → 404")
        void selfAndMissing() {
            assertCode(() -> service.start(admin, 1L, REASON), HttpStatus.FORBIDDEN, SupportSessionException.TARGET_SELF);
            when(userRepository.findById(404L)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> service.start(admin, 404L, REASON)).isInstanceOf(NotFoundException.class);
        }

        @Test
        @DisplayName("người gọi không phải ADMIN → 403")
        void nonAdminCaller() {
            assertCode(() -> service.start(user(5L, User.Role.TEACHER, true), 9L, REASON), HttpStatus.FORBIDDEN,
                    SupportSessionException.TARGET_FORBIDDEN);
        }

        @Test
        @DisplayName("một phiên mở / admin: phiên cũ bị đóng (replaced) + vết ended, rồi mới tạo phiên mới")
        void oneActivePerAdmin() {
            when(store.endOpenForAdmin(1L, SupportSessionService.END_REPLACED))
                    .thenReturn(List.of(new SupportSessionStore.EndedRow(70L, 1L, 4L, false)));
            when(store.insert(eq(1L), eq(9L), eq(REASON), anyString())).thenReturn(created(77L));

            service.start(admin, 9L, REASON);

            var order = org.mockito.Mockito.inOrder(store, auditLogService);
            order.verify(store).endOpenForAdmin(1L, SupportSessionService.END_REPLACED);
            order.verify(auditLogService).log(eq("support_session.ended"), any(AuditActor.class), eq("USER"), eq("4"),
                    any(), org.mockito.ArgumentMatchers.argThat(
                            (Map<String, Object> m) -> "replaced".equals(m.get("endReason"))));
            order.verify(store).insert(eq(1L), eq(9L), eq(REASON), anyString());
        }

        @Test
        @DisplayName("đã 20 phiên trong 24 giờ → 429 SUPPORT_DAILY_LIMIT, không tạo phiên")
        void dailyCap() {
            when(store.countStartedLast24h(1L)).thenReturn(20);
            assertCode(() -> service.start(admin, 9L, REASON), HttpStatus.TOO_MANY_REQUESTS,
                    SupportSessionException.DAILY_LIMIT);
            verify(store, never()).insert(anyLong(), anyLong(), anyString(), anyString());
            verify(notifications, never()).deliverToUser(anyLong(), any(), anyMap());
        }

        @Test
        @DisplayName("kill-switch tắt → 503 SUPPORT_SESSION_DISABLED")
        void disabled() {
            SupportSessionService off = new SupportSessionService(store, verifier, userRepository, orgMemberRepository,
                    refreshTokenRepository, jwtService, auditLogService, auditOrgResolver, notifications,
                    runAfterCommit, adminMfaPolicy, txManager, false);
            assertCode(() -> off.start(admin, 9L, REASON), HttpStatus.SERVICE_UNAVAILABLE,
                    SupportSessionException.DISABLED);
        }
    }

    @Nested
    @DisplayName("redeem")
    class Redeem {

        private static final String CODE = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ";

        private SupportSessionStore.HandoffRow handoff(Instant handoffExpires, Instant usedAt, Instant endedAt) {
            Instant now = Instant.now();
            return new SupportSessionStore.HandoffRow(77L, 1L, 9L, now.plusSeconds(1700), endedAt, handoffExpires,
                    usedAt, now);
        }

        private RefreshToken refresh(User owner, boolean revoked, LocalDateTime expires, Instant mfaAt) {
            return RefreshToken.builder().id(5L).user(owner).token("rt").revoked(revoked).expiresAt(expires)
                    .mfaVerifiedAt(mfaAt).build();
        }

        private void validCookie() {
            when(refreshTokenRepository.findByToken("rt")).thenReturn(Optional.of(
                    refresh(admin, false, LocalDateTime.now().plusDays(1), Instant.now().minusSeconds(60))));
        }

        @Test
        @DisplayName("hợp lệ → token support, mã bị đốt")
        void happyPath() {
            when(store.lockByHandoffHash(SupportSessionService.sha256Hex(CODE)))
                    .thenReturn(Optional.of(handoff(Instant.now().plusSeconds(30), null, null)));
            validCookie();
            when(jwtService.generateSupportToken(eq(student), any(), any(), eq(1L), eq(77L), any()))
                    .thenReturn("support.jwt");

            var r = service.redeem(CODE, "rt");

            assertThat(r.accessToken()).isEqualTo("support.jwt");
            assertThat(r.session().id()).isEqualTo(77L);
            assertThat(r.session().role()).isEqualTo("STUDENT");
            assertThat(r.session().targetEmail()).isEqualTo(student.getEmail());
            verify(store).burnHandoff(77L);
        }

        @Test
        @DisplayName("mã đã dùng (không còn hash) → 400")
        void usedCode() {
            when(store.lockByHandoffHash(anyString())).thenReturn(Optional.empty());
            assertCode(() -> service.redeem(CODE, "rt"), HttpStatus.BAD_REQUEST, SupportSessionException.HANDOFF_INVALID);
        }

        @Test
        @DisplayName("mã quá 60 s → 400, mã vẫn bị đốt")
        void expiredCode() {
            when(store.lockByHandoffHash(anyString()))
                    .thenReturn(Optional.of(handoff(Instant.now().minusSeconds(1), null, null)));
            validCookie();
            assertCode(() -> service.redeem(CODE, "rt"), HttpStatus.BAD_REQUEST, SupportSessionException.HANDOFF_INVALID);
            verify(store).burnHandoff(77L);
            verify(jwtService, never()).generateSupportToken(any(), any(), any(), anyLong(), anyLong(), any());
        }

        @Test
        @DisplayName("phiên đã đóng → 400")
        void closedSession() {
            when(store.lockByHandoffHash(anyString()))
                    .thenReturn(Optional.of(handoff(Instant.now().plusSeconds(30), null, Instant.now())));
            validCookie();
            assertCode(() -> service.redeem(CODE, "rt"), HttpStatus.BAD_REQUEST, SupportSessionException.HANDOFF_INVALID);
        }

        @Test
        @DisplayName("cookie refresh của admin KHÁC → 400 và mã bị đốt")
        void otherAdminsCookie() {
            when(store.lockByHandoffHash(anyString()))
                    .thenReturn(Optional.of(handoff(Instant.now().plusSeconds(30), null, null)));
            when(refreshTokenRepository.findByToken("rt")).thenReturn(Optional.of(refresh(
                    user(2L, User.Role.ADMIN, true), false, LocalDateTime.now().plusDays(1), Instant.now())));
            assertCode(() -> service.redeem(CODE, "rt"), HttpStatus.BAD_REQUEST, SupportSessionException.HANDOFF_INVALID);
            verify(store).burnHandoff(77L);
        }

        @Test
        @DisplayName("refresh token không có mfa_verified_at → 400")
        void refreshWithoutMfa() {
            when(store.lockByHandoffHash(anyString()))
                    .thenReturn(Optional.of(handoff(Instant.now().plusSeconds(30), null, null)));
            when(refreshTokenRepository.findByToken("rt")).thenReturn(Optional.of(
                    refresh(admin, false, LocalDateTime.now().plusDays(1), null)));
            assertCode(() -> service.redeem(CODE, "rt"), HttpStatus.BAD_REQUEST, SupportSessionException.HANDOFF_INVALID);
        }

        @Test
        @DisplayName("refresh token đã revoke / hết hạn / thiếu cookie → 400")
        void revokedExpiredMissing() {
            when(store.lockByHandoffHash(anyString()))
                    .thenReturn(Optional.of(handoff(Instant.now().plusSeconds(30), null, null)));
            when(refreshTokenRepository.findByToken("rt")).thenReturn(Optional.of(
                    refresh(admin, true, LocalDateTime.now().plusDays(1), Instant.now())));
            assertCode(() -> service.redeem(CODE, "rt"), HttpStatus.BAD_REQUEST, SupportSessionException.HANDOFF_INVALID);

            when(refreshTokenRepository.findByToken("rt")).thenReturn(Optional.of(
                    refresh(admin, false, LocalDateTime.now().minusMinutes(1), Instant.now())));
            assertCode(() -> service.redeem(CODE, "rt"), HttpStatus.BAD_REQUEST, SupportSessionException.HANDOFF_INVALID);

            assertCode(() -> service.redeem(CODE, null), HttpStatus.BAD_REQUEST, SupportSessionException.HANDOFF_INVALID);
        }

        @Test
        @DisplayName("mã rỗng → 400, không chạm DB")
        void blankCode() {
            assertCode(() -> service.redeem(" ", "rt"), HttpStatus.BAD_REQUEST, SupportSessionException.HANDOFF_INVALID);
            verify(store, never()).lockByHandoffHash(anyString());
        }
    }

    @Nested
    @DisplayName("end")
    class End {

        @Test
        @DisplayName("admin đóng → vết ended (actor = admin của phiên, target USER) + xoá cache")
        void endByAdmin() {
            when(store.endOne(77L, SupportSessionService.END_ADMIN))
                    .thenReturn(Optional.of(new SupportSessionStore.EndedRow(77L, 1L, 9L, false)));
            assertThat(service.endByAdmin(77L, admin)).isTrue();
            verify(auditLogService).log(eq("support_session.ended"), eq(AuditActor.of(admin)), eq("USER"), eq("9"),
                    any(), anyMap());
            verify(verifier).evict(77L);
        }

        @Test
        @DisplayName("phiên đã đóng → false, không ghi vết")
        void alreadyEnded() {
            when(store.endOne(77L, SupportSessionService.END_ADMIN)).thenReturn(Optional.empty());
            assertThat(service.endByAdmin(77L, admin)).isFalse();
            verify(auditLogService, never()).log(anyString(), any(AuditActor.class), anyString(), anyString(), any(),
                    anyMap());
        }

        @Test
        @DisplayName("sự kiện thu hồi (admin đăng xuất) → đóng mọi phiên của admin")
        void revocationEvent() {
            when(store.endOpenForAdmin(1L, SupportSessionService.END_ADMIN_LOGOUT))
                    .thenReturn(List.of(new SupportSessionStore.EndedRow(77L, 1L, 9L, false)));
            service.onRevocation(SupportSessionRevocationEvent.forAdmin(1L, SupportSessionService.END_ADMIN_LOGOUT));
            verify(auditLogService).log(eq("support_session.ended"), any(AuditActor.class), eq("USER"), eq("9"),
                    any(), org.mockito.ArgumentMatchers.argThat(
                            (Map<String, Object> m) -> "admin_logout".equals(m.get("endReason"))));
            verify(verifier).evict(77L);
        }

        @Test
        @DisplayName("job hết hạn → vết ended có expired=true")
        void expireJob() {
            when(store.endExpired(anyInt())).thenReturn(List.of(new SupportSessionStore.EndedRow(77L, 1L, 9L, true)));
            assertThat(service.expireOverdue()).isEqualTo(1);
            verify(auditLogService).log(eq("support_session.ended"), any(AuditActor.class), eq("USER"), eq("9"),
                    any(), org.mockito.ArgumentMatchers.argThat(
                            (Map<String, Object> m) -> Boolean.TRUE.equals(m.get("expired"))));
        }

        private static int anyInt() {
            return org.mockito.ArgumentMatchers.anyInt();
        }
    }

    private static void assertCode(org.assertj.core.api.ThrowableAssert.ThrowingCallable call, HttpStatus status,
                                   String code) {
        assertThatThrownBy(call).isInstanceOfSatisfying(SupportSessionException.class, e -> {
            assertThat(e.getStatus()).isEqualTo(status);
            assertThat(e.getCode()).isEqualTo(code);
        });
    }
}
