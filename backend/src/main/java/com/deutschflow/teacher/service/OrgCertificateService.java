package com.deutschflow.teacher.service;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.organization.dto.OrgCertificateRowDto;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.organization.service.OrgGuard;
import com.deutschflow.teacher.dto.CertificateDto;
import com.deutschflow.teacher.dto.CertificateSummaryDto;
import com.deutschflow.teacher.dto.IssueCertificateRequest;
import com.deutschflow.teacher.entity.OrgCertificate;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.OrgCertificateRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Issues and verifies co-branded readiness/completion certificates (checklist D5).
 *
 * <p>A teacher issues a certificate to a student in one of their own classes; the center (the
 * issuer's org) name/logo is co-branded onto it. Authorization reuses the existing teacher
 * ownership guard ({@link TeacherService#assertTeacherOwnsClass}) plus a class-membership check —
 * the same belt-and-braces pattern the rest of the teacher API uses against IDOR. All display
 * names are snapshotted at issue time so the certificate is immutable afterwards.
 *
 * <p><b>DEC-20 (09/09/2026):</b> giáo viên vẫn cấp, KHÔNG thêm bước duyệt; nhưng giám đốc xem được
 * sổ chứng nhận toàn trung tâm ({@link #listByOrg}) và thu hồi được kèm lý do
 * ({@link #revokeByOrgOwner}). Cấp và thu hồi (cả hai đường) đều để lại vết
 * ({@value #EVENT_ISSUED} / {@value #EVENT_REVOKED}, DEC-13); vết mang định danh, KHÔNG mang tên
 * học viên hay điểm. Thu hồi = {@code active=false} — link xác thực công khai vẫn trả chứng nhận
 * nhưng cờ {@code active=false} để trang xác thực báo "đã thu hồi" thay vì 404.
 */
@Service
@RequiredArgsConstructor
public class OrgCertificateService {

    /** Vết: giáo viên cấp chứng nhận (actor = giáo viên). */
    public static final String EVENT_ISSUED = "org.certificate.issued";
    /** Vết: thu hồi chứng nhận (actor = giáo viên phụ trách hoặc giám đốc; metadata {@code by}). */
    public static final String EVENT_REVOKED = "org.certificate.revoked";
    /** {@code audit_logs.target_type} cho chứng nhận co-brand. */
    public static final String AUDIT_TARGET_TYPE = "ORG_CERTIFICATE";

    static final int REASON_MIN_LENGTH = 5;
    static final int REASON_MAX_LENGTH = 300;
    /** Trần cỡ trang sổ chứng nhận — cùng con số với {@code AuditLogService.MAX_PAGE_SIZE}. */
    static final int MAX_PAGE_SIZE = 100;

    private static final Set<String> VALID_LEVELS = Set.of("A1", "A2", "B1", "B2", "C1", "C2");
    private static final int MAX_NOTE_LENGTH = 500;
    private static final String DEFAULT_STUDENT_NAME = "Học viên";
    private static final String REVOKED_BY_TEACHER = "TEACHER";
    private static final String REVOKED_BY_OWNER = "OWNER";

    private final OrgCertificateRepository certificateRepository;
    private final TeacherService teacherService;
    private final ClassStudentRepository classStudentRepository;
    private final TeacherClassRepository classRepository;
    private final UserRepository userRepository;
    private final OrganizationRepository organizationRepository;
    private final OrgGuard orgGuard;
    private final AuditLogService auditLogService;

    /** Issue a co-branded certificate for {@code req.studentId} in {@code req.classId}. */
    @Transactional
    public CertificateDto issue(AuditActor issuer, IssueCertificateRequest req) {
        Long issuerUserId = issuer == null ? null : issuer.id();
        if (issuerUserId == null) {
            throw new BadRequestException("Thiếu người cấp");
        }
        if (req == null || req.classId() == null || req.studentId() == null) {
            throw new BadRequestException("Thiếu lớp hoặc học viên");
        }
        String level = req.cefrLevel() == null ? "" : req.cefrLevel().trim().toUpperCase(Locale.ROOT);
        if (!VALID_LEVELS.contains(level)) {
            throw new BadRequestException("Trình độ CEFR không hợp lệ");
        }
        if (req.score() != null && (req.score() < 0 || req.score() > 100)) {
            throw new BadRequestException("Điểm phải trong khoảng 0–100");
        }
        String note = normalizeNote(req.note());

        // Authz (PR B trợ giảng): cấp chứng nhận là quản-lý-lớp — chỉ GV phụ trách,
        // và học viên phải thực sự thuộc lớp.
        teacherService.assertPrimaryTeacherOfClass(issuerUserId, req.classId());
        // D5: chứng nhận mang tên trung tâm — trung tâm chỉ-đọc không phát hành thêm giấy nào.
        // Org lấy theo LỚP, cùng nguồn với phần co-brand chốt bên dưới.
        orgGuard.assertClassOrgWritable(req.classId());
        if (!classStudentRepository.existsByIdClassIdAndIdStudentId(req.classId(), req.studentId())) {
            throw new BadRequestException("Học viên không thuộc lớp này");
        }

        User student = userRepository.findById(req.studentId())
                .orElseThrow(() -> new NotFoundException("Không tìm thấy học viên"));

        User issuerUser = userRepository.findById(issuerUserId).orElse(null);

        // Audit M-7: co-brand from the CLASS's stamped org_id (the institution that owns the class),
        // not the issuer's CURRENT org — a teacher who changed orgs, or an independent/legacy class
        // with no org, must not mislabel the certificate with the issuer's present center.
        Long orgId = classRepository.findById(req.classId())
                .map(TeacherClass::getOrgId)
                .orElse(null);
        String orgName = null;
        String orgLogoUrl = null;
        if (orgId != null) {
            Organization org = organizationRepository.findById(orgId).orElse(null);
            if (org != null) {
                orgName = org.getName();
                orgLogoUrl = org.getLogoUrl();
            }
        }

        String token = newToken();
        OrgCertificate cert = OrgCertificate.builder()
                .verifyToken(token)
                .certificateCode(buildCode(level, token))
                .classId(req.classId())
                .orgId(orgId)
                .orgNameSnapshot(orgName)
                .orgLogoUrlSnapshot(orgLogoUrl)
                .studentUserId(student.getId())
                .studentNameSnapshot(displayNameOf(student))
                .cefrLevel(level)
                .score(req.score())
                .note(note)
                .issuedByUserId(issuerUserId)
                .issuedByNameSnapshot(issuerUser != null ? displayNameOf(issuerUser) : null)
                .active(true)
                .build();

        OrgCertificate saved = certificateRepository.save(cert);
        audit(EVENT_ISSUED, issuer, saved, Map.of("cefrLevel", level));
        return toDto(saved);
    }

    /**
     * Public verification: fetch a certificate by its verify token.
     *
     * <p>DEC-20: chứng nhận ĐÃ THU HỒI vẫn trả về (cờ {@code active=false}) thay vì 404 như trước —
     * người cầm tờ giấy quét link phải đọc được "đã thu hồi", không phải "không tồn tại" (404 không
     * phân biệt được giấy giả với giấy bị rút). Dữ liệu trả về vẫn chỉ là những gì đã in trên giấy.
     */
    @Transactional(readOnly = true)
    public CertificateDto getByToken(String verifyToken) {
        return certificateRepository.findByVerifyToken(verifyToken)
                .map(this::toDto)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy chứng nhận"));
    }

    /** Certificates issued from a class — for the teacher who owns it. */
    @Transactional(readOnly = true)
    public List<CertificateSummaryDto> listByClass(Long teacherUserId, Long classId) {
        teacherService.assertTeacherOwnsClass(teacherUserId, classId);
        return certificateRepository.findByClassIdOrderByCreatedAtDesc(classId).stream()
                .map(this::toSummary)
                .collect(Collectors.toList());
    }

    /**
     * Sổ chứng nhận toàn trung tâm (DEC-20) — OWNER và MANAGER đọc được.
     *
     * @param active  {@code null} = mọi trạng thái; {@code true} còn hiệu lực; {@code false} đã thu hồi
     * @param q       lọc theo tên học viên in trên chứng nhận (không phân biệt hoa thường)
     * @return phong bì {@code {items, total, page, size}} — cùng khuôn với sổ hoạt động (C6)
     */
    @Transactional(readOnly = true)
    public Map<String, Object> listByOrg(Long viewerUserId, Long orgId, Long classId, Boolean active,
                                         String q, int page, int size) {
        orgGuard.assertOrgAdmin(viewerUserId, orgId);
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int safePage = Math.max(page, 0);
        String query = (q == null || q.isBlank()) ? null : q.trim();

        Page<OrgCertificate> found = certificateRepository.searchByOrg(
                orgId, classId, active, query, PageRequest.of(safePage, safeSize));

        Map<Long, String> classNames = classNamesOf(found.getContent());
        List<OrgCertificateRowDto> items = found.getContent().stream()
                .map(c -> toRow(c, classNames.get(c.getClassId())))
                .toList();

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("items", items);
        out.put("total", found.getTotalElements());
        out.put("page", safePage);
        out.put("size", safeSize);
        return out;
    }

    /**
     * Thu hồi bởi GIÁO VIÊN PHỤ TRÁCH lớp — đường cũ, giữ nguyên quyền (PR B trợ giảng: chỉ GV phụ
     * trách). Đã thu hồi rồi thì không làm gì (idempotent, không ghi vết lần hai).
     */
    @Transactional
    public void revokeByTeacher(AuditActor teacher, Long certificateId) {
        Long teacherUserId = teacher == null ? null : teacher.id();
        OrgCertificate cert = certificateRepository.findById(certificateId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy chứng nhận"));
        teacherService.assertPrimaryTeacherOfClass(teacherUserId, cert.getClassId());
        if (!cert.isActive()) {
            return;
        }
        cert.setActive(false);
        certificateRepository.save(cert);
        audit(EVENT_REVOKED, teacher, cert, Map.of("by", REVOKED_BY_TEACHER));
    }

    /**
     * Thu hồi bởi GIÁM ĐỐC trung tâm (DEC-20) — chỉ OWNER, KHÔNG có bước duyệt thay thế nào cho
     * giáo viên. Chứng nhận phải thuộc đúng trung tâm của người gọi (khác trung tâm ⇒ 404). Lý do
     * bắt buộc và đi vào metadata của vết — bảng {@code org_certificates} chưa có cột lý do/thời
     * điểm/người thu hồi (nợ migration, xem bàn giao DEC-20).
     *
     * <p>Thứ tự kiểm: đầu vào (400) → quyền (403) → trạng thái trung tâm (403 ORG_READ_ONLY, vì đây
     * là đường GHI, cùng luật với mọi mutation org-admin) → tồn tại trong trung tâm (404). Đã thu
     * hồi rồi ⇒ trả dòng hiện tại, không ghi vết lần hai (idempotent 200).
     */
    @Transactional
    public OrgCertificateRowDto revokeByOrgOwner(AuditActor owner, Long orgId, Long certificateId,
                                                 String reason) {
        String cleanReason = normalizeReason(reason);
        Long ownerUserId = owner == null ? null : owner.id();
        orgGuard.assertOrgOwner(ownerUserId, orgId);
        orgGuard.assertOrgWritable(orgId);

        OrgCertificate cert = certificateRepository.findByIdAndOrgId(certificateId, orgId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy chứng nhận"));
        String className = classNamesOf(List.of(cert)).get(cert.getClassId());
        if (!cert.isActive()) {
            return toRow(cert, className);
        }
        cert.setActive(false);
        OrgCertificate saved = certificateRepository.save(cert);
        audit(EVENT_REVOKED, owner, saved, Map.of("by", REVOKED_BY_OWNER, "reason", cleanReason));
        return toRow(saved, className);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    /**
     * Ghi vết cho một chứng nhận. Metadata chỉ mang ĐỊNH DANH (id chứng nhận, lớp, học viên, trung
     * tâm) + phần gọi thêm — KHÔNG tên học viên, KHÔNG điểm (DEC-13: vết không mang nội dung).
     *
     * <p>{@code orgId} của CHỨNG NHẬN (= org của lớp) tạm nằm trong metadata: overload hiện có của
     * {@link AuditLogService#log} suy {@code audit_logs.org_id} từ {@code users.org_id} của actor,
     * mà giáo viên được phép đa trung tâm nên hai org có thể khác nhau.
     * TODO(Gói 0, PR #629): khi overload {@code log(event, actor, targetType, targetId, touchedOrgId, metadata)}
     * lên main, đổi ĐÚNG MỘT dòng gọi bên dưới thành
     * {@code auditLogService.log(event, actor, AUDIT_TARGET_TYPE, String.valueOf(cert.getId()), cert.getOrgId(), meta)}.
     */
    private void audit(String event, AuditActor actor, OrgCertificate cert, Map<String, Object> extra) {
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("certificateId", cert.getId());
        meta.put("classId", cert.getClassId());
        meta.put("studentUserId", cert.getStudentUserId());
        meta.put("orgId", cert.getOrgId());
        meta.putAll(extra);
        auditLogService.log(event, actor, AUDIT_TARGET_TYPE, String.valueOf(cert.getId()), meta);
    }

    private String normalizeReason(String raw) {
        String trimmed = raw == null ? "" : raw.trim();
        if (trimmed.length() < REASON_MIN_LENGTH || trimmed.length() > REASON_MAX_LENGTH) {
            throw new BadRequestException(
                    "Lý do thu hồi phải từ " + REASON_MIN_LENGTH + " đến " + REASON_MAX_LENGTH + " ký tự");
        }
        return trimmed;
    }

    /** Tên hiện tại của các lớp xuất hiện trong danh sách — MỘT truy vấn, không N+1. */
    private Map<Long, String> classNamesOf(List<OrgCertificate> certs) {
        Set<Long> ids = certs.stream()
                .map(OrgCertificate::getClassId)
                .filter(id -> id != null)
                .collect(Collectors.toSet());
        if (ids.isEmpty()) {
            return new HashMap<>();
        }
        return classRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(TeacherClass::getId, TeacherClass::getName, (a, b) -> a));
    }

    private String normalizeNote(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        return trimmed.length() > MAX_NOTE_LENGTH ? trimmed.substring(0, MAX_NOTE_LENGTH) : trimmed;
    }

    private String displayNameOf(User user) {
        String name = user.getDisplayName();
        return (name == null || name.isBlank()) ? DEFAULT_STUDENT_NAME : name.trim();
    }

    /** URL-safe random token (UUID without dashes), mirroring LeadMagnetService. */
    private String newToken() {
        return UUID.randomUUID().toString().replace("-", "");
    }

    /** Human-readable code for display/print, e.g. {@code DF-B1-2026-AB12CD34}. */
    private String buildCode(String level, String token) {
        return "DF-" + level + "-" + LocalDate.now().getYear() + "-"
                + token.substring(0, 8).toUpperCase(Locale.ROOT);
    }

    private CertificateDto toDto(OrgCertificate c) {
        return new CertificateDto(
                c.getCertificateCode(),
                c.getVerifyToken(),
                c.getStudentNameSnapshot(),
                c.getCefrLevel(),
                c.getScore(),
                c.getNote(),
                c.getOrgNameSnapshot(),
                c.getOrgLogoUrlSnapshot(),
                c.getIssuedByNameSnapshot(),
                c.getCreatedAt(),
                c.isActive());
    }

    private CertificateSummaryDto toSummary(OrgCertificate c) {
        return new CertificateSummaryDto(
                c.getId(),
                c.getCertificateCode(),
                c.getVerifyToken(),
                c.getStudentNameSnapshot(),
                c.getCefrLevel(),
                c.getScore(),
                c.getCreatedAt(),
                c.isActive());
    }

    private OrgCertificateRowDto toRow(OrgCertificate c, String className) {
        return new OrgCertificateRowDto(
                c.getId(),
                c.getCertificateCode(),
                c.getVerifyToken(),
                c.getClassId(),
                className,
                c.getStudentUserId(),
                c.getStudentNameSnapshot(),
                c.getCefrLevel(),
                c.getScore(),
                c.getIssuedByUserId(),
                c.getIssuedByNameSnapshot(),
                c.getCreatedAt(),
                c.isActive());
    }
}
