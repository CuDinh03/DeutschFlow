package com.deutschflow.organization.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.organization.dto.RosterImportResultDto;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.teacher.entity.ClassStudent;
import com.deutschflow.teacher.entity.ClassStudentId;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Bulk student onboarding for an organization via CSV.
 *
 * <p>Each data row is wrapped in its own try/catch so a single bad row never aborts the
 * whole import — failures are collected into {@link RosterImportResultDto#errors()}.
 * For every valid row we link-or-create the user, upsert the org membership, grant the
 * org-funded plan, and (optionally) enroll into a class. Seat limits are enforced before
 * a brand-new student is admitted.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OrgRosterService {

    private static final String ROLE_STUDENT = "STUDENT";
    private static final Pattern EMAIL_PATTERN =
            Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final OrgMembershipService membershipService;
    private final OrgEntitlementService entitlementService;
    private final OrgMemberRepository orgMemberRepository;
    private final ClassStudentRepository classStudentRepository;
    private final TeacherClassRepository teacherClassRepository;
    private final JdbcTemplate jdbcTemplate;

    /**
     * Imports students from raw CSV text. Columns: {@code email,displayName[,phone]} (comma).
     * The first non-empty line is treated as a header only when its first column equals {@code "email"}.
     *
     * @param classIdOrNull when non-null, every imported student is also enrolled into this class
     */
    @Transactional
    public RosterImportResultDto importStudents(Long orgId, String csvText, Long classIdOrNull) {
        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy tổ chức: id=" + orgId));

        // Acquire a row-level lock on the org for the duration of this transaction so that two
        // concurrent imports to the same org cannot both pass the seat-limit check and both insert
        // students past the limit (J). The lock is held until the outer @Transactional commits.
        jdbcTemplate.queryForObject("SELECT id FROM organizations WHERE id = ? FOR UPDATE",
                Long.class, orgId);

        // IDOR guard: a target class must belong to THIS org, else an org-admin could enroll
        // students into another org's class by passing a foreign classId.
        if (classIdOrNull != null) {
            TeacherClass target = teacherClassRepository.findById(classIdOrNull)
                    .orElseThrow(() -> new BadRequestException("Không tìm thấy lớp học: id=" + classIdOrNull));
            if (!orgId.equals(target.getOrgId())) {
                throw new ForbiddenException("Lớp học không thuộc tổ chức này");
            }
        }

        List<String> rows = splitNonEmptyLines(csvText);
        List<String> errors = new ArrayList<>();
        int total = 0;
        int created = 0;
        int linked = 0;
        int enrolled = 0;
        int failed = 0;
        boolean seatLimitHit = false;

        boolean first = true;
        for (String rawLine : rows) {
            // Skip a header line: only the first non-empty line, and only when its FIRST column is
            // literally "email". Checking the whole line for "email" would wrongly drop a data row
            // whose address (e.g. "emailguy@x.com") or name contains the substring.
            if (first) {
                first = false;
                if (col(rawLine.split(",", -1), 0).trim().equalsIgnoreCase("email")) {
                    continue;
                }
            }

            total++;
            int rowNum = total;
            try {
                String[] cols = rawLine.split(",", -1);
                String email = normalizeEmail(col(cols, 0));
                if (email.isBlank() || !EMAIL_PATTERN.matcher(email).matches()) {
                    failed++;
                    errors.add("Dòng " + rowNum + ": email không hợp lệ \"" + col(cols, 0).trim() + "\"");
                    continue;
                }

                User existing = userRepository.findByEmail(email).orElse(null);

                // Seat check applies only when admitting a brand-new student to the org.
                boolean isNewMember = existing == null
                        || orgMemberRepository.findByIdOrgIdAndIdUserId(orgId, existing.getId()).isEmpty();
                if (isNewMember && org.getSeatLimit() > 0
                        && membershipService.countByRole(orgId, ROLE_STUDENT) >= org.getSeatLimit()) {
                    failed++;
                    seatLimitHit = true;
                    errors.add("Dòng " + rowNum + ": đã đạt giới hạn chỗ ngồi ("
                            + org.getSeatLimit() + "), bỏ qua " + email);
                    // Skip this new student but continue — existing members later in the CSV
                    // are still allowed and must not be silently dropped (K).
                    continue;
                }

                User user;
                if (existing != null) {
                    user = existing;
                    linked++;
                } else {
                    String displayName = firstNonBlank(col(cols, 1), localPart(email));
                    user = userRepository.save(User.builder()
                            .email(email)
                            .passwordHash(passwordEncoder.encode(UUID.randomUUID().toString()))
                            .displayName(displayName)
                            .role(User.Role.STUDENT)
                            .createdVia(User.CreatedVia.CSV)
                            .build());
                    created++;
                }

                membershipService.upsertMember(orgId, user.getId(), ROLE_STUDENT);
                entitlementService.grantStudent(user.getId(), org);

                if (classIdOrNull != null
                        && !classStudentRepository.existsByIdClassIdAndIdStudentId(classIdOrNull, user.getId())) {
                    classStudentRepository.save(ClassStudent.builder()
                            .id(new ClassStudentId(classIdOrNull, user.getId()))
                            .build());
                    enrolled++;
                }
            } catch (Exception ex) {
                failed++;
                errors.add("Dòng " + rowNum + ": lỗi xử lý — " + ex.getMessage());
                log.warn("Roster import row {} failed for org {}", rowNum, orgId, ex);
            }
        }

        if (seatLimitHit) {
            log.info("Roster import for org {} stopped early at seat limit {}", orgId, org.getSeatLimit());
        }
        return new RosterImportResultDto(total, created, linked, enrolled, failed, errors);
    }

    private static List<String> splitNonEmptyLines(String csvText) {
        List<String> out = new ArrayList<>();
        if (csvText == null) {
            return out;
        }
        for (String line : csvText.split("\\r?\\n")) {
            if (!line.isBlank()) {
                out.add(line.strip());
            }
        }
        return out;
    }

    private static String col(String[] cols, int idx) {
        return idx < cols.length ? cols[idx] : "";
    }

    private static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }

    private static String localPart(String email) {
        int at = email.indexOf('@');
        return at > 0 ? email.substring(0, at) : email;
    }

    private static String firstNonBlank(String a, String b) {
        return (a != null && !a.isBlank()) ? a.trim() : b;
    }
}
