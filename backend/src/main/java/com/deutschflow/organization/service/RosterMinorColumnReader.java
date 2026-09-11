package com.deutschflow.organization.service;

import com.deutschflow.common.minor.GuardianDraft;
import com.deutschflow.common.minor.MinorPolicy;
import com.deutschflow.common.minor.StudentGuardian;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Đọc các cột chưa-thành-niên của một dòng roster CSV, và TỪ CHỐI dòng hỏng kèm lý do đọc được.
 *
 * <p><b>Vì sao kiểm ở đây chứ không để {@code MinorLearnerService} ném.</b> Nó có ném — nhưng ném từ
 * trong transaction của dòng thì {@link OrgRosterService} chỉ bắt được một {@code Exception} và ghi
 * "Dòng N: lỗi xử lý — …". Người nhập một tệp 200 dòng cần biết dòng nào, email nào, sai cái gì, sửa
 * thế nào. Cùng khuôn với các kiểm sớm đã có trong {@link OrgRosterRowImporter} (tài khoản ADMIN,
 * tài khoản đang là nhân sự trung tâm).
 *
 * <p><b>CHỈ nhận ngày dạng ISO {@code YYYY-MM-DD}.</b> Excel Việt Nam hay xuất {@code dd/MM/yyyy},
 * còn Excel bản Mỹ xuất {@code MM/dd/yyyy}, và hai kiểu đó KHÔNG phân biệt được với nhau ở những
 * ngày ≤ 12: {@code 03/05/2010} là 3 tháng 5 hay 5 tháng 3? Đoán sai không báo lỗi gì cả, chỉ lệch
 * ngày sinh trên hồ sơ một đứa trẻ — và ngày sinh chỉ ghi được MỘT LẦN (xem
 * {@code MinorLearnerService#recordBirthDate}), nên không có lần sửa thứ hai. Từ chối thẳng, nói rõ
 * dạng cần dùng, là đường duy nhất không im lặng.
 *
 * <p><b>Cột {@code consentConfirmed} (D1, owner chốt 10/09/2026)</b> là đường nhập HÀNG LOẠT của
 * phiếu đồng ý giấy: ô đánh dấu = trung tâm xác nhận đã cầm trong tay phiếu ký của người giám hộ cho
 * phạm vi ghi âm. Chỉ nhận một bộ giá trị đóng (có/không); một ô "maybe" hay "đang xin" bị từ chối
 * chứ không được đoán thành "không" — đoán sai theo hướng "có" là mở khoá giọng nói của một đứa trẻ
 * mà chưa ai đồng ý, đoán theo hướng "không" thì trung tâm tưởng đã ghi nhận mà thực ra chưa.
 *
 * <p><b>Cột {@code reportSharingConfirmed} (R6)</b> là mục C2 của cùng phiếu giấy: người giám hộ đồng
 * ý cho trung tâm gửi phiếu đánh giá của học viên về gia đình (scope {@code GUARDIAN_REPORT_SHARING}).
 * Cùng bộ giá trị có/không, cùng luật từ chối ô gõ lạ, và ĐỘC LẬP với ô C1: một phiếu có thể đánh C1
 * mà bỏ C2 (hoặc ngược lại), nên hai ô không suy ra nhau.
 *
 * <p><b>Cột {@code aiProcessingConfirmed} (C3 của phiếu {@code 2026-10})</b> là mục thứ ba của cùng
 * phiếu giấy: người giám hộ đồng ý cho AI chấm bài làm của học viên (scope {@code AI_PROCESSING}).
 * D3 (owner chốt 10/09/2026) làm phạm vi này có hiệu lực thật — thiếu nó thì bài viết của học viên
 * vị thành niên phải giáo viên chấm tay. Cùng bộ giá trị có/không và ĐỘC LẬP với C1/C2.
 *
 * <p><b>{@code guardianEmail} không được trùng email học viên.</b> Email giám hộ là địa chỉ nhận phiếu
 * đánh giá và là kênh liên lạc khi cần người lớn; điền email của chính em ấy là biến "đồng ý của
 * người giám hộ" thành đồng ý của trẻ tự cấp cho mình. Từ chối ở đây cho câu có số dòng; đường API
 * ({@code MinorLearnerService}) chặn cùng luật với mã {@code GUARDIAN_EMAIL_IS_STUDENT_EMAIL}.
 */
@Component
@RequiredArgsConstructor
public class RosterMinorColumnReader {

    /** Bằng cận dưới của {@code chk_users_birth_date_sane} (V319) và của MinorLearnerService. */
    private static final LocalDate BIRTH_DATE_FLOOR = LocalDate.of(1900, 1, 1);

    private static final int MAX_GUARDIAN_NAME = 120;
    private static final int MAX_GUARDIAN_PHONE = 32;
    private static final int MAX_GUARDIAN_EMAIL = 255;

    /** Cùng mẫu với {@code OrgRosterService.EMAIL_PATTERN} — email học viên và email giám hộ soi như nhau. */
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    /**
     * Bí danh tiếng Việt cho {@code guardianRelationship} — người nhập là thư ký trung tâm, không
     * phải lập trình viên; bắt gõ {@code LEGAL_GUARDIAN} là bắt gõ sai. So khớp sau khi bỏ dấu và
     * hạ chữ thường, nên "Mẹ" và "me" là một.
     */
    private static final Map<String, StudentGuardian.Relationship> RELATIONSHIP_ALIASES = Map.ofEntries(
            Map.entry("me", StudentGuardian.Relationship.MOTHER),
            Map.entry("mother", StudentGuardian.Relationship.MOTHER),
            Map.entry("cha", StudentGuardian.Relationship.FATHER),
            Map.entry("bo", StudentGuardian.Relationship.FATHER),
            Map.entry("ba", StudentGuardian.Relationship.FATHER),
            Map.entry("father", StudentGuardian.Relationship.FATHER),
            Map.entry("nguoigiamho", StudentGuardian.Relationship.LEGAL_GUARDIAN),
            Map.entry("giamho", StudentGuardian.Relationship.LEGAL_GUARDIAN),
            Map.entry("legalguardian", StudentGuardian.Relationship.LEGAL_GUARDIAN),
            Map.entry("guardian", StudentGuardian.Relationship.LEGAL_GUARDIAN),
            Map.entry("khac", StudentGuardian.Relationship.OTHER),
            Map.entry("other", StudentGuardian.Relationship.OTHER));

    private static final String ACCEPTED_RELATIONSHIPS =
            "MOTHER, FATHER, LEGAL_GUARDIAN, OTHER (hoặc mẹ, cha/bố, người giám hộ, khác)";

    /**
     * Giá trị "CÓ" của một ô có/không ({@code consentConfirmed}, {@code reportSharingConfirmed},
     * {@code aiProcessingConfirmed}), so
     * khớp sau {@link RosterColumnLayout#normalize} (bỏ dấu, hạ chữ thường):
     * {@code true/yes/y/1/x/có/đã thu/đã xác nhận/đồng ý…}. Ba cột dùng CHUNG một bộ: thư ký điền
     * các ô cạnh nhau trên cùng một tệp, hai bộ giá trị khác nhau là mời gõ sai.
     */
    private static final Set<String> CONSENT_YES = Set.of(
            "true", "yes", "y", "1", "x", "v", "ok", "co", "da", "dathu", "daco", "daxacnhan",
            "dongy", "dadongy", "granted", "confirmed", "checked");

    /** Giá trị "KHÔNG" — ô trống cũng là "không", xử riêng trước khi tra bảng này. */
    private static final Set<String> CONSENT_NO = Set.of(
            "false", "no", "n", "0", "khong", "chua", "chuathu", "chuaco", "none");

    private static final String ACCEPTED_CONSENT_VALUES =
            "true/yes/1/x/có/đã thu (đã xác nhận) hoặc false/no/0/không/chưa; để trống = chưa";

    private final MinorPolicy minorPolicy;

    /**
     * Kết quả đọc một dòng. Hoặc {@code error != null} (dòng bị từ chối, lý do đã kèm số dòng và
     * email), hoặc dữ liệu đã sạch — trong đó {@code birthDate}/{@code guardian} vẫn có thể là
     * {@code null} vì ô để trống, và đó KHÔNG phải lỗi.
     *
     * @param consentConfirmed       trung tâm xác nhận ĐÃ CÓ phiếu đồng ý giấy của người giám hộ cho
     *                               phạm vi ghi âm ({@code consentConfirmed} = có). {@code false} = ô
     *                               trống, ô "không", hoặc tệp không có cột này — ba ca đó đều là
     *                               "chưa ghi nhận gì", không phải "thu hồi"
     * @param reportSharingConfirmed trung tâm xác nhận đã có mục C2 của phiếu: người giám hộ đồng ý
     *                               nhận phiếu đánh giá ({@code reportSharingConfirmed} = có). Cùng ba
     *                               nghĩa của {@code false} như trên
     * @param aiProcessingConfirmed  trung tâm xác nhận đã có mục C3 của phiếu: người giám hộ đồng ý
     *                               cho AI chấm bài làm ({@code aiProcessingConfirmed} = có). Cùng ba
     *                               nghĩa của {@code false} như trên
     */
    public record Result(LocalDate birthDate, GuardianDraft guardian, boolean consentConfirmed,
                         boolean reportSharingConfirmed, boolean aiProcessingConfirmed, String error) {

        static Result rejected(String error) {
            return new Result(null, null, false, false, false, error);
        }

        static Result of(LocalDate birthDate, GuardianDraft guardian, boolean consentConfirmed,
                         boolean reportSharingConfirmed, boolean aiProcessingConfirmed) {
            return new Result(birthDate, guardian, consentConfirmed, reportSharingConfirmed,
                    aiProcessingConfirmed, null);
        }

        public boolean rejected() {
            return error != null;
        }
    }

    /** Dòng của tệp không khai cột ngày sinh lẫn cột đồng ý — không đọc gì, không từ chối gì. */
    public static final Result NOTHING = Result.of(null, null, false, false, false);

    /** Một ô có/không đã đọc: {@code error != null} khi ô gõ lạ. Ô trống là {@link #NO}. */
    private record YesNo(boolean value, String error) {
        static final YesNo NO = new YesNo(false, null);
        static final YesNo YES = new YesNo(true, null);
    }

    /**
     * @param rowNum số dòng VẬT LÝ trong tệp (tính cả header) — người nhập dò theo số này trong Excel
     * @param email  email của dòng, đã chuẩn hoá; đi kèm mọi thông báo để dò được cả khi sắp lại tệp
     */
    public Result read(String[] cols, RosterColumnLayout layout, int rowNum, String email) {
        if (!layout.readsMinorColumns()) {
            return NOTHING;
        }
        String where = "Dòng " + rowNum + " (" + email + "): ";

        String rawBirthDate = value(cols, layout.birthDate());
        LocalDate birthDate = null;
        if (!rawBirthDate.isEmpty()) {
            try {
                birthDate = LocalDate.parse(rawBirthDate);
            } catch (DateTimeParseException ex) {
                return Result.rejected(where + "ngày sinh \"" + rawBirthDate + "\" không đọc được — "
                        + "cần dạng YYYY-MM-DD (ví dụ 2010-02-01).");
            }
            if (birthDate.isAfter(LocalDate.now(MinorPolicy.ZONE))) {
                return Result.rejected(where + "ngày sinh " + birthDate + " ở tương lai.");
            }
            if (birthDate.isBefore(BIRTH_DATE_FLOOR)) {
                return Result.rejected(where + "ngày sinh " + birthDate
                        + " không hợp lệ (trước " + BIRTH_DATE_FLOOR + ").");
            }
        }

        // Hai ô đồng ý đọc TRƯỚC cột giám hộ: một ô đồng ý gõ lạ phải bị từ chối kể cả khi dòng không
        // khai người giám hộ, và thông báo của nó không nên bị che bởi một lỗi giám hộ khác.
        YesNo consent = readYesNo(cols, layout.consentConfirmed(), "consentConfirmed", where);
        if (consent.error() != null) {
            return Result.rejected(consent.error());
        }
        YesNo reportSharing = readYesNo(cols, layout.reportSharingConfirmed(), "reportSharingConfirmed", where);
        if (reportSharing.error() != null) {
            return Result.rejected(reportSharing.error());
        }
        YesNo aiProcessing = readYesNo(cols, layout.aiProcessingConfirmed(), "aiProcessingConfirmed", where);
        if (aiProcessing.error() != null) {
            return Result.rejected(aiProcessing.error());
        }
        boolean consentConfirmed = consent.value();
        boolean reportSharingConfirmed = reportSharing.value();
        boolean aiProcessingConfirmed = aiProcessing.value();

        String guardianName = value(cols, layout.guardianName());
        String guardianPhone = value(cols, layout.guardianPhone());
        String guardianEmail = value(cols, layout.guardianEmail()).toLowerCase();
        String rawRelationship = value(cols, layout.guardianRelationship());
        boolean hasGuardian = !guardianName.isEmpty() || !guardianPhone.isEmpty() || !guardianEmail.isEmpty();

        // Chốt của luật: dưới ngưỡng pháp lý thì người giám hộ là BẮT BUỘC (NĐ 13/2023 Điều 20).
        // Đây KHÔNG mâu thuẫn với "ghi danh không phải cổng": không khai ngày sinh thì dòng vẫn
        // vào bình thường. Chỉ khi trung tâm ĐÃ nói em ấy 14 tuổi mà vẫn bỏ trống người giám hộ
        // thì mới từ chối — nhận dòng đó là tự tay tạo một hồ sơ thiếu thứ luật đòi.
        if (birthDate != null && !hasGuardian
                && minorPolicy.statusOf(birthDate).requiresGuardianConsent()) {
            return Result.rejected(where + "học viên "
                    + minorPolicy.ageAt(birthDate, java.time.Instant.now()) + " tuổi (dưới "
                    + minorPolicy.legalThreshold() + ") bắt buộc phải có người giám hộ — "
                    + "điền guardianName và guardianPhone (hoặc guardianEmail).");
        }

        if (!hasGuardian) {
            if (!rawRelationship.isEmpty()) {
                return Result.rejected(where + "có guardianRelationship nhưng thiếu guardianName "
                        + "và guardianPhone/guardianEmail.");
            }
            return Result.of(birthDate, null, consentConfirmed, reportSharingConfirmed,
                    aiProcessingConfirmed);
        }
        if (guardianName.isEmpty()) {
            return Result.rejected(where + "có guardianPhone/guardianEmail nhưng thiếu guardianName.");
        }
        // Bằng chk_student_guardians_contactable: bản ghi giám hộ phải liên lạc được — số điện thoại
        // HOẶC email (R11: tệp CSV nay có cột guardianEmail, nên không còn bắt buộc số điện thoại).
        if (guardianPhone.isEmpty() && guardianEmail.isEmpty()) {
            return Result.rejected(where + "có guardianName nhưng thiếu guardianPhone và guardianEmail — "
                    + "người giám hộ phải liên lạc được.");
        }
        if (guardianName.length() > MAX_GUARDIAN_NAME) {
            return Result.rejected(where + "tên người giám hộ dài quá " + MAX_GUARDIAN_NAME + " ký tự.");
        }
        if (guardianPhone.length() > MAX_GUARDIAN_PHONE) {
            return Result.rejected(where + "số điện thoại người giám hộ dài quá "
                    + MAX_GUARDIAN_PHONE + " ký tự.");
        }
        if (!guardianEmail.isEmpty()) {
            if (!EMAIL_PATTERN.matcher(guardianEmail).matches()) {
                return Result.rejected(where + "guardianEmail \"" + guardianEmail + "\" không hợp lệ.");
            }
            if (guardianEmail.length() > MAX_GUARDIAN_EMAIL) {
                return Result.rejected(where + "email người giám hộ dài quá " + MAX_GUARDIAN_EMAIL + " ký tự.");
            }
            // `email` đã hạ chữ thường ở OrgRosterService, guardianEmail hạ ở trên — vẫn so không
            // phân biệt hoa thường cho chắc: chốt này không được phụ thuộc thứ tự chuẩn hoá của caller.
            if (guardianEmail.equalsIgnoreCase(email)) {
                return Result.rejected(where + "guardianEmail \"" + guardianEmail
                        + "\" trùng email của học viên — người giám hộ phải dùng địa chỉ email riêng "
                        + "(đây là nơi nhận phiếu đánh giá và liên lạc khi cần người lớn).");
            }
        }

        StudentGuardian.Relationship relationship;
        if (rawRelationship.isEmpty()) {
            // Để trống là chuyện thường của một tệp xuất từ phần mềm khác. OTHER nói đúng sự thật
            // ("có người giám hộ, chưa khai quan hệ") mà không chặn dòng, và không bịa ra "mẹ".
            relationship = StudentGuardian.Relationship.OTHER;
        } else {
            relationship = RELATIONSHIP_ALIASES.get(RosterColumnLayout.normalize(rawRelationship));
            if (relationship == null) {
                return Result.rejected(where + "guardianRelationship \"" + rawRelationship
                        + "\" không hợp lệ — nhận " + ACCEPTED_RELATIONSHIPS + ".");
            }
        }

        // primary = true: đây là người liên lạc ĐẦU TIÊN và duy nhất của dòng CSV này. recordGuardian
        // hạ người chính cũ nếu có — nhưng OrgRosterRowImporter chỉ gọi khi học viên chưa có ai.
        return Result.of(birthDate,
                new GuardianDraft(guardianName, relationship,
                        guardianPhone.isEmpty() ? null : guardianPhone,
                        guardianEmail.isEmpty() ? null : guardianEmail,
                        true),
                consentConfirmed,
                reportSharingConfirmed,
                aiProcessingConfirmed);
    }

    /**
     * Đọc một ô có/không theo bộ giá trị đóng. {@code index < 0} (tệp không có cột) và ô trống đều
     * là "không" — ba nghĩa của {@code false} ghi ở javadoc {@link Result}. Ô gõ lạ ⇒ thông báo mang
     * TÊN CỘT để người nhập biết sửa ô nào khi hai cột đồng ý đứng cạnh nhau.
     */
    private static YesNo readYesNo(String[] cols, int index, String columnName, String where) {
        String raw = value(cols, index);
        if (raw.isEmpty()) {
            return YesNo.NO;
        }
        String folded = RosterColumnLayout.normalize(raw);
        if (CONSENT_YES.contains(folded)) {
            return YesNo.YES;
        }
        if (CONSENT_NO.contains(folded)) {
            return YesNo.NO;
        }
        return new YesNo(false, where + columnName + " \"" + raw + "\" không hợp lệ — nhận "
                + ACCEPTED_CONSENT_VALUES + ".");
    }

    private static String value(String[] cols, int index) {
        if (index < 0 || index >= cols.length || cols[index] == null) {
            return "";
        }
        return cols[index].trim();
    }
}
