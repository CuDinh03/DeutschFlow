package com.deutschflow.organization.service;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.minor.ConsentDraft;
import com.deutschflow.common.minor.ConsentState;
import com.deutschflow.common.minor.MinorConsentTerms;
import com.deutschflow.common.minor.MinorLearnerService;
import com.deutschflow.common.minor.StudentConsent;
import com.deutschflow.common.minor.StudentGuardian;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.teacher.service.AssignmentBackfillService;
import com.deutschflow.teacher.service.ClassEnrollmentService;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/**
 * The database work for ONE roster-CSV row, in its OWN transaction.
 *
 * <p>This bean exists for its transaction boundary, not for its logic. {@link OrgRosterService}
 * reports failures per row ({@code RosterImportResultDto.errors()}) and keeps importing, which is
 * only possible if a failing row cannot damage the rows around it. When every row shared one
 * transaction, a RuntimeException from any {@code @Transactional} collaborator
 * ({@link OrgMembershipService#upsertMember}, {@link OrgEntitlementService#grantStudent},
 * {@link AssignmentBackfillService#ensureAssignmentsForStudent}) was intercepted by
 * {@code TransactionAspectSupport} on the way out and marked that shared transaction rollback-only.
 * The import loop's {@code catch} recorded the row and continued, but it could not clear the flag —
 * so the final commit threw {@code UnexpectedRollbackException} and the whole import 500'd after
 * having reported per-row errors that the caller never got to see.
 *
 * <p>{@code REQUIRES_NEW} makes each row a genuinely independent transaction: it commits or rolls
 * back on its own and is fully completed by the time an exception reaches the caller, so there is no
 * shared transaction left to poison. It also means {@link OrgRosterService#importStudents} must NOT
 * be called from inside a transaction — see the note there.
 *
 * <p>The org row-lock that used to be taken once per import now lives here, per row (see the seat
 * comment below).
 *
 * <p><b>D6 (owner chốt 10/09/2026): dữ liệu chưa thành niên chỉ ghi SAU khi dòng đã là thành viên
 * ACTIVE của chính trung tâm này.</b> Mọi chốt từ chối (ADMIN, nhân sự, đang thuộc trung tâm khác,
 * hết ghế) đều đứng TRƯỚC {@link OrgMembershipService#upsertMember}; ngày sinh, người giám hộ và
 * đồng ý đứng SAU. Và vì cả dòng là một transaction, {@code upsertMember} ném thì ba thứ đó cũng
 * không thể đã ghi — một dòng bị từ chối không chạm {@code users} của ai cả.
 */
@Service
@RequiredArgsConstructor
public class OrgRosterRowImporter {

    private static final String ROLE_STUDENT = "STUDENT";
    private static final String STATUS_ACTIVE = "ACTIVE";

    /** Ghi chú cố định trên dòng đồng ý ghi từ CSV — để sổ phân biệt được với phiếu nhập tay. */
    static final String CONSENT_NOTE_ROSTER_IMPORT = "roster-import";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final OrgMembershipService membershipService;
    private final OrgEntitlementService entitlementService;
    private final OrgMemberRepository orgMemberRepository;
    private final ClassEnrollmentService classEnrollmentService;
    private final AssignmentBackfillService assignmentBackfillService;
    private final MinorLearnerService minorLearnerService;
    private final MinorConsentTerms consentTerms;
    private final JdbcTemplate jdbcTemplate;

