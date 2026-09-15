package com.deutschflow.teacher.service;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.minor.ConsentState;
import com.deutschflow.common.minor.MinorLearnerService;
import com.deutschflow.common.minor.MinorPolicy;
import com.deutschflow.common.minor.ReportIssueBlockedException;
import com.deutschflow.common.minor.StudentConsent;
import com.deutschflow.notification.NotificationType;
import com.deutschflow.notification.entity.NotificationOutbox;
import com.deutschflow.notification.repository.NotificationOutboxRepository;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.organization.service.OrgGuard;
import com.deutschflow.teacher.dto.ReportIssueDtos.PublicReportIssueDto;
import com.deutschflow.teacher.dto.ReportIssueDtos.ReportIssueDto;
import com.deutschflow.teacher.dto.ReportIssueDtos.ReportIssueSummaryDto;
import com.deutschflow.teacher.entity.ClassStudentId;
import com.deutschflow.teacher.entity.StudentReportIssue;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.StudentReportIssueRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Phát hành / thu hồi / mở link phiếu đánh giá gửi gia đình (PR-R2, thiết kế 10/09/2026 §3.2).
 *
 * <p><b>Quyền (R5, khuôn DEC-20):</b> giáo viên PHỤ TRÁCH lớp phát hành ({@link TeacherService#assertPrimaryTeacherOfClass});
 * OWNER/MANAGER của trung tâm xem sổ và thu hồi ({@link OrgGuard#assertOrgAdmin}); đường GHI (phát hành,
 * thu hồi) đi qua {@link OrgGuard#assertOrgWritable} — trung tâm bị đình chỉ / hết hạn không phát hành
 * thêm phiếu nào. Học viên xem đúng bản đã gửi của mình (R6).
 *
 * <p><b>Cổng đồng ý (R6, §3.5.1):</b> tuổi tính TỪ DB qua {@link MinorLearnerService#statusOf} (không
 * từ principal cache 60 giây); {@code isMinor()} ⇒ đòi {@code GUARDIAN_REPORT_SHARING} GRANTED còn hiệu
 * lực; {@code UNKNOWN} ⇒ fail-closed. Người ≥ 18 không cần đồng ý của ai.
 *
 * <p><b>Bất biến (R2):</b> phát hành lại cùng kỳ = dòng MỚI, dòng cũ {@code SUPERSEDED} — link cũ chết
 * ngay, phiếu cũ vẫn đọc được trong sổ trung tâm. Không có "sửa phiếu".
 *
 * <p><b>Token (R9):</b> {@value #TOKEN_BYTES} byte {@link SecureRandom} → 40 ký tự hex (160 bit) — kín
 * đúng {@code VARCHAR(40)} của V323 (thiết kế §3.5.3 nói 32 hex ≈ 128 bit; cột cho phép rộng hơn nên
 * lấy hết). TTL {@value #TOKEN_TTL_DAYS} ngày. Trang công khai trả MỘT thông điệp 404 cho cả ba ca sai /
 * hết hạn / thu hồi ({@link #NOT_FOUND_MESSAGE}) — không oracle.
 *
 * <p><b>Vết (DEC-13):</b> {@value #EVENT_ISSUED} / {@value #EVENT_REVOKED} / {@value #EVENT_VIEWED} ghi
 * TRONG giao dịch ghi của chính thao tác (issue/revoke/openByToken đều là transaction ghi, nên vết
 * và mutation cùng commit, cùng rollback — fail-closed đúng nghĩa: không ghi được vết thì lượt xem không
 * xảy ra). {@code org_id} của vết = org ĐÓNG BĂNG trên phiếu (org của LỚP), truyền tường minh qua
 * {@code touchedOrgId} — giáo viên đa trung tâm không làm vết rơi nhầm sổ. Metadata chỉ mang định danh,
 * KHÔNG điểm, KHÔNG nhận xét. Đường PDF là readOnly ⇒ vết ghi ở controller.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ReportIssueService {

    public static final String EVENT_ISSUED = "report.issued";
    public static final String EVENT_REVOKED = "report.revoked";
    public static final String EVENT_VIEWED = "report.viewed";
    public static final String EVENT_PDF_EXPORTED = "report.pdf_exported";
    public static final String AUDIT_TARGET_TYPE = "STUDENT_REPORT_ISSUE";

    public static final int TOKEN_TTL_DAYS = 30;
    public static final Duration TOKEN_TTL = Duration.ofDays(TOKEN_TTL_DAYS);
    /** 20 byte ⇒ 40 hex — đúng chiều dài cột {@code token VARCHAR(40)}. */
    static final int TOKEN_BYTES = 20;
    static final int VERIFICATION_CODE_LENGTH = 8;
    /** Đường web của trang công khai (PR-R3 render {@code /phieu/[token]}). */
    public static final String PUBLIC_PATH_PREFIX = "/phieu/";

    static final int REASON_MIN_LENGTH = 5;
    static final int REASON_MAX_LENGTH = 300;
    static final int MAX_PAGE_SIZE = 100;

    /** MỘT thông điệp cho sai / hết hạn / thu hồi — xem javadoc lớp. */
    static final String NOT_FOUND_MESSAGE = "Không tìm thấy phiếu, hoặc link đã hết hạn / đã được thu hồi.";

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final HexFormat HEX = HexFormat.of();

    private final StudentReportIssueRepository issueRepository;
    private final TeacherService teacherService;
    private final TeacherClassRepository classRepository;
    private final ClassStudentRepository classStudentRepository;
    private final ClassTeacherRepository classTeacherRepository;
    private final UserRepository userRepository;
    private final OrganizationRepository organizationRepository;
    private final OrgGuard orgGuard;
    private final MinorLearnerService minorLearnerService;
    private final ReportPayloadBuilder payloadBuilder;
    private final AuditLogService auditLogService;
    private final NotificationOutboxRepository outboxRepository;

    // ── Phát hành ─────────────────────────────────────────────────────────────

    /**
     * Giáo viên phụ trách phát hành phiếu kỳ {@code periodRaw} bằng ngôn ngữ {@code langRaw} cho một học
     * viên của lớp. Thứ tự kiểm: đầu vào (400) → quyền lớp (403) → trạng thái trung tâm (403
     * ORG_READ_ONLY) → học viên thuộc lớp (404) → cổng đồng ý (409). Học viên ACTIVE/RESERVED/ENDED đều
     * phát hành được (dữ liệu giữ — D2).
     */
    @Transactional
    public ReportIssueDto issue(AuditActor actor, Long classId, Long studentId, String periodRaw, String langRaw) {
        Long actorId = actor == null ? null : actor.id();
        if (actorId == null) {
            throw new BadRequestException("Thiếu người phát hành");
        }
        StudentReportIssue.Period period = parsePeriod(periodRaw);
        String lang = parseLang(langRaw);

        teacherService.assertPrimaryTeacherOfClass(actorId, classId);
        TeacherClass cls = classRepository.findById(classId)
                .orElseThrow(() -> new NotFoundException("Lớp học không tồn tại"));
        if (cls.getOrgId() != null) {
            orgGuard.assertOrgWritable(cls.getOrgId());
        }
        if (!classStudentRepository.existsById(new ClassStudentId(classId, studentId))) {
            throw new NotFoundException("Học viên không thuộc lớp này");
        }
        User student = userRepository.findById(studentId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy học viên"));

        assertGuardianSharingAllowed(studentId);

        String orgName = null;
        String orgLogoUrl = null;
        if (cls.getOrgId() != null) {
            Organization org = organizationRepository.findById(cls.getOrgId()).orElse(null);
            if (org != null) {
                orgName = org.getName();
                orgLogoUrl = org.getLogoUrl();
            }
        }
        User issuer = userRepository.findById(actorId).orElse(null);
        Instant now = Instant.now();

        Map<String, Object> payload = payloadBuilder.build(cls, student, period, lang, now, orgName, orgLogoUrl);

        // R2: phát hành lại cùng kỳ ⇒ dòng cũ SUPERSEDED (hệ thống tự thu hồi, revoked_by NULL).
        List<StudentReportIssue> previous = issueRepository
                .findByClassIdAndStudentIdAndPeriodAndRevokedAtIsNull(classId, studentId, period);
        for (StudentReportIssue old : previous) {
            if (old.revoke(null, StudentReportIssue.REVOKE_SUPERSEDED, now)) {
                issueRepository.save(old);
            }
        }

        StudentReportIssue saved = issueRepository.save(StudentReportIssue.builder()
                .classId(classId)
                .studentId(studentId)
                .orgId(cls.getOrgId())
                .period(period)
                .lang(lang)
                .payload(payload)
                .orgNameSnapshot(truncate(orgName, 160))
                .orgLogoUrlSnapshot(truncate(orgLogoUrl, 512))
                .studentNameSnapshot(truncate(displayNameOf(student), 160))
                .issuedBy(actorId)
                .issuedByNameSnapshot(issuer == null ? null : truncate(displayNameOf(issuer), 160))
                .issuedAt(now)
                .token(newToken())
                .tokenExpiresAt(now.plus(TOKEN_TTL))
                .build());

        enqueueStudentNotification(saved, cls.getName());

        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("by", "TEACHER");
        meta.put("supersededCount", previous.size());
        audit(EVENT_ISSUED, actor, saved, meta);

        log.info("[report-issue] issued id={} class={} student={} period={} lang={} superseded={}",
                saved.getId(), classId, studentId, period, lang, previous.size());
        return new ReportIssueDto(toSummary(saved, now), saved.getPayload());
    }

    /**
     * Cổng đồng ý — xem javadoc lớp. Tách package-private để unit test chốt đủ bốn nhóm tuổi × ba
     * trạng thái đồng ý mà không cần Postgres.
     */
    void assertGuardianSharingAllowed(Long studentId) {
        MinorPolicy.Status status = minorLearnerService.statusOf(studentId);
        if (status == MinorPolicy.Status.UNKNOWN) {
            throw new ReportIssueBlockedException(
                    ReportIssueBlockedException.Reason.BIRTH_DATE_REQUIRED, status,
                    "Học viên chưa có ngày sinh trong hồ sơ nên chưa xác định được có cần đồng ý của người "
                            + "giám hộ hay không. Trung tâm bổ sung ngày sinh vào hồ sơ học viên trước khi phát hành phiếu.");
        }
        if (!status.isMinor()) {
            return;
        }
        ConsentState consent = minorLearnerService.consentStatus(studentId, StudentConsent.Scope.GUARDIAN_REPORT_SHARING);
        if (consent.isEffective()) {
            return;
        }
        log.warn("[report-issue] chặn phát hành cho studentId={} (nhóm tuổi={}, đồng ý={})", studentId, status, consent);
        if (consent == ConsentState.REVOKED) {
            throw new ReportIssueBlockedException(
                    ReportIssueBlockedException.Reason.GUARDIAN_REPORT_CONSENT_REVOKED, status,
                    "Đồng ý chia sẻ phiếu đánh giá với người giám hộ của học viên này đã được thu hồi. "
                            + "Chỉ phát hành lại khi người giám hộ chủ động cấp lại đồng ý tại trung tâm.");
        }
        throw new ReportIssueBlockedException(
                ReportIssueBlockedException.Reason.GUARDIAN_REPORT_CONSENT_REQUIRED, status,
                "Trung tâm chưa ghi nhận đồng ý chia sẻ phiếu đánh giá với người giám hộ của học viên này. "
                        + "Ghi nhận phiếu đồng ý (GUARDIAN_REPORT_SHARING) trước khi phát hành.");
    }

    // ── Đọc cho giáo viên / trung tâm ────────────────────────────────────────

    /** Lịch sử phiếu (mọi kỳ, kể cả đã thu hồi) của một học viên trong lớp — giáo viên của lớp HOẶC OWNER/MANAGER của trung tâm lớp. */
    @Transactional(readOnly = true)
    public List<ReportIssueSummaryDto> listForStudentInClass(Long viewerId, Long classId, Long studentId) {
        assertCanReadClassReports(viewerId, classId);
        Instant now = Instant.now();
        return issueRepository.findByClassIdAndStudentIdOrderByIssuedAtDesc(classId, studentId).stream()
                .map(i -> toSummary(i, now))
                .toList();
    }

    /** Sổ phiếu toàn trung tâm (R5/R12) — OWNER/MANAGER; phong bì {@code {items,total,page,size}} như sổ chứng nhận. */
    @Transactional(readOnly = true)
    public Map<String, Object> listForOrg(Long viewerId, Long orgId, Long classId, Long studentId, int page, int size) {
        orgGuard.assertOrgAdmin(viewerId, orgId);
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int safePage = Math.max(page, 0);
        Instant now = Instant.now();
        Page<StudentReportIssue> found = issueRepository.searchByOrg(orgId, classId, studentId, PageRequest.of(safePage, safeSize));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("items", found.getContent().stream().map(i -> toSummary(i, now)).toList());
        out.put("total", found.getTotalElements());
        out.put("page", safePage);
        out.put("size", safeSize);
        return out;
    }

    /**
     * Phiếu để XUẤT PDF — giáo viên của lớp hoặc OWNER/MANAGER của trung tâm phiếu (org đóng băng).
     * Phiếu đã thu hồi vẫn xuất được (sổ của trung tâm; PDF in dòng "đã thu hồi"). Vết ghi ở controller.
     */
    @Transactional(readOnly = true)
    public StudentReportIssue findForExport(Long viewerId, Long issueId) {
        StudentReportIssue issue = issueRepository.findById(issueId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy phiếu"));
        boolean classTeacher = classTeacherRepository.existsByIdClassIdAndIdTeacherId(issue.getClassId(), viewerId);
        if (!classTeacher && !isOrgAdmin(viewerId, issue.getOrgId())) {
            throw new ForbiddenException("Bạn không có quyền với phiếu này");
        }
        return issue;
    }

    // ── Thu hồi ───────────────────────────────────────────────────────────────

    /**
     * OWNER/MANAGER thu hồi kèm lý do (R5). Phiếu phải thuộc đúng trung tâm (khác ⇒ 404). Đã thu hồi
     * rồi ⇒ trả dòng hiện tại, không ghi vết lần hai (idempotent 200). Mã thu hồi = vai org của người
     * thu hồi; lý do văn tự vào metadata vết.
     */
    @Transactional
    public ReportIssueSummaryDto revokeByOrgAdmin(AuditActor actor, Long orgId, Long issueId, String reason) {
        String cleanReason = normalizeReason(reason);
        Long actorId = actor == null ? null : actor.id();
        orgGuard.assertOrgAdmin(actorId, orgId);
        OrgMember member = orgGuard.assertMember(actorId, orgId);
        orgGuard.assertOrgWritable(orgId);

        StudentReportIssue issue = issueRepository.findByIdAndOrgId(issueId, orgId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy phiếu"));
        Instant now = Instant.now();
        if (issue.isRevoked()) {
            return toSummary(issue, now);
        }
        String code = "OWNER".equals(member.getRole())
                ? StudentReportIssue.REVOKE_BY_OWNER : StudentReportIssue.REVOKE_BY_MANAGER;
        issue.revoke(actorId, code, now);
        StudentReportIssue saved = issueRepository.save(issue);

        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("by", code);
        meta.put("reason", cleanReason);
        audit(EVENT_REVOKED, actor, saved, meta);
        return toSummary(saved, now);
    }

    // ── Trang công khai ───────────────────────────────────────────────────────

    /**
     * Phụ huynh mở link: đúng token, chưa thu hồi, chưa hết hạn ⇒ payload + tăng lượt xem (nguyên tử) +
     * vết {@value #EVENT_VIEWED} — cả ba trong MỘT giao dịch (fail-closed, xem javadoc lớp). Mọi ca khác
     * ⇒ 404 với {@link #NOT_FOUND_MESSAGE}. Token không đúng hình dạng (không phải 40 hex) không chạm DB.
     */
    @Transactional
    public PublicReportIssueDto openByToken(String token) {
        if (!looksLikeToken(token)) {
            throw new NotFoundException(NOT_FOUND_MESSAGE);
        }
        Instant now = Instant.now();
        StudentReportIssue issue = issueRepository.findActiveByToken(token, now)
                .orElseThrow(() -> new NotFoundException(NOT_FOUND_MESSAGE));
        issueRepository.recordView(issue.getId(), now);

        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("channel", "PUBLIC_LINK");
        audit(EVENT_VIEWED, new AuditActor(null, null, null), issue, meta);

        return new PublicReportIssueDto(
                issue.getPeriod().name(),
                issue.getLang(),
                issue.getIssuedAt(),
                issue.getTokenExpiresAt(),
                issue.getOrgNameSnapshot(),
                issue.getOrgLogoUrlSnapshot(),
                issue.getStudentNameSnapshot(),
                issue.getIssuedByNameSnapshot(),
                verificationCodeOf(issue.getToken()),
                issue.getPayload());
    }

    // ── Học viên (R6) ────────────────────────────────────────────────────────

    /** Phiếu của CHÍNH học viên, mọi trạng thái, mới nhất trước — đọc từ payload đã đóng băng. */
    @Transactional(readOnly = true)
    public List<ReportIssueDto> listForStudent(Long studentUserId) {
        Instant now = Instant.now();
        return issueRepository.findByStudentIdOrderByIssuedAtDesc(studentUserId).stream()
                .map(i -> new ReportIssueDto(toSummary(i, now), i.getPayload()))
                .toList();
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    public static String publicPathOf(StudentReportIssue issue) {
        return PUBLIC_PATH_PREFIX + issue.getToken() + "?lang=" + issue.getLang();
    }

    public static String verificationCodeOf(String token) {
        if (token == null || token.length() < VERIFICATION_CODE_LENGTH) {
            return null;
        }
        return token.substring(0, VERIFICATION_CODE_LENGTH).toUpperCase(Locale.ROOT);
    }

    static boolean looksLikeToken(String token) {
        if (token == null || token.length() != TOKEN_BYTES * 2) {
            return false;
        }
        for (int i = 0; i < token.length(); i++) {
            char c = token.charAt(i);
            boolean hex = (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f');
            if (!hex) {
                return false;
            }
        }
        return true;
    }

    static String newToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        RANDOM.nextBytes(bytes);
        return HEX.formatHex(bytes);
    }

    ReportIssueSummaryDto toSummary(StudentReportIssue i, Instant now) {
        StudentReportIssue.Status status = i.statusAt(now);
        boolean active = status == StudentReportIssue.Status.ACTIVE;
        String className = null;
        Object cls = i.getPayload() == null ? null : i.getPayload().get("class");
        if (cls instanceof Map<?, ?> m && m.get("name") != null) {
            className = String.valueOf(m.get("name"));
        }
        return new ReportIssueSummaryDto(
                i.getId(),
                i.getClassId(),
                className,
                i.getStudentId(),
                i.getStudentNameSnapshot(),
                i.getPeriod().name(),
                i.getLang(),
                status.name(),
                i.getIssuedAt(),
                i.getIssuedByNameSnapshot(),
                i.getTokenExpiresAt(),
                i.getRevokedAt(),
                i.getRevokeReason(),
                i.getViewCount(),
                i.getLastViewedAt(),
                active ? i.getToken() : null,
                active ? publicPathOf(i) : null,
                verificationCodeOf(i.getToken()));
    }

    private void assertCanReadClassReports(Long viewerId, Long classId) {
        if (classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, viewerId)) {
            return;
        }
        Long orgId = classRepository.findById(classId).map(TeacherClass::getOrgId).orElse(null);
        if (!isOrgAdmin(viewerId, orgId)) {
            throw new ForbiddenException("Bạn không có quyền xem phiếu của lớp này");
        }
    }

    private boolean isOrgAdmin(Long userId, Long orgId) {
        if (userId == null || orgId == null) {
            return false;
        }
        try {
            orgGuard.assertOrgAdmin(userId, orgId);
            return true;
        } catch (ForbiddenException ex) {
            return false;
        }
    }

    /** Thông báo cho học viên (R6/D5) qua outbox trong CÙNG giao dịch — không điểm, không nhận xét. */
    private void enqueueStudentNotification(StudentReportIssue issue, String className) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("issueId", issue.getId());
        payload.put("classId", issue.getClassId());
        payload.put("className", className);
        payload.put("period", issue.getPeriod().name());
        payload.put("lang", issue.getLang());
        payload.put("publicPath", publicPathOf(issue));
        outboxRepository.save(NotificationOutbox.builder()
                .dedupKey("report-issue:" + issue.getId())
                .notificationType(NotificationType.REPORT_ISSUED)
                .classId(issue.getClassId())
                .recipientId(issue.getStudentId())
                .payload(payload)
                .build());
    }

    /** Vết: định danh + phần gọi thêm; org = org ĐÓNG BĂNG của phiếu. KHÔNG tên, KHÔNG điểm, KHÔNG nội dung. */
    private void audit(String event, AuditActor actor, StudentReportIssue issue, Map<String, Object> extra) {
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("issueId", issue.getId());
        meta.put("classId", issue.getClassId());
        meta.put("studentUserId", issue.getStudentId());
        meta.put("orgId", issue.getOrgId());
        meta.put("period", issue.getPeriod().name());
        meta.put("lang", issue.getLang());
        meta.putAll(extra);
        auditLogService.log(event, actor, AUDIT_TARGET_TYPE, String.valueOf(issue.getId()), issue.getOrgId(), meta);
    }

    static StudentReportIssue.Period parsePeriod(String raw) {
        try {
            return StudentReportIssue.Period.valueOf(raw == null ? "" : raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Kỳ phát hành không hợp lệ (MIDTERM | FINAL)");
        }
    }

    static String parseLang(String raw) {
        if (raw == null || raw.isBlank()) {
            return StudentReportIssue.LANG_VI;
        }
        String lang = raw.trim().toLowerCase(Locale.ROOT);
        if (!StudentReportIssue.SUPPORTED_LANGS.contains(lang)) {
            throw new BadRequestException("Ngôn ngữ phiếu không hợp lệ (vi | en | de)");
        }
        return lang;
    }

    private static String normalizeReason(String raw) {
        String trimmed = raw == null ? "" : raw.trim();
        if (trimmed.length() < REASON_MIN_LENGTH || trimmed.length() > REASON_MAX_LENGTH) {
            throw new BadRequestException(
                    "Lý do thu hồi phải từ " + REASON_MIN_LENGTH + " đến " + REASON_MAX_LENGTH + " ký tự");
        }
        return trimmed;
    }

    private static String displayNameOf(User user) {
        String name = user.getDisplayName();
        return name == null || name.isBlank() ? "Học viên" : name.trim();
    }

    private static String truncate(String s, int max) {
        if (s == null) {
            return null;
        }
        return s.length() <= max ? s : s.substring(0, max);
    }
}
