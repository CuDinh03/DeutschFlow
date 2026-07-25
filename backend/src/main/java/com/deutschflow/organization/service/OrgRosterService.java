package com.deutschflow.organization.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.organization.dto.RosterImportResultDto;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.organization.service.OrgRosterRowImporter.RowOutcome;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Bulk student onboarding for an organization via CSV.
 *
 * <p>Each data row is wrapped in its own try/catch so a single bad row never aborts the
 * whole import — failures are collected into {@link RosterImportResultDto#errors()}.
 * For every valid row we link-or-create the user, upsert the org membership, grant the
 * org-funded plan, and (optionally) enroll into a class. Seat limits are enforced before
 * a brand-new student is admitted.
 *
 * <p>Deliberately NOT {@code @Transactional}: the row work runs in
 * {@link OrgRosterRowImporter#importRow} under {@code REQUIRES_NEW}, one transaction per row. A
 * batch-wide transaction cannot express "some rows failed, the rest still count" — a
 * {@code @Transactional} collaborator that throws marks the shared transaction rollback-only behind
 * the loop's back, and the commit then fails the entire import with
 * {@code UnexpectedRollbackException} no matter how carefully the loop collected the error. For the
 * same reason this method must not be called from inside a caller's transaction; the HTTP endpoint
 * ({@code OrgController#importStudents}) is the only caller and is not transactional.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OrgRosterService {

    private static final Pattern EMAIL_PATTERN =
            Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    private final OrganizationRepository organizationRepository;
    private final TeacherClassRepository teacherClassRepository;
    private final OrgRosterRowImporter rowImporter;

    /**
     * Imports students from raw CSV text. Columns: {@code email,displayName[,phone]} (comma).
     * The first non-empty line is treated as a header only when its first column equals {@code "email"}.
     *
     * @param classIdOrNull when non-null, every imported student is also enrolled into this class
     */
    public RosterImportResultDto importStudents(Long orgId, String csvText, Long classIdOrNull) {
        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy tổ chức: id=" + orgId));

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
            // Audit L-3: strip a leading UTF-8 BOM (U+FEFF). Excel/Google-Sheets exports prepend it
            // to the first line, which otherwise makes the header cell read "﻿email" — the
            // header check fails, the header is parsed as a data row, and (with no header) the first
            // real email is corrupted. NOTE: fields quoted to contain commas are still not handled.
            String line = rawLine.startsWith("\uFEFF") ? rawLine.substring(1) : rawLine;
            // Skip a header line: only the first non-empty line, and only when its FIRST column is
            // literally "email". Checking the whole line for "email" would wrongly drop a data row
            // whose address (e.g. "emailguy@x.com") or name contains the substring.
            if (first) {
                first = false;
                if (col(line.split(",", -1), 0).trim().equalsIgnoreCase("email")) {
                    continue;
                }
            }

            total++;
            int rowNum = total;
            try {
                String[] cols = line.split(",", -1);
                String email = normalizeEmail(col(cols, 0));
                if (email.isBlank() || !EMAIL_PATTERN.matcher(email).matches()) {
                    failed++;
                    errors.add("Dòng " + rowNum + ": email không hợp lệ \"" + col(cols, 0).trim() + "\"");
                    continue;
                }

                RowOutcome outcome = rowImporter.importRow(org, email, col(cols, 1), classIdOrNull);

                if (outcome.seatLimited()) {
                    failed++;
                    seatLimitHit = true;
                    errors.add("Dòng " + rowNum + ": đã đạt giới hạn chỗ ngồi ("
                            + org.getSeatLimit() + "), bỏ qua " + email);
                    // Skip this new student but continue — existing members later in the CSV
                    // are still allowed and must not be silently dropped (K).
                    continue;
                }
                if (outcome.created()) {
                    created++;
                }
                if (outcome.linked()) {
                    linked++;
                }
                if (outcome.enrolled()) {
                    enrolled++;
                }
            } catch (Exception ex) {
                // Safe to swallow: the row ran in its own REQUIRES_NEW transaction, which has already
                // rolled back and completed before we get here. Nothing this row touched survives,
                // and no transaction of ours is left in a rollback-only state.
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
}