    /**
     * What one row did. {@code created} and {@code linked} are mutually exclusive; {@code seatLimited}
     * means the row was rejected by the seat gate and nothing was written.
     *
     * @param otherOrgName          F4: dòng bị từ chối vì học viên đang ACTIVE ở trung tâm KHÁC — tên
     *                              trung tâm đó (có thể rỗng nếu không tra được tên). {@code null} =
     *                              không bị chặn vì lý do này. Không ghi gì cả khi có giá trị
     * @param birthDateRecorded     ngày sinh của dòng này ĐÃ được ghi. {@code false} khi dòng không khai
     *                              ngày sinh HOẶC tài khoản đã có sẵn — cả hai đều là kết quả bình
     *                              thường, không phải lỗi (xem {@code MinorLearnerService#recordBirthDate})
     * @param guardianRecorded      người giám hộ của dòng này đã được thêm; {@code false} khi dòng không
     *                              khai, hoặc học viên đã có người giám hộ từ trước
     * @param consentRecorded       một dòng đồng ý {@code AUDIO_RECORDING/GRANTED/PAPER} đã được ghi thêm;
     *                              {@code false} khi ô không đánh dấu, hoặc học viên đã đang {@code GRANTED}
     * @param reportSharingRecorded một dòng đồng ý {@code GUARDIAN_REPORT_SHARING/GRANTED/PAPER} (R6) đã
     *                              được ghi thêm; cùng hai nghĩa của {@code false} như trên
     * @param aiProcessingRecorded  một dòng đồng ý {@code AI_PROCESSING/GRANTED/PAPER} (C3, D3) đã được
     *                              ghi thêm; cùng hai nghĩa của {@code false} như trên
     */
    public record RowOutcome(boolean created, boolean linked, boolean enrolled, boolean seatLimited,
                             String otherOrgName,
                             boolean birthDateRecorded, boolean guardianRecorded, boolean consentRecorded,
                             boolean reportSharingRecorded, boolean aiProcessingRecorded) {

        static RowOutcome rejectedBySeatLimit() {
            return new RowOutcome(false, false, false, true, null, false, false, false, false, false);
        }

        static RowOutcome rejectedByOtherOrg(String otherOrgName) {
            return new RowOutcome(false, false, false, false, otherOrgName == null ? "" : otherOrgName,
                    false, false, false, false, false);
        }

        static RowOutcome imported(boolean created, boolean enrolled,
                                   boolean birthDateRecorded, boolean guardianRecorded,
                                   boolean consentRecorded, boolean reportSharingRecorded,
                                   boolean aiProcessingRecorded) {
            return new RowOutcome(created, !created, enrolled, false, null,
                    birthDateRecorded, guardianRecorded, consentRecorded, reportSharingRecorded,
                    aiProcessingRecorded);
        }

        /** Dòng bị chặn vì học viên đang thuộc trung tâm khác (F4). */
        public boolean rejectedByOtherOrg() {
            return otherOrgName != null;
        }
    }

