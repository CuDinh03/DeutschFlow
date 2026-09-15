package com.deutschflow.common.minor;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Nền dữ liệu cho học viên chưa thành niên (DEC-22, owner chốt 09/09/2026): ghi ngày sinh, ghi
 * người giám hộ, ghi vết đồng ý, và trả lời hai câu mà mọi chốt sau này sẽ hỏi — "người này thuộc
 * nhóm tuổi nào" và "phạm vi này còn đồng ý không".
 *
 * <p><b>PR-1A CHỈ dựng nền;</b> các đường vào nối sau, từng bước: PR-1B nối {@code MinorGate} (đường
 * ghi âm) và cột CSV ngày sinh/người giám hộ; đợt D1/R11 (owner chốt 10/09/2026) nối hai đường GHI
 * ĐỒNG Ý — cột CSV {@code consentConfirmed} ({@code OrgRosterRowImporter}) và endpoint của trung tâm
 * ({@code OrgGuardianConsentService}) — cùng đường sửa người giám hộ ({@link #updateGuardian}). Tách
 * ra để phần khó đảo ngược (hình dạng dữ liệu + bất biến) vào được trước, còn phần siết luồng thì
 * siết được từng bước.
 *
 * <p><b>Vì sao nằm ở {@code common.minor} chứ không ở {@code organization}.</b> V319 đã lập luận
 * cho tầng dữ liệu: đặt ngày sinh ở bảng ghi danh là fail-open cho toàn bộ đường B2C, vì học viên
 * B2C không có dòng org nào. Đặt service ở {@code organization} là lặp lại đúng sai lầm đó ở tầng
 * mã: nghĩa vụ với trẻ chưa thành niên không phụ thuộc việc em ấy có thuộc trung tâm hay không, và
 * những nơi sẽ gọi nó ở PR-1B ({@code ai}, {@code examspeaking}, {@code speaking}) không có lý do
 * gì phải import {@code organization}. {@link MinorPolicy} đã ở đây; giữ nguyên một chỗ.
 * Tiền lệ bố cục: {@code common.async} để entity + repository + service phẳng trong một package.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MinorLearnerService {

    private static final String TARGET_MINOR = "STUDENT_MINOR";
    private static final String TARGET_GUARDIAN = "STUDENT_GUARDIAN";
    private static final String TARGET_CONSENT = "STUDENT_CONSENT";

    /** Bằng cận dưới của {@code chk_users_birth_date_sane} — chặn ở đây để lỗi đọc được, không 500. */
    private static final LocalDate BIRTH_DATE_FLOOR = LocalDate.of(1900, 1, 1);

    private static final int MAX_FULL_NAME = 120;
    private static final int MAX_PHONE = 32;
    private static final int MAX_EMAIL = 255;
    private static final int MAX_TERMS_VERSION = 32;
    private static final int MAX_NOTE = 255;

    /**
     * Dung sai đồng hồ cho {@code effectiveAt}. Mốc "lúc đồng ý thật" thường do máy khách gửi, mà
     * đồng hồ máy khách lệch vài giây là chuyện thường; từ chối thẳng thì một chiếc điện thoại chạy
     * nhanh 30 giây sẽ không ghi nổi đồng ý nào. Năm phút đủ rộng cho lệch thật, đủ hẹp để "ký
     * trước cho tháng sau" vẫn bị chặn.
     */
    private static final Duration MAX_CLOCK_SKEW = Duration.ofMinutes(5);

    /**
     * Đọc THẲNG CỘT, không qua entity {@code User} — xem javadoc {@link #statusOf(Long)}.
     */
    private static final String SQL_READ_BIRTH_DATE = "SELECT birth_date FROM users WHERE id = ?";

    /**
     * Ghi ngày sinh MỘT LẦN. {@code AND birth_date IS NULL} vừa là luật nghiệp vụ vừa là chốt đua:
     * hai request nhập cùng lúc thì câu thứ hai chạm 0 dòng, không cần khoá và không có TOCTOU.
     */
    private static final String SQL_CLAIM_BIRTH_DATE = """
            UPDATE users
               SET birth_date = ?,
                   birth_date_recorded_at = NOW(),
                   birth_date_recorded_by = ?
             WHERE id = ?
               AND birth_date IS NULL
            """;

    private final JdbcTemplate jdbcTemplate;
    private final UserRepository userRepository;
    private final StudentGuardianRepository guardianRepository;
    private final StudentConsentRepository consentRepository;
    private final MinorPolicy minorPolicy;
    private final AuditLogService auditLogService;

    // ─────────────────────────────────────────────────────────────────────────
    // Ngày sinh
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Ghi ngày sinh cho một học viên — CHỈ khi cột đang NULL.
     *
     * <p><b>Vì sao không phải upsert.</b> Luồng nhập CSV của PR-1B cho một MANAGER gõ email bất kỳ.
     * Nếu ở đây "cập nhật khi liên kết tài khoản có sẵn" thì đó chính là đường một trung tâm sửa
     * thuộc tính DANH TÍNH trên tài khoản của người khác — ngược nguyên tắc person-owned mà
     * {@code OrgInvitationService} đã ghi ("rời TT chỉ đóng membership, account vẫn sống"). Một
     * ngày sinh sai còn kéo theo hậu quả thật: hạ tuổi một em 15 xuống thành 18 là mở khoá đường
     * gửi giọng nói của em ấy cho nhà cung cấp bên ngoài.
     *
     * <p><b>Vì sao trả {@code false} chứ không ném.</b> Nhập CSV là thao tác HÀNG LOẠT: ném ở dòng
     * thứ 40 thì hoặc mất 39 dòng trước, hoặc phải bọc try/catch quanh từng dòng. {@code false} =
     * "đã có giá trị, không đụng vào" là kết quả bình thường của một lần nhập lại, không phải lỗi;
     * người gọi đếm nó thành một dòng bỏ qua. Còn {@code studentUserId} không tồn tại thì VẪN ném
     * {@link NotFoundException} — đó là lỗi lập trình, không phải trạng thái dữ liệu.
     *
     * <p>Sửa một ngày sinh ĐÃ CÓ là đường riêng, phải kiểm quyền chặt hơn (không thuộc trung tâm mà
     * thuộc chủ tài khoản hoặc admin nền tảng, kèm lý do). Đường đó chưa tồn tại và cố ý chưa có.
     *
     * @param recordedByUserId ai gõ vào. BẮT BUỘC — một thay đổi danh tính không có người chịu
     *                         trách nhiệm thì {@code birth_date_recorded_by} vô nghĩa
     * @param touchedOrgId     trung tâm BỊ TÁC ĐỘNG, do controller giải bằng {@code AuditOrgResolver}
     * @return {@code true} nếu đã ghi; {@code false} nếu học viên đã có ngày sinh (không ghi đè)
     */
    @Transactional
    public boolean recordBirthDate(Long studentUserId, LocalDate birthDate, Long recordedByUserId,
                                   Long touchedOrgId, AuditActor actor) {
        requireId(studentUserId, "studentUserId");
        requireId(recordedByUserId, "recordedByUserId");
        validateBirthDate(birthDate);

        int written = jdbcTemplate.update(SQL_CLAIM_BIRTH_DATE, birthDate, recordedByUserId, studentUserId);
        if (written == 0) {
            if (!userRepository.existsById(studentUserId)) {
                throw new NotFoundException("Không tìm thấy học viên " + studentUserId);
            }
            // Không ghi vết: sổ audit ghi thao tác THÀNH CÔNG (javadoc AuditLogService — nghiệp vụ
            // rollback thì vết cũng biến mất). Một lần nhập lại CSV sẽ chạm nhánh này ở mọi dòng.
            log.warn("[Minor] Từ chối ghi đè birth_date đã có của học viên {} (người ghi {})",
                    studentUserId, recordedByUserId);
            return false;
        }

        MinorPolicy.Status status = minorPolicy.statusOf(birthDate);
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("studentUserId", studentUserId);
        meta.put("recordedByUserId", recordedByUserId);
        meta.put("minorStatus", status.name());
        auditLogService.log("student_birth_date_recorded", actor,
                TARGET_MINOR, String.valueOf(studentUserId), touchedOrgId, meta);
        log.info("[Minor] Đã ghi birth_date cho học viên {} (status={})", studentUserId, status);
        return true;
    }

    /**
     * Nhóm tuổi của một học viên, nạp {@code birth_date} TỪ DB tại điểm quyết định.
     *
     * <p>🪤 Không đọc từ {@code @AuthenticationPrincipal}: {@code JwtAuthFilter} cache principal 60
     * giây. Và cũng KHÔNG đọc qua {@code userRepository.findById}: nếu request này đã gọi
     * {@code save(principal)} ở đâu đó thì {@code merge} đã chép TOÀN BỘ trường của bản chụp cũ —
     * kể cả {@code updatable = false} — lên thực thể quản lý, nên {@code findById} sau đó trả lại
     * chính giá trị cũ ấy từ persistence context mà không hề chạm DB. {@code updatable = false}
     * chỉ chặn Hibernate GHI cột, không chặn nó đọc nhầm. Câu SELECT thẳng cột là cách duy nhất
     * chắc chắn đọc được giá trị đang có trong bảng.
     *
     * <p>Không có tài khoản ⇒ {@link MinorPolicy.Status#UNKNOWN}, không ném: đây là hàm dùng ở chốt
     * chặn, mà một chốt chặn ném ra giữa đường là fail-open. {@code UNKNOWN} để điểm gọi tự chọn
     * fail-closed, đúng như javadoc của {@link MinorPolicy.Status}.
     */
    @Transactional(readOnly = true)
    public MinorPolicy.Status statusOf(Long studentUserId) {
        requireId(studentUserId, "studentUserId");
        return loadStatus(studentUserId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Người giám hộ
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Thêm một người giám hộ. Đặt {@code draft.primary()} sẽ HẠ người liên lạc chính hiện tại.
     *
     * @param orgId trung tâm nhập bản ghi; cũng chính là trung tâm bị tác động trong sổ hoạt động
     */
    @Transactional
    public StudentGuardian recordGuardian(Long studentUserId, Long orgId, GuardianDraft draft,
                                          AuditActor actor) {
        requireId(studentUserId, "studentUserId");
        requireStudentExists(studentUserId);
        GuardianDraft clean = normalize(draft);
        requireGuardianEmailNotStudentEmail(studentUserId, clean.email());

        if (clean.primary()) {
            demoteCurrentPrimary(studentUserId);
        }

        StudentGuardian saved = guardianRepository.save(StudentGuardian.builder()
                .studentUserId(studentUserId)
                .orgId(orgId)
                .fullName(clean.fullName())
                .relationship(clean.relationship())
                .phone(clean.phone())
                .email(clean.email())
                .primary(clean.primary())
                .createdBy(actor == null ? null : actor.id())
                .build());

        // ⛔ Metadata mang ĐỊNH DANH và SỐ LƯỢNG, KHÔNG mang nội dung. Sổ này giám đốc đọc được VÀ
        // mọi admin nền tảng cũng đọc được, nên không tên, không số điện thoại, không email — và
        // cũng không `relationship`: cấu trúc gia đình của một đứa trẻ không phải thứ cần để trả
        // lời "ai đã nhập bản ghi nào, lúc nào".
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("studentUserId", studentUserId);
        meta.put("guardianId", saved.getId());
        meta.put("isPrimary", saved.isPrimary());
        meta.put("guardianCount", guardianRepository.countByStudentUserId(studentUserId));
        meta.put("minorStatus", loadStatus(studentUserId).name());
        auditLogService.log("student_guardian_recorded", actor,
                TARGET_GUARDIAN, String.valueOf(saved.getId()), orgId, meta);
        return saved;
    }

    /** Danh sách giám hộ của một học viên, người liên lạc chính đứng đầu. */
    @Transactional(readOnly = true)
    public List<StudentGuardian> guardiansOf(Long studentUserId) {
        requireId(studentUserId, "studentUserId");
        return guardianRepository.findByStudentUserIdOrderByPrimaryDescIdAsc(studentUserId);
    }

    /**
     * Sửa THÔNG TIN LIÊN LẠC của một người giám hộ (tên, quan hệ, điện thoại, email, người chính).
     * Đây là đường mà {@link StudentGuardian} tồn tại để có: gõ sai số điện thoại thì phải sửa được,
     * và sửa số KHÔNG chạm tới bằng chứng đồng ý đã thu (bảng kia chỉ-ghi-thêm). Không có hàm xoá —
     * cố ý, cùng lý do với sổ đồng ý: một người giám hộ từng đồng ý mà biến mất khỏi bảng thì dòng
     * đồng ý mất luôn câu trả lời "ai".
     *
     * <p>Người giám hộ phải thuộc CHÍNH học viên này — cùng chốt với {@link #resolveGuardian}: không
     * kiểm thì một điểm gọi truyền nhầm id là sửa được liên lạc của gia đình khác.
     *
     * @param orgId trung tâm thao tác; là trung tâm bị tác động trong sổ hoạt động
     */
    @Transactional
    public StudentGuardian updateGuardian(Long studentUserId, Long guardianId, Long orgId,
                                          GuardianDraft draft, AuditActor actor) {
        requireId(studentUserId, "studentUserId");
        requireId(guardianId, "guardianId");
        StudentGuardian guardian = guardianRepository.findById(guardianId)
                .filter(g -> studentUserId.equals(g.getStudentUserId()))
                .orElseThrow(() -> new NotFoundException(
                        "Không tìm thấy người giám hộ " + guardianId + " của học viên " + studentUserId));
        GuardianDraft clean = normalize(draft);
        requireGuardianEmailNotStudentEmail(studentUserId, clean.email());

        // ⛔ Vết chỉ mang TÊN TRƯỜNG đã đổi, không mang giá trị cũ/mới — cùng luật với recordGuardian.
        List<String> changed = new java.util.ArrayList<>();
        if (!clean.fullName().equals(guardian.getFullName())) {
            changed.add("fullName");
        }
        if (clean.relationship() != guardian.getRelationship()) {
            changed.add("relationship");
        }
        if (!java.util.Objects.equals(clean.phone(), guardian.getPhone())) {
            changed.add("phone");
        }
        if (!java.util.Objects.equals(clean.email(), guardian.getEmail())) {
            changed.add("email");
        }
        if (clean.primary() != guardian.isPrimary()) {
            changed.add("isPrimary");
        }

        if (clean.primary() && !guardian.isPrimary()) {
            // Cùng bẫy thứ tự flush với recordGuardian: hạ người chính hiện tại XUỐNG DB trước khi
            // dòng này nhận is_primary, nếu không uq_student_guardians_primary nổ.
            demoteCurrentPrimary(studentUserId);
        }
        guardian.setFullName(clean.fullName());
        guardian.setRelationship(clean.relationship());
        guardian.setPhone(clean.phone());
        guardian.setEmail(clean.email());
        guardian.setPrimary(clean.primary());
        StudentGuardian saved = guardianRepository.save(guardian);

        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("studentUserId", studentUserId);
        meta.put("guardianId", saved.getId());
        meta.put("isPrimary", saved.isPrimary());
        meta.put("changedFields", changed);
        meta.put("minorStatus", loadStatus(studentUserId).name());
        auditLogService.log("student_guardian_updated", actor,
                TARGET_GUARDIAN, String.valueOf(saved.getId()), orgId, meta);
        return saved;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Sổ đồng ý
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Ghi THÊM một dòng vào sổ đồng ý. Thu hồi cũng đi đường này với
     * {@link StudentConsent.Action#REVOKED} — không có hàm xoá, và sẽ không bao giờ có.
     */
    @Transactional
    public StudentConsent recordConsent(Long studentUserId, Long orgId, ConsentDraft draft,
                                        AuditActor actor) {
        requireId(studentUserId, "studentUserId");
        requireStudentExists(studentUserId);
        ConsentDraft clean = normalize(draft);
        Long guardianId = resolveGuardian(studentUserId, clean.guardianId());

        StudentConsent saved = consentRepository.save(StudentConsent.builder()
                .studentUserId(studentUserId)
                .orgId(orgId)
                .scope(clean.scope())
                .action(clean.action())
                .guardianId(guardianId)
                .method(clean.method())
                .termsVersion(clean.termsVersion())
                .effectiveAt(clean.effectiveAt())
                .recordedByUserId(actor == null ? null : actor.id())
                .note(clean.note())
                .build());

        // `note` là ô chữ tự do — có thể chứa bất cứ thứ gì nhân viên gõ vào, nên nó KHÔNG vào sổ
        // audit. `termsVersion` thì có: nó là số hiệu phiên bản, và thiếu nó thì vết không nói được
        // người giám hộ đã đồng ý với điều khoản nào.
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("studentUserId", studentUserId);
        meta.put("consentId", saved.getId());
        meta.put("scope", saved.getScope().name());
        meta.put("action", saved.getAction().name());
        meta.put("method", saved.getMethod().name());
        meta.put("termsVersion", saved.getTermsVersion());
        meta.put("effectiveAt", saved.getEffectiveAt().toString());
        meta.put("hasGuardian", guardianId != null);
        meta.put("minorStatus", loadStatus(studentUserId).name());
        auditLogService.log("student_consent_recorded", actor,
                TARGET_CONSENT, String.valueOf(saved.getId()), orgId, meta);
        log.info("[Minor] Ghi đồng ý {} {} cho học viên {} (org={}, consentId={})",
                saved.getScope(), saved.getAction(), studentUserId, orgId, saved.getId());
        return saved;
    }

    /**
     * Trạng thái đồng ý HIỆN TẠI của một phạm vi — dòng {@code effective_at} mới nhất thắng, kể cả
     * khi dòng đó là {@link StudentConsent.Action#REVOKED}.
     */
    @Transactional(readOnly = true)
    public ConsentState consentStatus(Long studentUserId, StudentConsent.Scope scope) {
        requireId(studentUserId, "studentUserId");
        if (scope == null) {
            throw new BadRequestException("scope là bắt buộc");
        }
        return consentRepository
                .findFirstByStudentUserIdAndScopeOrderByEffectiveAtDescIdDesc(studentUserId, scope)
                .map(row -> row.getAction() == StudentConsent.Action.GRANTED
                        ? ConsentState.GRANTED
                        : ConsentState.REVOKED)
                .orElse(ConsentState.NEVER_RECORDED);
    }

    /** Toàn bộ sổ của một học viên, mới nhất trước — đường đọc bằng chứng. */
    @Transactional(readOnly = true)
    public List<StudentConsent> consentLedger(Long studentUserId) {
        requireId(studentUserId, "studentUserId");
        return consentRepository.findByStudentUserIdOrderByEffectiveAtDescIdDesc(studentUserId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Nội bộ
    // ─────────────────────────────────────────────────────────────────────────

    private MinorPolicy.Status loadStatus(Long studentUserId) {
        List<LocalDate> rows = jdbcTemplate.query(SQL_READ_BIRTH_DATE,
                (rs, rowNum) -> rs.getObject(1, LocalDate.class), studentUserId);
        if (rows.isEmpty()) {
            log.warn("[Minor] statusOf: không có tài khoản {} — trả UNKNOWN để điểm gọi tự fail-closed",
                    studentUserId);
            return MinorPolicy.Status.UNKNOWN;
        }
        return minorPolicy.statusOf(rows.get(0));
    }

    /**
     * 🪤 Hibernate xếp INSERT TRƯỚC UPDATE trong hàng đợi flush. "Hạ người chính cũ rồi thêm người
     * mới" mà chỉ {@code save()} cả hai sẽ gửi INSERT đi trước và đâm thẳng vào
     * {@code uq_student_guardians_primary}. {@code saveAndFlush} ép câu UPDATE xuống DB NGAY, lúc
     * dòng mới còn chưa tồn tại.
     */
    private void demoteCurrentPrimary(Long studentUserId) {
        guardianRepository.findByStudentUserIdAndPrimaryTrue(studentUserId).ifPresent(current -> {
            current.setPrimary(false);
            guardianRepository.saveAndFlush(current);
        });
    }

    /**
     * Email người giám hộ KHÔNG được là email của chính học viên (so không phân biệt hoa thường).
     * Địa chỉ này là nơi nhận phiếu đánh giá (R6) và là kênh gọi người lớn khi cần; trùng email học
     * viên là "đồng ý của người giám hộ" do trẻ tự cấp, và phiếu "gửi phụ huynh" rơi vào hộp thư của
     * em ấy. Áp cho cả thêm lẫn sửa — sửa email giám hộ về email học viên là cùng một lỗ.
     *
     * <p>Đọc email qua {@code userRepository.findById}: cột {@code email} không có bẫy
     * {@code updatable = false} như {@code birth_date} (xem {@link #statusOf}), nên persistence
     * context trả đúng giá trị. Không có tài khoản ⇒ không có gì để so; {@code requireStudentExists}
     * (recordGuardian) hoặc chốt "giám hộ thuộc học viên" (updateGuardian) đã/ sẽ xử lý ca đó.
     *
     * @throws GuardianEmailConflictException 400 + {@code extensions.code = GUARDIAN_EMAIL_IS_STUDENT_EMAIL}
     */
    private void requireGuardianEmailNotStudentEmail(Long studentUserId, String guardianEmail) {
        if (guardianEmail == null) {
            return;
        }
        String studentEmail = userRepository.findById(studentUserId).map(User::getEmail).orElse(null);
        if (studentEmail != null && studentEmail.equalsIgnoreCase(guardianEmail)) {
            throw new GuardianEmailConflictException("Email người giám hộ trùng email của học viên — "
                    + "hãy nhập địa chỉ email riêng của cha mẹ/người giám hộ (đây là nơi nhận phiếu đánh giá).");
        }
    }

    /**
     * Người giám hộ phải thuộc CHÍNH học viên này. Không kiểm thì một điểm gọi truyền nhầm (hoặc cố
     * ý) id của học viên khác sẽ nối bằng chứng của gia đình A vào hồ sơ của em B — và vì sổ là
     * chỉ-ghi-thêm nên dòng sai đó không gỡ ra được nữa.
     */
    private Long resolveGuardian(Long studentUserId, Long guardianId) {
        if (guardianId == null) {
            return null;
        }
        StudentGuardian guardian = guardianRepository.findById(guardianId)
                .orElseThrow(() -> new BadRequestException("Không tìm thấy người giám hộ " + guardianId));
        if (!studentUserId.equals(guardian.getStudentUserId())) {
            throw new BadRequestException(
                    "Người giám hộ " + guardianId + " không thuộc học viên " + studentUserId);
        }
        return guardianId;
    }

    private void validateBirthDate(LocalDate birthDate) {
        if (birthDate == null) {
            throw new BadRequestException("Ngày sinh là bắt buộc");
        }
        // PostgreSQL cấm CURRENT_DATE trong CHECK (xem V319), nên chốt "phải ở quá khứ" chỉ có ở
        // đây. Cùng zone với MinorPolicy — lệch zone là lệch một ngày ở biên.
        if (birthDate.isAfter(LocalDate.now(MinorPolicy.ZONE))) {
            throw new BadRequestException("Ngày sinh không được ở tương lai");
        }
        if (birthDate.isBefore(BIRTH_DATE_FLOOR)) {
            throw new BadRequestException("Ngày sinh không hợp lệ (trước " + BIRTH_DATE_FLOOR + ")");
        }
    }

    private GuardianDraft normalize(GuardianDraft draft) {
        if (draft == null) {
            throw new BadRequestException("Thông tin người giám hộ là bắt buộc");
        }
        String fullName = trimToNull(draft.fullName());
        if (fullName == null) {
            throw new BadRequestException("Tên người giám hộ là bắt buộc");
        }
        if (draft.relationship() == null) {
            throw new BadRequestException("Quan hệ với học viên là bắt buộc");
        }
        String phone = trimToNull(draft.phone());
        String email = trimToNull(draft.email());
        email = email == null ? null : email.toLowerCase();
        // Bằng chk_student_guardians_contactable. Chặn ở đây để người nhập thấy câu tiếng Việt, chứ
        // không phải để PostgreSQL ném ràng buộc ra thành 500 không đọc được.
        if (phone == null && email == null) {
            throw new BadRequestException("Người giám hộ phải có ít nhất số điện thoại hoặc email");
        }
        requireMaxLength(fullName, MAX_FULL_NAME, "Tên người giám hộ");
        requireMaxLength(phone, MAX_PHONE, "Số điện thoại người giám hộ");
        requireMaxLength(email, MAX_EMAIL, "Email người giám hộ");
        return new GuardianDraft(fullName, draft.relationship(), phone, email, draft.primary());
    }

    private ConsentDraft normalize(ConsentDraft draft) {
        if (draft == null) {
            throw new BadRequestException("Thông tin đồng ý là bắt buộc");
        }
        requirePresent(draft.scope(), "scope");
        requirePresent(draft.action(), "action");
        requirePresent(draft.method(), "method");
        String termsVersion = trimToNull(draft.termsVersion());
        if (termsVersion == null) {
            throw new BadRequestException("termsVersion là bắt buộc — không có phiên bản điều khoản "
                    + "thì vết đồng ý không nói được người giám hộ đã đồng ý với cái gì");
        }
        requireMaxLength(termsVersion, MAX_TERMS_VERSION, "termsVersion");
        String note = trimToNull(draft.note());
        requireMaxLength(note, MAX_NOTE, "note");
        Instant effectiveAt = draft.effectiveAt() == null ? Instant.now() : draft.effectiveAt();
        if (effectiveAt.isAfter(Instant.now().plus(MAX_CLOCK_SKEW))) {
            throw new BadRequestException("effectiveAt không được ở tương lai — không ai đồng ý trước được");
        }
        return new ConsentDraft(draft.scope(), draft.action(), draft.guardianId(), draft.method(),
                termsVersion, effectiveAt, note);
    }

    private void requireStudentExists(Long studentUserId) {
        if (!userRepository.existsById(studentUserId)) {
            throw new NotFoundException("Không tìm thấy học viên " + studentUserId);
        }
    }

    private static void requireId(Long value, String name) {
        if (value == null) {
            throw new BadRequestException(name + " là bắt buộc");
        }
    }

    private static void requirePresent(Object value, String name) {
        if (value == null) {
            throw new BadRequestException(name + " là bắt buộc");
        }
    }

    private static void requireMaxLength(String value, int max, String label) {
        if (value != null && value.length() > max) {
            throw new BadRequestException(label + " dài quá " + max + " ký tự");
        }
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
