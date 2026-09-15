package com.deutschflow.organization.service;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.minor.BirthDateChange;
import com.deutschflow.common.minor.BirthDateRecord;
import com.deutschflow.common.minor.ConsentDraft;
import com.deutschflow.common.minor.GuardianDraft;
import com.deutschflow.common.minor.MinorConsentTerms;
import com.deutschflow.common.minor.MinorLearnerService;
import com.deutschflow.common.minor.MinorPolicy;
import com.deutschflow.common.minor.StudentConsent;
import com.deutschflow.common.minor.StudentGuardian;
import com.deutschflow.notification.NotificationType;
import com.deutschflow.notification.entity.NotificationOutbox;
import com.deutschflow.notification.repository.NotificationOutboxRepository;
import com.deutschflow.organization.dto.OrgGuardianConsentDtos.BirthDateDto;
import com.deutschflow.organization.dto.OrgGuardianConsentDtos.BirthDateRequest;
import com.deutschflow.organization.dto.OrgGuardianConsentDtos.ConsentDto;
import com.deutschflow.organization.dto.OrgGuardianConsentDtos.ConsentRequest;
import com.deutschflow.organization.dto.OrgGuardianConsentDtos.GuardianDto;
import com.deutschflow.organization.dto.OrgGuardianConsentDtos.GuardianRequest;
import com.deutschflow.organization.dto.OrgGuardianConsentDtos.MinorSummary;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Đường của TRUNG TÂM tới hồ sơ người giám hộ và sổ đồng ý của một học viên (D1/R11, owner chốt
 * 10/09/2026). Nghiệp vụ thật nằm ở {@link MinorLearnerService} ({@code common.minor}); lớp này chỉ
 * làm ba việc của tầng org: (1) chứng minh học viên là thành viên ACTIVE của CHÍNH trung tâm người
 * gọi, (2) đổi enum dạng chuỗi/ngày của HTTP thành draft có kiểm, (3) đặt phiên bản điều khoản.
 *
 * <p><b>404, không phải 403, khi học viên không thuộc trung tâm.</b> Cùng lý do với
 * {@code OrgService#getStudentDetail}: một quản trị trung tâm B gõ id lung tung mà nhận 403 là biết
 * "id này có thật và đang ở trung tâm khác" — endpoint biến thành máy dò học viên. 404 nói đúng một
 * câu: trung tâm bạn không có người này.
 *
 * <p><b>Vì sao đòi ACTIVE.</b> Người đã rời trung tâm thì trung tâm không còn là bên có nghĩa vụ
 * (và không còn là bên có quyền) sửa liên lạc của gia đình họ hay ghi thêm đồng ý nhân danh họ.
 * Bằng chứng đã thu vẫn nằm trong sổ ({@code student_consents} không xoá), chỉ là không mở qua
 * đường này nữa.
 */
@Service
@RequiredArgsConstructor
public class OrgGuardianConsentService {

    private static final String STATUS_ACTIVE = "ACTIVE";

    private final OrgMemberRepository memberRepo;
    private final UserRepository userRepository;
    private final MinorLearnerService minorLearnerService;
    private final MinorConsentTerms consentTerms;
    private final OrganizationRepository orgRepository;
    private final NotificationOutboxRepository outboxRepository;

    // ─────────────────────────────────────────────────────────────────────────
    // Tóm tắt cho màn chi tiết học viên
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Bốn con số/nhãn cho {@code OrgStudentDetailDto} — KHÔNG có ngày sinh thô. Người gọi
     * ({@code OrgService#getStudentDetail}) đã chứng minh tư cách thành viên, nên ở đây không kiểm
     * lại.
     */
    @Transactional(readOnly = true)
    public MinorSummary summaryOf(Long studentUserId) {
        MinorPolicy.Status status = minorLearnerService.statusOf(studentUserId);
        return new MinorSummary(
                status.name(),
                status != MinorPolicy.Status.UNKNOWN,
                minorLearnerService.consentStatus(studentUserId, StudentConsent.Scope.AUDIO_RECORDING).name(),
                minorLearnerService.guardiansOf(studentUserId).size());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Ngày sinh (Q-02/Q-05/Q-07, owner chốt 14/09/2026)
    // ─────────────────────────────────────────────────────────────────────────

    /** Giá trị thô + ai đặt lần gần nhất, cho ô sửa. Học viên phải là thành viên ACTIVE. */
    @Transactional(readOnly = true)
    public BirthDateDto birthDateOf(Long orgId, Long studentUserId) {
        requireActiveMember(orgId, studentUserId);
        BirthDateRecord record = minorLearnerService.birthDateOf(studentUserId);
        if (record == null) {
            // requireActiveMember đã chứng minh có ghế ⇒ tài khoản phải tồn tại. Tới đây là dữ liệu
            // gãy, không phải đầu vào sai.
            throw new NotFoundException("Không tìm thấy học viên " + studentUserId);
        }
        String recordedByName = record.recordedByUserId() == null ? null
                : userRepository.findById(record.recordedByUserId())
                        .map(OrgGuardianConsentService::displayNameOf)
                        .orElse(null);
        return new BirthDateDto(record.birthDate(), record.recordedAt(), record.recordedByUserId(),
                recordedByName, minorLearnerService.statusOf(studentUserId).name());
    }

    /**
     * Đặt/sửa ngày sinh, rồi BÁO CHO HỌC VIÊN (Q-05). Trả về trạng thái sau khi ghi để màn hình
     * dựng lại ngay — nhóm tuổi đổi là các khoá của {@code MinorGate} đổi theo.
     *
     * <p>Thông báo ghi qua {@code notification_outbox} TRONG cùng giao dịch (khuôn G2): nếu lượt ghi
     * này rollback thì thông báo biến mất cùng nó, không có chuyện học viên nhận tin về một thay đổi
     * chưa từng xảy ra. Ngược lại, ghi thành công mà worker chưa gửi kịp thì dòng vẫn nằm đó chờ —
     * không mất.
     *
     * <p>Gõ lại đúng ngày đang có ⇒ không ghi, không vết, không báo ({@link BirthDateChange}).
     */
    @Transactional
    public BirthDateDto setBirthDate(Long orgId, Long studentUserId, BirthDateRequest request, AuditActor actor) {
        requireActiveMember(orgId, studentUserId);
        if (actor == null || actor.id() == null) {
            throw new BadRequestException("Thiếu người thực hiện");
        }
        LocalDate birthDate = parseBirthDate(request == null ? null : request.birthDate());

        BirthDateChange change = minorLearnerService.setBirthDate(
                studentUserId, birthDate, actor.id(), orgId, actor);
        if (change.changed()) {
            enqueueBirthDateNotice(orgId, studentUserId, birthDate, change);
        }
        return birthDateOf(orgId, studentUserId);
    }

    /**
     * {@code dedup_key} mang mốc thời gian vì cùng lý do với {@code enqueueAddedToClass}: một học
     * viên có thể bị sửa ngày sinh nhiều lần (gõ nhầm rồi sửa lại), mỗi lượt là một sự kiện riêng
     * và đều đáng báo. Khoá theo (học viên) thôi sẽ để UNIQUE nuốt mất lượt thứ hai.
     */
    private void enqueueBirthDateNotice(Long orgId, Long studentUserId, LocalDate birthDate,
                                        BirthDateChange change) {
        String orgName = orgRepository.findById(orgId).map(o -> o.getName()).orElse("");
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("orgId", orgId);
        payload.put("orgName", orgName == null ? "" : orgName);
        payload.put("birthDate", birthDate.toString());
        payload.put("minorStatus", change.minorStatus().name());
        payload.put("firstRecord", change.firstRecord());
        outboxRepository.save(NotificationOutbox.builder()
                .dedupKey("birthdate:u" + studentUserId + ":t" + Instant.now().toEpochMilli())
                .notificationType(NotificationType.BIRTH_DATE_UPDATED)
                .recipientId(studentUserId)
                .payload(payload)
                .build());
    }

    /** Chuỗi {@code yyyy-MM-dd} → ngày. Khoảng hợp lệ do {@code MinorLearnerService} kiểm. */
    private static LocalDate parseBirthDate(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new BadRequestException("Ngày sinh là bắt buộc");
        }
        try {
            return LocalDate.parse(raw.trim());
        } catch (DateTimeParseException ex) {
            throw new BadRequestException("Ngày sinh \"" + raw + "\" không đúng định dạng (YYYY-MM-DD)");
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Người giám hộ
    // ─────────────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<GuardianDto> listGuardians(Long orgId, Long studentUserId) {
        requireActiveMember(orgId, studentUserId);
        return minorLearnerService.guardiansOf(studentUserId).stream().map(this::toDto).toList();
    }

    /**
     * Thêm người giám hộ. {@code primary} không gửi ⇒ người đầu tiên là chính, các người sau thì
     * không — đúng cái mà một thư ký mong đợi khi thêm "mẹ" rồi thêm "bố" mà không nghĩ tới cờ nào.
     */
    @Transactional
    public GuardianDto addGuardian(Long orgId, Long studentUserId, GuardianRequest request, AuditActor actor) {
        requireActiveMember(orgId, studentUserId);
        boolean primary = request != null && request.primary() != null
                ? request.primary()
                : minorLearnerService.guardiansOf(studentUserId).isEmpty();
        StudentGuardian saved = minorLearnerService.recordGuardian(
                studentUserId, orgId, toDraft(request, primary), actor);
        return toDto(saved);
    }

    /** Sửa thông tin liên lạc. {@code primary} không gửi ⇒ giữ nguyên cờ hiện tại. */
    @Transactional
    public GuardianDto updateGuardian(Long orgId, Long studentUserId, Long guardianId,
                                      GuardianRequest request, AuditActor actor) {
        requireActiveMember(orgId, studentUserId);
        boolean primary = request != null && request.primary() != null
                ? request.primary()
                : minorLearnerService.guardiansOf(studentUserId).stream()
                        .filter(g -> g.getId().equals(guardianId))
                        .map(StudentGuardian::isPrimary)
                        .findFirst()
                        .orElseThrow(() -> new NotFoundException(
                                "Không tìm thấy người giám hộ " + guardianId + " của học viên này"));
        StudentGuardian saved = minorLearnerService.updateGuardian(
                studentUserId, guardianId, orgId, toDraft(request, primary), actor);
        return toDto(saved);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Sổ đồng ý
    // ─────────────────────────────────────────────────────────────────────────

    /** Toàn bộ sổ, mới nhất trước, kèm tên người giám hộ và tên người ghi (giải một lượt). */
    @Transactional(readOnly = true)
    public List<ConsentDto> consentLedger(Long orgId, Long studentUserId) {
        requireActiveMember(orgId, studentUserId);
        List<StudentConsent> rows = minorLearnerService.consentLedger(studentUserId);
        Map<Long, String> guardianNames = minorLearnerService.guardiansOf(studentUserId).stream()
                .collect(Collectors.toMap(StudentGuardian::getId, StudentGuardian::getFullName));
        Set<Long> recorderIds = rows.stream()
                .map(StudentConsent::getRecordedByUserId)
                .filter(id -> id != null)
                .collect(Collectors.toCollection(HashSet::new));
        Map<Long, String> recorderNames = recorderIds.isEmpty()
                ? Map.of()
                : userRepository.findAllById(recorderIds).stream()
                        .collect(Collectors.toMap(User::getId, OrgGuardianConsentService::displayNameOf));
        return rows.stream()
                .map(c -> new ConsentDto(
                        c.getId(),
                        c.getScope().name(),
                        c.getAction().name(),
                        c.getMethod().name(),
                        c.getGuardianId(),
                        c.getGuardianId() == null ? null : guardianNames.get(c.getGuardianId()),
                        c.getTermsVersion(),
                        c.getEffectiveAt(),
                        c.getRecordedByUserId(),
                        c.getRecordedByUserId() == null ? null : recorderNames.get(c.getRecordedByUserId()),
                        c.getNote(),
                        c.getCreatedAt()))
                .toList();
    }

    /**
     * Ghi THÊM một dòng (cấp hoặc thu hồi). Không idempotent như đường CSV — mỗi lần bấm là một
     * phiếu giấy/cuộc gọi có thật, và một phiếu ký lại sau khi điều khoản đổi là bằng chứng mới,
     * không phải bản sao.
     */
    @Transactional
    public ConsentDto recordConsent(Long orgId, Long studentUserId, ConsentRequest request, AuditActor actor) {
        requireActiveMember(orgId, studentUserId);
        if (request == null) {
            throw new BadRequestException("Thiếu nội dung phiếu đồng ý");
        }
        StudentConsent.Scope scope = parseEnum(StudentConsent.Scope.class, request.scope(), "scope");
        StudentConsent.Action action = parseEnum(StudentConsent.Action.class, request.action(), "action");
        StudentConsent.Method method = parseEnum(StudentConsent.Method.class, request.method(), "method");
        StudentConsent saved = minorLearnerService.recordConsent(studentUserId, orgId, new ConsentDraft(
                scope, action, request.guardianId(), method,
                consentTerms.currentVersion(), request.effectiveAt(), request.note()), actor);
        String guardianName = saved.getGuardianId() == null ? null
                : minorLearnerService.guardiansOf(studentUserId).stream()
                        .filter(g -> g.getId().equals(saved.getGuardianId()))
                        .map(StudentGuardian::getFullName)
                        .findFirst().orElse(null);
        return new ConsentDto(
                saved.getId(), saved.getScope().name(), saved.getAction().name(), saved.getMethod().name(),
                saved.getGuardianId(), guardianName, saved.getTermsVersion(), saved.getEffectiveAt(),
                saved.getRecordedByUserId(),
                actor == null ? null : actor.email(),
                saved.getNote(), saved.getCreatedAt());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Nội bộ
    // ─────────────────────────────────────────────────────────────────────────

    private void requireActiveMember(Long orgId, Long studentUserId) {
        if (studentUserId == null) {
            throw new BadRequestException("studentUserId là bắt buộc");
        }
        memberRepo.findByIdOrgIdAndIdUserId(orgId, studentUserId)
                .filter(m -> STATUS_ACTIVE.equals(m.getStatus()))
                .orElseThrow(() -> new NotFoundException("Học viên không thuộc trung tâm"));
    }

    private static GuardianDraft toDraft(GuardianRequest request, boolean primary) {
        if (request == null) {
            throw new BadRequestException("Thiếu thông tin người giám hộ");
        }
        StudentGuardian.Relationship relationship =
                parseEnum(StudentGuardian.Relationship.class, request.relationship(), "relationship");
        return new GuardianDraft(request.fullName(), relationship, request.phone(), request.email(), primary);
    }

    private GuardianDto toDto(StudentGuardian g) {
        return new GuardianDto(g.getId(), g.getFullName(), g.getRelationship().name(), g.getPhone(),
                g.getEmail(), g.isPrimary(), g.getCreatedAt(), g.getUpdatedAt());
    }

    private static String displayNameOf(User u) {
        return u.getDisplayName() != null && !u.getDisplayName().isBlank() ? u.getDisplayName() : u.getEmail();
    }

    private static <E extends Enum<E>> E parseEnum(Class<E> type, String raw, String field) {
        if (raw == null || raw.isBlank()) {
            throw new BadRequestException(field + " là bắt buộc");
        }
        try {
            return Enum.valueOf(type, raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException(field + " \"" + raw + "\" không hợp lệ — nhận "
                    + Arrays.stream(type.getEnumConstants()).map(Enum::name).collect(Collectors.joining(", ")));
        }
    }
}