    /**
     * Links-or-creates the user, upserts the org membership, grants the org-funded plan, records the
     * row's minor data and (optionally) enrolls into a class — all or nothing for THIS row.
     *
     * @param org           the target org, loaded once by the caller (read-only here)
     * @param row           dòng CSV đã kiểm và chuẩn hoá ở {@link OrgRosterService}
     * @param classIdOrNull when non-null, the student is also enrolled into this class
     * @param actor         người bấm import — chịu trách nhiệm cho {@code birth_date_recorded_by};
     *                      id của actor cũng đi vào thông báo phân lớp để học viên biết ai xếp lớp (DEC-18)
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public RowOutcome importRow(Organization org, RosterRowInput row, Long classIdOrNull,
                                AuditActor actor) {
        Long orgId = org.getId();
        String email = row.email();

        // Row-level lock on the org, held for this row's transaction (J). It used to be taken once
        // for the whole import; now that each row commits separately, batch-scoping it would be both
        // wrong (a REQUIRES_NEW row runs on its own connection and would block on the batch's own
        // lock — a self-deadlock) and unnecessary. Per row it still serializes concurrent same-org
        // writers, so the seat check below and the seat gate inside upsertMember cannot interleave
        // with another admin's add and let both pass the limit.
        jdbcTemplate.queryForObject("SELECT id FROM organizations WHERE id = ? FOR UPDATE",
                Long.class, orgId);

        User existing = userRepository.findByEmailIgnoreCase(email).orElse(null);

        // Soát 09/09/2026: CSV HỌC VIÊN không được đụng tới NHÂN SỰ. upsertMember ghi đè vai trò
        // của dòng org_members đang có — OWNER được chặn ngay trong đó, nhưng MANAGER/TEACHER thì
        // KHÔNG. Hệ quả: một MANAGER chỉ cần đưa email của MANAGER (hoặc giáo viên) khác vào một
        // dòng CSV là hạ được người đó xuống STUDENT, kèm hạ luôn vai nền tảng (syncPlatformRole) —
        // đúng thứ mà chốt "chỉ OWNER mới gỡ được MANAGER" ở removeMember vừa chặn, chỉ là đi vòng
        // qua cửa import. Dòng đó bị từ chối và báo lỗi rõ ràng thay vì âm thầm đổi vai.
        if (existing != null) {
            // DEC-13: admin nền tảng không bao giờ là thành viên trung tâm. upsertMember đã chặn
            // (và importRow là REQUIRES_NEW nên chỉ dòng này hỏng), nhưng ném từ đó cho ra thông
            // báo không có email — vòng lặp ở OrgRosterService bắt Exception rồi ghi "Dòng N: lỗi
            // xử lý". Kiểm sớm ở đây để người nhập đọc được dòng nào, email nào, vì sao — cùng
            // khuôn với chốt "CSV học viên không đụng nhân sự" ngay bên dưới.
            if (existing.getRole() == User.Role.ADMIN) {
                throw new BadRequestException("Tài khoản " + email
                        + " là quản trị viên nền tảng — không thể thêm vào danh sách học viên của trung tâm.");
            }
            orgMemberRepository.findByIdOrgIdAndIdUserId(orgId, existing.getId())
                    .filter(m -> STATUS_ACTIVE.equals(m.getStatus()) && !ROLE_STUDENT.equals(m.getRole()))
                    .ifPresent(m -> {
                        throw new BadRequestException("Tài khoản " + email + " đang là " + m.getRole()
                                + " của trung tâm — nhập CSV học viên không được đổi vai trò nhân sự."
                                + " Hãy xử lý ở trang Thành viên.");
                    });
            // F4 (owner chốt 10/09/2026): đang ACTIVE ở trung tâm KHÁC ⇒ chặn dòng, nêu tên trung
            // tâm đó. Đây là bản ĐỌC ĐƯỢC của chốt trong upsertMember (chốt đó vẫn là thẩm quyền
            // cuối, cùng khoá FOR UPDATE); trả về outcome thay vì ném để OrgRosterService viết được
            // câu có số dòng + email + tên trung tâm, và để D6 giữ nguyên: chưa ghi gì, không chạm
            // `users` của người này.
            Optional<OrgMembershipService.ActiveElsewhere> elsewhere =
                    membershipService.activeMembershipElsewhere(existing.getId(), orgId);
            if (elsewhere.isPresent()) {
                return RowOutcome.rejectedByOtherOrg(elsewhere.get().orgName());
            }
        }

        // Seat check applies only when admitting a brand-new student to the org. This is the
        // friendly, per-row version; upsertMember re-checks under the same lock and is authoritative.
        boolean isNewMember = existing == null
                || orgMemberRepository.findByIdOrgIdAndIdUserId(orgId, existing.getId()).isEmpty();
        if (isNewMember && org.getSeatLimit() > 0
                && membershipService.countByRole(orgId, ROLE_STUDENT) >= org.getSeatLimit()) {
            return RowOutcome.rejectedBySeatLimit();
        }

        boolean created = existing == null;
        User user;
        if (existing != null) {
            user = existing;
        } else {
            String displayName = firstNonBlank(row.displayName(), localPart(email));
            user = userRepository.save(User.builder()
                    .email(email)
                    .passwordHash(passwordEncoder.encode(UUID.randomUUID().toString()))
                    .displayName(displayName)
                    .role(User.Role.STUDENT)
                    .createdVia(User.CreatedVia.CSV)
                    .build());
        }

        membershipService.upsertMember(orgId, user.getId(), ROLE_STUDENT);
        entitlementService.grantStudent(user.getId(), org);

        // D6: từ đây trở xuống dòng đã là thành viên ACTIVE của chính trung tâm này.
        boolean birthDateRecorded = recordBirthDate(row, user, orgId, actor);
        boolean guardianRecorded = recordGuardian(row, user, orgId, actor);
        boolean consentRecorded = recordConsent(row, user, orgId, actor);
        boolean reportSharingRecorded = recordReportSharingConsent(row, user, orgId, actor);
        boolean aiProcessingRecorded = recordAiProcessingConsent(row, user, orgId, actor);

        boolean enrolled = false;
        if (classIdOrNull != null) {
            // enroll() mở lại dòng cũ của học viên từng rời lớp thay vì save() đè NULL lên nhận xét
            // và điểm kỹ năng (D2). Trả true đúng khi lượt này thực sự đưa họ (trở) vào lớp — và chỉ
            // khi ấy học viên mới nhận thông báo phân lớp (ADDED_TO_CLASS qua outbox, DEC-18); nhập
            // lại roster với người đang học không báo gì.
            enrolled = classEnrollmentService.enrollAndNotify(classIdOrNull, user.getId(),
                    actor == null ? null : actor.id());
            if (enrolled) {
                // Provision the class's existing assignments for the imported student (idempotent).
                assignmentBackfillService.ensureAssignmentsForStudent(classIdOrNull, user.getId());
            }
        }
        return RowOutcome.imported(created, enrolled, birthDateRecorded, guardianRecorded,
                consentRecorded, reportSharingRecorded, aiProcessingRecorded);
    }

    /**
     * Ghi ngày sinh qua {@link MinorLearnerService} — KHÔNG viết SQL ở đây, vì chốt "chỉ ghi khi cột
     * đang NULL", vết audit và cách phân loại tuổi phải nằm cùng một chỗ cho mọi đường vào.
     *
     * <p>{@code false} = tài khoản đã có ngày sinh. Đây là kết quả BÌNH THƯỜNG, không phải lỗi:
     * CSV cho một MANAGER gõ email bất kỳ, nên "cập nhật khi tài khoản đã tồn tại" chính là đường
     * một trung tâm sửa thuộc tính danh tính trên tài khoản của người khác — hạ tuổi một em 15
     * xuống 18 là mở khoá đường gửi giọng nói của em ấy ra nhà cung cấp bên ngoài. Không đi vòng.
     */
    private boolean recordBirthDate(RosterRowInput row, User user, Long orgId, AuditActor actor) {
        if (row.birthDate() == null) {
            return false;
        }
        Long recordedBy = actor == null ? null : actor.id();
        return minorLearnerService.recordBirthDate(user.getId(), row.birthDate(), recordedBy, orgId, actor);
    }

