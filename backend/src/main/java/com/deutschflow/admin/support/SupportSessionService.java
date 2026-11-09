package com.deutschflow.admin.support;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.audit.AuditOrgResolver;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.security.JwtService;
import com.deutschflow.common.security.support.SupportSessionContext;
import com.deutschflow.common.security.support.SupportSessionRevocationEvent;
import com.deutschflow.common.transaction.RunAfterCommitService;
import com.deutschflow.notification.NotificationType;
import com.deutschflow.notification.service.UserNotificationService;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.user.entity.RefreshToken;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.mfa.AdminMfaPolicy;
import com.deutschflow.user.repository.RefreshTokenRepository;
import com.deutschflow.user.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Phiên hỗ trợ CHỈ-ĐỌC (owner chốt 09/11/2026): ADMIN xem ứng dụng dưới danh tính một người dùng không phải ADMIN,
 * tối đa {@value SupportSessionStore#SESSION_MINUTES} phút, có lý do, người dùng được báo (thông báo + Hoạt động
 * bảo mật), không cần đồng ý.
 *
 * <p><b>Luồng:</b> tab admin gọi {@link #start} → nhận {@code handoffCode} (32 byte ngẫu nhiên, base64url; DB chỉ
 * giữ SHA-256, sống {@value SupportSessionStore#HANDOFF_SECONDS} s, dùng một lần) → mở tab mới
 * {@code /v2/support-session#code=…} → tab mới gọi {@link #redeem} kèm cookie {@code refresh_token} HttpOnly của
 * CHÍNH admin đó (Path=/api/auth nên endpoint redeem nằm dưới /api/auth). Mã lộ ra ngoài (lịch sử, log) vô dụng
 * nếu không có cookie phiên đã qua 2FA của đúng admin mở phiên.
 *
 * <p><b>Vết:</b> {@code support_session.started} / {@code support_session.ended} — actor = admin, đối tượng
 * {@code USER}/id người dùng đích (đúng khuôn mà {@code GET /api/profile/me/security-events} lọc), trung tâm bị
 * tác động = trung tâm của người dùng đích.
 */
@Slf4j
@Service
public class SupportSessionService {

    public static final String EVENT_STARTED = "support_session.started";
    public static final String EVENT_ENDED = "support_session.ended";
    public static final String EVENT_WRITE_DENIED = "support_session.write_denied";

    public static final int REASON_MIN = 15;
    public static final int REASON_MAX = 500;
    public static final int DAILY_LIMIT = 20;
    static final int HANDOFF_BYTES = 32;
    static final int EXPIRE_BATCH = 100;

    public static final String END_ADMIN = "admin_ended";
    public static final String END_SUPPORT_TAB = "support_tab_ended";
    public static final String END_REPLACED = "replaced";
    public static final String END_EXPIRED = "expired";
    public static final String END_ADMIN_LOGOUT = "admin_logout";
    public static final String END_ADMIN_ROLE_CHANGED = "admin_role_changed";
    public static final String END_ADMIN_DEACTIVATED = "admin_deactivated";
    public static final String END_ADMIN_MFA_RESET = "admin_mfa_reset";
    public static final String END_TARGET_DEACTIVATED = "target_deactivated";
    public static final String END_TARGET_ROLE_CHANGED = "target_role_changed";

    private static final SecureRandom RNG = new SecureRandom();

    public record StartResult(long sessionId, String handoffCode, Instant expiresAt) {
    }

    /** Thông tin tab hỗ trợ cần để hiện banner và định tuyến (không có lý do, không có tên admin). */
    public record SessionInfo(long id, Instant expiresAt, long targetUserId, String role, Long orgId, String orgRole,
                              String targetName, String targetEmail) {
    }

    public record RedeemResult(String accessToken, SessionInfo session) {
    }

    private final SupportSessionStore store;
    private final SupportSessionVerifier verifier;
    private final UserRepository userRepository;
    private final OrgMemberRepository orgMemberRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtService jwtService;
    private final AuditLogService auditLogService;
    private final AuditOrgResolver auditOrgResolver;
    private final UserNotificationService notifications;
    private final RunAfterCommitService runAfterCommit;
    private final AdminMfaPolicy adminMfaPolicy;
    private final TransactionTemplate tx;
    /** Transaction MỚI cho việc chạy sau commit (xem {@link #notifyTarget}). */
    private final TransactionTemplate newTx;
    private final boolean enabled;

    public SupportSessionService(SupportSessionStore store,
                                 SupportSessionVerifier verifier,
                                 UserRepository userRepository,
                                 OrgMemberRepository orgMemberRepository,
                                 RefreshTokenRepository refreshTokenRepository,
                                 JwtService jwtService,
                                 AuditLogService auditLogService,
                                 AuditOrgResolver auditOrgResolver,
                                 UserNotificationService notifications,
                                 RunAfterCommitService runAfterCommit,
                                 AdminMfaPolicy adminMfaPolicy,
                                 PlatformTransactionManager transactionManager,
                                 @Value("${app.security.support-session.enabled:true}") boolean enabled) {
        this.store = store;
        this.verifier = verifier;
        this.userRepository = userRepository;
        this.orgMemberRepository = orgMemberRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.jwtService = jwtService;
        this.auditLogService = auditLogService;
        this.auditOrgResolver = auditOrgResolver;
        this.notifications = notifications;
        this.runAfterCommit = runAfterCommit;
        this.adminMfaPolicy = adminMfaPolicy;
        this.tx = new TransactionTemplate(transactionManager);
        this.newTx = new TransactionTemplate(transactionManager);
        this.newTx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.enabled = enabled;
    }

    // ─── Bắt đầu ───────────────────────────────────────────────────────────────

    /**
     * Mở phiên: lý do {@value #REASON_MIN}–{@value #REASON_MAX} ký tự; đích tồn tại, không phải chính mình, không
     * phải ADMIN (403 {@code SUPPORT_TARGET_FORBIDDEN}), đang hoạt động (409); tối đa {@value #DAILY_LIMIT} phiên /
     * admin / 24 giờ (429). Mỗi admin chỉ một phiên mở: phiên cũ bị đóng ({@code replaced}).
     */
    public StartResult start(User admin, long targetUserId, String reasonRaw) {
        if (!enabled) {
            throw new SupportSessionException(HttpStatus.SERVICE_UNAVAILABLE, SupportSessionException.DISABLED,
                    "Chế độ xem như người dùng đang tắt.");
        }
        if (admin == null || admin.getId() == null || admin.getRole() != User.Role.ADMIN) {
            throw new SupportSessionException(HttpStatus.FORBIDDEN, SupportSessionException.TARGET_FORBIDDEN,
                    "Chỉ quản trị viên mới mở được phiên hỗ trợ.");
        }
        String reason = reasonRaw == null ? "" : reasonRaw.trim();
        if (reason.length() < REASON_MIN || reason.length() > REASON_MAX) {
            throw new SupportSessionException(HttpStatus.BAD_REQUEST, SupportSessionException.REASON_INVALID,
                    "Cần lý do " + REASON_MIN + "–" + REASON_MAX + " ký tự.");
        }
        if (admin.getId() == targetUserId) {
            throw new SupportSessionException(HttpStatus.FORBIDDEN, SupportSessionException.TARGET_SELF,
                    "Không thể mở phiên hỗ trợ cho chính mình.");
        }
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy người dùng."));
        if (target.getRole() == User.Role.ADMIN) {
            throw new SupportSessionException(HttpStatus.FORBIDDEN, SupportSessionException.TARGET_FORBIDDEN,
                    "Không thể xem như một quản trị viên.");
        }
        if (!target.isActive()) {
            throw new SupportSessionException(HttpStatus.CONFLICT, SupportSessionException.TARGET_INACTIVE,
                    "Tài khoản này đang bị khoá.");
        }
        Long touchedOrgId = auditOrgResolver.forUser(targetUserId);
        String code = newHandoffCode();
        String codeHash = sha256Hex(code);

        SupportSessionStore.SessionRow row = tx.execute(s -> {
            store.lockAdminRow(admin.getId());
            if (store.countStartedLast24h(admin.getId()) >= DAILY_LIMIT) {
                throw new SupportSessionException(HttpStatus.TOO_MANY_REQUESTS, SupportSessionException.DAILY_LIMIT,
                        "Đã đạt giới hạn " + DAILY_LIMIT + " phiên hỗ trợ trong 24 giờ.");
            }
            for (SupportSessionStore.EndedRow ended : store.endOpenForAdmin(admin.getId(), END_REPLACED)) {
                auditEnded(ended, ended.expired() ? END_EXPIRED : END_REPLACED, "admin:" + admin.getId());
            }
            SupportSessionStore.SessionRow created = store.insert(admin.getId(), targetUserId, reason, codeHash);
            Map<String, Object> meta = new LinkedHashMap<>();
            meta.put("sessionId", created.id());
            meta.put("reason", reason);
            meta.put("expiresAt", String.valueOf(created.expiresAt()));
            auditLogService.log(EVENT_STARTED, AuditActor.of(admin), "USER", String.valueOf(targetUserId),
                    touchedOrgId, meta);
            Instant viewedAt = created.startedAt() == null ? Instant.now() : created.startedAt();
            runAfterCommit.run(() -> notifyTarget(targetUserId, viewedAt, created.expiresAt()));
            return created;
        });
        log.info("[SupportSession] admin={} mở phiên {} xem userId={}", admin.getId(), row.id(), targetUserId);
        return new StartResult(row.id(), code, row.expiresAt());
    }

    private void notifyTarget(long targetUserId, Instant viewedAt, Instant expiresAt) {
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("viewedAt", viewedAt.toString());
            if (expiresAt != null) {
                payload.put("expiresAt", expiresAt.toString());
            }
            // Chạy trong afterCompletion của transaction vừa commit: tài nguyên transaction cũ VẪN gắn với thread,
            // nên save() kiểu REQUIRED sẽ "tham gia" transaction đã kết thúc và không bao giờ được commit (thông
            // báo mất trong im lặng — IT trên Postgres thật bắt được). Ép một transaction MỚI.
            newTx.executeWithoutResult(status ->
                    notifications.deliverToUser(targetUserId, NotificationType.ADMIN_SUPPORT_VIEW, payload));
        } catch (RuntimeException e) {
            log.warn("[SupportSession] Không tạo được thông báo cho userId={}: {}", targetUserId, e.getMessage());
        }
    }

    // ─── Đổi mã lấy token ──────────────────────────────────────────────────────

    private record RedeemOutcome(RedeemResult result, String failure) {
    }

    /**
     * Đổi mã bàn giao lấy token support. Hợp lệ khi: mã khớp một phiên chưa dùng mã, mã chưa quá 60 s, phiên còn
     * mở; cookie {@code refresh_token} của request là refresh token CÒN SỐNG (chưa revoke, chưa hết hạn) của ĐÚNG
     * admin mở phiên và mang {@code mfa_verified_at} (chưa quá tuổi 2FA tối đa); admin còn là ADMIN hoạt động,
     * đích còn hợp lệ. Mọi sai lệch → 400 {@code SUPPORT_HANDOFF_INVALID} (một mã, không lộ lý do). Mã khớp mà
     * sai điều kiện khác vẫn bị đốt (commit trước khi ném).
     */
    public RedeemResult redeem(String handoffCode, String refreshCookieValue) {
        if (!enabled || handoffCode == null || handoffCode.isBlank() || handoffCode.length() > 128) {
            throw handoffInvalid();
        }
        String hash = sha256Hex(handoffCode.trim());
        RedeemOutcome outcome = tx.execute(s -> {
            Optional<SupportSessionStore.HandoffRow> found = store.lockByHandoffHash(hash);
            if (found.isEmpty()) {
                return new RedeemOutcome(null, "unknown code");
            }
            SupportSessionStore.HandoffRow h = found.get();
            store.burnHandoff(h.id());
            Instant now = h.dbNow() == null ? Instant.now() : h.dbNow();
            if (h.handoffUsedAt() != null) {
                return new RedeemOutcome(null, "code already used");
            }
            if (h.handoffExpiresAt() == null || !h.handoffExpiresAt().isAfter(now)) {
                return new RedeemOutcome(null, "code expired");
            }
            if (h.endedAt() != null || h.expiresAt() == null || !h.expiresAt().isAfter(now)) {
                return new RedeemOutcome(null, "session closed");
            }
            String cookieFailure = checkAdminRefreshCookie(refreshCookieValue, h.adminUserId());
            if (cookieFailure != null) {
                return new RedeemOutcome(null, cookieFailure);
            }
            User admin = userRepository.findById(h.adminUserId()).orElse(null);
            if (admin == null || !admin.isActive() || admin.getRole() != User.Role.ADMIN) {
                return new RedeemOutcome(null, "admin no longer an active ADMIN");
            }
            User target = userRepository.findById(h.targetUserId()).orElse(null);
            if (target == null || !target.isActive() || target.getRole() == User.Role.ADMIN) {
                return new RedeemOutcome(null, "target invalid");
            }
            Long orgId = target.getOrgId();
            String orgRole = null;
            if (orgId != null) {
                orgRole = orgMemberRepository.findByIdOrgIdAndIdUserId(orgId, target.getId())
                        .filter(m -> "ACTIVE".equals(m.getStatus()))
                        .map(OrgMember::getRole)
                        .orElse(null);
            }
            String token = jwtService.generateSupportToken(target, orgId, orgRole, admin.getId(), h.id(), h.expiresAt());
            SessionInfo info = new SessionInfo(h.id(), h.expiresAt(), target.getId(), target.getRole().name(), orgId,
                    orgRole, target.getDisplayName(), target.getEmail());
            return new RedeemOutcome(new RedeemResult(token, info), null);
        });
        if (outcome == null || outcome.result() == null) {
            log.warn("[SupportSession] Redeem bị từ chối: {}", outcome == null ? "?" : outcome.failure());
            throw handoffInvalid();
        }
        log.info("[SupportSession] Phiên {} đã đổi mã lấy token", outcome.result().session().id());
        return outcome.result();
    }

    /** {@code null} khi cookie hợp lệ cho admin này; ngược lại là lý do (chỉ để log). */
    private String checkAdminRefreshCookie(String refreshCookieValue, long adminUserId) {
        if (refreshCookieValue == null || refreshCookieValue.isBlank()) {
            return "missing refresh cookie";
        }
        Optional<RefreshToken> stored = refreshTokenRepository.findByToken(refreshCookieValue);
        if (stored.isEmpty()) {
            return "unknown refresh token";
        }
        RefreshToken rt = stored.get();
        if (rt.isRevoked()) {
            return "refresh token revoked";
        }
        if (rt.getExpiresAt() == null || rt.getExpiresAt().isBefore(LocalDateTime.now())) {
            return "refresh token expired";
        }
        if (rt.getUser() == null || rt.getUser().getId() == null || rt.getUser().getId() != adminUserId) {
            return "refresh token of another user";
        }
        Instant mfaAt = rt.getMfaVerifiedAt();
        if (mfaAt == null) {
            return "refresh token without mfa_verified_at";
        }
        if (adminMfaPolicy != null && mfaAt.isBefore(Instant.now().minus(adminMfaPolicy.maxSessionAge()))) {
            return "mfa too old";
        }
        return null;
    }

    private static SupportSessionException handoffInvalid() {
        return new SupportSessionException(HttpStatus.BAD_REQUEST, SupportSessionException.HANDOFF_INVALID,
                "Liên kết phiên hỗ trợ không hợp lệ hoặc đã hết hạn. Hãy mở lại từ trang quản trị.");
    }

    // ─── Kết thúc ──────────────────────────────────────────────────────────────

    /** Admin đóng phiên từ trang quản trị (bất kỳ ADMIN nào cũng đóng được — vết ghi ai đóng). */
    public boolean endByAdmin(long sessionId, User admin) {
        return end(sessionId, END_ADMIN, "admin:" + (admin == null ? "?" : admin.getId()));
    }

    /** Tab hỗ trợ tự đóng (nút "Kết thúc" / đăng xuất trong tab hỗ trợ). */
    public boolean endFromSupportTab(SupportSessionContext ctx) {
        return ctx != null && end(ctx.sessionId(), END_SUPPORT_TAB, "support_tab");
    }

    boolean end(long sessionId, String endReason, String endedBy) {
        verifier.evict(sessionId);
        Boolean ended = tx.execute(s -> {
            Optional<SupportSessionStore.EndedRow> row = store.endOne(sessionId, endReason);
            row.ifPresent(r -> auditEnded(r, r.expired() ? END_EXPIRED : endReason, endedBy));
            evictAfterCommit(List.of(sessionId));
            return row.isPresent();
        });
        return Boolean.TRUE.equals(ended);
    }

    /** Đóng phiên khi admin đăng xuất / mất quyền / bị khoá / bị đặt lại 2FA, hoặc đích bị khoá / thành ADMIN. */
    @EventListener
    public void onRevocation(SupportSessionRevocationEvent event) {
        if (event == null) {
            return;
        }
        String reason = event.endReason() == null ? END_ADMIN : event.endReason();
        List<SupportSessionStore.EndedRow> ended = new ArrayList<>();
        if (event.adminUserId() != null) {
            ended.addAll(store.endOpenForAdmin(event.adminUserId(), reason));
        }
        if (event.targetUserId() != null) {
            ended.addAll(store.endOpenForTarget(event.targetUserId(), reason));
        }
        List<Long> ids = new ArrayList<>();
        for (SupportSessionStore.EndedRow r : ended) {
            ids.add(r.id());
            verifier.evict(r.id());
            auditEnded(r, r.expired() ? END_EXPIRED : reason, "system");
        }
        evictAfterCommit(ids);
    }

    /** Job định kỳ: đóng phiên quá hạn chưa ai đóng ({@code end_reason=expired}, vết có {@code expired=true}). */
    public int expireOverdue() {
        Integer n = tx.execute(s -> {
            List<SupportSessionStore.EndedRow> rows = store.endExpired(EXPIRE_BATCH);
            List<Long> ids = new ArrayList<>();
            for (SupportSessionStore.EndedRow r : rows) {
                ids.add(r.id());
                auditEnded(r, END_EXPIRED, "system");
            }
            evictAfterCommit(ids);
            return rows.size();
        });
        return n == null ? 0 : n;
    }

    private void auditEnded(SupportSessionStore.EndedRow row, String endReason, String endedBy) {
        User admin = userRepository.findById(row.adminUserId()).orElse(null);
        AuditActor actor = admin != null
                ? AuditActor.of(admin)
                : new AuditActor(row.adminUserId(), null, null);
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("sessionId", row.id());
        meta.put("endReason", endReason);
        meta.put("endedBy", endedBy);
        if (END_EXPIRED.equals(endReason)) {
            meta.put("expired", true);
        }
        auditLogService.log(EVENT_ENDED, actor, "USER", String.valueOf(row.targetUserId()),
                auditOrgResolver.forUser(row.targetUserId()), meta);
    }

    private void evictAfterCommit(List<Long> sessionIds) {
        if (sessionIds.isEmpty() || !TransactionSynchronizationManager.isSynchronizationActive()) {
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                sessionIds.forEach(verifier::evict);
            }
        });
    }

    // ─── Đọc ───────────────────────────────────────────────────────────────────

    public List<Map<String, Object>> listForTarget(long targetUserId) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (SupportSessionStore.SessionListRow r : store.listForTarget(targetUserId, 20)) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r.id());
            m.put("adminUserId", r.adminUserId());
            m.put("adminEmail", r.adminEmail());
            m.put("reason", r.reason());
            m.put("startedAt", r.startedAt());
            m.put("expiresAt", r.expiresAt());
            m.put("endedAt", r.endedAt());
            m.put("endReason", r.endReason());
            m.put("requestCount", r.requestCount());
            m.put("active", r.active());
            out.add(m);
        }
        return out;
    }

    // ─── Mã bàn giao ───────────────────────────────────────────────────────────

    static String newHandoffCode() {
        byte[] b = new byte[HANDOFF_BYTES];
        RNG.nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    static String sha256Hex(String value) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
