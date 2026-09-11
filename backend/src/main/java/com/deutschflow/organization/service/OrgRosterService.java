package com.deutschflow.organization.service;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
 * <p><b>Cột của tệp.</b> Tối thiểu {@code email,displayName[,phone]} như từ đầu. Tệp có dòng tiêu đề
 * chứa {@code birthDate} (hoặc {@code consentConfirmed} / {@code reportSharingConfirmed}) thì đọc thêm
 * {@code birthDate[,guardianName,guardianPhone,guardianRelationship,guardianEmail,consentConfirmed,
 * reportSharingConfirmed,aiProcessingConfirmed]} — xem {@link RosterColumnLayout} về việc vì sao cột mới là TÙY CHỌN và tệp
 * cũ của trung tâm không được vỡ. {@code consentConfirmed} (D1, owner chốt 10/09/2026) là đường nhập
 * HÀNG LOẠT phiếu đồng ý giấy cho phạm vi ghi âm (mục C1); {@code reportSharingConfirmed} (R6) là mục
 * C2 của cùng phiếu — đồng ý chia sẻ phiếu đánh giá với người giám hộ ({@code GUARDIAN_REPORT_SHARING});
 * {@code guardianEmail} (R11) là cột thứ hai để bản ghi giám hộ liên lạc được.
 *
 * <p><b>Ghi danh KHÔNG phải cổng chặn</b> (owner chốt 09/09/2026, giữ nguyên ở D2 10/09/2026). Dòng
 * không khai ngày sinh vẫn được nhập bình thường; học viên dưới 16 thiếu đồng ý VẪN VÀO, chỉ phần
 * nói bị khoá cho tới khi trung tâm ghi nhận phiếu. Cổng của dữ liệu chưa thành niên nằm ở đường đi
 * ra nhà cung cấp AI, không nằm ở đây. Chỉ dòng TỰ MÂU THUẪN mới bị từ chối — khai tuổi dưới ngưỡng
 * pháp lý mà bỏ trống người giám hộ, ngày sinh sai định dạng, ngày sinh ở tương lai, ô đồng ý gõ lạ,
 * email giám hộ sai hoặc trùng email học viên (xem {@link RosterMinorColumnReader}) — và dòng của học
 * viên đang thuộc trung tâm KHÁC (F4, nêu tên trung tâm đó).
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
    private final RosterMinorColumnReader minorColumnReader;
    private final AuditLogService auditLogService;

    /**
     * Imports students from raw CSV text. Columns:
     * {@code email,displayName[,phone][,birthDate[,guardianName,guardianPhone,guardianRelationship,
     * guardianEmail,consentConfirmed,reportSharingConfirmed,aiProcessingConfirmed]]} (comma-separated). The first non-empty
     * line is treated as a header only when its first column equals {@code "email"}; the minor columns
     * are read only when that header names {@code birthDate}, {@code consentConfirmed},
     * {@code reportSharingConfirmed} or {@code aiProcessingConfirmed}, so an existing three-column
     * file behaves exactly as before.
     *
     * @param classIdOrNull when non-null, every imported student is also enrolled into this class
     * @param actor         người bấm import — vết tổng kết mang danh tính này
     */
    public RosterImportResultDto importStudents(Long orgId, String csvText, Long classIdOrNull,
                                                AuditActor actor) {
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

        List<CsvRecord> rows = splitNonEmptyLines(csvText);
        List<String> errors = new ArrayList<>();
        int total = 0;
        int created = 0;
        int linked = 0;
        int enrolled = 0;
        int failed = 0;
        int birthDatesRecorded = 0;
        int guardiansRecorded = 0;
        int consentsRecorded = 0;
        int reportSharingConsentsRecorded = 0;
        int aiProcessingConsentsRecorded = 0;
        int rejectedByOtherOrg = 0;
        boolean seatLimitHit = false;

        // Bố cục cột, giải MỘT LẦN từ dòng tiêu đề. Không có tiêu đề ⇒ tệp ba cột như trước.
        RosterColumnLayout layout = RosterColumnLayout.legacy();
        boolean first = true;
        for (CsvRecord record : rows) {
            String rawLine = record.text();
            // Audit L-3: strip a leading UTF-8 BOM (U+FEFF). Excel/Google-Sheets exports prepend it
            // to the first line, which otherwise makes the header cell read "﻿email" — the
            // header check fails, the header is parsed as a data row, and (with no header) the first
            // real email is corrupted. PR-A5b (07/09/2026): ô bọc ngoặc kép (tên có dấu phẩy, ngoặc kép
            // kép "" bên trong) được tách đúng theo RFC 4180 qua splitCsvLine — Excel/Sheets luôn xuất
            // như vậy với tên kiểu "Nguyễn, An".
            String line = rawLine.startsWith("\uFEFF") ? rawLine.substring(1) : rawLine;
            // Skip a header line: only the first non-empty line, and only when its FIRST column is
            // literally "email". Checking the whole line for "email" would wrongly drop a data row
            // whose address (e.g. "emailguy@x.com") or name contains the substring.
            //
            // PR-1B (09/09/2026): dòng tiêu đề nay còn TRẢ VỀ bố cục cột. Không có "birthDate" trong
            // tiêu đề thì fromHeader trả legacy() — tệp ba cột đang dùng của trung tâm đi đúng nhánh
            // cũ, không một dòng nào đổi kết quả.
            if (first) {
                first = false;
                String[] headerCols = splitCsvLine(line);
                if (RosterColumnLayout.isHeader(headerCols)) {
                    layout = RosterColumnLayout.fromHeader(headerCols);
                    continue;
                }
            }

            total++;
            // Số dòng VẬT LÝ trong tệp (tính cả header) để người dùng dò đúng chỗ trong Excel.
            int rowNum = record.line();
            try {
                String[] cols = splitCsvLine(line);
                String email = normalizeEmail(col(cols, layout.email()));
                if (email.isBlank() || !EMAIL_PATTERN.matcher(email).matches()) {
                    failed++;
                    errors.add("Dòng " + rowNum + ": email không hợp lệ \""
                            + col(cols, layout.email()).trim() + "\"");
                    continue;
                }

                // Kiểm cột chưa-thành-niên TRƯỚC khi chạm DB: dòng tự mâu thuẫn thì không nên tạo
                // tài khoản rồi mới phát hiện. Lý do trả về đã kèm số dòng vật lý và email.
                RosterMinorColumnReader.Result minorData =
                        minorColumnReader.read(cols, layout, rowNum, email);
                if (minorData.rejected()) {
                    failed++;
                    errors.add(minorData.error());
                    continue;
                }

                RowOutcome outcome = rowImporter.importRow(
                        org,
                        new RosterRowInput(email, col(cols, layout.displayName()),
                                minorData.birthDate(), minorData.guardian(), minorData.consentConfirmed(),
                                minorData.reportSharingConfirmed(), minorData.aiProcessingConfirmed()),
                        classIdOrNull,
                        actor);

                if (outcome.seatLimited()) {
                    failed++;
                    seatLimitHit = true;
                    errors.add("Dòng " + rowNum + ": đã đạt giới hạn chỗ ngồi ("
                            + org.getSeatLimit() + "), bỏ qua " + email);
                    // Skip this new student but continue — existing members later in the CSV
                    // are still allowed and must not be silently dropped (K).
                    continue;
                }
                if (outcome.rejectedByOtherOrg()) {
                    // F4: câu báo mang số dòng, email VÀ tên trung tâm kia — người nhập biết ngay phải
                    // nhờ ai (trung tâm A gỡ, hoặc học viên tự rời) thay vì đọc "lỗi xử lý".
                    failed++;
                    rejectedByOtherOrg++;
                    String other = outcome.otherOrgName().isBlank()
                            ? "một trung tâm khác"
                            : "trung tâm \"" + outcome.otherOrgName() + "\"";
                    errors.add("Dòng " + rowNum + " (" + email + "): học viên đang thuộc " + other
                            + " — chưa thể nhập vào trung tâm này. Học viên cần rời (hoặc được gỡ khỏi) "
                            + "trung tâm đó trước; dòng này chưa ghi gì.");
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
                // KHÔNG cộng vào `failed` khi ngày sinh/người giám hộ không được ghi: tài khoản đã
                // có sẵn giá trị thì recordBirthDate trả false theo thiết kế (một trung tâm không
                // sửa được thuộc tính danh tính trên tài khoản người khác), và một lần NHẬP LẠI
                // cùng tệp sẽ chạm nhánh đó ở mọi dòng. Đếm thành lỗi là báo động giả toàn tệp.
                if (outcome.birthDateRecorded()) {
                    birthDatesRecorded++;
                }
                if (outcome.guardianRecorded()) {
                    guardiansRecorded++;
                }
                if (outcome.consentRecorded()) {
                    consentsRecorded++;
                }
                if (outcome.reportSharingRecorded()) {
                    reportSharingConsentsRecorded++;
                }
                if (outcome.aiProcessingRecorded()) {
                    aiProcessingConsentsRecorded++;
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

        // MỘT dòng vết cho cả lần import, không phải mỗi học viên một dòng: import 30 học viên là
        // MỘT hành động của một người, và 30 dòng audit làm ngập màn hình vết mà không thêm thông
        // tin nào — chi tiết từng dòng lỗi đã nằm trong RosterImportResultDto trả về cho người bấm.
        //
        // Phương thức này cố ý KHÔNG @Transactional (xem javadoc class), nên dòng vết này tự commit
        // độc lập với các transaction-một-dòng ở trên. Đúng ý muốn: import hỏng một phần vẫn phải để
        // lại vết, kèm đúng con số đã đếm được — khác với các mutation đơn lẻ ở nơi khác, nơi vết đi
        // chung transaction nghiệp vụ nên thao tác thất bại không để lại gì.
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("orgId", orgId);
        meta.put("classId", classIdOrNull);
        meta.put("total", total);
        meta.put("created", created);
        meta.put("linked", linked);
        meta.put("enrolled", enrolled);
        meta.put("failed", failed);
        meta.put("seatLimitHit", seatLimitHit);
        // ⛔ SỐ LƯỢNG, không phải nội dung. Sổ hoạt động này giám đốc trung tâm đọc được VÀ mọi
        // admin nền tảng cũng đọc được, nên không ngày sinh, không tên/điện thoại người giám hộ —
        // cùng luật với metadata của MinorLearnerService. "Đã ghi bao nhiêu" đủ trả lời câu hỏi
        // kiểm toán ("lần nhập này có đụng dữ liệu trẻ em không"); "ghi cái gì" thì không ai cần.
        meta.put("birthDatesRecorded", birthDatesRecorded);
        meta.put("guardiansRecorded", guardiansRecorded);
        meta.put("consentsRecorded", consentsRecorded);
        meta.put("reportSharingConsentsRecorded", reportSharingConsentsRecorded);
        meta.put("aiProcessingConsentsRecorded", aiProcessingConsentsRecorded);
        meta.put("rejectedByOtherOrg", rejectedByOtherOrg);
        // DEC-13: orgId là tham số của hàm — trung tâm nhận roster. Đường lùi suy-từ-actor không
        // cứu được ca admin nền tảng import hộ (actor không thuộc trung tâm nào).
        auditLogService.log("org_member_imported", actor, "ORG", String.valueOf(orgId), orgId, meta);
        return new RosterImportResultDto(total, created, linked, enrolled, failed, errors);
    }

    /**
     * Một bản ghi CSV kèm số dòng VẬT LÝ nơi nó bắt đầu (1-based, TÍNH CẢ dòng header).
     *
     * <p>Trước PR-A5c thông báo lỗi đánh số theo thứ tự dòng DỮ LIỆU (bỏ qua header), nên với tệp có
     * header thì "Dòng 3" của máy chủ thực ra là dòng thứ 4 trong Excel — người dùng dò không ra chỗ
     * cần sửa, đúng lúc tính năng tải tệp lỗi cần chính xác nhất. Nay dùng số dòng vật lý, khớp với
     * trường {@code line} mà phía web tính.
     */
    record CsvRecord(String text, int line) {}

    /**
     * Tách CSV thành từng BẢN GHI, tôn trọng ô bọc ngoặc kép.
     *
     * <p>Trước PR-A5c dùng {@code csvText.split("\\r?\\n")}, tức cắt dòng TRƯỚC khi tách cột. RFC 4180
     * cho phép ô bọc ngoặc kép chứa ký tự xuống dòng, nên một dòng hợp lệ như
     * {@code foo@x.com,"Dòng1<LF>Dòng2",0912} bị chẻ làm đôi: nửa đầu vẫn có email hợp lệ nên ÂM THẦM
     * tạo tài khoản với tên cụt và mất số điện thoại, nửa sau thành một dòng lỗi ma không tương ứng
     * dữ liệu nào. Đây là sai lệch dữ liệu im lặng — nguy hiểm hơn hẳn một lỗi lộ ra ngoài.
     *
     * <p>Ngoặc kép không đóng tới cuối tệp thì phần còn lại được coi là một bản ghi, thay vì mất dữ liệu.
     */
    static List<CsvRecord> splitNonEmptyLines(String csvText) {
        List<CsvRecord> out = new ArrayList<>();
        if (csvText == null) {
            return out;
        }
        StringBuilder cur = new StringBuilder();
        boolean quoted = false;
        int[] lineState = {1, 1}; // [0] = dòng vật lý đang đọc, [1] = dòng bắt đầu bản ghi hiện tại
        for (int i = 0; i < csvText.length(); i++) {
            char c = csvText.charAt(i);
            if (quoted) {
                if (c == '"') {
                    // `""` là một dấu ngoặc kép NẰM TRONG ô — giữ nguyên cả hai ký tự cho splitCsvLine.
                    if (i + 1 < csvText.length() && csvText.charAt(i + 1) == '"') {
                        cur.append("\"\"");
                        i++;
                    } else {
                        quoted = false;
                        cur.append(c);
                    }
                } else {
                    if (c == '\n') {
                        lineState[0]++;
                    }
                    cur.append(c);
                }
                continue;
            }
            if (c == '"') {
                quoted = true;
                cur.append(c);
                continue;
            }
            if (c == '\r' || c == '\n') {
                if (c == '\r' && i + 1 < csvText.length() && csvText.charAt(i + 1) == '\n') {
                    i++;
                }
                flushRecord(cur, out, lineState);
                lineState[0]++;
                lineState[1] = lineState[0];
                continue;
            }
            cur.append(c);
        }
        flushRecord(cur, out, lineState);
        return out;
    }

    private static void flushRecord(StringBuilder cur, List<CsvRecord> out, int[] lineState) {
        String rec = cur.toString();
        if (!rec.isBlank()) {
            out.add(new CsvRecord(rec.strip(), lineState[1]));
        }
        cur.setLength(0);
    }

    /** Ô thứ {@code idx}, hoặc chuỗi rỗng. {@code idx < 0} = tệp không có cột đó (xem RosterColumnLayout). */
    private static String col(String[] cols, int idx) {
        return idx >= 0 && idx < cols.length ? cols[idx] : "";
    }

    /**
     * Tách một dòng CSV theo RFC 4180: dấu phẩy trong ô bọc ngoặc kép không tách cột, {@code ""} trong ô
     * bọc ngoặc là một dấu ngoặc kép, ô không bọc giữ nguyên. Dòng không hợp lệ (ngoặc mở không đóng)
     * vẫn trả phần đã đọc — dòng đó sẽ rơi vào nhánh email không hợp lệ thay vì nổ cả lần import.
     */
    static String[] splitCsvLine(String line) {
        List<String> out = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (quoted) {
                if (c == '"') {
                    if (i + 1 < line.length() && line.charAt(i + 1) == '"') {
                        cur.append('"');
                        i++;
                    } else {
                        quoted = false;
                    }
                } else {
                    cur.append(c);
                }
            } else if (c == '"' && cur.length() == 0) {
                quoted = true;
            } else if (c == ',') {
                out.add(cur.toString());
                cur.setLength(0);
            } else {
                cur.append(c);
            }
        }
        out.add(cur.toString());
        return out.toArray(new String[0]);
    }

    private static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }
}