    /**
     * Thêm người giám hộ CHỈ khi học viên chưa có ai — cùng luật ghi-một-lần với ngày sinh, và vì
     * {@code student_guardians} là bảng chỉ-thêm: không chặn thì nhập lại cùng một tệp lần thứ hai
     * sẽ nhân đôi người giám hộ của mọi học viên, mà bảng đó không có đường xoá.
     *
     * <p>Đổi hoặc thêm người giám hộ là đường riêng, có màn hình và kiểm quyền riêng
     * ({@code OrgGuardianConsentController}) — không phải một ô trong tệp CSV mà bất kỳ MANAGER nào
     * cũng ghi đè được.
     */
    private boolean recordGuardian(RosterRowInput row, User user, Long orgId, AuditActor actor) {
        if (row.guardian() == null || !minorLearnerService.guardiansOf(user.getId()).isEmpty()) {
            return false;
        }
        minorLearnerService.recordGuardian(user.getId(), orgId, row.guardian(), actor);
        return true;
    }

    /**
     * Cột {@code consentConfirmed} (D1): ghi MỘT dòng {@code AUDIO_RECORDING / GRANTED / PAPER} —
     * "trung tâm xác nhận đã cầm phiếu giấy ký của người giám hộ" (mục C1 của phiếu). Quy tắc ghi ở
     * {@link #recordPaperConsent}.
     */
    private boolean recordConsent(RosterRowInput row, User user, Long orgId, AuditActor actor) {
        return row.consentConfirmed()
                && recordPaperConsent(user, orgId, StudentConsent.Scope.AUDIO_RECORDING, actor);
    }

