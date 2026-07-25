package com.deutschflow.organization.service;

import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.teacher.entity.ClassStudent;
import com.deutschflow.teacher.entity.ClassStudentId;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.service.AssignmentBackfillService;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

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
 */
@Service
@RequiredArgsConstructor
public class OrgRosterRowImporter {

    private static final String ROLE_STUDENT = "STUDENT";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final OrgMembershipService membershipService;
    private final OrgEntitlementService entitlementService;
    private final OrgMemberRepository orgMemberRepository;
    private final ClassStudentRepository classStudentRepository;
    private final AssignmentBackfillService assignmentBackfillService;
    private final JdbcTemplate jdbcTemplate;

    /**
     * What one row did. {@code created} and {@code linked} are mutually exclusive; {@code seatLimited}
     * means the row was rejected by the seat gate and nothing was written.
     */
    public record RowOutcome(boolean created, boolean linked, boolean enrolled, boolean seatLimited) {

        static RowOutcome rejectedBySeatLimit() {
            return new RowOutcome(false, false, false, true);
        }

        static RowOutcome imported(boolean created, boolean enrolled) {
            return new RowOutcome(created, !created, enrolled, false);
        }
    }

    /**
     * Links-or-creates the user, upserts the org membership, grants the org-funded plan and
     * (optionally) enrolls into a class — all or nothing for THIS row.
     *
     * @param org           the target org, loaded once by the caller (read-only here)
     * @param email         already normalized and format-validated by the caller
     * @param displayNameCol raw display-name column; falls back to the email local part when blank
     * @param classIdOrNull when non-null, the student is also enrolled into this class
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public RowOutcome importRow(Organization org, String email, String displayNameCol, Long classIdOrNull) {
        Long orgId = org.getId();

        // Row-level lock on the org, held for this row's transaction (J). It used to be taken once
        // for the whole import; now that each row commits separately, batch-scoping it would be both
        // wrong (a REQUIRES_NEW row runs on its own connection and would block on the batch's own
        // lock — a self-deadlock) and unnecessary. Per row it still serializes concurrent same-org
        // writers, so the seat check below and the seat gate inside upsertMember cannot interleave
        // with another admin's add and let both pass the limit.
        jdbcTemplate.queryForObject("SELECT id FROM organizations WHERE id = ? FOR UPDATE",
                Long.class, orgId);

        User existing = userRepository.findByEmailIgnoreCase(email).orElse(null);

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
            String displayName = firstNonBlank(displayNameCol, localPart(email));
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

        boolean enrolled = false;
        if (classIdOrNull != null
                && !classStudentRepository.existsByIdClassIdAndIdStudentId(classIdOrNull, user.getId())) {
            classStudentRepository.save(ClassStudent.builder()
                    .id(new ClassStudentId(classIdOrNull, user.getId()))
                    .build());
            // Provision the class's existing assignments for the imported student (idempotent).
            assignmentBackfillService.ensureAssignmentsForStudent(classIdOrNull, user.getId());
            enrolled = true;
        }
        return RowOutcome.imported(created, enrolled);
    }

    private static String localPart(String email) {
        int at = email.indexOf('@');
        return at > 0 ? email.substring(0, at) : email;
    }

    private static String firstNonBlank(String a, String b) {
        return (a != null && !a.isBlank()) ? a.trim() : b;
    }
}