    /**
     * Cột {@code reportSharingConfirmed} (R6): ghi MỘT dòng {@code GUARDIAN_REPORT_SHARING / GRANTED /
     * PAPER} — mục C2 của cùng phiếu giấy, người giám hộ đồng ý nhận phiếu đánh giá của học viên.
     * Cổng phát hành phiếu (PR-R2) đọc scope này cho học viên chưa thành niên; không có dòng này thì
     * phiếu không gửi về gia đình được. Độc lập với C1: phiếu đánh C2 mà bỏ C1 vẫn chỉ ghi scope này.
     */
    private boolean recordReportSharingConsent(RosterRowInput row, User user, Long orgId, AuditActor actor) {
        return row.reportSharingConfirmed()
                && recordPaperConsent(user, orgId, StudentConsent.Scope.GUARDIAN_REPORT_SHARING, actor);
    }

    /**
     * Cột {@code aiProcessingConfirmed} (C3 của phiếu giấy, D3): ghi MỘT dòng
     * {@code AI_PROCESSING / GRANTED / PAPER} — người giám hộ đồng ý cho AI chấm bài làm của học viên.
     * Cổng chấm bài AI ({@code MinorGate}) đọc scope này cho học viên vị thành niên của trung tâm;
     * không có dòng này thì bài viết phải giáo viên chấm tay. Độc lập với C1/C2.
     */
    private boolean recordAiProcessingConsent(RosterRowInput row, User user, Long orgId, AuditActor actor) {
        return row.aiProcessingConfirmed()
                && recordPaperConsent(user, orgId, StudentConsent.Scope.AI_PROCESSING, actor);
    }

    /**
     * Ghi một dòng {@code scope / GRANTED / PAPER} từ tệp roster: người ghi là người bấm import, hiệu
     * lực từ lúc nhập, phiên bản điều khoản do máy chủ quyết ({@link MinorConsentTerms}).
     *
     * <p><b>Idempotent theo TRẠNG THÁI, không theo dòng.</b> Sổ đồng ý chỉ-ghi-thêm; một trung tâm
     * nhập lại cùng tệp mỗi học kỳ mà mỗi lần lại thêm một dòng GRANTED thì sổ phình vô nghĩa và
     * "lần đồng ý đầu tiên" chìm giữa các bản sao. Đang {@code GRANTED} ⇒ không ghi. Đang
     * {@code REVOKED} thì VẪN ghi: phiếu mới của người giám hộ là bằng chứng mới, và cấp lại sau
     * thu hồi đúng là việc mà đường này phải làm được. Trạng thái xét THEO TỪNG SCOPE — ghi âm đã
     * GRANTED không làm dòng chia sẻ phiếu bị bỏ qua, và ngược lại.
     *
     * <p>Nối với người giám hộ CHÍNH hiện có (nếu có) để dòng đồng ý trả lời được "ai đồng ý"; dòng
     * CSV vừa khai giám hộ thì người đó vừa được thêm ở bước trên, nên cũng vào đây.
     */
    private boolean recordPaperConsent(User user, Long orgId, StudentConsent.Scope scope, AuditActor actor) {
        ConsentState current = minorLearnerService.consentStatus(user.getId(), scope);
        if (current == ConsentState.GRANTED) {
            return false;
        }
        Long primaryGuardianId = minorLearnerService.guardiansOf(user.getId()).stream()
                .filter(StudentGuardian::isPrimary)
                .map(StudentGuardian::getId)
                .findFirst()
                .orElse(null);
        minorLearnerService.recordConsent(user.getId(), orgId, new ConsentDraft(
                scope,
                StudentConsent.Action.GRANTED,
                primaryGuardianId,
                StudentConsent.Method.PAPER,
                consentTerms.currentVersion(),
                Instant.now(),
                CONSENT_NOTE_ROSTER_IMPORT), actor);
        return true;
    }

    private static String localPart(String email) {
        int at = email.indexOf('@');
        return at > 0 ? email.substring(0, at) : email;
    }

    private static String firstNonBlank(String a, String b) {
        return (a != null && !a.isBlank()) ? a.trim() : b;
    }
}
